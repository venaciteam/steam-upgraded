// Notre en-tête au-dessus du magasin de Big Picture (route native /steamweb, une vue de navigateur).
// Composant global du mode manette : il n'apparaît que sur le magasin. Il masque l'en-tête natif,
// descend le conteneur du navigateur sous notre barre (la vue native suit l'élément .Browser)
// et garde LB/RB pour changer de section et B pour revenir à notre écran, que la page web recevrait sinon.
import { useEffect, useState } from 'react';
import { usePath } from '../core/history';
import { useSettings } from '../core/settings';
import { previousBpPath } from '../core/history';
import { bpNavigate, bpRouter, bpWindow, ROUTES } from '../core/steam';
import { DESIGN_WIDTH, goBackBp, Header, switchTab, useHideNativeHeader } from './Frame';
import { BP_CSS } from './styles';

const w = window as any;

// Hauteur de l'en-tête, en pixels de référence (marge du haut + pastille de compte + respiration)
const BAR_HEIGHT = 112;

// Valeurs de GamepadButton (millennium)
const B = 2;
const LB = 5;
const RB = 6;

// Le navigateur du magasin garde son historique d'une visite à l'autre : on note où il en était quand
// un de nos écrans l'ouvre, pour que B recule dans les pages de Valve visitées depuis, puis revienne chez nous.
let entryIndex: number | null = null;

/** Page web du magasin de Steam dans Big Picture (route native /steamweb), sous notre en-tête. */
export function openSteamWebBp(url: string) {
	const r = bpRouter();
	// navigateur pas encore créé : il démarrera sur sa page vide (entrée 0)
	entryIndex = r?.m_StoreBrowser?.m_history?.index ?? 0;
	r?.NavigateToSteamWeb?.(url);
}

/** B sur le magasin : page précédente du magasin si on y a navigué, sinon notre écran précédent. */
function storeBack() {
	const b = bpRouter()?.m_StoreBrowser;
	const index = b?.m_history?.index ?? 0;
	// jamais vers la page vide de départ du navigateur (data:…) : Steam enchaînerait sur son propre retour,
	// qui remonte jusqu'à /index.html et relance Big Picture
	const prevIsWeb = /^https?:/.test(b?.m_history?.entries?.[index - 1]?.url || '');
	if (b?.CanGoBackward && prevIsWeb && (entryIndex == null || index > entryIndex + 1)) b.GoBack();
	// sans écran précédent noté (fil vide après un rechargement), Steam ramènerait à l'accueil : on revient au Magasin
	else if (previousBpPath()) goBackBp();
	else bpNavigate(ROUTES.bpStore);
}

function useZoom(): number {
	const read = () => (bpWindow()?.innerWidth || DESIGN_WIDTH) / DESIGN_WIDTH;
	const [zoom, set] = useState(read);
	useEffect(() => {
		const win = bpWindow();
		const onResize = () => set(read());
		win?.addEventListener('resize', onResize);
		return () => win?.removeEventListener('resize', onResize);
	}, []);
	return zoom;
}

function StoreBarShown() {
	useHideNativeHeader();
	const zoom = useZoom();
	const height = Math.round(BAR_HEIGHT * zoom);

	useEffect(() => {
		const handle = w.FocusNavController?.SetCatchAllGamepadInput?.((button: number, down: boolean) => {
			if (button === B) {
				if (down) storeBack();
				return true;
			}
			if (button !== LB && button !== RB) return false;
			if (down) switchTab('store', button === LB ? -1 : 1);
			return true;
		});
		return () => handle?.Unregister?.();
	}, []);

	return (
		<div className="sp-root" style={{ position: 'fixed', top: 0, left: 0, right: 0, height, zIndex: 20, overflow: 'hidden', background: 'var(--sp-bg)', borderBottom: '1px solid var(--sp-line)' }}>
			<style>{`${BP_CSS}
.MainBrowserContainer{margin-top:${height}px !important;height:calc(100% - ${height}px) !important;}`}</style>
			<div className="spbp" style={{ zoom, height: BAR_HEIGHT }}>
				<Header tab="store" />
			</div>
		</div>
	);
}

export function BpStoreBar() {
	const s = useSettings();
	const path = usePath('bp');
	if (!s.replaceBigPicture || !path.startsWith('/steamweb')) return null;
	return <StoreBarShown />;
}
