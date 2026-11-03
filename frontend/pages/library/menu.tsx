// Menu contextuel d'un jeu (clic droit sur une jaquette ou une carte « Reprendre ») : le menu natif de Steam,
// habillé (theme.ts, .sp-mi), avec en-tête, icônes et deux sous-menus (collections, gestion).
import { findModuleExport, Menu, MenuGroup, MenuItem, MenuSeparator, showContextMenu } from 'millennium';
import { mainWindow, navigate, openProperties, openStorePage, playOrInstall, ROUTES } from '../../core/steam';
import { openArtworkDialog, resetArtwork } from '../../features/sgdb';
import { isShortcut } from '../game/data';
import { formatBigHours, type Game } from './data';

const w = window as any;

const ICONS = {
	play: 'M7 4.5v15l12-7.5z',
	install: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
	card: 'M4 5h16v14H4zM8 9h8M8 13h5',
	store: 'M4 7h16l-1.5 11h-13zM9 7a3 3 0 0 1 6 0',
	folder: 'M3 7h6l2 2h10v10H3zM12 12v4M10 14h4',
	gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
	sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
	image: 'M4 5h16v14H4zM8 10a1.5 1.5 0 1 0 0-.01M20 16l-5-5-9 8',
	undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
	eyeoff: 'M3 3l18 18M10.6 6.1A9 9 0 0 1 21 12a14 14 0 0 1-2.4 3M6.6 6.6A14 14 0 0 0 3 12s3.5 7 9 7a8.7 8.7 0 0 0 4.4-1.2',
	eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
	trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
	check: 'M5 12l5 5 9-10',
	plus: 'M12 5v14M5 12h14',
};

type Icon = keyof typeof ICONS | '';

/** Contenu d'une entrée : icône (ou emplacement vide, pour aligner) puis libellé. */
export function Item({ icon, label, kind }: { icon: Icon; label: string; kind?: 'play' | 'danger' | 'on' }) {
	return (
		<span className={kind ? `sp-mi sp-mi--${kind}` : 'sp-mi'}>
			<span className="sp-mi-ic" aria-hidden="true">
				{icon && (
					<svg width="16" height="16" viewBox="0 0 24 24" fill={icon === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={icon === 'check' ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
						<path d={ICONS[icon]} />
					</svg>
				)}
			</span>
			<span className="sp-mi-label">{label}</span>
		</span>
	);
}

/** Titre de groupe dans un sous-menu (pas une entrée). */
const Heading = ({ children }: { children: string }) => <div className="sp-mi-heading">{children}</div>;

// ---------- Pièces de Steam (dialogues natifs, habillés par theme.ts) ----------

let dialogs: { newCollection: any; uninstall: any } | undefined;

function steamDialogs() {
	if (dialogs) return dialogs;
	const src = (e: any) => {
		try {
			return typeof e === 'function' ? Function.prototype.toString.call(e) : '';
		} catch {
			return '';
		}
	};
	let newCollection: any = null;
	let uninstall: any = null;
	try {
		// (fenêtre, jeux, origine) : dialogue « Nouvelle collection » de Steam
		newCollection = findModuleExport((e: any) => ((s) => s.includes('#GameAction_NewCollectionDialogTitle') && s.includes('rgManuallyAddedApps'))(src(e)));
		// (appids, fenêtre, demander le mot de passe, client distant) : confirmation de désinstallation de Steam
		uninstall = findModuleExport((e: any) => src(e).includes('ShowUninstallDialog()'));
	} catch (err) {
		console.error('[steam-upgraded] dialogues de Steam introuvables', err);
	}
	return (dialogs = { newCollection, uninstall });
}

/** Dialogue de création d'une collection, avec ce jeu dedans. */
function newCollectionWith(app: any) {
	const win = mainWindow();
	const fn = steamDialogs().newCollection;
	if (fn && win) fn(win, [app], 'context-menu');
}

/** Confirmation de désinstallation (celle de Steam : rien ne part sans validation). */
export function uninstall(appid: number) {
	const fn = steamDialogs().uninstall;
	const win = mainWindow();
	if (fn && win) fn([appid], win, false, '0');
	else w.SteamClient?.Installs?.OpenUninstallWizard?.([appid], false);
}

// ---------- Collections ----------

type Target = { id: string; name: string; has: boolean; toggle: () => void };

/** Collections où l'on peut ranger un jeu à la main : Favoris puis les collections fixes de l'utilisateur. */
function collectionTargets(app: any): Target[] {
	const cs = w.collectionStore;
	if (!cs) return [];
	const appid = app.appid;
	const out: Target[] = [];
	const fav = !!cs.BIsFavorite?.(appid);
	out.push({ id: 'favorite', name: cs.GetCollection?.('favorite')?.displayName || 'Favoris', has: fav, toggle: () => cs.SetAppsAsFavorite([appid], !fav) });
	for (const c of cs.userCollections || []) {
		if (c.bIsDynamic || !c.bAllowsDragAndDrop || cs.BIsSystemCollectionId?.(c.id) || cs.BIsPartnerCollectionId?.(c.id)) continue;
		const dd = c.AsDragDropCollection();
		const has = !!dd.apps?.has?.(appid);
		out.push({ id: c.id, name: c.displayName, has, toggle: () => (has ? dd.RemoveApps([app]) : dd.AddApps([app])) });
	}
	return out;
}

export function isHidden(appid: number): boolean {
	return !!w.collectionStore?.BIsHidden?.(appid);
}

function statusLine(g: Game): string {
	const state = g.installed ? 'Installé' : 'Non installé';
	return `${state} · ${g.mins ? `${formatBigHours(g.mins)} de jeu` : 'jamais lancé'}`;
}

/** Ouvre le menu d'un jeu. `e` est l'évènement de clic droit ; `onChanged` relit la bibliothèque après une action. */
export function openGameMenu(e: any, g: Game, onChanged: () => void) {
	e?.preventDefault?.();
	const app = g.app;
	const steamApp = !isShortcut(g.appid);
	const hidden = isHidden(g.appid);
	const later = (fn: () => any) => () => {
		try {
			fn();
		} finally {
			setTimeout(onChanged, 400);
		}
	};
	const colls = collectionTargets(app);
	try {
		showContextMenu(
			<Menu label={g.name}>
				<div className="sp-mi-head">
					<span className="sp-mi-title">{g.name}</span>
					<span className="sp-mi-sub">{statusLine(g)}</span>
				</div>
				<MenuItem onSelected={() => playOrInstall(app)}>
					<Item icon={g.installed ? 'play' : 'install'} label={g.installed ? 'Jouer' : 'Installer'} kind="play" />
				</MenuItem>
				<MenuItem onSelected={() => navigate(ROUTES.app(g.appid))}>
					<Item icon="card" label="Fiche du jeu" />
				</MenuItem>
				{steamApp && (
					<MenuItem onSelected={() => openStorePage(g.appid)}>
						<Item icon="store" label="Page du magasin" />
					</MenuItem>
				)}
				<MenuSeparator />
				<MenuGroup label={(<Item icon="folder" label="Ajouter à une collection" />) as any}>
					<Heading>Mes collections</Heading>
					{colls.map((c) => (
						<MenuItem key={c.id} onSelected={later(c.toggle)}>
							<Item icon={c.has ? 'check' : ''} label={c.name} kind={c.has ? 'on' : undefined} />
						</MenuItem>
					))}
					<MenuSeparator />
					<MenuItem onSelected={later(() => newCollectionWith(app))}>
						<Item icon="plus" label="Nouvelle collection…" />
					</MenuItem>
				</MenuGroup>
				<MenuGroup label={(<Item icon="sliders" label="Gérer" />) as any}>
					<Heading>Visuels</Heading>
					<MenuItem onSelected={() => openArtworkDialog(app)}>
						<Item icon="image" label="Personnaliser les visuels…" />
					</MenuItem>
					<MenuItem onSelected={later(() => resetArtwork(app))}>
						<Item icon="undo" label="Restaurer les visuels d’origine" />
					</MenuItem>
					<MenuSeparator />
					<MenuItem onSelected={later(() => w.collectionStore.SetAppsAsHidden([g.appid], !hidden))}>
						<Item icon={hidden ? 'eye' : 'eyeoff'} label={hidden ? 'Afficher ce jeu' : 'Masquer ce jeu'} />
					</MenuItem>
					{g.installed && steamApp && (
						<MenuItem onSelected={() => uninstall(g.appid)}>
							<Item icon="trash" label="Désinstaller…" kind="danger" />
						</MenuItem>
					)}
				</MenuGroup>
				<MenuSeparator />
				<MenuItem onSelected={() => openProperties(app)}>
					<Item icon="gear" label="Propriétés…" />
				</MenuItem>
			</Menu>,
			e,
		);
	} catch (err) {
		console.error('[steam-upgraded] menu contextuel impossible', err);
	}
}
