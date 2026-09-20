//! Progress and cancellation for long-running Git network operations.

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::Path;
#[cfg(not(target_os = "windows"))]
use std::process::Command;
use std::process::Stdio;
use std::sync::Mutex;

use serde::Serialize;
use tauri::Emitter;

use crate::error::AppError;
use crate::git;
use crate::oplog::OpLog;
use crate::ops::OpResult;
use crate::queue::RepoLocks;

const MAX_CAPTURED_OUTPUT: usize = 1024 * 1024;
const MAX_PROGRESS_LINE: usize = 16 * 1024;

fn append_bounded(target: &mut Vec<u8>, input: &[u8], limit: usize) -> bool {
    let available = limit.saturating_sub(target.len());
    target.extend_from_slice(&input[..input.len().min(available)]);
    input.len() > available
}

#[derive(Default)]
pub struct OperationManager {
    pids: Mutex<HashMap<i64, u32>>,
    cancelled: Mutex<HashSet<i64>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationProgress {
    pub operation_id: i64,
    pub repository: String,
    pub phase: String,
    pub stream: String,
    pub message: String,
}

impl OperationManager {
    fn register(&self, operation_id: i64, pid: u32) {
        self.pids
            .lock()
            .expect("operation manager poisoned")
            .insert(operation_id, pid);
    }

    fn finish(&self, operation_id: i64) -> bool {
        self.pids
            .lock()
            .expect("operation manager poisoned")
            .remove(&operation_id);
        self.cancelled
            .lock()
            .expect("operation manager poisoned")
            .remove(&operation_id)
    }

    pub fn cancel(&self, operation_id: i64) -> Result<(), AppError> {
        let pid = self
            .pids
            .lock()
            .expect("operation manager poisoned")
            .get(&operation_id)
            .copied()
            .ok_or_else(|| {
                AppError::InvalidInput(format!("operation {operation_id} is not running"))
            })?;
        self.cancelled
            .lock()
            .expect("operation manager poisoned")
            .insert(operation_id);
        #[cfg(target_os = "windows")]
        let status = git::background_command("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()?;
        #[cfg(not(target_os = "windows"))]
        let status = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()?;
        if !status.success() {
            return Err(AppError::InvalidInput(format!(
                "could not cancel operation {operation_id}"
            )));
        }
        Ok(())
    }
}

impl Drop for OperationManager {
    fn drop(&mut self) {
        let pids: Vec<u32> = self
            .pids
            .get_mut()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .values()
            .copied()
            .collect();
        for pid in pids {
            #[cfg(target_os = "windows")]
            let _ = git::background_command("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .status();
            #[cfg(not(target_os = "windows"))]
            let _ = Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .status();
        }
    }
}

fn read_stream<R: Read + Send + 'static>(
    mut reader: R,
    app: tauri::AppHandle,
    operation_id: i64,
    repository: String,
    stream: &'static str,
) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut complete = Vec::new();
        let mut pending = Vec::new();
        let mut output_truncated = false;
        let mut line_truncated = false;
        let mut buffer = [0_u8; 1024];
        loop {
            let read = match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(value) => value,
            };
            output_truncated |= append_bounded(&mut complete, &buffer[..read], MAX_CAPTURED_OUTPUT);
            for byte in &buffer[..read] {
                if matches!(byte, b'\n' | b'\r') {
                    if !pending.is_empty() {
                        let mut message = crate::redact::redact(&String::from_utf8_lossy(&pending));
                        if line_truncated {
                            message.push_str(" … progress line truncated …");
                        }
                        let _ = app.emit(
                            "operation-progress",
                            OperationProgress {
                                operation_id,
                                repository: repository.clone(),
                                phase: "output".into(),
                                stream: stream.into(),
                                message,
                            },
                        );
                        pending.clear();
                        line_truncated = false;
                    }
                } else {
                    line_truncated |= append_bounded(&mut pending, &[*byte], MAX_PROGRESS_LINE);
                }
            }
        }
        if !pending.is_empty() {
            let mut message = crate::redact::redact(&String::from_utf8_lossy(&pending));
            if line_truncated {
                message.push_str(" … progress line truncated …");
            }
            let _ = app.emit(
                "operation-progress",
                OperationProgress {
                    operation_id,
                    repository,
                    phase: "output".into(),
                    stream: stream.into(),
                    message,
                },
            );
        }
        let mut value = String::from_utf8_lossy(&complete).to_string();
        if output_truncated {
            value.push_str("\n… output capture truncated …");
        }
        value
    })
}

pub fn run_remote_mutation(
    app: tauri::AppHandle,
    manager: &OperationManager,
    locks: &RepoLocks,
    oplog: &OpLog,
    repo: &Path,
    op_type: &str,
    args: &[&str],
) -> Result<OpResult, AppError> {
    let repository = repo.display().to_string();
    let lock = locks.lock_for(&repository);
    let _guard = lock.lock().expect("repo lock poisoned");
    let previous_head = git::head_sha(repo);
    let command = format!("git {}", args.join(" "));
    let operation_id = oplog.start(op_type, &repository, &command, &previous_head)?;
    let started = std::time::Instant::now();

    let _ = app.emit(
        "operation-progress",
        OperationProgress {
            operation_id,
            repository: repository.clone(),
            phase: "started".into(),
            stream: "system".into(),
            message: op_type.into(),
        },
    );
    let mut child = match git::background_command("git")
        .current_dir(repo)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            oplog.finish(
                operation_id,
                Some(-1),
                &error.to_string(),
                &previous_head,
                0,
                None,
            )?;
            return Err(AppError::Io(error));
        }
    };
    manager.register(operation_id, child.id());
    let stdout_handle = read_stream(
        child.stdout.take().expect("stdout was piped"),
        app.clone(),
        operation_id,
        repository.clone(),
        "stdout",
    );
    let stderr_handle = read_stream(
        child.stderr.take().expect("stderr was piped"),
        app.clone(),
        operation_id,
        repository.clone(),
        "stderr",
    );
    let status = child.wait()?;
    let stdout = stdout_handle.join().unwrap_or_default();
    let stderr = stderr_handle.join().unwrap_or_default();
    let cancelled = manager.finish(operation_id);
    let duration_ms = started.elapsed().as_millis() as i64;
    let resulting_head = git::head_sha(repo);
    let combined = if stdout.is_empty() {
        stderr.clone()
    } else if stderr.is_empty() {
        stdout.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };
    let exit_code = status.code().unwrap_or(-1);
    oplog.finish(
        operation_id,
        if cancelled { None } else { Some(exit_code) },
        &combined,
        &resulting_head,
        duration_ms,
        None,
    )?;
    let result_status = if cancelled {
        "cancelled"
    } else if status.success() {
        "succeeded"
    } else {
        "failed"
    };
    let _ = app.emit(
        "operation-progress",
        OperationProgress {
            operation_id,
            repository,
            phase: result_status.into(),
            stream: "system".into(),
            message: result_status.into(),
        },
    );

    Ok(OpResult {
        operation_id,
        status: result_status.into(),
        command: crate::redact::redact(&command),
        success: status.success() && !cancelled,
        exit_code,
        stdout: crate::redact::redact(&stdout),
        stderr: crate::redact::redact(&stderr),
        previous_head,
        resulting_head,
        duration_ms,
        recovery_id: None,
    })
}

#[cfg(test)]
mod tests {
    use super::{append_bounded, OperationManager};
    #[cfg(not(target_os = "windows"))]
    use std::process::Command;
    use std::process::Stdio;

    #[test]
    fn captured_output_is_bounded_without_stopping_the_reader() {
        let mut output = b"abc".to_vec();
        assert!(append_bounded(&mut output, b"defgh", 5));
        assert_eq!(output, b"abcde");
        assert!(append_bounded(&mut output, b"more", 5));
        assert_eq!(output.len(), 5);
    }

    #[test]
    fn cancellation_terminates_and_marks_a_running_process() {
        #[cfg(target_os = "windows")]
        let mut command = {
            let mut value = crate::git::background_command("powershell");
            value.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 30"]);
            value
        };
        #[cfg(not(target_os = "windows"))]
        let mut command = {
            let mut value = Command::new("sh");
            value.args(["-c", "sleep 30"]);
            value
        };
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let mut child = command.spawn().unwrap();
        let manager = OperationManager::default();
        manager.register(77, child.id());
        manager.cancel(77).unwrap();
        let _ = child.wait();
        assert!(manager.finish(77));
    }
}
