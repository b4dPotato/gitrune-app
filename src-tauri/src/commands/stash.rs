use crate::error::AppError;
use crate::features::StashDetail;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn stash_list(path: String) -> Result<String, AppError> {
    crate::stash_list(path)
}
#[tauri::command]
pub fn stash_detail(path: String, index: u32) -> Result<StashDetail, AppError> {
    crate::features::stash_detail(path, index)
}
#[tauri::command]
pub fn stash_push(
    path: String,
    message: String,
    include_untracked: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::stash_push(path, message, include_untracked, state)
}
#[tauri::command]
pub fn stash_apply(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::stash_apply(path, index, state)
}
#[tauri::command]
pub fn stash_drop(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::stash_drop(path, index, state)
}
#[tauri::command]
pub fn stash_pop(
    path: String,
    index: u32,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::stash_pop(path, index, state)
}
#[tauri::command]
pub fn stash_branch(
    path: String,
    index: u32,
    branch: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::stash_branch(path, index, branch, state)
}
