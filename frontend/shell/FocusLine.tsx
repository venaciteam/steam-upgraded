// Liseré à l'accent tout en haut de la fenêtre principale, allumé quand Steam a le focus.
// Remplace la barre de focus de Steam (.FocusBar) : elle passait sous la zone de déplacement de la barre du haut
// et suivait un état de focus que Steam perd parfois (au démarrage, quand sa page d'accueil se ferme).
// Ici, le focus est relu en continu sur toutes les fenêtres de Steam (menus et dialogues compris), et le liseré
// s'éteint et se rallume comme un néon.
// En fenêtré (ni agrandie ni plein écran), Windows 11 dessine sa bordure de fenêtre par-dessus le haut de la page
// (1 pixel physique par 100 % d'échelle, 2 à 175 %) : elle recouvrait tout le liseré. Il est alors posé juste dessous.
import { useEffect, useState } from 'react';

const w = window as any;

const CSS = `
.FocusBar{visibility:hidden !important;}
.sp-focusline{position:fixed;left:0;right:0;top:0;height:1px;z-index:2147483000;pointer-events:none;opacity:0;
  background:linear-gradient(to right,transparent 4%,color-mix(in srgb,var(--sp-accent) 85%,transparent) 50%,transparent 96%);}
.sp-focusline::after{content:"";position:absolute;left:18%;right:18%;top:0;height:12px;
  background:radial-gradient(ellipse 50% 100% at 50% 0,color-mix(in srgb,var(--sp-accent) 30%,transparent),transparent 75%);}
.sp-focusline--on{animation:sp-neon-on .9s ease-out forwards;}
.sp-focusline--off{animation:sp-neon-off .55s ease-in forwards;}
@keyframes sp-neon-on{0%{opacity:0}10%{opacity:.75}16%{opacity:.12}26%{opacity:.9}32%{opacity:.35}48%{opacity:1}100%{opacity:1}}
@keyframes sp-neon-off{0%{opacity:1}18%{opacity:.45}26%{opacity:.75}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.sp-focusline--on{animation:none;opacity:1}.sp-focusline--off{animation:none;opacity:0}}
`;

/** Vrai si une fenêtre de Steam connue de son gestionnaire de fenêtres (principale, menus, dialogues) a le focus. */
function steamHasFocus(main: Window): boolean {
	try {
		if (main.document.hasFocus()) return true;
	} catch {}
	for (const p of w.g_PopupManager?.GetPopups?.() || []) {
		try {
			if (p.window?.document?.hasFocus()) return true;
		} catch {}
	}
	return false;
}

/** Vrai si la fenêtre est agrandie ou en plein écran (aucune bordure de Windows en haut). */
async function edgeToEdge(win: Window): Promise<boolean> {
	const sw = (win as any).SteamClient?.Window;
	try {
		const max = await new Promise<boolean>((ok) => {
			const r = sw?.IsWindowMaximized?.((v: boolean) => ok(!!v));
			if (r && typeof r.then === 'function') r.then((v: boolean) => ok(!!v));
			else if (!sw?.IsWindowMaximized) ok(false);
			setTimeout(() => ok(false), 1000);
		});
		if (max) return true;
	} catch {}
	// Plein écran (F11) ou repli : la fenêtre couvre tout l'écran
	return win.outerWidth >= win.screen.width && win.outerHeight >= win.screen.height;
}

/** Hauteur de la bordure de Windows en pixels CSS : un pixel physique par 100 % d'échelle, arrondi au-dessus. */
const frameInset = (win: Window) => {
	const dpr = win.devicePixelRatio || 1;
	return Math.ceil(dpr) / dpr;
};

export function FocusLine({ win }: { win: Window }) {
	// null : pas encore mesuré (aucune animation d'extinction au premier rendu)
	const [on, setOn] = useState<boolean | null>(null);
	const [inset, setInset] = useState(0);

	useEffect(() => {
		let alive = true;
		let timer: any = 0;
		const measure = () => {
			clearTimeout(timer);
			// Après la fin de l'agrandissement ou de la restauration
			timer = setTimeout(async () => {
				// Bordure propre à Windows : rien à décaler sur macOS ni sous Linux
				if (!/Win/i.test(win.navigator.platform || '')) return;
				const full = await edgeToEdge(win);
				if (alive) setInset(full ? 0 : frameInset(win));
			}, 150);
		};
		measure();
		win.addEventListener('resize', measure);
		return () => {
			alive = false;
			clearTimeout(timer);
			win.removeEventListener('resize', measure);
		};
	}, [win]);

	useEffect(() => {
		let misses = 0;
		const check = () => {
			if (steamHasFocus(win)) {
				misses = 0;
				setOn(true);
			} else if (++misses >= 2) {
				// deux relevés de suite : le focus qui passe d'une fenêtre de Steam à une autre ne fait pas clignoter
				setOn((cur) => (cur === null ? null : false));
			}
		};
		check();
		const timer = setInterval(check, 200);
		const soon = () => setTimeout(check, 0);
		win.addEventListener('focus', soon);
		win.addEventListener('blur', soon);
		return () => {
			clearInterval(timer);
			win.removeEventListener('focus', soon);
			win.removeEventListener('blur', soon);
		};
	}, [win]);

	return (
		<>
			<style>{CSS}</style>
			<div aria-hidden="true" style={inset ? { top: `${inset}px` } : undefined} className={`sp-focusline${on === true ? ' sp-focusline--on' : on === false ? ' sp-focusline--off' : ''}`} />
		</>
	);
}
