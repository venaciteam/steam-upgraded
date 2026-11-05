// Millennium : version installée, publication officielle à installer, téléchargement vérifié, copie.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
#[cfg(windows)]
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::env::Env;

/// Version de Millennium testée avec cette version de Steam Upgraded (racine du dépôt, partagée avec le plugin).
/// L'installeur pose exactement celle-ci, ni plus ancienne ni plus récente.
const LOCK: &str = include_str!("../../../millennium.lock.json");
const UA: &str = "SteamUpgraded-Installeur";

#[derive(Serialize, Clone, Debug)]
pub struct Installed {
    pub installed: bool,
    pub version: Option<String>,
    pub compatible: bool,
}

pub fn version_string(v: (u32, u32, u32)) -> String {
    format!("{}.{}.{}", v.0, v.1, v.2)
}

fn parse_version(s: &str) -> Option<(u32, u32, u32)> {
    let s = s.trim().trim_start_matches('v');
    let s = s.split(['-', '+']).next()?;
    let mut it = s.split('.').map(|p| p.parse::<u32>().ok());
    Some((it.next()??, it.next()?.unwrap_or(0), it.next().flatten().unwrap_or(0)))
}

/// Version figée, lue dans millennium.lock.json.
pub fn pinned_version() -> (u32, u32, u32) {
    let lock: serde_json::Value = serde_json::from_str(LOCK).expect("millennium.lock.json");
    parse_version(lock["version"].as_str().unwrap_or_default()).expect("version de millennium.lock.json")
}

pub fn is_compatible(v: (u32, u32, u32)) -> bool {
    v == pinned_version()
}

#[cfg(windows)]
pub fn detect(env: &Env, steam: &Path) -> Installed {
    let loader = steam.join("wsock32.dll");
    let lib = steam.join("millennium").join("lib").join("millennium.dll");
    if !loader.is_file() || !lib.is_file() {
        return Installed { installed: false, version: None, compatible: false };
    }
    let mut v = crate::system::file_versions(&lib).iter().filter_map(|s| parse_version(s)).find(|v| v.0 > 0);
    if v.is_none() && env.is_sim() {
        v = fs::read_to_string(steam.join("millennium").join("simulation-version.txt")).ok().and_then(|s| parse_version(&s));
    }
    Installed {
        installed: true,
        version: v.map(version_string),
        compatible: v.map(is_compatible).unwrap_or(false),
    }
}

/// macOS : Millennium est installé si le runtime courant et notre app lanceur sont là ; version = nom du dossier du runtime.
#[cfg(target_os = "macos")]
pub fn detect(_env: &Env, steam: &Path) -> Installed {
    let current = crate::plugin::millennium_dir(steam).join("runtime").join("current");
    if !current.join("libmillennium.dylib").is_file() || !crate::env::launcher_path().is_dir() {
        return Installed { installed: false, version: None, compatible: false };
    }
    let v = fs::read_link(&current).ok().and_then(|t| t.file_name().and_then(|n| parse_version(&n.to_string_lossy())));
    Installed { installed: true, version: v.map(version_string), compatible: v.map(is_compatible).unwrap_or(false) }
}

#[derive(Clone, Debug, Serialize)]
pub struct Release {
    pub tag: String,
    pub version: String,
    pub url: String,
    pub size: u64,
    pub sha256: Option<String>,
    pub sha_url: Option<String>,
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .expect("client HTTP")
}

/// Publication officielle de la version figée (adresse, taille et empreinte viennent de millennium.lock.json).
pub fn pinned() -> Result<Release, String> {
    let lock: serde_json::Value = serde_json::from_str(LOCK).map_err(|_| "millennium.lock.json illisible.".to_string())?;
    // Windows : publication officielle de Millennium. macOS : notre compilation (millennium/build-macos.sh), jointe aux
    // publications de Steam Upgraded, Millennium n'en publiant pas.
    #[cfg(windows)]
    let (key, prefix, system) = ("windows", "https://github.com/SteamClientHomebrew/Millennium/releases/download/", "Windows");
    #[cfg(target_os = "macos")]
    let (key, prefix, system) = ("macos", "https://github.com/venaciteam/steam-upgraded/releases/download/", "macOS");
    let win = &lock[key];
    let url = win["url"].as_str().filter(|u| u.starts_with(prefix));
    let sha = win["sha256"].as_str().filter(|h| h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit()));
    let (Some(url), Some(sha)) = (url, sha) else {
        #[cfg(all(target_os = "macos", debug_assertions))]
        if let Some(rel) = dev_local_archive() {
            return Ok(rel);
        }
        return Err(format!("Version de Millennium à installer introuvable pour {system}."));
    };
    let tag = lock["tag"].as_str().unwrap_or_default().to_string();
    Ok(Release {
        version: version_string(pinned_version()),
        tag,
        url: url.to_string(),
        size: win["size"].as_u64().unwrap_or(0),
        sha256: Some(sha.to_lowercase()),
        sha_url: None,
    })
}

/// Télécharge l'archive et vérifie son empreinte SHA-256 ; `progress` reçoit (reçu, total).
pub async fn download(rel: &Release, progress: impl Fn(u64, u64)) -> Result<Vec<u8>, String> {
    #[cfg(all(target_os = "macos", debug_assertions))]
    if let Some(path) = rel.url.strip_prefix("file://") {
        let data = fs::read(path).map_err(|e| format!("Archive locale illisible ({e})."))?;
        progress(data.len() as u64, data.len() as u64);
        return Ok(data);
    }
    let expected = match &rel.sha256 {
        Some(h) => h.clone(),
        None => {
            let url = rel.sha_url.as_ref().ok_or("Aucune empreinte publiée pour cette version de Millennium : installation refusée.")?;
            let text = client().get(url).send().await.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())?;
            text.split_whitespace().next().unwrap_or_default().to_lowercase()
        }
    };
    let mut res = client()
        .get(&rel.url)
        .send()
        .await
        .map_err(|_| "Le téléchargement de Millennium a échoué. Vérifiez la connexion à Internet, puis réessayez.".to_string())?;
    if !res.status().is_success() {
        return Err(format!("Le téléchargement de Millennium a échoué (erreur {}).", res.status().as_u16()));
    }
    let total = res.content_length().unwrap_or(rel.size);
    let mut data = Vec::with_capacity(total as usize);
    while let Some(chunk) = res.chunk().await.map_err(|_| "Le téléchargement de Millennium a été interrompu.".to_string())? {
        data.extend_from_slice(&chunk);
        progress(data.len() as u64, total);
    }
    let got = format!("{:x}", Sha256::digest(&data));
    if got != expected {
        return Err("L'archive téléchargée ne correspond pas à l'empreinte publiée par Millennium : installation refusée.".into());
    }
    Ok(data)
}

/// Fichiers remplacés pendant une copie, pour tout remettre en place en cas d'échec.
#[derive(Default)]
pub struct Backup {
    dir: Option<PathBuf>,
    /// (destination, copie de l'ancien fichier ou `None` s'il n'existait pas)
    entries: Vec<(PathBuf, Option<PathBuf>)>,
}

impl Backup {
    pub fn new() -> Backup {
        let dir = std::env::temp_dir().join(format!("steam-upgraded-sauvegarde-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        Backup { dir: Some(dir), entries: vec![] }
    }

    /// Écrit `bytes` à `dest` en gardant l'ancien contenu de côté.
    pub fn write(&mut self, dest: &Path, bytes: &[u8]) -> Result<(), String> {
        let saved = if dest.is_file() {
            let copy = self.dir.as_ref().unwrap().join(format!("{}", self.entries.len()));
            fs::copy(dest, &copy).map_err(|e| explain_io(dest, e))?;
            Some(copy)
        } else {
            None
        };
        self.entries.push((dest.to_path_buf(), saved));
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| explain_io(parent, e))?;
        }
        fs::write(dest, bytes).map_err(|e| explain_io(dest, e))
    }

    /// Supprime `dest` en gardant une copie.
    pub fn remove(&mut self, dest: &Path) -> Result<(), String> {
        if !dest.is_file() {
            return Ok(());
        }
        let copy = self.dir.as_ref().unwrap().join(format!("{}", self.entries.len()));
        fs::copy(dest, &copy).map_err(|e| explain_io(dest, e))?;
        self.entries.push((dest.to_path_buf(), Some(copy)));
        fs::remove_file(dest).map_err(|e| explain_io(dest, e))
    }

    pub fn restore(&mut self) {
        for (dest, saved) in self.entries.drain(..).rev() {
            match saved {
                Some(copy) => {
                    let _ = fs::copy(&copy, &dest);
                }
                None => {
                    let _ = fs::remove_file(&dest);
                }
            }
        }
    }
}

impl Drop for Backup {
    fn drop(&mut self) {
        if let Some(dir) = &self.dir {
            let _ = fs::remove_dir_all(dir);
        }
    }
}

pub fn explain_io(path: &Path, e: std::io::Error) -> String {
    match e.kind() {
        #[cfg(windows)]
        std::io::ErrorKind::PermissionDenied => format!(
            "Accès refusé à {}. Relancez l'installeur en tant qu'administrateur (clic droit › Exécuter en tant qu'administrateur).",
            path.display()
        ),
        #[cfg(target_os = "macos")]
        std::io::ErrorKind::PermissionDenied => format!("Accès refusé à {}. Vérifiez les droits de ce dossier, puis réessayez.", path.display()),
        _ => format!("Impossible d'écrire {} ({e}).", path.display()),
    }
}

/// Copie le contenu de l'archive dans le dossier de Steam ; renvoie les fichiers posés (chemins relatifs).
#[cfg(windows)]
pub fn extract(zip_bytes: &[u8], steam: &Path, backup: &mut Backup) -> Result<Vec<String>, String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes)).map_err(|_| "Archive de Millennium illisible.".to_string())?;
    let mut files = vec![];
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|_| "Archive de Millennium illisible.".to_string())?;
        if entry.is_dir() {
            continue;
        }
        let rel = entry.enclosed_name().ok_or("Archive de Millennium invalide (chemin hors du dossier).")?;
        let mut bytes = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut bytes).map_err(|_| "Archive de Millennium illisible.".to_string())?;
        backup.write(&steam.join(&rel), &bytes)?;
        files.push(rel.to_string_lossy().replace('\\', "/"));
    }
    if files.is_empty() {
        return Err("Archive de Millennium vide.".into());
    }
    Ok(files)
}

// ---------- macOS : runtime de Millennium et app lanceur ----------

/// Développement seulement : `STEAM_UPGRADED_MILLENNIUM_ARCHIVE=/chemin/millennium-…-macos-arm64.tar.gz` remplace la
/// publication tant que l'entrée « macos » de millennium.lock.json est vide (aucune empreinte vérifiée : jamais en version finale).
#[cfg(all(target_os = "macos", debug_assertions))]
fn dev_local_archive() -> Option<Release> {
    let path = std::env::var("STEAM_UPGRADED_MILLENNIUM_ARCHIVE").ok()?;
    let data = fs::read(&path).ok()?;
    let lock: serde_json::Value = serde_json::from_str(LOCK).ok()?;
    Some(Release {
        version: version_string(pinned_version()),
        tag: lock["tag"].as_str().unwrap_or_default().to_string(),
        url: format!("file://{path}"),
        size: data.len() as u64,
        sha256: Some(format!("{:x}", Sha256::digest(&data))),
        sha_url: None,
    })
}

/// Fichiers de l'app lanceur, liés au runtime courant (même disposition que scripts/macos/install_macos.sh de Millennium).
#[cfg(target_os = "macos")]
const LAUNCHER_LINKS: [(&str, &str); 7] = [
    ("MacOS/steam_osx", "steam_osx"),
    ("MacOS/libmillennium_bootstrap.dylib", "libmillennium_bootstrap.dylib"),
    ("MacOS/libmillennium.dylib", "libmillennium.dylib"),
    ("MacOS/libmillennium_hhx64.dylib", "libmillennium_hhx64.dylib"),
    ("MacOS/libmillennium_child_hook.dylib", "libmillennium_child_hook.dylib"),
    ("MacOS/libmillennium_luavm_x86", "libmillennium_luavm_x86"),
    ("Resources/millennium-assets", "millennium-assets"),
];

#[cfg(target_os = "macos")]
const LAUNCHER_ICON: &[u8] = include_bytes!("../icons/icon.icns");

#[cfg(target_os = "macos")]
fn launcher_plist(version: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>fr</string>
    <key>CFBundleExecutable</key>
    <string>steam_osx</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.venacity.steamupgraded.lanceur</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleDisplayName</key>
    <string>Steam Upgraded</string>
    <key>CFBundleName</key>
    <string>Steam Upgraded</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>{version}</string>
    <key>CFBundleVersion</key>
    <string>{version}</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
    </array>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
"#
    )
}

/// Ce qui a été posé, pour revenir en arrière si la suite de l'installation échoue.
#[cfg(target_os = "macos")]
#[derive(Default)]
pub struct MacInstall {
    new_runtime: Option<PathBuf>,
    /// Runtime de même étiquette déjà présent (réparation) : (emplacement, copie mise de côté)
    replaced_runtime: Option<(PathBuf, PathBuf)>,
    previous_current: Option<PathBuf>,
    launcher_backup: Option<PathBuf>,
    launcher_written: bool,
    done: bool,
}

#[cfg(target_os = "macos")]
impl MacInstall {
    /// Installation terminée : on garde tout, et on jette l'ancienne app lanceur.
    pub fn commit(&mut self) {
        self.done = true;
        if let Some((_, aside)) = self.replaced_runtime.take() {
            let _ = fs::remove_dir_all(aside);
        }
        if let Some(b) = self.launcher_backup.take() {
            let _ = fs::remove_dir_all(b);
        }
    }

    pub fn rollback(&mut self, home: &Path) {
        if self.done {
            return;
        }
        let current = home.join("runtime").join("current");
        let _ = fs::remove_file(&current);
        if let Some(prev) = self.previous_current.take() {
            let _ = std::os::unix::fs::symlink(prev, &current);
        }
        if let Some(dir) = self.new_runtime.take() {
            let _ = fs::remove_dir_all(dir);
        }
        if let Some((place, aside)) = self.replaced_runtime.take() {
            let _ = fs::rename(aside, place);
        }
        let launcher = crate::env::launcher_path();
        if self.launcher_written {
            let _ = fs::remove_dir_all(&launcher);
        }
        if let Some(b) = self.launcher_backup.take() {
            let _ = fs::rename(b, &launcher);
        }
    }
}

/// Pose le runtime de l'archive dans <Millennium>/runtime/<étiquette>, fait pointer runtime/current dessus et crée l'app
/// lanceur. Renvoie les dossiers posés (relatifs au dossier de Millennium) pour la désinstallation.
#[cfg(target_os = "macos")]
pub fn install_mac(tar_gz: &[u8], tag: &str, home: &Path, state: &mut MacInstall) -> Result<Vec<String>, String> {
    use std::os::unix::fs::symlink;
    let runtime_root = home.join("runtime");
    fs::create_dir_all(&runtime_root).map_err(|e| explain_io(&runtime_root, e))?;

    // 1. Archive décompressée à part, puis le dossier runtime/ renommé en runtime/<étiquette>
    let staging = runtime_root.join(format!(".installation-{}", std::process::id()));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|e| explain_io(&staging, e))?;
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(std::io::Cursor::new(tar_gz)));
    archive.set_preserve_permissions(true);
    let unpacked = archive.unpack(&staging);
    let inner = fs::read_dir(&staging).ok().and_then(|mut d| d.next()).and_then(|e| e.ok()).map(|e| e.path().join("runtime"));
    let Some(inner) = inner.filter(|p| unpacked.is_ok() && p.join("steam_osx").is_file()) else {
        let _ = fs::remove_dir_all(&staging);
        return Err("Archive de Millennium illisible ou incomplète.".into());
    };
    let target = runtime_root.join(tag);
    if target.exists() {
        // Même version déjà là (réparation) : mise de côté jusqu'à la fin de l'installation
        let aside = runtime_root.join(format!(".remplace-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&aside);
        fs::rename(&target, &aside).map_err(|e| explain_io(&target, e))?;
        state.replaced_runtime = Some((target.clone(), aside));
    }
    fs::rename(&inner, &target).map_err(|e| explain_io(&target, e))?;
    let _ = fs::remove_dir_all(&staging);
    state.new_runtime = Some(target.clone());

    // 2. runtime/current -> runtime/<étiquette>
    let current = runtime_root.join("current");
    state.previous_current = fs::read_link(&current).ok();
    let _ = fs::remove_file(&current);
    symlink(&target, &current).map_err(|e| explain_io(&current, e))?;

    // 3. App lanceur : l'ancienne est mise de côté jusqu'à la fin
    let launcher = crate::env::launcher_path();
    if launcher.exists() {
        let b = launcher.with_extension(format!("app-ancienne-{}", std::process::id()));
        fs::rename(&launcher, &b).map_err(|e| explain_io(&launcher, e))?;
        state.launcher_backup = Some(b);
    }
    state.launcher_written = true;
    let contents = launcher.join("Contents");
    for d in ["MacOS", "Resources"] {
        fs::create_dir_all(contents.join(d)).map_err(|e| explain_io(&contents, e))?;
    }
    fs::write(contents.join("Info.plist"), launcher_plist(&version_string(pinned_version()))).map_err(|e| explain_io(&contents, e))?;
    fs::write(contents.join("Resources").join("AppIcon.icns"), LAUNCHER_ICON).map_err(|e| explain_io(&contents, e))?;
    for (link, file) in LAUNCHER_LINKS {
        symlink(current.join(file), contents.join(link)).map_err(|e| explain_io(&contents, e))?;
    }
    Ok(vec![format!("runtime/{tag}")])
}

/// Retire ce que l'installeur avait posé sur macOS : runtime(s), lien courant, app lanceur.
#[cfg(target_os = "macos")]
pub fn uninstall_mac(home: &Path, files: &[String]) -> Result<(), String> {
    for rel in files {
        if rel.contains("..") || !rel.starts_with("runtime/") {
            continue;
        }
        let dir = home.join(rel);
        if dir.is_dir() {
            fs::remove_dir_all(&dir).map_err(|e| explain_io(&dir, e))?;
        }
    }
    let current = home.join("runtime").join("current");
    if fs::read_link(&current).is_ok_and(|t| !t.exists()) {
        let _ = fs::remove_file(&current);
    }
    let launcher = crate::env::launcher_path();
    if launcher.is_dir() {
        fs::remove_dir_all(&launcher).map_err(|e| explain_io(&launcher, e))?;
    }
    Ok(())
}

#[cfg(all(test, target_os = "macos"))]
mod tests_mac {
    use super::*;

    /// Pose réelle de l'archive (millennium/dist, produite par millennium/build-macos.sh) dans un dossier temporaire :
    /// installation, réparation, retour en arrière, désinstallation. Ignoré si l'archive n'a pas été compilée.
    #[test]
    fn installation_mac_complete() {
        let archive = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../millennium/dist/millennium-v3.6.2-macos-arm64.tar.gz");
        let Ok(data) = fs::read(&archive) else {
            eprintln!("archive absente, test ignoré : {}", archive.display());
            return;
        };
        let base = std::env::temp_dir().join(format!("su-test-mac-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let home = base.join("Millennium");
        crate::env::set_mac_paths_for_tests(home.clone(), base.join("Applications"));
        fs::create_dir_all(base.join("Applications")).unwrap();
        let launcher = crate::env::launcher_path();

        // Installation
        let mut st = MacInstall::default();
        let files = install_mac(&data, "v3.6.2", &home, &mut st).expect("installation");
        st.commit();
        assert_eq!(files, vec!["runtime/v3.6.2".to_string()]);
        let current = home.join("runtime/current");
        assert_eq!(fs::read_link(&current).unwrap(), home.join("runtime/v3.6.2"));
        assert!(current.join("steam_osx").is_file());
        let mode = std::os::unix::fs::PermissionsExt::mode(&fs::metadata(current.join("steam_osx")).unwrap().permissions());
        assert!(mode & 0o111 != 0, "steam_osx doit rester exécutable");
        assert!(launcher.join("Contents/MacOS/steam_osx").is_file(), "lien du lanceur vers le runtime");
        assert!(launcher.join("Contents/Resources/millennium-assets/loader/millennium.js").is_file());
        assert!(fs::read_to_string(launcher.join("Contents/Info.plist")).unwrap().contains("<string>Steam Upgraded</string>"));
        let det = detect(&crate::env::Env { simulation: None, steam: Some(base.join("Steam")) }, &base.join("Steam"));
        assert!(det.installed && det.compatible && det.version.as_deref() == Some("3.6.2"));

        // Réparation (même version) puis échec simulé : tout revient comme avant
        let mut st2 = MacInstall::default();
        install_mac(&data, "v3.6.2", &home, &mut st2).expect("réparation");
        st2.rollback(&home);
        assert!(current.join("steam_osx").is_file(), "réparation annulée : le runtime d'avant est toujours là");
        assert!(fs::read_dir(home.join("runtime")).unwrap().flatten().all(|e| !e.file_name().to_string_lossy().starts_with('.')), "aucun dossier temporaire laissé");
        let mut st2 = MacInstall::default();
        install_mac(&data, "v3.6.2", &home, &mut st2).expect("réparation");
        st2.commit();
        assert!(fs::read_dir(home.join("runtime")).unwrap().flatten().all(|e| !e.file_name().to_string_lossy().starts_with('.')), "copie mise de côté retirée");
        let mut st3 = MacInstall::default();
        install_mac(&data, "v9.9.9", &home, &mut st3).expect("autre version");
        assert_eq!(fs::read_link(&current).unwrap(), home.join("runtime/v9.9.9"));
        st3.rollback(&home);
        assert_eq!(fs::read_link(&current).unwrap(), home.join("runtime/v3.6.2"), "retour au runtime précédent");
        assert!(!home.join("runtime/v9.9.9").exists());
        assert!(launcher.join("Contents/MacOS/steam_osx").is_file(), "lanceur précédent remis en place");

        // Archive invalide : refusée sans rien toucher
        let mut st4 = MacInstall::default();
        assert!(install_mac(b"pas une archive", "v1.0.0", &home, &mut st4).is_err());
        assert_eq!(fs::read_link(&current).unwrap(), home.join("runtime/v3.6.2"));

        // Désinstallation
        uninstall_mac(&home, &files).expect("désinstallation");
        assert!(!home.join("runtime/v3.6.2").exists());
        assert!(fs::symlink_metadata(&current).is_err(), "lien courant retiré");
        assert!(!launcher.exists());
        let _ = fs::remove_dir_all(&base);
    }
}
