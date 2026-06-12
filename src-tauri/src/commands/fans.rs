use crate::error::{AppError, AppResult};
use crate::sysfs;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FanReading {
    pub index: u8,
    pub label: &'static str,
    pub rpm: i64,
    pub pwm: i64,
    pub auto: bool,
}

#[tauri::command]
pub fn read_fans() -> AppResult<Vec<FanReading>> {
    let hwmon = sysfs::acer_hwmon()?;
    let mut out = Vec::with_capacity(2);
    for (idx, label) in [(1u8, "CPU"), (2u8, "GPU")] {
        let rpm = sysfs::read_i64(hwmon.join(format!("fan{idx}_input")))?;
        let pwm = sysfs::read_i64(hwmon.join(format!("pwm{idx}"))).unwrap_or(0);
        let enable = sysfs::read_i64(hwmon.join(format!("pwm{idx}_enable"))).unwrap_or(2);
        out.push(FanReading {
            index: idx,
            label,
            rpm,
            pwm,
            auto: enable == 2,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn set_fan_pwm(index: u8, pwm: u16) -> AppResult<()> {
    if !(1..=2).contains(&index) {
        return Err(AppError::InvalidValue(format!("fan index must be 1 or 2, got {index}")));
    }
    if pwm > 255 {
        return Err(AppError::InvalidValue(format!("pwm must be 0..=255, got {pwm}")));
    }
    // Safety floor: never let a controllable fan stop completely.
    let safe_pwm = pwm.max(40);

    let hwmon = sysfs::acer_hwmon()?;
    sysfs::write_privileged(
        hwmon.join(format!("pwm{index}_enable")).to_str().unwrap(),
        "1",
    )?;
    sysfs::write_privileged(
        hwmon.join(format!("pwm{index}")).to_str().unwrap(),
        &safe_pwm.to_string(),
    )
}

#[tauri::command]
pub fn set_fan_auto(index: u8) -> AppResult<()> {
    if !(1..=2).contains(&index) {
        return Err(AppError::InvalidValue(format!("fan index must be 1 or 2, got {index}")));
    }
    let hwmon = sysfs::acer_hwmon()?;
    sysfs::write_privileged(
        hwmon.join(format!("pwm{index}_enable")).to_str().unwrap(),
        "2",
    )
}
