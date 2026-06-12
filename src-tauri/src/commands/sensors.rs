use crate::error::AppResult;
use crate::sysfs;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::fs;
use std::sync::Mutex;

#[derive(Debug, Serialize)]
pub struct TempReading {
    pub label: String,
    pub celsius: f32,
}

#[derive(Debug, Serialize)]
pub struct SensorSnapshot {
    pub acer: Vec<TempReading>,
    pub cpu_package: Option<f32>,
    /// CPU utilization 0..=100, computed from the delta since the previous call.
    pub cpu_load: Option<f32>,
}

#[tauri::command]
pub fn read_sensors() -> AppResult<SensorSnapshot> {
    let hwmon = sysfs::acer_hwmon()?;
    let mut acer = Vec::new();
    for i in 1..=3 {
        let path = hwmon.join(format!("temp{i}_input"));
        if let Ok(milli) = sysfs::read_i64(&path) {
            acer.push(TempReading {
                label: format!("temp{i}"),
                celsius: milli as f32 / 1000.0,
            });
        }
    }
    Ok(SensorSnapshot {
        acer,
        cpu_package: read_coretemp_package(),
        cpu_load: read_cpu_load(),
    })
}

/// Previous (total, idle) jiffies from /proc/stat, to compute load over the
/// interval between two read_sensors calls.
static PREV_CPU: Lazy<Mutex<Option<(u64, u64)>>> = Lazy::new(|| Mutex::new(None));

fn read_cpu_load() -> Option<f32> {
    let stat = fs::read_to_string("/proc/stat").ok()?;
    let line = stat.lines().next()?; // aggregate "cpu  user nice system idle ..."
    let mut it = line.split_whitespace();
    if it.next()? != "cpu" {
        return None;
    }
    let vals: Vec<u64> = it.filter_map(|x| x.parse::<u64>().ok()).collect();
    if vals.len() < 4 {
        return None;
    }
    let idle = vals[3] + vals.get(4).copied().unwrap_or(0); // idle + iowait
    let total: u64 = vals.iter().sum();

    let mut prev = PREV_CPU.lock().ok()?;
    let result = match *prev {
        Some((ptotal, pidle)) => {
            let dt = total.saturating_sub(ptotal);
            let di = idle.saturating_sub(pidle);
            if dt == 0 {
                None
            } else {
                Some((dt.saturating_sub(di) as f32 / dt as f32) * 100.0)
            }
        }
        None => None, // first sample: no interval yet
    };
    *prev = Some((total, idle));
    result
}

fn read_coretemp_package() -> Option<f32> {
    let entries = fs::read_dir("/sys/class/hwmon").ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if let Ok(name) = fs::read_to_string(path.join("name")) {
            if name.trim() == "coretemp" {
                for i in 1..=20 {
                    let label_path = path.join(format!("temp{i}_label"));
                    if let Ok(label) = fs::read_to_string(&label_path) {
                        if label.trim().eq_ignore_ascii_case("Package id 0") {
                            if let Ok(t) = sysfs::read_i64(path.join(format!("temp{i}_input"))) {
                                return Some(t as f32 / 1000.0);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}
