//! ACT (Ashley's Code Tutor): the window, the menus, and quitting safely. The app itself is the
//! web page in build.noindex/web (embedded at build time); bridge.rs is how the page asks for
//! native things (files, running code, the tutor).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod appicon;
mod bridge;
mod events;
mod runner;
mod store;
mod system;
mod tutor;

use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

const APP_NAME: &str = "Ashley's Code Tutor";

static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);
static QUITTING: AtomicBool = AtomicBool::new(false);

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED).build())
        .invoke_handler(tauri::generate_handler![bridge::bridge])
        .setup(|app| {
            events::init(app.handle().clone());
            store::ensure_folders();
            if let Ok(res) = app.path().resource_dir() {
                store::sync_knowledge(&res);
                system::set_resources(res);
            }
            appicon::restore();
            app.set_menu(build_menu(app.handle())?)?;
            app.on_menu_event(|app, ev| {
                if ev.id().as_ref() == "quit" {
                    begin_quit(app);
                } else {
                    events::emit(json!({ "kind": "menu", "action": ev.id().as_ref() }));
                }
            });

            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title(APP_NAME)
                .inner_size(1560.0, 940.0)
                .min_inner_size(1100.0, 640.0)
                .center()
                .background_color(tauri::window::Color(24, 24, 24, 255))
                // Only the app's own page may load; links open in the default browser.
                .on_navigation(|url| {
                    let own = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
                        || matches!(url.scheme(), "about" | "data" | "blob");
                    if !own {
                        system::open_url(url.as_str());
                    }
                    own
                });
            // ACT_SELFTEST=<script.js> runs a test script once the page has loaded.
            if let Ok(path) = std::env::var("ACT_SELFTEST") {
                if let Ok(js) = std::fs::read_to_string(path) {
                    builder = builder.initialization_script(format!("window.addEventListener('DOMContentLoaded', function () {{\n{js}\n}});"));
                }
            }
            let window = builder.build()?;
            let _ = window.restore_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED);
            keep_running_in_background(&window);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("ACT couldn't start");

    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, .. } if !QUITTING.load(Ordering::SeqCst) => {
            api.prevent_exit();
            begin_quit(app);
        }
        RunEvent::WindowEvent { event: WindowEvent::CloseRequested { api, .. }, .. } if !QUITTING.load(Ordering::SeqCst) => {
            api.prevent_close();
            begin_quit(app);
        }
        _ => {}
    });
}

/// Quitting: let the page save open files first, with a short safety timeout.
fn begin_quit(app: &AppHandle) {
    if QUIT_REQUESTED.swap(true, Ordering::SeqCst) {
        return;
    }
    if system::dev_mode() {
        eprintln!("[app] quitting: asking the page to save");
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval(
            "(async () => { try { if (window.ACT && ACT.app && ACT.app.flush) await ACT.app.flush(); } catch (e) {} \
             window.__TAURI__.core.invoke('bridge', { cmd: 'app.quitNow', args: {} }); })();",
        );
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(2));
        quit_now(&handle);
    });
}

pub fn quit_now(app: &AppHandle) {
    if QUITTING.swap(true, Ordering::SeqCst) {
        return;
    }
    if system::dev_mode() {
        eprintln!("[app] quit");
    }
    runner::stop();
    tutor::stop_all();
    let _ = app.save_window_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED);
    app.exit(0);
}

/// WKWebView slows timers in windows that aren't in front; ACT's typing and idle chatter need them.
fn keep_running_in_background(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    let _ = window.with_webview(|wv| unsafe {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;
        let view = wv.inner() as *mut AnyObject;
        if view.is_null() {
            return;
        }
        let config: *mut AnyObject = msg_send![&*view, configuration];
        if config.is_null() {
            return;
        }
        let prefs: *mut AnyObject = msg_send![&*config, preferences];
        let responds: bool = msg_send![&*prefs, respondsToSelector: objc2::sel!(setInactiveSchedulingPolicy:)];
        if responds {
            // WKInactiveSchedulingPolicyNone
            let _: () = msg_send![&*prefs, setInactiveSchedulingPolicy: 2isize];
        }
    });
    #[cfg(not(target_os = "macos"))]
    let _ = window;
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let item = |id: &str, title: &str, accel: Option<&str>| MenuItem::with_id(app, id, title, true, accel);
    let sep = || PredefinedMenuItem::separator(app);

    let app_menu = Submenu::with_items(app, "ACT", true, &[
        &item("about", "About Ashley's Code Tutor", None)?,
        &sep()?,
        &item("settings", "Settings…", None)?,
        &sep()?,
        &PredefinedMenuItem::hide(app, Some("Hide ACT"))?,
        &PredefinedMenuItem::hide_others(app, None)?,
        &PredefinedMenuItem::show_all(app, None)?,
        &sep()?,
        // Our own Quit (not the built-in one), so open files are saved first.
        &item("quit", "Quit ACT", Some("CmdOrCtrl+Q"))?,
    ])?;
    let file = Submenu::with_items(app, "File", true, &[
        &item("home", "Choose a Language…", Some("CmdOrCtrl+Shift+L"))?,
        &item("character", "Change Tutor Character…", None)?,
        &item("new-file", "New File…", Some("CmdOrCtrl+N"))?,
        &sep()?,
        &item("save", "Save", Some("CmdOrCtrl+S"))?,
        &item("reset-lesson", "Reset Lesson Code…", None)?,
        &item("reveal", if cfg!(windows) { "Show Lesson Files in Explorer" } else { "Show Lesson Files in Finder" }, None)?,
        &sep()?,
        &item("settings", "Preferences…", Some("CmdOrCtrl+Comma"))?,
        &sep()?,
        &PredefinedMenuItem::close_window(app, Some("Close Window"))?,
    ])?;
    // Undo/copy/paste go to the web page, where the editor handles them like VS Code does.
    let edit = Submenu::with_items(app, "Edit", true, &[
        &PredefinedMenuItem::undo(app, None)?,
        &PredefinedMenuItem::redo(app, None)?,
        &sep()?,
        &PredefinedMenuItem::cut(app, None)?,
        &PredefinedMenuItem::copy(app, None)?,
        &PredefinedMenuItem::paste(app, None)?,
        &PredefinedMenuItem::select_all(app, None)?,
        &sep()?,
        &item("ask", "Ask the Tutor About Selection", Some("CmdOrCtrl+K"))?,
        &item("clear-highlights", "Clear Highlights", None)?,
    ])?;
    let view = Submenu::with_items(app, "View", true, &[
        &item("palette", "Command Palette…", Some("CmdOrCtrl+Shift+P"))?,
        &item("toggle-lessons", "Toggle Lesson Tabs", Some("CmdOrCtrl+Alt+B"))?,
        &item("minimap", "Toggle Minimap", None)?,
        &item("word-wrap", "Toggle Word Wrap (⌥Z)", None)?,
        &sep()?,
        &item("zoom-in", "Zoom In", Some("CmdOrCtrl+Equal"))?,
        &item("zoom-out", "Zoom Out", Some("CmdOrCtrl+Minus"))?,
        &item("zoom-reset", "Reset Zoom", Some("CmdOrCtrl+Digit0"))?,
        &sep()?,
        &PredefinedMenuItem::fullscreen(app, Some("Enter Full Screen"))?,
    ])?;
    let run = Submenu::with_items(app, "Run", true, &[
        &item("run", "Run", Some("CmdOrCtrl+R"))?,
        &item("build", "Build Only", Some("CmdOrCtrl+Shift+B"))?,
        &item("stop", "Stop", Some("CmdOrCtrl+Period"))?,
    ])?;
    let window = Submenu::with_items(app, "Window", true, &[
        &PredefinedMenuItem::minimize(app, None)?,
        &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
    ])?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &run, &window])
}
