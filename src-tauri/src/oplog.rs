//! Operation log: every mutating git command the app runs is recorded here,
//! with redacted output and enough metadata (prev/next HEAD) for recovery.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;

use crate::error::AppError;

const MAX_LOG_OUTPUT: usize = 64 * 1024;

fn bounded(value: &str) -> String {
    let redacted = crate::redact::redact(value);
    if redacted.len() <= MAX_LOG_OUTPUT {
        return redacted;
    }
    let mut end = MAX_LOG_OUTPUT;
    while !redacted.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n… output truncated …", &redacted[..end])
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpEntry {
    pub id: i64,
    pub op_type: String,
    pub repo: String,
    pub cmd: String,
    pub exit: Option<i32>,
    pub out: String,
    pub prev_head: String,
    pub next_head: String,
    pub started_at: String,
    pub duration_ms: i64,
    pub status: String,
    pub recovery_id: Option<i64>,
}

pub struct OpLog {
    conn: Mutex<Connection>,
}

pub struct OpRecord<'a> {
    pub op_type: &'a str,
    pub repo: &'a str,
    pub cmd: &'a str,
    pub exit: Option<i32>,
    pub out: &'a str,
    pub prev_head: &'a str,
    pub next_head: &'a str,
    pub duration_ms: i64,
}

impl OpLog {
    pub fn open(db_path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;
        conn.busy_timeout(std::time::Duration::from_millis(2000))?;
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
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// In-memory log for tests.
    #[cfg(test)]
    pub fn in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
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
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Record an operation. Output is redacted before it is stored.
    pub fn record(&self, record: OpRecord<'_>) -> Result<i64, AppError> {
        let id = self.start(record.op_type, record.repo, record.cmd, record.prev_head)?;
        self.finish(
            id,
            record.exit,
            record.out,
            record.next_head,
            record.duration_ms,
            None,
        )?;
        Ok(id)
    }

    pub fn start(
        &self,
        op_type: &str,
        repo: &str,
        cmd: &str,
        prev_head: &str,
    ) -> Result<i64, AppError> {
        let conn = self.conn.lock().expect("oplog mutex poisoned");
        conn.execute(
            "INSERT INTO operations (op_type, repo, cmd, prev_head, next_head, status)
             VALUES (?1, ?2, ?3, ?4, ?4, 'running')",
            rusqlite::params![op_type, repo, crate::redact::redact(cmd), prev_head,],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn finish(
        &self,
        id: i64,
        exit: Option<i32>,
        out: &str,
        next_head: &str,
        duration_ms: i64,
        recovery_id: Option<i64>,
    ) -> Result<(), AppError> {
        let status = match exit {
            Some(0) => "succeeded",
            Some(_) => "failed",
            None => "cancelled",
        };
        self.conn.lock().expect("oplog mutex poisoned").execute(
            "UPDATE operations SET exit = ?2, out = ?3, next_head = ?4, duration_ms = ?5,
             status = ?6, recovery_id = ?7 WHERE id = ?1",
            rusqlite::params![
                id,
                exit,
                bounded(out),
                next_head,
                duration_ms,
                status,
                recovery_id
            ],
        )?;
        Ok(())
    }

    /// Associate an already-recorded operation with a recovery point. This is
    /// used when the recovery must be created before the destructive command
    /// can run, while the operation id is only known after that command starts.
    pub fn attach_recovery(&self, operation_id: i64, recovery_id: i64) -> Result<(), AppError> {
        self.conn.lock().expect("oplog mutex poisoned").execute(
            "UPDATE operations SET recovery_id = ?2 WHERE id = ?1",
            rusqlite::params![operation_id, recovery_id],
        )?;
        Ok(())
    }

    pub fn list(&self, limit: u32) -> Result<Vec<OpEntry>, AppError> {
        let conn = self.conn.lock().expect("oplog mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, op_type, repo, cmd, exit, out, prev_head, next_head, started_at, duration_ms, status, recovery_id
             FROM operations ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit], |r| {
            Ok(OpEntry {
                id: r.get(0)?,
                op_type: r.get(1)?,
                repo: r.get(2)?,
                cmd: r.get(3)?,
                exit: r.get(4)?,
                out: r.get(5)?,
                prev_head: r.get(6)?,
                next_head: r.get(7)?,
                started_at: r.get(8)?,
                duration_ms: r.get(9)?,
                status: r.get(10)?,
                recovery_id: r.get(11)?,
            })
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_and_lists_with_redaction() {
        let log = OpLog::in_memory().unwrap();
        log.record(OpRecord {
            op_type: "Push",
            repo: "backend-api",
            cmd: "git push https://user:hunter2@github.com/acme/repo.git",
            exit: Some(0),
            out: "done, used token ghp_secret123",
            prev_head: "aaa",
            next_head: "bbb",
            duration_ms: 1200,
        })
        .unwrap();
        let entries = log.list(10).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(!entries[0].cmd.contains("hunter2"));
        assert!(!entries[0].out.contains("ghp_secret123"));
        assert_eq!(entries[0].op_type, "Push");
    }

    #[test]
    fn records_cancelled_operations_distinctly() {
        let log = OpLog::in_memory().unwrap();
        let id = log.start("Clone", "repo", "git clone remote", "").unwrap();
        log.finish(id, None, "cancelled by user", "", 42, None)
            .unwrap();
        let entry = log.list(1).unwrap().remove(0);
        assert_eq!(entry.status, "cancelled");
        assert_eq!(entry.exit, None);
    }
}
