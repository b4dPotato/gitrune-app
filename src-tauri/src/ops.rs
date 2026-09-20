//! Typed git operations. Every mutation:
//!   1. validates its arguments (no option injection),
//!   2. acquires the repository's operation lock,
//!   3. records prev/next HEAD and redacted output in the operation log.

use std::path::Path;

use serde::Serialize;

use crate::error::AppError;
use crate::git;
use crate::oplog::OpLog;
use crate::queue::RepoLocks;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpResult {
    pub operation_id: i64,
    pub status: String,
    pub command: String,
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub previous_head: String,
    pub resulting_head: String,
    pub duration_ms: i64,
    pub recovery_id: Option<i64>,
}

/// Run one mutating git command under the repository lock and log it.
pub fn run_mutation(
    locks: &RepoLocks,
    oplog: &OpLog,
    repo: &Path,
    op_type: &str,
    args: &[&str],
    stdin: Option<&str>,
) -> Result<OpResult, AppError> {
    let repo_str = repo.display().to_string();
    let lock = locks.lock_for(&repo_str);
    let _guard = lock.lock().expect("repo lock poisoned");

    let prev = git::head_sha(repo);
    let started = std::time::Instant::now();
    let cmd = format!("git {}", args.join(" "));
    let operation_id = oplog.start(op_type, &repo_str, &cmd, &prev)?;
    let out = match git::run(repo, args, stdin) {
        Ok(output) => output,
        Err(error) => {
            oplog.finish(operation_id, Some(-1), &error.to_string(), &prev, 0, None)?;
            return Err(error);
        }
    };
    let duration = started.elapsed().as_millis() as i64;
    let next = git::head_sha(repo);

    let combined = if out.stderr.is_empty() {
        out.stdout.clone()
    } else if out.stdout.is_empty() {
        out.stderr.clone()
    } else {
        format!("{}\n{}", out.stdout, out.stderr)
    };
    oplog.finish(
        operation_id,
        Some(out.exit_code),
        &combined,
        &next,
        duration,
        None,
    )?;

    Ok(OpResult {
        operation_id,
        status: if out.exit_code == 0 {
            "succeeded"
        } else {
            "failed"
        }
        .into(),
        command: crate::redact::redact(&cmd),
        success: out.exit_code == 0,
        exit_code: out.exit_code,
        stdout: crate::redact::redact(&out.stdout),
        stderr: crate::redact::redact(&out.stderr),
        previous_head: prev,
        resulting_head: next,
        duration_ms: duration,
        recovery_id: None,
    })
}

/// Validate a list of user-supplied paths and append them after `--`.
pub fn args_with_paths<'a>(
    base: &[&'a str],
    paths: &'a [String],
) -> Result<Vec<&'a str>, AppError> {
    for p in paths {
        git::ensure_safe_arg(p)?;
    }
    let mut v: Vec<&str> = base.to_vec();
    v.push("--");
    v.extend(paths.iter().map(|s| s.as_str()));
    Ok(v)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_with_paths_appends_after_separator() {
        let paths = vec!["src/a.ts".to_string(), "with space.md".to_string()];
        let v = args_with_paths(&["add"], &paths).unwrap();
        assert_eq!(v, vec!["add", "--", "src/a.ts", "with space.md"]);
    }

    #[test]
    fn args_with_paths_rejects_options() {
        let paths = vec!["--force".to_string()];
        assert!(args_with_paths(&["add"], &paths).is_err());
    }

    #[test]
    fn failed_git_mutations_are_returned_and_recorded() {
        let repo = tempfile::tempdir().unwrap();
        git::run_ok(repo.path(), &["init", "-b", "main"], None).unwrap();
        let log = OpLog::in_memory().unwrap();
        let locks = RepoLocks::default();
        let result = run_mutation(
            &locks,
            &log,
            repo.path(),
            "Delete missing branch",
            &["branch", "-d", "missing-branch"],
            None,
        )
        .unwrap();
        assert!(!result.success);
        assert_eq!(result.status, "failed");
        let entries = log.list(10).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, "failed");
        assert_ne!(entries[0].exit, Some(0));
    }
}
