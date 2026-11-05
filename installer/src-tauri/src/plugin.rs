// Le plugin Steam Upgraded : fichier .star, activation et réglages dans la configuration de Millennium.
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

use crate::millennium::Backup;

pub const ID: &str = "com.venacity.steamupgraded";
pub const STAR_NAME: &str = "com.venacity.steamupgraded.star";
/// Plugin compilé par `installer/build.sh` (starlight pack).
pub const STAR: &[u8] = include_bytes!("../../payload/com.venacity.steamupgraded.star");
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
/// Notes de l'installeur, à côté de la configuration de Millennium.
pub const MARKER: &str = "steam-upgraded-installeur.json";

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Marker {
    #[serde(default)]
    pub plugin_version: Option<String>,
    #[serde(default)]
    pub millennium_installed_by_installer: bool,
    /// Windows : fichiers posés dans le dossier de Steam. macOS : dossiers du runtime, relatifs au dossier de Millennium.
    #[serde(default)]
    pub millennium_files: Vec<String>,
}

/// Dossier de Millennium : dans celui de Steam sous Windows, ~/Library/Application Support/Millennium sur macOS.
pub fn millennium_dir(steam: &Path) -> PathBuf {
    #[cfg(windows)]
    return steam.join("millennium");
    #[cfg(target_os = "macos")]
    {
        let _ = steam;
        crate::env::mac_paths().millennium.clone()
    }
}

/// Dossier des plugins : `plugins` (Millennium 3.6), ou `plugin` s'il est le seul présent.
pub fn plugins_dir(steam: &Path) -> PathBuf {
    let m = millennium_dir(steam);
    if !m.join("plugins").is_dir() && m.join("plugin").is_dir() {
        return m.join("plugin");
    }
    m.join("plugins")
}

pub fn config_path(steam: &Path) -> PathBuf {
    #[cfg(windows)]
    return millennium_dir(steam).join("config").join("config.json");
    #[cfg(target_os = "macos")]
    return millennium_dir(steam).join("config.json");
}

pub fn read_marker(steam: &Path) -> Marker {
    fs::read_to_string(millennium_dir(steam).join(MARKER))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn write_marker(steam: &Path, marker: &Marker, backup: &mut Backup) -> Result<(), String> {
    let text = serde_json::to_string_pretty(marker).unwrap();
    backup.write(&millennium_dir(steam).join(MARKER), text.as_bytes())
}

fn read_config(steam: &Path) -> Result<Value, String> {
    let path = config_path(steam);
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(text.trim_start_matches('\u{feff}'))
            .map_err(|_| format!("La configuration de Millennium est illisible ({}).", path.display())),
        Err(_) => Ok(json!({})),
    }
}

fn plugins_obj(cfg: &mut Value) -> &mut Map<String, Value> {
    if !cfg.is_object() {
        *cfg = json!({});
    }
    let root = cfg.as_object_mut().unwrap();
    let plugins = root.entry("plugins").or_insert_with(|| json!({}));
    if !plugins.is_object() {
        *plugins = json!({});
    }
    plugins.as_object_mut().unwrap()
}

#[derive(Serialize, Clone, Debug)]
pub struct Installed {
    pub installed: bool,
    pub enabled: bool,
    pub version: Option<String>,
    pub has_sgdb_key: bool,
}

pub fn detect(steam: &Path) -> Installed {
    let installed = plugins_dir(steam).join(STAR_NAME).is_file();
    let mut cfg = read_config(steam).unwrap_or(json!({}));
    let plugins = plugins_obj(&mut cfg);
    let enabled = plugins
        .get("enabledPlugins")
        .and_then(Value::as_array)
        .is_some_and(|a| a.iter().any(|v| v.as_str() == Some(ID)));
    let has_sgdb_key = plugins
        .get(ID)
        .and_then(|p| p["config"]["sgdbKey"].as_str())
        .is_some_and(|k| !k.is_empty());
    Installed { installed, enabled, version: read_marker(steam).plugin_version.filter(|_| installed), has_sgdb_key }
}

/// Version gardée de côté par la dernière mise à jour faite depuis Steam (`backend/updates.lua`), à côté du dossier
/// des plugins pour que Millennium ne la charge pas.
const PREVIOUS: [&str; 2] = ["steam-upgraded-precedente.star", "steam-upgraded-precedente.json"];

/// Retire la version gardée de côté : après un passage de l'installeur, elle ne correspond plus à « la version
/// d'avant » et Paramètres › Mises à jour proposerait d'y revenir.
fn remove_previous(steam: &Path, backup: &mut Backup) -> Result<(), String> {
    for name in PREVIOUS {
        backup.remove(&millennium_dir(steam).join(name))?;
    }
    Ok(())
}

/// Copie le fichier du plugin dans le dossier des plugins de Millennium.
pub fn copy(steam: &Path, backup: &mut Backup) -> Result<(), String> {
    backup.write(&plugins_dir(steam).join(STAR_NAME), STAR)?;
    remove_previous(steam, backup)
}

/// Active le plugin et enregistre la clé SteamGridDB si elle est donnée (les autres réglages sont gardés).
/// `skip_millennium_welcome` : Millennium vient d'être posé par l'installeur, sa fenêtre « Bienvenue sur Millennium »
/// est marquée comme déjà vue (l'installeur a déjà présenté Millennium).
pub fn enable(steam: &Path, sgdb_key: Option<&str>, skip_millennium_welcome: bool, backup: &mut Backup) -> Result<(), String> {
    let mut cfg = read_config(steam)?;
    if !cfg.is_object() {
        cfg = json!({});
    }
    // Millennium figé : ses mises à jour automatiques sont coupées (par défaut il installe seul ses nouvelles versions
    // au démarrage de Steam). Il change de version avec Steam Upgraded (installeur ou Paramètres › Mises à jour).
    {
        let root = cfg.as_object_mut().unwrap();
        let general = root.entry("general").or_insert_with(|| json!({}));
        if !general.is_object() {
            *general = json!({});
        }
        let g = general.as_object_mut().unwrap();
        g.insert("checkForMillenniumUpdates".into(), json!(false));
        g.insert("onMillenniumUpdate".into(), json!(0));
    }
    if skip_millennium_welcome {
        let root = cfg.as_object_mut().unwrap();
        let misc = root.entry("misc").or_insert_with(|| json!({}));
        if !misc.is_object() {
            *misc = json!({});
        }
        misc.as_object_mut().unwrap().insert("hasShownWelcomeModal".into(), json!(true));
    }
    {
        let plugins = plugins_obj(&mut cfg);
        let enabled = plugins.entry("enabledPlugins").or_insert_with(|| json!([]));
        if !enabled.is_array() {
            *enabled = json!([]);
        }
        let list = enabled.as_array_mut().unwrap();
        if !list.iter().any(|v| v.as_str() == Some(ID)) {
            list.push(json!(ID));
        }
        if let Some(key) = sgdb_key.map(str::trim).filter(|k| !k.is_empty()) {
            let entry = plugins.entry(ID).or_insert_with(|| json!({}));
            if !entry.is_object() {
                *entry = json!({});
            }
            let conf = entry.as_object_mut().unwrap().entry("config").or_insert_with(|| json!({}));
            if !conf.is_object() {
                *conf = json!({});
            }
            conf.as_object_mut().unwrap().insert("sgdbKey".into(), json!(key));
        }
    }
    write_config(steam, &cfg, backup)
}

/// Retire le plugin, son activation et ses réglages.
pub fn uninstall(steam: &Path, backup: &mut Backup) -> Result<(), String> {
    backup.remove(&plugins_dir(steam).join(STAR_NAME))?;
    remove_previous(steam, backup)?;
    if !config_path(steam).is_file() {
        return Ok(());
    }
    let mut cfg = read_config(steam)?;
    {
        let plugins = plugins_obj(&mut cfg);
        if let Some(list) = plugins.get_mut("enabledPlugins").and_then(Value::as_array_mut) {
            list.retain(|v| v.as_str() != Some(ID));
        }
        plugins.remove(ID);
    }
    write_config(steam, &cfg, backup)
}

fn write_config(steam: &Path, cfg: &Value, backup: &mut Backup) -> Result<(), String> {
    let path = config_path(steam);
    let text = serde_json::to_string_pretty(cfg).unwrap();
    backup.write(&path, text.as_bytes())
}
