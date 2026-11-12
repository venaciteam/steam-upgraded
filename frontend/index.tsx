import { definePlugin, routerHook, Field } from 'millennium';
import { loadSettings } from './core/settings';
import { initHistory } from './core/history';
import { navigate, ROUTES } from './core/steam';
import { initThemeEverywhere, Shell } from './shell/Shell';
import { initClassAliases } from './core/classAliases';
import { SettingsPage } from './pages/Settings';
import { LibraryPage } from './pages/Library';
import { GamePage } from './pages/Game';
import { StorePage } from './pages/Store';
import { StoreAppPage } from './pages/StoreApp';
import { WishlistPage } from './pages/Wishlist';
import { CartPage } from './pages/Cart';
import { DownloadsPage } from './pages/Downloads';
import { AlbumPage } from './pages/Album';
import { CapturesPage } from './pages/Captures';
import { initSteamSettingsRedirect } from './features/steamSettings';
import { initChatSkin } from './features/chatSkin';
import { initToastSkin } from './features/toastSkin';
import { initMediaRedirect } from './features/mediaRedirect';
import { initUpdates } from './features/updates';
import { BpHome } from './bigpicture/Home';
import { BpLibrary } from './bigpicture/Library';
import { BpGame } from './bigpicture/GamePage';
import { BpQuickMenu } from './bigpicture/QuickMenu';
import { BpStoreBar } from './bigpicture/StoreBar';
import { BpStore } from './bigpicture/Store';
import { BpStoreApp } from './bigpicture/StoreApp';
import { BpWishlist } from './bigpicture/Wishlist';
import { BpCart } from './bigpicture/Cart';
import { registerBpReskin } from './bigpicture/reskin';

let started = false;

async function start() {
	if (started) return;
	started = true;
	initClassAliases();
	await loadSettings();
	routerHook.addRoute(ROUTES.library, LibraryPage);
	routerHook.addRoute('/steamupgraded/app/:appid', GamePage);
	routerHook.addRoute(ROUTES.store, StorePage);
	routerHook.addRoute('/steamupgraded/vente/:appid', StoreAppPage);
	routerHook.addRoute(ROUTES.wishlist, WishlistPage);
	routerHook.addRoute(ROUTES.cart, CartPage);
	routerHook.addRoute(ROUTES.settings, SettingsPage);
	routerHook.addRoute(ROUTES.downloads, DownloadsPage);
	routerHook.addRoute('/steamupgraded/album/:appid', AlbumPage);
	routerHook.addRoute(ROUTES.captures, CapturesPage);
	routerHook.addRoute(ROUTES.bpHome, BpHome);
	routerHook.addRoute(ROUTES.bpLibrary, BpLibrary);
	routerHook.addRoute('/steamupgraded/bp/app/:appid', BpGame);
	routerHook.addRoute(ROUTES.bpMenu, BpQuickMenu);
	routerHook.addRoute(ROUTES.bpStore, BpStore);
	routerHook.addRoute('/steamupgraded/bp/vente/:appid', BpStoreApp);
	routerHook.addRoute(ROUTES.bpWishlist, BpWishlist);
	routerHook.addRoute(ROUTES.bpCart, BpCart);
	registerBpReskin();
	routerHook.addGlobalComponent('steam-upgraded-shell', Shell, 7);
	// Big Picture : notre en-tête au-dessus du magasin natif
	routerHook.addGlobalComponent('steam-upgraded-bp-store', BpStoreBar, 4);
	initThemeEverywhere();
	initHistory();
	initSteamSettingsRedirect();
	initChatSkin();
	initToastSkin();
	initMediaRedirect();
	initUpdates();
}

export default definePlugin(() => {
	start();
	return {
		icon: <span style={{ fontWeight: 800 }}>SP</span>,
		content: (
			<Field label="Steam Upgraded" description="Tous les réglages sont dans l'onglet Paramètres de la barre du haut.">
				<button type="button" onClick={() => navigate(ROUTES.settings)}>Ouvrir les paramètres</button>
			</Field>
		),
	};
});
