// Installeur Steam Upgraded : enchaînement des écrans.
'use strict';

const T = window.__TAURI__;
const invoke = (cmd, args) => T.core.invoke(cmd, args);
const win = T.window.getCurrentWindow();

const SGDB_API_PAGE = 'https://www.steamgriddb.com/profile/preferences/api';
const MILLENNIUM_PAGE = 'https://docs.steambrew.app/users/getting-started/installation';

// ---------- Icônes ----------
const ICON = {
  ok: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="c-ok"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  todo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="c-todo"><circle cx="12" cy="12" r="10"/><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5"/></svg>',
  info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="c-info"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  run: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" class="spin"><circle cx="12" cy="12" r="10" stroke="var(--surface2)"/><path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)"/></svg>',
  wait: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3.3" class="c-info"><circle cx="12" cy="12" r="10"/></svg>',
  skip: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="c-info"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>',
  err: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="c-err"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  bigOk: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  bigErr: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v8M12 18v.5"/></svg>',
  ext: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  repair: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
  trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- État ----------
const st = {
  det: null,          // résultat de detect()
  latest: null,       // dernière version de Millennium ({ version }) ou null
  latestError: null,
  mode: 'install',    // install | repair | uninstall
  consentMillennium: true,
  sgdbChoice: 'oui',
  sgdbKey: '',
  sgdbStatus: null,   // null | 'verif' | 'ok' | 'refusee' | 'injoignable'
  removeMillennium: false,
  steps: [],          // [{ id, label, state, detail }]
  busy: false,
  wasRunning: false,
  download: null      // [reçu, total]
};

const screen = document.getElementById('screen');
const modalRoot = document.getElementById('modal-root');

function setBusy(b) {
  st.busy = b;
  document.getElementById('btn-close').disabled = b;
}
document.getElementById('btn-min').addEventListener('click', () => win.minimize());
document.getElementById('btn-close').addEventListener('click', () => { if (!st.busy) win.close(); });

function render(html, bind) {
  screen.innerHTML = html;
  screen.style.animation = 'none';
  void screen.offsetWidth;
  screen.style.animation = '';
  bind?.(screen);
  screen.querySelector('[data-focus]')?.focus();
}
const on = (root, sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
const sub = (text) => (document.getElementById('tb-sub').textContent = text);

// ---------- Données ----------
const millenniumNeeded = () => !st.det.millennium.installed || !st.det.millennium.compatible;
const latestLabel = () => (st.latest ? `la version ${st.latest.version}` : 'la dernière version stable');
const pluginInstalled = () => !!st.det.plugin?.installed;

async function refresh() {
  st.det = await invoke('detect');
  const sim = document.getElementById('sim');
  if (st.det.simulation) {
    sim.hidden = false;
    sim.textContent = `Simulation : ${st.det.simulation}`;
  }
}

function loadLatest() {
  if (st.latest || !millenniumNeeded()) return;
  invoke('millennium_latest').then((r) => { st.latest = r; if (screen.dataset.name === 'verif') showVerif(); }).catch((e) => { st.latestError = String(e); });
}

// ---------- Écrans ----------
function showAccueil() {
  sub('Installation');
  screen.dataset.name = 'accueil';
  render(`
    <div class="body">
      <span class="eyebrow">Version ${esc(st.det.version)}</span>
      <h1 class="h1">Installer Steam Upgraded</h1>
      <p class="p">Une nouvelle interface pour le client Steam : bibliothèque, fiches de jeu, magasin, paramètres et Big Picture. Vos jeux, votre compte et vos réglages Steam ne sont pas touchés, et tout se retire en un clic.</p>
      <div class="cards">
        <div class="card"><span class="num">1</span><span class="row-l">Vérification</span><span class="row-d">Steam et Millennium, le chargeur de plugins</span></div>
        <div class="card"><span class="num">2</span><span class="row-l">Installation</span><span class="row-d">Le plugin, et Millennium si besoin, avec votre accord</span></div>
        <div class="card"><span class="num">3</span><span class="row-l">Relance</span><span class="row-d">Steam s'ouvre avec sa nouvelle interface</span></div>
      </div>
    </div>
    <div class="foot">
      <button type="button" class="btn-g ext" id="what">Qu'est-ce que Millennium ? ${ICON.ext}</button>
      <span class="sp"></span>
      <button type="button" class="btn" id="quit">Quitter</button>
      <button type="button" class="btn-p" id="go">Commencer</button>
    </div>`, (r) => {
    on(r, '#what', () => invoke('open_url', { url: MILLENNIUM_PAGE }));
    on(r, '#quit', () => win.close());
    on(r, '#go', async () => { await refresh(); st.mode = 'install'; loadLatest(); showVerif(); });
  });
}

function checkRow(kind, label, detail, pill) {
  return `<div class="row"><span class="ic" aria-hidden="true">${ICON[kind]}</span><span class="row-t"><span class="row-l">${esc(label)}</span><span class="row-d">${esc(detail)}</span></span><span class="pill rd c-${kind}">${esc(pill)}</span></div>`;
}

function showVerif() {
  screen.dataset.name = 'verif';
  const d = st.det;
  const m = d.millennium;
  const rows = [checkRow('ok', 'Steam', `Trouvé dans ${d.steam.path}`, 'Vérifié')];
  if (m.installed && m.compatible) rows.push(checkRow('ok', 'Millennium', `Version ${m.version}`, 'Vérifié'));
  else if (m.installed) rows.push(checkRow('todo', 'Millennium', `Version ${m.version || 'inconnue'}, trop ancienne : ${latestLabel()} sera installée`, 'À mettre à jour'));
  else rows.push(checkRow('todo', 'Millennium', `Absent : ${latestLabel()} sera installée`, 'À installer'));
  if (st.mode === 'repair') rows.push(checkRow('todo', 'Steam Upgraded', `Version ${d.version}, recopiée puis réactivée`, 'À réparer'));
  else rows.push(checkRow('todo', 'Steam Upgraded', `Version ${d.version}, installée puis activée`, 'À installer'));
  if (d.steam.running) rows.push(checkRow('info', 'Steam est ouvert', 'Il sera fermé proprement, puis relancé', 'À fermer'));
  else rows.push(checkRow('info', 'Steam est fermé', 'Il sera lancé à la fin', 'Fermé'));
  const need = millenniumNeeded();
  render(`
    <div class="body">
      <h1 class="h1 sm">Ce qui est déjà en place</h1>
      <div class="list">${rows.join('')}</div>
      ${need ? `<button type="button" class="chk" role="checkbox" aria-checked="${st.consentMillennium}" id="consent">
        <span class="box" aria-hidden="true">${ICON.check}</span>
        <span class="row-t"><span class="row-l">${m.installed ? 'Mettre à jour Millennium, nécessaire à Steam Upgraded' : 'Installer Millennium, nécessaire à Steam Upgraded'}</span><span class="row-d">Projet libre de Steam Homebrew, téléchargé depuis ses publications officielles sur GitHub, empreinte vérifiée.</span></span>
      </button>` : ''}
    </div>
    <div class="foot">
      <button type="button" class="btn" id="back">Retour</button>
      <span class="sp"></span>
      <button type="button" class="btn-p" id="next" ${need && !st.consentMillennium ? 'disabled' : ''}>Suivant</button>
    </div>`, (r) => {
    on(r, '#consent', () => { st.consentMillennium = !st.consentMillennium; showVerif(); r.querySelector('#consent')?.focus(); });
    on(r, '#back', () => (st.mode === 'repair' ? showMaintenance() : showAccueil()));
    on(r, '#next', () => {
      if (st.mode === 'repair' && d.plugin?.has_sgdb_key) return startOperation();
      showSgdbChoice();
    });
  });
}

function showSgdbChoice() {
  screen.dataset.name = 'sgdb-choix';
  const radio = (value, title, detail) => `
    <button type="button" class="opt" role="radio" aria-checked="${st.sgdbChoice === value}" data-v="${value}">
      <span class="radio rd" aria-hidden="true"></span>
      <span class="row-t"><span class="row-l">${title}</span><span class="row-d">${detail}</span></span>
    </button>`;
  render(`
    <div class="body">
      <span class="eyebrow">Facultatif</span>
      <h1 class="h1 sm">Visuels SteamGridDB</h1>
      <p class="p">SteamGridDB est un site communautaire gratuit de jaquettes, bannières et logos. Avec une clé personnelle, gratuite elle aussi, vous pouvez choisir d'autres visuels pour vos jeux. Sans clé, tout le reste fonctionne.</p>
      <div role="radiogroup" aria-label="Visuels SteamGridDB" style="display:flex;flex-direction:column;gap:10px">
        ${radio('oui', 'Oui, me guider pour créer la clé', 'Deux petites étapes, avant l\'installation.')}
        ${radio('non', 'Non, passer', 'Activable plus tard dans Paramètres › SteamGridDB.')}
      </div>
    </div>
    <div class="foot">
      <button type="button" class="btn" id="back">Retour</button>
      <span class="sp"></span>
      <button type="button" class="btn-p" id="next">Suivant</button>
    </div>`, (r) => {
    r.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      st.sgdbChoice = b.dataset.v;
      r.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    }));
    on(r, '#back', showVerif);
    on(r, '#next', () => {
      if (st.sgdbChoice === 'oui') return showSgdbCreate();
      st.sgdbKey = '';
      startOperation();
    });
  });
}

function showSgdbCreate() {
  screen.dataset.name = 'sgdb-cle';
  render(`
    <div class="body">
      <span class="eyebrow">SteamGridDB · étape 1 sur 2</span>
      <h1 class="h1 sm">Créez votre clé</h1>
      <ol class="steps">
        <li>Ouvrez SteamGridDB et connectez-vous avec votre compte Steam.</li>
        <li>Dans la section API, cliquez sur « Generate API Key ».</li>
        <li>Copiez la clé, puis revenez ici et cliquez sur Suivant.</li>
      </ol>
      <div><button type="button" class="btn fill ext" id="open">Ouvrir SteamGridDB ${ICON.ext}</button></div>
    </div>
    <div class="foot">
      <button type="button" class="btn-g" id="skip">Passer</button>
      <span class="sp"></span>
      <button type="button" class="btn" id="back">Retour</button>
      <button type="button" class="btn-p" id="next">Suivant</button>
    </div>`, (r) => {
    on(r, '#open', () => invoke('open_url', { url: SGDB_API_PAGE }));
    on(r, '#skip', () => { st.sgdbKey = ''; startOperation(); });
    on(r, '#back', showSgdbChoice);
    on(r, '#next', showSgdbPaste);
  });
}

function showSgdbPaste() {
  screen.dataset.name = 'sgdb-coller';
  const s = st.sgdbStatus;
  const status = {
    verif: '',
    ok: `<div class="note msg" role="status">${ICON.ok.replace('width="22" height="22"', 'width="18" height="18"')}Clé acceptée par SteamGridDB. Elle sera enregistrée pendant l'installation.</div>`,
    refusee: `<div class="note msg" role="alert">${ICON.err.replace('width="22" height="22"', 'width="18" height="18"')}SteamGridDB refuse cette clé. Vérifiez qu'elle a été copiée en entier, sans espace.</div>`,
    injoignable: `<div class="note msg" role="alert">${ICON.info.replace('width="22" height="22"', 'width="18" height="18"')}SteamGridDB ne répond pas. La clé peut être enregistrée telle quelle, et revérifiée plus tard dans Paramètres › SteamGridDB.</div>`
  }[s] || '';
  const primary = s === 'ok' ? 'Installer' : s === 'injoignable' ? 'Installer quand même' : s === 'verif' ? 'Vérification…' : 'Vérifier';
  render(`
    <div class="body">
      <span class="eyebrow">SteamGridDB · étape 2 sur 2</span>
      <h1 class="h1 sm">Collez votre clé</h1>
      <div class="field">
        <label class="lbl" for="key">Clé API</label>
        <div style="display:flex;gap:8px">
          <input id="key" class="in ${s === 'ok' ? 'ok' : s === 'refusee' ? 'bad' : ''}" type="text" spellcheck="false" autocomplete="off" placeholder="Collez la clé ici" value="${esc(st.sgdbKey)}" data-focus>
          <button type="button" class="btn fill" id="paste">Coller</button>
        </div>
      </div>
      ${status}
    </div>
    <div class="foot">
      <button type="button" class="btn-g" id="skip">Passer</button>
      <span class="sp"></span>
      <button type="button" class="btn" id="back">Retour</button>
      <button type="button" class="btn-p" id="next" ${s === 'verif' || !st.sgdbKey.trim() ? 'disabled' : ''}>${primary}</button>
    </div>`, (r) => {
    const input = r.querySelector('#key');
    const next = r.querySelector('#next');
    input.addEventListener('input', () => {
      st.sgdbKey = input.value;
      next.disabled = !input.value.trim();
      if (st.sgdbStatus) { st.sgdbStatus = null; showSgdbPaste(); const i = screen.querySelector('#key'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !next.disabled) next.click(); });
    on(r, '#paste', async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (text) { st.sgdbKey = text; st.sgdbStatus = null; showSgdbPaste(); }
      } catch { input.focus(); }
    });
    on(r, '#skip', () => { st.sgdbKey = ''; startOperation(); });
    on(r, '#back', showSgdbCreate);
    on(r, '#next', async () => {
      if (st.sgdbStatus === 'ok' || st.sgdbStatus === 'injoignable') return startOperation();
      st.sgdbKey = st.sgdbKey.trim();
      st.sgdbStatus = 'verif';
      showSgdbPaste();
      try { st.sgdbStatus = await invoke('sgdb_check', { key: st.sgdbKey }); } catch { st.sgdbStatus = 'injoignable'; }
      showSgdbPaste();
    });
  });
}

// ---------- Fermeture de Steam ----------
function askCloseSteam() {
  return new Promise((resolve) => {
    modalRoot.innerHTML = `
      <div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
        <h2 id="mt">Fermer Steam ?</h2>
        <p class="p">Pour copier les fichiers, Steam doit être fermé. L'installeur le ferme comme le ferait Steam › Quitter, puis le relance à la fin.</p>
        <p class="p">Un jeu est en cours ? Quittez-le d'abord : rien n'est fermé de force.</p>
        <div class="actions">
          <button type="button" class="btn" id="m-no">Annuler</button>
          <button type="button" class="btn-p" id="m-yes">Fermer Steam et continuer</button>
        </div>
      </div></div>`;
    const done = (v) => { modalRoot.innerHTML = ''; resolve(v); };
    modalRoot.querySelector('#m-no').addEventListener('click', () => done(false));
    modalRoot.querySelector('#m-yes').addEventListener('click', () => done(true));
  });
}

// ---------- Installation, réparation, désinstallation ----------
function planSteps() {
  const s = [{ id: 'fermer', label: 'Fermeture de Steam' }];
  if (st.mode === 'uninstall') {
    s.push({ id: 'plugin', label: 'Retrait de Steam Upgraded et de ses réglages' });
    if (st.removeMillennium) s.push({ id: 'millennium', label: 'Retrait de Millennium' });
  } else {
    if (millenniumNeeded()) {
      s.push({ id: 'telecharger', label: 'Téléchargement de Millennium' });
      s.push({ id: 'millennium', label: 'Installation de Millennium' });
    }
    s.push({ id: 'plugin', label: 'Installation de Steam Upgraded' });
    s.push({ id: 'activer', label: 'Activation du plugin' });
  }
  s.push({ id: 'relancer', label: 'Relance de Steam' });
  return s.map((x) => ({ ...x, state: 'wait', detail: '' }));
}

function stepsHtml() {
  return st.steps.map((s) => {
    let detail = s.detail;
    if (s.id === 'telecharger' && s.state === 'run' && st.download) {
      const [got, total] = st.download;
      detail = total ? `${(got / 1048576).toFixed(1)} Mo sur ${(total / 1048576).toFixed(1)} Mo` : `${(got / 1048576).toFixed(1)} Mo`;
    }
    return `<div class="row ${s.state}"><span class="ic" aria-hidden="true">${ICON[s.state] || ICON.wait}</span><span class="row-t"><span class="row-l">${esc(s.label)}</span>${detail ? `<span class="row-d">${esc(detail)}</span>` : ''}</span></div>`;
  }).join('');
}

function showProgress() {
  screen.dataset.name = 'progression';
  sub(st.mode === 'uninstall' ? 'Désinstallation' : 'Installation');
  const done = st.steps.filter((s) => s.state === 'ok' || s.state === 'skip').length;
  const total = st.steps.length;
  const current = Math.min(total, done + 1);
  let pct = (done / total) * 100;
  const dl = st.steps.find((s) => s.id === 'telecharger' && s.state === 'run');
  if (dl && st.download?.[1]) pct += (st.download[0] / st.download[1]) * (100 / total);
  const title = st.mode === 'uninstall' ? 'Désinstallation' : st.mode === 'repair' ? 'Réparation' : 'Installation';
  const html = `
    <div class="body tight">
      <div style="display:flex;align-items:baseline;gap:12px"><h1 class="h1 sm">${title}</h1><span class="row-d">Étape ${current} sur ${total}</span></div>
      <div class="bar" role="progressbar" aria-label="Progression" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><div style="width:${pct.toFixed(1)}%"></div></div>
      <div class="list compact">${stepsHtml()}</div>
    </div>
    <div class="foot"><span class="row-d">Ne fermez pas cette fenêtre.</span><span class="sp"></span></div>`;
  if (screen.querySelector('.bar') && screen.dataset.shown === 'progression') {
    // Mise à jour sur place (pas d'animation d'entrée à chaque évènement).
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    screen.querySelector('.body').replaceWith(tmp.querySelector('.body'));
  } else {
    render(html);
    screen.dataset.shown = 'progression';
  }
}

async function startOperation() {
  await refresh();
  st.wasRunning = st.det.steam.running;
  if (st.wasRunning && !(await askCloseSteam())) return;
  st.steps = planSteps();
  st.download = null;
  setBusy(true);
  showProgress();
  try {
    if (st.mode === 'uninstall') await invoke('uninstall', { options: { removeMillennium: st.removeMillennium } });
    else await invoke('install', { options: { installMillennium: millenniumNeeded(), sgdbKey: st.sgdbChoice === 'oui' && st.sgdbStatus !== 'refusee' ? st.sgdbKey.trim() || null : null } });
    setBusy(false);
    screen.dataset.shown = '';
    st.mode === 'uninstall' ? showUninstalled() : showDone();
  } catch (e) {
    setBusy(false);
    screen.dataset.shown = '';
    showError(String(e));
  }
}

T.event.listen('etape', ({ payload }) => {
  const s = st.steps.find((x) => x.id === payload.id);
  if (!s) return;
  s.state = payload.state;
  if (payload.detail || payload.state !== 'run') s.detail = payload.detail;
  if (screen.dataset.name === 'progression') showProgress();
});
T.event.listen('progression', ({ payload }) => {
  st.download = payload;
  if (screen.dataset.name === 'progression') showProgress();
});

function showDone() {
  screen.dataset.name = 'fin';
  const withKey = st.sgdbChoice === 'oui' && st.sgdbKey.trim() && st.sgdbStatus !== 'refusee';
  render(`
    <div class="body center">
      <span class="big rd" aria-hidden="true">${ICON.bigOk}</span>
      <h1 class="h1">${st.mode === 'repair' ? 'Steam Upgraded est réparé' : 'Steam Upgraded est installé'}</h1>
      <p class="p">Steam redémarre avec sa nouvelle interface.${withKey ? ' La clé SteamGridDB est enregistrée : sur la fiche d\'un jeu, l\'icône « Personnaliser les visuels » ouvre le choix des jaquettes, bannières et logos.' : ''}</p>
      <div class="note">Pour le retirer plus tard : Paramètres › Mises à jour › Désinstaller, dans Steam, ou relancez cet installeur.</div>
    </div>
    <div class="foot"><span class="sp"></span><button type="button" class="btn-p" id="end">Terminer</button></div>`, (r) => on(r, '#end', () => win.close()));
}

function showError(message) {
  screen.dataset.name = 'erreur';
  const failed = st.steps.find((s) => s.state === 'err');
  if (!failed && st.steps.length) { st.steps[0].state = 'err'; st.steps[0].detail = message; }
  st.steps.forEach((s) => { if (s.state === 'run') s.state = 'wait'; });
  const title = st.mode === 'uninstall' ? 'La désinstallation n\'a pas pu se terminer' : 'L\'installation n\'a pas pu se terminer';
  render(`
    <div class="body tight">
      <h1 class="h1 sm">${title}</h1>
      <div class="list compact">${stepsHtml()}</div>
      <div class="note"><b>Rien n'a été modifié.</b>${st.wasRunning && st.steps.find((s) => s.id === 'fermer')?.state === 'ok' ? ' Steam a été relancé tel qu\'il était.' : ''}</div>
    </div>
    <div class="foot">
      <button type="button" class="btn-g" id="copy">Copier le détail</button>
      <span class="sp"></span>
      <button type="button" class="btn" id="quit">Quitter</button>
      <button type="button" class="btn-p" id="retry">Réessayer</button>
    </div>`, (r) => {
    on(r, '#copy', async () => {
      const lines = [`Steam Upgraded ${st.det?.version} — ${title}`, ...st.steps.map((s) => `${s.state.toUpperCase()}  ${s.label}${s.detail ? ' : ' + s.detail : ''}`)];
      try { await navigator.clipboard.writeText(lines.join('\n')); r.querySelector('#copy').textContent = 'Détail copié'; } catch { /* presse-papiers indisponible */ }
    });
    on(r, '#quit', () => win.close());
    on(r, '#retry', startOperation);
  });
}

function showMaintenance() {
  sub('Installation');
  screen.dataset.name = 'maintenance';
  const d = st.det;
  render(`
    <div class="body">
      <span class="eyebrow">${[d.plugin.version ? `Version ${esc(d.plugin.version)}` : '', d.millennium.version ? `Millennium ${esc(d.millennium.version)}` : ''].filter(Boolean).join(' · ')}</span>
      <h1 class="h1">Steam Upgraded est déjà installé</h1>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
        <button type="button" class="opt" id="repair">
          <span class="opt-ic" aria-hidden="true">${ICON.repair}</span>
          <span class="row-t"><span class="row-l">${d.plugin.version && d.plugin.version !== d.version ? `Mettre à jour vers la version ${esc(d.version)}` : 'Réparer'}</span><span class="row-d">Recopie le plugin et le réactive. Les réglages sont gardés.</span></span>
        </button>
        <button type="button" class="opt" id="remove">
          <span class="opt-ic" aria-hidden="true">${ICON.trash}</span>
          <span class="row-t"><span class="row-l">Désinstaller</span><span class="row-d">Retire Steam Upgraded et rend à Steam son interface d'origine.</span></span>
        </button>
      </div>
    </div>
    <div class="foot"><span class="sp"></span><button type="button" class="btn" id="quit">Quitter</button></div>`, (r) => {
    on(r, '#repair', () => { st.mode = 'repair'; st.sgdbChoice = d.plugin.has_sgdb_key ? 'non' : 'oui'; loadLatest(); showVerif(); });
    on(r, '#remove', () => { st.mode = 'uninstall'; st.removeMillennium = false; showUninstallConfirm(); });
    on(r, '#quit', () => win.close());
  });
}

function showUninstallConfirm() {
  sub('Désinstallation');
  screen.dataset.name = 'desinstaller';
  const canRemove = st.det.millennium.by_installer;
  render(`
    <div class="body">
      <h1 class="h1 sm">Désinstaller Steam Upgraded ?</h1>
      <p class="p">Steam est fermé, le plugin et ses réglages sont retirés (thème, présence, clé SteamGridDB, relevés de temps de jeu), puis Steam est relancé avec son interface d'origine.</p>
      <div class="note">Restent : vos jeux, votre compte, et les visuels personnalisés déjà appliqués, qui sont des réglages de Steam.</div>
      ${canRemove ? `<button type="button" class="chk" role="checkbox" aria-checked="${st.removeMillennium}" id="rm">
        <span class="box" aria-hidden="true">${ICON.check}</span>
        <span class="row-t"><span class="row-l">Retirer aussi Millennium</span><span class="row-d">Il a été installé par cet installeur. D'autres plugins ou thèmes Millennium cesseraient de fonctionner.</span></span>
      </button>` : ''}
    </div>
    <div class="foot"><span class="sp"></span><button type="button" class="btn" id="cancel">Annuler</button><button type="button" class="btn-d" id="go">Désinstaller</button></div>`, (r) => {
    on(r, '#rm', () => { st.removeMillennium = !st.removeMillennium; r.querySelector('#rm').setAttribute('aria-checked', String(st.removeMillennium)); });
    on(r, '#cancel', showMaintenance);
    on(r, '#go', startOperation);
  });
}

function showUninstalled() {
  screen.dataset.name = 'desinstalle';
  render(`
    <div class="body center">
      <span class="big rd" aria-hidden="true">${ICON.bigOk}</span>
      <h1 class="h1">Steam Upgraded est désinstallé</h1>
      <p class="p">Steam a retrouvé son interface d'origine. ${st.removeMillennium ? 'Millennium a aussi été retiré.' : 'Millennium reste installé.'}</p>
    </div>
    <div class="foot"><span class="sp"></span><button type="button" class="btn-p" id="end">Terminer</button></div>`, (r) => on(r, '#end', () => win.close()));
}

function showNoSteam() {
  screen.dataset.name = 'sans-steam';
  render(`
    <div class="body center">
      <span class="big rd" aria-hidden="true">${ICON.bigErr}</span>
      <h1 class="h1">Steam est introuvable</h1>
      <p class="p">Steam Upgraded s'installe dans le client Steam. Installez Steam depuis store.steampowered.com, ouvrez-le une fois, puis relancez cet installeur.</p>
    </div>
    <div class="foot"><span class="sp"></span><button type="button" class="btn-p" id="end">Quitter</button></div>`, (r) => on(r, '#end', () => win.close()));
}

// ---------- Démarrage ----------
(async () => {
  await refresh();
  if (!st.det.steam.found) return showNoSteam();
  if (pluginInstalled()) return showMaintenance();
  loadLatest();
  showAccueil();
})();
