// Où travaille l'installeur : le vrai Steam, ou un faux dossier Steam en mode simulation.
//
// Simulation : `steam-upgraded-installeur.exe --simulation [scénario]`. Un faux dossier Steam est recréé à chaque
// lancement dans %TEMP%\steam-upgraded-simulation\<scénario>\Steam ; le vrai Steam, Millennium et le registre ne
// sont jamais touchés. « Steam ouvert » y est un simple fichier témoin. Les téléchargements (GitHub, SteamGridDB)
// sont réels, sauf dans le scénario « erreur-reseau ».
use std::fs;
use std::path::{Path, PathBuf};

pub const SCENARIOS: [&str; 6] = ["vierge", "ancien", "installe", "sans-steam", "erreur-reseau", "steam-bloque"];

#[derive(Clone, Debug)]
pub struct Env {
    /// Scénario de simulation, `None` pour une vraie installation.
    pub simulation: Option<String>,
    /// Dossier de Steam, `None` s'il est introuvable.
    pub steam: Option<PathBuf>,
}

impl Env {
    pub fn from_args() -> Env {
        let args: Vec<String> = std::env::args().collect();
        if let Some(i) = args.iter().position(|a| a == "--simulation") {
            let scenario = args
                .get(i + 1)
                .filter(|s| SCENARIOS.contains(&s.as_str()))
                .cloned()
                .unwrap_or_else(|| "vierge".into());
            let steam = prepare_simulation(&scenario);
            return Env { simulation: Some(scenario), steam };
        }
        Env { simulation: None, steam: crate::system::steam_path_from_registry() }
    }

    pub fn is_sim(&self) -> bool {
        self.simulation.is_some()
    }

    pub fn scenario(&self) -> &str {
        self.simulation.as_deref().unwrap_or("")
    }

    fn sim_flag(&self) -> Option<PathBuf> {
        self.steam.as_ref().filter(|_| self.is_sim()).map(|s| s.join("simulation-steam-ouvert"))
    }

    pub fn steam_running(&self) -> bool {
        match self.sim_flag() {
            Some(flag) => flag.exists(),
            None => crate::system::process_running("steam.exe"),
        }
    }

    /// Demande à Steam de se fermer comme Steam › Quitter (jamais de fermeture forcée).
    pub fn request_steam_shutdown(&self) -> Result<(), String> {
        let steam = self.steam.as_ref().ok_or("Steam est introuvable.")?;
        if let Some(flag) = self.sim_flag() {
            if self.scenario() != "steam-bloque" {
                let flag = flag.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    let _ = fs::remove_file(flag);
                });
            }
            return Ok(());
        }
        std::process::Command::new(steam.join("steam.exe"))
            .arg("-shutdown")
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Impossible de demander la fermeture de Steam ({e})."))
    }

    pub fn launch_steam(&self) -> Result<(), String> {
        let steam = self.steam.as_ref().ok_or("Steam est introuvable.")?;
        if let Some(flag) = self.sim_flag() {
            return fs::write(flag, b"").map_err(|e| e.to_string());
        }
        std::process::Command::new(steam.join("steam.exe"))
            .current_dir(steam)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Impossible de relancer Steam ({e})."))
    }

    /// Temps laissé à Steam pour se fermer.
    pub fn shutdown_timeout_secs(&self) -> u64 {
        if self.is_sim() { 6 } else { 90 }
    }

    /// Hôte GitHub de l'API (un hôte invalide simule une coupure réseau).
    pub fn github_api(&self) -> &'static str {
        if self.scenario() == "erreur-reseau" { "https://api.github.invalid" } else { "https://api.github.com" }
    }
}

fn write(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(path, bytes);
}

/// Recrée le faux dossier Steam du scénario et renvoie son chemin (`None` pour « sans-steam »).
fn prepare_simulation(scenario: &str) -> Option<PathBuf> {
    let base = std::env::temp_dir().join("steam-upgraded-simulation").join(scenario);
    let _ = fs::remove_dir_all(&base);
    let steam = base.join("Steam");
    if scenario == "sans-steam" {
        let _ = fs::create_dir_all(&base);
        return None;
    }
    write(&steam.join("steam.exe"), b"");
    let _ = fs::create_dir_all(steam.join("steamapps"));
    let other_config = br#"{
  "general": { "accentColor": "DEFAULT_ACCENT_COLOR", "checkForMillenniumUpdates": true },
  "plugins": {
    "enabledPlugins": ["autre.plugin.exemple"],
    "autre.plugin.exemple": { "config": { "reglage": 1 } }
  },
  "themes": { "activeTheme": "default" }
}"#;
    match scenario {
        "ancien" | "steam-bloque" => {
            write(&steam.join("wsock32.dll"), b"");
            write(&steam.join("millennium").join("lib").join("millennium.dll"), b"");
            write(&steam.join("millennium").join("simulation-version.txt"), b"3.5.0");
            write(&steam.join("millennium").join("config").join("config.json"), other_config);
        }
        "installe" => {
            write(&steam.join("wsock32.dll"), b"");
            write(&steam.join("millennium").join("lib").join("millennium.dll"), b"");
            write(&steam.join("millennium").join("simulation-version.txt"), b"3.6.2");
            write(&steam.join("millennium").join("plugins").join(crate::plugin::STAR_NAME), crate::plugin::STAR);
            write(
                &steam.join("millennium").join("config").join("config.json"),
                br#"{
  "plugins": {
    "enabledPlugins": ["autre.plugin.exemple", "com.venacity.steamupgraded"],
    "autre.plugin.exemple": { "config": { "reglage": 1 } },
    "com.venacity.steamupgraded": { "config": { "theme": "oled", "sgdbKey": "cle-de-simulation" } }
  }
}"#,
            );
            write(
                &steam.join("millennium").join(crate::plugin::MARKER),
                br#"{ "pluginVersion": "0.1.0", "millenniumInstalledByInstaller": true, "millenniumFiles": ["wsock32.dll", "millennium/lib/millennium.dll", "millennium/simulation-version.txt"] }"#,
            );
            return Some(steam);
        }
        _ => {}
    }
    write(&steam.join("simulation-steam-ouvert"), b"");
    Some(steam)
}
