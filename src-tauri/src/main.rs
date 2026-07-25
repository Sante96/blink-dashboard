#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use base64::Engine;
use std::process::{Child, Command};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

/// Se true, la chiusura della finestra la nasconde nella tray invece di uscire.
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

/// Token anti-CSRF generato all'avvio e condiviso con il backend via env.
/// Il frontend lo legge via comando IPC `get_local_token`.
static LOCAL_TOKEN: once_cell::sync::Lazy<String> = once_cell::sync::Lazy::new(|| {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    // Hash semplice del timestamp + pid per generare un token unico per sessione.
    let raw = format!("{}-{}", seed, std::process::id());
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(raw.as_bytes())
});

/// Processo uvicorn avviato da noi: va terminato all'uscita dell'app.
/// Resta None se il backend era già attivo (es. hot-reload) o se lo spawn fallisce.
struct BackendProcess(Mutex<Option<Child>>);

/// Controlla se una porta è già occupata
fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

/// Termina il backend avviato da noi. Su Windows `uv run` fa da wrapper a
/// uvicorn, quindi va ucciso l'intero albero di processi, non solo `uv`.
fn kill_backend(state: &BackendProcess) {
    if let Some(mut child) = state.0.lock().unwrap().take() {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            let _ = Command::new("taskkill")
                .args(["/PID", &child.id().to_string(), "/T", "/F"])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
        #[cfg(not(windows))]
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Il frontend sincronizza qui l'impostazione "minimizza nella tray".
#[tauri::command]
fn set_minimize_to_tray(enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

/// Ritorna il token anti-CSRF da inviare al backend con ogni richiesta mutante.
#[tauri::command]
fn get_local_token() -> String {
    LOCAL_TOKEN.clone()
}

/// Scrive dei byte (già scaricati dal frontend) su un file sul disco.
/// Usato per salvare i clip cloud tramite il dialog "salva con nome".
/// I byte arrivano in base64: molto più compatto dell'array JSON di numeri
/// che l'IPC serializzerebbe per un Vec<u8>.
#[tauri::command]
fn save_bytes(path: String, bytes_b64: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&bytes_b64)
        .map_err(|e| format!("Decodifica fallita: {}", e))?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Scrittura fallita: {}", e))
}

fn build_tray() -> SystemTray {
    let show = CustomMenuItem::new("show".to_string(), "Apri Blink Dashboard");
    let quit = CustomMenuItem::new("quit".to_string(), "Esci");
    let menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);
    SystemTray::new().with_menu(menu)
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(BackendProcess(Mutex::new(None)))
        .system_tray(build_tray())
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } | SystemTrayEvent::DoubleClick { .. } => {
                show_main_window(app);
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => show_main_window(app),
                "quit" => app.exit(0),
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                if MINIMIZE_TO_TRAY.load(Ordering::Relaxed) {
                    // Nascondi invece di chiudere: l'app resta viva nella tray.
                    api.prevent_close();
                    let _ = event.window().hide();
                }
            }
        })
        .setup(|app| {
            let handle = app.handle();

            // In dev: usa `uv run uvicorn` dalla cartella backend/ (hot-reload).
            // In release: lancia backend.exe dalla resource_dir di Tauri.
            let is_dev = cfg!(dev);

            let backend_dir = if is_dev {
                std::env::current_dir().unwrap().join("..").join("backend")
            } else {
                // resolve_resource risolve il path dichiarato in bundle.resources:
                // nell'app installata i file stanno in <install>\resources\backend\,
                // mentre resource_dir() da solo punta alla radice dell'installazione.
                app.path_resolver()
                    .resolve_resource("resources/backend")
                    .unwrap_or_else(|| {
                        std::env::current_dir()
                            .unwrap()
                            .join("resources")
                            .join("backend")
                    })
            };

            std::thread::spawn(move || {
                // Non lanciare se uvicorn/backend è già attivo (hot-reload Tauri)
                if is_port_in_use(8000) {
                    return;
                }

                let mut cmd = if is_dev {
                    // Dev: usa uv come prima
                    let mut c = Command::new("uv");
                    c.args(["run", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]);
                    c.current_dir(&backend_dir);
                    c
                } else {
                    // Release: lancia backend.exe (PyInstaller onedir)
                    let exe_path = backend_dir.join("backend.exe");
                    let mut c = Command::new(&exe_path);
                    // Il backend PyInstaller è già configurato per avviarsi su 127.0.0.1:8000
                    // ma passiamo comunque i parametri per coerenza
                    c.current_dir(&backend_dir);
                    c
                };

                // Passa il token anti-CSRF come env al processo backend.
                // Solo in release: in dev il middleware bypassa se la variabile
                // non è impostata, evitando mismatch quando Tauri hot-reload
                // genera un nuovo token ma il vecchio uvicorn è ancora attivo.
                if !is_dev {
                    cmd.env("BLINK_LOCAL_TOKEN", &*LOCAL_TOKEN);
                }

                // In release non aprire una finestra console per il backend.
                #[cfg(all(windows, not(debug_assertions)))]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }

                match cmd.spawn() {
                    Ok(child) => {
                        *handle.state::<BackendProcess>().0.lock().unwrap() = Some(child);
                    }
                    Err(e) => {
                        let msg = if is_dev {
                            format!(
                                "Impossibile avviare il backend: {}\n\nVerifica che 'uv' sia installato e nel PATH.",
                                e
                            )
                        } else {
                            format!(
                                "Impossibile avviare il backend: {}\n\nL'eseguibile backend.exe non è stato trovato o non può essere avviato.",
                                e
                            )
                        };
                        tauri::api::dialog::message(
                            handle.get_window("main").as_ref(),
                            "Blink Dashboard",
                            msg,
                        );
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_minimize_to_tray, save_bytes, get_local_token])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        // Uscita (tray "Esci" o chiusura reale): termina l'uvicorn che abbiamo
        // avviato noi, altrimenti resta orfano con la sessione Blink aperta.
        if let tauri::RunEvent::Exit = event {
            kill_backend(&app_handle.state::<BackendProcess>());
        }
    });
}
