// Section « Mises à jour » au bas de la fiche d'un jeu et de sa page de vente (bureau) : historique des notes de mise à
// jour publiées sur Steam, ou toutes les actualités du jeu. La plus récente est dépliée ; chaque note se lit sur place.
import { useEffect, useState } from 'react';
import { BB_CSS, BBCode, bbPlain, openLink } from '../../core/bbcode';
import { newsAgo, newsDate, newsKind, newsPageUrl, NewsFilter, NewsItem, useAppNews } from './news';

const CSS = `
.spn{display:flex;flex-direction:column;gap:14px;}
.spn-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px;}
.spn-seg{display:flex;gap:4px;padding:4px;border-radius:20px;border:1px solid var(--sp-line);background:var(--sp-surface);}
.spn-seg button{height:32px;padding:0 14px;border:0;border-radius:16px;background:transparent;color:var(--sp-muted);font-weight:600;align-items:center;}
.spn-seg button[aria-pressed="true"]{background:var(--sp-surface2);color:var(--sp-text);font-weight:800;}
.spn-item{border-radius:var(--sp-r-lg);background:var(--sp-surface);border:1px solid var(--sp-line);transition:border-color .2s ease;}
.spn-item.is-open,.spn-item:has(.spn-row:hover),.spn-item:has(.spn-hit:focus-visible){border-color:var(--sp-accent);}
/* Toute la ligne de la note est cliquable : le bouton du titre la recouvre (::after) */
.spn-row{position:relative;display:flex;align-items:flex-start;gap:20px;padding:18px 22px;cursor:pointer;}
.spn-hit{all:unset;cursor:pointer;}
.spn-hit::after{content:"";position:absolute;inset:0;border-radius:var(--sp-r-lg);}
.spn-chev{flex:none;width:34px;height:34px;border-radius:var(--sp-r-sm);border:1px solid var(--sp-line);display:flex;align-items:center;justify-content:center;color:var(--sp-muted);transition:color .2s,border-color .2s;}
.spn-row:hover .spn-chev{color:var(--sp-accent);border-color:var(--sp-accent);}
.spn-chev svg{transition:transform .34s cubic-bezier(.2,.8,.2,1);}
.spn-item.is-open .spn-chev svg{transform:rotate(180deg);}
/* Déploiement et rangement progressifs : rangée de grille de 0fr à 1fr, avec un fondu */
.spn-collapse{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .38s cubic-bezier(.2,.8,.2,1),opacity .26s ease;}
.spn-item.is-open .spn-collapse{grid-template-rows:1fr;opacity:1;}
.spn-collapse > div{min-height:0;overflow:hidden;}
.spn-ex{display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows .3s cubic-bezier(.2,.8,.2,1),opacity .2s ease;}
.spn-item.is-open .spn-ex{grid-template-rows:0fr;opacity:0;}
.spn-ex > p{min-height:0;}
.spn-en{font-size:12px;color:var(--sp-muted);opacity:0;transition:opacity .25s ease;}
.spn-item.is-open .spn-en{opacity:1;}
@media (prefers-reduced-motion:reduce){.spn-collapse,.spn-ex,.spn-chev svg,.spn-en{transition:none;}}
.spn-date{width:96px;flex:none;display:flex;flex-direction:column;gap:2px;padding-top:2px;}
.spn-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.spn-titleline{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.spn-title{margin:0;font-size:17px;font-weight:800;}
.spn-badge{padding:3px 9px;border-radius:10px;font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;background:var(--sp-surface2);color:var(--sp-muted);border:1px solid transparent;}
.spn-badge--13{background:transparent;color:var(--sp-accent);border-color:var(--sp-accent);}
.spn-badge--14{background:var(--sp-accent);color:var(--sp-accent-ink);border-color:var(--sp-accent);}
.spn-excerpt{margin:0;color:var(--sp-muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.spn-body{position:relative;padding:0 22px 22px 138px;max-width:980px;font-size:14.5px;}
.spn-foot{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:6px;font-size:13px;}
@media (max-width:900px){.spn-body{padding-left:22px;}.spn-date{width:70px;}}
${BB_CSS}`;

const Chevron = ({ up }: { up?: boolean }) => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
		<path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
	</svg>
);

const IconExternal = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
	</svg>
);

function NewsRow({ it, open, onToggle }: { it: NewsItem; open: boolean; onToggle: () => void }) {
	const id = `spn-${it.gid}`;
	// La note n'est construite qu'à la première ouverture, puis gardée (le rangement s'anime)
	const [mounted, setMounted] = useState(open);
	useEffect(() => {
		if (open) setMounted(true);
	}, [open]);
	return (
		<article className={open ? 'spn-item is-open' : 'spn-item'}>
			<div className="spn-row" onClick={onToggle}>
				<div className="spn-date">
					<span style={{ fontWeight: 800 }}>{newsDate(it.time)}</span>
					<span className="sp-muted" style={{ fontSize: 12 }}>{newsAgo(it.time)}</span>
				</div>
				<div className="spn-main">
					<div className="spn-titleline">
						<span className={`spn-badge spn-badge--${it.type}`}>{newsKind(it.type)}</span>
						<h3 className="spn-title">
							<button
								type="button"
								className="spn-hit"
								aria-expanded={open}
								aria-controls={`${id}-b`}
								onClick={(e) => {
									e.stopPropagation();
									onToggle();
								}}
							>
								{it.title}
							</button>
						</h3>
						{it.lang !== 2 && <span className="spn-en">Publiée en anglais par l’éditeur</span>}
					</div>
					<div className="spn-ex" aria-hidden={open}>
						<p className="spn-excerpt">{bbPlain(it.body)}</p>
					</div>
				</div>
				<span className="spn-chev" aria-hidden="true">
					<Chevron />
				</span>
			</div>
			{/* Repliée : hors de la navigation au clavier (inert), le temps que l'animation range la note */}
			<div className="spn-collapse" id={`${id}-b`} {...((open ? {} : { inert: '' }) as any)}>
				<div>
					{mounted && (
						<div className="spn-body">
							<BBCode text={it.body} />
							<div className="spn-foot">
								<a
									href={it.url}
									className="bb-link"
									style={{ color: 'var(--sp-accent)', fontWeight: 700 }}
									onClick={(e) => {
										e.preventDefault();
										openLink(it.url);
									}}
								>
									Voir sur Steam
								</a>
							</div>
						</div>
					)}
				</div>
			</div>
		</article>
	);
}

/** Section complète ; `appid` d'un jeu du magasin (pas un raccourci non Steam). */
export function NewsSection({ appid }: { appid: number }) {
	const [filter, setFilter] = useState<NewsFilter>('updates');
	const news = useAppNews(appid, filter);
	const [open, setOpen] = useState<Set<string>>(new Set());
	// Six notes d'abord, dix de plus à chaque « Charger plus » (lues sur Steam seulement quand il en manque)
	const [shown, setShown] = useState(6);
	useEffect(() => setShown(6), [appid, filter]);
	const more = () => {
		if (news.items.length < shown + 10) news.loadMore();
		setShown((n) => n + 10);
	};
	// La plus récente est dépliée à l'arrivée (et à chaque changement de filtre)
	const first = news.items[0]?.gid;
	useEffect(() => setOpen(first ? new Set([first]) : new Set()), [appid, filter, first]);
	const toggle = (gid: string) =>
		setOpen((s) => {
			const n = new Set(s);
			if (n.has(gid)) n.delete(gid);
			else n.add(gid);
			return n;
		});

	const latest = news.items[0];
	return (
		<section className="spn" aria-labelledby="spn-title">
			<style>{CSS}</style>
			<div className="spn-head">
				<div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 2 }}>
					<h2 id="spn-title" className="sp-h2" style={{ margin: 0, fontSize: 20 }}>
						{filter === 'updates' ? 'Mises à jour' : 'Actualités'}
					</h2>
					<span className="sp-muted">
						Publiées par l’éditeur sur Steam{latest ? ` · la plus récente ${newsAgo(latest.time)}` : ''}
					</span>
				</div>
				<div className="spn-seg" role="group" aria-label="Afficher">
					<button type="button" aria-pressed={filter === 'updates'} onClick={() => setFilter('updates')}>
						Mises à jour
					</button>
					<button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
						Toutes les actualités
					</button>
				</div>
				<button type="button" className="sp-btn sp-btn--icon" aria-label="Actualités du jeu sur Steam" title="Actualités du jeu sur Steam" onClick={() => openLink(newsPageUrl(appid))} style={{ alignItems: 'center', color: 'var(--sp-muted)' }}>
					<IconExternal />
				</button>
			</div>

			{news.error && !news.items.length ? (
				<div className="sp-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
					<span className="sp-muted" style={{ flex: 1 }}>Impossible de lire les actualités du jeu ({news.error}).</span>
					<button type="button" className="sp-btn" onClick={news.retry} style={{ alignItems: 'center' }}>Réessayer</button>
				</div>
			) : news.loading && !news.items.length ? (
				<div className="sp-card" style={{ padding: '18px 22px' }}>
					<span className="sp-muted">Chargement des notes…</span>
				</div>
			) : !news.items.length ? (
				<div className="sp-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
					<span className="sp-muted" style={{ flex: 1 }}>
						{filter === 'updates' ? 'Aucune note de mise à jour publiée sur Steam pour ce jeu.' : 'Aucune actualité publiée sur Steam pour ce jeu.'}
					</span>
					{filter === 'updates' && (
						<button type="button" className="sp-btn" onClick={() => setFilter('all')} style={{ alignItems: 'center' }}>Toutes les actualités</button>
					)}
				</div>
			) : (
				news.items.slice(0, shown).map((it) => <NewsRow key={it.gid} it={it} open={open.has(it.gid)} onToggle={() => toggle(it.gid)} />)
			)}

			{news.items.length > 0 && (news.more || news.items.length > shown) && (
				<div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
					<button type="button" className="sp-btn" disabled={news.loading} onClick={more} style={{ alignItems: 'center' }}>
						{news.loading ? 'Chargement…' : filter === 'updates' ? 'Charger plus de mises à jour' : 'Charger plus d’actualités'}
					</button>
				</div>
			)}
		</section>
	);
}
