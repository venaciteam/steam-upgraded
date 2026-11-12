// Notifications du bureau : chaque notification est une petite fenêtre (283 × 70 px) que Steam colle au coin de l'écran.
// On l'écarte des bords de l'écran (marge de sécurité) et on donne à la carte l'image de la notification (icône du jeu,
// avatar, icône du succès) pour son fond en fondu (feuille dans core/theme.ts, section « Notifications du bureau »).

const w = window as any;

/** Écart entre la notification et les bords de l'écran (px CSS). */
const MARGE = 16;

function watch(popup: any) {
	const win = popup?.window;
	if (!win || !/^notificationtoasts_.*_desktop$/.test(String(popup?.m_strName || '')) || win.__spToast) return;
	win.__spToast = true;
	// Position donnée par Steam et position où l'on a mis la fenêtre : Steam peut la redéplacer (pile de notifications),
	// et screenX peut encore renvoyer l'ancienne valeur juste après un déplacement.
	let steamPos = '';
	let ourPos = '';
	const place = () => {
		const x = win.screenX;
		const y = win.screenY;
		const pos = `${x},${y}`;
		if (pos === steamPos || pos === ourPos) return;
		steamPos = pos;
		const s = win.screen;
		const left = s.availLeft || 0;
		const top = s.availTop || 0;
		// Décalage identique pour toutes les notifications (la pile garde ses écarts), vers le centre de l'écran
		const dx = x + win.outerWidth / 2 > left + s.availWidth / 2 ? -MARGE : MARGE;
		const dy = y + win.outerHeight / 2 > top + s.availHeight / 2 ? -MARGE : MARGE;
		ourPos = `${x + dx},${y + dy}`;
		win.SteamClient?.Window?.MoveTo?.(x + dx, y + dy, win.devicePixelRatio || 1);
	};
	const paint = () => {
		const doc: Document = win.document;
		const img = doc.querySelector('.Panel img') as HTMLImageElement | null;
		const url = img?.currentSrc || img?.src || '';
		const val = url ? `url("${url.replace(/"/g, '%22')}")` : '';
		const root = doc.documentElement;
		if (root.style.getPropertyValue('--sp-toast-img') === val) return;
		if (val) root.style.setProperty('--sp-toast-img', val);
		else root.style.removeProperty('--sp-toast-img');
	};
	const tick = () => {
		if (win.closed || !win.document) {
			clearInterval(timer);
			return;
		}
		try {
			place();
			paint();
		} catch {}
	};
	const timer = setInterval(tick, 120);
	tick();
}

export function initToastSkin() {
	for (const p of w.g_PopupManager?.GetPopups?.() || []) watch(p);
	w.g_PopupManager?.AddPopupCreatedCallback?.((p: any) => setTimeout(() => watch(p), 0));
}
