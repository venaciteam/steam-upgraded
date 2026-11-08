// Notes de mise à jour et actualités de Steam : leur texte est en BBCode ([p], [h2], [list][*], [b], [url=…], [img]…).
// Converties ici en vrais éléments React (jamais de HTML injecté). Un tag inconnu reste du texte : des éditeurs
// écrivent « [GAMEPLAY] » ou « [CRÉATION] » comme intertitres.
import type { ReactNode } from 'react';
import { openSteamWeb } from './steam';

const w = window as any;

type Node = { tag: string; arg: string; attrs: Record<string, string>; children: (Node | string)[] };

/** Tags reconnus ; `void` : sans contenu ni fermeture. */
const KNOWN = new Set(['b', 'i', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'list', 'olist', 'ul', 'ol', 'li', '*', 'url', 'img', 'hr', 'br', 'quote', 'code', 'noparse', 'spoiler', 'table', 'tr', 'th', 'td', 'previewyoutube', 'video', 'expand', 'center', 'em', 'strong']);
const VOID = new Set(['hr', 'br']);
const TOKEN = /\[(\/?)([a-zA-Z0-9*]+)(?:=("[^"]*"|[^\]\s]*))?((?:\s+[a-zA-Z_]+=(?:"[^"]*"|[^\s\]]*))*)\s*\]/g;

const unquote = (s = '') => s.replace(/^"(.*)"$/, '$1');

function parseAttrs(s: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of s.matchAll(/([a-zA-Z_]+)=("[^"]*"|[^\s\]]*)/g)) out[m[1].toLowerCase()] = unquote(m[2]);
	return out;
}

function parse(src: string): Node {
	const root: Node = { tag: '', arg: '', attrs: {}, children: [] };
	const stack: Node[] = [root];
	const top = () => stack[stack.length - 1];
	let last = 0;
	const text = (t: string) => t && top().children.push(t);
	for (const m of src.matchAll(TOKEN)) {
		const [raw, close, name] = m;
		const tag = name.toLowerCase();
		const at = m.index || 0;
		// Contenu brut : [noparse] et [code] ne sont pas interprétés
		const raw0 = top().tag;
		if ((raw0 === 'noparse' || raw0 === 'code') && !(close && tag === raw0)) continue;
		if (!KNOWN.has(tag)) continue;
		text(src.slice(last, at));
		last = at + raw.length;
		if (close) {
			const i = stack.map((n) => n.tag).lastIndexOf(tag === 'li' ? '*' : tag);
			if (i > 0) stack.length = i;
			else text(raw);
			continue;
		}
		// Un nouvel élément de liste ferme le précédent
		if (tag === '*' || tag === 'li') {
			const i = stack.map((n) => n.tag).lastIndexOf('*');
			const list = Math.max(stack.map((n) => n.tag).lastIndexOf('list'), stack.map((n) => n.tag).lastIndexOf('olist'), stack.map((n) => n.tag).lastIndexOf('ul'), stack.map((n) => n.tag).lastIndexOf('ol'));
			if (i > list && i > 0) stack.length = i;
		}
		const node: Node = { tag: tag === 'li' ? '*' : tag, arg: unquote(m[3]), attrs: parseAttrs(m[4] || ''), children: [] };
		top().children.push(node);
		if (!VOID.has(tag)) stack.push(node);
	}
	text(src.slice(last));
	return root;
}

/** Adresse d'image de Steam : `{STEAM_CLAN_IMAGE}` remplacé ; seules les adresses https sont gardées. */
function imageUrl(u: string): string {
	const s = u.trim().replace('{STEAM_CLAN_IMAGE}', 'https://clan.akamai.steamstatic.com/images');
	return /^https:\/\//i.test(s) ? s : '';
}

function linkUrl(u: string): string {
	const s = u.trim().replace(/^\/\//, 'https://');
	return /^(https?:|steam:)/i.test(s) ? s : '';
}

/** Lien : pages de Steam dans Steam, le reste dans le navigateur du système. */
export function openLink(url: string) {
	if (/^steam:/i.test(url)) return w.SteamClient?.URL?.ExecuteSteamURL?.(url);
	if (/^https?:\/\/([a-z0-9-]+\.)*(steampowered|steamcommunity)\.com\//i.test(url)) return openSteamWeb(url);
	w.SteamClient?.System?.OpenInSystemBrowser?.(url);
}

function plain(n: Node | string): string {
	return typeof n === 'string' ? n : n.children.map(plain).join('');
}

/** Paragraphes du texte brut : les anciens textes passent à la ligne par des retours, sans [p]. */
function textNodes(t: string, key: string): ReactNode[] {
	const parts = t.split('\n');
	const out: ReactNode[] = [];
	parts.forEach((p, i) => {
		if (i > 0) out.push(<br key={`${key}-br${i}`} />);
		if (p) out.push(p);
	});
	return out;
}

function render(n: Node | string, key: string): ReactNode {
	if (typeof n === 'string') {
		// Retours entre deux blocs ([p], [list]…) : ignorés ; dans le texte : passages à la ligne
		if (!n.trim()) return n.includes('\n') ? null : n;
		return textNodes(n.replace(/^\n+|\n+$/g, ''), key);
	}
	const kids = (_list = false) => n.children.map((c, i) => render(c, `${key}.${i}`));
	switch (n.tag) {
		case 'b':
		case 'strong':
			return <strong key={key}>{kids()}</strong>;
		case 'i':
		case 'em':
			return <em key={key}>{kids()}</em>;
		case 'u':
			return <u key={key}>{kids()}</u>;
		case 's':
		case 'strike':
			return <s key={key}>{kids()}</s>;
		case 'h1':
		case 'h2':
			return <h4 key={key} className="bb-h">{kids()}</h4>;
		case 'h3':
		case 'h4':
		case 'h5':
			return <h5 key={key} className="bb-h bb-h--small">{kids()}</h5>;
		case 'p':
			return <p key={key} className="bb-p">{kids()}</p>;
		case 'center':
			return <div key={key} className="bb-center">{kids()}</div>;
		case 'list':
		case 'ul':
			return <ul key={key} className="bb-list">{kids(true)}</ul>;
		case 'olist':
		case 'ol':
			return <ol key={key} className="bb-list">{kids(true)}</ol>;
		case '*':
			return <li key={key}>{kids()}</li>;
		case 'hr':
			return <hr key={key} className="bb-hr" />;
		case 'br':
			return <br key={key} />;
		case 'quote':
			return <blockquote key={key} className="bb-quote">{kids()}</blockquote>;
		case 'code':
		case 'noparse':
			return n.tag === 'code' ? <pre key={key} className="bb-code">{plain(n)}</pre> : <span key={key}>{plain(n)}</span>;
		case 'spoiler':
			return <span key={key} className="bb-spoiler">{kids()}</span>;
		case 'expand':
			return <div key={key}>{kids()}</div>;
		case 'table':
			return (
				<div key={key} className="bb-table-wrap">
					<table className="bb-table">
						<tbody>{n.children.filter((c) => typeof c !== 'string').map((c, i) => render(c, `${key}.${i}`))}</tbody>
					</table>
				</div>
			);
		case 'tr':
			return <tr key={key}>{n.children.filter((c) => typeof c !== 'string').map((c, i) => render(c, `${key}.${i}`))}</tr>;
		case 'th':
			return <th key={key}>{kids()}</th>;
		case 'td':
			return <td key={key}>{kids()}</td>;
		case 'url': {
			const href = linkUrl(n.arg || n.attrs.url || plain(n));
			if (!href) return <span key={key}>{kids()}</span>;
			return (
				<a
					key={key}
					href={href}
					className="bb-link"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						openLink(href);
					}}
				>
					{n.children.length ? kids() : href}
				</a>
			);
		}
		case 'img': {
			const src = imageUrl(n.attrs.src || n.arg || plain(n));
			return src ? <img key={key} className="bb-img" src={src} alt="" loading="lazy" decoding="async" onError={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')} /> : null;
		}
		case 'previewyoutube': {
			const id = (n.arg || '').split(';')[0];
			if (!/^[\w-]{6,20}$/.test(id)) return null;
			const href = `https://www.youtube.com/watch?v=${id}`;
			return (
				<a key={key} href={href} className="bb-link bb-video" onClick={(e) => (e.preventDefault(), e.stopPropagation(), openLink(href))}>
					Vidéo YouTube
				</a>
			);
		}
		case 'video':
			return null;
		default:
			return <span key={key}>{kids()}</span>;
	}
}

/** Texte d'une note de Steam mis en forme. */
export function BBCode({ text, className }: { text: string; className?: string }) {
	const tree = parse(text || '');
	return <div className={`bb${className ? ` ${className}` : ''}`}>{tree.children.map((c, i) => render(c, String(i)))}</div>;
}

/** Début du texte, sans mise en forme (aperçu sur deux lignes). */
export function bbPlain(text: string, max = 260): string {
	const tree = parse(text || '');
	const walk = (n: Node | string): string => {
		if (typeof n === 'string') return n;
		if (n.tag === 'img' || n.tag === 'previewyoutube' || n.tag === 'video') return ' ';
		const inner = n.children.map(walk).join('');
		return /^(p|h\d|\*|list|olist|br|hr|tr)$/.test(n.tag) ? ` ${inner} ` : inner;
	};
	const s = walk(tree).replace(/\s+/g, ' ').trim();
	return s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, '')}…` : s;
}

/** Feuille des notes (tailles en em : le bureau et Big Picture règlent la taille de base). */
export const BB_CSS = `
.bb{line-height:1.6;overflow-wrap:anywhere;}
.bb > :first-child{margin-top:0;}
.bb .bb-p{margin:0 0 .7em;}
.bb .bb-h{margin:1.1em 0 .45em;font-size:1.12em;font-weight:800;line-height:1.3;}
.bb .bb-h--small{font-size:1em;}
.bb .bb-list{margin:0 0 .8em;padding-left:1.4em;display:flex;flex-direction:column;gap:.3em;}
.bb .bb-list .bb-p{margin:0;}
.bb .bb-list .bb-list{margin:.3em 0 0;}
.bb .bb-img{display:block;max-width:min(100%,720px);height:auto;margin:.6em 0 1em;border-radius:var(--sp-r-md);}
.bb .bb-link{color:var(--sp-accent);font-weight:700;text-decoration:none;cursor:pointer;}
.bb .bb-link:hover{text-decoration:underline;}
.bb .bb-hr{border:0;height:1px;background:var(--sp-line);margin:1em 0;}
.bb .bb-quote{margin:0 0 .8em;padding:.6em 1em;border-radius:var(--sp-r-sm);background:var(--sp-surface2);color:var(--sp-muted);}
.bb .bb-code{margin:0 0 .8em;padding:.7em 1em;border-radius:var(--sp-r-sm);background:var(--sp-surface2);font-size:.9em;white-space:pre-wrap;}
.bb .bb-spoiler{background:var(--sp-surface2);color:transparent;border-radius:4px;transition:color .15s;}
.bb .bb-spoiler:hover{color:inherit;}
.bb .bb-center{text-align:center;}
.bb .bb-table-wrap{overflow-x:auto;margin:0 0 .8em;}
.bb .bb-table{border-collapse:collapse;font-size:.92em;}
.bb .bb-table :is(th,td){border:1px solid var(--sp-line);padding:.35em .7em;text-align:left;vertical-align:top;}
`;
