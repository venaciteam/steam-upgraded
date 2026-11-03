// Reskin complet de Big Picture : nos écrans qui remplacent ceux de Steam (succès, téléchargements, recherche, médias,
// bandes-son et lecteur de musique, contacts, discussions et groupes)
// et l'habillage de ceux qui restent natifs (nativeSkin.tsx).
// Les redirections depuis les routes natives sont dans core/history.ts (bpRedirect).
import { routerHook } from 'millennium';
import { BpAchievements } from './Achievements';
import { BpDownloads } from './Downloads';
import { BpSearch } from './Search';
import { BpMedia } from './Media';
import { BpAlbum } from './Album';
import { BpPlayer } from './Player';
import { BpContacts } from './Contacts';
import { BpChat } from './Chat';
import { BpGroups } from './Groups';
import { BpNativeSkin, initBpNativeSkin } from './nativeSkin';
import { storeReady } from '../pages/store/data';

export function registerBpReskin() {
	routerHook.addRoute('/steamupgraded/bp/succes/:appid', BpAchievements);
	routerHook.addRoute('/steamupgraded/bp/telechargements', BpDownloads);
	routerHook.addRoute('/steamupgraded/bp/recherche', BpSearch);
	routerHook.addRoute('/steamupgraded/bp/medias', BpMedia);
	routerHook.addRoute('/steamupgraded/bp/album/:appid', BpAlbum);
	routerHook.addRoute('/steamupgraded/bp/lecteur', BpPlayer);
	routerHook.addRoute('/steamupgraded/bp/contacts', BpContacts);
	routerHook.addRoute('/steamupgraded/bp/discussion/:accountid', BpChat);
	routerHook.addRoute('/steamupgraded/bp/groupes', BpGroups);
	// habillage des écrans et menus restés natifs
	routerHook.addGlobalComponent('steam-upgraded-bp-skin', BpNativeSkin, 4);
	initBpNativeSkin();
	// magasin : pays et devise de l'utilisateur, réglés tôt (voir pages/store/data.ts)
	storeReady();
}
