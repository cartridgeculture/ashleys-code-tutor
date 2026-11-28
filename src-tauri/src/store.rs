//! ACT's data folder: ~/Library/Application Support/ACT on a Mac (%APPDATA%\ACT on Windows).
//!   settings.json                       model, effort, theme, last track
//!   tracks/<track>/state.json           current lesson, finished lessons, added lessons, tutor session id
//!   tracks/<track>/chat.json            the tutor conversation
//!   tracks/<track>/lessons/<n>/...      the learner's files for each lesson
//!   tutor/                              the tutor's working folder (Claude Code runs here)
//!   tutor/knowledge/                    reference library copied from the app on every launch
//!   builds/                             compiler output
//!   app-icon.png                        the app icon picked in Preferences

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static ROOT: OnceLock<PathBuf> = OnceLock::new();

pub fn root() -> &'static PathBuf {
    ROOT.get_or_init(|| {
        // ACT_DATA_DIR points tests at a scratch folder so they never touch your real lessons.
        if let Ok(custom) = std::env::var("ACT_DATA_DIR") {
            if !custom.is_empty() {
                return PathBuf::from(custom);
            }
        }
        dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("ACT")
    })
}

pub fn tutor_dir() -> PathBuf {
    root().join("tutor")
}

pub fn builds_dir() -> PathBuf {
    root().join("builds")
}

pub fn ensure_folders() {
    for dir in [root().clone(), root().join("tracks"), tutor_dir(), builds_dir()] {
        let _ = fs::create_dir_all(dir);
    }
}

/// Copies the app's reference library into the tutor's folder so Claude can read it.
pub fn sync_knowledge(resources: &Path) {
    let src = resources.join("knowledge");
    if !src.is_dir() {
        return;
    }
    let dest = tutor_dir().join("knowledge");
    let _ = fs::remove_dir_all(&dest);
    let _ = copy_dir(&src, &dest);
}

fn copy_dir(src: &Path, dest: &Path) -> io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dest.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}

/// Resolves a relative path inside the data folder; refuses anything that escapes it.
pub fn url(path: &str) -> Result<PathBuf, String> {
    let parts: Vec<&str> = path.split('/').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() || parts.contains(&"..") || path.starts_with('/') || path.contains('\\') || path.contains(':') {
        return Err(format!("Bad path {path}"));
    }
    let mut u = root().clone();
    for p in parts {
        u.push(p);
    }
    if !u.starts_with(root()) {
        return Err(format!("Bad path {path}"));
    }
    Ok(u)
}

pub fn read(path: &str) -> Option<String> {
    fs::read_to_string(url(path).ok()?).ok()
}

/// Writes a file whole: to a temporary name first, then renamed over the old one.
pub fn write(path: &str, text: &str) -> Result<(), String> {
    let u = url(path)?;
    if let Some(parent) = u.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = u.with_extension(format!("{}.act-tmp", u.extension().and_then(|e| e.to_str()).unwrap_or("")));
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &u).map_err(|e| e.to_string())
}

/// File names (not folders) directly inside a folder, sorted, without hidden files.
pub fn list(path: &str) -> Vec<String> {
    let Ok(u) = url(path) else { return vec![] };
    let Ok(entries) = fs::read_dir(u) else { return vec![] };
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| !t.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().to_str().map(String::from))
        .filter(|n| !n.starts_with('.') && !n.ends_with(".act-tmp"))
        .collect();
    names.sort();
    names
}

/// Moves a file to the Trash (the Recycle Bin on Windows).
pub fn remove(path: &str) -> Result<(), String> {
    let u = url(path)?;
    if u.exists() {
        trash::delete(&u).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn reveal(path: &str) {
    let u = url(path).unwrap_or_else(|_| root().clone());
    let _ = fs::create_dir_all(&u);
    crate::system::reveal(&u);
}
