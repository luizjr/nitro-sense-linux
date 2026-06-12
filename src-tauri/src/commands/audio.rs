use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

const SINK_NAME: &str = "trueharmony_sink";
const BANDS: [&str; 6] = ["ls", "p1", "p2", "p3", "p4", "hs"];

/// Per-band gains (dB) for [ls@120, p1@250, p2@1k, p3@3k, p4@6k, hs@10k].
/// "Custom Audio" returns None → leave the current EQ untouched.
fn preset(mode: &str) -> Option<[f32; 6]> {
    Some(match mode {
        "Automatic" => [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        "Music" => [2.0, 0.0, -1.0, 0.0, 1.0, 2.0],
        "Movies" => [5.0, 2.0, -2.0, -1.0, 2.0, 4.0],
        "Shooter" => [-2.0, 1.0, 2.0, 5.0, 4.0, 3.0],
        "RPG" => [3.0, 1.0, 0.0, 1.0, 2.0, 3.0],
        "Strategy" => [-1.0, 0.0, 2.0, 3.0, 1.0, 1.0],
        "Voice" => [-4.0, -1.0, 3.0, 4.0, 1.0, -1.0],
        "Custom Audio" => return None,
        _ => return None,
    })
}

fn config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join(".config/nitro-sense")
}
fn mode_file() -> PathBuf {
    config_dir().join("audio_mode")
}
fn prev_file() -> PathBuf {
    config_dir().join("prev_sink")
}

/// Resolve the live PipeWire global id of a node by its node.name.
fn find_node_id(name: &str) -> Option<u32> {
    let out = Command::new("pw-dump").output().ok()?;
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).ok()?;
    for obj in json.as_array()? {
        let n = obj
            .get("info")
            .and_then(|i| i.get("props"))
            .and_then(|p| p.get("node.name"))
            .and_then(|v| v.as_str());
        if n == Some(name) {
            return obj.get("id").and_then(|v| v.as_u64()).map(|v| v as u32);
        }
    }
    None
}

/// Name of the current default audio sink, via pw-metadata.
fn default_sink_name() -> Option<String> {
    let out = Command::new("pw-metadata").args(["-n", "default"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        if line.contains("key:'default.audio.sink'") {
            // value:'{"name":"alsa_output...."}'
            let v = line.split("value:'").nth(1)?;
            let v = v.split('\'').next()?;
            let parsed: serde_json::Value = serde_json::from_str(v).ok()?;
            return parsed.get("name").and_then(|n| n.as_str()).map(String::from);
        }
    }
    None
}

fn set_default_sink(id: u32) -> AppResult<()> {
    let st = Command::new("wpctl")
        .args(["set-default", &id.to_string()])
        .status()
        .map_err(|e| AppError::Command(format!("wpctl: {e}")))?;
    if !st.success() {
        return Err(AppError::Command("wpctl set-default falhou".into()));
    }
    Ok(())
}

fn apply_gains(id: u32, gains: &[f32; 6]) -> AppResult<()> {
    let mut params = String::new();
    for (b, g) in BANDS.iter().zip(gains.iter()) {
        params.push_str(&format!("\"{b}:Gain\" {g:.3} "));
    }
    let arg = format!("{{ params = [ {params}] }}");
    let st = Command::new("pw-cli")
        .args(["set-param", &id.to_string(), "Props", &arg])
        .status()
        .map_err(|e| AppError::Command(format!("pw-cli: {e}")))?;
    if !st.success() {
        return Err(AppError::Command("pw-cli set-param falhou".into()));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct AudioStatus {
    /// the TrueHarmony sink exists in PipeWire
    pub available: bool,
    /// audio is currently routed through TrueHarmony (it is the default sink)
    pub active: bool,
    pub mode: String,
}

#[tauri::command]
pub fn audio_status() -> AudioStatus {
    let available = find_node_id(SINK_NAME).is_some();
    let active = default_sink_name().as_deref() == Some(SINK_NAME);
    let mode = std::fs::read_to_string(mode_file())
        .unwrap_or_default()
        .trim()
        .to_string();
    AudioStatus {
        available,
        active,
        mode: if mode.is_empty() { "Automatic".into() } else { mode },
    }
}

/// Apply a content mode: route audio through TrueHarmony (saving the previous
/// default sink the first time) and set the EQ for `mode`.
#[tauri::command]
pub fn audio_set_mode(mode: String) -> AppResult<()> {
    let id = find_node_id(SINK_NAME).ok_or_else(|| {
        AppError::Unsupported(
            "sink TrueHarmony ausente — rode packaging/install-trueharmony.sh".into(),
        )
    })?;

    // route through TrueHarmony if not already
    if default_sink_name().as_deref() != Some(SINK_NAME) {
        if let Some(prev) = default_sink_name() {
            let _ = std::fs::create_dir_all(config_dir());
            let _ = std::fs::write(prev_file(), prev);
        }
        set_default_sink(id)?;
    }

    if let Some(gains) = preset(&mode) {
        apply_gains(id, &gains)?;
    }

    let _ = std::fs::create_dir_all(config_dir());
    let _ = std::fs::write(mode_file(), &mode);
    Ok(())
}

/// Stop routing through TrueHarmony: restore the previously-default sink.
#[tauri::command]
pub fn audio_disable() -> AppResult<()> {
    let prev = std::fs::read_to_string(prev_file())
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    if let Some(name) = prev {
        if let Some(id) = find_node_id(&name) {
            set_default_sink(id)?;
        }
    }
    Ok(())
}
