// Liste de souhaits complète (bureau et Big Picture) : filtres, tris, ligne d'information de chaque jeu.
import { Deal, Owned, promoEndWhen, reviewScore, Wishlist } from './data';

export type WishFilter = 'all' | 'sale' | 'soon' | 'nodup';
export type WishSort = 'rank' | 'discount' | 'price' | 'added' | 'reviews';

export const WISH_SORTS: { id: WishSort; label: string }[] = [
	{ id: 'rank', label: 'Votre ordre' },
	{ id: 'discount', label: 'Meilleure réduction' },
	{ id: 'price', label: 'Prix croissant' },
	{ id: 'added', label: 'Ajoutés récemment' },
	{ id: 'reviews', label: 'Meilleurs avis' },
];

export function wishFilters(wl: Wishlist | undefined, own: Map<number, Owned>): { id: WishFilter; label: string; count?: number }[] {
	const items = wl?.items || [];
	const all = [
		{ id: 'all' as const, label: 'Toutes', count: items.length },
		{ id: 'sale' as const, label: 'En promo', count: items.filter((d) => d.discount > 0).length },
		{ id: 'soon' as const, label: 'À venir', count: items.filter((d) => d.comingSoon).length },
		{ id: 'nodup' as const, label: 'Sans doublon famille' },
	];
	// sans Famille Steam ni jeu déjà à soi, ce filtre ne retire rien
	return all.filter((f) => f.id !== 'nodup' || items.some((d) => own.has(d.appid)));
}

export function filterWishlist(items: Deal[], filter: WishFilter, sort: WishSort, own: Map<number, Owned>): Deal[] {
	const list = items.filter((d) => (filter === 'sale' ? d.discount > 0 : filter === 'soon' ? !!d.comingSoon : filter === 'nodup' ? !own.has(d.appid) : true));
	const price = (d: Deal) => (d.comingSoon || d.final == null ? Infinity : d.final);
	// Steam range les souhaits par priorité (1 en tête) ; 0 = pas encore rangé, en fin de liste
	const rank = (d: Deal) => (d.priority ? d.priority : Infinity);
	if (sort === 'rank') list.sort((a, b) => rank(a) - rank(b) || (b.added ?? 0) - (a.added ?? 0));
	else if (sort === 'discount') list.sort((a, b) => b.discount - a.discount || price(a) - price(b));
	else if (sort === 'price') list.sort((a, b) => price(a) - price(b));
	else if (sort === 'added') list.sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
	else list.sort((a, b) => reviewScore(b) - reviewScore(a) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
	return list;
}

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** « Sortie prévue : 2027 », « … le 12 mars 2027 », ou le message de l'éditeur. */
export function releaseLabel(d: Deal): string {
	if (d.releaseText) return `Sortie prévue : ${d.releaseText}`;
	if (d.release) return d.releaseYearOnly ? `Sortie prévue : ${new Date(d.release * 1000).getFullYear()}` : `Sortie prévue le ${DAY.format(new Date(d.release * 1000))}`;
	return 'Sortie à venir';
}

/** Ligne d'information sous le nom : copie de la famille, sortie à venir, fin de promo ou date d'ajout. */
export function wishNote(d: Deal, owned?: Owned): { text: string; color?: string } {
	if (owned?.kind === 'family') return { text: `Déjà jouable via la copie de ${owned.member.name}`, color: owned.member.color };
	if (owned) return { text: 'Déjà dans votre bibliothèque', color: 'var(--sp-accent)' };
	if (d.comingSoon) return { text: releaseLabel(d) };
	const end = d.discount > 0 ? promoEndWhen(d.discountEnd) : '';
	// promoEndWhen : « le 5 novembre » ou « dans 18 h »
	if (end) return { text: end.startsWith('le ') ? `Promo jusqu’au ${end.slice(3)}` : `Promo encore ${end.replace(/^dans /, '')}` };
	if (d.added) return { text: `Ajouté le ${DAY.format(new Date(d.added * 1000))}` };
	return { text: '' };
}

/** Chiffres de l'en-tête : souhaits, à venir, en promo, économie possible, jouables via la famille. */
export function wishStats(wl: Wishlist | undefined, own: Map<number, Owned>) {
	const items = wl?.items || [];
	const sale = items.filter((d) => d.discount > 0 && d.final != null);
	return {
		count: items.length,
		soon: items.filter((d) => d.comingSoon).length,
		sale: sale.length,
		save: sale.reduce((n, d) => n + Math.max(0, (d.original ?? 0) - (d.final ?? 0)), 0),
		family: items.filter((d) => own.get(d.appid)?.kind === 'family').length,
	};
}

/** Peut-on l'ajouter au panier depuis la liste ? (paquet connu, déjà sorti, payant) */
export function canBuy(d: Deal): boolean {
	return !d.comingSoon && !d.free && d.final != null && !!(d.packageid || d.bundleid);
}
