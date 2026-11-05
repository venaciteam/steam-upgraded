// Noms de classes lisibles de Steam (.TopBar, .TitleBarControls, .BottomBar…), dont dépendent notre thème et nos sélecteurs.
// Steam ne livre que des noms hachés (« _3cykd-VfN_xBxf3Qxriccm »). Sous Windows et Linux, Millennium réécrit les modules CSS
// de Steam pour y ajouter le nom lisible (« _3cykd… TitleBarControls ») ; sur macOS ce mécanisme n'existe pas.
// Ici, l'équivalent côté page : on lit la correspondance haché → lisible dans les modules déjà chargés de Steam, et on ajoute
// le nom lisible aux éléments de chaque fenêtre. Ne fait rien si Millennium a déjà ajouté les noms.
const w = window as any;

/** Même règle que Millennium (loopback/src/css_classes.rs) pour reconnaître un nom haché. */
function isCssHash(s: string): boolean {
	if (s.length < 18 || s.length > 30 || !/^[A-Za-z0-9_-]+$/.test(s)) return false;
	const digit = /[0-9]/.test(s);
	const upper = /[A-Z]/.test(s);
	return digit || /[A-Z]{2}/.test(s) || (s.includes('-') && (digit || upper));
}

let req: any = null;
const map = new Map<string, string[]>();
const seen = new Set<string>();
const misses = new Set<string>();
let native = false;
const docs = new Set<Document>();

/** Lit les modules CSS chargés depuis la dernière lecture. Renvoie true si de nouvelles correspondances sont apparues. */
function refreshMap(): boolean {
	if (!req?.m) return false;
	let added = false;
	// Comme le SDK de Millennium (webpack.ts) : chaque module est demandé à webpack, qui renvoie celui déjà évalué.
	// Les identifiants nouveaux viennent des morceaux chargés plus tard.
	for (const id of Object.keys(req.m)) {
		if (seen.has(id)) continue;
		seen.add(id);
		let m: any;
		try {
			m = req(id);
		} catch {
			continue;
		}
		if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
		let keys: string[];
		try {
			keys = Object.keys(m);
		} catch {
			continue;
		}
		for (const k of keys) {
			let v: any;
			try {
				v = Object.getOwnPropertyDescriptor(m, k)?.value;
			} catch {
				continue;
			}
			if (typeof v !== 'string') continue;
			const parts = v.split(' ');
			// Millennium est passé par là (« haché lisible ») : rien à faire sur cette plateforme
			if (parts.length > 1 && parts[1] === k && isCssHash(parts[0])) native = true;
			const h = parts[0];
			if (!isCssHash(h) || h === k) continue;
			const list = map.get(h);
			if (!list) map.set(h, [k]);
			else if (!list.includes(k)) list.push(k);
			else continue;
			added = true;
		}
	}
	return added;
}

let refreshTimer: any = null;
function scheduleRefresh() {
	if (refreshTimer) return;
	refreshTimer = setTimeout(() => {
		refreshTimer = null;
		if (!refreshMap()) return;
		misses.clear();
		for (const d of docs) aliasTree(d.documentElement);
	}, 300);
}

function aliasEl(el: Element) {
	const cl = el.classList;
	if (!cl || !cl.length) return;
	let add: string[] | null = null;
	for (let i = 0; i < cl.length; i++) {
		const c = cl[i];
		const keys = map.get(c);
		if (keys) {
			for (const k of keys) if (!cl.contains(k)) (add ||= []).push(k);
		} else if (!misses.has(c) && isCssHash(c)) {
			// Module chargé après la dernière lecture (fenêtre ou page ouverte plus tard)
			misses.add(c);
			scheduleRefresh();
		}
	}
	if (add) cl.add(...add);
}

function aliasTree(root: Element | null | undefined) {
	if (!root) return;
	aliasEl(root);
	root.querySelectorAll?.('[class]').forEach(aliasEl);
}

function watch(doc: Document | null | undefined) {
	if (!doc?.documentElement || docs.has(doc)) return;
	const MO = (doc.defaultView as any)?.MutationObserver;
	if (!MO) return;
	docs.add(doc);
	aliasTree(doc.documentElement);
	const observer = new MO((records: MutationRecord[]) => {
		for (const r of records) {
			if (r.type === 'attributes') aliasEl(r.target as Element);
			else r.addedNodes.forEach((n) => n.nodeType === 1 && aliasTree(n as Element));
		}
	});
	observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
	doc.defaultView?.addEventListener('unload', () => {
		observer.disconnect();
		docs.delete(doc);
	});
}

/** À appeler tôt : avant la thème et la barre du haut, qui cherchent ces noms. */
export function initClassAliases() {
	try {
		w.webpackChunksteamui.push([[Symbol('steamupgraded-aliases')], {}, (r: any) => (req = r)]);
	} catch {
		return;
	}
	refreshMap();
	if (native || !map.size) return;
	for (const p of w.g_PopupManager?.GetPopups?.() || []) watch(p.window?.document);
	w.g_PopupManager?.AddPopupCreatedCallback?.((p: any) => setTimeout(() => watch(p.window?.document), 0));
}

/** Pour le diagnostic : vrai si nos alias tournent (macOS), faux si Millennium s'en charge. */
export function classAliasesActive(): boolean {
	return !native && docs.size > 0;
}
