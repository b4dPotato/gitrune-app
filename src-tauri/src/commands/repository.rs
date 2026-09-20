use crate::db::RepoRecord;
use crate::error::AppError;
use crate::git::RepoStatus;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn list_repos(state: tauri::State<AppState>) -> Result<Vec<RepoRecord>, AppError> {
    crate::list_repos(state)
}

#[tauri::command]
pub fn add_repo(
    path: String,
    color: Option<String>,
    state: tauri::State<AppState>,
) -> Result<RepoRecord, AppError> {
    crate::add_repo(path, color, state)
}

#[tauri::command]
pub fn remove_repo(id: i64, path: String, state: tauri::State<AppState>) -> Result<(), AppError> {
    crate::remove_repo(id, path, state)
}

#[tauri::command]
pub fn update_repo_color(
    id: i64,
    color: String,
    state: tauri::State<AppState>,
) -> Result<(), AppError> {
    crate::update_repo_color(id, color, state)
}

#[tauri::command]
pub fn touch_repo(id: i64, state: tauri::State<AppState>) -> Result<(), AppError> {
    crate::touch_repo(id, state)
}

#[tauri::command]
pub fn watch_repo(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<(), AppError> {
    crate::watch_repo(path, app, state)
}

#[tauri::command]
pub fn clone_repo(
    url: String,
    parent_dir: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::clone_repo(url, parent_dir, app, state)
}

#[tauri::command]
pub fn init_repo(dir: String, state: tauri::State<AppState>) -> Result<OpResult, AppError> {
    crate::init_repo(dir, state)
}

#[tauri::command]
pub fn repo_status(path: String) -> Result<RepoStatus, AppError> {
    crate::repo_status(path)
}

#[tauri::command]
pub fn get_identity(path: String) -> Result<String, AppError> {
    crate::get_identity(path)
}

#[tauri::command]
pub fn get_commit_template(path: String) -> Result<Option<String>, AppError> {
    crate::get_commit_template(path)
}

#[tauri::command]
pub fn list_refs(path: String) -> Result<String, AppError> {
    crate::list_refs(path)
}
