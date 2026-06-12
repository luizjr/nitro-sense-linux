use crate::error::AppResult;
use crate::sysfs::{self, PLATFORM_PROFILE, PLATFORM_PROFILE_CHOICES};

#[tauri::command]
pub fn get_platform_profile() -> AppResult<String> {
    sysfs::read_trimmed(PLATFORM_PROFILE)
}

#[tauri::command]
pub fn list_platform_profiles() -> AppResult<Vec<String>> {
    let raw = sysfs::read_trimmed(PLATFORM_PROFILE_CHOICES)?;
    Ok(raw.split_whitespace().map(|s| s.to_string()).collect())
}

#[tauri::command]
pub fn set_platform_profile(profile: String) -> AppResult<()> {
    let allowed = list_platform_profiles()?;
    if !allowed.contains(&profile) {
        return Err(crate::error::AppError::InvalidValue(format!(
            "profile '{}' not in {:?}",
            profile, allowed
        )));
    }
    sysfs::write_privileged(PLATFORM_PROFILE, &profile)
}
