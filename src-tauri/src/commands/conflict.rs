use crate::error::AppError;
use crate::ops::OpResult;
use crate::{AppState, ConflictVersions};

#[tauri::command]
pub fn conflict_versions(path: String, file: String) -> Result<ConflictVersions, AppError> {
    crate::conflict_versions(path, file)
}
#[tauri::command]
pub fn git_continue(
    path: String,
    operation: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::git_continue(path, operation, state)
}
#[tauri::command]
pub fn git_abort(
    path: String,
    operation: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::git_abort(path, operation, state)
}
#[tauri::command]
pub fn resolve_conflict(
    path: String,
    file: String,
    side: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::resolve_conflict(path, file, side, state)
}
#[tauri::command]
pub fn mark_resolved(
    path: String,
    file: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::mark_resolved(path, file, state)
}
