//! Gitrune backend. All UI-facing capabilities are typed Tauri commands —
//! the webview has no shell, fs, or network permissions of its own.
//! Mutations run under a per-repository lock and land in the operation log.

mod commands;
mod db;
mod error;
mod features;
mod git;
mod identity;
mod oplog;
mod ops;
mod progress;
mod queue;
mod redact;
mod watcher;

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Manager;

use db::{AppSettings, Db, NewRecovery, RecoveryEntry, RepoRecord};
use error::AppError;
use git::{GitInfo, RepoStatus};
use oplog::{OpEntry, OpLog};
use ops::OpResult;
use progress::OperationManager;
use queue::RepoLocks;
use watcher::RepoWatchers;

pub(crate) struct AppState {
    db: Db,
    oplog: OpLog,
    locks: RepoLocks,
    watchers: RepoWatchers,
    data_dir: PathBuf,
    operations: OperationManager,
}

pub(crate) fn repo_path(path: &str) -> Result<PathBuf, AppError> {
    let p = PathBuf::from(path);
    if !p.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "path does not exist or is not a directory: {path}"
        )));
    }
    Ok(p)
}

fn safe_repo_file(repo: &Path, relative: &str) -> Result<PathBuf, AppError> {
    git::ensure_safe_arg(relative)?;
    let rel = Path::new(relative);
    if rel.is_absolute()
        || rel.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(AppError::InvalidInput(format!(
            "path must stay inside the repository: {relative}"
        )));
    }
    Ok(repo.join(rel))
}

// ---------- environment ----------

#[tauri::command]
fn detect_git() -> Result<GitInfo, AppError> {
    git::detect_git()
}

/// Open a path in the OS file manager, editor, or terminal.
/// Fixed program whitelist — never a shell string.
#[tauri::command]
fn open_path(path: String, target: String, state: tauri::State<AppState>) -> Result<(), AppError> {
    let p = repo_path(&path)?;
    let dir = p.as_os_str().to_os_string();
    let settings = state.db.load_settings()?;
    let candidates: Vec<(&str, Vec<OsString>, bool)> = match target.as_str() {
        "files" => {
            if cfg!(target_os = "windows") {
                vec![("explorer", vec![dir.clone()], false)]
            } else if cfg!(target_os = "macos") {
                vec![("open", vec![dir.clone()], false)]
            } else {
                vec![("xdg-open", vec![dir.clone()], false)]
            }
        }
        "editor" => match settings.editor.as_str() {
            "code" => vec![("code", vec![dir.clone()], false)],
            "codium" => vec![("codium", vec![dir.clone()], false)],
            "notepad" => vec![("notepad", vec![dir.clone()], false)],
            _ => vec![
                ("code", vec![dir.clone()], false),
                ("codium", vec![dir.clone()], false),
                ("notepad", vec![dir.clone()], false),
            ],
        },
        "terminal" => {
            if cfg!(target_os = "windows") {
                match settings.terminal.as_str() {
                    "wt" => vec![("wt", vec!["-d".into(), dir.clone()], false)],
                    "cmd" => vec![("cmd", vec!["/D".into(), "/K".into()], true)],
                    "powershell" => vec![("powershell", vec!["-NoExit".into()], true)],
                    _ => vec![
                        ("wt", vec!["-d".into(), dir.clone()], false),
                        ("powershell", vec!["-NoExit".into()], true),
                        ("cmd", vec!["/D".into(), "/K".into()], true),
                    ],
                }
            } else if cfg!(target_os = "macos") {
                vec![(
                    "open",
                    vec!["-a".into(), "Terminal".into(), dir.clone()],
                    false,
                )]
            } else {
                vec![("x-terminal-emulator", vec![], true)]
            }
        }
        _ => return Err(AppError::InvalidInput(format!("unknown target: {target}"))),
    };
    for (prog, args, use_repo_cwd) in candidates {
        let mut cmd = std::process::Command::new(prog);
        cmd.args(&args);
        if use_repo_cwd {
            cmd.current_dir(&p);
        }
        if cmd.spawn().is_ok() {
            return Ok(());
        }
    }
    Err(AppError::InvalidInput(format!(
        "no available program to open {target}"
    )))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorOption {
    id: String,
    label: String,
    recommended: bool,
    icon: String,
    detail: Option<String>,
}

fn editor_candidates() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        ("code", "Visual Studio Code", "code"),
        ("codium", "VSCodium", "codium"),
        ("notepad", "Notepad", "notepad"),
    ]
}

#[cfg(target_os = "windows")]
fn registry_value(key: &str, value_name: Option<&str>) -> Option<String> {
    let mut command = git::background_command("reg.exe");
    command.arg("query").arg(key);
    match value_name {
        Some(name) => {
            command.arg("/v").arg(name);
        }
        None => {
            command.arg("/ve");
        }
    }
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| {
            ["REG_EXPAND_SZ", "REG_SZ"].into_iter().find_map(|kind| {
                line.find(kind)
                    .map(|index| line[index + kind.len()..].trim().to_string())
                    .filter(|value| !value.is_empty())
            })
        })
}

fn known_application_name(value: &str) -> Option<&'static str> {
    let value = value.to_ascii_lowercase();
    if value.contains("codium") {
        Some("VSCodium")
    } else if value.contains("notepad++") {
        Some("Notepad++")
    } else if value.contains("visual studio code")
        || value.contains("vscode")
        || value.contains("code.exe")
    {
        Some("Visual Studio Code")
    } else if value.contains("sublime") {
        Some("Sublime Text")
    } else if value.contains("webstorm") {
        Some("WebStorm")
    } else if value.contains("pycharm") {
        Some("PyCharm")
    } else if value.contains("idea64") || value.contains("intellij") {
        Some("IntelliJ IDEA")
    } else if value.contains("notepad") {
        Some("Notepad")
    } else {
        None
    }
}

fn editor_icon_hint(application: Option<&str>) -> &'static str {
    let application = application.unwrap_or_default().to_ascii_lowercase();
    if application.contains("codium") {
        "codium"
    } else if application.contains("visual studio code") || application.contains("vscode") {
        "code"
    } else if application.contains("notepad") {
        "notepad"
    } else if application.contains("file explorer") {
        "folder"
    } else {
        "system"
    }
}

#[cfg(test)]
mod editor_tests {
    use super::{editor_icon_hint, known_application_name};

    #[test]
    fn recognizes_common_windows_editor_associations() {
        assert_eq!(
            known_application_name(r#""C:\Program Files\Microsoft VS Code\Code.exe" "%1""#),
            Some("Visual Studio Code")
        );
        assert_eq!(
            known_application_name("Applications\\VSCodium.exe"),
            Some("VSCodium")
        );
        assert_eq!(known_application_name("Notepad++_file"), Some("Notepad++"));
    }

    #[test]
    fn selects_a_matching_system_default_icon() {
        assert_eq!(editor_icon_hint(Some("Visual Studio Code")), "code");
        assert_eq!(editor_icon_hint(Some("File Explorer")), "folder");
        assert_eq!(editor_icon_hint(Some("Unknown editor")), "system");
    }
}

#[cfg(target_os = "windows")]
fn windows_default_application(extension: &str) -> Option<String> {
    if extension.is_empty()
        || extension.len() > 20
        || !extension
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return None;
    }
    let dotted = format!(".{extension}");
    let user_choice = format!(
        r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\{dotted}\UserChoice"
    );
    let class_key = format!(r"HKEY_CLASSES_ROOT\{dotted}");
    let prog_id = registry_value(&user_choice, Some("ProgId"))
        .or_else(|| registry_value(&class_key, None))?;
    if let Some(name) = known_application_name(&prog_id) {
        return Some(name.into());
    }
    let application_key = format!(r"HKEY_CLASSES_ROOT\{prog_id}\Application");
    if let Some(name) = registry_value(&application_key, Some("ApplicationName")) {
        if let Some(known) = known_application_name(&name) {
            return Some(known.into());
        }
        if name.len() <= 80 {
            return Some(name);
        }
    }
    let command_key = format!(r"HKEY_CLASSES_ROOT\{prog_id}\shell\open\command");
    registry_value(&command_key, None)
        .as_deref()
        .and_then(known_application_name)
        .map(str::to_string)
}

#[cfg(not(target_os = "windows"))]
fn windows_default_application(_extension: &str) -> Option<String> {
    None
}

fn executable_on_path(program: &str) -> Option<PathBuf> {
    let locator = if cfg!(target_os = "windows") {
        "where.exe"
    } else {
        "which"
    };
    let output = git::background_command(locator)
        .arg(program)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .find(|path| {
            path.is_file()
                && (!cfg!(target_os = "windows")
                    || matches!(
                        path.extension()
                            .and_then(|extension| extension.to_str())
                            .map(str::to_ascii_lowercase)
                            .as_deref(),
                        Some("exe" | "com")
                    ))
        })
}

fn editor_executable(id: &str, program: &str) -> Option<PathBuf> {
    if let Some(path) = executable_on_path(program) {
        return Some(path);
    }
    if !cfg!(target_os = "windows") {
        return None;
    }
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let programs = std::env::var_os("ProgramFiles").map(PathBuf::from);
    let windows = std::env::var_os("WINDIR").map(PathBuf::from);
    let candidates = match id {
        "code" => vec![
            local.map(|root| root.join("Programs/Microsoft VS Code/Code.exe")),
            programs.map(|root| root.join("Microsoft VS Code/Code.exe")),
        ],
        "codium" => vec![
            local.map(|root| root.join("Programs/VSCodium/VSCodium.exe")),
            programs.map(|root| root.join("VSCodium/VSCodium.exe")),
        ],
        "notepad" => vec![windows.map(|root| root.join("System32/notepad.exe"))],
        _ => Vec::new(),
    };
    candidates.into_iter().flatten().find(|path| path.is_file())
}

#[tauri::command]
fn list_editors(file: Option<String>) -> Vec<EditorOption> {
    let extension = file
        .as_deref()
        .and_then(|value| Path::new(value).extension())
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let code_file = matches!(
        extension.as_str(),
        "c" | "cpp"
            | "cs"
            | "css"
            | "go"
            | "html"
            | "java"
            | "js"
            | "json"
            | "jsx"
            | "md"
            | "py"
            | "rb"
            | "rs"
            | "scss"
            | "sql"
            | "toml"
            | "ts"
            | "tsx"
            | "vue"
            | "xml"
            | "yaml"
            | "yml"
    );
    let mut options: Vec<EditorOption> = editor_candidates()
        .into_iter()
        .filter(|(id, _, program)| editor_executable(id, program).is_some())
        .map(|(id, label, _)| EditorOption {
            id: id.into(),
            label: label.into(),
            recommended: code_file && id == "code",
            icon: id.into(),
            detail: None,
        })
        .collect();
    let default_application = if extension.is_empty() && cfg!(target_os = "windows") {
        Some("File Explorer".to_string())
    } else {
        windows_default_application(&extension)
    };
    options.push(EditorOption {
        id: "system".into(),
        label: "System default".into(),
        recommended: !code_file,
        icon: editor_icon_hint(default_application.as_deref()).into(),
        detail: Some(match default_application {
            Some(application) => format!("Opens with {application}"),
            None if cfg!(target_os = "windows") => {
                "Uses the application configured in Windows".into()
            }
            None => "Uses your operating system file association".into(),
        }),
    });
    options.sort_by_key(|option| !option.recommended);
    options
}

#[tauri::command]
fn open_in_editor(path: String, file: Option<String>, editor: String) -> Result<(), AppError> {
    let repo = repo_path(&path)?;
    let target = match file.as_deref() {
        Some(relative) => safe_repo_file(&repo, relative)?,
        None => repo.clone(),
    };
    let program = editor_candidates()
        .into_iter()
        .find(|(id, _, _)| *id == editor)
        .and_then(|(id, _, program)| editor_executable(id, program));
    let mut command = if editor == "system" {
        if cfg!(target_os = "windows") {
            let mut command = git::background_command("explorer");
            command.arg(&target);
            command
        } else if cfg!(target_os = "macos") {
            let mut command = git::background_command("open");
            command.arg(&target);
            command
        } else {
            let mut command = git::background_command("xdg-open");
            command.arg(&target);
            command
        }
    } else if let Some(program) = program {
        let mut command = git::background_command(&program);
        command.arg(&target);
        command
    } else {
        return Err(AppError::InvalidInput("unsupported editor".into()));
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| AppError::InvalidInput(format!("could not open editor: {error}")))
}

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Result<AppSettings, AppError> {
    state.db.load_settings()
}

#[tauri::command]
fn save_settings(settings: AppSettings, state: tauri::State<AppState>) -> Result<(), AppError> {
    state.db.save_settings(&settings)
}

#[tauri::command]
fn list_recoveries(
    path: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Vec<RecoveryEntry>, AppError> {
    state.db.list_recoveries(path.as_deref())
}

// ---------- repositories ----------

fn list_repos(state: tauri::State<AppState>) -> Result<Vec<RepoRecord>, AppError> {
    state.db.list_repos()
}

fn add_repo(
    path: String,
    color: Option<String>,
    state: tauri::State<AppState>,
) -> Result<RepoRecord, AppError> {
    let p = repo_path(&path)?;
    // validate it is a repository before registering
    git::repo_status(&p)?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let rec = state
        .db
        .add_repo(&name, &path, color.as_deref().unwrap_or("#5f9df6"))?;
    Ok(rec)
}

fn remove_repo(id: i64, path: String, state: tauri::State<AppState>) -> Result<(), AppError> {
    state.watchers.unwatch(&path);
    state.db.remove_repo(id)
}

fn update_repo_color(
    id: i64,
    color: String,
    state: tauri::State<AppState>,
) -> Result<(), AppError> {
    state.db.update_repo_color(id, &color)
}

fn touch_repo(id: i64, state: tauri::State<AppState>) -> Result<(), AppError> {
    state.db.touch_repo(id)
}

fn watch_repo(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), AppError> {
    state
        .watchers
        .watch(app, path)
        .map_err(|e| AppError::InvalidInput(format!("watcher failed: {e}")))
}

/// Clone a repository into a parent directory. Uses the system git and its
/// existing credential helpers / SSH configuration.
fn clone_repo(
    url: String,
    parent_dir: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&url)?;
    let parent = repo_path(&parent_dir)?;
    progress::run_remote_mutation(
        app,
        &state.operations,
        &state.locks,
        &state.oplog,
        &parent,
        "Clone",
        &["clone", "--progress", &url],
    )
}

/// Initialize a new repository in an existing folder.
fn init_repo(dir: String, state: tauri::State<AppState>) -> Result<OpResult, AppError> {
    let p = repo_path(&dir)?;
    ops::run_mutation(&state.locks, &state.oplog, &p, "Init", &["init"], None)
}

// ---------- read operations (concurrent) ----------

fn repo_status(path: String) -> Result<RepoStatus, AppError> {
    git::repo_status(&repo_path(&path)?)
}

fn get_identity(path: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    let name = git::run(&p, &["config", "user.name"], None)?;
    let email = git::run(&p, &["config", "user.email"], None)?;
    Ok(format!("{} <{}>", name.stdout.trim(), email.stdout.trim()))
}

fn get_commit_template(path: String) -> Result<Option<String>, AppError> {
    let p = repo_path(&path)?;
    let configured = git::run(&p, &["config", "--get", "--path", "commit.template"], None)?;
    if configured.exit_code != 0 || configured.stdout.trim().is_empty() {
        return Ok(None);
    }
    let template_path = PathBuf::from(configured.stdout.trim());
    let template_path = if template_path.is_absolute() {
        template_path
    } else {
        p.join(template_path)
    };
    let metadata = std::fs::metadata(&template_path)?;
    if metadata.len() > 64 * 1024 {
        return Err(AppError::InvalidInput(
            "commit template is larger than 64 KiB".into(),
        ));
    }
    Ok(Some(std::fs::read_to_string(template_path)?))
}

/// Raw `git for-each-ref` output; parsed by the tested TS parser.
fn list_refs(path: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    let out = git::run_ok(
        &p,
        &[
            "for-each-ref",
            "--format=%(refname:short)%1F%(objectname:short)%1F%(HEAD)%1F%(upstream:short)%1F%(upstream:track)%1F%(committerdate:relative)%1F%(committerdate:unix)%1F%(refname)",
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ],
        None,
    )?;
    Ok(out.stdout)
}

/// Raw `git log` output with unit separators; parsed by the tested TS parser.
fn commit_log(path: String, skip: u32, limit: u32) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    let skip_s = format!("--skip={skip}");
    let limit_s = format!("--max-count={}", limit.min(1000));
    let out = git::run_ok(
        &p,
        &[
            "log",
            "--all",
            "--date=relative",
            "--format=%h%x1f%p%x1f%an%x1f%ad%x1f%s%x1f%D%x1e",
            &skip_s,
            &limit_s,
        ],
        None,
    )?;
    Ok(out.stdout)
}

fn commit_info(path: String, sha: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&sha)?;
    let out = git::run_ok(
        &p,
        &[
            "show",
            "--no-patch",
            "--date=relative",
            "--format=%h%x1f%p%x1f%an%x1f%ad%x1f%s%x1f%D%x1e",
            &sha,
        ],
        None,
    )?;
    Ok(out.stdout)
}

/// Raw unified diff for one file; parsed by the tested TS parser.
fn diff_file(path: String, file: String, staged: bool) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&file)?;
    let mut args = vec!["diff", "--no-ext-diff", "--no-color"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(&file);
    let out = git::run_ok(&p, &args, None)?;
    if out.stdout.is_empty() && !staged {
        // untracked file: show as an add against /dev/null
        let alt = git::run(
            &p,
            &[
                "diff",
                "--no-ext-diff",
                "--no-color",
                "--no-index",
                "--",
                "/dev/null",
                &file,
            ],
            None,
        )?;
        return Ok(alt.stdout);
    }
    Ok(out.stdout)
}

/// Raw `git diff-tree` name-status output for one commit ("M\tpath" lines).
fn commit_files(path: String, sha: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&sha)?;
    let out = git::run_ok(
        &p,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-status",
            "-r",
            "--root",
            &sha,
        ],
        None,
    )?;
    Ok(out.stdout)
}

fn commit_file_diff(path: String, sha: String, file: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&sha)?;
    git::ensure_safe_arg(&file)?;
    let out = git::run_ok(
        &p,
        &[
            "show",
            "--format=",
            "--no-ext-diff",
            "--no-color",
            &sha,
            "--",
            &file,
        ],
        None,
    )?;
    Ok(out.stdout)
}

fn compare_file_diff(
    path: String,
    base: String,
    head: String,
    file: String,
) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&base)?;
    git::ensure_safe_arg(&head)?;
    git::ensure_safe_arg(&file)?;
    let out = git::run_ok(
        &p,
        &[
            "diff",
            "--no-ext-diff",
            "--no-color",
            &base,
            &head,
            "--",
            &file,
        ],
        None,
    )?;
    Ok(out.stdout)
}

fn stash_list(path: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    let out = git::run_ok(&p, &["stash", "list", "--format=%gd%x1f%s%x1f%cr"], None)?;
    Ok(out.stdout)
}

/// Raw `git worktree list --porcelain`; parsed by the tested TS parser.
fn worktree_list(path: String) -> Result<String, AppError> {
    let p = repo_path(&path)?;
    let out = git::run_ok(&p, &["worktree", "list", "--porcelain"], None)?;
    Ok(out.stdout)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictVersions {
    base: String,
    ours: String,
    theirs: String,
    result: String,
}

/// The four versions of a conflicted file: base (:1), ours (:2), theirs (:3),
/// and the working-tree result with conflict markers.
fn conflict_versions(path: String, file: String) -> Result<ConflictVersions, AppError> {
    let p = repo_path(&path)?;
    git::ensure_safe_arg(&file)?;
    let stage = |n: u8| -> String {
        let spec = format!(":{n}:{file}");
        match git::run(&p, &["show", &spec], None) {
            Ok(o) if o.exit_code == 0 => o.stdout,
            _ => String::new(), // stage may not exist (add/add, delete conflicts)
        }
    };
    let result = std::fs::read_to_string(p.join(&file)).unwrap_or_default();
    Ok(ConflictVersions {
        base: stage(1),
        ours: stage(2),
        theirs: stage(3),
        result,
    })
}

#[tauri::command]
fn operation_log(state: tauri::State<AppState>) -> Result<Vec<OpEntry>, AppError> {
    state.oplog.list(200)
}

// ---------- mutations (serialized per repository, always logged) ----------

fn mutate(
    state: &AppState,
    path: &str,
    op_type: &str,
    args: &[&str],
    stdin: Option<&str>,
) -> Result<OpResult, AppError> {
    let p = repo_path(path)?;
    ops::run_mutation(&state.locks, &state.oplog, &p, op_type, args, stdin)
}

pub(crate) fn remote_mutate(
    app: tauri::AppHandle,
    state: &tauri::State<AppState>,
    path: &str,
    op_type: &str,
    args: &[&str],
) -> Result<OpResult, AppError> {
    let repo = repo_path(path)?;
    progress::run_remote_mutation(
        app,
        &state.operations,
        &state.locks,
        &state.oplog,
        &repo,
        op_type,
        args,
    )
}

pub(crate) fn local_result(
    state: &AppState,
    path: &str,
    op_type: &str,
    command: &str,
    recovery_id: Option<i64>,
) -> Result<OpResult, AppError> {
    let head = git::head_sha(&repo_path(path)?);
    let operation_id = state.oplog.record(oplog::OpRecord {
        op_type,
        repo: path,
        cmd: command,
        exit: Some(0),
        out: "completed",
        prev_head: &head,
        next_head: &head,
        duration_ms: 0,
    })?;
    Ok(OpResult {
        operation_id,
        status: "succeeded".into(),
        command: command.into(),
        success: true,
        exit_code: 0,
        stdout: String::new(),
        stderr: String::new(),
        previous_head: head.clone(),
        resulting_head: head,
        duration_ms: 0,
        recovery_id,
    })
}

pub(crate) fn record_local_failure(
    state: &AppState,
    path: &str,
    op_type: &str,
    command: &str,
    message: &str,
    recovery_id: Option<i64>,
) -> Result<(), AppError> {
    let head = git::head_sha(&repo_path(path)?);
    let operation_id = state.oplog.record(oplog::OpRecord {
        op_type,
        repo: path,
        cmd: command,
        exit: Some(-1),
        out: message,
        prev_head: &head,
        next_head: &head,
        duration_ms: 0,
    })?;
    if let Some(id) = recovery_id {
        state.oplog.attach_recovery(operation_id, id)?;
    }
    Ok(())
}

fn stage_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let args = ops::args_with_paths(&["add"], &files)?;
    mutate(&state, &path, "Stage", &args, None)
}

fn unstage_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    unstage_files_impl(path, files, &state)
}

fn unstage_files_impl(
    path: String,
    files: Vec<String>,
    state: &AppState,
) -> Result<OpResult, AppError> {
    let repo = repo_path(&path)?;
    // `git restore --staged` implicitly restores from HEAD and therefore
    // fails before the first commit. In an unborn repository every indexed
    // path is new, so removing it only from the index is the equivalent safe
    // operation. `--force` also handles a file edited again after staging;
    // `--cached` guarantees the working-tree copy is preserved.
    let base = if git::has_head(&repo)? {
        ["restore", "--staged"].as_slice()
    } else {
        ["rm", "--cached", "--force"].as_slice()
    };
    let args = ops::args_with_paths(base, &files)?;
    mutate(state, &path, "Unstage", &args, None)
}

fn delete_recovery_ref(repo: &Path, checkpoint: &str) {
    if checkpoint.starts_with("refs/gitrune/recovery/") {
        let _ = git::run(repo, &["update-ref", "-d", checkpoint], None);
    }
}

/// Discard working-tree changes. Tracked content is rooted under a private Git
/// ref so normal Git garbage collection cannot remove it before restoration.
/// Untracked files are copied to the application recovery directory before any
/// source file is removed.
fn discard_files_impl(
    path: String,
    files: Vec<String>,
    state: &AppState,
) -> Result<OpResult, AppError> {
    let p = repo_path(&path)?;
    if files.is_empty() {
        return Err(AppError::InvalidInput("no files selected".into()));
    }

    let mut tracked = Vec::new();
    let mut untracked = Vec::new();
    for file in &files {
        safe_repo_file(&p, file)?;
        let known = git::run(&p, &["ls-files", "--error-unmatch", "--", file], None)?;
        if known.exit_code == 0 {
            tracked.push(file.clone());
        } else {
            untracked.push(file.clone());
        }
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let checkpoint = if tracked.is_empty() {
        None
    } else {
        let out = git::run_ok(&p, &["stash", "create", "Gitrune discard checkpoint"], None)?;
        let sha = out.stdout.trim();
        if sha.is_empty() {
            return Err(AppError::InvalidInput(
                "Git could not create a recovery checkpoint".into(),
            ));
        }
        let recovery_ref = format!("refs/gitrune/recovery/{stamp}");
        git::run_ok(&p, &["update-ref", &recovery_ref, sha], None)?;
        Some(recovery_ref)
    };

    let backup_root = if untracked.is_empty() {
        None
    } else {
        let root = state.data_dir.join("recovery").join(stamp.to_string());
        for file in &untracked {
            let source = safe_repo_file(&p, file)?;
            if source.is_symlink() || !source.is_file() {
                return Err(AppError::InvalidInput(format!(
                    "only regular untracked files can be recovered safely: {file}"
                )));
            }
            let destination = root.join(file);
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&source, &destination)?;
        }
        Some(root)
    };

    let recovery_id = match state.db.create_recovery(NewRecovery {
        repo: &path,
        kind: "discard",
        paths: &files,
        checkpoint: checkpoint.as_deref(),
        backup_path: backup_root
            .as_ref()
            .map(|value| value.to_string_lossy())
            .as_deref(),
    }) {
        Ok(id) => id,
        Err(error) => {
            if let Some(value) = &checkpoint {
                delete_recovery_ref(&p, value);
            }
            if let Some(root) = &backup_root {
                let _ = std::fs::remove_dir_all(root);
            }
            return Err(error);
        }
    };

    let mut result = if tracked.is_empty() {
        local_result(
            state,
            &path,
            "Discard untracked",
            "backup and remove untracked files",
            Some(recovery_id),
        )?
    } else {
        let args = ops::args_with_paths(&["restore"], &tracked)?;
        mutate(state, &path, "Discard", &args, None)?
    };
    state
        .oplog
        .attach_recovery(result.operation_id, recovery_id)?;
    result.recovery_id = Some(recovery_id);

    // Do not remove untracked sources if the tracked discard failed. The
    // recovery remains available for the tracked content, and no additional
    // user data is destroyed after a failed Git operation.
    if result.success {
        for file in &untracked {
            if let Err(error) = std::fs::remove_file(safe_repo_file(&p, file)?) {
                state.oplog.finish(
                    result.operation_id,
                    Some(-1),
                    &error.to_string(),
                    &git::head_sha(&p),
                    result.duration_ms,
                    Some(recovery_id),
                )?;
                return Err(AppError::Io(error));
            }
        }
    }
    Ok(result)
}

fn discard_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    discard_files_impl(path, files, &state)
}

fn restore_recovery_impl(id: i64, state: &AppState) -> Result<OpResult, AppError> {
    let recovery = state.db.recovery(id)?;
    if recovery.restored_at.is_some() {
        return Err(AppError::InvalidInput(
            "recovery was already restored".into(),
        ));
    }
    let repo = repo_path(&recovery.repo)?;

    // Resolve and validate every destination before changing any file. A
    // collision must not leave a half-restored recovery.
    let mut backup_files = Vec::new();
    if let Some(backup_path) = &recovery.backup_path {
        let backup = PathBuf::from(backup_path);
        for file in &recovery.paths {
            let source = backup.join(file);
            if !source.exists() {
                continue;
            }
            if !source.is_file() {
                let message = format!("recovery source is not a regular file: {file}");
                record_local_failure(
                    state,
                    &recovery.repo,
                    "Restore recovery",
                    "restore recovery backup",
                    &message,
                    Some(id),
                )?;
                return Err(AppError::InvalidInput(message));
            }
            let destination = safe_repo_file(&repo, file)?;
            if destination.exists() {
                let message = format!("cannot restore because the destination exists: {file}");
                record_local_failure(
                    state,
                    &recovery.repo,
                    "Restore recovery",
                    "restore recovery backup",
                    &message,
                    Some(id),
                )?;
                return Err(AppError::InvalidInput(message));
            }
            backup_files.push((source, destination));
        }
    }

    let mut tracked = Vec::new();
    if let Some(checkpoint) = recovery.checkpoint.as_deref() {
        git::ensure_safe_arg(checkpoint)?;
        for file in &recovery.paths {
            let spec = format!("{checkpoint}:{file}");
            if git::run(&repo, &["cat-file", "-e", &spec], None).is_ok_and(|out| out.exit_code == 0)
            {
                let dirty = git::run(&repo, &["diff", "--quiet", "--", file], None)?;
                if dirty.exit_code != 0 {
                    let message = format!("cannot restore over newer working-tree changes: {file}");
                    record_local_failure(
                        state,
                        &recovery.repo,
                        "Restore recovery",
                        "restore recovery backup",
                        &message,
                        Some(id),
                    )?;
                    return Err(AppError::InvalidInput(message));
                }
                tracked.push(file.clone());
            }
        }
    }

    let mut result = if tracked.is_empty() {
        local_result(
            state,
            &recovery.repo,
            "Restore recovery",
            "restore recovery backup",
            Some(id),
        )?
    } else {
        let checkpoint = recovery.checkpoint.as_deref().expect("checked above");
        let mut args = vec!["restore", "--source", checkpoint, "--worktree", "--"];
        args.extend(tracked.iter().map(String::as_str));
        mutate(state, &recovery.repo, "Restore recovery", &args, None)?
    };
    state.oplog.attach_recovery(result.operation_id, id)?;
    result.recovery_id = Some(id);
    if !result.success {
        return Ok(result);
    }

    let mut copied = Vec::new();
    for (source, destination) in &backup_files {
        let copy_result = (|| -> Result<(), std::io::Error> {
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(source, destination)?;
            Ok(())
        })();
        if let Err(error) = copy_result {
            for restored in copied.iter().rev() {
                let _ = std::fs::remove_file(restored);
            }
            if !tracked.is_empty() {
                let mut rollback = vec!["restore", "--worktree", "--"];
                rollback.extend(tracked.iter().map(String::as_str));
                let _ = git::run(&repo, &rollback, None);
            }
            state.oplog.finish(
                result.operation_id,
                Some(-1),
                &error.to_string(),
                &git::head_sha(&repo),
                result.duration_ms,
                Some(id),
            )?;
            return Err(AppError::Io(error));
        }
        copied.push(destination.clone());
    }

    if result.success {
        state.db.mark_recovery_restored(id)?;
        if let Some(checkpoint) = recovery.checkpoint.as_deref() {
            delete_recovery_ref(&repo, checkpoint);
        }
        if let Some(backup_path) = recovery.backup_path.as_deref() {
            let _ = std::fs::remove_dir_all(backup_path);
        }
    }
    Ok(result)
}

#[tauri::command]
fn restore_recovery(id: i64, state: tauri::State<AppState>) -> Result<OpResult, AppError> {
    restore_recovery_impl(id, &state)
}

/// Stage or unstage a patch (hunk / line selection) via `git apply --cached`.
fn apply_patch(
    path: String,
    patch: String,
    reverse: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let mut args = vec!["apply", "--cached", "--unidiff-zero", "--whitespace=nowarn"];
    if reverse {
        args.push("--reverse");
    }
    args.push("-");
    mutate(
        &state,
        &path,
        if reverse {
            "Unstage hunk"
        } else {
            "Stage hunk"
        },
        &args,
        Some(&patch),
    )
}

fn commit(
    path: String,
    message: String,
    amend: bool,
    sign: bool,
    allow_published_amend: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    if message.trim().is_empty() && !amend {
        return Err(AppError::InvalidInput("commit message is required".into()));
    }
    if amend && undo_commit_preview_impl(&repo_path(&path)?)?.published && !allow_published_amend {
        return Err(AppError::ConfirmationRequired(
            "the current commit is reachable from a remote branch; amending it rewrites published history"
                .into(),
        ));
    }
    let mut args = vec!["commit", "-m", message.as_str()];
    if amend {
        args.push("--amend");
        if message.trim().is_empty() {
            args = vec!["commit", "--amend", "--no-edit"];
        }
    }
    if sign {
        args.push("-S");
    }
    mutate(&state, &path, "Commit", &args, None)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UndoCommitPreview {
    sha: String,
    subject: String,
    initial_commit: bool,
    published: bool,
    remote_refs: Vec<String>,
    command: String,
}

fn undo_commit_preview_impl(repo: &Path) -> Result<UndoCommitPreview, AppError> {
    let sha = git::run_ok(repo, &["rev-parse", "--verify", "HEAD"], None)?
        .stdout
        .trim()
        .to_string();
    let subject = git::run_ok(repo, &["show", "-s", "--format=%s", "HEAD"], None)?
        .stdout
        .trim()
        .to_string();
    let initial_commit = git::run(repo, &["rev-parse", "--verify", "HEAD^"], None)?.exit_code != 0;
    let remote_refs = git::run_ok(
        repo,
        &[
            "branch",
            "-r",
            "--contains",
            "HEAD",
            "--format=%(refname:short)",
        ],
        None,
    )?
    .stdout
    .lines()
    .map(str::trim)
    .filter(|value| !value.is_empty() && !value.contains(" -> "))
    .map(str::to_string)
    .collect::<Vec<_>>();
    Ok(UndoCommitPreview {
        sha,
        subject,
        initial_commit,
        published: !remote_refs.is_empty(),
        remote_refs,
        command: if initial_commit {
            "git update-ref -d HEAD".into()
        } else {
            "git reset --soft HEAD~1".into()
        },
    })
}

fn undo_commit_preview(path: String) -> Result<UndoCommitPreview, AppError> {
    undo_commit_preview_impl(&repo_path(&path)?)
}

/// Soft-undo of the last commit — keeps all changes staged.
fn undo_last_commit_impl(
    path: String,
    allow_published: bool,
    state: &AppState,
) -> Result<OpResult, AppError> {
    let repo = repo_path(&path)?;
    let preview = undo_commit_preview_impl(&repo)?;
    if preview.published && !allow_published {
        return Err(AppError::ConfirmationRequired(format!(
            "commit {} is published on {}; undoing it will make the local branch diverge",
            preview.sha,
            preview.remote_refs.join(", ")
        )));
    }
    if !preview.initial_commit {
        mutate(
            state,
            &path,
            "Undo commit",
            &["reset", "--soft", "HEAD~1"],
            None,
        )
    } else {
        // An initial commit has no HEAD~1. Deleting the branch ref returns the
        // repository to its unborn state while preserving the index/worktree.
        mutate(
            state,
            &path,
            "Undo initial commit",
            &["update-ref", "-d", "HEAD"],
            None,
        )
    }
}

fn undo_last_commit(
    path: String,
    allow_published: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    undo_last_commit_impl(path, allow_published, &state)
}

fn git_fetch(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    remote_mutate(
        app,
        &state,
        &path,
        "Fetch",
        &["fetch", "--all", "--prune", "--progress"],
    )
}

fn git_pull(
    path: String,
    rebase: bool,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let args: &[&str] = if rebase {
        &["pull", "--rebase", "--progress"]
    } else {
        &["pull", "--no-rebase", "--progress"]
    };
    remote_mutate(app, &state, &path, "Pull", args)
}

fn git_push(
    path: String,
    set_upstream: bool,
    force_with_lease: bool,
    branch: Option<String>,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let mut args: Vec<&str> = vec!["push", "--progress"];
    if force_with_lease {
        // never plain --force: lease protects against clobbering remote work
        args.push("--force-with-lease");
    }
    let b;
    let remote_name = remote.unwrap_or_else(|| "origin".into());
    git::ensure_safe_arg(&remote_name)?;
    if set_upstream {
        args.push("--set-upstream");
        args.push(&remote_name);
        if let Some(name) = &branch {
            git::ensure_safe_arg(name)?;
            b = name.clone();
            args.push(&b);
        } else {
            args.push("HEAD");
        }
    } else if remote_name != "origin" {
        args.push(&remote_name);
    }
    remote_mutate(app, &state, &path, "Push", &args)
}

fn cancel_operation(operation_id: i64, state: tauri::State<AppState>) -> Result<(), AppError> {
    state.operations.cancel(operation_id)
}

fn create_branch(
    path: String,
    name: String,
    checkout: bool,
    at: Option<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    let start;
    let mut args: Vec<&str> = if checkout {
        vec!["switch", "-c", &name]
    } else {
        vec!["branch", &name]
    };
    if let Some(sha) = &at {
        git::ensure_safe_arg(sha)?;
        start = sha.clone();
        args.push(&start);
    }
    mutate(&state, &path, "Branch", &args, None)
}

fn checkout_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    mutate(&state, &path, "Checkout", &["switch", &name], None)
}

fn rename_branch(
    path: String,
    old_name: String,
    new_name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&old_name)?;
    git::ensure_safe_arg(&new_name)?;
    mutate(
        &state,
        &path,
        "Rename branch",
        &["branch", "-m", &old_name, &new_name],
        None,
    )
}

fn delete_branch(
    path: String,
    name: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    let flag = if force { "-D" } else { "-d" };
    mutate(
        &state,
        &path,
        "Delete branch",
        &["branch", flag, &name],
        None,
    )
}

fn merge_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    mutate(&state, &path, "Merge", &["merge", "--no-edit", &name], None)
}

fn rebase_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    mutate(&state, &path, "Rebase", &["rebase", &name], None)
}

fn cherry_pick(
    path: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&sha)?;
    mutate(&state, &path, "Cherry-pick", &["cherry-pick", &sha], None)
}

fn revert_commit(
    path: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&sha)?;
    mutate(
        &state,
        &path,
        "Revert",
        &["revert", "--no-edit", &sha],
        None,
    )
}

fn create_tag(
    path: String,
    name: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&name)?;
    git::ensure_safe_arg(&sha)?;
    mutate(&state, &path, "Tag", &["tag", &name, &sha], None)
}

/// Continue the active merge / rebase / cherry-pick / revert.
/// `-c core.editor=true` prevents git from waiting on an editor.
fn git_continue(
    path: String,
    operation: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let active = git::active_operation(&repo_path(&path)?);
    if active.as_deref() != Some(operation.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "cannot continue {operation}; active operation is {}",
            active.as_deref().unwrap_or("none")
        )));
    }
    let op: &str = match operation.as_str() {
        "rebase" => "rebase",
        "merge" => "merge",
        "cherry-pick" => "cherry-pick",
        "revert" => "revert",
        _ => {
            return Err(AppError::InvalidInput(format!(
                "unknown operation: {operation}"
            )))
        }
    };
    mutate(
        &state,
        &path,
        "Continue",
        &["-c", "core.editor=true", op, "--continue"],
        None,
    )
}

fn git_abort(
    path: String,
    operation: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let active = git::active_operation(&repo_path(&path)?);
    if active.as_deref() != Some(operation.as_str()) {
        return Err(AppError::InvalidInput(format!(
            "cannot abort {operation}; active operation is {}",
            active.as_deref().unwrap_or("none")
        )));
    }
    let op: &str = match operation.as_str() {
        "rebase" => "rebase",
        "merge" => "merge",
        "cherry-pick" => "cherry-pick",
        "revert" => "revert",
        _ => {
            return Err(AppError::InvalidInput(format!(
                "unknown operation: {operation}"
            )))
        }
    };
    mutate(&state, &path, "Abort", &[op, "--abort"], None)
}

/// Resolve a conflicted file by taking one side entirely, then staging it.
fn resolve_conflict(
    path: String,
    file: String,
    side: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&file)?;
    let flag = match side.as_str() {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => return Err(AppError::InvalidInput(format!("unknown side: {side}"))),
    };
    mutate(
        &state,
        &path,
        "Resolve",
        &["checkout", flag, "--", &file],
        None,
    )?;
    mutate(&state, &path, "Mark resolved", &["add", "--", &file], None)
}

/// Mark a conflicted file resolved as it currently stands in the worktree.
fn mark_resolved(
    path: String,
    file: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&file)?;
    let repo = repo_path(&path)?;
    let contents = std::fs::read_to_string(safe_repo_file(&repo, &file)?).unwrap_or_default();
    if contents.contains("<<<<<<<") || contents.contains("=======") || contents.contains(">>>>>>>")
    {
        return Err(AppError::InvalidInput(
            "conflict markers remain in the file".into(),
        ));
    }
    mutate(&state, &path, "Mark resolved", &["add", "--", &file], None)
}

// ---------- worktrees ----------

fn worktree_add(
    path: String,
    wt_path: String,
    branch: String,
    create: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&wt_path)?;
    git::ensure_safe_arg(&branch)?;
    let target = PathBuf::from(&wt_path);
    if !target.is_absolute() {
        return Err(AppError::InvalidInput(
            "worktree path must be absolute".into(),
        ));
    }
    let parent = target
        .parent()
        .ok_or_else(|| AppError::InvalidInput("worktree path has no parent folder".into()))?;
    if !parent.is_dir() {
        return Err(AppError::InvalidInput(
            "worktree parent folder does not exist".into(),
        ));
    }
    let source = repo_path(&path)?.canonicalize()?;
    if parent.canonicalize()?.starts_with(&source) {
        return Err(AppError::InvalidInput(
            "worktree destination must be outside the source repository".into(),
        ));
    }
    if target.exists() && (!target.is_dir() || std::fs::read_dir(&target)?.next().is_some()) {
        return Err(AppError::InvalidInput(
            "worktree destination must not exist or must be an empty folder".into(),
        ));
    }
    let args: Vec<&str> = if create {
        vec!["worktree", "add", "-b", &branch, &wt_path]
    } else {
        vec!["worktree", "add", &wt_path, &branch]
    };
    mutate(&state, &path, "Worktree add", &args, None)
}

fn worktree_remove(
    path: String,
    wt_path: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    git::ensure_safe_arg(&wt_path)?;
    let worktree = repo_path(&wt_path)?;
    if !force {
        let status = git::repo_status(&worktree)?;
        if !status.clean {
            return Err(AppError::InvalidInput(format!(
                "worktree has {} changed files; force removal requires explicit confirmation",
                status.dirty
            )));
        }
    }
    let args: Vec<&str> = if force {
        vec!["worktree", "remove", "--force", &wt_path]
    } else {
        vec!["worktree", "remove", &wt_path]
    };
    mutate(&state, &path, "Worktree remove", &args, None)
}

fn worktree_prune(path: String, state: tauri::State<AppState>) -> Result<OpResult, AppError> {
    mutate(
        &state,
        &path,
        "Worktree prune",
        &["worktree", "prune"],
        None,
    )
}

fn stash_push(
    path: String,
    message: String,
    include_untracked: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let mut args = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if !message.trim().is_empty() {
        args.push("-m");
        args.push(&message);
    }
    mutate(&state, &path, "Stash", &args, None)
}

fn stash_apply(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let r = format!("stash@{{{index}}}");
    mutate(&state, &path, "Stash apply", &["stash", "apply", &r], None)
}

fn stash_drop(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    let r = format!("stash@{{{index}}}");
    mutate(&state, &path, "Stash drop", &["stash", "drop", &r], None)
}

// ---------- app entry ----------

#[cfg(test)]
mod safety_integration_tests {
    use super::*;

    fn test_state(root: &Path) -> AppState {
        let data_dir = root.join("app-data");
        std::fs::create_dir_all(&data_dir).unwrap();
        let database = data_dir.join("gitapp.sqlite");
        AppState {
            db: Db::open(&database).unwrap(),
            oplog: OpLog::open(&database).unwrap(),
            locks: RepoLocks::default(),
            watchers: RepoWatchers::default(),
            data_dir,
            operations: OperationManager::default(),
        }
    }

    fn initialized_repo(path: &Path) {
        std::fs::create_dir_all(path).unwrap();
        git::run_ok(path, &["init", "-b", "main"], None).unwrap();
        git::run_ok(path, &["config", "user.name", "Gitrune Tests"], None).unwrap();
        git::run_ok(
            path,
            &["config", "user.email", "gitrune@example.test"],
            None,
        )
        .unwrap();
        std::fs::write(path.join("tracked.txt"), "base\n").unwrap();
        git::run_ok(path, &["add", "--", "tracked.txt"], None).unwrap();
        git::run_ok(path, &["commit", "-m", "initial"], None).unwrap();
    }

    #[test]
    fn unstage_preserves_files_before_the_first_commit() {
        let root = tempfile::tempdir().unwrap();
        let repo = root.path().join("repo");
        std::fs::create_dir_all(&repo).unwrap();
        git::run_ok(&repo, &["init", "-b", "main"], None).unwrap();
        let state = test_state(root.path());
        let file = repo.join("new file.txt");
        std::fs::write(&file, "staged version\n").unwrap();
        git::run_ok(&repo, &["add", "--", "new file.txt"], None).unwrap();
        // This also covers content edited again after the index entry was made.
        std::fs::write(&file, "newer working-tree version\n").unwrap();

        let result = unstage_files_impl(
            repo.display().to_string(),
            vec!["new file.txt".into()],
            &state,
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(
            std::fs::read_to_string(&file).unwrap(),
            "newer working-tree version\n"
        );
        let status = git::repo_status(&repo).unwrap();
        assert!(status
            .files
            .iter()
            .any(|entry| entry.path == "new file.txt" && entry.untracked && !entry.staged));
    }

    #[test]
    fn unstage_restores_the_head_version_after_the_first_commit() {
        let root = tempfile::tempdir().unwrap();
        let repo = root.path().join("repo");
        initialized_repo(&repo);
        let state = test_state(root.path());
        std::fs::write(repo.join("tracked.txt"), "changed\n").unwrap();
        git::run_ok(&repo, &["add", "--", "tracked.txt"], None).unwrap();

        let result = unstage_files_impl(
            repo.display().to_string(),
            vec!["tracked.txt".into()],
            &state,
        )
        .unwrap();

        assert!(result.success);
        let status = git::repo_status(&repo).unwrap();
        assert!(status.files.iter().any(|entry| {
            entry.path == "tracked.txt" && !entry.staged && !entry.untracked && entry.st == "M"
        }));
    }

    #[test]
    fn discard_recovery_survives_gc_and_restores_mixed_content() {
        let root = tempfile::tempdir().unwrap();
        let repo = root.path().join("repo");
        initialized_repo(&repo);
        let state = test_state(root.path());

        std::fs::write(repo.join("tracked.txt"), "staged\n").unwrap();
        git::run_ok(&repo, &["add", "--", "tracked.txt"], None).unwrap();
        std::fs::write(repo.join("tracked.txt"), "staged\nunstaged\n").unwrap();
        std::fs::write(repo.join("untracked space.txt"), "recover me\n").unwrap();

        let result = discard_files_impl(
            repo.display().to_string(),
            vec!["tracked.txt".into(), "untracked space.txt".into()],
            &state,
        )
        .unwrap();
        assert!(result.success);
        let recovery_id = result.recovery_id.unwrap();
        let recovery = state.db.recovery(recovery_id).unwrap();
        let recovery_ref = recovery.checkpoint.as_deref().unwrap();
        assert!(recovery_ref.starts_with("refs/gitrune/recovery/"));
        assert_eq!(
            std::fs::read_to_string(repo.join("tracked.txt")).unwrap(),
            "staged\n"
        );
        assert!(!repo.join("untracked space.txt").exists());
        assert_eq!(
            state.oplog.list(10).unwrap()[0].recovery_id,
            Some(recovery_id)
        );

        git::run_ok(&repo, &["gc", "--prune=now"], None).unwrap();
        git::run_ok(&repo, &["rev-parse", "--verify", recovery_ref], None).unwrap();

        let restored = restore_recovery_impl(recovery_id, &state).unwrap();
        assert!(restored.success);
        assert_eq!(
            std::fs::read_to_string(repo.join("tracked.txt")).unwrap(),
            "staged\nunstaged\n"
        );
        assert_eq!(
            std::fs::read_to_string(repo.join("untracked space.txt")).unwrap(),
            "recover me\n"
        );
        assert!(state
            .db
            .recovery(recovery_id)
            .unwrap()
            .restored_at
            .is_some());
        assert_ne!(
            git::run(&repo, &["rev-parse", "--verify", recovery_ref], None)
                .unwrap()
                .exit_code,
            0
        );
    }

    #[test]
    fn recovery_preflights_every_untracked_destination_before_copying() {
        let root = tempfile::tempdir().unwrap();
        let repo = root.path().join("repo");
        initialized_repo(&repo);
        let state = test_state(root.path());
        std::fs::write(repo.join("a.txt"), "a\n").unwrap();
        std::fs::write(repo.join("b.txt"), "b\n").unwrap();
        let result = discard_files_impl(
            repo.display().to_string(),
            vec!["a.txt".into(), "b.txt".into()],
            &state,
        )
        .unwrap();
        let recovery_id = result.recovery_id.unwrap();
        std::fs::write(repo.join("b.txt"), "new b\n").unwrap();

        assert!(restore_recovery_impl(recovery_id, &state).is_err());
        assert!(!repo.join("a.txt").exists());
        assert_eq!(
            std::fs::read_to_string(repo.join("b.txt")).unwrap(),
            "new b\n"
        );
        assert!(state
            .db
            .recovery(recovery_id)
            .unwrap()
            .restored_at
            .is_none());
        let failed = state.oplog.list(1).unwrap().remove(0);
        assert_eq!(failed.status, "failed");
        assert_eq!(failed.recovery_id, Some(recovery_id));
    }

    #[test]
    fn undo_requires_explicit_confirmation_for_published_commits() {
        let root = tempfile::tempdir().unwrap();
        let repo = root.path().join("repo");
        let bare = root.path().join("remote.git");
        initialized_repo(&repo);
        let state = test_state(root.path());
        git::run_ok(
            root.path(),
            &["init", "--bare", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        git::run_ok(
            &repo,
            &["remote", "add", "origin", bare.to_str().unwrap()],
            None,
        )
        .unwrap();
        git::run_ok(&repo, &["push", "-u", "origin", "main"], None).unwrap();

        std::fs::write(repo.join("published.txt"), "published\n").unwrap();
        git::run_ok(&repo, &["add", "--", "published.txt"], None).unwrap();
        git::run_ok(&repo, &["commit", "-m", "published"], None).unwrap();
        git::run_ok(&repo, &["push"], None).unwrap();
        let preview = undo_commit_preview_impl(&repo).unwrap();
        assert!(preview.published);
        assert!(preview
            .remote_refs
            .iter()
            .any(|value| value == "origin/main"));

        let blocked = undo_last_commit_impl(repo.display().to_string(), false, &state);
        assert!(matches!(blocked, Err(AppError::ConfirmationRequired(_))));
        let undone = undo_last_commit_impl(repo.display().to_string(), true, &state).unwrap();
        assert!(undone.success);
        assert!(
            git::run_ok(&repo, &["diff", "--cached", "--name-only"], None)
                .unwrap()
                .stdout
                .contains("published.txt")
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            // Retain the original database filename across the Gitrune rebrand.
            // Together with the stable bundle identifier, this preserves local user data.
            let db = Db::open(&dir.join("gitapp.sqlite"))
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            let oplog = OpLog::open(&dir.join("gitapp.sqlite"))
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            app.manage(AppState {
                db,
                oplog,
                locks: RepoLocks::default(),
                watchers: RepoWatchers::default(),
                data_dir: dir,
                operations: OperationManager::default(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_git,
            open_path,
            list_editors,
            open_in_editor,
            get_settings,
            save_settings,
            list_recoveries,
            restore_recovery,
            commands::repository::list_repos,
            commands::repository::add_repo,
            commands::repository::remove_repo,
            commands::repository::update_repo_color,
            commands::repository::touch_repo,
            commands::repository::watch_repo,
            commands::repository::clone_repo,
            commands::repository::init_repo,
            commands::repository::repo_status,
            commands::repository::get_identity,
            identity::identity_details,
            identity::list_identity_profiles,
            identity::save_identity_profile,
            identity::delete_identity_profile,
            identity::apply_identity_profile,
            identity::clear_repository_identity,
            identity::apply_profile_ssh_host,
            identity::list_ssh_hosts,
            commands::repository::get_commit_template,
            commands::repository::list_refs,
            commands::history::commit_log,
            commands::history::commit_info,
            commands::changes::diff_file,
            commands::history::commit_files,
            commands::history::commit_file_diff,
            commands::history::compare_file_diff,
            commands::stash::stash_list,
            commands::worktree::worktree_list,
            commands::conflict::conflict_versions,
            operation_log,
            commands::changes::stage_files,
            commands::changes::unstage_files,
            commands::changes::discard_files,
            commands::changes::apply_patch,
            commands::commit::commit,
            commands::commit::undo_last_commit,
            commands::commit::undo_commit_preview,
            commands::remote::git_fetch,
            commands::remote::git_pull,
            commands::remote::git_push,
            commands::remote::cancel_operation,
            commands::branch::create_branch,
            commands::branch::checkout_branch,
            commands::branch::rename_branch,
            commands::branch::delete_branch,
            commands::branch::merge_branch,
            commands::branch::rebase_branch,
            commands::branch::cherry_pick,
            commands::branch::revert_commit,
            commands::tag::create_tag,
            commands::conflict::git_continue,
            commands::conflict::git_abort,
            commands::conflict::resolve_conflict,
            commands::conflict::mark_resolved,
            commands::worktree::worktree_add,
            commands::worktree::worktree_remove,
            commands::worktree::worktree_prune,
            commands::stash::stash_push,
            commands::stash::stash_apply,
            commands::stash::stash_drop,
            commands::remote::list_remotes,
            commands::remote::current_upstream,
            commands::history::commit_page,
            commands::history::compare_commits,
            commands::history::file_history,
            commands::history::blame_file,
            commands::history::line_history,
            commands::stash::stash_detail,
            commands::tag::list_tags,
            commands::worktree::list_worktree_info,
            commands::remote::add_remote,
            commands::remote::update_remote,
            commands::remote::remove_remote,
            commands::remote::select_default_remote,
            commands::remote::fetch_remote,
            commands::remote::set_upstream,
            commands::remote::unset_upstream,
            commands::remote::checkout_remote_branch,
            commands::stash::stash_pop,
            commands::stash::stash_branch,
            commands::tag::create_tag_advanced,
            commands::tag::push_tag,
            commands::tag::delete_tag
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gitrune");
}
