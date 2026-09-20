//! Typed daily-use Git capabilities beyond the initial MVP commands.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::git;
use crate::ops::OpResult;
use crate::{mutate, remote_mutate, repo_path, AppState};

const US: char = '\x1f';
const RS: char = '\x1e';

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
    pub is_default: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Upstream {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitRecord {
    pub sha: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub authored_at: String,
    pub relative_time: String,
    pub subject: String,
    pub decorations: Vec<String>,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphFilters {
    pub message: Option<String>,
    pub author: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub revision: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPage {
    pub commits: Vec<CommitRecord>,
    pub next_cursor: Option<String>,
}

/// Opaque graph cursor. The ref tips are captured on the first request so a
/// fetch or commit cannot shift later pages underneath the reader.
#[derive(Deserialize, Serialize)]
struct GraphCursor {
    version: u8,
    revisions: Vec<String>,
    offset: u32,
    last_sha: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareFile {
    pub status: String,
    pub path: String,
    pub old_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitComparison {
    pub base: String,
    pub head: String,
    pub ahead: u32,
    pub behind: u32,
    pub commits: Vec<CommitRecord>,
    pub files: Vec<CompareFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StashDetail {
    pub reference: String,
    pub patch: String,
    pub files: Vec<CompareFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub name: String,
    pub target: String,
    pub kind: String,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub head: String,
    pub branch: Option<String>,
    pub detached: bool,
    pub locked: bool,
    pub prunable: bool,
    pub dirty: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub sha: String,
    pub original_line: u32,
    pub final_line: u32,
    pub author: String,
    pub authored_at: i64,
    pub summary: String,
    pub text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LineHistoryEntry {
    pub sha: String,
    pub author: String,
    pub authored_at: String,
    pub subject: String,
    pub patch: String,
}

fn refs(args: &[String]) -> Vec<&str> {
    args.iter().map(String::as_str).collect()
}

fn parse_commits(raw: &str) -> Vec<CommitRecord> {
    raw.split(RS)
        .filter_map(|record| {
            let fields: Vec<&str> = record.trim().split(US).collect();
            if fields.len() < 8 || fields[0].is_empty() {
                return None;
            }
            Some(CommitRecord {
                sha: fields[0].into(),
                parents: fields[1].split_whitespace().map(str::to_string).collect(),
                author: fields[2].into(),
                email: fields[3].into(),
                authored_at: fields[4].into(),
                relative_time: fields[5].into(),
                subject: fields[6].into(),
                decorations: fields[7]
                    .split(',')
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
                    .collect(),
            })
        })
        .collect()
}

fn log_format() -> &'static str {
    "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%ar%x1f%s%x1f%D%x1e"
}

fn parse_name_status_z(raw: &str) -> Vec<CompareFile> {
    let fields: Vec<&str> = raw.split('\0').filter(|value| !value.is_empty()).collect();
    let mut files = Vec::new();
    let mut index = 0;
    while index < fields.len() {
        let status = fields[index].to_string();
        index += 1;
        if status.starts_with('R') || status.starts_with('C') {
            if index + 1 >= fields.len() {
                break;
            }
            files.push(CompareFile {
                status,
                old_path: Some(fields[index].into()),
                path: fields[index + 1].into(),
            });
            index += 2;
        } else {
            if index >= fields.len() {
                break;
            }
            files.push(CompareFile {
                status,
                path: fields[index].into(),
                old_path: None,
            });
            index += 1;
        }
    }
    files
}

pub fn list_remotes(path: String) -> Result<Vec<Remote>, AppError> {
    let repo = repo_path(&path)?;
    let names = git::run_ok(&repo, &["remote"], None)?;
    let status = git::repo_status(&repo)?;
    let push_default = git::run(&repo, &["config", "--get", "remote.pushDefault"], None)?;
    let push_default = (push_default.exit_code == 0)
        .then(|| push_default.stdout.trim().to_string())
        .filter(|value| !value.is_empty());
    let branch_remote = if status.detached || status.branch == "(unborn)" {
        None
    } else {
        let key = format!("branch.{}.remote", status.branch);
        let out = git::run(&repo, &["config", "--get", &key], None)?;
        (out.exit_code == 0).then(|| out.stdout.trim().to_string())
    };
    let mut remotes = Vec::new();
    for name in names
        .stdout
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        git::ensure_safe_arg(name)?;
        let fetch = git::run_ok(&repo, &["remote", "get-url", name], None)?;
        let push = git::run_ok(&repo, &["remote", "get-url", "--push", name], None)?;
        remotes.push(Remote {
            name: name.into(),
            fetch_url: fetch.stdout.trim().into(),
            push_url: push.stdout.trim().into(),
            is_default: push_default.as_deref() == Some(name)
                || (push_default.is_none() && branch_remote.as_deref() == Some(name))
                || (push_default.is_none() && branch_remote.is_none() && name == "origin"),
        });
    }
    Ok(remotes)
}

pub fn current_upstream(path: String) -> Result<Upstream, AppError> {
    let repo = repo_path(&path)?;
    let status = git::repo_status(&repo)?;
    Ok(Upstream {
        branch: status.branch,
        upstream: status.upstream,
        ahead: status.ahead,
        behind: status.behind,
    })
}

pub fn commit_page(
    path: String,
    cursor: Option<String>,
    limit: u32,
    filters: GraphFilters,
) -> Result<CommitPage, AppError> {
    let repo = repo_path(&path)?;
    let graph_cursor = match cursor {
        Some(value) => {
            if value.len() > 64 * 1024 {
                return Err(AppError::InvalidInput("commit cursor is too large".into()));
            }
            let parsed: GraphCursor = serde_json::from_str(&value)
                .map_err(|_| AppError::InvalidInput("invalid commit cursor".into()))?;
            if parsed.version != 1 || parsed.revisions.is_empty() {
                return Err(AppError::InvalidInput("unsupported commit cursor".into()));
            }
            parsed
        }
        None => GraphCursor {
            version: 1,
            revisions: graph_snapshot_revisions(&repo, filters.revision.as_deref())?,
            offset: 0,
            last_sha: None,
        },
    };
    let take = limit.clamp(1, 500);
    if graph_cursor.revisions.is_empty() {
        return Ok(CommitPage {
            commits: Vec::new(),
            next_cursor: None,
        });
    }
    let mut args = vec![
        "log".into(),
        log_format().into(),
        "--date=iso-strict".into(),
        format!("--skip={}", graph_cursor.offset),
        format!("--max-count={take}"),
    ];
    args.extend(graph_cursor.revisions.iter().cloned());
    if let Some(message) = filters.message.filter(|value| !value.trim().is_empty()) {
        args.push(format!("--grep={message}"));
        args.push("--regexp-ignore-case".into());
    }
    if let Some(author) = filters.author.filter(|value| !value.trim().is_empty()) {
        args.push(format!("--author={author}"));
    }
    if let Some(since) = filters.since.filter(|value| !value.trim().is_empty()) {
        args.push(format!("--since={since}"));
    }
    if let Some(until) = filters.until.filter(|value| !value.trim().is_empty()) {
        args.push(format!("--until={until}"));
    }
    if let Some(file_path) = filters.file_path.filter(|value| !value.trim().is_empty()) {
        git::ensure_safe_arg(&file_path)?;
        args.push("--".into());
        args.push(file_path);
    }
    let out = git::run_ok(&repo, &refs(&args), None)?;
    let commits = parse_commits(&out.stdout);
    let next_cursor = if commits.len() == take as usize {
        Some(
            serde_json::to_string(&GraphCursor {
                version: 1,
                revisions: graph_cursor.revisions,
                offset: graph_cursor.offset + commits.len() as u32,
                last_sha: commits.last().map(|commit| commit.sha.clone()),
            })
            .map_err(|error| {
                AppError::InvalidInput(format!("cannot encode commit cursor: {error}"))
            })?,
        )
    } else {
        None
    };
    Ok(CommitPage {
        commits,
        next_cursor,
    })
}

fn graph_snapshot_revisions(
    repo: &std::path::Path,
    revision: Option<&str>,
) -> Result<Vec<String>, AppError> {
    if let Some(revision) = revision.filter(|value| !value.trim().is_empty()) {
        git::ensure_safe_arg(revision)?;
        let spec = format!("{revision}^{{commit}}");
        let resolved = git::run_ok(repo, &["rev-parse", "--verify", &spec], None)?;
        return Ok(vec![resolved.stdout.trim().to_string()]);
    }

    let refs = git::run_ok(
        repo,
        &[
            "for-each-ref",
            "--format=%(objectname)",
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ],
        None,
    )?;
    let mut seen = HashSet::new();
    let mut revisions = Vec::new();
    for sha in refs
        .stdout
        .lines()
        .map(str::trim)
        .filter(|sha| !sha.is_empty())
    {
        if seen.insert(sha.to_string()) {
            revisions.push(sha.to_string());
        }
    }
    let head_result = git::run(repo, &["rev-parse", "--verify", "HEAD^{commit}"], None)?;
    let head = head_result.stdout.trim();
    if head_result.exit_code == 0 && !head.is_empty() && seen.insert(head.to_string()) {
        revisions.push(head.to_string());
    }
    Ok(revisions)
}

pub fn compare_commits(
    path: String,
    base: String,
    head: String,
) -> Result<CommitComparison, AppError> {
    git::ensure_safe_arg(&base)?;
    git::ensure_safe_arg(&head)?;
    let repo = repo_path(&path)?;
    let symmetric = format!("{base}...{head}");
    let forward = format!("{base}..{head}");
    let counts = git::run_ok(
        &repo,
        &["rev-list", "--left-right", "--count", &symmetric],
        None,
    )?;
    let values: Vec<u32> = counts
        .stdout
        .split_whitespace()
        .filter_map(|value| value.parse().ok())
        .collect();
    let log = git::run_ok(
        &repo,
        &["log", "--max-count=500", log_format(), &forward],
        None,
    )?;
    let diff = git::run_ok(&repo, &["diff", "--name-status", "-z", &symmetric], None)?;
    Ok(CommitComparison {
        base,
        head,
        behind: values.first().copied().unwrap_or(0),
        ahead: values.get(1).copied().unwrap_or(0),
        commits: parse_commits(&log.stdout),
        files: parse_name_status_z(&diff.stdout),
    })
}

pub fn file_history(path: String, file: String, limit: u32) -> Result<Vec<CommitRecord>, AppError> {
    git::ensure_safe_arg(&file)?;
    let repo = repo_path(&path)?;
    let count = format!("--max-count={}", limit.clamp(1, 500));
    let out = git::run_ok(
        &repo,
        &["log", "--follow", log_format(), &count, "--", &file],
        None,
    )?;
    Ok(parse_commits(&out.stdout))
}

pub fn blame_file(path: String, file: String) -> Result<Vec<BlameLine>, AppError> {
    git::ensure_safe_arg(&file)?;
    let repo = repo_path(&path)?;
    let out = git::run_ok(
        &repo,
        &["blame", "--line-porcelain", "-L", "1,+4000", "--", &file],
        None,
    )?;
    let mut metadata: HashMap<String, (String, i64, String)> = HashMap::new();
    let mut current: Option<(String, u32, u32, String, i64, String)> = None;
    let mut result = Vec::new();
    for line in out.stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3
            && parts[0].len() >= 8
            && parts[0]
                .chars()
                .all(|ch| ch.is_ascii_hexdigit() || ch == '^')
        {
            let sha = parts[0].trim_start_matches('^').to_string();
            let original = parts[1].parse().unwrap_or(0);
            let final_line = parts[2].parse().unwrap_or(0);
            let (author, authored_at, summary) = metadata.get(&sha).cloned().unwrap_or_default();
            current = Some((sha, original, final_line, author, authored_at, summary));
        } else if let Some(item) = current.as_mut() {
            if let Some(author) = line.strip_prefix("author ") {
                item.3 = author.into();
            } else if let Some(time) = line.strip_prefix("author-time ") {
                item.4 = time.parse().unwrap_or(0);
            } else if let Some(summary) = line.strip_prefix("summary ") {
                item.5 = summary.into();
            } else if let Some(text) = line.strip_prefix('\t') {
                metadata.insert(item.0.clone(), (item.3.clone(), item.4, item.5.clone()));
                result.push(BlameLine {
                    sha: item.0.clone(),
                    original_line: item.1,
                    final_line: item.2,
                    author: item.3.clone(),
                    authored_at: item.4,
                    summary: item.5.clone(),
                    text: text.into(),
                });
                current = None;
            }
        }
    }
    Ok(result)
}

pub fn line_history(
    path: String,
    file: String,
    start: u32,
    end: u32,
) -> Result<Vec<LineHistoryEntry>, AppError> {
    git::ensure_safe_arg(&file)?;
    if start == 0 || end < start || end - start > 500 {
        return Err(AppError::InvalidInput(
            "line history requires a valid 1-based range of at most 501 lines".into(),
        ));
    }
    let repo = repo_path(&path)?;
    let range = format!("-L{start},{end}:{file}");
    let out = git::run_ok(
        &repo,
        &[
            "log",
            "--max-count=100",
            "--format=%x1e%H%x1f%an%x1f%aI%x1f%s",
            &range,
        ],
        None,
    )?;
    Ok(out
        .stdout
        .split(RS)
        .filter_map(|record| {
            let mut fields = record.trim_start().splitn(4, US);
            let sha = fields.next()?.trim();
            let author = fields.next()?.trim();
            let authored_at = fields.next()?.trim();
            let body = fields.next()?;
            if sha.is_empty() {
                return None;
            }
            let (subject, patch) = body.split_once('\n').unwrap_or((body, ""));
            Some(LineHistoryEntry {
                sha: sha.into(),
                author: author.into(),
                authored_at: authored_at.into(),
                subject: subject.trim().into(),
                patch: patch.trim().into(),
            })
        })
        .collect())
}

pub fn stash_detail(path: String, index: u32) -> Result<StashDetail, AppError> {
    let repo = repo_path(&path)?;
    let reference = format!("stash@{{{index}}}");
    let patch = git::run_ok(
        &repo,
        &["stash", "show", "--patch", "--binary", &reference],
        None,
    )?;
    let files = git::run_ok(
        &repo,
        &["stash", "show", "--name-status", "-z", &reference],
        None,
    )?;
    Ok(StashDetail {
        reference,
        patch: patch.stdout,
        files: parse_name_status_z(&files.stdout),
    })
}

pub fn list_tags(path: String) -> Result<Vec<Tag>, AppError> {
    let repo = repo_path(&path)?;
    let out = git::run_ok(
        &repo,
        &[
            "for-each-ref",
            "--format=%(refname:short)%1f%(objectname)%1f%(objecttype)%1f%(contents:subject)%1e",
            "refs/tags",
        ],
        None,
    )?;
    Ok(out
        .stdout
        .split(RS)
        .filter_map(|record| {
            let values: Vec<&str> = record.trim().split(US).collect();
            (values.len() >= 4).then(|| Tag {
                name: values[0].into(),
                target: values[1].into(),
                kind: values[2].into(),
                message: values[3].into(),
            })
        })
        .collect())
}

pub fn list_worktree_info(path: String) -> Result<Vec<WorktreeInfo>, AppError> {
    let repo = repo_path(&path)?;
    let out = git::run_ok(&repo, &["worktree", "list", "--porcelain", "-z"], None)?;
    let fields: Vec<&str> = out
        .stdout
        .split('\0')
        .filter(|value| !value.is_empty())
        .collect();
    let mut entries = Vec::new();
    let mut current: Option<WorktreeInfo> = None;
    for field in fields {
        if let Some(value) = field.strip_prefix("worktree ") {
            if let Some(entry) = current.take() {
                entries.push(entry);
            }
            current = Some(WorktreeInfo {
                path: value.into(),
                head: String::new(),
                branch: None,
                detached: false,
                locked: false,
                prunable: false,
                dirty: 0,
            });
        } else if let Some(entry) = current.as_mut() {
            if let Some(value) = field.strip_prefix("HEAD ") {
                entry.head = value.into();
            } else if let Some(value) = field.strip_prefix("branch refs/heads/") {
                entry.branch = Some(value.into());
            } else if field == "detached" {
                entry.detached = true;
            } else if field.starts_with("locked") {
                entry.locked = true;
            } else if field.starts_with("prunable") {
                entry.prunable = true;
            }
        }
    }
    if let Some(entry) = current {
        entries.push(entry);
    }
    for entry in &mut entries {
        let location = std::path::Path::new(&entry.path);
        if location.is_dir() {
            entry.dirty = git::repo_status(location)
                .map(|status| status.dirty)
                .unwrap_or(0);
        }
    }
    Ok(entries)
}

pub fn add_remote(
    path: String,
    name: String,
    url: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    git::ensure_safe_arg(&url)?;
    mutate(
        &state,
        &path,
        "Add remote",
        &["remote", "add", &name, &url],
        None,
    )
}

pub fn update_remote(
    path: String,
    name: String,
    url: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    git::ensure_safe_arg(&url)?;
    mutate(
        &state,
        &path,
        "Update remote",
        &["remote", "set-url", &name, &url],
        None,
    )
}

pub fn remove_remote(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    mutate(
        &state,
        &path,
        "Remove remote",
        &["remote", "remove", &name],
        None,
    )
}

pub fn select_default_remote(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    let repo = repo_path(&path)?;
    git::run_ok(&repo, &["remote", "get-url", &name], None)?;
    mutate(
        &state,
        &path,
        "Select default remote",
        &["config", "remote.pushDefault", &name],
        None,
    )
}

pub fn fetch_remote(
    path: String,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    if let Some(remote) = remote {
        git::ensure_safe_arg(&remote)?;
        remote_mutate(
            app,
            &state,
            &path,
            "Fetch",
            &["fetch", "--prune", "--progress", &remote],
        )
    } else {
        remote_mutate(
            app,
            &state,
            &path,
            "Fetch",
            &["fetch", "--all", "--prune", "--progress"],
        )
    }
}

pub fn set_upstream(
    path: String,
    branch: String,
    remote: String,
    remote_branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    for value in [&branch, &remote, &remote_branch] {
        git::ensure_safe_arg(value)?;
    }
    let target = format!("{remote}/{remote_branch}");
    mutate(
        &state,
        &path,
        "Set upstream",
        &["branch", "--set-upstream-to", &target, &branch],
        None,
    )
}

pub fn unset_upstream(
    path: String,
    branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&branch)?;
    mutate(
        &state,
        &path,
        "Unset upstream",
        &["branch", "--unset-upstream", &branch],
        None,
    )
}

pub fn checkout_remote_branch(
    path: String,
    remote_ref: String,
    local_name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&remote_ref)?;
    git::ensure_safe_arg(&local_name)?;
    mutate(
        &state,
        &path,
        "Track remote branch",
        &["switch", "--track", "-c", &local_name, &remote_ref],
        None,
    )
}

pub fn stash_pop(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let reference = format!("stash@{{{index}}}");
    mutate(
        &state,
        &path,
        "Stash pop",
        &["stash", "pop", &reference],
        None,
    )
}

pub fn stash_branch(
    path: String,
    index: u32,
    branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&branch)?;
    let reference = format!("stash@{{{index}}}");
    mutate(
        &state,
        &path,
        "Stash branch",
        &["stash", "branch", &branch, &reference],
        None,
    )
}

pub fn create_tag_advanced(
    path: String,
    name: String,
    sha: String,
    message: Option<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    git::ensure_safe_arg(&sha)?;
    if let Some(message) = message.filter(|value| !value.trim().is_empty()) {
        mutate(
            &state,
            &path,
            "Create annotated tag",
            &["tag", "-a", &name, &sha, "-m", &message],
            None,
        )
    } else {
        mutate(&state, &path, "Create tag", &["tag", &name, &sha], None)
    }
}

pub fn push_tag(
    path: String,
    remote: String,
    name: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&remote)?;
    git::ensure_safe_arg(&name)?;
    remote_mutate(
        app,
        &state,
        &path,
        "Push tag",
        &["push", "--progress", &remote, &name],
    )
}

pub fn delete_tag(
    path: String,
    name: String,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    if let Some(remote) = remote {
        git::ensure_safe_arg(&remote)?;
        let target = format!(":refs/tags/{name}");
        remote_mutate(
            app,
            &state,
            &path,
            "Delete remote tag",
            &["push", "--progress", &remote, &target],
        )
    } else {
        mutate(&state, &path, "Delete tag", &["tag", "-d", &name], None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_nul_name_status_with_rename() {
        let files = parse_name_status_z("M\0src/a.ts\0R100\0old name\0new name\0");
        assert_eq!(files.len(), 2);
        assert_eq!(files[1].old_path.as_deref(), Some("old name"));
        assert_eq!(files[1].path, "new name");
    }

    #[test]
    fn parses_typed_commit_records() {
        let raw = "abc\x1fdef ghi\x1fAda\x1fada@example.test\x1f2026-01-01T00:00:00Z\x1fnow\x1fSubject\x1fHEAD -> main, tag: v1\x1e";
        let commits = parse_commits(raw);
        assert_eq!(commits[0].parents, vec!["def", "ghi"]);
        assert_eq!(commits[0].decorations.len(), 2);
    }

    #[test]
    fn graph_cursor_keeps_a_stable_ref_snapshot() {
        let temp = tempfile::tempdir().unwrap();
        let repo = temp.path();
        git::run_ok(repo, &["init"], None).unwrap();
        git::run_ok(repo, &["config", "user.name", "Graph Test"], None).unwrap();
        git::run_ok(repo, &["config", "user.email", "graph@example.test"], None).unwrap();

        for index in 0..5 {
            fs::write(repo.join("history.txt"), format!("{index}\n")).unwrap();
            git::run_ok(repo, &["add", "history.txt"], None).unwrap();
            git::run_ok(repo, &["commit", "-m", &format!("commit {index}")], None).unwrap();
        }
        let before = git::run_ok(repo, &["rev-list", "--all"], None).unwrap();
        let before: Vec<&str> = before.stdout.lines().collect();

        let first =
            commit_page(repo.display().to_string(), None, 2, GraphFilters::default()).unwrap();
        let cursor = first.next_cursor.unwrap();
        assert!(cursor.starts_with('{'));

        fs::write(repo.join("history.txt"), "new head\n").unwrap();
        git::run_ok(repo, &["add", "history.txt"], None).unwrap();
        git::run_ok(repo, &["commit", "-m", "new head"], None).unwrap();

        let second = commit_page(
            repo.display().to_string(),
            Some(cursor),
            2,
            GraphFilters::default(),
        )
        .unwrap();
        let shas: Vec<&str> = second
            .commits
            .iter()
            .map(|commit| commit.sha.as_str())
            .collect();
        assert_eq!(shas, before[2..4]);
        assert!(first
            .commits
            .iter()
            .all(|commit| second.commits.iter().all(|next| next.sha != commit.sha)));
    }
}
