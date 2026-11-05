// Accès au système : chemin de Steam, processus, version d'un fichier, ouverture d'une adresse.
pub use imp::*;

/// Vrai si un processus de ce nom tourne (insensible à la casse).
pub fn process_running(name: &str) -> bool {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
    let sys = System::new_with_specifics(RefreshKind::nothing().with_processes(ProcessRefreshKind::nothing()));
    let mut sys = sys;
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    sys.processes().values().any(|p| p.name().to_string_lossy().eq_ignore_ascii_case(name))
}

#[cfg(windows)]
mod imp {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};

    fn wide(s: &OsStr) -> Vec<u16> {
        s.encode_wide().chain(std::iter::once(0)).collect()
    }

    /// Dossier de Steam lu dans le registre (compte courant d'abord, puis la machine).
    pub fn steam_path_from_registry() -> Option<PathBuf> {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        use winreg::RegKey;
        let candidates: [(winreg::HKEY, &str, &str); 3] = [
            (HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam", "InstallPath"),
        ];
        for (root, key, value) in candidates {
            if let Ok(k) = RegKey::predef(root).open_subkey(key) {
                if let Ok(p) = k.get_value::<String, _>(value) {
                    let path = PathBuf::from(p.replace('/', "\\"));
                    if path.join("steam.exe").is_file() {
                        // Steam écrit SteamPath en minuscules : on reprend la casse réelle du dossier.
                        let real = std::fs::canonicalize(&path).ok().map(|c| {
                            let s = c.to_string_lossy().to_string();
                            PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
                        });
                        return Some(real.unwrap_or(path));
                    }
                }
            }
        }
        None
    }

    /// Versions déclarées dans les ressources d'un fichier, de la plus fiable à la moins fiable :
    /// textes ProductVersion et FileVersion, puis numéros binaires. Millennium laisse ses numéros binaires
    /// à 0.0.0 et n'écrit sa version (« v3.6.2 ») que dans les textes.
    pub fn file_versions(path: &Path) -> Vec<String> {
        use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW, VS_FIXEDFILEINFO};
        let p = wide(path.as_os_str());
        let mut out = vec![];
        unsafe {
            let mut handle = 0u32;
            let size = GetFileVersionInfoSizeW(p.as_ptr(), &mut handle);
            if size == 0 {
                return out;
            }
            let mut buf = vec![0u8; size as usize];
            if GetFileVersionInfoW(p.as_ptr(), 0, size, buf.as_mut_ptr().cast()) == 0 {
                return out;
            }
            let query = |q: &str| -> Option<(*mut core::ffi::c_void, u32)> {
                let q = wide(OsStr::new(q));
                let mut ptr: *mut core::ffi::c_void = std::ptr::null_mut();
                let mut len = 0u32;
                (VerQueryValueW(buf.as_ptr().cast(), q.as_ptr(), &mut ptr, &mut len) != 0 && !ptr.is_null()).then_some((ptr, len))
            };
            if let Some((ptr, len)) = query("\\VarFileInfo\\Translation") {
                let pairs = std::slice::from_raw_parts(ptr as *const u16, (len / 2) as usize);
                for lang in pairs.chunks_exact(2) {
                    for name in ["ProductVersion", "FileVersion"] {
                        if let Some((sp, sl)) = query(&format!("\\StringFileInfo\\{:04x}{:04x}\\{name}", lang[0], lang[1])) {
                            let text = String::from_utf16_lossy(std::slice::from_raw_parts(sp as *const u16, sl as usize));
                            out.push(text.trim_end_matches('\0').trim().to_string());
                        }
                    }
                }
            }
            if let Some((ptr, _)) = query("\\") {
                let fi = &*(ptr as *const VS_FIXEDFILEINFO);
                out.push(format!("{}.{}.{}", fi.dwFileVersionMS >> 16, fi.dwFileVersionMS & 0xffff, fi.dwFileVersionLS >> 16));
            }
        }
        out
    }

    /// Ouvre une adresse dans le navigateur par défaut.
    pub fn open_url(url: &str) {
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let op = wide(OsStr::new("open"));
        let target = wide(OsStr::new(url));
        unsafe {
            ShellExecuteW(std::ptr::null_mut(), op.as_ptr(), target.as_ptr(), std::ptr::null(), std::ptr::null(), SW_SHOWNORMAL);
        }
    }

    pub fn steam_path() -> Option<PathBuf> {
        steam_path_from_registry()
    }
}

#[cfg(target_os = "macos")]
mod imp {
    use std::path::PathBuf;

    /// Dossier de Steam : ~/Library/Application Support/Steam, s'il contient le client (Steam lancé au moins une fois).
    pub fn steam_path() -> Option<PathBuf> {
        let home = std::env::var_os("HOME").map(PathBuf::from)?;
        let steam = home.join("Library").join("Application Support").join("Steam");
        steam.join("Steam.AppBundle/Steam/Contents/MacOS/steam_osx").is_file().then_some(steam)
    }

    /// Ouvre une adresse dans le navigateur par défaut.
    pub fn open_url(url: &str) {
        let _ = std::process::Command::new("/usr/bin/open").arg(url).spawn();
    }
}
