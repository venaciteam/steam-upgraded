// Bouton Jouer / Installer / Streamer d'un jeu, avec une flèche qui liste les autres possibilités (autres machines du
// compte, ou « non disponible » sur ce système). Sans autre machine, la flèche n'apparaît pas : bouton d'origine.
import { useEffect, useRef, useState } from 'react';
import { GameAction, gameActions } from '../../core/machines';
import { primaryState } from './data';

const w = window as any;

const ICON = {
	play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
	install: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
	stream: <path d="M3 6h18v11H3zM8 21h8M12 17v4M10 9.5v4l3.5-2z" />,
	'remote-install': <path d="M3 6h18v11H3zM8 21h8M12 17v4M12 8v5.5M9.5 11l2.5 2.5 2.5-2.5" />,
	unavailable: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8" />,
};

function Glyph({ kind, size }: { kind: keyof typeof ICON; size: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
			{ICON[kind]}
		</svg>
	);
}

type Props = { app: any; name?: string; compact?: boolean; big?: boolean; style?: any };

export function PlayControl({ app, name, compact, big, style }: Props) {
	const st = primaryState(app);
	const choice = st.choices.length > 1;
	const [open, setOpen] = useState(false);
	const main = useRef<HTMLButtonElement>(null);
	const arrow = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ top: 0, right: 0 });

	useEffect(() => {
		if (!open) return undefined;
		const doc = arrow.current?.ownerDocument;
		const win = doc?.defaultView;
		const onDown = (e: MouseEvent) => {
			const t = e.target as Node;
			if (!pop.current?.contains(t) && !arrow.current?.contains(t)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false);
				arrow.current?.focus();
			}
		};
		const close = () => setOpen(false);
		doc?.addEventListener('mousedown', onDown, true);
		doc?.addEventListener('keydown', onKey);
		win?.addEventListener('blur', close);
		win?.addEventListener('resize', close);
		setTimeout(() => pop.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(), 0);
		return () => {
			doc?.removeEventListener('mousedown', onDown, true);
			doc?.removeEventListener('keydown', onKey);
			win?.removeEventListener('blur', close);
			win?.removeEventListener('resize', close);
		};
	}, [open]);

	const toggle = (e: any) => {
		e.stopPropagation();
		const el = arrow.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const W = el.ownerDocument.defaultView?.innerWidth || 0;
		setPos({ top: r.bottom + 6, right: W - r.right });
		setOpen((o) => !o);
	};

	const pick = (a: GameAction) => {
		setOpen(false);
		if (!a.disabled) a.run();
	};

	// Le style reçu vise le bouton (hauteur, marges, police) ; seule sa part de mise en page (flex, largeur, marges
	// extérieures) va au conteneur, sinon les deux boutons gardent leur taille et débordent (carte de survol des tuiles).
	const { flex, minWidth, width, maxWidth, margin, marginLeft, marginRight, marginTop, marginBottom, alignSelf, ...btn } = style || {};
	const outer = { flex, minWidth, width, maxWidth, margin, marginLeft, marginRight, marginTop, marginBottom, alignSelf };
	const fill = flex !== undefined || width !== undefined;
	const h = btn.height ?? (big ? undefined : compact ? 36 : 40);
	// Fiche du jeu : toujours le bouton plein ; cartes : plein pour jouer ou streamer, discret pour installer
	const primaryLook = big || st.kind === 'play' || st.kind === 'stream';
	const cls = `sp-btn${primaryLook ? ' sp-btn--primary' : ''}${big ? ' sp-btn--big' : ''}`;
	const iconSize = big ? 18 : compact ? 14 : 15;
	const body = arrow.current?.ownerDocument?.body;
	const label = `${st.label}${name ? ` : ${name}` : ''}`;
	// Cartes (compact) : libellé court, la machine reste dans l'infobulle, la lecture d'écran et la liste de la flèche
	// Carte de survol d'une tuile (compact et étiré) : place comptée, ni icône ni libellé long
	const tight = !!compact && fill;
	const short = !compact
		? st.label
		: st.kind === 'stream'
			? 'Streamer'
			: st.kind === 'remote-install'
				? tight ? 'À distance' : 'Installer à distance'
				: st.kind === 'unavailable'
					? tight ? 'Indisponible' : 'Non disponible'
					: st.label;

	return (
		<div style={{ display: 'inline-flex', flex: 'none', ...outer }} onClick={(e) => e.stopPropagation()}>
			<button
				ref={main}
				type="button"
				className={cls}
				disabled={st.disabled}
				title={st.hint || (short !== st.label ? st.label : undefined)}
				aria-label={name ? label : short !== st.label ? st.label : undefined}
				onClick={() => !st.disabled && gameActions(app).primary.run()}
				style={{
					height: h,
					padding: big ? undefined : compact ? '0 14px' : '0 18px',
					gap: 10,
					...btn,
					...(fill ? { flex: '1 1 auto', minWidth: 0 } : {}),
					...(choice ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}),
					...(st.disabled ? { opacity: 0.6, cursor: 'default' } : {}),
				}}
			>
				{!tight && <Glyph kind={st.kind} size={iconSize} />}
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short}</span>
			</button>
			{choice && (
				<button
					ref={arrow}
					type="button"
					className={cls}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={name ? `Autres possibilités : ${name}` : 'Autres possibilités'}
					onClick={toggle}
					style={{
						height: h,
						flex: 'none',
						fontSize: btn.fontSize,
						padding: big ? '0 14px' : tight ? '0 6px' : '0 10px',
						marginLeft: 1,
						borderTopLeftRadius: 0,
						borderBottomLeftRadius: 0,
					}}
				>
					<svg width={big ? 16 : 13} height={big ? 16 : 13} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}>
						<path d="m6 8 4 4 4-4" />
					</svg>
				</button>
			)}
			{open &&
				body &&
				w.SP_REACTDOM.createPortal(
					<div ref={pop} className="sp-pop" role="menu" aria-label="Jouer, installer ou streamer" style={{ top: pos.top, right: pos.right, minWidth: 280 }}>
						{st.choices.map((a, i) => (
							<button key={i} type="button" role="menuitem" className="sp-pop-item" disabled={a.disabled} onClick={() => pick(a)} style={a.disabled ? { opacity: 0.55, cursor: 'default' } : undefined}>
								<Glyph kind={a.kind} size={16} />
								<span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									<span style={{ fontWeight: 700 }}>{a.label}</span>
									{a.kind === 'unavailable' && <span className="sp-muted" style={{ fontSize: 12 }}>Ce jeu n’existe pas pour ce système</span>}
									{a.kind === 'stream' && <span className="sp-muted" style={{ fontSize: 12 }}>Remote Play : le jeu tourne sur {a.machine?.name}</span>}
									{a.kind === 'remote-install' && <span className="sp-muted" style={{ fontSize: 12 }}>Installé à distance, à streamer ensuite</span>}
								</span>
							</button>
						))}
					</div>,
					body,
				)}
		</div>
	);
}
