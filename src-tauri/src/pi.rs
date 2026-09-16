use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};

use chrono::{DateTime, Utc};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

fn pi_binary() -> String {
    std::env::var("PI_BIN").unwrap_or_else(|_| "pi".to_string())
}

fn session_dir(id: &str) -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    std::path::PathBuf::from(home)
        .join(".darwin")
        .join("sessions")
        .join(id)
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub cwd: String,
    pub created_at: DateTime<Utc>,
    pub alive: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PiEventPayload {
    pub session_id: String,
    pub seq: usize,
    pub event: serde_json::Value,
}

struct SessionInner {
    stdin: ChildStdin,
    child: Child,
    cwd: String,
    created_at: DateTime<Utc>,
    events: Vec<serde_json::Value>,
    alive: bool,
}

#[derive(Clone, Default)]
pub struct PiRegistry {
    inner: Arc<Mutex<HashMap<String, Arc<Mutex<SessionInner>>>>>,
}

impl PiRegistry {
    pub fn create_session(&self, app: &AppHandle, cwd: Option<String>) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string()[..8].to_string();
        let cwd = cwd.unwrap_or_else(|| {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| "/tmp".to_string())
        });
        let dir = session_dir(&id);
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        let mut child = Command::new(pi_binary())
            .args(["--mode", "rpc", "--session-dir", &dir.to_string_lossy()])
            .current_dir(&cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("failed to spawn pi (is it on PATH?): {e}"))?;

        let stdin: ChildStdin = child.stdin.take().ok_or("no stdin")?;
        let stdout: ChildStdout = child.stdout.take().ok_or("no stdout")?;

        let handle = Arc::new(Mutex::new(SessionInner {
            stdin,
            child,
            cwd: cwd.clone(),
            created_at: Utc::now(),
            events: Vec::new(),
            alive: true,
        }));

        // Reader thread: LF-delimited JSON only. Never use split-on-unicode readers.
        let thread_handle = Arc::clone(&handle);
        let app_handle = app.clone();
        let session_id = id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                // Strict JSONL: strip one trailing \r, skip empties.
                let line = line.strip_suffix('\r').unwrap_or(&line);
                if line.trim().is_empty() {
                    continue;
                }
                let value: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let seq = {
                    let mut h = thread_handle.lock().unwrap();
                    h.events.push(value.clone());
                    h.events.len() - 1
                };
                let _ = app_handle.emit(
                    "pi-event",
                    PiEventPayload {
                        session_id: session_id.clone(),
                        seq,
                        event: value,
                    },
                );
            }
            // stdout closed -> mark dead
            if let Ok(mut h) = thread_handle.lock() {
                h.alive = false;
            }
        });

        self.inner
            .lock()
            .map_err(|e| e.to_string())?
            .insert(id.clone(), handle);
        Ok(id)
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionInfo>, String> {
        let map = self.inner.lock().map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for (id, h) in map.iter() {
            let h = h.lock().map_err(|e| e.to_string())?;
            // liveness: check child still running via try_wait without blocking
            out.push(SessionInfo {
                id: id.clone(),
                cwd: h.cwd.clone(),
                created_at: h.created_at,
                alive: h.alive,
            });
        }
        out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(out)
    }

    fn write_json(&self, session_id: &str, value: serde_json::Value) -> Result<(), String> {
        let map = self.inner.lock().map_err(|e| e.to_string())?;
        let handle = map.get(session_id).ok_or("unknown session")?.clone();
        drop(map);
        let mut h = handle.lock().map_err(|e| e.to_string())?;
        let mut line = serde_json::to_string(&value).map_err(|e| e.to_string())?;
        line.push('\n');
        h.stdin
            .write_all(line.as_bytes())
            .map_err(|e| e.to_string())?;
        h.stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn prompt(&self, session_id: &str, message: &str) -> Result<String, String> {
        let req_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
        // If agent is streaming, pi requires streamingBehavior; default to steer
        // so follow-up questions queue instead of erroring.
        let v = serde_json::json!({
            "id": req_id,
            "type": "prompt",
            "message": message,
            "streamingBehavior": "steer",
        });
        self.write_json(session_id, v)?;
        Ok(req_id)
    }

    pub fn steer(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.write_json(
            session_id,
            serde_json::json!({ "type": "steer", "message": message }),
        )
    }

    pub fn follow_up(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.write_json(
            session_id,
            serde_json::json!({ "type": "follow_up", "message": message }),
        )
    }

    pub fn abort(&self, session_id: &str) -> Result<(), String> {
        self.write_json(session_id, serde_json::json!({ "type": "abort" }))
    }

    pub fn get_events(
        &self,
        session_id: &str,
        after: usize,
    ) -> Result<Vec<serde_json::Value>, String> {
        let map = self.inner.lock().map_err(|e| e.to_string())?;
        let handle = map.get(session_id).ok_or("unknown session")?.clone();
        drop(map);
        let h = handle.lock().map_err(|e| e.to_string())?;
        Ok(h.events.iter().skip(after).cloned().collect())
    }

    pub fn destroy(&self, session_id: &str) -> Result<(), String> {
        let handle = self
            .inner
            .lock()
            .map_err(|e| e.to_string())?
            .remove(session_id)
            .ok_or("unknown session")?;
        if let Ok(mut h) = handle.lock() {
            h.alive = false;
            let _ = h.child.kill();
        }
        Ok(())
    }
}


