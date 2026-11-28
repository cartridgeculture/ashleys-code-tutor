//! Builds and runs the learner's C and C++ programs with clang. Programs run attached to a
//! pseudo-terminal (a real terminal on a Mac, ConPTY on Windows), so they behave as in VS Code's
//! terminal: output appears line by line, and typed input is echoed.

use crate::{events, store, system};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use regex::Regex;
use serde_json::{json, Map, Value};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const OUTPUT_LIMIT: usize = 2_000_000;

struct Running {
    id: u64,
    killer: Box<dyn ChildKiller + Send + Sync>,
    writer: Box<dyn Write + Send>,
}

struct State {
    run_id: u64,
    running: Option<Running>,
}

static STATE: Mutex<State> = Mutex::new(State { run_id: 0, running: None });

fn emit(id: u64, kind: &str, extra: Value) {
    let mut ev = json!({ "kind": kind, "runId": id });
    if let (Some(obj), Value::Object(more)) = (ev.as_object_mut(), extra) {
        obj.extend(more);
    }
    events::emit(ev);
}

pub fn clang_path() -> Option<PathBuf> {
    ["/usr/bin/clang", "/Library/Developer/CommandLineTools/usr/bin/clang"]
        .iter()
        .map(PathBuf::from)
        .find(|p| system::is_executable(p))
}

pub fn tool_status() -> Value {
    let Some(clang) = clang_path() else { return json!({ "clang": false }) };
    match Command::new(clang).arg("--version").output() {
        Ok(out) => {
            let s = String::from_utf8_lossy(&out.stdout);
            json!({ "clang": out.status.success(), "clangVersion": s.lines().next().unwrap_or("") })
        }
        Err(_) => json!({ "clang": false }),
    }
}

// ---------- start / stop ----------

pub fn start(track: &str, lang: &str, files: &Map<String, Value>, mode: &str) -> Result<u64, String> {
    if lang != "c" && lang != "cpp" {
        return Err(format!("Running {lang} isn't available yet."));
    }
    let clang = clang_path().ok_or_else(|| {
        "Apple's C compiler wasn't found. Install the Command Line Tools: run xcode-select --install in Terminal.".to_string()
    })?;
    stop();
    let id = {
        let mut s = STATE.lock().unwrap();
        s.run_id += 1;
        s.run_id
    };

    let safe_track: String = track.chars().filter(|c| c.is_alphanumeric() || *c == '-').collect();
    let dir = store::builds_dir().join(safe_track);
    let src = dir.join("src");
    let _ = fs::remove_dir_all(&src);
    fs::create_dir_all(&src).map_err(|e| e.to_string())?;
    let mut sources = vec![];
    for (name, text) in files {
        let clean = Path::new(name).file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        if clean.is_empty() || clean.starts_with('.') {
            continue;
        }
        fs::write(src.join(&clean), text.as_str().unwrap_or("")).map_err(|e| e.to_string())?;
        let ext = Path::new(&clean).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if (lang == "c" && ext == "c") || (lang == "cpp" && ["cpp", "cc", "cxx", "c"].contains(&ext.as_str())) {
            sources.push(clean);
        }
    }
    sources.sort();
    let exe = dir.join("program");
    let _ = fs::remove_file(&exe);

    let lang = lang.to_string();
    let then_run = mode == "run";
    thread::spawn(move || build(id, clang, lang, src, sources, exe, then_run));
    Ok(id)
}

fn build(id: u64, clang: PathBuf, lang: String, dir: PathBuf, sources: Vec<String>, exe: PathBuf, then_run: bool) {
    if sources.is_empty() {
        let what = if lang == "c" { ".c" } else { ".cpp" };
        emit(id, "run.built", json!({ "ok": false, "output": format!("There's no {what} file to build."), "diagnostics": [], "seconds": 0 }));
        emit(id, "run.exit", json!({ "code": -1, "phase": "build" }));
        return;
    }
    let tool = if lang == "c" { "clang" } else { "clang++" };
    emit(id, "run.phase", json!({ "phase": "build", "command": format!("{tool} {}", sources.join(" ")) }));
    let t0 = Instant::now();
    let mut args: Vec<String> = if lang == "c" {
        vec!["-x".into(), "c".into(), "-std=c17".into()]
    } else {
        vec!["-x".into(), "c++".into(), "-std=c++20".into()]
    };
    for a in ["-Wall", "-Wextra", "-g", "-O0", "-fno-color-diagnostics", "-fsanitize=undefined", "-fno-omit-frame-pointer", "-o"] {
        args.push(a.into());
    }
    args.push(exe.to_string_lossy().into_owned());
    args.extend(sources.iter().cloned());
    if lang == "cpp" {
        args.push("-lc++".into());
    }
    let out = match Command::new(&clang).args(&args).current_dir(&dir).output() {
        Ok(o) => o,
        Err(e) => {
            emit(id, "run.built", json!({ "ok": false, "output": format!("Couldn't start the compiler: {e}"), "diagnostics": [], "seconds": 0 }));
            emit(id, "run.exit", json!({ "code": -1, "phase": "build" }));
            return;
        }
    };
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    text.push_str(&String::from_utf8_lossy(&out.stderr));
    let ok = out.status.success();
    emit(id, "run.built", json!({ "ok": ok, "output": text, "diagnostics": parse_diagnostics(&text), "seconds": t0.elapsed().as_secs_f64() }));
    if !ok {
        emit(id, "run.exit", json!({ "code": out.status.code().unwrap_or(-1), "phase": "build" }));
        return;
    }
    if !then_run {
        emit(id, "run.exit", json!({ "code": 0, "phase": "build" }));
        return;
    }
    let current = STATE.lock().unwrap().run_id == id;
    if current {
        launch(id, exe, dir);
    }
}

/// clang's "file:line:col: error: message" lines.
pub fn parse_diagnostics(text: &str) -> Vec<Value> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(?m)^(.+?):(\d+):(\d+): (fatal error|error|warning|note): (.*)$").unwrap());
    re.captures_iter(text)
        .map(|c| {
            let file = Path::new(&c[1]).file_name().and_then(|n| n.to_str()).unwrap_or(&c[1]).to_string();
            let sev = if &c[4] == "fatal error" { "error" } else { &c[4] };
            json!({
                "file": file, "line": c[2].parse::<u64>().unwrap_or(1), "column": c[3].parse::<u64>().unwrap_or(1),
                "severity": sev, "message": c[5].trim_end(),
            })
        })
        .collect()
}

fn launch(id: u64, exe: PathBuf, cwd: PathBuf) {
    let fail = |msg: String| {
        emit(id, "run.out", json!({ "text": msg }));
        emit(id, "run.exit", json!({ "code": -1, "phase": "run" }));
    };
    let pair = match native_pty_system().openpty(PtySize { rows: 40, cols: 120, pixel_width: 0, pixel_height: 0 }) {
        Ok(p) => p,
        Err(_) => return fail("Couldn't open a terminal for the program.\n".into()),
    };
    let mut cmd = CommandBuilder::new(&exe);
    cmd.cwd(&cwd);
    for (key, _) in std::env::vars() {
        if key.starts_with("CLAUDE") {
            cmd.env_remove(key);
        }
    }
    cmd.env("TERM", "dumb");
    cmd.env("ASAN_OPTIONS", "detect_leaks=0:print_summary=1");
    cmd.env("UBSAN_OPTIONS", "print_stacktrace=1");
    let mut child = match pair.slave.spawn_command(cmd) {
        Ok(c) => c,
        Err(e) => return fail(format!("Couldn't start the program: {e}\n")),
    };
    drop(pair.slave);
    let (Ok(mut reader), Ok(writer)) = (pair.master.try_clone_reader(), pair.master.take_writer()) else {
        let _ = child.kill();
        return fail("Couldn't connect to the program's terminal.\n".into());
    };
    let t0 = Instant::now();
    {
        let mut s = STATE.lock().unwrap();
        s.running = Some(Running { id, killer: child.clone_killer(), writer });
    }
    emit(id, "run.phase", json!({ "phase": "run" }));

    // Output: read until the terminal closes, stopping runaway programs at 2 MB.
    let (done_tx, done_rx) = mpsc::channel::<()>();
    thread::spawn(move || {
        let mut buf = [0u8; 16384];
        let mut total = 0usize;
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    total += n;
                    emit(id, "run.out", json!({ "text": String::from_utf8_lossy(&buf[..n]) }));
                    if total > OUTPUT_LIMIT {
                        emit(id, "run.out", json!({ "text": "\n[ACT stopped the program: it printed more than 2 MB.]\n" }));
                        stop();
                        break;
                    }
                }
            }
        }
        let _ = done_tx.send(());
    });

    // Exit: wait for the program, give the last output a moment to arrive, then report.
    let master = pair.master;
    thread::spawn(move || {
        let status = child.wait();
        let _ = done_rx.recv_timeout(Duration::from_millis(300));
        drop(master);
        let mut info = json!({ "phase": "run", "seconds": t0.elapsed().as_secs_f64() });
        match status {
            Ok(st) => match st.signal() {
                Some(name) => {
                    let num: i32 = name.rsplit(':').next().and_then(|n| n.trim().parse().ok()).unwrap_or(0);
                    info["code"] = json!(128 + num);
                    info["signal"] = json!(signal_name(num, name));
                }
                None => info["code"] = json!(st.exit_code() as i64),
            },
            Err(_) => info["code"] = json!(-1),
        }
        {
            let mut s = STATE.lock().unwrap();
            if s.running.as_ref().map(|r| r.id) == Some(id) {
                s.running = None;
            }
        }
        emit(id, "run.exit", info);
    });
}

fn signal_name(num: i32, raw: &str) -> String {
    match num {
        11 => "Segmentation fault (the program touched memory it doesn't own)".into(),
        10 => "Bus error (bad memory access)".into(),
        6 => "Aborted".into(),
        8 => "Arithmetic error (for example, dividing by zero)".into(),
        4 => "Illegal instruction".into(),
        1 | 9 | 15 => "Stopped".into(),
        _ => raw.to_string(),
    }
}

/// Typed input goes to the program as if typed in a terminal ("\u{4}" = end of input, like Control-D).
pub fn send(text: &str) {
    let mut s = STATE.lock().unwrap();
    if let Some(r) = s.running.as_mut() {
        let _ = r.writer.write_all(text.as_bytes());
        let _ = r.writer.flush();
    }
}

pub fn stop() {
    let mut s = STATE.lock().unwrap();
    if let Some(r) = s.running.as_mut() {
        let _ = r.killer.kill();
    }
}
