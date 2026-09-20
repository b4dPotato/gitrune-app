//! Structured, redacted errors shared with the frontend.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("git executable not found on PATH")]
    GitNotFound,
    #[error("not a git repository: {0}")]
    NotARepository(String),
    #[error("git command failed (exit {exit_code}): {message}")]
    GitFailed {
        message: String,
        command: String,
        exit_code: i32,
    },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("confirmation required: {0}")]
    ConfirmationRequired(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SuggestedAction {
    label: &'static str,
    action: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    code: String,
    category: &'static str,
    title: &'static str,
    message: String,
    technical_details: Option<String>,
    suggested_actions: Vec<SuggestedAction>,
    retryable: bool,
    command: Option<String>,
    exit_code: Option<i32>,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let (code, category, title, details, actions, retryable, command, exit_code) = match self {
            AppError::GitNotFound => (
                "git.not_found".into(),
                "git",
                "Git is not installed",
                None,
                vec![SuggestedAction {
                    label: "Install or add Git to PATH",
                    action: "install_git",
                }],
                false,
                None,
                None,
            ),
            AppError::NotARepository(path) => (
                "repository.invalid".into(),
                "validation",
                "Not a Git repository",
                Some(path.clone()),
                vec![SuggestedAction {
                    label: "Choose another folder",
                    action: "choose_folder",
                }],
                false,
                None,
                None,
            ),
            AppError::GitFailed {
                message,
                command,
                exit_code,
            } => {
                let lower = message.to_lowercase();
                let (code, category, title, actions, retryable) = if lower
                    .contains("non-fast-forward")
                {
                    (
                        "git.non_fast_forward",
                        "conflict",
                        "Push was rejected",
                        vec![SuggestedAction {
                            label: "Fetch and review incoming commits",
                            action: "fetch",
                        }],
                        true,
                    )
                } else if lower.contains("permission denied") || lower.contains("authentication") {
                    (
                        "git.authentication_failed",
                        "authentication",
                        "Authentication failed",
                        vec![SuggestedAction {
                            label: "Check your Git credential helper or SSH key",
                            action: "check_credentials",
                        }],
                        true,
                    )
                } else if lower.contains("conflict") {
                    (
                        "git.conflict",
                        "conflict",
                        "Git operation has conflicts",
                        vec![SuggestedAction {
                            label: "Open conflict resolution",
                            action: "open_conflicts",
                        }],
                        true,
                    )
                } else {
                    (
                        "git.command_failed",
                        "git",
                        "Git command failed",
                        vec![SuggestedAction {
                            label: "Open the operation log",
                            action: "open_operation_log",
                        }],
                        true,
                    )
                };
                (
                    code.into(),
                    category,
                    title,
                    Some(crate::redact::redact(message)),
                    actions,
                    retryable,
                    Some(crate::redact::redact(command)),
                    Some(*exit_code),
                )
            }
            AppError::Io(err) => (
                "filesystem.io".into(),
                "filesystem",
                "Filesystem operation failed",
                Some(err.to_string()),
                vec![],
                true,
                None,
                None,
            ),
            AppError::Db(err) => (
                "storage.database".into(),
                "internal",
                "Local storage failed",
                Some(err.to_string()),
                vec![],
                true,
                None,
                None,
            ),
            AppError::InvalidInput(message) => (
                "validation.invalid_input".into(),
                "validation",
                "Invalid input",
                Some(message.clone()),
                vec![],
                false,
                None,
                None,
            ),
            AppError::ConfirmationRequired(message) => (
                "safety.confirmation_required".into(),
                "validation",
                "Confirmation required",
                Some(message.clone()),
                vec![SuggestedAction {
                    label: "Review the command and confirm explicitly",
                    action: "confirm_operation",
                }],
                false,
                None,
                None,
            ),
        };
        ErrorPayload {
            code,
            category,
            title,
            message: crate::redact::redact(&self.to_string()),
            technical_details: details.map(|v| crate::redact::redact(&v)),
            suggested_actions: actions,
            retryable,
            command,
            exit_code,
        }
        .serialize(serializer)
    }
}
