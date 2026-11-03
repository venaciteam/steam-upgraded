// Aperçu dans un navigateur ordinaire (sans Tauri) : faux backend, pour regarder et capturer les écrans.
// Scénario par l'adresse : index.html?scenario=vierge|ancien|installe|sans-steam|erreur-reseau
'use strict';
if (!window.__TAURI__) {
  const scenario = new URLSearchParams(location.search).get('scenario') || 'vierge';
  const listeners = {};
  const emit = (name, payload) => (listeners[name] || []).forEach((fn) => fn({ payload }));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const installed = scenario === 'installe';
  const det = {
    simulation: `aperçu ${scenario}`,
    version: '0.1.0',
    steam: { found: scenario !== 'sans-steam', path: 'C:\\Program Files (x86)\\Steam', running: !installed },
    millennium: {
      installed: installed || scenario === 'ancien',
      version: installed ? '3.6.2' : scenario === 'ancien' ? '3.5.0' : null,
      compatible: installed,
      by_installer: installed,
      min_version: '3.6.0'
    },
    plugin: { installed, enabled: installed, version: installed ? '0.1.0' : null, has_sgdb_key: false }
  };
  const step = (id, state, detail = '') => emit('etape', { id, state, detail });
  const handlers = {
    detect: async () => JSON.parse(JSON.stringify(det)),
    millennium_latest: async () => { await wait(300); if (scenario === 'erreur-reseau') throw 'GitHub ne répond pas.'; return { version: '3.6.2' }; },
    steam_running: async () => det.steam.running,
    open_url: async () => {},
    sgdb_check: async ({ key }) => { await wait(700); return key.length >= 20 ? 'ok' : 'refusee'; },
    install: async ({ options }) => {
      step('fermer', 'run'); await wait(600); step('fermer', 'ok');
      if (options.installMillennium) {
        step('telecharger', 'run', 'Recherche de la dernière version stable…'); await wait(400);
        if (scenario === 'erreur-reseau') { const e = 'GitHub ne répond pas. Vérifiez la connexion à Internet, puis réessayez.'; step('telecharger', 'err', e); throw e; }
        for (let i = 1; i <= 8; i++) { emit('progression', [i * 500000, 4003247]); await wait(120); }
        step('telecharger', 'ok', 'Millennium 3.6.2, empreinte SHA-256 conforme à la publication officielle');
        step('millennium', 'run'); await wait(500); step('millennium', 'ok', 'Millennium 3.6.2');
      }
      step('plugin', 'run', 'Copie du plugin dans le dossier de Millennium'); await wait(500); step('plugin', 'ok');
      step('activer', 'run'); await wait(400); step('activer', 'ok', options.sgdbKey ? 'Clé SteamGridDB enregistrée' : '');
      step('relancer', 'run'); await wait(300); step('relancer', 'ok');
    },
    uninstall: async ({ options }) => {
      step('fermer', 'run'); await wait(500); step('fermer', 'ok');
      step('plugin', 'run'); await wait(500); step('plugin', 'ok');
      if (options.removeMillennium) { step('millennium', 'run'); await wait(500); step('millennium', 'ok'); }
      step('relancer', 'run'); await wait(300); step('relancer', 'ok');
    }
  };
  window.__TAURI__ = {
    core: { invoke: (cmd, args) => handlers[cmd](args || {}) },
    event: { listen: async (name, fn) => { (listeners[name] ||= []).push(fn); return () => {}; } },
    window: { getCurrentWindow: () => ({ minimize: () => {}, close: () => {} }) }
  };
}
