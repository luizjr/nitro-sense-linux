import { invoke } from "@tauri-apps/api/core";

export type FanReading = {
  index: number;
  label: string;
  rpm: number;
  pwm: number;
  auto: boolean;
};

export type TempReading = { label: string; celsius: number };

export type SensorSnapshot = {
  acer: TempReading[];
  cpu_package: number | null;
  cpu_load: number | null;
};

export type GpuStatus = {
  name: string;
  temp_c: number;
  power_w: number;
  graphics_mhz: number;
  memory_mhz: number;
  utilization: number;
};

export type HistoryPoint = { t: number; percent: number };

export type BatteryStatus = {
  present: boolean;
  model: string | null;
  manufacturer: string | null;
  technology: string | null;
  status: string;
  capacity: number;
  health_percent: number | null;
  full: number | null;
  full_design: number | null;
  unit: string;
  cycle_count: number | null;
  power_w: number | null;
  voltage_v: number | null;
  history: HistoryPoint[];
};

export const api = {
  getPlatformProfile: () => invoke<string>("get_platform_profile"),
  listPlatformProfiles: () => invoke<string[]>("list_platform_profiles"),
  setPlatformProfile: (profile: string) =>
    invoke<void>("set_platform_profile", { profile }),

  readFans: () => invoke<FanReading[]>("read_fans"),
  setFanPwm: (index: number, pwm: number) =>
    invoke<void>("set_fan_pwm", { index, pwm }),
  setFanAuto: (index: number) => invoke<void>("set_fan_auto", { index }),

  readSensors: () => invoke<SensorSnapshot>("read_sensors"),

  readGpuStatus: () => invoke<GpuStatus>("read_gpu_status"),

  readBattery: () => invoke<BatteryStatus>("read_battery"),
  getPowerSource: () => invoke<boolean>("get_power_source"),

  audioStatus: () => invoke<AudioStatus>("audio_status"),
  audioSetMode: (mode: string) => invoke<void>("audio_set_mode", { mode }),
  audioDisable: () => invoke<void>("audio_disable"),

  getAutostart: () => invoke<boolean>("get_autostart"),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
};

export type AudioStatus = {
  available: boolean;
  active: boolean;
  mode: string;
};
