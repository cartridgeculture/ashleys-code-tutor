//! The page's one door into the app: ACT.native.call(cmd, args) → invoke("bridge", {cmd, args}).
//! Every reply is JSON; errors reject the page's promise with a message.

use crate::{appicon, runner, store, system, tutor};
use base64::Engine;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Build number shown in About (the version comes from tauri.conf.json).
pub const BUILD: &str = "7";

#[tauri::command]
pub async fn bridge(app: AppHandle, cmd: String, args: Value) -> Result<Value, String> {
    let a = args.as_object().cloned().unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || handle(&app, &cmd, &a))
        .await
        .map_err(|e| e.to_string())?
}

fn handle(app: &AppHandle, cmd: &str, a: &Map<String, Value>) -> Result<Value, String> {
    let s = |key: &str| -> Result<String, String> {
        a.get(key).and_then(|v| v.as_str()).map(String::from).ok_or_else(|| format!("Missing {key}"))
    };
    let opt = |key: &str| a.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string();
    match cmd {
        // Files in the data folder (paths are relative to it).
        "store.read" => Ok(store::read(&s("path")?).map(Value::from).unwrap_or(Value::Null)),
        "store.write" => {
            store::write(&s("path")?, &s("text")?)?;
            Ok(json!(true))
        }
        "store.list" => Ok(json!(store::list(&s("path")?))),
        "store.remove" => {
            store::remove(&s("path")?)?;
            Ok(json!(true))
        }
        "store.reveal" => {
            store::reveal(&opt("path"));
            Ok(json!(true))
        }

        // Building and running the learner's code.
        "run.start" => {
            let files = a.get("files").and_then(|v| v.as_object()).cloned().unwrap_or_default();
            let mode = a.get("mode").and_then(|v| v.as_str()).unwrap_or("run");
            Ok(json!(runner::start(&s("track")?, &s("lang")?, &files, mode)?))
        }
        "run.stdin" => {
            runner::send(&s("text")?);
            Ok(json!(true))
        }
        "run.stop" => {
            runner::stop();
            Ok(json!(true))
        }
        "run.tools" => Ok(runner::tool_status()),

        // The tutor (Claude Code CLI on the user's Claude plan).
        "tutor.send" => {
            tutor::send(s("id")?, a.clone())?;
            Ok(json!(true))
        }
        "tutor.stop" => {
            tutor::stop(&s("id")?);
            Ok(json!(true))
        }
        "claude.status" => Ok(tutor::status()),
        "claude.signIn" => Ok(json!(tutor::sign_in())),

        // The app itself.
        "app.openURL" => {
            system::open_url(&s("url")?);
            Ok(json!(true))
        }
        "app.version" => Ok(json!(app.package_info().version.to_string())),
        "app.info" => Ok(json!({ "version": app.package_info().version.to_string(), "build": BUILD })),
        "app.setTitle" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title(&s("title")?);
            }
            Ok(json!(true))
        }
        "app.setIcon" => {
            let save = a.get("save").and_then(|v| v.as_bool()).unwrap_or(false);
            let png = if a.get("original").and_then(|v| v.as_bool()) == Some(true) {
                Some(appicon::original_bytes().ok_or("The original icon is missing")?)
            } else {
                let b64 = opt("png");
                if b64.is_empty() {
                    None
                } else {
                    Some(base64::engine::general_purpose::STANDARD.decode(b64).map_err(|_| "Bad icon".to_string())?)
                }
            };
            Ok(json!(appicon::show(app, png, save)?))
        }
        "app.originalIcon" => Ok(appicon::original_base64().map(Value::from).unwrap_or(Value::Null)),
        // Preferences > Choose Avatar: a picture file, returned as a data URL (null if cancelled).
        "app.pickImage" => {
            let picked = app
                .dialog()
                .file()
                .set_title("Choose a picture for your avatar")
                .add_filter("Pictures", &["png", "jpg", "jpeg", "gif", "webp", "heic"])
                .blocking_pick_file();
            let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(Value::Null) };
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
            let mime = match ext.as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "heic" => "image/heic",
                _ => "image/png",
            };
            Ok(json!(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))))
        }
        // The page saved its files after a quit request: finish quitting.
        "app.quitNow" => {
            crate::quit_now(app);
            Ok(json!(true))
        }
        "debug.log" => {
            if system::dev_mode() {
                eprintln!("[page] {}", opt("text"));
            }
            Ok(json!(true))
        }
        _ => Err(format!("Unknown command {cmd}")),
    }
}
