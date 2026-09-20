//! Local Git author profiles.
//!
//! Profiles contain author metadata only. Credentials, private keys, tokens,
//! and GitHub sessions stay in the user's existing Git/SSH configuration.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::db::IdentityProfile;
use crate::error::AppError;
use crate::git;
use crate::ops::OpResult;
use crate::{local_result, record_local_failure, repo_path, AppState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityDetails {
    effective_name: Option<String>,
    effective_email: Option<String>,
    local_name: Option<String>,
    local_email: Option<String>,
    signing_key: Option<String>,
    sign_commits: bool,
    name_source: String,
    email_source: String,
    local_configured: bool,
}

fn config_value(repo: &Path, scope: Option<&str>, key: &str) -> Result<Option<String>, AppError> {
    let mut args = vec!["config"];
    if let Some(scope) = scope {
        args.push(scope);
    }
    args.extend(["--get", key]);
    let output = git::run(repo, &args, None)?;
    if output.exit_code != 0 || output.stdout.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(output.stdout.trim().to_string()))
    }
}

fn config_source(repo: &Path, key: &str) -> Result<String, AppError> {
    for (scope, name) in [
        ("--local", "local"),
        ("--global", "global"),
        ("--system", "system"),
    ] {
        if config_value(repo, Some(scope), key)?.is_some() {
            return Ok(name.into());
        }
    }
    Ok("unset".into())
}

#[tauri::command]
pub fn identity_details(path: String) -> Result<IdentityDetails, AppError> {
    let repo = repo_path(&path)?;
    let local_name = config_value(&repo, Some("--local"), "user.name")?;
    let local_email = config_value(&repo, Some("--local"), "user.email")?;
    let effective_name = config_value(&repo, None, "user.name")?;
    let effective_email = config_value(&repo, None, "user.email")?;
    let signing_key = config_value(&repo, None, "user.signingkey")?;
    let sign_commits = config_value(&repo, None, "commit.gpgsign")?.is_some_and(|value| {
        matches!(
            value.to_ascii_lowercase().as_str(),
            "true" | "yes" | "on" | "1"
        )
    });
    Ok(IdentityDetails {
        name_source: config_source(&repo, "user.name")?,
        email_source: config_source(&repo, "user.email")?,
        local_configured: local_name.is_some() && local_email.is_some(),
        effective_name,
        effective_email,
        local_name,
        local_email,
        signing_key,
        sign_commits,
    })
}

#[tauri::command]
pub fn list_identity_profiles(
    state: tauri::State<AppState>,
) -> Result<Vec<IdentityProfile>, AppError> {
    state.db.list_identity_profiles()
}

#[tauri::command]
pub fn save_identity_profile(
    profile: IdentityProfile,
    state: tauri::State<AppState>,
) -> Result<IdentityProfile, AppError> {
    state.db.save_identity_profile(&profile)
}

#[tauri::command]
pub fn delete_identity_profile(id: i64, state: tauri::State<AppState>) -> Result<(), AppError> {
    state.db.delete_identity_profile(id)
}

#[derive(Clone)]
struct IdentitySnapshot {
    name: Option<String>,
    email: Option<String>,
    signing_key: Option<String>,
    sign_commits: Option<String>,
}

impl IdentitySnapshot {
    fn read(repo: &Path) -> Result<Self, AppError> {
        Ok(Self {
            name: config_value(repo, Some("--local"), "user.name")?,
            email: config_value(repo, Some("--local"), "user.email")?,
            signing_key: config_value(repo, Some("--local"), "user.signingkey")?,
            sign_commits: config_value(repo, Some("--local"), "commit.gpgsign")?,
        })
    }

    fn restore(&self, repo: &Path) {
        for (key, value) in [
            ("user.name", self.name.as_deref()),
            ("user.email", self.email.as_deref()),
            ("user.signingkey", self.signing_key.as_deref()),
            ("commit.gpgsign", self.sign_commits.as_deref()),
        ] {
            let _ = set_local(repo, key, value);
        }
    }
}

fn set_local(repo: &Path, key: &str, value: Option<&str>) -> Result<(), AppError> {
    let args = match value {
        Some(value) => vec!["config", "--local", key, value],
        None => vec!["config", "--local", "--unset-all", key],
    };
    let output = git::run(repo, &args, None)?;
    // `git config --unset-all` returns 5 when the key did not exist.
    if output.exit_code != 0 && !(value.is_none() && output.exit_code == 5) {
        return Err(AppError::GitFailed {
            message: output.stderr,
            command: format!("git config --local {key}"),
            exit_code: output.exit_code,
        });
    }
    Ok(())
}

fn apply_values(repo: &Path, profile: Option<&IdentityProfile>) -> Result<(), AppError> {
    let values: [(&str, Option<&str>); 4] = match profile {
        Some(profile) => [
            ("user.name", Some(profile.name.as_str())),
            ("user.email", Some(profile.email.as_str())),
            ("user.signingkey", profile.signing_key.as_deref()),
            (
                "commit.gpgsign",
                Some(if profile.sign_commits {
                    "true"
                } else {
                    "false"
                }),
            ),
        ],
        None => [
            ("user.name", None),
            ("user.email", None),
            ("user.signingkey", None),
            ("commit.gpgsign", None),
        ],
    };
    for (key, value) in values {
        set_local(repo, key, value)?;
    }
    Ok(())
}

fn change_repository_identity(
    path: &str,
    profile: Option<&IdentityProfile>,
    state: &AppState,
) -> Result<OpResult, AppError> {
    let repo = repo_path(path)?;
    let lock = state.locks.lock_for(path);
    let _guard = lock.lock().expect("repo lock poisoned");
    let before = IdentitySnapshot::read(&repo)?;
    if let Err(error) = apply_values(&repo, profile) {
        before.restore(&repo);
        let _ = record_local_failure(
            state,
            path,
            "Configure identity",
            "git config --local <identity>",
            &error.to_string(),
            None,
        );
        return Err(error);
    }
    local_result(
        state,
        path,
        "Configure identity",
        "git config --local <identity>",
        None,
    )
}

#[tauri::command]
pub fn apply_identity_profile(
    path: String,
    id: i64,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let profile = state.db.identity_profile(id)?;
    change_repository_identity(&path, Some(&profile), &state)
}

#[tauri::command]
pub fn clear_repository_identity(
    path: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    change_repository_identity(&path, None, &state)
}

fn remote_with_ssh_alias(url: &str, alias: &str) -> Result<String, AppError> {
    if let Some(rest) = url.strip_prefix("ssh://") {
        let (authority, path) = rest.split_once('/').ok_or_else(|| {
            AppError::InvalidInput("SSH remote URL does not contain a repository path".into())
        })?;
        let user = authority
            .split_once('@')
            .map(|(user, _)| user)
            .unwrap_or("git");
        return Ok(format!("ssh://{user}@{alias}/{path}"));
    }
    if !url.contains("://") {
        if let Some((authority, path)) = url.split_once(':') {
            if !path.is_empty() {
                let user = authority
                    .split_once('@')
                    .map(|(user, _)| user)
                    .unwrap_or("git");
                return Ok(format!("{user}@{alias}:{path}"));
            }
        }
    }
    Err(AppError::InvalidInput(
        "the selected remote is not an SSH URL; change it to SSH before applying an SSH Host alias"
            .into(),
    ))
}

#[tauri::command]
pub fn apply_profile_ssh_host(
    path: String,
    id: i64,
    remote: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&remote)?;
    let profile = state.db.identity_profile(id)?;
    let alias = profile
        .ssh_host
        .as_deref()
        .ok_or_else(|| AppError::InvalidInput("profile has no SSH Host alias".into()))?;
    let repo = repo_path(&path)?;
    let output = git::run_ok(&repo, &["remote", "get-url", &remote], None)?;
    let url = remote_with_ssh_alias(output.stdout.trim(), alias)?;
    crate::ops::run_mutation(
        &state.locks,
        &state.oplog,
        &repo,
        "Configure SSH remote alias",
        &["remote", "set-url", &remote, &url],
        None,
    )
}

fn ssh_config_path() -> Option<PathBuf> {
    std::env::var_os(if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    })
    .map(PathBuf::from)
    .map(|home| home.join(".ssh").join("config"))
}

#[tauri::command]
pub fn list_ssh_hosts() -> Result<Vec<String>, AppError> {
    let Some(path) = ssh_config_path() else {
        return Ok(Vec::new());
    };
    let Ok(text) = std::fs::read_to_string(path) else {
        return Ok(Vec::new());
    };
    let mut hosts = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        let Some(value) = line
            .strip_prefix("Host ")
            .or_else(|| line.strip_prefix("host "))
        else {
            continue;
        };
        for host in value.split_whitespace() {
            if !host.contains('*') && !host.contains('?') && !hosts.iter().any(|item| item == host)
            {
                hosts.push(host.to_string());
            }
        }
    }
    hosts.sort_by_key(|value| value.to_ascii_lowercase());
    Ok(hosts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_identity_details_detect_repository_scope() {
        let repo = tempfile::tempdir().unwrap();
        git::run_ok(repo.path(), &["init"], None).unwrap();
        set_local(repo.path(), "user.name", Some("Local User")).unwrap();
        set_local(repo.path(), "user.email", Some("local@example.com")).unwrap();
        assert_eq!(config_source(repo.path(), "user.name").unwrap(), "local");
        assert_eq!(
            config_value(repo.path(), Some("--local"), "user.email")
                .unwrap()
                .as_deref(),
            Some("local@example.com")
        );
    }

    #[test]
    fn applying_and_clearing_profile_only_changes_local_identity() {
        let repo = tempfile::tempdir().unwrap();
        git::run_ok(repo.path(), &["init"], None).unwrap();
        let profile = IdentityProfile {
            id: 1,
            label: "Work".into(),
            name: "Grace Hopper".into(),
            email: "grace@example.com".into(),
            signing_key: Some("KEY-123".into()),
            ssh_host: Some("github-work".into()),
            sign_commits: true,
        };
        apply_values(repo.path(), Some(&profile)).unwrap();
        assert_eq!(
            config_value(repo.path(), Some("--local"), "user.name")
                .unwrap()
                .as_deref(),
            Some("Grace Hopper")
        );
        assert_eq!(
            config_value(repo.path(), Some("--local"), "commit.gpgsign")
                .unwrap()
                .as_deref(),
            Some("true")
        );
        apply_values(repo.path(), None).unwrap();
        assert!(config_value(repo.path(), Some("--local"), "user.email")
            .unwrap()
            .is_none());
        assert!(
            config_value(repo.path(), Some("--local"), "user.signingkey")
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn ssh_alias_rewrite_supports_scp_and_ssh_urls_but_not_https() {
        assert_eq!(
            remote_with_ssh_alias("git@github.com:acme/app.git", "github-work").unwrap(),
            "git@github-work:acme/app.git"
        );
        assert_eq!(
            remote_with_ssh_alias("ssh://git@github.com/acme/app.git", "github-work").unwrap(),
            "ssh://git@github-work/acme/app.git"
        );
        assert!(remote_with_ssh_alias("https://github.com/acme/app.git", "github-work").is_err());
    }
}
