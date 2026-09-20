use crate::error::AppError;
use crate::features::Tag;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn list_tags(path: String) -> Result<Vec<Tag>, AppError> {
    crate::features::list_tags(path)
}
#[tauri::command]
pub fn create_tag(
    path: String,
    name: String,
    sha: String,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::create_tag(path, name, sha, state)
}
#[tauri::command]
pub fn create_tag_advanced(
    path: String,
    name: String,
    sha: String,
    message: Option<String>,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::create_tag_advanced(path, name, sha, message, state)
}
#[tauri::command]
pub fn push_tag(
    path: String,
    remote: String,
    name: String,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::push_tag(path, remote, name, app, state)
}
#[tauri::command]
pub fn delete_tag(
    path: String,
    name: String,
    remote: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::features::delete_tag(path, name, remote, app, state)
}
