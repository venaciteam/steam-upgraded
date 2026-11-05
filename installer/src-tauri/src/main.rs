// Installeur de Steam Upgraded : vérifie Steam et Millennium, installe ou retire le plugin.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod env;
mod millennium;
mod plugin;
mod system;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

use env::Env;
use millennium::Backup;

#[derive(Serialize)]
struct SteamInfo {
    found: bool,
    path: Option<String>,
    running: bool,
}

#[derive(Serialize)]
struct MillenniumInfo {
    #[serde(flatten)]
    installed: millennium::Installed,
    by_installer: bool,
    min_version: String,
}

#[derive(Serialize)]
struct Detection {
    simulation: Option<String>,
    /// « windows » ou « macos » : quelques textes de la fenêtre en dépendent.
    platform: &'static str,
    /// macOS : app par laquelle Steam s'ouvre avec Steam Upgraded.
    launcher: Option<String>,
    version: &'static str,
    steam: SteamInfo,
    millennium: MillenniumInfo,
    plugin: Option<plugin::Installed>,
}

fn steam_of(env: &Env) -> Result<PathBuf, String> {
    env.steam.clone().ok_or_else(|| "Steam est introuvable sur cet ordinateur.".to_string())
}

#[tauri::command]
fn detect(env: State<Env>) -> Detection {
    let steam = env.steam.clone();
    let millennium = match &steam {
        Some(s) => millennium::detect(&env, s),
        None => millennium::Installed { installed: false, version: None, compatible: false },
    };
    Detection {
        simulation: env.simulation.clone(),
        platform: if cfg!(windows) { "windows" } else { "macos" },
        #[cfg(windows)]
        launcher: None,
        #[cfg(target_os = "macos")]
        launcher: Some(env::launcher_path().display().to_string()),
        version: plugin::VERSION,
        steam: SteamInfo {
            found: steam.is_some(),
            path: steam.as_ref().map(|p| p.display().to_string()),
            running: steam.is_some() && env.steam_running(),
        },
        millennium: MillenniumInfo {
            by_installer: steam.as_ref().is_some_and(|s| plugin::read_marker(s).millennium_installed_by_installer),
            installed: millennium,
            min_version: millennium::version_string(millennium::pinned_version()),
        },
        plugin: steam.as_ref().map(|s| plugin::detect(s)),
    }
}

#[tauri::command]
async fn millennium_latest() -> Result<millennium::Release, String> {
    // Nom gardé pour la fenêtre : c'est désormais la version figée (millennium.lock.json), pas la dernière publiée.
    millennium::pinned()
}

#[tauri::command]
fn steam_running(env: State<Env>) -> bool {
    env.steam.is_some() && env.steam_running()
}

/// Vérifie une clé SteamGridDB : "ok", "refusee" ou "injoignable".
#[tauri::command]
async fn sgdb_check(env: State<'_, Env>, key: String) -> Result<&'static str, String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Ok("refusee");
    }
    if env.scenario() == "erreur-reseau" {
        return Ok("injoignable");
    }
    let res = reqwest::Client::builder()
        .user_agent("SteamUpgraded-Installeur")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .get("https://www.steamgriddb.com/api/v2/search/autocomplete/portal")
        .bearer_auth(&key)
        .send()
        .await;
    Ok(match res {
        Ok(r) if r.status().is_success() => "ok",
        Ok(r) if r.status().as_u16() == 401 || r.status().as_u16() == 403 => "refusee",
        _ => "injoignable",
    })
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let allowed = ["https://www.steamgriddb.com/", "https://github.com/SteamClientHomebrew/", "https://steambrew.app/", "https://docs.steambrew.app/"];
    if !allowed.iter().any(|p| url.starts_with(p)) {
        return Err("Adresse non autorisée.".into());
    }
    system::open_url(&url);
    Ok(())
}

#[derive(Serialize, Clone)]
struct Step<'a> {
    id: &'a str,
    state: &'a str,
    detail: String,
}

/// Où vont les étapes et la progression : la fenêtre, ou la console (mode sans fenêtre de développement).
#[derive(Clone)]
struct Out(std::sync::Arc<dyn Fn(&str, serde_json::Value) + Send + Sync>);

impl Out {
    fn window(app: AppHandle) -> Out {
        Out(std::sync::Arc::new(move |event, payload| {
            let _ = app.emit(event, payload);
        }))
    }

    #[cfg(debug_assertions)]
    fn console() -> Out {
        Out(std::sync::Arc::new(|event, payload| {
            if event == "etape" {
                println!("[{}] {} {}", payload["state"].as_str().unwrap_or(""), payload["id"].as_str().unwrap_or(""), payload["detail"].as_str().unwrap_or(""));
            }
        }))
    }
}

fn step(out: &Out, id: &str, state: &str, detail: impl Into<String>) {
    (out.0)("etape", serde_json::to_value(Step { id, state, detail: detail.into() }).unwrap_or_default());
}

/// Ferme Steam comme Steam › Quitter et attend la fin du processus.
async fn close_steam(out: &Out, env: &Env) -> Result<bool, String> {
    if !env.steam_running() {
        step(out, "fermer", "ok", "Steam n'était pas ouvert");
        return Ok(false);
    }
    step(out, "fermer", "run", "Fermeture demandée, en attente de Steam…");
    env.request_steam_shutdown()?;
    let start = Instant::now();
    while env.steam_running() {
        if start.elapsed() > Duration::from_secs(env.shutdown_timeout_secs()) {
            return Err("Steam ne s'est pas fermé. Un jeu ou une fenêtre de Steam attend peut-être une réponse : fermez Steam vous-même (Steam › Quitter), puis réessayez.".into());
        }
        tokio_sleep(500).await;
    }
    // Laisse Steam et Millennium relâcher leurs fichiers.
    tokio_sleep(if env.is_sim() { 200 } else { 2500 }).await;
    step(out, "fermer", "ok", "");
    Ok(true)
}

async fn tokio_sleep(ms: u64) {
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(Duration::from_millis(ms))).await.ok();
}

fn relaunch(out: &Out, env: &Env, was_running: bool) -> Result<(), String> {
    step(out, "relancer", "run", "");
    env.launch_steam()?;
    let _ = was_running;
    step(out, "relancer", "ok", "");
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallOptions {
    install_millennium: bool,
    sgdb_key: Option<String>,
}

/// Installe (ou répare) : Millennium si demandé, puis le plugin. En cas d'échec, tout est remis en place et Steam relancé.
#[tauri::command]
async fn install(app: AppHandle, env: State<'_, Env>, options: InstallOptions) -> Result<(), String> {
    install_impl(Out::window(app), env.inner().clone(), options).await
}

async fn install_impl(out: Out, env: Env, options: InstallOptions) -> Result<(), String> {
    let steam = steam_of(&env)?;
    let mut backup = Backup::new();
    #[cfg(target_os = "macos")]
    let mut mac_state = millennium::MacInstall::default();
    let mut current = "fermer";
    let mut was_running = false;
    let result: Result<(), String> = async {
        was_running = close_steam(&out, &env).await?;

        let mut marker = plugin::read_marker(&steam);
        if options.install_millennium {
            current = "telecharger";
            step(&out, current, "run", "Version de Millennium testée avec Steam Upgraded…");
            let mut rel = millennium::pinned()?;
            rel.url = env.github_download(&rel.url);
            let out2 = out.clone();
            let label = format!("Millennium {}", rel.version);
            let zip = millennium::download(&rel, move |got, total| {
                (out2.0)("progression", serde_json::json!([got, total]));
            })
            .await?;
            step(&out, current, "ok", format!("{label}, empreinte SHA-256 conforme à la publication officielle"));
            current = "millennium";
            step(&out, current, "run", "");
            #[cfg(windows)]
            let files = millennium::extract(&zip, &steam, &mut backup)?;
            #[cfg(target_os = "macos")]
            let files = millennium::install_mac(&zip, &rel.tag, &plugin::millennium_dir(&steam), &mut mac_state)?;
            marker.millennium_installed_by_installer = true;
            marker.millennium_files = files;
            step(&out, current, "ok", label);
        }

        current = "plugin";
        step(&out, current, "run", "Copie du plugin dans le dossier de Millennium");
        plugin::copy(&steam, &mut backup)?;
        step(&out, current, "ok", "");

        current = "activer";
        step(&out, current, "run", "");
        plugin::enable(&steam, options.sgdb_key.as_deref(), options.install_millennium, &mut backup)?;
        marker.plugin_version = Some(plugin::VERSION.to_string());
        plugin::write_marker(&steam, &marker, &mut backup)?;
        step(&out, current, "ok", if options.sgdb_key.as_deref().is_some_and(|k| !k.trim().is_empty()) { "Clé SteamGridDB enregistrée" } else { "" });
        Ok(())
    }
    .await;

    match result {
        Ok(()) => {
            #[cfg(target_os = "macos")]
            mac_state.commit();
            relaunch(&out, &env, was_running)?;
            Ok(())
        }
        Err(e) => {
            backup.restore();
            #[cfg(target_os = "macos")]
            mac_state.rollback(&plugin::millennium_dir(&steam));
            step(&out, current, "err", e.clone());
            if was_running {
                let _ = env.launch_steam();
            }
            Err(e)
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UninstallOptions {
    remove_millennium: bool,
}

/// Retire le plugin et ses réglages ; Millennium aussi si l'installeur l'avait posé et si c'est demandé.
#[tauri::command]
async fn uninstall(app: AppHandle, env: State<'_, Env>, options: UninstallOptions) -> Result<(), String> {
    uninstall_impl(Out::window(app), env.inner().clone(), options).await
}

async fn uninstall_impl(out: Out, env: Env, options: UninstallOptions) -> Result<(), String> {
    let steam = steam_of(&env)?;
    let mut backup = Backup::new();
    let mut current = "fermer";
    let mut was_running = false;
    let result: Result<(), String> = async {
        was_running = close_steam(&out, &env).await?;
        current = "plugin";
        step(&out, current, "run", "");
        plugin::uninstall(&steam, &mut backup)?;
        step(&out, current, "ok", "");

        let marker = plugin::read_marker(&steam);
        current = "millennium";
        if options.remove_millennium && marker.millennium_installed_by_installer {
            step(&out, current, "run", "");
            #[cfg(windows)]
            for rel in &marker.millennium_files {
                if rel.contains("..") {
                    continue;
                }
                backup.remove(&steam.join(rel))?;
            }
            backup.remove(&plugin::millennium_dir(&steam).join(plugin::MARKER))?;
            // macOS : dossiers entiers, retirés en dernier (rien à remettre en place ensuite)
            #[cfg(target_os = "macos")]
            millennium::uninstall_mac(&plugin::millennium_dir(&steam), &marker.millennium_files)?;
            step(&out, current, "ok", "");
        } else {
            let mut m = marker.clone();
            m.plugin_version = None;
            plugin::write_marker(&steam, &m, &mut backup)?;
            step(&out, current, "skip", "Millennium reste installé");
        }
        Ok(())
    }
    .await;

    match result {
        Ok(()) => {
            relaunch(&out, &env, was_running)?;
            Ok(())
        }
        Err(e) => {
            backup.restore();
            step(&out, current, "err", e.clone());
            if was_running {
                let _ = env.launch_steam();
            }
            Err(e)
        }
    }
}

/// Développement seulement : `steam-upgraded-installeur --sans-fenetre installer|desinstaller [--simulation …]` fait la même
/// chose que la fenêtre, avec les choix par défaut (Millennium posé s'il manque ou diffère, pas de clé SteamGridDB ;
/// à la désinstallation, Millennium retiré s'il avait été posé par l'installeur).
#[cfg(debug_assertions)]
fn headless() -> Option<i32> {
    let args: Vec<String> = std::env::args().collect();
    let i = args.iter().position(|a| a == "--sans-fenetre")?;
    let env = Env::from_args();
    let Some(steam) = env.steam.clone() else {
        eprintln!("Steam est introuvable.");
        return Some(1);
    };
    let what = args.get(i + 1).map(String::as_str).unwrap_or("installer");
    let res = tauri::async_runtime::block_on(async {
        if what == "desinstaller" {
            uninstall_impl(Out::console(), env, UninstallOptions { remove_millennium: true }).await
        } else {
            let m = millennium::detect(&env, &steam);
            install_impl(Out::console(), env, InstallOptions { install_millennium: !m.installed || !m.compatible, sgdb_key: None }).await
        }
    });
    match res {
        Ok(()) => Some(0),
        Err(e) => {
            eprintln!("Échec : {e}");
            Some(1)
        }
    }
}

fn main() {
    #[cfg(debug_assertions)]
    if let Some(code) = headless() {
        std::process::exit(code);
    }
    tauri::Builder::default()
        .manage(Env::from_args())
        .invoke_handler(tauri::generate_handler![detect, millennium_latest, steam_running, sgdb_check, open_url, install, uninstall])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer l'installeur");
}
