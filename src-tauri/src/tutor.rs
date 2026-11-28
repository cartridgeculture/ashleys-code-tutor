//! Talks to Claude through the Claude Code command-line tool, which is signed in to the user's
//! Claude plan (the same way AIM does). Each tutor reply is one `claude -p` run that resumes the
//! track's conversation, streaming its text back to the page.

use crate::{events, store, system};
use regex::RegexBuilder;
use serde_json::{json, Map, Value};
use shared_child::SharedChild;
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const LOOKUP_TOOLS: [&str; 3] = ["Read", "Grep", "Glob"];
const WEB_TOOLS: [&str; 2] = ["WebSearch", "WebFetch"];

static PROCESSES: Mutex<Option<HashMap<String, Arc<SharedChild>>>> = Mutex::new(None);
static STOPPED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

fn emit(id: &str, kind: &str, extra: Value) {
    let mut ev = json!({ "kind": kind, "id": id });
    if let (Some(obj), Value::Object(more)) = (ev.as_object_mut(), extra) {
        obj.extend(more);
    }
    events::emit(ev);
}

// ---------- finding the CLI and signing in ----------

pub fn find_cli() -> Option<PathBuf> {
    let home = system::home();
    let mut candidates = vec![
        home.join(".local/bin/claude"),
        home.join(".claude/local/claude"),
        PathBuf::from("/opt/homebrew/bin/claude"),
        PathBuf::from("/usr/local/bin/claude"),
        home.join(".npm-global/bin/claude"),
    ];
    if cfg!(windows) {
        candidates = vec![home.join(".local/bin/claude.exe"), home.join("AppData/Roaming/npm/claude.cmd")];
    }
    if let Some(hit) = candidates.into_iter().find(|p| system::is_executable(p)) {
        return Some(hit);
    }
    // Apps started from the Dock don't get the shell's PATH, so ask a login shell.
    #[cfg(unix)]
    {
        let out = Command::new("/bin/zsh").args(["-lc", "command -v claude"]).stderr(Stdio::null()).output().ok()?;
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let p = PathBuf::from(&s);
        if !s.is_empty() && system::is_executable(&p) {
            return Some(p);
        }
    }
    #[cfg(windows)]
    {
        let out = Command::new("where").arg("claude").output().ok()?;
        let s = String::from_utf8_lossy(&out.stdout).lines().next().unwrap_or("").trim().to_string();
        if !s.is_empty() {
            return Some(PathBuf::from(s));
        }
    }
    None
}

/// The environment minus anything that would make the CLI think it's nested inside another Claude Code session.
fn clean_env(cmd: &mut Command, extra: &[(&str, &str)]) {
    for (key, _) in std::env::vars() {
        if key == "CLAUDECODE" || key.starts_with("CLAUDE_CODE_") || key == "CLAUDE_EFFORT" || key == "ANTHROPIC_BASE_URL" {
            cmd.env_remove(&key);
        }
    }
    #[cfg(unix)]
    {
        let home = system::home();
        let path = std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin:/usr/sbin:/sbin".into());
        cmd.env("PATH", format!("{}/.local/bin:/opt/homebrew/bin:/usr/local/bin:{path}", home.display()));
        cmd.env("HOME", &home);
    }
    for (k, v) in extra {
        cmd.env(k, v);
    }
}

/// Runs a short CLI command and returns (exit code, stdout), giving up after `timeout`.
fn run_quick(path: &PathBuf, args: &[&str], timeout: Duration) -> (i32, String) {
    let mut cmd = Command::new(path);
    cmd.args(args).current_dir(store::tutor_dir()).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    clean_env(&mut cmd, &[]);
    let Ok(child) = SharedChild::spawn(&mut cmd) else { return (-1, String::new()) };
    let child = Arc::new(child);
    let watcher = child.clone();
    thread::spawn(move || {
        let t0 = Instant::now();
        while t0.elapsed() < timeout {
            if let Ok(Some(_)) = watcher.try_wait() {
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
        let _ = watcher.kill();
    });
    let mut out = String::new();
    if let Some(mut stdout) = child.take_stdout() {
        let _ = stdout.read_to_string(&mut out);
    }
    let code = child.wait().ok().and_then(|s| s.code()).unwrap_or(-1);
    (code, out)
}

pub fn status() -> Value {
    let Some(path) = find_cli() else { return json!({ "found": false }) };
    let (_, v) = run_quick(&path, &["--version"], Duration::from_secs(15));
    let version = v.split_whitespace().next().unwrap_or("").to_string();
    let (_, s) = run_quick(&path, &["auth", "status"], Duration::from_secs(15));
    let mut d = json!({ "found": true, "path": path.to_string_lossy(), "version": version });
    if let Some(signed) = serde_json::from_str::<Value>(&s).ok().and_then(|o| o.get("loggedIn").and_then(|v| v.as_bool())) {
        d["signedIn"] = json!(signed);
    }
    d
}

/// `claude auth login` opens the browser; the user approves there and it finishes by itself.
pub fn sign_in() -> bool {
    let Some(path) = find_cli() else { return false };
    run_quick(&path, &["auth", "login"], Duration::from_secs(600));
    status().get("signedIn").and_then(|v| v.as_bool()) == Some(true)
}

// ---------- replies ----------

pub fn send(id: String, args: Map<String, Value>) -> Result<(), String> {
    let path = find_cli().ok_or_else(|| "Claude Code wasn't found. Install it from claude.com/code, then sign in.".to_string())?;
    thread::spawn(move || {
        let _activity = crate::appicon::begin_activity("Tutor is replying");
        run(&id, &path, &args);
    });
    Ok(())
}

pub fn stop(id: &str) {
    STOPPED.lock().unwrap().get_or_insert_with(HashSet::new).insert(id.to_string());
    let p = PROCESSES.lock().unwrap().as_ref().and_then(|m| m.get(id).cloned());
    if let Some(p) = p {
        let _ = p.kill();
    }
}

pub fn stop_all() {
    let all: Vec<String> = PROCESSES.lock().unwrap().as_ref().map(|m| m.keys().cloned().collect()).unwrap_or_default();
    for id in all {
        stop(&id);
    }
}

fn arg_str(a: &Map<String, Value>, key: &str, default: &str) -> String {
    a.get(key).and_then(|v| v.as_str()).unwrap_or(default).to_string()
}

fn run(id: &str, path: &PathBuf, a: &Map<String, Value>) {
    let model = arg_str(a, "model", "claude-opus-5-5");
    let effort = arg_str(a, "effort", "");
    let system_prompt = arg_str(a, "system", "");
    let prompt = arg_str(a, "prompt", "");
    let session_id = arg_str(a, "sessionId", "");
    let resume = a.get("resume").and_then(|v| v.as_bool()).unwrap_or(false);
    let web = a.get("web").and_then(|v| v.as_bool()).unwrap_or(true);

    let mut tools: Vec<&str> = LOOKUP_TOOLS.to_vec();
    if web {
        tools.extend(WEB_TOOLS);
    }
    let tools = tools.join(",");
    let mut args: Vec<String> = [
        "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
        "--safe-mode", "--strict-mcp-config", "--disable-slash-commands",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    args.extend(["--model".into(), model, "--system-prompt".into(), system_prompt]);
    args.extend(["--tools".into(), tools.clone(), "--permission-mode".into(), "dontAsk".into(), "--allowedTools".into(), tools]);
    args.extend(["--max-turns".into(), "16".into()]);
    if !effort.is_empty() {
        args.extend(["--effort".into(), effort]);
    }
    if !session_id.is_empty() {
        args.extend([if resume { "--resume" } else { "--session-id" }.to_string(), session_id.clone()]);
    }

    let mut cmd = Command::new(path);
    cmd.args(&args).current_dir(store::tutor_dir()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    clean_env(&mut cmd, &[("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "32000")]);
    let child = match SharedChild::spawn(&mut cmd) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            emit(id, "tutor.error", json!({ "message": format!("Couldn't start Claude Code: {e}") }));
            return;
        }
    };
    PROCESSES.lock().unwrap().get_or_insert_with(HashMap::new).insert(id.to_string(), child.clone());
    STOPPED.lock().unwrap().get_or_insert_with(HashSet::new).remove(id);

    if let Some(mut stdin) = child.take_stdin() {
        let _ = stdin.write_all(prompt.as_bytes());
    }
    let err_text = Arc::new(Mutex::new(String::new()));
    if let Some(mut stderr) = child.take_stderr() {
        let sink = err_text.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while let Ok(n) = stderr.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let mut s = sink.lock().unwrap();
                if s.len() < 20000 {
                    s.push_str(&String::from_utf8_lossy(&buf[..n]));
                }
            }
        });
    }

    let mut text = String::new();
    let mut messages = 0;
    let mut last_emit = Instant::now() - Duration::from_secs(1);
    let mut tool_name = String::new();
    let mut tool_json = String::new();
    let mut result_error: Option<String> = None;
    let mut usage = Value::Object(Map::new());
    let mut model_used = String::new();
    let mut new_session = session_id.clone();

    if let Some(stdout) = child.take_stdout() {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            let Ok(obj) = serde_json::from_str::<Value>(&line) else { continue };
            let Some(kind) = obj.get("type").and_then(|v| v.as_str()) else { continue };
            if let Some(sid) = obj.get("session_id").and_then(|v| v.as_str()) {
                if !sid.is_empty() {
                    new_session = sid.to_string();
                }
            }
            match kind {
                "stream_event" => {
                    let Some(ev) = obj.get("event") else { continue };
                    match ev.get("type").and_then(|v| v.as_str()).unwrap_or("") {
                        "message_start" => {
                            messages += 1;
                            if let Some(m) = ev.pointer("/message/model").and_then(|v| v.as_str()) {
                                model_used = m.to_string();
                            }
                            if messages > 1 && !text.is_empty() && !text.ends_with("\n\n") {
                                text.push_str(if text.ends_with('\n') { "\n" } else { "\n\n" });
                            }
                        }
                        "content_block_start" => {
                            let bt = ev.pointer("/content_block/type").and_then(|v| v.as_str()).unwrap_or("");
                            if bt == "thinking" {
                                emit(id, "tutor.status", json!({ "status": "thinking" }));
                            }
                            if bt == "tool_use" || bt == "server_tool_use" {
                                tool_name = ev.pointer("/content_block/name").and_then(|v| v.as_str()).unwrap_or("tool").to_string();
                                tool_json.clear();
                            }
                            if bt == "text" {
                                emit(id, "tutor.status", json!({ "status": "writing" }));
                            }
                        }
                        "content_block_delta" => {
                            let Some(delta) = ev.get("delta") else { continue };
                            match delta.get("type").and_then(|v| v.as_str()).unwrap_or("") {
                                "text_delta" => {
                                    text.push_str(delta.get("text").and_then(|v| v.as_str()).unwrap_or(""));
                                    if last_emit.elapsed() > Duration::from_millis(50) {
                                        last_emit = Instant::now();
                                        emit(id, "tutor.delta", json!({ "text": text }));
                                    }
                                }
                                "input_json_delta" => tool_json.push_str(delta.get("partial_json").and_then(|v| v.as_str()).unwrap_or("")),
                                _ => {}
                            }
                        }
                        "content_block_stop" => {
                            if !tool_name.is_empty() {
                                let input: Value = serde_json::from_str(&tool_json).unwrap_or(Value::Null);
                                let detail = ["file_path", "pattern", "query", "url"]
                                    .iter()
                                    .find_map(|k| input.get(*k).and_then(|v| v.as_str()))
                                    .unwrap_or("");
                                emit(id, "tutor.tool", json!({ "name": tool_name, "detail": detail }));
                                tool_name.clear();
                            }
                        }
                        _ => {}
                    }
                }
                "result" => {
                    if let Some(u) = obj.get("usage") {
                        usage = u.clone();
                    }
                    let subtype = obj.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
                    if obj.get("is_error").and_then(|v| v.as_bool()) == Some(true) || subtype.starts_with("error") {
                        result_error = Some(
                            obj.get("result").and_then(|v| v.as_str()).map(String::from)
                                .or_else(|| obj.get("errors").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str()).collect::<Vec<_>>().join("; ")))
                                .unwrap_or_else(|| format!("Claude Code reported an error ({subtype}).")),
                        );
                    }
                    if text.is_empty() && result_error.is_none() {
                        if let Some(r) = obj.get("result").and_then(|v| v.as_str()) {
                            text = r.to_string();
                        }
                    }
                }
                _ => {}
            }
        }
    }
    let status = child.wait();
    PROCESSES.lock().unwrap().as_mut().map(|m| m.remove(id));
    let was_stopped = STOPPED.lock().unwrap().as_mut().map(|s| s.remove(id)).unwrap_or(false);
    thread::sleep(Duration::from_millis(50));
    let err_string = err_text.lock().unwrap().clone();

    if was_stopped {
        emit(id, "tutor.done", json!({ "text": text, "stopped": true, "sessionId": new_session, "model": model_used }));
        return;
    }
    let code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
    let problem = result_error.or_else(|| if text.is_empty() { Some(err_string.trim().to_string()) } else { None });
    if let Some(e) = problem {
        if !e.is_empty() || text.is_empty() {
            let all = format!("{e} {err_string}");
            let matches = |pat: &str| RegexBuilder::new(pat).case_insensitive(true).build().map(|r| r.is_match(&all)).unwrap_or(false);
            let code_name = if matches("No conversation found|session.*not found") {
                "session-missing"
            } else if matches("not logged in|/login|invalid api key|oauth|authenticat") {
                "signed-out"
            } else if matches("overloaded|rate limit|529|usage limit|limit reached") {
                "busy"
            } else {
                ""
            };
            let message = if e.is_empty() { format!("Claude Code stopped without a reply ({code}).") } else { e };
            emit(id, "tutor.error", json!({ "message": message, "code": code_name, "partial": text }));
            return;
        }
    }
    emit(id, "tutor.delta", json!({ "text": text }));
    emit(id, "tutor.done", json!({ "text": text, "sessionId": new_session, "model": model_used, "usage": usage }));
}
