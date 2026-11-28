//! Small operating-system helpers: opening links, showing files, test/dev switches, the resources folder.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

static RESOURCES: OnceLock<PathBuf> = OnceLock::new();

pub fn set_resources(dir: PathBuf) {
    let _ = RESOURCES.set(dir);
}

/// The app's Resources folder (knowledge library, icons).
pub fn resources() -> PathBuf {
    RESOURCES.get().cloned().unwrap_or_else(|| PathBuf::from("."))
}

/// ACT_DEV or a self-test script: page logs go to the terminal.
pub fn dev_mode() -> bool {
    std::env::var_os("ACT_DEV").is_some() || std::env::var_os("ACT_SELFTEST").is_some()
}

/// Test runs (a scratch data folder or a self-test script) never touch the real app in Finder.
pub fn test_mode() -> bool {
    std::env::var_os("ACT_SELFTEST").is_some() || std::env::var_os("ACT_DATA_DIR").is_some()
}

/// Opens a web link in the default browser.
pub fn open_url(url: &str) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = Command::new("xdg-open").arg(url).spawn();
}

/// Shows a file or folder selected in Finder (or Explorer).
pub fn reveal(path: &Path) {
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg("-R").arg(path).spawn();
    #[cfg(target_os = "windows")]
    let _ = Command::new("explorer").arg(format!("/select,{}", path.display())).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = Command::new("xdg-open").arg(path.parent().unwrap_or(path)).spawn();
}

pub fn home() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

pub fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata().map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}
