// Millennium figé : chaque version de Steam Upgraded est testée avec une seule version de Millennium (millennium.lock.json).
// - Les mises à jour automatiques de Millennium sont coupées : Millennium ne change de version qu'avec Steam Upgraded.
// - Sous Windows, la version testée s'installe par le programme de mise à jour de Millennium (Core_UpdateMillennium),
//   après vérification de l'empreinte par notre backend ; il faut ensuite redémarrer Steam.
// - macOS (app lanceur) et Linux (paquets de la distribution) : Millennium ne se met pas à jour depuis Steam ; on signale
//   seulement un écart.
import { useEffect, useState } from 'react';
import lockFile from '../../millennium.lock.json';

export type MillenniumAsset = { url: string; size: number; sha256: string };
export type MillenniumLock = { version: string; tag: string; windows?: MillenniumAsset | null; linux?: MillenniumAsset | null; macos?: MillenniumAsset | null };
export type Platform = 'windows' | 'macos' | 'linux' | 'inconnue';

/** Version de Millennium testée avec CETTE version de Steam Upgraded. */
export const PINNED: MillenniumLock = lockFile as MillenniumLock;

const w = window as any;
const parse = (raw: any) => (typeof raw === 'string' ? JSON.parse(raw) : raw);
const core = (name: string, args: Record<string, unknown> = {}) => w.Millennium.callServerMethod('core', name, args);

export type Running = { version: string; platform: Platform };

let running: Running | null = null;
export async function runningMillennium(): Promise<Running> {
	if (running) return running;
	const d = parse(await backend.sp_millennium_running());
	running = { version: String(d?.version || ''), platform: (d?.platform || 'inconnue') as Platform };
	return running;
}

/** Archive officielle de la version figée pour cette plateforme, si Steam Upgraded sait l'installer ici (Windows). */
export function installableAsset(lock: MillenniumLock, platform: Platform): MillenniumAsset | null {
	return platform === 'windows' ? lock.windows || null : null;
}

/**
 * Coupe les mises à jour automatiques de Millennium (« Rechercher les mises à jour » et « À la mise à jour : installer »).
 * Par défaut, Millennium installe lui-même ses nouvelles versions au démarrage de Steam, ce qui casserait le figeage.
 * Prend effet au prochain démarrage de Steam (la vérification de Millennium a lieu avant le chargement du plugin).
 */
export async function disableMillenniumSelfUpdate(): Promise<boolean> {
	try {
		const cfg = parse(await core('Core_GetBackendConfig'));
		if (!cfg || typeof cfg !== 'object') return false;
		const g = (cfg.general ||= {});
		if (g.checkForMillenniumUpdates === false && g.onMillenniumUpdate === 0) return false;
		g.checkForMillenniumUpdates = false;
		g.onMillenniumUpdate = 0; // DO_NOTHING (1 = prévenir, 2 = installer)
		await core('Core_SetBackendConfig', { config: JSON.stringify(cfg) });
		return true;
	} catch (e) {
		console.error('[steam-upgraded] réglage des mises à jour de Millennium', e);
		return false;
	}
}

/** millennium.lock.json d'une publication (absent pour celles d'avant le figeage). */
export async function releaseLock(tag: string): Promise<MillenniumLock | null> {
	const d = parse(await backend.sp_millennium_lock(tag));
	if (!d?.ok) throw new Error(d?.error || 'Version de Millennium de la publication illisible.');
	return d.absent ? null : (d.lock as MillenniumLock);
}

/**
 * Installe la version de Millennium donnée (Windows) : empreinte vérifiée par le backend, puis programme de mise à jour
 * de Millennium. Résout quand Millennium attend le redémarrage de Steam.
 */
export async function installMillennium(lock: MillenniumLock): Promise<void> {
	const { platform } = await runningMillennium();
	const asset = installableAsset(lock, platform);
	if (!asset) throw new Error(`Millennium ${lock.version} ne peut pas être installé depuis Steam sur ce système.`);
	const v = parse(await backend.sp_millennium_verify(asset.url, asset.sha256));
	if (!v?.ok) throw new Error(v?.error || 'Vérification de Millennium impossible.');
	await core('Core_UpdateMillennium', { downloadUrl: asset.url, downloadSize: asset.size, background: true });
	for (let i = 0; i < 240; i++) {
		await new Promise((r) => setTimeout(r, 500));
		if (parse(await core('Core_HasPendingMillenniumUpdateRestart')) === true) return;
	}
	throw new Error('Millennium n’a pas terminé son installation. Relancez Steam puis réessayez.');
}

/** Redémarre complètement Steam (nécessaire après un changement de Millennium). */
export function restartSteam() {
	w.SteamClient?.User?.StartRestart?.(false);
}

const same = (a: string, b: string) => a.replace(/^v/i, '') === b.replace(/^v/i, '');
export const matchesPinned = (version: string) => !!version && same(version, PINNED.version);

// ---------- État partagé pour Paramètres › Mises à jour ----------

type State = { running?: Running };
let state: State = {};
const listeners = new Set<() => void>();

export async function refreshMillenniumState() {
	try {
		state = { running: await runningMillennium() };
	} catch {
		state = {};
	}
	listeners.forEach((f) => f());
}

export function useMillenniumState(): State {
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
