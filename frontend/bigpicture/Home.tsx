// Big Picture › Accueil : « Reprendre » en grand, joués récemment, promos de la liste de souhaits.
import { DialogButton, Focusable } from 'millennium';
import { bpNavigate, formatLastPlayed, playOrInstall } from '../core/steam';
import { formatBigHours, plural, useLibrary } from '../pages/library/data';
import type { Game } from '../pages/library/data';
import { loadWishlist, mySteamId, useAsync } from '../pages/store/data';
import { primaryState } from '../pages/game/data';
import { BpFrame, openSteamMenu } from './Frame';
import { HeroImage, Landscape, openGame, openGameOptions } from './gameActions';

const PlayIcon = () => (
	<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M7 4.5v15l12-7.5z" />
	</svg>
);

function Resume({ g }: { g: Game }) {
	const st = primaryState(g.app);
	const facts = [g.last ? `Dernière session ${formatLastPlayed(g.last)}` : '', g.mins ? `${formatBigHours(g.mins)} de jeu` : '', g.copies > 1 ? `${plural(g.copies, 'copie', 'copies')} dans la famille` : '']
		.filter(Boolean)
		.join(' · ');
	return (
		<section aria-label="Reprendre" data-reveal-block style={{ margin: '36px 64px 0', height: 470, borderRadius: 36, background: 'var(--sp-surface2)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', padding: 48, border: '1px solid var(--sp-line)' }}>
			<HeroImage app={g.app} />
			<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.7) 0%, rgba(0,0,0,0) 62%)' }} />
			<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 900 }}>
				<span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)' }}>Reprendre</span>
				<span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.5)' }}>{g.name}</span>
				{facts && <span style={{ fontSize: 22, color: 'rgba(255,255,255,.85)' }}>{facts}</span>}
				<Focusable flow-children="row" style={{ display: 'flex', gap: 16, marginTop: 10 }}>
					<DialogButton
						className="spbp-btn spbp-btn--primary"
						noFocusRing
						autoFocus
						disabled={st.disabled}
						onClick={() => playOrInstall(g.app)}
						onOKActionDescription={st.label}
						onSecondaryButton={(e: any) => openGameOptions(g.app, e?.currentTarget)}
						onSecondaryActionDescription="Options"
					>
						<PlayIcon />
						{st.label}
					</DialogButton>
					<DialogButton className="spbp-btn spbp-btn--glass" noFocusRing onClick={() => openGame(g.appid)} onOKActionDescription="Ouvrir">
						Fiche du jeu
					</DialogButton>
				</Focusable>
			</div>
		</section>
	);
}

function Recent({ games }: { games: Game[] }) {
	if (!games.length) return null;
	return (
		<section aria-labelledby="spbp-recent" style={{ margin: '40px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
			<h2 id="spbp-recent" className="spbp-h2" style={{ paddingLeft: 64 }}>
				Joués récemment
			</h2>
			<Focusable flow-children="row" style={{ display: 'flex', gap: 22, padding: '24px 64px 24px', margin: '-16px 0 0', overflowX: 'auto', scrollbarWidth: 'none' } as any}>
				{games.map((g) => (
					<DialogButton
						key={g.appid}
						className="spbp-capsule"
						noFocusRing
						onClick={() => openGame(g.appid)}
						onOKActionDescription="Fiche du jeu"
						onSecondaryButton={(e: any) => openGameOptions(g.app, e?.currentTarget)}
						onSecondaryActionDescription="Options"
						aria-label={g.name}
					>
						<Landscape app={g.app} fallback={g.landscape} className="spbp-capsule-img" />
						<span className="spbp-capsule-name">{g.name}</span>
						<span className="spbp-capsule-sub">
							{formatLastPlayed(g.last)} · {formatBigHours(g.mins)}
						</span>
					</DialogButton>
				))}
			</Focusable>
		</section>
	);
}

function WishlistInfo() {
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const deals = (wl.data?.items || []).filter((d) => d.discount > 0).length;
	if (!wl.data?.ok) return null;
	return (
		<span>
			Promos de votre liste de souhaits : <b style={{ color: 'var(--sp-deal)' }}>{deals ? plural(deals, 'jeu', 'jeux') : 'aucune'}</b>
		</span>
	);
}

export function BpHome() {
	const [lib] = useLibrary();
	const played = lib.games.filter((g) => g.last > 0).sort((a, b) => b.last - a.last);
	const [first, ...rest] = played;
	return (
		<BpFrame tab="home" onBack={openSteamMenu} backLabel="Menu Steam" info={<WishlistInfo />} options={{ label: 'Rechercher', run: () => bpNavigate('/search') }}>
			{first ? (
				<Resume g={first} />
			) : (
				<p style={{ margin: '60px 64px', fontSize: 26, color: 'var(--sp-muted)' }}>Aucun jeu lancé pour l'instant.</p>
			)}
			<Recent games={rest.slice(0, 14)} />
		</BpFrame>
	);
}
