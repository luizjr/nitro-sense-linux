use crate::error::AppResult;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
pub struct HistoryPoint {
    /// unix timestamp (seconds)
    pub t: i64,
    /// charge percentage 0..=100
    pub percent: f32,
}

#[derive(Debug, Serialize, Default)]
pub struct BatteryStatus {
    pub present: bool,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub technology: Option<String>,
    /// Charging / Discharging / Full / Not charging / Unknown
    pub status: String,
    /// current charge level, percent
    pub capacity: i64,
    /// charge_full / charge_full_design * 100 — battery wear
    pub health_percent: Option<f32>,
    /// current full capacity (mAh or mWh, see `unit`)
    pub full: Option<i64>,
    /// design full capacity (mAh or mWh)
    pub full_design: Option<i64>,
    /// "mAh" or "mWh"
    pub unit: &'static str,
    /// firmware-reported charge cycles (None when the EC does not expose it)
    pub cycle_count: Option<i64>,
    /// instantaneous power draw (negative = discharging) in watts
    pub power_w: Option<f32>,
    pub voltage_v: Option<f32>,
    /// recent charge-level samples from upower history (oldest → newest)
    pub history: Vec<HistoryPoint>,
}

/// true = running on AC/mains, false = on battery.
/// Only counts supplies of type "Mains" (ignores USB-C data ports that also
/// report online=1). Defaults to AC when no mains supply can be found.
#[tauri::command]
pub fn get_power_source() -> bool {
    let entries = match fs::read_dir("/sys/class/power_supply") {
        Ok(e) => e,
        Err(_) => return true,
    };
    let mut saw_mains = false;
    for entry in entries.flatten() {
        let path = entry.path();
        let is_mains = fs::read_to_string(path.join("type"))
            .map(|t| t.trim() == "Mains")
            .unwrap_or(false);
        if !is_mains {
            continue;
        }
        saw_mains = true;
        if fs::read_to_string(path.join("online"))
            .map(|o| o.trim() == "1")
            .unwrap_or(false)
        {
            return true;
        }
    }
    // mains present but none online → on battery; no mains at all → assume AC
    !saw_mains
}

fn first_battery() -> Option<PathBuf> {
    let entries = fs::read_dir("/sys/class/power_supply").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if let Ok(t) = fs::read_to_string(path.join("type")) {
            if t.trim() == "Battery" {
                return Some(path);
            }
        }
    }
    None
}

fn read_str(base: &Path, file: &str) -> Option<String> {
    fs::read_to_string(base.join(file))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn read_int(base: &Path, file: &str) -> Option<i64> {
    read_str(base, file).and_then(|s| s.parse::<i64>().ok())
}

#[tauri::command]
pub fn read_battery() -> AppResult<BatteryStatus> {
    let base = match first_battery() {
        Some(b) => b,
        None => {
            return Ok(BatteryStatus {
                present: false,
                status: "Unknown".into(),
                unit: "mAh",
                ..Default::default()
            })
        }
    };

    let model = read_str(&base, "model_name");

    // charge_* is reported in µAh, energy_* in µWh; prefer charge, fall back to energy.
    let (full, full_design, unit) = if let (Some(f), Some(d)) =
        (read_int(&base, "charge_full"), read_int(&base, "charge_full_design"))
    {
        (Some(f / 1000), Some(d / 1000), "mAh")
    } else if let (Some(f), Some(d)) =
        (read_int(&base, "energy_full"), read_int(&base, "energy_full_design"))
    {
        (Some(f / 1000), Some(d / 1000), "mWh")
    } else {
        (None, None, "mAh")
    };

    let health_percent = match (full, full_design) {
        (Some(f), Some(d)) if d > 0 => Some((f as f32 / d as f32) * 100.0),
        _ => None,
    };

    let voltage_v = read_int(&base, "voltage_now").map(|v| v as f32 / 1_000_000.0);
    // power_now is µW; otherwise derive from current_now (µA) × voltage_now (µV).
    let power_w = read_int(&base, "power_now")
        .map(|p| p as f32 / 1_000_000.0)
        .or_else(|| {
            let i = read_int(&base, "current_now")? as f32 / 1_000_000.0;
            let v = voltage_v?;
            Some(i * v)
        });

    // cycle_count of 0 usually means "not reported by firmware" on these Acer ECs.
    let cycle_count = read_int(&base, "cycle_count").filter(|&c| c > 0);

    Ok(BatteryStatus {
        present: true,
        manufacturer: read_str(&base, "manufacturer"),
        technology: read_str(&base, "technology"),
        status: read_str(&base, "status").unwrap_or_else(|| "Unknown".into()),
        capacity: read_int(&base, "capacity").unwrap_or(0),
        health_percent,
        full,
        full_design,
        unit,
        cycle_count,
        power_w,
        voltage_v,
        history: read_history(model.as_deref()),
        model,
    })
}

/// Parse upower's charge history for the internal battery.
/// Files live in /var/lib/upower/history-charge-<id>.dat with lines:
///   `<unix_ts> <percent> <state>`
fn read_history(model: Option<&str>) -> Vec<HistoryPoint> {
    let dir = "/var/lib/upower";
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut chosen: Option<PathBuf> = None;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with("history-charge-") {
            continue;
        }
        // Bluetooth peripherals show up here too; their id contains a MAC (':').
        if name.contains(':') {
            continue;
        }
        // Prefer the file whose id contains the battery model (e.g. AP21D8M).
        if let Some(m) = model {
            if name.contains(m) {
                chosen = Some(entry.path());
                break;
            }
        }
        if chosen.is_none() {
            chosen = Some(entry.path());
        }
    }

    let path = match chosen {
        Some(p) => p,
        None => return Vec::new(),
    };

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut points: Vec<HistoryPoint> = content
        .lines()
        .filter_map(|line| {
            let mut it = line.split_whitespace();
            let t = it.next()?.parse::<i64>().ok()?;
            let percent = it.next()?.parse::<f32>().ok()?;
            Some(HistoryPoint { t, percent })
        })
        .collect();

    points.sort_by_key(|p| p.t);
    // Keep at most the last ~240 samples so the UI chart stays light.
    let len = points.len();
    if len > 240 {
        points.drain(0..len - 240);
    }
    points
}
