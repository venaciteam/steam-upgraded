// Accès SteamGridDB (via le backend Lua) et visuels personnalisés de Steam.
import { getSettings } from '../../core/settings';
import { artStamp, customArt, notifyArtChanged } from '../../core/art';

const w = window as any;

export type SlotId = 'capsule' | 'hero' | 'logo' | 'header' | 'icon';

export type Slot = {
	id: SlotId;
	label: string;
	sub: string;
	/** Taille indiquée à côté du titre de la zone de résultats. */
	size: string;
	/** ELibraryAssetType */
	asset: number;
	/** Suffixe du fichier dans /customimages/ (ex. 123p.png pour la jaquette). */
	suffix: string;
	/** Rapport largeur / hauteur des vignettes. */
	ratio: number;
	/** Taille de la miniature dans la colonne de gauche. */
	thumb: [number, number];
	/** Colonnes de la grille de résultats. */
	columns: number;
	styles: { id: string; label: string }[];
	/** Fond clair à damier pour les images transparentes. */
	transparent?: boolean;
};

const GRID_STYLES = [
	{ id: 'alternate', label: 'Alternatif' },
	{ id: 'material', label: 'Material' },
	{ id: 'white_logo', label: 'Logo blanc' },
	{ id: 'no_logo', label: 'Sans logo' },
	{ id: 'blurred', label: 'Flou' },
];

export const SLOTS: Slot[] = [
	{ id: 'capsule', label: 'Jaquette', sub: 'Grille de la bibliothèque', size: '600 × 900', asset: 0, suffix: 'p', ratio: 2 / 3, thumb: [24, 36], columns: 6, styles: GRID_STYLES },
	{
		id: 'hero', label: 'Bannière', sub: 'Haut de la fiche du jeu', size: '1920 × 620', asset: 1, suffix: '_hero', ratio: 1920 / 620, thumb: [44, 18], columns: 3,
		styles: [{ id: 'alternate', label: 'Alternatif' }, { id: 'material', label: 'Material' }, { id: 'blurred', label: 'Flou' }],
	},
	{
		id: 'logo', label: 'Logo', sub: 'Posé sur la bannière', size: 'PNG transparent', asset: 2, suffix: '_logo', ratio: 2, thumb: [44, 16], columns: 4, transparent: true,
		styles: [{ id: 'official', label: 'Officiel' }, { id: 'white', label: 'Blanc' }, { id: 'black', label: 'Noir' }, { id: 'custom', label: 'Personnalisé' }],
	},
	{ id: 'header', label: 'Capsule large', sub: 'Reprendre, collections', size: '920 × 430', asset: 3, suffix: '', ratio: 920 / 430, thumb: [44, 22], columns: 4, styles: GRID_STYLES },
	{
		id: 'icon', label: 'Icône', sub: 'Liste et barre des tâches', size: 'carré', asset: 4, suffix: '_icon', ratio: 1, thumb: [24, 24], columns: 8, transparent: true,
		styles: [{ id: 'official', label: 'Officiel' }, { id: 'custom', label: 'Personnalisé' }],
	},
];

export type Game = { id: number; name: string; year?: number; verified?: boolean };

export type Asset = {
	id: number;
	url: string;
	thumb: string;
	mime?: string;
	width: number;
	height: number;
	style?: string;
	author: string;
	upvotes: number;
	downvotes: number;
	animated?: boolean;
};

export type AssetPage = { items: Asset[]; total: number; page: number; limit: number };

export type ImageData = { base64: string; format: 'png' | 'jpg' };

export class SgdbError extends Error {
	status: number;
	constructor(message: string, status = 0) {
		super(message);
		this.status = status;
	}
}

/** Source des données et des actions : SteamGridDB + SteamClient en temps normal. */
export interface Provider {
	/** Texte affiché dans l'en-tête quand les données ne sont pas réelles. */
	badge?: string;
	hasKey(): boolean;
	game(appid: number): Promise<Game>;
	search(term: string): Promise<Game[]>;
	assets(slot: SlotId, gameId: number, styles: string[], animated: boolean, page: number): Promise<AssetPage>;
	download(item: Asset): Promise<ImageData>;
	apply(appid: number, slot: Slot, img: ImageData): Promise<void>;
	clear(appid: number, slot: Slot): Promise<void>;
}

async function call(fn: Promise<string>): Promise<any> {
	let raw: any;
	try {
		raw = await fn;
	} catch (e: any) {
		throw new SgdbError(`Le backend du plugin ne répond pas (${e?.message || e}).`);
	}
	const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
	if (!data?.ok) throw new SgdbError(data?.error || 'Erreur inconnue.', data?.status || 0);
	return data;
}

function key(): string {
	return (getSettings().sgdbKey || '').trim();
}

export const realProvider: Provider = {
	hasKey: () => !!key(),
	async game(appid) {
		return (await call(backend.sgdb_game(key(), appid))).game;
	},
	async search(term) {
		const games = (await call(backend.sgdb_search(key(), term))).games;
		return Array.isArray(games) ? games : [];
	},
	async assets(slot, gameId, styles, animated, page) {
		const d = await call(backend.sgdb_assets(key(), slot, gameId, styles.join(','), animated, page));
		// cjson encode une table vide en {} : on ne garde que les vrais tableaux
		return { items: Array.isArray(d.items) ? d.items : [], total: d.total || 0, page: d.page || 0, limit: d.limit || 50 };
	},
	async download(item) {
		const d = await call(backend.sgdb_download(item.url));
		return { base64: d.base64, format: d.format };
	},
	async apply(appid, slot, img) {
		await w.SteamClient.Apps.SetCustomArtworkForApp(appid, img.base64, img.format, slot.asset);
		notifyArtChanged();
	},
	async clear(appid, slot) {
		await w.SteamClient.Apps.ClearCustomArtworkForApp(appid, slot.asset);
		notifyArtChanged();
	},
};

// ---------- Visuels actuels ----------

/** Visuel d'origine (Steam) pour un emplacement. */
export function originalUrl(app: any, slot: Slot): string {
	const id = app.appid;
	const cdn = `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}`;
	switch (slot.id) {
		case 'capsule':
			return w.appStore?.GetVerticalCapsuleURLForApp?.(app) || `${cdn}/library_600x900.jpg`;
		case 'hero':
			return `${cdn}/library_hero.jpg`;
		case 'logo':
			return `${cdn}/logo.png`;
		case 'header':
			return `${cdn}/header.jpg`;
		case 'icon':
			return w.appStore?.GetIconURLForApp?.(app) || '';
	}
}

/**
 * Cherche le visuel personnalisé d'un emplacement. Steam renvoie un fichier de 40 octets
 * (qui ne se décode pas) quand il n'existe pas : on vérifie donc la taille réelle.
 */
export async function customUrl(app: any, slot: Slot): Promise<string | null> {
	return customArt(app.appid, slot.id, artStamp(app));
}

/** Lit un fichier choisi sur le PC et le convertit en base64. */
export function readLocalFile(file: File): Promise<ImageData> {
	return new Promise((resolve, reject) => {
		const type = (file.type || '').toLowerCase();
		const format = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : null;
		if (!format) {
			reject(new SgdbError('Steam accepte seulement les images PNG ou JPEG.'));
			return;
		}
		const reader = new FileReader();
		reader.onerror = () => reject(new SgdbError('Lecture du fichier impossible.'));
		reader.onload = () => {
			const s = String(reader.result || '');
			resolve({ base64: s.slice(s.indexOf(',') + 1), format });
		};
		reader.readAsDataURL(file);
	});
}
