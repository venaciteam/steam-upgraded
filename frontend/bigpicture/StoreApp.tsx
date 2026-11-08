// Big Picture › Page de vente d'un jeu : bannière plein écran, panneau d'achat, vidéos et captures, infos.
// Le paiement se fait toujours sur la page de Valve (A « Acheter sur Steam ») ; Y ajoute ou retire le jeu
// de la liste de souhaits (service Wishlist du client Steam, voir setWishlisted).
import { useEffect, useMemo, useRef, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { usePath } from '../core/history';
import { useSettings } from '../core/settings';
import { myAccountId } from '../core/steam';
import { capitalize, FRENCH, money, int, storeDiskLabel, loadStoreApp, loadWishlist, mySteamId, ownershipMap, pegiColor, playFeatures, promoEndWhen, reviewTone, setWishlisted, storeUrl, useAsync } from '../pages/store/data';
import type { StoreApp } from '../pages/store/data';
import { FallbackImg } from '../pages/Game';
import { BpFrame, goBackBp, MemberAvatar } from './Frame';
import { openGame } from './gameActions';
import { openSteamWebBp } from './StoreBar';
import { playDash } from './dash';
import { BpNews } from './News';

const HeartIcon = ({ on }: { on: boolean }) => (
	// var() ne marche pas dans un attribut SVG : couleurs en style
	<svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', fill: on ? 'var(--sp-accent)' : 'none', stroke: on ? 'none' : 'currentColor' }}>
		<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z" />
	</svg>
);

const CartIcon = () => (
	<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
		<circle cx="9.5" cy="19.5" r="1.3" />
		<circle cx="17" cy="19.5" r="1.3" />
	</svg>
);

/** Bande-annonce lue dans la visionneuse (DASH, voir dash.ts) ; en cas d'échec, la page de Valve. */
function TrailerVideo({ src, poster, onFail }: { src: string; poster: string; onFail: () => void }) {
	const ref = useRef<HTMLVideoElement | null>(null);
	useEffect(() => {
		if (!ref.current) return undefined;
		return playDash(ref.current, src, onFail);
	}, [src]);
	return <video ref={ref} poster={poster} playsInline style={{ maxWidth: '100%', maxHeight: 'calc(100% - 60px)', borderRadius: 24, background: '#000' }} />;
}

const PlayIcon = () => (
	<span className="spbp-media-play" aria-hidden="true">
		<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
			<path d="M8 5v14l11-7z" />
		</svg>
	</span>
);

function Card({ label, children }: { label: string; children: any }) {
	return (
		<div className="spbp-card" style={{ gap: 8, padding: '24px 26px', borderRadius: 26 }}>
			<span className="spbp-label" style={{ fontSize: 15 }}>
				{label}
			</span>
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
	const primary = mine
		? { label: 'Dans votre bibliothèque', hint: 'Fiche du jeu', run: () => openGame(app.appid) }
		: app.comingSoon
			? { label: 'Voir sur Steam', hint: 'Ouvrir', run: () => openSteamWebBp(storeUrl(app.appid)) }
			: { label: app.free ? 'Obtenir sur Steam' : 'Acheter sur Steam', hint: 'Acheter sur Steam', run: () => openSteamWebBp(storeUrl(app.appid)) };

	return (
		<div className="spbp-buy">
			<div style={{ display: 'flex', alignItems: 'center', gap: 18, minHeight: 74 }}>
				{app.comingSoon ? (
					<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
						<span style={{ fontSize: 36, fontWeight: 800 }}>Bientôt disponible</span>
						{app.release && <span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>{app.release}</span>}
					</span>
				) : !sold ? (
					<span style={{ fontSize: 28, fontWeight: 800, color: 'var(--sp-muted)' }}>Prix indisponible</span>
				) : (
					<>
						{app.discount > 0 && (
							<span style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--sp-deal)', color: 'var(--sp-deal-ink)', fontSize: 30, fontWeight: 800 }}>−{app.discount}&#8239;%</span>
						)}
						<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
							{app.discount > 0 && app.original != null && <s style={{ fontSize: 20, color: 'var(--sp-muted)' }}>{money(app.original)}</s>}
							<span style={{ fontSize: 44, fontWeight: 800 }}>{app.free || app.final === 0 ? 'Gratuit' : money(app.final)}</span>
						</span>
						<span style={{ flex: 1 }} />
						{app.discount > 0 && end && (
							<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 17, color: 'var(--sp-muted)', lineHeight: 1.3 }}>
								<span>Fin de la promo</span>
								<b style={{ color: 'var(--sp-text)', fontSize: 20 }}>{end}</b>
							</span>
						)}
					</>
				)}
			</div>
			<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing autoFocus onClick={primary.run} onOKActionDescription={primary.hint} style={{ height: 76, fontSize: 26 }}>
				{!mine && <CartIcon />}
				{primary.label}
			</DialogButton>
			<Focusable flow-children="row" style={{ display: 'flex', gap: 12 }}>
				{!mine && (
					<DialogButton
						className="spbp-chip-btn"
						noFocusRing
						disabled={wished === null || busy}
						aria-pressed={!!wished}
						onClick={onWish}
						onOKActionDescription={wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits'}
					>
						<HeartIcon on={!!wished} />
						{busy ? 'Un instant…' : wished ? 'Dans votre liste de souhaits' : 'Ajouter à la liste de souhaits'}
					</DialogButton>
				)}
				<span className="spbp-chip-info">
					{family || mine ? (
						<MemberAvatar accountId={family?.accountId ?? myAccountId()} color={family?.color || 'var(--sp-accent)'} size={30} />
					) : (
						<span className="spbp-dot" style={{ width: 18, height: 18, background: 'var(--sp-line)' }} />
					)}
					<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{family ? `Jouable via ${family.name}` : mine ? 'Déjà à vous' : 'Pas dans la famille'}
					</span>
				</span>
			</Focusable>
			{storeDiskLabel(app) && (
				<span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19 }}>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', color: 'var(--sp-muted)' }}>
						<ellipse cx="12" cy="6" rx="8" ry="3" />
						<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
					</svg>
					<span>
						<b>{storeDiskLabel(app)}</b> <span style={{ color: 'var(--sp-muted)' }}>d’espace disque nécessaire</span>
					</span>
				</span>
			)}
			{!mine && <span style={{ fontSize: 16, color: 'var(--sp-muted)' }}>Le paiement se fait sur la page de Steam : rien n’est acheté depuis cet écran.</span>}
		</div>
	);
}

export function BpStoreApp() {
	const s = useSettings();
	const path = usePath('bp');
	// pendant l'animation de sortie la route a déjà changé : on garde le jeu affiché (sinon la page se vidait,
	// et le bouton de la liste de souhaits passait un instant à « Ajouter »)
	const lastAppid = useRef(0);
	const fromPath = Number(path.match(/\/steamupgraded\/bp\/vente\/(\d+)/)?.[1] || 0);
	if (fromPath) lastAppid.current = fromPath;
	const appid = lastAppid.current;
	const [res, retry] = useAsync((force) => loadStoreApp(appid, force), [appid]);
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	// état après un ajout ou un retrait fait ici (wished vaut null tant que la liste de souhaits n'est pas lue)
	const [override, setOverride] = useState<{ appid: number; on: boolean } | null>(null);
	const [busy, setBusy] = useState(false);
	const [viewer, setViewer] = useState(false);
	const [current, setCurrent] = useState(0);
	const own = useMemo(ownershipMap, []);
	const app = res.data;

	const fromList = wl.data ? wl.data.items.some((d) => d.appid === appid) : null;
	const wished = override?.appid === appid ? override.on : fromList;
	const toggleWish = async () => {
		if (wished === null || busy) return;
		setBusy(true);
		const ok = await setWishlisted(appid, !wished);
		if (ok) setOverride({ appid, on: !wished });
		setBusy(false);
	};

	if (!app) {
		return (
			<BpFrame header={false} onBack={goBackBp} info={<span>Magasin</span>}>
				<p style={{ margin: '80px 72px', fontSize: 26, color: 'var(--sp-muted)' }}>{res.loading ? 'Chargement de la page du jeu…' : `Page du jeu indisponible${res.error ? ` (${res.error})` : ''}.`}</p>
				{res.error && (
					<DialogButton className="spbp-btn" noFocusRing autoFocus onClick={retry} style={{ marginLeft: 72 }}>
						Réessayer
					</DialogButton>
				)}
			</BpFrame>
		);
	}

	const oled = s.bpTheme === 'oled';
	const media = [...app.movies.map((m) => ({ video: true, thumb: m.thumb, full: m.thumb, dash: String((m as any).dash || ''), name: m.name || '' })), ...app.screenshots.map((x) => ({ video: false, thumb: x.thumb, full: x.full, dash: '', name: '' }))];
	const shown = media[current];
	const owned = own.get(appid)?.kind === 'me';
	const features = playFeatures(app);
	const french = FRENCH[app.french] || FRENCH.non;
	const fade = oled
		? 'linear-gradient(to right, rgba(0,0,0,.78) 0%, rgba(0,0,0,.15) 60%, rgba(0,0,0,.45) 100%), linear-gradient(to bottom, rgba(0,0,0,0) 55%, var(--sp-bg) 100%)'
		: 'linear-gradient(to bottom, transparent 50%, var(--sp-bg) 100%), linear-gradient(to right, rgba(0,0,0,.6) 0%, rgba(0,0,0,.1) 60%, rgba(0,0,0,.4) 100%)';
	const openMedia = (i: number) => {
		// une vidéo sans manifeste lisible s'ouvre sur la page de Valve
		if (media[i]?.video && !media[i].dash) openSteamWebBp(storeUrl(appid));
		else setViewer((v) => !v);
	};

	return (
		<BpFrame
			header={false}
			onBack={viewer ? () => setViewer(false) : goBackBp}
			backLabel={viewer ? 'Fermer' : 'Retour'}
			options={owned ? undefined : { label: wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits', run: toggleWish }}
			secondary={{ label: 'Page Steam complète', run: () => openSteamWebBp(storeUrl(appid)) }}
			info={<span>Magasin › {app.name}</span>}
		>
			<section aria-label="Bannière" data-reveal-block style={{ position: 'relative', height: 560, background: 'var(--sp-surface2)', display: 'flex', alignItems: 'flex-end', gap: 48, padding: '0 72px 48px', overflow: 'hidden' }}>
				<FallbackImg
					srcs={[app.hero, app.background, app.header].filter(Boolean) as string[]}
					alt=""
					style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
				/>
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: fade }} />
				<span style={{ position: 'absolute', top: 32, left: 72, fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.75)' }}>Magasin</span>
				<div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
					<span style={{ fontSize: 84, fontWeight: 800, lineHeight: 0.95, color: '#fff', letterSpacing: '-0.01em', textShadow: '0 2px 20px rgba(0,0,0,.5)' }}>{app.name}</span>
					{app.short && <span style={{ fontSize: 24, lineHeight: 1.35, color: 'rgba(255,255,255,.88)', maxWidth: 900, textShadow: '0 1px 10px rgba(0,0,0,.5)' }}>{app.short}</span>}
					<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
						{app.tags.map((t) => (
							<span key={t} className="spbp-tag">
								{t}
							</span>
						))}
						{app.reviewLabel ? (
							<span style={{ marginLeft: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, color: '#fff' }}>
								<span className="spbp-dot" style={{ width: 12, height: 12, background: reviewTone(app.reviewScore || 0) }} />
								<b style={{ color: reviewTone(app.reviewScore || 0) }}>{capitalize(app.reviewLabel)}</b>
								{app.reviewPct != null && (
									<span style={{ color: 'rgba(255,255,255,.75)' }}>
										{app.reviewPct}&#8239;% de {int(app.reviewCount || 0)} avis
									</span>
								)}
							</span>
						) : (
							<span style={{ marginLeft: 10, fontSize: 20, color: 'rgba(255,255,255,.75)' }}>Pas encore d’évaluations</span>
						)}
					</div>
				</div>
				<BuyPanel app={app} wished={wished} busy={busy} onWish={toggleWish} />
			</section>

			{media.length > 0 && (
				<section aria-labelledby="spbp-media" style={{ padding: '30px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
					<div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '0 72px' }}>
						<h2 id="spbp-media" className="spbp-h2" style={{ fontSize: 26 }}>
							Vidéos et captures
						</h2>
						<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>
							{[app.movies.length ? (app.movies.length > 1 ? `${app.movies.length} vidéos` : '1 vidéo') : '', app.screenshots.length ? (app.screenshots.length > 1 ? `${app.screenshots.length} captures` : '1 capture') : '']
								.filter(Boolean)
								.join(' · ')}
						</span>
					</div>
					{/* le focus reste sur les miniatures : la visionneuse montre celle qui est focalisée */}
					<Focusable
						flow-children="row"
						style={{ display: 'flex', gap: 20, padding: '22px 72px 40px', margin: '0 0 -24px', overflowX: 'auto', scrollbarWidth: 'none' } as any}
						{...({ onFocusWithin: (inside: boolean) => !inside && setViewer(false) } as any)}
					>
						{media.map((m, i) => (
							<DialogButton
								key={m.thumb + i}
								className="spbp-capsule"
								noFocusRing
								aria-label={m.video ? `Vidéo ${i + 1}` : `Capture ${i + 1 - app.movies.length}`}
								onClick={() => openMedia(i)}
								onGamepadFocus={() => setCurrent(i)}
								onOKActionDescription={m.video && !m.dash ? 'Voir la vidéo sur Steam' : viewer ? 'Fermer' : m.video ? 'Lire la vidéo' : 'Voir en grand'}
								style={{ position: 'relative' }}
							>
								<img src={m.thumb} alt="" loading="lazy" className="spbp-capsule-img" />
								{m.video && <PlayIcon />}
							</DialogButton>
						))}
					</Focusable>
				</section>
			)}

			<section aria-label="Infos" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 22, padding: '28px 72px 0' }}>
				<Card label="Sortie">
					<span style={{ fontSize: 30, fontWeight: 800 }}>{app.release || 'Date inconnue'}</span>
					<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{[app.developers[0], app.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
				</Card>
				<Card label="En français">
					<span style={{ fontSize: 30, fontWeight: 800 }}>{french[0]}</span>
					<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{french[1]}</span>
				</Card>
				<Card label="Jouer">
					{features.length ? (
						<span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
							{features.map((f) => (
								<span key={f} className="spbp-feature">
									{f}
								</span>
							))}
						</span>
					) : (
						<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>Non précisé par Steam</span>
					)}
				</Card>
				<Card label="Classement et presse">
					{app.pegi || app.metacritic ? (
						<span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
							{app.pegi && (
								<span style={{ width: 56, height: 56, flex: 'none', borderRadius: 14, background: pegiColor(app.pegi), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>{app.pegi}</span>
							)}
							<span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
								<span style={{ fontSize: 30, fontWeight: 800 }}>{app.metacritic ? `Metacritic ${app.metacritic}` : `PEGI ${app.pegi}`}</span>
								{app.pegi && (
									<span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>
										PEGI {app.pegi}
										{app.pegiDescriptors.length ? ` · ${app.pegiDescriptors.join(', ')}` : ''}
									</span>
								)}
							</span>
						</span>
					) : (
						<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>Aucun classement fourni</span>
					)}
				</Card>
			</section>

			<BpNews appid={appid} />

			{viewer && shown && (
				<div className="spbp-viewer" aria-live="polite">
					{shown.video && shown.dash ? <TrailerVideo key={shown.dash} src={shown.dash} poster={shown.thumb} onFail={() => openSteamWebBp(storeUrl(appid))} /> : <img src={shown.full} alt="" />}
					<span className="spbp-viewer-count">
						{shown.video ? `Vidéo ${current + 1} sur ${app.movies.length}${shown.name ? ` · ${shown.name}` : ''}` : `Capture ${current + 1 - app.movies.length} sur ${app.screenshots.length}`} · gauche et droite pour changer
					</span>
				</div>
			)}
		</BpFrame>
	);
}
