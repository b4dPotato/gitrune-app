use crate::error::AppError;
use crate::features::WorktreeInfo;
use crate::ops::OpResult;
use crate::AppState;

#[tauri::command]
pub fn worktree_list(path: String) -> Result<String, AppError> {
    crate::worktree_list(path)
}
#[tauri::command]
pub fn list_worktree_info(path: String) -> Result<Vec<WorktreeInfo>, AppError> {
    crate::features::list_worktree_info(path)
}
#[tauri::command]
pub fn worktree_add(
    path: String,
    wt_path: String,
    branch: String,
    create: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::worktree_add(path, wt_path, branch, create, state)
}
#[tauri::command]
pub fn worktree_remove(
    path: String,
    wt_path: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<OpResult, AppError> {
    crate::worktree_remove(path, wt_path, force, state)
}
#[tauri::command]
pub fn worktree_prune(path: String, state: tauri::State<AppState>) -> Result<OpResult, AppError> {
    crate::worktree_prune(path, state)
}
