// Transitions entre nos pages du bureau :
// - glissement avec fondu selon l'ordre des onglets (vers la gauche pour avancer, vers la droite pour revenir) ;
// - la jaquette cliquée s'agrandit jusqu'à la fiche du jeu (ou la page d'une bande-son), et la fiche s'y referme au retour ;
// - « Animations réduites » de Windows : simple fondu très court, sans mouvement.
// React retire l'ancienne page d'un coup. Juste avant (nettoyage de son effet, la page est encore affichée), on en garde
// une copie figée ; la nouvelle page la reprend à son montage, l'anime en sortie pendant sa propre entrée, puis la supprime.
// Pages web de Valve (Communauté…) : vue native de Steam posée par-dessus l'interface. En y allant, notre page glisse et
// s'efface pendant que la vue reste masquée, puis la vue entre en glissant (sans fondu, elle ne sait pas être transparente) ;
// en revenant, Steam la masque d'un coup et notre page entre seule en glissant. Autres pages natives : rien ne bouge.
import { useLayoutEffect, useRef } from 'react';
import { currentPath, previousDesktopPath } from './history';
import { mainRouter } from './steam';

type Leaving = {
	clone: HTMLElement;
	from: string;
	to: string;
	box: { left: number; top: number; width: number; height: number };
	scrolls: [number, number, number][];
	/** Jaquette cliquée (zoom vers la fiche), en coordonnées de la fenêtre. */
	tile: DOMRect | null;
};

let leaving: Leaving | null = null;
let running: Animation[] = [];
/** Genre de la dernière jaquette agrandie (tuile, Reprendre, bande-son) : la fiche se referme vers le même. */
let lastKind = '';

/**
 * Lance `fn` juste avant la prochaine image (requestAnimationFrame), ou après 60 ms si la fenêtre ne dessine plus
 * (vue web de Valve par-dessus, fenêtre cachée). Renvoie de quoi l'annuler.
 */
export function beforeNextFrame(win: Window | null | undefined, fn: () => void): () => void {
	let done = false;
	const run = () => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		if (raf) win?.cancelAnimationFrame(raf);
		fn();
	};
	const timer = setTimeout(run, 60);
	const raf = win?.requestAnimationFrame(run);
	return () => {
		done = true;
		clearTimeout(timer);
		if (raf) win?.cancelAnimationFrame(raf);
	};
}

/** Durée en ms, multipliée par `window.__spTransitionSlow` (ralenti pour vérifier une transition depuis DevTools). */
function ms(n: number): number {
	return n * ((window as any).__spTransitionSlow || 1);
}

/** Ordre des onglets ; les fiches et pages ouvertes depuis la Bibliothèque se placent juste après elle. */
function rank(path: string): number | null {
	if (path.startsWith('/steamupgraded/library')) return 0;
	if (path.startsWith('/steamupgraded/app/') || path.startsWith('/steamupgraded/album/') || path.startsWith('/steamupgraded/captures')) return 0.5;
	if (path.startsWith('/steamupgraded/store')) return 1;
	// liste de souhaits et panier : sous-pages du Magasin, avant la page de vente
	if (path.startsWith('/steamupgraded/souhaits')) return 1.2;
	if (path.startsWith('/steamupgraded/panier')) return 1.3;
	// page de vente : juste après le Magasin (on y entre en glissant)
	if (path.startsWith('/steamupgraded/vente')) return 1.5;
	if (path.startsWith('/browser')) return 2;
	if (path.startsWith('/steamupgraded/settings')) return 3;
	if (path.startsWith('/steamupgraded/downloads')) return 4;
	return null;
}

/** Pages du Magasin qui partagent le sélecteur Promos / Liste de souhaits / Panier. */
const STORE_TABS = /^\/steamupgraded\/(store|souhaits|panier)/;

/** Appid d'une fiche ou d'une bande-son. */
function detailId(path: string): string | null {
	return /^\/steamupgraded\/(?:app|album)\/(\d+)/.exec(path)?.[1] || null;
}

/** Rectangle de l'élément s'il est visible dans le conteneur des pages. */
function visible(el: Element, frame: Element): DOMRect | null {
	const r = el.getBoundingClientRect();
	const v = frame.getBoundingClientRect();
	if (!r.width || r.bottom < v.top + 8 || r.top > v.bottom - 8 || r.right < v.left || r.left > v.right) return null;
	return r;
}

/** Jaquette d'un jeu dans une page (`data-sp-appid`) : celle qui contient le focus (le bouton cliqué), sinon le genre voulu, sinon la première visible. */
function findTile(root: HTMLElement, frame: HTMLElement, appid: string, kind?: string): HTMLElement | null {
	const all = [...root.querySelectorAll<HTMLElement>(`[data-sp-appid="${appid}"]`)].filter((el) => visible(el, frame));
	const active = root.ownerDocument.activeElement;
	return all.find((el) => active && (el.contains(active) || active.contains(el))) || all.find((el) => el.dataset.spKind === kind) || all[0] || null;
}

/** Vue web native de Steam (Communauté, magasin web), lue dans les propriétés React de son emplacement. */
function webView(doc: Document): any {
	const el = doc.querySelector('.BrowserWrapper .Browser');
	const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber'));
	let f = key ? (el as any)[key] : null;
	for (let i = 0; i < 6 && f; i++, f = f.return) {
		const b = f.memoizedProps?.browser;
		if (b?.SetBounds && b?.SetVisible) return b;
	}
	return null;
}

/** Place la copie figée de la page quittée dans le conteneur, à sa position de défilement. */
function placeClone(l: Leaving, frame: HTMLElement, before: Element | null, z: string) {
	const { clone } = l;
	Object.assign(clone.style, {
		position: 'absolute',
		left: `${l.box.left}px`,
		top: `${l.box.top}px`,
		width: `${l.box.width}px`,
		height: `${l.box.height}px`,
		margin: '0',
		pointerEvents: 'none',
		zIndex: z,
	});
	frame.insertBefore(clone, before);
	if (!l.scrolls.length) return;
	const all = clone.querySelectorAll('*');
	for (const [i, top, left] of l.scrolls) {
		const el = i < 0 ? clone : all[i];
		if (el) {
			el.scrollTop = top;
			el.scrollLeft = left;
		}
	}
}

function track(anims: Animation[], done: () => void) {
	running.push(...anims);
	let left = anims.length;
	const end = () => {
		if (--left > 0) return;
		running = running.filter((a) => !anims.includes(a));
		done();
	};
	for (const a of anims) {
		a.onfinish = end;
		a.oncancel = end;
	}
}

/** Animation de la vue web en cours (interrompue par une nouvelle navigation). */
let webSlide: { stop: () => void } | null = null;

/**
 * Vers une page web de Valve. La vue web est dessinée par-dessus toute l'interface et ne sait pas devenir transparente :
 * on la masque le temps que la page quittée glisse et s'efface, puis elle apparaît en glissant jusqu'à sa place
 * (SetBounds image par image), dans le même sens que les autres pages.
 */
function revealWeb(l: Leaving, frame: HTMLElement, rf: number) {
	const doc = frame.ownerDocument;
	const win = doc.defaultView;
	const view = webView(doc);
	if (!view || !win) return;
	const reduced = reducedMotion(win);
	const d = 2 > rf ? 1 : -1;
	let hiding = true;
	// Steam affiche la vue juste après le changement de route : on la remasque tant que la page quittée s'efface.
	// Minuteries et non requestAnimationFrame : quand la vue couvre la fenêtre, Chromium suspend les images de l'interface.
	const hide = () => {
		if (!hiding) return;
		try {
			view.SetVisible(false);
		} catch {}
		setTimeout(hide, 16);
	};
	hide();
	placeClone(l, frame, null, '10');
	const out = reduced
		? l.clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(140), easing: 'linear', fill: 'forwards' })
		: l.clone.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-48 * d}px)` }], { duration: ms(200), easing: 'ease-in', fill: 'forwards' });
	track([out], async () => {
		l.clone.remove();
		hiding = false;
		// Partie ailleurs entre-temps : Steam a masqué la vue, on n'y touche plus
		if (!currentPath().startsWith('/browser')) return;
		let r: any = null;
		try {
			r = await view.GetBounds();
		} catch {}
		try {
			view.SetVisible(true);
		} catch {}
		if (reduced || !r?.width) return;
		const t0 = win.performance.now();
		const dur = ms(280);
		let stopped = false;
		const place = (dx: number) => {
			try {
				view.SetBounds(r.x + dx, r.y, r.width, r.height);
			} catch {}
		};
		const stop = () => {
			if (stopped) return;
			stopped = true;
			webSlide = null;
			place(0);
		};
		webSlide = { stop };
		const step = () => {
			if (stopped) return;
			const k = Math.min(1, (win.performance.now() - t0) / dur);
			// même courbe que les pages : départ vif, arrivée douce
			const e = 1 - Math.pow(1 - k, 3);
			if (k >= 1) return stop();
			place(Math.round(56 * d * (1 - e)));
			setTimeout(step, 16);
		};
		place(56 * d);
		setTimeout(step, 16);
	});
}

function reducedMotion(win: Window | null): boolean {
	return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Termine tout de suite les animations en cours (nouvelle navigation pendant une transition). */
function finishRunning() {
	webSlide?.stop();
	const list = running;
	running = [];
	for (const a of list) {
		try {
			a.finish();
		} catch {
			a.cancel();
		}
	}
}

// ---------- Mesures prises au fil de l'eau ----------
// Au moment de quitter une page, la nouvelle est souvent déjà dans le document : y lire une taille ou un défilement
// force le navigateur à mettre toute la page en place sur-le-champ (≈ 100 ms pour la Bibliothèque et ses jaquettes),
// en plus de celle qu'il fera ensuite. On note donc ces valeurs quand elles sont déjà connues.

/** Défilement de chaque élément, relevé à chaque évènement « scroll » (la mise en page est alors à jour). */
const scrollPos = new WeakMap<Element, [number, number]>();
/** Taille et position du conteneur des pages, relevées par un ResizeObserver (après la mise en page). */
const frameBox = new WeakMap<Element, { width: number; height: number }>();
/** Dernière jaquette cliquée, mesurée au clic. */
let lastClick: { el: HTMLElement; appid: string; rect: DOMRect; at: number } | null = null;
const watchedDocs = new WeakSet<Document>();
const watchedFrames = new WeakSet<Element>();

function watch(root: HTMLElement) {
	const doc = root.ownerDocument;
	const frame = root.parentElement;
	const win = doc.defaultView as any;
	if (!watchedDocs.has(doc)) {
		watchedDocs.add(doc);
		doc.addEventListener(
			'scroll',
			(e) => {
				const t = e.target;
				if (t && (t as Element).nodeType === 1) scrollPos.set(t as Element, [(t as Element).scrollTop, (t as Element).scrollLeft]);
			},
			{ capture: true, passive: true },
		);
		// Avant le code de la page (phase de capture) : la mise en page n'a pas encore été touchée par le clic
		doc.addEventListener(
			'click',
			(e) => {
				const t = e.target as HTMLElement | null;
				const el = (t?.closest?.('[data-sp-appid]') as HTMLElement | null) || (t?.closest?.('button, a, [role="button"]')?.querySelector('[data-sp-appid]') as HTMLElement | null);
				lastClick = el ? { el, appid: el.dataset.spAppid || '', rect: el.getBoundingClientRect(), at: Date.now() } : null;
			},
			{ capture: true },
		);
	}
	if (frame && win?.ResizeObserver && !watchedFrames.has(frame)) {
		watchedFrames.add(frame);
		new win.ResizeObserver(() => frameBox.set(frame, { width: frame.clientWidth, height: frame.clientHeight })).observe(frame);
	}
}

function leave(root: HTMLElement, from: string) {
	finishRunning();
	const frame = root.parentElement;
	const to = currentPath();
	if (!frame || to === from || rank(from) === null) return;
	// La page occupe tout le conteneur. On prend la taille du conteneur : selon la page, Steam y insère parfois la nouvelle
	// avant de retirer l'ancienne, et les deux se partagent alors la hauteur (copie coupée à mi-hauteur).
	const size = frameBox.get(frame) || { width: frame.clientWidth, height: frame.clientHeight };
	if (!size.width || !size.height) return;
	const id = rank(from) === 0 ? detailId(to) : null;
	// La jaquette cliquée a été mesurée au clic ; sinon (clavier, menu) on la cherche
	const clicked = id && lastClick && lastClick.appid === id && Date.now() - lastClick.at < 2000 && root.contains(lastClick.el) ? lastClick : null;
	const tileEl = clicked ? clicked.el : id ? findTile(root, frame, id) : null;
	if (tileEl) lastKind = tileEl.dataset.spKind || '';
	// Positions de défilement de la page et de ses blocs (la copie repart en haut sinon)
	const scrolls: [number, number, number][] = [];
	const rootPos = scrollPos.get(root);
	if (rootPos && (rootPos[0] || rootPos[1])) scrolls.push([-1, rootPos[0], rootPos[1]]);
	root.querySelectorAll('*').forEach((el, i) => {
		const p = scrollPos.get(el);
		if (p && (p[0] || p[1])) scrolls.push([i, p[0], p[1]]);
	});
	const clone = root.cloneNode(true) as HTMLElement;
	clone.setAttribute('aria-hidden', 'true');
	(clone as any).inert = true;
	const framePos = scrollPos.get(frame) || [0, 0];
	const l: Leaving = {
		clone,
		from,
		to,
		box: { left: framePos[1], top: framePos[0], width: size.width, height: size.height },
		scrolls,
		tile: clicked ? clicked.rect : tileEl ? tileEl.getBoundingClientRect() : null,
	};
	lastClick = null;
	// Page web : on agit tout de suite, avant que Steam n'affiche la vue par-dessus tout
	if (to.startsWith('/browser')) {
		revealWeb(l, frame, rank(from) as number);
		return;
	}
	leaving = l;
	// Personne ne la reprend dans ce rendu (page native derrière) : on l'oublie
	setTimeout(() => {
		if (leaving?.clone === clone) leaving = null;
	}, 0);
}

/** Fenêtres dont l'ouverture a déjà été animée (Steam recrée la fenêtre du bureau au retour de Big Picture). */
const opened = new WeakSet<Document>();

/**
 * Ouverture de la fenêtre, en cascade : la barre du haut descend
 * en place, la colonne de gauche glisse, puis les blocs et les jaquettes visibles apparaissent en cascade rapide (~0,55 s).
 * Tout reste cliquable pendant l'animation. Fenêtre encore cachée (Steam démarré dans la zone de notification) :
 * on attend qu'elle s'affiche.
 */
function playOpening(root: HTMLElement) {
	const doc = root.ownerDocument;
	const win = doc.defaultView;
	if (!win) return;
	if (doc.visibilityState !== 'visible') {
		const once = () => {
			if (doc.visibilityState !== 'visible') return;
			doc.removeEventListener('visibilitychange', once);
			if (root.isConnected) playOpening(root);
		};
		doc.addEventListener('visibilitychange', once);
		return;
	}
	const ease = 'cubic-bezier(.2,.8,.2,1)';
	const anims: Animation[] = [];
	const bar = doc.querySelector<HTMLElement>('.TopBar > .TitleBar');
	if (reducedMotion(win)) {
		for (const el of [bar, root]) if (el) anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(140), easing: 'linear', fill: 'backwards' }));
		track(anims, () => {});
		return;
	}
	const play = (el: Element | null | undefined, frames: Keyframe[], duration: number, delay: number) => {
		if (el) anims.push(el.animate(frames, { duration: ms(duration), delay: ms(delay), easing: ease, fill: 'backwards' }));
	};
	const drop = [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }];
	const slide = [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }];
	const rise = [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }];
	const pop = [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }];
	play(bar, drop, 220, 0);
	if (!root.classList.contains('spl-page')) {
		// Autre page à l'ouverture : elle remonte en apparaissant, juste après la barre
		play(root, rise, 300, 80);
		track(anims, () => {});
		return;
	}
	const view = root.getBoundingClientRect();
	const shown = (el: Element) => {
		const r = el.getBoundingClientRect();
		return r.height > 0 && r.top < view.bottom && r.bottom > view.top;
	};
	play(root.querySelector('aside'), slide, 260, 60);
	const main = root.querySelector('main');
	play(main?.querySelector('header'), rise, 260, 90);
	main?.querySelectorAll('.spl-resume').forEach((el, i) => play(el, pop, 260, 110 + i * 40));
	const blocks = [...(main?.querySelectorAll(':scope > div > section') || [])];
	let at = 200;
	for (const sec of blocks) {
		if (sec.querySelector('.spl-resume')) {
			play(sec.querySelector('h2'), rise, 260, 90);
			continue;
		}
		if (!shown(sec)) continue;
		const tiles = [...sec.querySelectorAll('.spl-tile')].filter(shown);
		if (!tiles.length) {
			play(sec, rise, 260, at);
			at += 40;
			continue;
		}
		// Section de la grille : son bandeau, puis les jaquettes visibles rangée par rangée
		play(sec.firstElementChild, rise, 260, at);
		const rows = [...new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top)))].sort((x, y) => x - y);
		tiles.forEach((t) => {
			const r = t.getBoundingClientRect();
			const row = rows.indexOf(Math.round(r.top));
			const col = Math.round((r.left - tiles[0].getBoundingClientRect().left) / Math.max(1, r.width));
			play(t, pop, 260, at + 20 + row * 50 + col * 18);
		});
	}
	track(anims, () => {});
}

// Pour vérifier l'ouverture depuis DevTools (SharedJSContext) sans redémarrer Steam : window.__spPlayOpening()
(window as any).__spPlayOpening = () => {
	const doc: Document | undefined = mainRouter()?.m_BrowserWindow?.document;
	const root = doc?.querySelector<HTMLElement>('.ContentFrame > .sp-root');
	if (root) playOpening(root);
	return !!root;
};

/**
 * `prepare` (facultatif) est appelé une fois, juste après l'insertion de la copie de la page quittée et avant toute
 * mesure : une page y rétablit son défilement, et une seule mise en page couvre alors les deux pages.
 */
function enter(root: HTMLElement, to: string, prepare?: () => void) {
	let pending = prepare;
	const ready = () => {
		pending?.();
		pending = undefined;
	};
	try {
		enterNow(root, to, ready);
	} finally {
		ready();
	}
}

function enterNow(root: HTMLElement, to: string, ready: () => void) {
	const l = leaving;
	leaving = null;
	const frame = root.parentElement;
	const win = root.ownerDocument.defaultView;
	const rt = rank(to);
	if (!frame || rt === null) return;
	watch(root);
	// Première page de cette fenêtre : animation d'ouverture
	if (!opened.has(root.ownerDocument)) {
		opened.add(root.ownerDocument);
		if (!l) {
			playOpening(root);
			return;
		}
	}
	// Retour d'une page web de Valve : Steam a déjà masqué la vue, notre page entre seule en glissant
	if (!l && previousDesktopPath().startsWith('/browser')) {
		const d = rt > 2 ? 1 : -1;
		const anim = reducedMotion(win)
			? root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(140), easing: 'linear', fill: 'backwards' })
			: root.animate([{ opacity: 0, transform: `translateX(${56 * d}px)` }, { opacity: 1, transform: 'none' }], { duration: ms(300), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
		track([anim], () => {});
		return;
	}
	if (!l || l.to !== to) return;
	const from = l.from;
	const rf = rank(from) as number;
	const { clone } = l;
	// Copie insérée, défilement de la page rétabli (ready), puis seulement les mesures : une seule mise en page
	placeClone(l, frame, root, '0');
	ready();
	const zoom = !reducedMotion(win) && ((l.tile && rf === 0 && rt === 0.5) || (rf === 0.5 && rt === 0));
	const rr = zoom ? root.getBoundingClientRect() : null;
	const backId = rf === 0.5 && rt === 0 ? detailId(from) : null;
	const backTile = backId && zoom ? findTile(root, frame, backId, lastKind) : null;
	const backRect = backTile ? backTile.getBoundingClientRect() : null;
	// La page est déjà positionnée (.sp-root, theme.ts) : seul son plan change, sans nouvelle mise en page
	const prev = { zIndex: root.style.zIndex };
	root.style.zIndex = '1';

	const anims: Animation[] = [];
	const ease = 'cubic-bezier(.2,.8,.2,1)';

	if (reducedMotion(win)) {
		anims.push(root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(140), easing: 'linear', fill: 'backwards' }));
		anims.push(clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(140), easing: 'linear', fill: 'forwards' }));
	} else if (l.tile && rr && rf === 0 && rt === 0.5) {
		// La jaquette s'agrandit jusqu'à la fiche ; la Bibliothèque s'estompe derrière
		const t = l.tile;
		const origin = `${t.left + t.width / 2 - rr.left}px ${t.top + t.height / 2 - rr.top}px`;
		const s = Math.min(0.5, Math.max(0.08, t.width / rr.width));
		root.style.transformOrigin = origin;
		clone.style.transformOrigin = origin;
		anims.push(root.animate([{ transform: `scale(${s})`, opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: 'none', opacity: 1 }], { duration: ms(400), easing: ease, fill: 'backwards' }));
		anims.push(clone.animate([{ opacity: 1, transform: 'none' }, { opacity: 0.25, transform: 'scale(.985)' }], { duration: ms(400), easing: 'ease-out', fill: 'forwards' }));
	} else if (backRect && rr) {
		// Retour : la fiche se referme vers sa jaquette, par-dessus la Bibliothèque qui revient
		const t = backRect;
		const origin = `${t.left + t.width / 2 - rr.left}px ${t.top + t.height / 2 - rr.top}px`;
		const s = Math.min(0.5, Math.max(0.08, t.width / rr.width));
		clone.style.zIndex = '2';
		root.style.transformOrigin = origin;
		clone.style.transformOrigin = origin;
		anims.push(clone.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.65 }, { transform: `scale(${s})`, opacity: 0 }], { duration: ms(360), easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }));
		anims.push(root.animate([{ opacity: 0.25, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: ms(380), easing: 'ease-out', fill: 'backwards' }));
	} else if (STORE_TABS.test(from) && STORE_TABS.test(to)) {
		// Promos, liste de souhaits, panier : fondu sur place, l'en-tête ne bouge pas et la pastille
		// du sélecteur glisse vers le nouvel onglet (StoreTabs) ; celle de la page quittée disparaît tout de suite
		clone.querySelectorAll<HTMLElement>('.sps-tabs-ind').forEach((el) => (el.style.opacity = '0'));
		anims.push(root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(240), easing: 'ease-out', fill: 'backwards' }));
		anims.push(clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(160), easing: 'ease-in', fill: 'forwards' }));
	} else if (rt !== rf) {
		// Glissement selon le sens des onglets
		const d = rt > rf ? 1 : -1;
		anims.push(root.animate([{ opacity: 0, transform: `translateX(${56 * d}px)` }, { opacity: 1, transform: 'none' }], { duration: ms(300), easing: ease, fill: 'backwards' }));
		anims.push(clone.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-56 * d}px)` }], { duration: ms(220), easing: 'ease-in', fill: 'forwards' }));
	} else {
		// Même rang (d'une fiche à une autre) : fondu et léger glissement vers le haut
		anims.push(root.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: ms(260), delay: ms(70), easing: ease, fill: 'backwards' }));
		anims.push(clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(140), easing: 'ease-in', fill: 'forwards' }));
	}

	track(anims, () => {
		clone.remove();
		root.style.zIndex = prev.zIndex;
		root.style.transformOrigin = '';
	});
}

/**
 * À poser sur la racine (`sp-root`) d'une page du bureau : `<div className="sp-root" ref={usePageTransition()}>`.
 * `prepare` : rétablit l'état de la page (défilement…) au bon moment de la transition (voir enter).
 */
export function usePageTransition<T extends HTMLElement = HTMLDivElement>(prepare?: () => void) {
	const ref = useRef<T>(null);
	// Chemin relu à chaque rendu : une page qui change d'adresse sans être recréée (fiche d'un autre jeu) garde le bon
	const path = useRef('');
	path.current = currentPath();
	useLayoutEffect(() => {
		const el = ref.current;
		if (el) enter(el, path.current, prepare);
		else prepare?.();
		return () => {
			const node = ref.current || el;
			if (node) leave(node, path.current);
		};
	}, []);
	return ref;
}
