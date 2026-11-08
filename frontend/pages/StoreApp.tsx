// Page de vente d'un jeu : /steamupgraded/vente/:appid (depuis le Magasin, « Page du magasin » d'une fiche ou d'un menu).
// Bannière avec panneau d'achat, vidéos et captures (visionneuse), infos, contacts qui ont le jeu.
// Le paiement se fait toujours sur la page de Valve (« Acheter sur Steam ») ; le cœur ajoute ou retire le jeu
// de la liste de souhaits (service Wishlist du client Steam, voir setWishlisted).
import { useEffect, useMemo, useRef, useState } from 'react';
import { goBack, previousDesktopPath, usePath } from '../core/history';
import { useSettings } from '../core/settings';
import { avatarUrl, mainWindow, myAccountId, navigate, openSteamWeb, ROUTES } from '../core/steam';
import { usePageTransition } from '../core/transitions';
import { playDash } from '../bigpicture/dash';
import { capitalize, FRENCH, int, storeDiskLabel, loadStoreApp, loadWishlist, money, mySteamId, ownershipMap, pegiColor, playFeatures, promoEndWhen, reviewTone, setWishlisted, storeUrl, useAsync } from './store/data';
import type { StoreApp } from './store/data';
import { FallbackImg } from './Game';
import { FriendsCard } from './game/cards';
import { useFriendsWithGame } from './game/data';
import { NewsSection } from './game/NewsSection';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const HeartIcon = ({ on }: { on: boolean }) => (
	// var() ne marche pas dans un attribut SVG : couleurs en style
	<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', fill: on ? 'var(--sp-accent)' : 'none', stroke: on ? 'none' : 'currentColor' }}>
		<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z" />
	</svg>
);

const CartIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
		<circle cx="9.5" cy="19.5" r="1.3" />
		<circle cx="17" cy="19.5" r="1.3" />
	</svg>
);

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
	<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
		<path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
	</svg>
);

const VENTE_CSS = `
.spv-chip{height:30px;padding:0 13px;display:inline-flex;align-items:center;border-radius:15px;background:rgba(10,12,16,.55);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:13px;font-weight:700;white-space:nowrap;}
.spv-panel{position:relative;width:400px;max-width:100%;flex:none;display:flex;flex-direction:column;gap:14px;padding:22px;border-radius:var(--sp-r-lg);background:color-mix(in srgb,var(--sp-bg) 82%,transparent);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);}
.spv-panel .sp-btn{align-items:center;justify-content:center;}
.spv-buy{height:52px;font-size:17px;gap:10px;box-shadow:var(--sp-glow);}
.spv-media{display:flex;gap:14px;overflow-x:auto;scroll-behavior:smooth;scrollbar-width:none;padding:4px 2px 6px;margin:-4px -2px -6px;}
.spv-thumb{position:relative;width:248px;aspect-ratio:16/9;flex:none;padding:0;border-radius:var(--sp-r-md);border:1px solid var(--sp-line);background:var(--sp-surface2);overflow:hidden;cursor:pointer;}
.spv-thumb img{display:block;width:100%;height:100%;object-fit:cover;}
.spv-thumb:hover,.spv-thumb:focus-visible{border-color:var(--sp-accent);box-shadow:0 0 0 1px var(--sp-accent);}
.spv-play{position:absolute;inset:0;margin:auto;width:46px;height:46px;border-radius:50%;background:rgba(10,12,16,.6);border:2px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;corner-shape:round !important;}
.spv-round{width:34px;height:34px;padding:0;border-radius:50%;border:1px solid var(--sp-line);background:transparent;color:var(--sp-muted);display:flex;align-items:center;justify-content:center;corner-shape:round !important;}
.spv-round:hover:not(:disabled){color:var(--sp-text);border-color:var(--sp-accent);}
.spv-round:disabled{opacity:.35;cursor:default;}
.spv-feature{height:28px;padding:0 11px;display:inline-flex;align-items:center;border-radius:14px;background:var(--sp-surface2);font-size:13px;font-weight:700;}
.spv-viewer{position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px 96px;}
.spv-viewer img,.spv-viewer video{max-width:100%;max-height:calc(100% - 60px);border-radius:var(--sp-r-lg);background:#000;}
.spv-viewer .spv-round{position:absolute;top:50%;width:48px;height:48px;margin-top:-24px;background:rgba(10,12,16,.6);color:#fff;border-color:rgba(255,255,255,.25);}
`;

/** Bande-annonce lue dans la visionneuse (DASH, voir bigpicture/dash.ts) ; en cas d'échec, la page de Valve. */
function TrailerVideo({ src, poster, onFail }: { src: string; poster: string; onFail: () => void }) {
	const ref = useRef<HTMLVideoElement | null>(null);
	useEffect(() => {
		if (!ref.current) return undefined;
		return playDash(ref.current, src, onFail);
	}, [src]);
	return <video ref={ref} poster={poster} controls playsInline />;
}

function Card({ label, children }: { label: string; children: any }) {
	return (
		<div className="sp-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
			<span className="sp-label">{label}</span>
			{children}
		</div>
	);
}

/** Panneau d'achat : prix, bouton principal, liste de souhaits, copie dans la famille. */
function BuyPanel({ app, wished, busy, onWish }: { app: StoreApp; wished: boolean | null; busy: boolean; onWish: () => void }) {
	const own = useMemo(ownershipMap, []).get(app.appid);
	const family = own?.kind === 'family' ? own.member : null;
	const mine = own?.kind === 'me';
	const end = promoEndWhen(app.discountEnd);
	const sold = app.final != null || app.free;
	const web = () => openSteamWeb(storeUrl(app.appid));
	const primary = mine
		? { label: 'Dans votre bibliothèque', run: () => navigate(ROUTES.app(app.appid)) }
		: app.comingSoon
			? { label: 'Voir sur Steam', run: web }
			: { label: app.free ? 'Obtenir sur Steam' : 'Acheter sur Steam', run: web };
	const familyAvatar = family ? avatarUrl(family.accountId) : mine ? avatarUrl(myAccountId()) : undefined;
	// Espace disque de la configuration requise du magasin
	const disk = storeDiskLabel(app);

	return (
		<div className="spv-panel">
			<div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56 }}>
				{app.comingSoon ? (
					<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
						<span style={{ fontSize: 24, fontWeight: 800 }}>Bientôt disponible</span>
						{app.release && <span className="sp-muted">{app.release}</span>}
					</span>
				) : !sold ? (
					<span className="sp-muted" style={{ fontSize: 20, fontWeight: 800 }}>
						Prix indisponible
					</span>
				) : (
					<>
						{app.discount > 0 && (
							<span style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--sp-deal)', color: 'var(--sp-deal-ink)', fontSize: 22, fontWeight: 800 }}>−{app.discount}&#8239;%</span>
						)}
						<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
							{app.discount > 0 && app.original != null && <s className="sp-muted" style={{ fontSize: 14 }}>{money(app.original)}</s>}
							<span style={{ fontSize: 32, fontWeight: 800 }}>{app.free || app.final === 0 ? 'Gratuit' : money(app.final)}</span>
						</span>
						<span style={{ flex: 1 }} />
						{app.discount > 0 && end && (
							<span className="sp-muted" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 12, lineHeight: 1.35 }}>
								<span>Fin de la promo</span>
								<b style={{ color: 'var(--sp-text)', fontSize: 15 }}>{end}</b>
							</span>
						)}
					</>
				)}
			</div>
			<button type="button" className="sp-btn sp-btn--primary spv-buy" onClick={primary.run}>
				{!mine && <CartIcon />}
				{primary.label}
			</button>
			<div style={{ display: 'flex', gap: 8 }}>
				{!mine && (
					<button type="button" className="sp-btn" disabled={wished === null || busy} aria-pressed={!!wished} onClick={onWish} style={{ flex: 1, minWidth: 0, height: 42, gap: 8, fontSize: 13 }}>
						<HeartIcon on={!!wished} />
						{busy ? 'Un instant…' : wished ? 'Dans votre liste de souhaits' : 'Ajouter à la liste de souhaits'}
					</button>
				)}
				<button type="button" className="sp-btn sp-btn--icon" aria-label="Page Steam complète" title="Page Steam complète" onClick={web} style={{ flex: mine ? 1 : 'none', height: 42, width: mine ? 'auto' : 42, color: 'var(--sp-muted)', gap: 8, fontSize: 13 }}>
					<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
						<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
					</svg>
					{mine && 'Page Steam complète'}
				</button>
			</div>
			<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minWidth: 0 }}>
				{familyAvatar ? (
					<img src={familyAvatar} alt="" width={20} height={20} style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', boxShadow: `0 0 0 1.5px ${family?.color || 'var(--sp-accent)'}` }} />
				) : (
					<span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: family?.color || (mine ? 'var(--sp-accent)' : 'var(--sp-line)') }} />
				)}
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{family ? `Jouable via ${family.name}` : mine ? 'Déjà à vous' : 'Personne dans la famille ne l’a encore'}</span>
			</span>
			{disk && (
				<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
					<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...svg} style={{ flex: 'none', color: 'var(--sp-muted)' }}>
						<ellipse cx="12" cy="6" rx="8" ry="3" />
						<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
					</svg>
					<span>
						<b>{disk}</b> <span className="sp-muted">d’espace disque nécessaire</span>
					</span>
				</span>
			)}
			{!mine && <span className="sp-muted" style={{ fontSize: 12 }}>Le paiement se fait sur la page de Steam : rien n’est acheté depuis cette page.</span>}
		</div>
	);
}

type Media = { video: boolean; thumb: string; full: string; dash: string; name: string };

/** Visionneuse plein écran : flèches (boutons ou clavier) pour changer, Échap ou clic à côté pour fermer. */
function Viewer({ media, index, movies, shots, onIndex, onClose, onVideoFail }: { media: Media[]; index: number; movies: number; shots: number; onIndex: (i: number) => void; onClose: () => void; onVideoFail: () => void }) {
	const ref = useRef<HTMLDivElement>(null);
	const m = media[index];
	useEffect(() => {
		const doc = ref.current?.ownerDocument;
		ref.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
			else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
			else if (e.key === 'ArrowRight' && index < media.length - 1) onIndex(index + 1);
		};
		doc?.addEventListener('keydown', onKey);
		return () => doc?.removeEventListener('keydown', onKey);
	}, [index, media.length]);
	if (!m) return null;
	const body = mainWindow()?.document?.body;
	const content = (
		<div ref={ref} className="spv-viewer" role="dialog" aria-modal="true" aria-label="Vidéos et captures" tabIndex={-1} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			{m.video && m.dash ? <TrailerVideo key={m.dash} src={m.dash} poster={m.thumb} onFail={onVideoFail} /> : <img src={m.full} alt="" />}
			<span style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>
				{m.video ? `Vidéo ${index + 1} sur ${movies}${m.name ? ` · ${m.name}` : ''}` : `Capture ${index + 1 - movies} sur ${shots}`}
			</span>
			<button type="button" className="spv-round" aria-label="Précédente" disabled={index === 0} onClick={() => onIndex(index - 1)} style={{ left: 28 }}>
				<Chevron dir="left" />
			</button>
			<button type="button" className="spv-round" aria-label="Suivante" disabled={index >= media.length - 1} onClick={() => onIndex(index + 1)} style={{ right: 28 }}>
				<Chevron dir="right" />
			</button>
			<button type="button" className="spv-round" aria-label="Fermer" onClick={onClose} style={{ top: 28, right: 28, marginTop: 0 }}>
				<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</div>
	);
	// au-dessus de la barre du haut : dans le corps de la fenêtre
	return body ? (window as any).SP_REACTDOM.createPortal(content, body) : content;
}

export function StoreAppPage(props: any) {
	const pageRef = usePageTransition();
	const s = useSettings();
	const path = usePath();
	// la route change avant la fin de la transition de sortie : on garde le dernier jeu affiché
	const lastAppid = useRef(0);
	const fromRoute = Number(props?.match?.params?.appid || path.match(/\/steamupgraded\/vente\/(\d+)/)?.[1] || 0);
	if (fromRoute) lastAppid.current = fromRoute;
	const appid = lastAppid.current;
	const [res, retry] = useAsync((force) => loadStoreApp(appid, force), [appid]);
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const friends = useFriendsWithGame(appid);
	// état après un ajout ou un retrait fait ici (wished vaut null tant que la liste de souhaits n'est pas lue)
	const [override, setOverride] = useState<{ appid: number; on: boolean } | null>(null);
	const [busy, setBusy] = useState(false);
	const [viewer, setViewer] = useState<number | null>(null);
	const stripRef = useRef<HTMLDivElement>(null);
	const app = res.data;

	useEffect(() => setViewer(null), [appid]);

	const fromList = wl.data ? wl.data.items.some((d) => d.appid === appid) : null;
	const wished = override?.appid === appid ? override.on : fromList;
	const toggleWish = async () => {
		if (wished === null || busy) return;
		setBusy(true);
		const ok = await setWishlisted(appid, !wished);
		if (ok) setOverride({ appid, on: !wished });
		setBusy(false);
	};
	// Retour : vers la page d'où l'on vient si c'est le Magasin, sinon le Magasin
	const back = () => (previousDesktopPath().startsWith(ROUTES.store) ? goBack() : navigate(ROUTES.store));

	if (!app) {
		return (
			<div className="sp-root" ref={pageRef} style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
				<h1 className="sp-h1">Magasin</h1>
				<p className="sp-muted" style={{ margin: 0 }}>{res.loading ? 'Chargement de la page du jeu…' : `Page du jeu indisponible${res.error ? ` (${res.error})` : ''}.`}</p>
				{!res.loading && (
					<div style={{ display: 'flex', gap: 10 }}>
						<button type="button" className="sp-btn" onClick={retry}>Réessayer</button>
						<button type="button" className="sp-btn" onClick={() => openSteamWeb(storeUrl(appid))}>Ouvrir la page Steam</button>
					</div>
				)}
			</div>
		);
	}

	const oled = s.theme === 'oled';
	const media: Media[] = [
		...app.movies.map((m) => ({ video: true, thumb: m.thumb, full: m.thumb, dash: String((m as any).dash || ''), name: m.name || '' })),
		...app.screenshots.map((x) => ({ video: false, thumb: x.thumb, full: x.full, dash: '', name: '' })),
	];
	const features = playFeatures(app);
	const french = FRENCH[app.french] || FRENCH.non;
	const fade = oled
		? 'linear-gradient(to right, rgba(0,0,0,.78) 0%, rgba(0,0,0,.15) 60%, rgba(0,0,0,.45) 100%)'
		: 'linear-gradient(to bottom, transparent 45%, var(--sp-bg) 100%), linear-gradient(to right, rgba(0,0,0,.6) 0%, rgba(0,0,0,.1) 60%, rgba(0,0,0,.35) 100%)';
	const frame = oled ? { margin: '20px 24px 0', borderRadius: 'var(--sp-r-lg)', border: '1px solid var(--sp-line)' } : {};
	const openMedia = (i: number) => {
		// une vidéo sans manifeste lisible s'ouvre sur la page de Valve
		if (media[i]?.video && !media[i].dash) openSteamWeb(storeUrl(appid));
		else setViewer(i);
	};
	const scroll = (dir: number) => stripRef.current?.scrollBy({ left: dir * Math.max(300, stripRef.current.clientWidth * 0.8) });
	const counts = [app.movies.length ? (app.movies.length > 1 ? `${app.movies.length} vidéos` : '1 vidéo') : '', app.screenshots.length ? (app.screenshots.length > 1 ? `${app.screenshots.length} captures` : '1 capture') : ''].filter(Boolean).join(' · ');

	return (
		<div className="sp-root" ref={pageRef}>
			<style>{VENTE_CSS}</style>
			<section aria-label="Bannière" style={{ position: 'relative', minHeight: 420, overflow: 'hidden', background: 'var(--sp-surface2)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 32, padding: '64px 40px 32px', boxSizing: 'border-box', ...frame }}>
				<FallbackImg srcs={[app.hero, app.background, app.header].filter(Boolean) as string[]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: fade }} />
				<button type="button" onClick={back} style={{ position: 'absolute', top: 20, left: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: 0, background: 'transparent', color: 'rgba(255,255,255,.85)', fontWeight: 700, textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
					<Chevron dir="left" />
					Magasin
				</button>
				<div style={{ position: 'relative', flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
					<h1 style={{ margin: 0, fontSize: 'clamp(34px, 3.6vw, 52px)', fontWeight: 800, lineHeight: 1.02, color: '#fff', letterSpacing: '-0.01em', textShadow: '0 2px 20px rgba(0,0,0,.5)' }}>{app.name}</h1>
					{app.short && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,.88)', maxWidth: 680, textShadow: '0 1px 10px rgba(0,0,0,.5)' }}>{app.short}</p>}
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
						{app.tags.slice(0, 5).map((t) => (
							<span key={t} className="spv-chip">
								{t}
							</span>
						))}
						{app.reviewLabel ? (
							<span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fff' }}>
								<span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: reviewTone(app.reviewScore || 0) }} />
								<b style={{ color: reviewTone(app.reviewScore || 0) }}>{capitalize(app.reviewLabel)}</b>
								{app.reviewPct != null && (
									<span style={{ color: 'rgba(255,255,255,.75)' }}>
										{app.reviewPct}&#8239;% de {int(app.reviewCount || 0)} avis
									</span>
								)}
							</span>
						) : (
							<span style={{ marginLeft: 8, fontSize: 14, color: 'rgba(255,255,255,.75)' }}>Pas encore d’évaluations</span>
						)}
					</div>
				</div>
				<BuyPanel app={app} wished={wished} busy={busy} onWish={toggleWish} />
			</section>

			<div style={{ padding: '26px 40px 56px', display: 'flex', flexDirection: 'column', gap: 26 }}>
				{media.length > 0 && (
					<section aria-labelledby="spv-media" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<h2 id="spv-media" className="sp-h2">
								Vidéos et captures
							</h2>
							<span className="sp-muted">{counts}</span>
							<span style={{ flex: 1 }} />
							<button type="button" className="spv-round" aria-label="Précédentes" onClick={() => scroll(-1)}>
								<Chevron dir="left" />
							</button>
							<button type="button" className="spv-round" aria-label="Suivantes" onClick={() => scroll(1)}>
								<Chevron dir="right" />
							</button>
						</div>
						<div ref={stripRef} className="spv-media">
							{media.map((m, i) => (
								<button key={m.thumb + i} type="button" className="spv-thumb" aria-label={m.video ? `Vidéo ${i + 1}${m.name ? ` : ${m.name}` : ''}` : `Capture ${i + 1 - app.movies.length}`} onClick={() => openMedia(i)}>
									<img src={m.thumb} alt="" loading="lazy" />
									{m.video && (
										<span className="spv-play" aria-hidden="true">
											<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
												<path d="M8 5v14l11-7z" />
											</svg>
										</span>
									)}
								</button>
							))}
						</div>
					</section>
				)}

				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
					<div style={{ flex: '999 1 560px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
						<Card label="Sortie">
							<span style={{ fontSize: 22, fontWeight: 800 }}>{app.release || 'Date inconnue'}</span>
							<span className="sp-muted">{[app.developers[0], app.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
						</Card>
						<Card label="En français">
							<span style={{ fontSize: 22, fontWeight: 800 }}>{french[0]}</span>
							<span className="sp-muted">{french[1]}</span>
						</Card>
						<Card label="Jouer">
							{features.length ? (
								<span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
									{features.map((f) => (
										<span key={f} className="spv-feature">
											{f}
										</span>
									))}
								</span>
							) : (
								<span className="sp-muted">Non précisé par Steam</span>
							)}
						</Card>
						<Card label="Classement et presse">
							{app.pegi || app.metacritic ? (
								<span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
									{app.pegi && (
										<span style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, background: pegiColor(app.pegi), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{app.pegi}</span>
									)}
									<span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
										<span style={{ fontSize: 22, fontWeight: 800 }}>{app.metacritic ? `Metacritic ${app.metacritic}` : `PEGI ${app.pegi}`}</span>
										{app.pegi && (
											<span className="sp-muted">
												PEGI {app.pegi}
												{app.pegiDescriptors.length ? ` · ${app.pegiDescriptors.join(', ')}` : ''}
											</span>
										)}
									</span>
								</span>
							) : (
								<span className="sp-muted">Aucun classement fourni</span>
							)}
						</Card>
					</div>
					<aside style={{ flex: '1 1 300px', maxWidth: 400, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
						<FriendsCard friends={friends} title="Contacts qui l’ont" />
						{(app.achievements || 0) > 0 && (
							<section className="sp-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
								<h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Succès</h2>
								<span className="sp-muted">{app.achievements} succès Steam</span>
							</section>
						)}
					</aside>
				</div>
				{/* Historique des mises à jour et actualités du jeu (comme sur la fiche) */}
				<NewsSection appid={appid} />
			</div>

			{viewer !== null && (
				<Viewer media={media} index={viewer} movies={app.movies.length} shots={app.screenshots.length} onIndex={setViewer} onClose={() => setViewer(null)} onVideoFail={() => openSteamWeb(storeUrl(appid))} />
			)}
		</div>
	);
}
