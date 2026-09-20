use crate::error::AppError;
use crate::features::{
    BlameLine, CommitComparison, CommitPage, CommitRecord, GraphFilters, LineHistoryEntry,
};

#[tauri::command]
pub fn commit_log(path: String, skip: u32, limit: u32) -> Result<String, AppError> {
    crate::commit_log(path, skip, limit)
}
#[tauri::command]
pub fn commit_info(path: String, sha: String) -> Result<String, AppError> {
    crate::commit_info(path, sha)
}
#[tauri::command]
pub fn commit_files(path: String, sha: String) -> Result<String, AppError> {
    crate::commit_files(path, sha)
}
#[tauri::command]
pub fn commit_file_diff(path: String, sha: String, file: String) -> Result<String, AppError> {
    crate::commit_file_diff(path, sha, file)
}
#[tauri::command]
pub fn compare_file_diff(
    path: String,
    base: String,
    head: String,
    file: String,
) -> Result<String, AppError> {
    crate::compare_file_diff(path, base, head, file)
}
#[tauri::command]
pub fn commit_page(
    path: String,
    cursor: Option<String>,
    limit: u32,
    filters: GraphFilters,
) -> Result<CommitPage, AppError> {
    crate::features::commit_page(path, cursor, limit, filters)
}
#[tauri::command]
pub fn compare_commits(
    path: String,
    base: String,
    head: String,
) -> Result<CommitComparison, AppError> {
    crate::features::compare_commits(path, base, head)
}
#[tauri::command]
pub fn file_history(path: String, file: String, limit: u32) -> Result<Vec<CommitRecord>, AppError> {
    crate::features::file_history(path, file, limit)
}
#[tauri::command]
pub fn blame_file(path: String, file: String) -> Result<Vec<BlameLine>, AppError> {
    crate::features::blame_file(path, file)
}
#[tauri::command]
pub fn line_history(
    path: String,
    file: String,
    start: u32,
    end: u32,
) -> Result<Vec<LineHistoryEntry>, AppError> {
    crate::features::line_history(path, file, start, end)
}
