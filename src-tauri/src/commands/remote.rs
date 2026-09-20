use crate::error::AppError;
use crate::features::{Remote, Upstream};
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn list_remotes(path: String) -> Result<Vec<Remote>, AppError> {
    crate::features::list_remotes(path)
}
#[tauri::command]
pub fn current_upstream(path: String) -> Result<Upstream, AppError> {
    crate::features::current_upstream(path)
}
#[tauri::command]
pub fn git_fetch(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::git_fetch(path, app, state)
}
#[tauri::command]
pub fn git_pull(
    path: String,
    rebase: bool,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::git_pull(path, rebase, app, state)
}
#[tauri::command]
pub fn git_push(
    path: String,
    set_upstream: bool,
    force_with_lease: bool,
    branch: Option<String>,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::git_push(
        path,
        set_upstream,
        force_with_lease,
        branch,
        remote,
        app,
        state,
    )
}
#[tauri::command]
pub fn cancel_operation(operation_id: i64, state: tauri::State<AppState>) -> Result<(), AppError> {
    crate::cancel_operation(operation_id, state)
}
#[tauri::command]
pub fn add_remote(
    path: String,
    name: String,
    url: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::add_remote(path, name, url, state)
}
#[tauri::command]
pub fn update_remote(
    path: String,
    name: String,
    url: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::update_remote(path, name, url, state)
}
#[tauri::command]
pub fn remove_remote(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::remove_remote(path, name, state)
}
#[tauri::command]
pub fn select_default_remote(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::select_default_remote(path, name, state)
}
#[tauri::command]
pub fn fetch_remote(
    path: String,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::fetch_remote(path, remote, app, state)
}
#[tauri::command]
pub fn set_upstream(
    path: String,
    branch: String,
    remote: String,
    remote_branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::set_upstream(path, branch, remote, remote_branch, state)
}
#[tauri::command]
pub fn unset_upstream(
    path: String,
    branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::unset_upstream(path, branch, state)
}
#[tauri::command]
pub fn checkout_remote_branch(
    path: String,
    remote_ref: String,
    local_name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::checkout_remote_branch(path, remote_ref, local_name, state)
}
