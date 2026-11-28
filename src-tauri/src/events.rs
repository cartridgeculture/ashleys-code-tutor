//! Sends events to the page: ACT.native.receive({kind, ...}).

use serde_json::Value;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: AppHandle) {
    let _ = APP.set(app);
}

/// `event` is a JSON object with a "kind" field, e.g. {"kind": "run.out", "runId": 3, "text": "hi"}.
pub fn emit(event: Value) {
    if let Some(app) = APP.get() {
        let _ = app.emit("act", event);
    }
}
