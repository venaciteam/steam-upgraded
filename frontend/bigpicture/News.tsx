// Big Picture : mises à jour d'un jeu sous sa fiche et sous sa page de vente. Liste à gauche, aperçu de la note focalisée
// à droite ; A la lit en plein écran (haut et bas font défiler, B ou A referment), Y bascule vers toutes les
// actualités, X ouvre la note sur Steam. Données partagées avec le bureau (pages/game/news.ts).
import { useEffect, useRef, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { BB_CSS, BBCode } from '../core/bbcode';
import { newsAgo, newsDate, newsKind, NewsFilter, useAppNews } from '../pages/game/news';
import { openSteamWebBp } from './StoreBar';
import { Glyph, GLYPH } from './Glyph';

const w = window as any;
const A = 1;
const B = 2;
const UP = 9;
const DOWN = 10;
const LB = 5;
const RB = 6;

/** Lecteur plein écran : la manette est interceptée tant qu'il est ouvert (le focus reste sur la liste). */
function Reader({ title, when, english, body, onClose }: { title: string; when: string; english: boolean; body: string; onClose: () => void }) {
	const scroll = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const handle = w.FocusNavController?.SetCatchAllGamepadInput?.((button: number, down: boolean) => {
			if (button === LB || button === RB) return false;
			if (!down) return true;
			const el = scroll.current;
			if (button === UP || button === DOWN) el?.scrollBy({ top: (button === UP ? -1 : 1) * Math.round((el.clientHeight || 600) * 0.45), behavior: 'smooth' });
			else if (button === A || button === B) onClose();
			return true;
		});
		return () => handle?.Unregister?.();
	}, []);
	return (
		<div className="spbp-news-reader" role="dialog" aria-label={title}>
			<div ref={scroll} className="spbp-news-reader-scroll">
				<div className="spbp-news-reader-in">
					<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 18, marginBottom: 28 }}>
						<h2 style={{ margin: 0, fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{title}</h2>
						<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>
							{when}
							{english ? ' · publiée en anglais par l’éditeur' : ''}
						</span>
					</div>
					<BBCode text={body} />
				</div>
			</div>
			<div className="spbp-news-reader-hint">
				Haut et bas pour faire défiler
				<span style={{ width: 24 }} />
				<span style={{ height: 32, display: 'inline-flex' }}>
					<Glyph button={GLYPH.B} size={32} fallback="B" />
				</span>
				Fermer
			</div>
		</div>
	);
}

export function BpNews({ appid }: { appid: number }) {
	const [filter, setFilter] = useState<NewsFilter>('updates');
	const news = useAppNews(appid, filter);
	const [cur, setCur] = useState(0);
	const [shown, setShown] = useState(6);
	const [reading, setReading] = useState<number | null>(null);
	useEffect(() => {
		setCur(0);
		setShown(6);
	}, [appid, filter]);

	const items = news.items.slice(0, shown);
	const focused = items[Math.min(cur, items.length - 1)];
	const other = filter === 'updates' ? 'all' : 'updates';
	const toggleLabel = filter === 'updates' ? 'Toutes les actualités' : 'Mises à jour seulement';
	const more = () => {
		if (news.items.length < shown + 10) news.loadMore();
		setShown((n) => n + 10);
	};
	const reader = reading !== null ? items[reading] : null;

	return (
		<section aria-labelledby="spbp-news" style={{ padding: '44px 72px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
			<style>{BB_CSS}</style>
			<div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
				<h2 id="spbp-news" style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>{filter === 'updates' ? 'Mises à jour' : 'Actualités'}</h2>
				<span style={{ fontSize: 19, color: 'var(--sp-muted)' }}>
					Publiées par l’éditeur sur Steam{news.items[0] ? ` · la plus récente ${newsAgo(news.items[0].time)}` : ''}
				</span>
				<span style={{ flex: 1 }} />
				<span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, color: 'var(--sp-muted)' }}>
					<span style={{ height: 30, display: 'inline-flex' }}>
						<Glyph button={GLYPH.Y} size={30} fallback="Y" />
					</span>
					{toggleLabel}
				</span>
			</div>

			{!items.length ? (
				<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '26px 30px', borderRadius: 28, background: 'var(--sp-surface)', border: '1px solid var(--sp-line)' }}>
					<span style={{ flex: 1, fontSize: 21, color: 'var(--sp-muted)' }}>
						{news.loading
							? 'Chargement des notes…'
							: news.error
								? `Impossible de lire les actualités du jeu (${news.error}).`
								: filter === 'updates'
									? 'Aucune note de mise à jour publiée sur Steam pour ce jeu.'
									: 'Aucune actualité publiée sur Steam pour ce jeu.'}
					</span>
					{!news.loading && (news.error || filter === 'updates') && (
						<DialogButton className="spbp-btn" noFocusRing onClick={() => (news.error ? news.retry() : setFilter('all'))} onOKActionDescription={news.error ? 'Réessayer' : 'Toutes les actualités'}>
							{news.error ? 'Réessayer' : 'Toutes les actualités'}
						</DialogButton>
					)}
				</Focusable>
			) : (
				<Focusable flow-children="row" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
					<Focusable flow-children="column" style={{ width: 620, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
						{items.map((it, i) => (
							<DialogButton
								key={it.gid}
								className="spbp-news-item"
								noFocusRing
								onGamepadFocus={() => setCur(i)}
								onClick={() => setReading(i)}
								onOKActionDescription={reading !== null ? 'Fermer' : 'Lire la note'}
								onOptionsButton={() => setFilter(other)}
								onOptionsActionDescription={toggleLabel}
								onSecondaryButton={() => openSteamWebBp(it.url)}
								onSecondaryActionDescription="Voir sur Steam"
							>
								<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
									<span className={`spbp-news-badge spbp-news-badge--${it.type}`}>{newsKind(it.type)}</span>
									<span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>
										{newsDate(it.time)} · {newsAgo(it.time)}
									</span>
								</span>
								<span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{it.title}</span>
							</DialogButton>
						))}
						{(news.more || news.items.length > shown) && (
							<DialogButton className="spbp-btn" noFocusRing disabled={news.loading} onClick={more} onOKActionDescription="Charger plus" onOptionsButton={() => setFilter(other)} onOptionsActionDescription={toggleLabel}>
								{news.loading ? 'Chargement…' : filter === 'updates' ? 'Charger plus de mises à jour' : 'Charger plus d’actualités'}
							</DialogButton>
						)}
					</Focusable>
					{focused && (
						<article className="spbp-news-preview" aria-label={`Aperçu : ${focused.title}`}>
							<div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
								<span style={{ fontSize: 30, fontWeight: 800 }}>{focused.title}</span>
								{focused.lang !== 2 && <span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>Publiée en anglais par l’éditeur</span>}
							</div>
							<BBCode text={focused.body} />
						</article>
					)}
				</Focusable>
			)}

			{reader && <Reader title={reader.title} when={`${newsDate(reader.time)} · ${newsAgo(reader.time)}`} english={reader.lang !== 2} body={reader.body} onClose={() => setReading(null)} />}
		</section>
	);
}
