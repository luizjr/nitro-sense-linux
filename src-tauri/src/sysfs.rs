use crate::error::{AppError, AppResult};
use once_cell::sync::Lazy;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const PLATFORM_PROFILE: &str = "/sys/firmware/acpi/platform_profile";
pub const PLATFORM_PROFILE_CHOICES: &str = "/sys/firmware/acpi/platform_profile_choices";

pub static ACER_HWMON: Lazy<Option<PathBuf>> = Lazy::new(find_acer_hwmon);

fn find_acer_hwmon() -> Option<PathBuf> {
    let entries = fs::read_dir("/sys/class/hwmon").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name_path = path.join("name");
        if let Ok(name) = fs::read_to_string(&name_path) {
            if name.trim() == "acer" {
                return Some(path);
            }
        }
    }
    None
}

pub fn acer_hwmon() -> AppResult<&'static Path> {
    ACER_HWMON
        .as_deref()
        .ok_or_else(|| AppError::Unsupported("acer hwmon not present (acer_wmi loaded?)".into()))
}

pub fn read_trimmed(path: impl AsRef<Path>) -> AppResult<String> {
    let path_ref = path.as_ref();
    fs::read_to_string(path_ref)
        .map(|s| s.trim().to_string())
        .map_err(|source| AppError::Io {
            path: path_ref.display().to_string(),
            source,
        })
}

pub fn read_i64(path: impl AsRef<Path>) -> AppResult<i64> {
    let raw = read_trimmed(&path)?;
    raw.parse::<i64>()
        .map_err(|_| AppError::InvalidValue(format!("expected integer in {}", raw)))
}

/// Privileged write: tries direct write first (works if udev/polkit gave us
/// the right ACL), falls back to the helper binary via `pkexec`.
pub fn write_privileged(path: &str, value: &str) -> AppResult<()> {
    if fs::write(path, value).is_ok() {
        return Ok(());
    }

    let status = Command::new("pkexec")
        .arg("/usr/local/bin/nitro-sense-helper")
        .arg(path)
        .arg(value)
        .status()
        .map_err(|e| AppError::Command(format!("failed to launch pkexec: {e}")))?;

    if !status.success() {
        return Err(AppError::Permission);
    }
    Ok(())
}
