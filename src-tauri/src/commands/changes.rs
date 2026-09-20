use crate::error::AppError;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn diff_file(path: String, file: String, staged: bool) -> Result<String, AppError> {
    crate::diff_file(path, file, staged)
}

#[tauri::command]
pub fn stage_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::stage_files(path, files, state)
}

#[tauri::command]
pub fn unstage_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::unstage_files(path, files, state)
}

#[tauri::command]
pub fn discard_files(
    path: String,
    files: Vec<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::discard_files(path, files, state)
}

#[tauri::command]
pub fn apply_patch(
    path: String,
    patch: String,
    reverse: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::apply_patch(path, patch, reverse, state)
}
