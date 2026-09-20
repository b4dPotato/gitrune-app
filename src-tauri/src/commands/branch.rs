use crate::error::AppError;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn create_branch(
    path: String,
    name: String,
    checkout: bool,
    at: Option<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::create_branch(path, name, checkout, at, state)
}

#[tauri::command]
pub fn checkout_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::checkout_branch(path, name, state)
}

#[tauri::command]
pub fn rename_branch(
    path: String,
    old_name: String,
    new_name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::rename_branch(path, old_name, new_name, state)
}

#[tauri::command]
pub fn delete_branch(
    path: String,
    name: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::delete_branch(path, name, force, state)
}

#[tauri::command]
pub fn merge_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::merge_branch(path, name, state)
}

#[tauri::command]
pub fn rebase_branch(
    path: String,
    name: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::rebase_branch(path, name, state)
}

#[tauri::command]
pub fn cherry_pick(
    path: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::cherry_pick(path, sha, state)
}

#[tauri::command]
pub fn revert_commit(
    path: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::revert_commit(path, sha, state)
}
