use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct GpuStatus {
    pub name: String,
    pub temp_c: i32,
    pub power_w: f32,
    pub graphics_mhz: i32,
    pub memory_mhz: i32,
    pub utilization: i32,
}

/// Calls nvidia-smi with a CSV query and returns its first row split by comma.
fn nvidia_smi_query(query: &str) -> AppResult<Vec<String>> {
    let out = Command::new("nvidia-smi")
        .args([
            &format!("--query-gpu={query}"),
            "--format=csv,noheader,nounits",
        ])
        .output()
        .map_err(|e| AppError::Command(format!("nvidia-smi failed to spawn: {e}")))?;
    if !out.status.success() {
        return Err(AppError::Command(format!(
            "nvidia-smi exited {:?}: {}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr)
        )));
    }
    let line = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .to_string();
    Ok(line.split(',').map(|s| s.trim().to_string()).collect())
}

#[tauri::command]
pub fn read_gpu_status() -> AppResult<GpuStatus> {
    let cols = nvidia_smi_query(
        "name,temperature.gpu,power.draw,clocks.current.graphics,clocks.current.memory,utilization.gpu",
    )?;
    if cols.len() < 6 {
        return Err(AppError::Command(format!("nvidia-smi returned {} columns", cols.len())));
    }
    Ok(GpuStatus {
        name: cols[0].clone(),
        temp_c: cols[1].parse().unwrap_or(0),
        power_w: cols[2].parse().unwrap_or(0.0),
        graphics_mhz: cols[3].parse().unwrap_or(0),
        memory_mhz: cols[4].parse().unwrap_or(0),
        utilization: cols[5].parse().unwrap_or(0),
    })
}

// NOTE: real GPU overclock is NOT achievable on this Optimus laptop under
// Wayland — clock offset needs Coolbits + an X screen the NVIDIA GPU doesn't
// drive, and the power limit (TGP) is locked by the EC. GPU performance is
// instead governed by the platform_profile (Power Plan). So there is no
// apply_gpu_profile: the GPU section is monitoring-only.
