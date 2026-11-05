// Mises à jour de Steam Upgraded depuis nos Paramètres : dernière publication du dépôt GitHub (backend/updates.lua),
// vérifiée au démarrage puis toutes les 6 heures et à la demande. Une nouvelle version est signalée discrètement
// (pastille sur l'onglet Paramètres et sur « Mises à jour ») ; l'installation remplace le seul fichier du plugin
// (empreinte vérifiée, ancienne version gardée de côté), puis Millennium relance le plugin et l'interface se recharge.
// Réglages, clé SteamGridDB, visuels et relevés de temps de jeu ne sont pas touchés.
import { Fragment, ReactNode, useEffect, useState } from 'react';
import { setSetting, useSettings } from '../core/settings';
import { openSteamWeb } from '../core/steam';
import { PLUGIN_ID, restartInterface, selfInfo } from './uninstall';
import { PINNED, disableMillenniumSelfUpdate, installMillennium, installableAsset, matchesPinned, releaseLock, restartSteam, runningMillennium, useMillenniumState, refreshMillenniumState } from './millennium';

export type Release = { tag: string; version: string; name?: string; published?: string; url?: string; notes: string; star?: string; sha256?: string };

const w = window as any;
const parse = (raw: any) => (typeof raw === 'string' ? JSON.parse(raw) : raw);

/** « v0.1.2 » -> [0, 1, 2] ; comparaison numérique, partie par partie. */
function parts(v: string): number[] {
	return v.replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
}
export function newer(a: string, b: string): boolean {
	const x = parts(a);
	const y = parts(b);
	for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
	return false;
}

// ---------- État partagé ----------

type State = { installed?: string; latest?: Release; checking: boolean; checkedAt?: number; error?: string; previous?: string };
let state: State = { checking: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
	state = { ...state, ...next };
	listeners.forEach((f) => f());
};

export async function checkForUpdate(): Promise<void> {
	if (state.checking) return;
	set({ checking: true, error: undefined });
	try {
		const me = await selfInfo();
		const [d, prev] = await Promise.all([backend.sp_update_latest().then(parse), me?.path ? backend.sp_update_previous(me.path).then(parse) : null]);
		if (!d?.ok) throw new Error(d?.error || 'réponse vide');
		const latest: Release | undefined = d.tag && d.star ? { ...d, version: String(d.tag).replace(/^v/i, ''), notes: String(d.notes || '') } : undefined;
		// Développement : localStorage « steamupgraded:pretendVersion » (ex. 0.0.9) fait passer la dernière publication pour une mise à jour
		let pretend = '';
		try {
			pretend = localStorage.getItem('steamupgraded:pretendVersion') || '';
		} catch {}
		set({ installed: pretend || me?.version, latest, previous: prev?.version || undefined, checking: false, checkedAt: Date.now() });
	} catch (e: any) {
		set({ checking: false, checkedAt: Date.now(), error: String(e?.message || e) });
	}
}

let started = false;

/** Vérification 30 s après le démarrage (laisser Steam s'installer), puis toutes les 6 heures. */
export function initUpdates() {
	if (started) return;
	started = true;
	// Millennium ne change de version qu'avec Steam Upgraded (voir millennium.ts)
	disableMillenniumSelfUpdate();
	setTimeout(checkForUpdate, 30_000);
	setInterval(checkForUpdate, 6 * 3600_000);
}

export function useUpdates() {
	const [, setTick] = useState(0);
	useEffect(() => {
		const f = () => setTick((n) => n + 1);
		listeners.add(f);
		return () => {
			listeners.delete(f);
		};
	}, []);
	return state;
}

/** Version plus récente que l'installée et non ignorée : de quoi afficher la pastille. */
export function useUpdateAvailable(): boolean {
	const u = useUpdates();
	const s = useSettings();
	return !!(u.latest && u.installed && newer(u.latest.version, u.installed) && s.updateSkip !== u.latest.version);
}

// Paramètres ouverts directement sur « Mises à jour » (pastille de l'onglet)
let wantUpdatesPage = false;
export function requestUpdatesPage() {
	wantUpdatesPage = true;
}
export function takeUpdatesPage(): boolean {
	const v = wantUpdatesPage;
	wantUpdatesPage = false;
	return v;
}

/**
 * Relance le plugin dans Millennium (nouveau fichier lu, backend redémarré) puis recharge l'interface.
 * Millennium 3.6 n'a pas Core_ReloadPlugin : « désactivé puis activé » dans le même appel arrête et relance
 * le backend, laisse le plugin actif et recharge l'interface (vérifié dans les journaux du backend).
 */
async function reloadPlugin() {
	try {
		const pluginJson = JSON.stringify([
			{ plugin_name: PLUGIN_ID, enabled: false },
			{ plugin_name: PLUGIN_ID, enabled: true },
		]);
		await w.Millennium.callServerMethod('core', 'Core_ChangePluginStatus', { pluginJson });
	} catch (e) {
		console.error('[steam-upgraded] relance du plugin', e);
	}
	restartInterface();
}

async function install(r: Release): Promise<void> {
	const me = await selfInfo();
	if (!me?.path) throw new Error('Millennium ne trouve pas le plugin.');
	if (!r.star || !r.sha256) throw new Error('Cette publication ne donne pas l’empreinte de son fichier : installez-la avec l’installeur.');
	// Version de Millennium testée avec la nouvelle version (absente pour les publications d'avant le figeage)
	const lock = await releaseLock(r.tag);
	const d = parse(await backend.sp_update_install(me.path, r.star, r.sha256, me.version));
	if (!d?.ok) throw new Error(d?.error || 'Mise à jour impossible.');
	const run = await runningMillennium();
	if (lock && run.version && !sameVersion(lock.version, run.version) && installableAsset(lock, run.platform)) {
		try {
			await installMillennium(lock);
		} catch (e: any) {
			await reloadPlugin();
			throw new Error(`Steam Upgraded ${r.version} est installé, mais pas Millennium ${lock.version} : ${e?.message || e} Réessayez depuis la section Millennium.`);
		}
		restartSteam();
		return;
	}
	await reloadPlugin();
}

const sameVersion = (a: string, b: string) => a.replace(/^v/i, '') === b.replace(/^v/i, '');

async function rollback(): Promise<void> {
	const me = await selfInfo();
	if (!me?.path) throw new Error('Millennium ne trouve pas le plugin.');
	const d = parse(await backend.sp_update_rollback(me.path));
	if (!d?.ok) throw new Error(d?.error || 'Retour impossible.');
	await reloadPlugin();
}

// ---------- Notes de version (Markdown simple de GitHub, sans HTML) ----------

function inline(text: string): ReactNode[] {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
		t.startsWith('**') && t.endsWith('**') ? <b key={i}>{inline(t.slice(2, -2))}</b> : t.startsWith('`') && t.endsWith('`') ? <code key={i} style={{ fontSize: '0.92em', padding: '1px 5px', borderRadius: 5, background: 'var(--sp-surface2)' }}>{t.slice(1, -1)}</code> : <Fragment key={i}>{t}</Fragment>,
	);
}

export function ReleaseNotes({ text }: { text: string }) {
	const blocks: ReactNode[] = [];
	let list: { ordered: boolean; items: string[] } | null = null;
	const flush = () => {
		if (!list) return;
		const L = list.ordered ? 'ol' : 'ul';
		blocks.push(
			<L key={blocks.length} style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
				{list.items.map((it, i) => (
					<li key={i}>{inline(it)}</li>
				))}
			</L>,
		);
		list = null;
	};
	for (const raw of text.replace(/\r/g, '').split('\n')) {
		const line = raw.trim();
		const bullet = /^[-*] (.*)/.exec(line);
		const num = /^\d+\. (.*)/.exec(line);
		if (bullet || num) {
			const ordered = !!num;
			if (list && list.ordered !== ordered) flush();
			list ??= { ordered, items: [] };
			list.items.push((bullet || num)![1]);
			continue;
		}
		flush();
		if (!line) continue;
		const h = /^#{1,4} (.*)/.exec(line);
		blocks.push(
			h ? (
				<h3 key={blocks.length} style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 800 }}>{inline(h[1])}</h3>
			) : (
				<p key={blocks.length} style={{ margin: 0 }}>{inline(line)}</p>
			),
		);
	}
	flush();
	return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.55 }}>{blocks}</div>;
}

// ---------- Paramètres › Mises à jour ----------

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

type SectionProps = { id: string; title: string; sub?: string; children: any };

export function UpdateSections({ Section }: { Section: (p: SectionProps) => any }) {
	const u = useUpdates();
	const s = useSettings();
	const [busy, setBusy] = useState<'' | 'install' | 'rollback'>('');
	const [error, setError] = useState('');
	const [confirmBack, setConfirmBack] = useState(false);

	// Version lue à l'ouverture, et une vérification si la dernière date de plus d'une minute
	useEffect(() => {
		if (!u.checkedAt || Date.now() - u.checkedAt > 60_000) checkForUpdate();
	}, []);

	const r = u.latest;
	const available = !!(r && u.installed && newer(r.version, u.installed));
	const skipped = available && s.updateSkip === r!.version;
	const run = async (what: 'install' | 'rollback') => {
		setBusy(what);
		setError('');
		try {
			await (what === 'install' ? install(r!) : rollback());
		} catch (e: any) {
			setError(e?.message || String(e));
			setBusy('');
		}
	};

	const status = u.checking
		? 'Recherche d’une mise à jour…'
		: u.error
			? `Impossible de vérifier les mises à jour (${u.error}).`
			: skipped
				? `La version ${r!.version} est disponible, mais vous avez choisi de l’ignorer.`
				: available
					? `La version ${r!.version} est disponible.`
					: r
						? `Vous avez la dernière version${u.checkedAt ? ` (vérifié à ${TIME.format(u.checkedAt)})` : ''}.`
						: 'Aucune publication trouvée sur GitHub.';

	return (
		<>
			<Section id="h-version" title={u.installed ? `Version installée : ${u.installed}` : 'Version installée'} sub={status}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<button type="button" className="sp-btn" disabled={u.checking || !!busy} onClick={checkForUpdate}>
						{u.checking ? 'Recherche…' : 'Rechercher maintenant'}
					</button>
					{skipped && (
						<button type="button" className="sp-btn" onClick={() => setSetting('updateSkip', '')}>
							Ne plus ignorer la {r!.version}
						</button>
					)}
				</div>
			</Section>

			<MillenniumSection Section={Section} busy={!!busy} />

			{available && !skipped && (
				<section aria-labelledby="h-update" className="sp-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16, borderColor: 'var(--sp-accent)', boxShadow: 'var(--sp-glow)' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
						<span className="sp-label" style={{ color: 'var(--sp-accent)' }}>Mise à jour disponible</span>
						<h2 id="h-update" className="sp-h2" style={{ fontSize: 19 }}>Steam Upgraded {r!.version}</h2>
						<span className="sp-muted">
							{r!.published ? `Publiée le ${DAY.format(new Date(r!.published))}. ` : ''}Vos réglages, votre clé SteamGridDB, vos visuels et vos relevés de temps de jeu sont conservés.
						</span>
					</div>
					{r!.notes.trim() && (
						<div style={{ maxHeight: 300, overflowY: 'auto', padding: '14px 16px', borderRadius: 'var(--sp-r-md)', background: 'var(--sp-bg)', border: '1px solid var(--sp-line)', fontSize: 13 }}>
							<ReleaseNotes text={r!.notes} />
						</div>
					)}
					{error && (
						<div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13 }}>
							{error}
						</div>
					)}
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
						<button type="button" className="sp-btn sp-btn--primary" disabled={!!busy} onClick={() => run('install')}>
							{busy === 'install' ? 'Téléchargement et vérification…' : 'Installer la mise à jour'}
						</button>
						<button type="button" className="sp-btn" disabled={!!busy} onClick={() => setSetting('updateSkip', r!.version)}>
							Ignorer cette version
						</button>
						{r!.url && (
							<button type="button" className="sp-btn" disabled={!!busy} onClick={() => openSteamWeb(r!.url!)}>
								Voir sur GitHub
							</button>
						)}
					</div>
					<span className="sp-muted" style={{ fontSize: 12.5 }}>L’interface de Steam se recharge à la fin, en quelques secondes.</span>
				</section>
			)}

			{u.previous && (
				<Section id="h-previous" title="Version précédente" sub={`La version ${u.previous} a été gardée de côté lors de la dernière mise à jour, au cas où celle-ci poserait problème.`}>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
						<button type="button" className="sp-btn" disabled={!!busy} onClick={() => (confirmBack ? run('rollback') : setConfirmBack(true))} style={confirmBack ? { borderColor: 'var(--sp-busy)', color: 'var(--sp-busy)', fontWeight: 800 } : undefined}>
							{busy === 'rollback' ? 'Retour en cours…' : confirmBack ? `Confirmer : revenir à la ${u.previous}` : `Revenir à la version ${u.previous}`}
						</button>
						{confirmBack && !busy && (
							<button type="button" className="sp-btn" onClick={() => setConfirmBack(false)}>
								Annuler
							</button>
						)}
					</div>
					{error && !available && <div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13 }}>{error}</div>}
				</Section>
			)}
		</>
	);
}

// ---------- Paramètres › Mises à jour › Millennium ----------

function MillenniumSection({ Section, busy }: { Section: (p: SectionProps) => any; busy: boolean }) {
	const m = useMillenniumState();
	const [working, setWorking] = useState(false);
	const [error, setError] = useState('');
	useEffect(() => {
		refreshMillenniumState();
	}, []);
	if (!m.running) return null;
	const ok = matchesPinned(m.running.version);
	const canInstall = !ok && !!installableAsset(PINNED, m.running.platform);
	const sub = ok
		? `Version testée avec Steam Upgraded. Ses mises à jour automatiques sont coupées : Millennium change de version avec Steam Upgraded, jamais seul.`
		: m.running.platform === 'windows'
			? `Steam Upgraded a été testé avec Millennium ${PINNED.version}. Installez cette version pour éviter les surprises ; Steam redémarre à la fin.`
			: m.running.platform === 'macos'
				? `Steam Upgraded a été testé avec Millennium ${PINNED.version}. Sur Mac, Millennium se met à jour avec l’app de Steam Upgraded, pas depuis Steam.`
				: `Steam Upgraded a été testé avec Millennium ${PINNED.version}. Sous Linux, Millennium se met à jour avec le gestionnaire de paquets de votre distribution.`;
	const go = async () => {
		setWorking(true);
		setError('');
		try {
			await installMillennium(PINNED);
			restartSteam();
		} catch (e: any) {
			setError(e?.message || String(e));
			setWorking(false);
		}
	};
	return (
		<Section id="h-millennium" title={`Millennium ${m.running.version || '?'}${ok ? '' : ` (version testée : ${PINNED.version})`}`} sub={sub}>
			{canInstall && (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
					<button type="button" className="sp-btn sp-btn--primary" disabled={working || busy} onClick={go}>
						{working ? 'Téléchargement et vérification…' : `Installer Millennium ${PINNED.version}`}
					</button>
				</div>
			)}
			{error && <div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13 }}>{error}</div>}
		</Section>
	);
}
