import { pluginConfig, subscribePluginConfig } from 'millennium';
import { useEffect, useState } from 'react';

export type Settings = {
	theme: 'sombre' | 'oled';
	accent: string;
	fond: string;
	forme: 'squircle' | 'classique';
	infos: 'sous' | 'survol';
	oledHalo: boolean;
	oledNoFill: boolean;
	antiBurn: boolean;
	hdrWide: boolean;
	hdrHalo: boolean;
	sgdbKey: string;
	replaceLibrary: boolean;
	replaceGamePage: boolean;
	replaceBigPicture: boolean;
	/** Thème de Big Picture, indépendant du bureau (OLED par défaut : écran de télévision). */
	bpTheme: 'sombre' | 'oled';
	presenceReturnMinutes: number;
	/** Version proposée que la personne a choisi d'ignorer (Paramètres › Mises à jour). */
	updateSkip: string;
};

export const DEFAULTS: Settings = {
	theme: 'sombre',
	accent: 'bleu',
	fond: 'nuit',
	forme: 'squircle',
	infos: 'sous',
	oledHalo: true,
	oledNoFill: true,
	antiBurn: true,
	hdrWide: true,
	hdrHalo: false,
	sgdbKey: '',
	replaceLibrary: true,
	replaceGamePage: true,
	replaceBigPicture: true,
	bpTheme: 'oled',
	presenceReturnMinutes: 0,
	updateSkip: '',
};

let current: Settings = { ...DEFAULTS };
const listeners = new Set<(s: Settings) => void>();

function emit() {
	listeners.forEach((fn) => fn(current));
}

/** Délai laissé à Millennium pour rendre les réglages avant d'afficher l'interface avec les réglages par défaut. */
const SETTINGS_WAIT = 4000;

function applyStored(stored: Record<string, any> | null | undefined) {
	// la configuration contient aussi d'autres données du plugin (ex. relevés de temps de jeu)
	const known = Object.fromEntries(Object.entries(stored || {}).filter(([k]) => k in DEFAULTS));
	current = { ...DEFAULTS, ...known };
}

/**
 * Lit les réglages. L'interface n'attend jamais plus de SETTINGS_WAIT : l'appel à Millennium n'a pas de délai et, au
 * tout premier démarrage après l'installation de Millennium, il a pu ne pas répondre (Steam sans l'interface jusqu'à un
 * redémarrage à la main, signalé après la 0.2.2). Les vrais réglages s'appliquent dès qu'ils arrivent.
 */
export async function loadSettings(): Promise<Settings> {
	const read = pluginConfig.getAll().then(
		(stored: Record<string, any>) => ({ ok: true as const, stored }),
		(e: any) => ({ ok: false as const, e }),
	);
	const late = new Promise<null>((ok) => setTimeout(() => ok(null), SETTINGS_WAIT));
	const first = await Promise.race([read, late]);
	if (first === null) {
		console.warn('[steam-upgraded] réglages lents à venir : interface affichée avec les réglages par défaut');
		read.then((r) => {
			if (r.ok) {
				applyStored(r.stored);
				emit();
			} else console.error('[steam-upgraded] lecture des réglages impossible', (r as any).e);
		});
	} else if (first.ok) applyStored(first.stored);
	else console.error('[steam-upgraded] lecture des réglages impossible', (first as any).e);
	subscribePluginConfig((key, value) => {
		if (key in DEFAULTS && (current as any)[key] !== value) {
			current = { ...current, [key]: value };
			emit();
		}
	});
	emit();
	return current;
}

export function getSettings(): Settings {
	return current;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
	current = { ...current, [key]: value };
	emit();
	try {
		await pluginConfig.set(key, value as any);
	} catch (e) {
		console.error('[steam-upgraded] enregistrement impossible', key, e);
	}
}

export function onSettings(fn: (s: Settings) => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function useSettings(): Settings {
	const [s, set] = useState(current);
	useEffect(() => onSettings(set), []);
	return s;
}
