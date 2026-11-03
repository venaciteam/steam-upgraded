// Millennium : version installée, publication officielle à installer, téléchargement vérifié, copie.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::env::Env;

const REPO: &str = "SteamClientHomebrew/Millennium";
/// Version visée par le plugin ; une version 3.x plus récente reste acceptée.
pub const MIN_VERSION: (u32, u32, u32) = (3, 6, 0);
/// Publication de repli si la dernière version stable sort de la série 3.x.
const FALLBACK_TAG: &str = "v3.6.2";
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

pub fn is_compatible(v: (u32, u32, u32)) -> bool {
    v.0 == MIN_VERSION.0 && v >= MIN_VERSION
}

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

async fn release_by(env: &Env, path: &str) -> Result<Release, String> {
    let url = format!("{}/repos/{REPO}/releases/{path}", env.github_api());
    let res = client()
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| "GitHub ne répond pas. Vérifiez la connexion à Internet, puis réessayez.".to_string())?;
    if !res.status().is_success() {
        return Err(format!("GitHub a répondu avec l'erreur {}. Réessayez dans quelques minutes.", res.status().as_u16()));
    }
    let json: serde_json::Value = res.json().await.map_err(|_| "Réponse illisible de GitHub.".to_string())?;
    let tag = json["tag_name"].as_str().unwrap_or_default().to_string();
    let assets = json["assets"].as_array().cloned().unwrap_or_default();
    let zip = assets
        .iter()
        .find(|a| a["name"].as_str().is_some_and(|n| n.ends_with("-windows-x86_64.zip")))
        .ok_or("La publication de Millennium ne contient pas de version Windows.")?;
    let sha_url = assets
        .iter()
        .find(|a| a["name"].as_str().is_some_and(|n| n.ends_with("-windows-x86_64.sha256")))
        .and_then(|a| a["browser_download_url"].as_str().map(String::from));
    Ok(Release {
        version: parse_version(&tag).map(version_string).unwrap_or_else(|| tag.clone()),
        tag,
        url: zip["browser_download_url"].as_str().unwrap_or_default().to_string(),
        size: zip["size"].as_u64().unwrap_or(0),
        sha256: zip["digest"].as_str().and_then(|d| d.strip_prefix("sha256:")).map(|s| s.to_lowercase()),
        sha_url,
    })
}

/// Dernière version stable de Millennium compatible (3.x, 3.6 ou plus), sinon la publication de repli.
pub async fn latest(env: &Env) -> Result<Release, String> {
    let rel = release_by(env, "latest").await?;
    match parse_version(&rel.tag) {
        Some(v) if is_compatible(v) => Ok(rel),
        _ => release_by(env, &format!("tags/{FALLBACK_TAG}")).await,
    }
}

/// Télécharge l'archive et vérifie son empreinte SHA-256 ; `progress` reçoit (reçu, total).
pub async fn download(rel: &Release, progress: impl Fn(u64, u64)) -> Result<Vec<u8>, String> {
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
        std::io::ErrorKind::PermissionDenied => format!(
            "Accès refusé à {}. Relancez l'installeur en tant qu'administrateur (clic droit › Exécuter en tant qu'administrateur).",
            path.display()
        ),
        _ => format!("Impossible d'écrire {} ({e}).", path.display()),
    }
}

/// Copie le contenu de l'archive dans le dossier de Steam ; renvoie les fichiers posés (chemins relatifs).
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
