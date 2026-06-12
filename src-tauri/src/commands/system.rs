use crate::sysfs::{self, PLATFORM_PROFILE};
use serde::Serialize;
use std::fs;
use std::path::Path;

/// Result of the startup hardware-support probe.
///
/// The app drives fans, the power plan and sensors through the `acer_wmi`
/// interface (the "acer" hwmon + ACPI `platform_profile`), which only exists on
/// Acer Nitro / Predator gaming laptops. On a desktop or a non-Acer machine
/// those nodes are absent, so the per-panel polling loops would just spin on
/// missing endpoints. We detect that up front and let the UI show an explicit
/// notice instead of trying (and stalling) on hardware it can't drive.
#[derive(Debug, Serialize)]
pub struct SystemSupport {
    pub supported: bool,
    pub vendor: String,
    pub product: String,
    pub is_acer: bool,
    pub is_laptop: bool,
    pub has_acer_hwmon: bool,
    pub has_platform_profile: bool,
}

fn dmi(field: &str) -> String {
    fs::read_to_string(format!("/sys/class/dmi/id/{field}"))
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

/// DMI chassis type → is this a portable/laptop form factor?
/// 8 Portable · 9 Laptop · 10 Notebook · 11 Hand Held · 14 Sub Notebook
/// 30 Tablet · 31 Convertible · 32 Detachable
fn chassis_is_laptop() -> bool {
    matches!(
        dmi("chassis_type").parse::<u32>().unwrap_or(0),
        8 | 9 | 10 | 11 | 14 | 30 | 31 | 32
    )
}

#[tauri::command]
pub fn system_support() -> SystemSupport {
    let vendor = dmi("sys_vendor");
    let product = dmi("product_name");
    let is_acer = vendor.to_lowercase().contains("acer");
    let is_laptop = chassis_is_laptop();
    let has_acer_hwmon = sysfs::ACER_HWMON.is_some();
    let has_platform_profile = Path::new(PLATFORM_PROFILE).exists();

    // Supported when the acer_wmi hwmon is already present OR it's an Acer
    // laptop. The second clause lets genuine Nitro/Predator machines in even
    // if the driver hasn't registered the hwmon yet (each panel surfaces its
    // own error), while still blocking desktops and non-Acer hardware.
    let supported = has_acer_hwmon || (is_acer && is_laptop);

    SystemSupport {
        supported,
        vendor,
        product,
        is_acer,
        is_laptop,
        has_acer_hwmon,
        has_platform_profile,
    }
}
