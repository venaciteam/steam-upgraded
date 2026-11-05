// Panier du compte Steam : lu et modifié par la connexion du client Steam au compte (service AccountCart),
// comme le fait le magasin de Valve. Steam n'exporte pas ce service (contrairement à Wishlist) : on lui envoie
// les messages par son transport, encodés et décodés ici en protobuf (numéros de champs relevés dans le code de Steam).
// Le paiement se fait toujours sur la page de Valve (https://store.steampowered.com/cart/).
import { useEffect, useState } from 'react';
import { findModuleExport } from 'millennium';
import { cartKey, CartItem, loadCartItems, storeCountry, useAsync } from './data';

// ---------- Protobuf minimal ----------

type Field = { wt: number; v: bigint | Uint8Array };

function varint(n: bigint): number[] {
	const out: number[] = [];
	do {
		let b = Number(n & 0x7fn);
		n >>= 7n;
		if (n > 0n) b |= 0x80;
		out.push(b);
	} while (n > 0n);
	return out;
}

const pbInt = (field: number, n: number | bigint | string) => [...varint(BigInt(field << 3)), ...varint(BigInt(n))];
const pbBytes = (field: number, b: number[] | Uint8Array) => [...varint(BigInt((field << 3) | 2)), ...varint(BigInt(b.length)), ...b];
const pbString = (field: number, s: string) => pbBytes(field, new TextEncoder().encode(s));

function pbRead(b: Uint8Array): Map<number, Field[]> {
	const out = new Map<number, Field[]>();
	let i = 0;
	const readVarint = () => {
		let n = 0n;
		let shift = 0n;
		for (;;) {
			const x = b[i++];
			n |= BigInt(x & 0x7f) << shift;
			shift += 7n;
			if (x < 0x80) return n;
		}
	};
	while (i < b.length) {
		const key = Number(readVarint());
		const field = key >> 3;
		const wt = key & 7;
		let v: bigint | Uint8Array;
		if (wt === 0) v = readVarint();
		else if (wt === 2) {
			const len = Number(readVarint());
			v = b.subarray(i, i + len);
			i += len;
		} else if (wt === 1 || wt === 5) {
			v = b.subarray(i, i + (wt === 1 ? 8 : 4));
			i += wt === 1 ? 8 : 4;
		} else throw new Error(`type protobuf ${wt}`);
		if (!out.has(field)) out.set(field, []);
		out.get(field)!.push({ wt, v });
	}
	return out;
}

const num = (m: Map<number, Field[]>, f: number) => {
	const v = m.get(f)?.[0]?.v;
	return typeof v === 'bigint' ? Number(v) : undefined;
};
const sub = (m: Map<number, Field[]>, f: number) => {
	const v = m.get(f)?.[0]?.v;
	return v instanceof Uint8Array ? pbRead(v) : undefined;
};

// ---------- Envoi par le transport du client ----------

let initFromObject: any = null;

/** Message brut pour le transport de Steam : il n'appelle que fromObject() puis serializeBinary(). */
class RawRequest {
	bytes = new Uint8Array();
	static fromObject(o: { bytes: number[] }) {
		const r = new RawRequest();
		r.bytes = new Uint8Array(o.bytes);
		return r;
	}
	serializeBinary() {
		return this.bytes;
	}
}

/** Réponse brute : Steam la remplit par deserializeBinaryFromReader(instance, lecteur protobuf) ; on garde les octets. */
class RawResponse {
	bytes = new Uint8Array();
	static deserializeBinaryFromReader(inst: RawResponse, reader: any) {
		const d = reader?.decoder_;
		if (!d?.bytes_) throw new Error('lecteur protobuf inattendu');
		inst.bytes = d.bytes_.subarray(d.start_, d.end_);
		return inst;
	}
}

async function send(method: string, bytes: number[], readOnly = false): Promise<Map<number, Field[]>> {
	initFromObject ??= findModuleExport((e: any) => typeof e === 'function' && /InitFromObject\(/.test(String(e)) && /strDebugSource/.test(String(e)));
	const transport = (window as any).App?.m_cm?.m_ServiceTransport;
	if (!initFromObject || !transport) throw new Error('connexion de Steam indisponible');
	const msg = initFromObject(RawRequest, { bytes });
	const res = await transport.SendMsg(`AccountCart.${method}#1`, msg, RawResponse, { ...(readOnly ? { bConstMethod: true } : {}), ePrivilege: 1 });
	const e = res?.GetEResult?.();
	if (e !== 1) throw new Error(res?.GetErrorMessage?.() || `réponse ${e}`);
	return pbRead(res.Body().bytes);
}

// ---------- Panier ----------

export type CartLine = {
	/** Identifiant de la ligne (nombre sur 64 bits, gardé en texte). */
	id: string;
	packageid?: number;
	bundleid?: number;
	added?: number;
	gift: boolean;
	/** Compte de la personne qui recevra le cadeau. */
	giftee?: number;
	valid: boolean;
};

export type Cart = { lines: CartLine[]; subtotal?: number };

function parseCart(m?: Map<number, Field[]>): Cart {
	if (!m) return { lines: [] };
	const lines = (m.get(1) || []).map((f) => {
		const l = pbRead(f.v as Uint8Array);
		const flags = sub(l, 13);
		const gift = sub(l, 12);
		return {
			id: String(l.get(1)?.[0]?.v ?? ''),
			packageid: num(l, 3) || undefined,
			bundleid: num(l, 4) || undefined,
			added: num(l, 10),
			gift: !!(flags && num(flags, 1)),
			giftee: (gift && num(gift, 1)) || undefined,
			valid: num(l, 8) !== 0,
		};
	});
	const total = sub(m, 2);
	return { lines, subtotal: total ? num(total, 1) : undefined };
}

// État partagé : les boutons du Magasin et les pages Panier se mettent à jour ensemble
let current: { cart?: Cart; error?: string; loading: boolean; at: number } = { loading: false, at: 0 };
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<typeof current>) {
	current = { ...current, ...next };
	listeners.forEach((f) => f());
}

/** Relit le panier (au plus une fois par minute, sauf `force`). */
export function refreshCart(force = false): Promise<void> {
	if (pending) return pending;
	if (!force && current.cart && Date.now() - current.at < 60_000) return Promise.resolve();
	set({ loading: true });
	pending = send('GetCart', pbString(1, storeCountry()), true)
		.then((m) => set({ cart: parseCart(sub(m, 1)), error: undefined, loading: false, at: Date.now() }))
		.catch((e) => {
			console.error('[steam-upgraded] panier', e);
			set({ error: String(e?.message || e), loading: false });
		})
		.finally(() => (pending = null));
	return pending;
}

export function useCart() {
	const [, setTick] = useState(0);
	useEffect(() => {
		const f = () => setTick((n) => n + 1);
		listeners.add(f);
		refreshCart();
		return () => {
			listeners.delete(f);
		};
	}, []);
	return { cart: current.cart, error: current.error, loading: current.loading && !current.cart, refresh: () => refreshCart(true) };
}

export type CartTarget = { packageid?: number; bundleid?: number };

/** Ajoute le paquet (ou le lot) au panier, pour soi. Renvoie true si Steam a accepté. */
export async function addToCart(t: CartTarget): Promise<boolean> {
	if (!t.packageid && !t.bundleid) return false;
	const item = t.packageid ? pbInt(1, t.packageid) : pbInt(2, t.bundleid!);
	try {
		const m = await send('AddItemsToCart', [...pbString(1, storeCountry()), ...pbBytes(2, item)]);
		set({ cart: parseCart(sub(m, 2)), at: Date.now() });
		return true;
	} catch (e) {
		console.error('[steam-upgraded] ajout au panier', e);
		return false;
	}
}

/** Retire une ligne du panier. Renvoie true si Steam a accepté. */
export async function removeFromCart(lineId: string): Promise<boolean> {
	try {
		const m = await send('RemoveItemFromCart', [...pbInt(1, lineId), ...pbString(2, storeCountry())]);
		set({ cart: parseCart(sub(m, 1)), at: Date.now() });
		return true;
	} catch (e) {
		console.error('[steam-upgraded] retrait du panier', e);
		return false;
	}
}

/** Vide le panier, ligne par ligne. Renvoie true si tout a été retiré. */
export async function emptyCart(): Promise<boolean> {
	let ok = true;
	for (const l of current.cart?.lines || []) ok = (await removeFromCart(l.id)) && ok;
	return ok;
}

/** La ligne du panier qui correspond à ce paquet ou à ce lot, s'il y en a une. */
export function lineFor(cart: Cart | undefined, t: CartTarget): CartLine | undefined {
	return cart?.lines.find((l) => (t.packageid && l.packageid === t.packageid) || (t.bundleid && l.bundleid === t.bundleid));
}

/** Panier avec la description de chaque article (nom, image, prix actuel) et les totaux. */
export function useCartDetails() {
	const c = useCart();
	const lines = c.cart?.lines || [];
	const key = lines.map(cartKey).sort().join(',');
	const [items] = useAsync(() => (lines.length ? loadCartItems(lines) : Promise.resolve(new Map<string, CartItem>())), [key]);
	const rows = lines.map((line) => ({ line, item: items.data?.get(cartKey(line)) }));
	const known = rows.every((r) => r.item);
	const sum = (f: (i: CartItem) => number | undefined) => rows.reduce((n, r) => n + (r.item ? f(r.item) ?? 0 : 0), 0);
	// le sous-total de Steam fait foi ; le prix de base vient du magasin
	const total = c.cart?.subtotal ?? sum((i) => i.final);
	const base = known ? Math.max(total, sum((i) => i.original ?? i.final)) : undefined;
	return { ...c, rows, itemsLoading: items.loading, itemsError: items.error, total, base, savings: base != null ? base - total : 0 };
}

/** Page du panier sur le magasin de Valve, où se fait le paiement. */
export const CART_URL = 'https://store.steampowered.com/cart/';
