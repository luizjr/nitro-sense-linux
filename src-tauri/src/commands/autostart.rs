use crate::error::{AppError, AppResult};
use std::fs;
use std::path::PathBuf;

fn autostart_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config/autostart/nitro-sense-linux.desktop")
}

#[tauri::command]
pub fn get_autostart() -> bool {
    autostart_path().exists()
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> AppResult<()> {
    let path = autostart_path();
    if enabled {
        let exe = std::env::current_exe()
            .map_err(|e| AppError::Command(format!("current_exe: {e}")))?;
        let content = format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name=Nitro Sense Linux\n\
             Exec={}\n\
             Icon=nitro-sense-linux\n\
             Terminal=false\n\
             X-GNOME-Autostart-enabled=true\n\
             Categories=Utility;System;\n",
            exe.display()
        );
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(|e| AppError::Io {
                path: dir.display().to_string(),
                source: e,
            })?;
        }
        fs::write(&path, content).map_err(|e| AppError::Io {
            path: path.display().to_string(),
            source: e,
        })?;
    } else if path.exists() {
        fs::remove_file(&path).map_err(|e| AppError::Io {
            path: path.display().to_string(),
            source: e,
        })?;
    }
    Ok(())
}
