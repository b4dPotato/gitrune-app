//! File-system watcher: external changes (editor saves, terminal git use)
//! refresh repository state. Events are debounced and emitted to the UI as
//! a single `repo-changed` event carrying the repository path.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoChangedEvent {
    path: String,
    scope: &'static str,
}

pub struct RepoWatchers {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl Default for RepoWatchers {
    fn default() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

impl RepoWatchers {
    /// Watch only the repository currently visible in the application.
    /// Dropping the previous watcher also stops recursive IO for inactive repos.
    pub fn watch(&self, app: tauri::AppHandle, repo_path: String) -> notify::Result<()> {
        let mut map = self.watchers.lock().expect("watchers poisoned");
        if map.len() == 1 && map.contains_key(&repo_path) {
            return Ok(());
        }
        map.clear();

        // `true` means refs/configuration changed and consumers need the full
        // repository refresh. `false` is limited to the worktree or index.
        let (tx, rx) = mpsc::channel::<bool>();
        let path_for_events = repo_path.clone();
        let root_for_events = PathBuf::from(&repo_path);

        let mut watcher =
            notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    let scope = event
                        .paths
                        .iter()
                        .filter_map(|path| change_scope(&root_for_events, path))
                        .reduce(|left, right| left || right);
                    if let Some(full_refresh) = scope {
                        let _ = tx.send(full_refresh);
                    }
                }
            })?;
        watcher.watch(&PathBuf::from(&repo_path), RecursiveMode::Recursive)?;

        // debounce thread: coalesce bursts into one UI event
        std::thread::spawn(move || {
            while let Ok(mut full_refresh) = rx.recv() {
                // swallow everything arriving within the debounce window
                while let Ok(next_scope) = rx.recv_timeout(Duration::from_millis(500)) {
                    full_refresh |= next_scope;
                }
                let _ = app.emit(
                    "repo-changed",
                    RepoChangedEvent {
                        path: path_for_events.clone(),
                        scope: if full_refresh {
                            "repository"
                        } else {
                            "workingTree"
                        },
                    },
                );
            }
        });

        map.insert(repo_path, watcher);
        Ok(())
    }

    pub fn unwatch(&self, repo_path: &str) {
        let mut map = self.watchers.lock().expect("watchers poisoned");
        map.remove(repo_path);
    }
}

fn change_scope(repo_root: &Path, path: &Path) -> Option<bool> {
    if is_ignored_path(repo_root, path) {
        return None;
    }
    let relative = path.strip_prefix(repo_root).unwrap_or(path);
    let mut components = relative.components();
    if components
        .next()
        .is_some_and(|part| part.as_os_str() == ".git")
    {
        // The index changes for stage/unstage operations. Other non-ignored
        // .git paths may represent refs, HEAD, operations, or configuration.
        return Some(
            components
                .next()
                .is_none_or(|part| part.as_os_str() != "index"),
        );
    }
    Some(false)
}

fn is_ignored_path(repo_root: &Path, path: &Path) -> bool {
    let relative = path.strip_prefix(repo_root).unwrap_or(path);
    let mut components = relative
        .components()
        .map(|part| part.as_os_str().to_string_lossy());

    while let Some(component) = components.next() {
        let name = component.as_ref();
        if matches!(
            name,
            "node_modules"
                | "dist"
                | "build"
                | "out"
                | "coverage"
                | ".next"
                | ".cache"
                | "__pycache__"
        ) || name == "target"
            || name.starts_with("target-")
        {
            return true;
        }

        if name == ".git" {
            if let Some(next) = components.next() {
                return matches!(next.as_ref(), "objects" | "logs");
            }
        }
    }

    path.extension()
        .is_some_and(|extension| extension == "lock")
}

#[cfg(test)]
mod tests {
    use super::{change_scope, is_ignored_path};
    use std::path::Path;

    #[test]
    fn ignores_dependency_and_build_trees_but_keeps_git_refs() {
        let root = Path::new("C:/repo");
        assert!(is_ignored_path(
            root,
            Path::new("C:/repo/node_modules/pkg/index.js")
        ));
        assert!(is_ignored_path(
            root,
            Path::new("C:/repo/target-debug/deps/a.dll")
        ));
        assert!(is_ignored_path(
            root,
            Path::new("C:/repo/.git/objects/ab/cd")
        ));
        assert!(!is_ignored_path(
            root,
            Path::new("C:/repo/.git/refs/heads/main")
        ));
        assert!(!is_ignored_path(root, Path::new("C:/repo/src/main.rs")));
    }

    #[test]
    fn scopes_worktree_and_index_changes_without_hiding_ref_changes() {
        let root = Path::new("C:/repo");
        assert_eq!(
            change_scope(root, Path::new("C:/repo/src/main.rs")),
            Some(false)
        );
        assert_eq!(
            change_scope(root, Path::new("C:/repo/.git/index")),
            Some(false)
        );
        assert_eq!(
            change_scope(root, Path::new("C:/repo/.git/refs/heads/main")),
            Some(true)
        );
        assert_eq!(
            change_scope(root, Path::new("C:/repo/node_modules/pkg/index.js")),
            None
        );
    }
}
