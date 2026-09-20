//! Versioned application database. Only local metadata is stored here; Git
//! repositories remain the source of truth and credentials never enter SQLite.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoRecord {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub color: String,
    pub last_opened_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_ui_zoom")]
    pub ui_zoom: u16,
    #[serde(default)]
    pub custom_theme: CustomTheme,
    pub right_panel_width: u32,
    pub sidebar_collapsed: bool,
    pub sidebar_width: u32,
    #[serde(default = "default_graph_commit_width")]
    pub graph_commit_width: u32,
    #[serde(default = "default_graph_files_width")]
    pub graph_files_width: u32,
    #[serde(default = "default_changes_panel_width")]
    pub changes_panel_width: u32,
    pub diff_mode: String,
    pub editor: String,
    #[serde(default)]
    pub editor_associations: HashMap<String, String>,
    pub terminal: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CustomTheme {
    pub background: String,
    pub panel: String,
    pub accent: String,
    pub text: String,
}

impl Default for CustomTheme {
    fn default() -> Self {
        Self {
            background: "#111827".into(),
            panel: "#1f2937".into(),
            accent: "#8b5cf6".into(),
            text: "#f3f4f6".into(),
        }
    }
}

fn default_ui_zoom() -> u16 {
    100
}

fn default_language() -> String {
    "en".into()
}

fn default_graph_commit_width() -> u32 {
    340
}

fn default_graph_files_width() -> u32 {
    250
}

fn default_changes_panel_width() -> u32 {
    290
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            language: default_language(),
            ui_zoom: default_ui_zoom(),
            custom_theme: CustomTheme::default(),
            right_panel_width: 312,
            sidebar_collapsed: false,
            sidebar_width: 236,
            graph_commit_width: default_graph_commit_width(),
            graph_files_width: default_graph_files_width(),
            changes_panel_width: default_changes_panel_width(),
            diff_mode: "inline".into(),
            editor: "auto".into(),
            editor_associations: HashMap::new(),
            terminal: "auto".into(),
        }
    }
}

impl AppSettings {
    pub fn validate(&self) -> Result<(), AppError> {
        if !matches!(
            self.theme.as_str(),
            "dark" | "light" | "dracula" | "nord" | "solarized" | "custom"
        ) {
            return Err(AppError::InvalidInput("unsupported theme".into()));
        }
        if !matches!(self.language.as_str(), "en" | "pl" | "uk") {
            return Err(AppError::InvalidInput("unsupported language".into()));
        }
        if !(75..=150).contains(&self.ui_zoom) {
            return Err(AppError::InvalidInput(
                "UI zoom is outside the supported range".into(),
            ));
        }
        let valid_color = |value: &str| {
            value.len() == 7
                && value.starts_with('#')
                && value[1..]
                    .chars()
                    .all(|character| character.is_ascii_hexdigit())
        };
        if !valid_color(&self.custom_theme.background)
            || !valid_color(&self.custom_theme.panel)
            || !valid_color(&self.custom_theme.accent)
            || !valid_color(&self.custom_theme.text)
        {
            return Err(AppError::InvalidInput(
                "custom theme colors must use #RRGGBB format".into(),
            ));
        }
        if !matches!(self.diff_mode.as_str(), "inline" | "side") {
            return Err(AppError::InvalidInput(
                "diff mode must be inline or side".into(),
            ));
        }
        if !(240..=440).contains(&self.right_panel_width) {
            return Err(AppError::InvalidInput(
                "right panel width is outside the supported range".into(),
            ));
        }
        if !(180..=340).contains(&self.sidebar_width) {
            return Err(AppError::InvalidInput(
                "sidebar width is outside the supported range".into(),
            ));
        }
        if !(220..=600).contains(&self.graph_commit_width) {
            return Err(AppError::InvalidInput(
                "commit-list width is outside the supported range".into(),
            ));
        }
        if !(160..=500).contains(&self.graph_files_width) {
            return Err(AppError::InvalidInput(
                "changed-files width is outside the supported range".into(),
            ));
        }
        if !(220..=520).contains(&self.changes_panel_width) {
            return Err(AppError::InvalidInput(
                "changes-panel width is outside the supported range".into(),
            ));
        }
        if !matches!(
            self.editor.as_str(),
            "auto" | "code" | "codium" | "notepad" | "system"
        ) {
            return Err(AppError::InvalidInput(
                "unsupported editor selection".into(),
            ));
        }
        let supported_editors = ["auto", "code", "codium", "notepad", "system"];
        if self.editor_associations.iter().any(|(extension, editor)| {
            extension.len() > 32
                || !extension.starts_with('.')
                || !extension
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
                || !supported_editors.contains(&editor.as_str())
        }) {
            return Err(AppError::InvalidInput(
                "unsupported per-file editor association".into(),
            ));
        }
        if !matches!(self.terminal.as_str(), "auto" | "wt" | "cmd" | "powershell") {
            return Err(AppError::InvalidInput(
                "unsupported terminal selection".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    pub id: i64,
    pub repo: String,
    pub kind: String,
    pub paths: Vec<String>,
    pub checkpoint: Option<String>,
    pub backup_path: Option<String>,
    pub created_at: String,
    pub restored_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IdentityProfile {
    pub id: i64,
    pub label: String,
    pub name: String,
    pub email: String,
    pub signing_key: Option<String>,
    pub ssh_host: Option<String>,
    pub sign_commits: bool,
}

impl IdentityProfile {
    pub fn validate(&self) -> Result<(), AppError> {
        fn text(value: &str, label: &str, max: usize) -> Result<(), AppError> {
            if value.trim().is_empty() || value.len() > max || value.contains(['\n', '\r', '\0']) {
                return Err(AppError::InvalidInput(format!("invalid {label}")));
            }
            Ok(())
        }
        text(&self.label, "profile label", 80)?;
        text(&self.name, "Git author name", 160)?;
        text(&self.email, "Git author email", 254)?;
        if !self.email.contains('@') || self.email.starts_with('@') || self.email.ends_with('@') {
            return Err(AppError::InvalidInput("invalid Git author email".into()));
        }
        if let Some(value) = self.signing_key.as_deref() {
            text(value, "signing key", 512)?;
        }
        if let Some(value) = self.ssh_host.as_deref() {
            text(value, "SSH host alias", 255)?;
            if value.chars().any(char::is_whitespace) || value.contains('*') || value.contains('?')
            {
                return Err(AppError::InvalidInput(
                    "SSH host alias must be one exact Host entry from ~/.ssh/config".into(),
                ));
            }
        }
        Ok(())
    }
}

pub struct NewRecovery<'a> {
    pub repo: &'a str,
    pub kind: &'a str,
    pub paths: &'a [String],
    pub checkpoint: Option<&'a str>,
    pub backup_path: Option<&'a str>,
}

pub struct Db {
    conn: Mutex<Connection>,
}

fn migrate(conn: &mut Connection) -> Result<(), AppError> {
    let mut version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        let tx = conn.transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS repos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#5f9df6',
                last_opened_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS recoveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo TEXT NOT NULL,
                kind TEXT NOT NULL,
                paths_json TEXT NOT NULL,
                checkpoint TEXT,
                backup_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                restored_at TEXT
            );
            PRAGMA user_version = 1;",
        )?;
        tx.commit()?;
        version = 1;
    }
    if version < 2 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                op_type TEXT NOT NULL,
                repo TEXT NOT NULL,
                cmd TEXT NOT NULL,
                exit INTEGER,
                out TEXT NOT NULL DEFAULT '',
                prev_head TEXT NOT NULL DEFAULT '',
                next_head TEXT NOT NULL DEFAULT '',
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                duration_ms INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'succeeded',
                recovery_id INTEGER
            );",
        )?;
        let columns: Vec<String> = {
            let mut stmt = conn.prepare("PRAGMA table_info(operations)")?;
            let values = stmt
                .query_map([], |row| row.get::<_, String>(1))?
                .collect::<Result<Vec<_>, _>>()?;
            values
        };
        if !columns.iter().any(|value| value == "status") {
            conn.execute(
                "ALTER TABLE operations ADD COLUMN status TEXT NOT NULL DEFAULT 'succeeded'",
                [],
            )?;
        }
        if !columns.iter().any(|value| value == "recovery_id") {
            conn.execute("ALTER TABLE operations ADD COLUMN recovery_id INTEGER", [])?;
        }
        conn.pragma_update(None, "user_version", 2)?;
        version = 2;
    }
    if version < 3 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS identity_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                signing_key TEXT,
                ssh_host TEXT,
                sign_commits INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;
        conn.pragma_update(None, "user_version", 3)?;
    }
    Ok(())
}

impl Db {
    pub fn open(db_path: &Path) -> Result<Self, AppError> {
        let mut conn = Connection::open(db_path)?;
        conn.busy_timeout(std::time::Duration::from_millis(2000))?;
        migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    #[cfg(test)]
    pub fn in_memory() -> Result<Self, AppError> {
        let mut conn = Connection::open_in_memory()?;
        migrate(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn add_repo(&self, name: &str, path: &str, color: &str) -> Result<RepoRecord, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        conn.execute(
            "INSERT INTO repos (name, path, color) VALUES (?1, ?2, ?3)
             ON CONFLICT(path) DO UPDATE SET last_opened_at = datetime('now')",
            rusqlite::params![name, path, color],
        )?;
        conn.query_row(
            "SELECT id, name, path, color, last_opened_at FROM repos WHERE path = ?1",
            [path],
            |r| {
                Ok(RepoRecord {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    path: r.get(2)?,
                    color: r.get(3)?,
                    last_opened_at: r.get(4)?,
                })
            },
        )
        .map_err(AppError::from)
    }

    pub fn remove_repo(&self, id: i64) -> Result<(), AppError> {
        self.conn
            .lock()
            .expect("db mutex poisoned")
            .execute("DELETE FROM repos WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn update_repo_color(&self, id: i64, color: &str) -> Result<(), AppError> {
        if color.len() != 7
            || !color.starts_with('#')
            || !color[1..].chars().all(|value| value.is_ascii_hexdigit())
        {
            return Err(AppError::InvalidInput("invalid repository color".into()));
        }
        let changed = self.conn.lock().expect("db mutex poisoned").execute(
            "UPDATE repos SET color = ?1 WHERE id = ?2",
            rusqlite::params![color, id],
        )?;
        if changed == 0 {
            return Err(AppError::InvalidInput("repository was not found".into()));
        }
        Ok(())
    }

    pub fn touch_repo(&self, id: i64) -> Result<(), AppError> {
        self.conn.lock().expect("db mutex poisoned").execute(
            "UPDATE repos SET last_opened_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }

    pub fn list_repos(&self) -> Result<Vec<RepoRecord>, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, name, path, color, last_opened_at FROM repos ORDER BY last_opened_at DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(RepoRecord {
                id: r.get(0)?,
                name: r.get(1)?,
                path: r.get(2)?,
                color: r.get(3)?,
                last_opened_at: r.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn load_settings(&self) -> Result<AppSettings, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        let json: Option<String> = conn
            .query_row("SELECT json FROM settings WHERE id = 1", [], |r| r.get(0))
            .optional()?;
        match json {
            Some(value) => serde_json::from_str(&value)
                .map_err(|e| AppError::InvalidInput(format!("invalid settings data: {e}"))),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), AppError> {
        settings.validate()?;
        let json = serde_json::to_string(settings)
            .map_err(|e| AppError::InvalidInput(format!("could not encode settings: {e}")))?;
        self.conn.lock().expect("db mutex poisoned").execute(
            "INSERT INTO settings (id, json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = datetime('now')",
            [json],
        )?;
        Ok(())
    }

    pub fn list_identity_profiles(&self) -> Result<Vec<IdentityProfile>, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, label, name, email, signing_key, ssh_host, sign_commits
             FROM identity_profiles ORDER BY label COLLATE NOCASE, id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(IdentityProfile {
                id: row.get(0)?,
                label: row.get(1)?,
                name: row.get(2)?,
                email: row.get(3)?,
                signing_key: row.get(4)?,
                ssh_host: row.get(5)?,
                sign_commits: row.get::<_, i64>(6)? != 0,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn save_identity_profile(
        &self,
        profile: &IdentityProfile,
    ) -> Result<IdentityProfile, AppError> {
        profile.validate()?;
        let conn = self.conn.lock().expect("db mutex poisoned");
        let id = if profile.id > 0 {
            let changed = conn.execute(
                "UPDATE identity_profiles SET label=?1, name=?2, email=?3, signing_key=?4,
                 ssh_host=?5, sign_commits=?6, updated_at=datetime('now') WHERE id=?7",
                rusqlite::params![
                    profile.label.trim(),
                    profile.name.trim(),
                    profile.email.trim(),
                    profile.signing_key.as_deref(),
                    profile.ssh_host.as_deref(),
                    profile.sign_commits as i64,
                    profile.id
                ],
            )?;
            if changed == 0 {
                return Err(AppError::InvalidInput(
                    "identity profile was not found".into(),
                ));
            }
            profile.id
        } else {
            conn.execute(
                "INSERT INTO identity_profiles (label, name, email, signing_key, ssh_host, sign_commits)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![profile.label.trim(), profile.name.trim(), profile.email.trim(), profile.signing_key.as_deref(), profile.ssh_host.as_deref(), profile.sign_commits as i64],
            )?;
            conn.last_insert_rowid()
        };
        Ok(IdentityProfile {
            id,
            label: profile.label.trim().into(),
            name: profile.name.trim().into(),
            email: profile.email.trim().into(),
            signing_key: profile.signing_key.clone(),
            ssh_host: profile.ssh_host.clone(),
            sign_commits: profile.sign_commits,
        })
    }

    pub fn identity_profile(&self, id: i64) -> Result<IdentityProfile, AppError> {
        self.list_identity_profiles()?
            .into_iter()
            .find(|profile| profile.id == id)
            .ok_or_else(|| AppError::InvalidInput("identity profile was not found".into()))
    }

    pub fn delete_identity_profile(&self, id: i64) -> Result<(), AppError> {
        let changed = self
            .conn
            .lock()
            .expect("db mutex poisoned")
            .execute("DELETE FROM identity_profiles WHERE id=?1", [id])?;
        if changed == 0 {
            return Err(AppError::InvalidInput(
                "identity profile was not found".into(),
            ));
        }
        Ok(())
    }

    pub fn create_recovery(&self, recovery: NewRecovery<'_>) -> Result<i64, AppError> {
        let paths_json = serde_json::to_string(recovery.paths)
            .map_err(|e| AppError::InvalidInput(format!("could not encode recovery paths: {e}")))?;
        let conn = self.conn.lock().expect("db mutex poisoned");
        conn.execute(
            "INSERT INTO recoveries (repo, kind, paths_json, checkpoint, backup_path) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![recovery.repo, recovery.kind, paths_json, recovery.checkpoint, recovery.backup_path],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_recoveries(&self, repo: Option<&str>) -> Result<Vec<RecoveryEntry>, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, repo, kind, paths_json, checkpoint, backup_path, created_at, restored_at FROM recoveries WHERE (?1 IS NULL OR repo = ?1) ORDER BY id DESC LIMIT 200",
        )?;
        let rows = stmt.query_map([repo], |r| {
            let paths_json: String = r.get(3)?;
            Ok(RecoveryEntry {
                id: r.get(0)?,
                repo: r.get(1)?,
                kind: r.get(2)?,
                paths: serde_json::from_str(&paths_json).unwrap_or_default(),
                checkpoint: r.get(4)?,
                backup_path: r.get(5)?,
                created_at: r.get(6)?,
                restored_at: r.get(7)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn recovery(&self, id: i64) -> Result<RecoveryEntry, AppError> {
        let conn = self.conn.lock().expect("db mutex poisoned");
        conn.query_row(
            "SELECT id, repo, kind, paths_json, checkpoint, backup_path, created_at, restored_at FROM recoveries WHERE id = ?1",
            [id],
            |r| {
                let paths_json: String = r.get(3)?;
                Ok(RecoveryEntry { id: r.get(0)?, repo: r.get(1)?, kind: r.get(2)?, paths: serde_json::from_str(&paths_json).unwrap_or_default(), checkpoint: r.get(4)?, backup_path: r.get(5)?, created_at: r.get(6)?, restored_at: r.get(7)? })
            },
        ).optional()?.ok_or_else(|| AppError::InvalidInput(format!("recovery entry {id} does not exist")))
    }

    pub fn mark_recovery_restored(&self, id: i64) -> Result<(), AppError> {
        self.conn.lock().expect("db mutex poisoned").execute(
            "UPDATE recoveries SET restored_at = datetime('now') WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_list_remove_roundtrip() {
        let db = Db::in_memory().unwrap();
        let a = db
            .add_repo("backend-api", "/code/backend-api", "#5f9df6")
            .unwrap();
        db.add_repo("web-app", "/code/web-app", "#34c0a2").unwrap();
        assert_eq!(db.list_repos().unwrap().len(), 2);
        db.remove_repo(a.id).unwrap();
        assert_eq!(db.list_repos().unwrap()[0].name, "web-app");
    }

    #[test]
    fn duplicate_path_updates_instead_of_failing() {
        let db = Db::in_memory().unwrap();
        db.add_repo("a", "/same/path", "#fff").unwrap();
        let again = db.add_repo("a", "/same/path", "#fff").unwrap();
        assert_eq!(db.list_repos().unwrap().len(), 1);
        assert!(again.id > 0);
    }

    #[test]
    fn repository_color_update_is_validated_and_persisted() {
        let db = Db::in_memory().unwrap();
        let repo = db.add_repo("app", "/code/app", "#34c0a2").unwrap();
        db.update_repo_color(repo.id, "#a98bf2").unwrap();
        assert_eq!(db.list_repos().unwrap()[0].color, "#a98bf2");
        assert!(db.update_repo_color(repo.id, "red").is_err());
        assert!(db.update_repo_color(999, "#ffffff").is_err());
    }

    #[test]
    fn settings_and_recoveries_roundtrip() {
        let db = Db::in_memory().unwrap();
        let version: i64 = db
            .conn
            .lock()
            .unwrap()
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 3);
        let settings = AppSettings {
            theme: "light".into(),
            language: "pl".into(),
            ..AppSettings::default()
        };
        db.save_settings(&settings).unwrap();
        assert_eq!(db.load_settings().unwrap(), settings);
        let paths = vec!["src/file.txt".to_string()];
        let id = db
            .create_recovery(NewRecovery {
                repo: "/repo",
                kind: "tracked",
                paths: &paths,
                checkpoint: Some("abc123"),
                backup_path: None,
            })
            .unwrap();
        assert_eq!(db.recovery(id).unwrap().paths, paths);
        db.mark_recovery_restored(id).unwrap();
        assert!(db.recovery(id).unwrap().restored_at.is_some());
    }

    #[test]
    fn settings_reject_unknown_language() {
        let db = Db::in_memory().unwrap();
        let settings = AppSettings {
            language: "xx".into(),
            ..AppSettings::default()
        };
        assert!(db.save_settings(&settings).is_err());
    }

    #[test]
    fn identity_profiles_are_validated_and_persisted() {
        let db = Db::in_memory().unwrap();
        let saved = db
            .save_identity_profile(&IdentityProfile {
                id: 0,
                label: "Personal".into(),
                name: "Ada Lovelace".into(),
                email: "ada@example.com".into(),
                signing_key: Some("ABC123".into()),
                ssh_host: Some("github-personal".into()),
                sign_commits: true,
            })
            .unwrap();
        assert!(saved.id > 0);
        assert_eq!(
            db.identity_profile(saved.id).unwrap().email,
            "ada@example.com"
        );
        db.delete_identity_profile(saved.id).unwrap();
        assert!(db.list_identity_profiles().unwrap().is_empty());
        assert!(db
            .save_identity_profile(&IdentityProfile {
                email: "invalid".into(),
                ..saved
            })
            .is_err());
    }
}
