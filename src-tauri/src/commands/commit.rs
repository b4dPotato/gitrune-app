use crate::error::AppError;
use crate::ops::OpResult;
use crate::{AppState, UndoCommitPreview};

#[tauri::command]
pub fn commit(
    path: String,
    message: String,
    amend: bool,
    sign: bool,
    allow_published_amend: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::commit(path, message, amend, sign, allow_published_amend, state)
}

#[tauri::command]
pub fn undo_commit_preview(path: String) -> Result<UndoCommitPreview, AppError> {
    crate::undo_commit_preview(path)
}

#[tauri::command]
pub fn undo_last_commit(
    path: String,
    allow_published: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::undo_last_commit(path, allow_published, state)
}
