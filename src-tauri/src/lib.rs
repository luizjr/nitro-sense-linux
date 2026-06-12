mod error;
mod sysfs;
mod commands;

pub use error::AppError;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Mostrar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Nitro Sense Linux")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profile::get_platform_profile,
            commands::profile::list_platform_profiles,
            commands::profile::set_platform_profile,
            commands::fans::read_fans,
            commands::fans::set_fan_pwm,
            commands::fans::set_fan_auto,
            commands::sensors::read_sensors,
            commands::gpu::read_gpu_status,
            commands::battery::read_battery,
            commands::battery::get_power_source,
            commands::audio::audio_status,
            commands::audio::audio_set_mode,
            commands::audio::audio_disable,
            commands::autostart::get_autostart,
            commands::autostart::set_autostart,
            commands::system::system_support,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
