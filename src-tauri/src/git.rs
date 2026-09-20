//! Git execution boundary.
//!
//! Rules enforced here (see CLAUDE_BUILD_INSTRUCTIONS / TECHNICAL_ARCHITECTURE):
//! - arguments are always passed as an argv array — never a shell string
//! - refs and paths coming from the UI are validated against option injection
//! - output is machine-readable (porcelain formats)
//! - everything that leaves this module is redacted before logging

use std::collections::HashSet;
use std::ffi::OsStr;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::error::AppError;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Build a background process without attaching a console window on Windows.
///
/// `GIT_OPTIONAL_LOCKS=0` stops read-only commands such as `git status` from
/// refreshing the index as a side effect. Besides being friendlier to other
/// Git clients, this prevents our file watcher from reacting to our own reads.
pub fn background_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    command.env("GIT_OPTIONAL_LOCKS", "0");
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    pub path: String,
    pub version: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StatusFile {
    pub st: String,
    pub path: String,
    pub orig_path: Option<String>,
    pub staged: bool,
    pub conflicted: bool,
    pub untracked: bool,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub branch: String,
    pub upstream: Option<String>,
    pub detached: bool,
    pub ahead: u32,
    pub behind: u32,
    pub dirty: u32,
    pub clean: bool,
    pub files: Vec<StatusFile>,
    /// merge / rebase / cherry-pick in progress
    pub operation: Option<String>,
}

pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Reject values that could be interpreted as git options or break argv rules.
pub fn ensure_safe_arg(value: &str) -> Result<(), AppError> {
    if value.is_empty() {
        return Err(AppError::InvalidInput("empty argument".into()));
    }
    if value.starts_with('-') {
        return Err(AppError::InvalidInput(format!(
            "argument may not start with '-': {value}"
        )));
    }
    if value.contains('\0') || value.contains('\n') {
        return Err(AppError::InvalidInput(
            "argument contains control characters".into(),
        ));
    }
    Ok(())
}

/// Locate git and read its version.
pub fn detect_git() -> Result<GitInfo, AppError> {
    let out = background_command("git")
        .arg("--version")
        .output()
        .map_err(|_| AppError::GitNotFound)?;
    if !out.status.success() {
        return Err(AppError::GitNotFound);
    }
    let version = String::from_utf8_lossy(&out.stdout)
        .trim()
        .trim_start_matches("git version ")
        .to_string();
    Ok(GitInfo {
        path: "git".into(),
        version,
    })
}

/// Run git with structured args. Never goes through a shell.
pub fn run(repo: &Path, args: &[&str], stdin: Option<&str>) -> Result<GitOutput, AppError> {
    let mut cmd = background_command("git");
    cmd.current_dir(repo)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if stdin.is_some() {
        cmd.stdin(Stdio::piped());
    } else {
        cmd.stdin(Stdio::null());
    }
    let mut child = cmd.spawn().map_err(|_| AppError::GitNotFound)?;
    if let Some(input) = stdin {
        if let Some(mut pipe) = child.stdin.take() {
            pipe.write_all(input.as_bytes())?;
        }
    }
    let out = child.wait_with_output()?;
    Ok(GitOutput {
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        exit_code: out.status.code().unwrap_or(-1),
    })
}

/// Run git and turn a non-zero exit into a typed error.
pub fn run_ok(repo: &Path, args: &[&str], stdin: Option<&str>) -> Result<GitOutput, AppError> {
    let out = run(repo, args, stdin)?;
    if out.exit_code != 0 {
        return Err(AppError::GitFailed {
            message: crate::redact::redact(&out.stderr),
            command: format!("git {}", args.join(" ")),
            exit_code: out.exit_code,
        });
    }
    Ok(out)
}

/// Current HEAD sha (short). "—" for unborn repositories.
pub fn head_sha(repo: &Path) -> String {
    match run(repo, &["rev-parse", "--short", "HEAD"], None) {
        Ok(o) if o.exit_code == 0 => o.stdout.trim().to_string(),
        _ => "—".into(),
    }
}

/// Whether the repository has a commit that can be used as an index restore source.
pub fn has_head(repo: &Path) -> Result<bool, AppError> {
    Ok(run(repo, &["rev-parse", "--verify", "HEAD"], None)?.exit_code == 0)
}

/// Detect an in-flight merge / rebase / cherry-pick by .git metadata.
pub fn active_operation(repo: &Path) -> Option<String> {
    let git_dir = match run(repo, &["rev-parse", "--git-dir"], None) {
        Ok(o) if o.exit_code == 0 => repo.join(o.stdout.trim()),
        _ => return None,
    };
    if git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists() {
        Some("rebase".into())
    } else if git_dir.join("MERGE_HEAD").exists() {
        Some("merge".into())
    } else if git_dir.join("CHERRY_PICK_HEAD").exists() {
        Some("cherry-pick".into())
    } else if git_dir.join("REVERT_HEAD").exists() {
        Some("revert".into())
    } else {
        None
    }
}

/// Parse `git status --porcelain=v2 --branch` output. Production calls use
/// NUL delimiters; newline-delimited input remains supported for fixtures.
pub fn parse_status_v2(input: &str) -> RepoStatus {
    let mut st = RepoStatus {
        branch: String::from("(unborn)"),
        ..Default::default()
    };
    let nul_delimited = input.contains('\0');
    let records: Vec<&str> = if nul_delimited {
        input.split('\0').collect()
    } else {
        input.lines().collect()
    };
    let mut record_index = 0;

    while record_index < records.len() {
        let line = records[record_index];
        record_index += 1;
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            let head = rest.trim();
            if head == "(detached)" {
                st.detached = true;
                st.branch = "(detached)".into();
            } else {
                st.branch = head.to_string();
            }
        } else if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            st.upstream = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            for part in rest.split_whitespace() {
                if let Some(a) = part.strip_prefix('+') {
                    st.ahead = a.parse().unwrap_or(0);
                } else if let Some(b) = part.strip_prefix('-') {
                    st.behind = b.parse().unwrap_or(0);
                }
            }
        } else if let Some(rest) = line.strip_prefix("1 ") {
            // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            let mut it = rest.splitn(8, ' ');
            let xy = it.next().unwrap_or("..");
            let path = it.nth(6).unwrap_or("").to_string();
            push_ordinary(&mut st, xy, path, None);
        } else if let Some(rest) = line.strip_prefix("2 ") {
            // Without -z the two paths are tab-separated. With -z, the renamed
            // path is in this record and the original path is the next record.
            let mut it = rest.splitn(9, ' ');
            let xy = it.next().unwrap_or("..");
            let paths = it.nth(7).unwrap_or("");
            let (path, orig) = if nul_delimited {
                let original = records.get(record_index).copied().unwrap_or("");
                if record_index < records.len() {
                    record_index += 1;
                }
                (paths.to_string(), Some(original.to_string()))
            } else {
                let mut pp = paths.split('\t');
                (
                    pp.next().unwrap_or("").to_string(),
                    pp.next().map(|s| s.to_string()),
                )
            };
            push_ordinary(&mut st, xy, path, orig);
        } else if let Some(rest) = line.strip_prefix("u ") {
            let mut it = rest.splitn(10, ' ');
            let path = it.nth(9).unwrap_or("").to_string();
            st.files.push(StatusFile {
                st: "U".into(),
                path,
                orig_path: None,
                staged: false,
                conflicted: true,
                untracked: false,
            });
        } else if let Some(rest) = line.strip_prefix("? ") {
            st.files.push(StatusFile {
                st: "?".into(),
                path: rest.to_string(),
                orig_path: None,
                staged: false,
                conflicted: false,
                untracked: true,
            });
        }
    }
    // A path with both index and working-tree changes intentionally produces
    // two rows, but the repository summary should still count one dirty file.
    st.dirty = st
        .files
        .iter()
        .map(|file| file.path.as_str())
        .collect::<HashSet<_>>()
        .len() as u32;
    st.clean = st.dirty == 0;
    st
}

/// XY status: X = index (staged), Y = worktree (unstaged). One porcelain
/// entry can produce both a staged and an unstaged row, like real git UIs.
fn push_ordinary(st: &mut RepoStatus, xy: &str, path: String, orig: Option<String>) {
    let mut chars = xy.chars();
    let x = chars.next().unwrap_or('.');
    let y = chars.next().unwrap_or('.');
    if x != '.' {
        st.files.push(StatusFile {
            st: x.to_string(),
            path: path.clone(),
            orig_path: orig.clone(),
            staged: true,
            conflicted: false,
            untracked: false,
        });
    }
    if y != '.' {
        st.files.push(StatusFile {
            st: y.to_string(),
            path,
            orig_path: orig,
            staged: false,
            conflicted: false,
            untracked: false,
        });
    }
}

/// Read a repository's full status. Fails with NotARepository for invalid paths.
pub fn repo_status(path: &Path) -> Result<RepoStatus, AppError> {
    let check = run(path, &["rev-parse", "--is-inside-work-tree"], None)?;
    if check.exit_code != 0 || check.stdout.trim() != "true" {
        return Err(AppError::NotARepository(path.display().to_string()));
    }
    let out = run_ok(
        path,
        &[
            "status",
            "--porcelain=v2",
            "-z",
            "--branch",
            "--untracked-files=all",
        ],
        None,
    )?;
    let mut st = parse_status_v2(&out.stdout);
    st.operation = active_operation(path);
    Ok(st)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn initialized_repo() -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        run_ok(dir.path(), &["init", "-b", "main"], None).unwrap();
        run_ok(dir.path(), &["config", "user.name", "Gitrune Tests"], None).unwrap();
        run_ok(
            dir.path(),
            &["config", "user.email", "gitrune@example.test"],
            None,
        )
        .unwrap();
        std::fs::write(dir.path().join("tracked.txt"), "line one\nline two\n").unwrap();
        run_ok(dir.path(), &["add", "--", "tracked.txt"], None).unwrap();
        run_ok(dir.path(), &["commit", "-m", "initial"], None).unwrap();
        dir
    }

    #[test]
    fn parses_branch_and_ab() {
        let s = parse_status_v2(
            "# branch.oid e7c210f\n# branch.head feature/auth-tokens\n# branch.upstream origin/feature/auth-tokens\n# branch.ab +2 -1\n",
        );
        assert_eq!(s.branch, "feature/auth-tokens");
        assert_eq!(s.upstream.as_deref(), Some("origin/feature/auth-tokens"));
        assert_eq!(s.ahead, 2);
        assert_eq!(s.behind, 1);
        assert!(s.clean);
    }

    #[test]
    fn splits_staged_and_unstaged_from_xy() {
        let s = parse_status_v2(
            "# branch.head main\n1 MM N... 100644 100644 100644 aaa bbb src/api/client.ts\n",
        );
        assert_eq!(s.files.len(), 2);
        assert!(s.files[0].staged);
        assert!(!s.files[1].staged);
        assert_eq!(s.files[0].path, "src/api/client.ts");
    }

    #[test]
    fn parses_rename_with_orig_path() {
        let s = parse_status_v2(
            "# branch.head main\n2 R. N... 100644 100644 100644 aaa bbb R100 new name.ts\told name.ts\n",
        );
        assert_eq!(s.files.len(), 1);
        assert_eq!(s.files[0].st, "R");
        assert_eq!(s.files[0].path, "new name.ts");
        assert_eq!(s.files[0].orig_path.as_deref(), Some("old name.ts"));
        assert!(s.files[0].staged);
    }

    #[test]
    fn parses_nul_delimited_paths_without_quoting() {
        let s = parse_status_v2(
            "# branch.head main\x001 .M N... 100644 100644 100644 aaa bbb src/zażółć name.ts\0? line\nbreak.txt\0",
        );
        assert_eq!(s.files.len(), 2);
        assert_eq!(s.files[0].path, "src/zażółć name.ts");
        assert_eq!(s.files[1].path, "line\nbreak.txt");
        assert_eq!(s.dirty, 2);
    }

    #[test]
    fn parses_nul_delimited_rename_paths() {
        let s = parse_status_v2(
            "# branch.head main\x002 R. N... 100644 100644 100644 aaa bbb R100 new name.ts\0old name.ts\0",
        );
        assert_eq!(s.files.len(), 1);
        assert_eq!(s.files[0].path, "new name.ts");
        assert_eq!(s.files[0].orig_path.as_deref(), Some("old name.ts"));
    }

    #[test]
    fn dirty_count_deduplicates_staged_and_unstaged_rows() {
        let s = parse_status_v2(
            "# branch.head main\x001 MM N... 100644 100644 100644 aaa bbb src/api/client.ts\0",
        );
        assert_eq!(s.files.len(), 2);
        assert_eq!(s.dirty, 1);
    }

    #[test]
    fn parses_conflicts_and_untracked() {
        let s = parse_status_v2(
            "# branch.head main\nu UU N... 100644 100644 100644 100644 aaa bbb ccc src/conflict file.ts\n? untracked.txt\n",
        );
        assert_eq!(s.files.len(), 2);
        assert!(s.files[0].conflicted);
        assert_eq!(s.files[0].path, "src/conflict file.ts");
        assert!(s.files[1].untracked);
    }

    #[test]
    fn detached_head_is_flagged() {
        let s = parse_status_v2("# branch.oid abc\n# branch.head (detached)\n");
        assert!(s.detached);
    }

    #[test]
    fn unborn_branch_is_labelled() {
        let s = parse_status_v2("# branch.oid (initial)\n");
        assert_eq!(s.branch, "(unborn)");
    }

    #[test]
    fn rejects_option_injection() {
        assert!(ensure_safe_arg("--force").is_err());
        assert!(ensure_safe_arg("-D").is_err());
        assert!(ensure_safe_arg("feature/ok").is_ok());
        assert!(ensure_safe_arg("path with spaces.ts").is_ok());
    }

    #[test]
    fn real_repository_status_handles_mixed_and_unicode_paths() {
        let dir = initialized_repo();
        std::fs::write(dir.path().join("zażółć file.txt"), "unicode\n").unwrap();
        run_ok(dir.path(), &["add", "--", "zażółć file.txt"], None).unwrap();
        run_ok(dir.path(), &["commit", "-m", "unicode fixture"], None).unwrap();
        std::fs::write(dir.path().join("tracked.txt"), "staged\n").unwrap();
        run_ok(dir.path(), &["add", "--", "tracked.txt"], None).unwrap();
        std::fs::write(dir.path().join("tracked.txt"), "staged\nunstaged\n").unwrap();
        std::fs::write(dir.path().join("binary data.bin"), [0_u8, 159, 146, 150]).unwrap();
        run_ok(dir.path(), &["add", "--", "binary data.bin"], None).unwrap();
        run_ok(
            dir.path(),
            &["mv", "zażółć file.txt", "renamed space.txt"],
            None,
        )
        .unwrap();
        let status = repo_status(dir.path()).unwrap();
        assert_eq!(
            status
                .files
                .iter()
                .filter(|file| file.path == "tracked.txt")
                .count(),
            2
        );
        assert!(status
            .files
            .iter()
            .any(|file| file.path == "renamed space.txt"));
        assert!(status
            .files
            .iter()
            .any(|file| file.path == "binary data.bin" && file.staged));
        assert_eq!(status.dirty, 3);
    }

    #[test]
    fn real_unborn_repository_and_selected_line_patch() {
        let empty = tempfile::tempdir().unwrap();
        run_ok(empty.path(), &["init", "-b", "main"], None).unwrap();
        assert_eq!(repo_status(empty.path()).unwrap().branch, "main");

        let dir = initialized_repo();
        std::fs::write(dir.path().join("tracked.txt"), "changed one\nline two\n").unwrap();
        let patch = "diff --git a/tracked.txt b/tracked.txt\n--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-line one\n+changed one\n";
        run_ok(
            dir.path(),
            &["apply", "--cached", "--unidiff-zero", "-"],
            Some(patch),
        )
        .unwrap();
        let staged = run_ok(dir.path(), &["diff", "--cached", "--", "tracked.txt"], None).unwrap();
        assert!(staged.stdout.contains("changed one"));
        run_ok(
            dir.path(),
            &["apply", "--cached", "--unidiff-zero", "--reverse", "-"],
            Some(patch),
        )
        .unwrap();
        assert!(
            run_ok(dir.path(), &["diff", "--cached", "--", "tracked.txt"], None)
                .unwrap()
                .stdout
                .is_empty()
        );
    }

    #[test]
    fn real_local_remote_reports_behind_after_fetch() {
        let root = tempfile::tempdir().unwrap();
        let bare = root.path().join("remote.git");
        run_ok(
            root.path(),
            &["init", "--bare", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        let first = initialized_repo();
        run_ok(
            first.path(),
            &["remote", "add", "origin", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        run_ok(first.path(), &["push", "-u", "origin", "main"], None).unwrap();
        run_ok(&bare, &["symbolic-ref", "HEAD", "refs/heads/main"], None).unwrap();
        let second_path = root.path().join("second");
        run_ok(
            root.path(),
            &[
                "clone",
                bare.to_str().unwrap(),
                second_path.to_str().unwrap(),
            ],
            None,
        )
        .unwrap();
        run_ok(
            &second_path,
            &["config", "user.name", "Gitrune Tests"],
            None,
        )
        .unwrap();
        run_ok(
            &second_path,
            &["config", "user.email", "gitrune@example.test"],
            None,
        )
        .unwrap();
        std::fs::write(second_path.join("remote.txt"), "remote\n").unwrap();
        run_ok(&second_path, &["add", "--", "remote.txt"], None).unwrap();
        run_ok(&second_path, &["commit", "-m", "remote change"], None).unwrap();
        run_ok(&second_path, &["push"], None).unwrap();
        run_ok(first.path(), &["fetch", "origin"], None).unwrap();
        let status = repo_status(first.path()).unwrap();
        assert_eq!(status.behind, 1);
        assert_eq!(status.ahead, 0);

        std::fs::write(first.path().join("local.txt"), "local\n").unwrap();
        run_ok(first.path(), &["add", "--", "local.txt"], None).unwrap();
        run_ok(first.path(), &["commit", "-m", "local divergence"], None).unwrap();
        std::fs::write(second_path.join("remote-2.txt"), "remote two\n").unwrap();
        run_ok(&second_path, &["add", "--", "remote-2.txt"], None).unwrap();
        run_ok(
            &second_path,
            &["commit", "-m", "second remote change"],
            None,
        )
        .unwrap();
        run_ok(&second_path, &["push"], None).unwrap();
        assert_ne!(run(first.path(), &["push"], None).unwrap().exit_code, 0);
        assert_ne!(
            run(first.path(), &["push", "--force-with-lease"], None)
                .unwrap()
                .exit_code,
            0
        );
        run_ok(first.path(), &["fetch", "origin"], None).unwrap();
        run_ok(first.path(), &["push", "--force-with-lease"], None).unwrap();
    }

    #[test]
    fn real_local_remote_supports_explicit_pull_modes() {
        let root = tempfile::tempdir().unwrap();
        let bare = root.path().join("remote.git");
        run_ok(
            root.path(),
            &["init", "--bare", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        let seed = initialized_repo();
        run_ok(
            seed.path(),
            &["remote", "add", "origin", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        run_ok(seed.path(), &["push", "-u", "origin", "main"], None).unwrap();
        run_ok(&bare, &["symbolic-ref", "HEAD", "refs/heads/main"], None).unwrap();

        let merge_path = root.path().join("merge-client");
        let rebase_path = root.path().join("rebase-client");
        for client in [&merge_path, &rebase_path] {
            run_ok(
                root.path(),
                &["clone", bare.to_str().unwrap(), client.to_str().unwrap()],
                None,
            )
            .unwrap();
            run_ok(client, &["config", "user.name", "Gitrune Tests"], None).unwrap();
            run_ok(
                client,
                &["config", "user.email", "gitrune@example.test"],
                None,
            )
            .unwrap();
            let name = client.file_name().unwrap().to_string_lossy().to_string();
            std::fs::write(client.join(format!("{name}.txt")), format!("{name}\n")).unwrap();
            run_ok(client, &["add", "."], None).unwrap();
            run_ok(client, &["commit", "-m", &format!("{name} local")], None).unwrap();
        }
        std::fs::write(seed.path().join("remote.txt"), "remote\n").unwrap();
        run_ok(seed.path(), &["add", "--", "remote.txt"], None).unwrap();
        run_ok(seed.path(), &["commit", "-m", "remote advance"], None).unwrap();
        run_ok(seed.path(), &["push"], None).unwrap();

        run_ok(&merge_path, &["pull", "--no-rebase"], None).unwrap();
        let merge_parents =
            run_ok(&merge_path, &["show", "-s", "--format=%P", "HEAD"], None).unwrap();
        assert_eq!(merge_parents.stdout.split_whitespace().count(), 2);
        run_ok(&rebase_path, &["pull", "--rebase"], None).unwrap();
        let rebase_parents =
            run_ok(&rebase_path, &["show", "-s", "--format=%P", "HEAD"], None).unwrap();
        assert_eq!(rebase_parents.stdout.split_whitespace().count(), 1);
    }

    #[test]
    fn real_stash_tag_worktree_and_conflict_workflows() {
        let dir = initialized_repo();
        std::fs::write(dir.path().join("tracked.txt"), "stash me\n").unwrap();
        run_ok(dir.path(), &["stash", "push", "-m", "fixture"], None).unwrap();
        assert!(run_ok(dir.path(), &["stash", "list"], None)
            .unwrap()
            .stdout
            .contains("fixture"));
        run_ok(dir.path(), &["tag", "v1"], None).unwrap();
        let worktree = dir
            .path()
            .parent()
            .unwrap()
            .join(format!("gitrune-wt-{}", std::process::id()));
        run_ok(
            dir.path(),
            &["worktree", "add", "-b", "side", worktree.to_str().unwrap()],
            None,
        )
        .unwrap();
        assert!(worktree.join("tracked.txt").is_file());
        run_ok(
            dir.path(),
            &["worktree", "remove", worktree.to_str().unwrap()],
            None,
        )
        .unwrap();

        run_ok(dir.path(), &["switch", "-c", "conflict"], None).unwrap();
        std::fs::write(dir.path().join("tracked.txt"), "branch\n").unwrap();
        run_ok(dir.path(), &["commit", "-am", "branch"], None).unwrap();
        let conflict_sha = run_ok(dir.path(), &["rev-parse", "HEAD"], None)
            .unwrap()
            .stdout
            .trim()
            .to_string();
        run_ok(dir.path(), &["switch", "main"], None).unwrap();
        std::fs::write(dir.path().join("tracked.txt"), "main\n").unwrap();
        run_ok(dir.path(), &["commit", "-am", "main"], None).unwrap();
        let merge = run(dir.path(), &["merge", "conflict"], None).unwrap();
        assert_ne!(merge.exit_code, 0);
        assert_eq!(active_operation(dir.path()).as_deref(), Some("merge"));
        run_ok(dir.path(), &["merge", "--abort"], None).unwrap();
        assert!(active_operation(dir.path()).is_none());

        let cherry_pick = run(dir.path(), &["cherry-pick", &conflict_sha], None).unwrap();
        assert_ne!(cherry_pick.exit_code, 0);
        assert_eq!(active_operation(dir.path()).as_deref(), Some("cherry-pick"));
        run_ok(dir.path(), &["cherry-pick", "--abort"], None).unwrap();

        run_ok(dir.path(), &["switch", "conflict"], None).unwrap();
        let rebase = run(dir.path(), &["rebase", "main"], None).unwrap();
        assert_ne!(rebase.exit_code, 0);
        assert_eq!(active_operation(dir.path()).as_deref(), Some("rebase"));
        run_ok(dir.path(), &["rebase", "--abort"], None).unwrap();
        run_ok(dir.path(), &["switch", "main"], None).unwrap();

        std::fs::write(dir.path().join("tracked.txt"), "revert target\n").unwrap();
        run_ok(dir.path(), &["commit", "-am", "revert target"], None).unwrap();
        let revert_sha = run_ok(dir.path(), &["rev-parse", "HEAD"], None)
            .unwrap()
            .stdout
            .trim()
            .to_string();
        std::fs::write(dir.path().join("tracked.txt"), "later change\n").unwrap();
        run_ok(dir.path(), &["commit", "-am", "later change"], None).unwrap();
        let revert = run(dir.path(), &["revert", "--no-edit", &revert_sha], None).unwrap();
        assert_ne!(revert.exit_code, 0);
        assert_eq!(active_operation(dir.path()).as_deref(), Some("revert"));
        run_ok(dir.path(), &["revert", "--abort"], None).unwrap();
    }
}
