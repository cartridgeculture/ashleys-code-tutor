//! The app icon picked in Preferences (none = the icon the app ships with, the purple and yellow
//! pixel "ACT"). Like AIM, it's kept in the data folder and put back on the app each time it
//! opens, since installing an update brings back the shipped icon. Also: keeping the Mac from
//! napping the app while the tutor replies.

use crate::{store, system};
use base64::Engine;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

fn saved_path() -> PathBuf {
    store::root().join("app-icon.png")
}

/// ACT's first icon (the blue one), offered as "Original".
pub fn original_bytes() -> Option<Vec<u8>> {
    fs::read(system::resources().join("OriginalIcon.png")).ok()
}

pub fn original_base64() -> Option<String> {
    original_bytes().map(|b| base64::engine::general_purpose::STANDARD.encode(b))
}

/// Shows the icon in the Dock now. save: also keeps it for next time and puts it on the app in
/// Finder, Launchpad, and the Dock while the app is closed. png None = back to the shipped icon.
pub fn show(app: &AppHandle, png: Option<Vec<u8>>, save: bool) -> Result<bool, String> {
    if save {
        match &png {
            Some(bytes) => fs::write(saved_path(), bytes).map_err(|e| e.to_string())?,
            None => {
                let _ = fs::remove_file(saved_path());
            }
        }
    }
    let finder = save && !system::test_mode();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(platform::set_icon(png.as_deref(), finder));
    })
    .map_err(|e| e.to_string())?;
    Ok(rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap_or(false))
}

/// At launch (on the main thread): put the picked icon back.
pub fn restore() {
    if let Ok(bytes) = fs::read(saved_path()) {
        let finder = !system::test_mode() && !platform::bundle_has_custom_icon();
        platform::set_icon(Some(&bytes), finder);
    }
}

/// Keeps macOS from slowing ACT down while it works in the background; ends when dropped.
pub fn begin_activity(reason: &str) -> platform::Activity {
    platform::Activity::begin(reason)
}

#[cfg(target_os = "macos")]
mod platform {
    use objc2::rc::Retained;
    use objc2::runtime::ProtocolObject;
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage, NSWorkspace, NSWorkspaceIconCreationOptions};
    use objc2_foundation::{NSActivityOptions, NSData, NSObjectProtocol, NSProcessInfo, NSString};

    /// The ACT.app folder this program runs from (…/ACT.app/Contents/MacOS/ACT).
    fn bundle_path() -> Option<std::path::PathBuf> {
        let exe = std::env::current_exe().ok()?;
        let app = exe.parent()?.parent()?.parent()?;
        if app.extension().and_then(|e| e.to_str()) == Some("app") { Some(app.to_path_buf()) } else { None }
    }

    pub fn bundle_has_custom_icon() -> bool {
        bundle_path().map(|p| p.join("Icon\r").exists()).unwrap_or(true)
    }

    pub fn set_icon(png: Option<&[u8]>, finder: bool) -> bool {
        let Some(mtm) = MainThreadMarker::new() else { return false };
        let image: Option<Retained<NSImage>> = match png {
            Some(bytes) => {
                let data = NSData::with_bytes(bytes);
                match NSImage::initWithData(NSImage::alloc(), &data) {
                    Some(img) => Some(img),
                    None => return false,
                }
            }
            None => None,
        };
        let app = NSApplication::sharedApplication(mtm);
        unsafe { app.setApplicationIconImage(image.as_deref()) };
        if finder {
            if let Some(path) = bundle_path() {
                let ws = NSWorkspace::sharedWorkspace();
                let p = NSString::from_str(&path.to_string_lossy());
                ws.setIcon_forFile_options(image.as_deref(), &p, NSWorkspaceIconCreationOptions(0));
            }
        }
        true
    }

    pub struct Activity(Option<Retained<ProtocolObject<dyn NSObjectProtocol>>>);

    impl Activity {
        pub fn begin(reason: &str) -> Activity {
            let info = NSProcessInfo::processInfo();
            let token = info.beginActivityWithOptions_reason(
                NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
                &NSString::from_str(reason),
            );
            Activity(Some(token))
        }
    }

    impl Drop for Activity {
        fn drop(&mut self) {
            if let Some(token) = self.0.take() {
                unsafe { NSProcessInfo::processInfo().endActivity(&token) };
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    pub fn bundle_has_custom_icon() -> bool {
        true
    }
    pub fn set_icon(_png: Option<&[u8]>, _finder: bool) -> bool {
        true
    }
    pub struct Activity;
    impl Activity {
        pub fn begin(_reason: &str) -> Activity {
            Activity
        }
    }
}
