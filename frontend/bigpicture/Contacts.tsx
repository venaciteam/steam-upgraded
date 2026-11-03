// Big Picture › Contacts (/steamupgraded/bp/contacts) : l'onglet « Contacts » de l'en-tête, en plein écran
// à la place de l'accès rapide de Steam. Rail des vues, cartes des contacts ; A ouvre la discussion, X le profil.
import { memo, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { bpNavigate, ROUTES } from '../core/steam';
import { plural } from '../pages/library/data';
import { BpFrame, goBackBp } from './Frame';
import { openProfile, useFriends, useGroups } from './friends';
import type { Friend } from './friends';

type ViewId = 'all' | 'online' | 'favorite' | 'offline';

const VIEWS: { id: ViewId; label: string; test: (f: Friend) => boolean }[] = [
	{ id: 'all', label: 'Tous', test: () => true },
	{ id: 'online', label: 'En ligne', test: (f) => f.online },
	{ id: 'favorite', label: 'Favoris', test: (f) => f.favorite },
	{ id: 'offline', label: 'Hors ligne', test: (f) => !f.online },
];

// Gardés d'une visite à l'autre (retour depuis une discussion)
let lastView: ViewId = 'all';
let lastFocus = 0;

export function openChat(accountId: number) {
	bpNavigate(ROUTES.bpChat(accountId));
}

export function Avatar({ f, size, ring = 'var(--sp-bg)' }: { f: Friend; size: number; ring?: string }) {
	const dot = Math.round(size * 0.26);
	return (
		<span style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
			{f.avatar ? (
				<img src={f.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', cornerShape: 'round', opacity: f.online ? 1 : 0.7 } as any} />
			) : (
				<span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--sp-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4, cornerShape: 'round' } as any}>
					{f.name.charAt(0).toUpperCase()}
				</span>
			)}
			<span aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: dot, height: dot, borderRadius: '50%', background: f.online ? f.color : '#4a5260', border: `${Math.max(3, Math.round(size / 26))}px solid ${ring}`, cornerShape: 'round' } as any} />
		</span>
	);
}

const Card = memo(function Card({ f, big, focus }: { f: Friend; big?: boolean; focus: boolean }) {
	return (
		<DialogButton
			className={`spbp-friend${big ? ' spbp-friend--big' : ''}`}
			noFocusRing
			autoFocus={focus}
			aria-label={`${f.name}, ${f.status}${f.unread ? `, ${plural(f.unread, 'message non lu', 'messages non lus')}` : ''}`}
			onClick={() => openChat(f.accountId)}
			onGamepadFocus={() => (lastFocus = f.accountId)}
			onOKActionDescription="Discuter"
			onSecondaryButton={() => openProfile(f)}
			onSecondaryActionDescription="Profil"
		>
			<Avatar f={f} size={big ? 104 : 92} ring={big ? 'var(--sp-surface2)' : 'var(--spbp-card)'} />
			<span className="spbp-friend-text">
				<span className="spbp-friend-name">{f.name}</span>
				<span className="spbp-friend-status" style={{ color: f.online ? f.color : undefined }}>
					{f.status}
				</span>
			</span>
			{f.unread > 0 && (
				<span className="spbp-badge-count" aria-hidden="true">
					{f.unread}
				</span>
			)}
		</DialogButton>
	);
});

const Row = memo(function Row({ f, focus }: { f: Friend; focus: boolean }) {
	return (
		<DialogButton
			className="spbp-friend spbp-friend--row"
			noFocusRing
			autoFocus={focus}
			aria-label={`${f.name}, ${f.status}`}
			onClick={() => openChat(f.accountId)}
			onGamepadFocus={() => (lastFocus = f.accountId)}
			onOKActionDescription="Discuter"
			onSecondaryButton={() => openProfile(f)}
			onSecondaryActionDescription="Profil"
		>
			<Avatar f={f} size={48} ring="var(--spbp-card)" />
			<span className="spbp-friend-text">
				<span className="spbp-friend-name">{f.name}</span>
				<span className="spbp-friend-status">{f.status}</span>
			</span>
		</DialogButton>
	);
});

function Section({ title, count, children }: { title: string; count: number; children: any }) {
	return (
		<section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<h2 className="spbp-h2" style={{ fontSize: 26 }}>
				{title} <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--sp-muted)' }}>{count}</span>
			</h2>
			{children}
		</section>
	);
}

export function BpContacts() {
	const friends = useFriends();
	const groups = useGroups();
	const [view, setView] = useState<ViewId>(lastView);
	const current = VIEWS.find((v) => v.id === view) || VIEWS[0];
	const online = friends.filter((f) => f.online);
	const favs = friends.filter((f) => f.favorite && !f.online);
	const others = friends.filter((f) => !f.online && !f.favorite);
	const shown = friends.filter(current.test);
	const firstId = (view === 'all' ? [...online, ...favs, ...others] : shown)[0]?.accountId;
	const focusId = friends.some((f) => f.accountId === lastFocus) ? lastFocus : firstId;
	const recent = [...friends].filter((f) => f.lastChat || f.unread).sort((a, b) => b.unread - a.unread || b.lastChat - a.lastChat)[0];

	const pick = (id: ViewId) => {
		lastView = id;
		lastFocus = 0;
		setView(id);
	};

	return (
		<BpFrame tab="friends" onBack={goBackBp} info={<span>{plural(friends.length, 'contact', 'contacts')} · {online.length} en ligne</span>}>
			<Focusable flow-children="row" style={{ display: 'flex', gap: 40, padding: '36px 64px 0', alignItems: 'flex-start' }}>
				<nav aria-label="Vues" style={{ width: 300, flex: 'none', position: 'sticky', top: 0 }}>
					<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						{VIEWS.map((v) => (
							<DialogButton key={v.id} className="spbp-view" noFocusRing aria-pressed={v.id === view} onClick={() => pick(v.id)} onOKActionDescription="Afficher">
								<span>{v.label}</span>
								<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{friends.filter(v.test).length}</span>
							</DialogButton>
						))}
						<DialogButton className="spbp-view" noFocusRing onClick={() => bpNavigate(ROUTES.bpGroups)} onOKActionDescription="Ouvrir">
							<span>Groupes</span>
							<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{groups.length}</span>
						</DialogButton>
						<DialogButton className="spbp-view" noFocusRing onClick={() => openChat((recent || friends[0])?.accountId)} disabled={!friends.length} onOKActionDescription="Ouvrir">
							<span>Discussions</span>
							<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{friends.reduce((n, f) => n + f.unread, 0) || ''}</span>
						</DialogButton>
					</Focusable>
					<span style={{ display: 'block', margin: '22px 22px 0', fontSize: 16, color: 'var(--sp-muted)', lineHeight: 1.5 }}>Votre présence se change depuis le menu rapide.</span>
				</nav>

				<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 30, paddingBottom: 200 }}>
					{!friends.length && <p style={{ margin: 0, fontSize: 24, color: 'var(--sp-muted)' }}>Aucun contact pour l’instant.</p>}
					{view === 'all' ? (
						<>
							{online.length > 0 && (
								<Section title="En ligne" count={online.length}>
									<Focusable flow-children="grid" className="spbp-friend-grid spbp-friend-grid--big">
										{online.map((f) => (
											<Card key={f.accountId} f={f} big focus={f.accountId === focusId} />
										))}
									</Focusable>
								</Section>
							)}
							{favs.length > 0 && (
								<Section title="Favoris" count={favs.length}>
									<Focusable flow-children="grid" className="spbp-friend-grid">
										{favs.map((f) => (
											<Card key={f.accountId} f={f} focus={f.accountId === focusId} />
										))}
									</Focusable>
								</Section>
							)}
							{others.length > 0 && (
								<Section title="Autres contacts" count={others.length}>
									<Focusable flow-children="grid" className="spbp-friend-grid spbp-friend-grid--rows">
										{others.map((f) => (
											<Row key={f.accountId} f={f} focus={f.accountId === focusId} />
										))}
									</Focusable>
								</Section>
							)}
						</>
					) : shown.length ? (
						<Section title={current.label} count={shown.length}>
							<Focusable flow-children="grid" className="spbp-friend-grid">
								{shown.map((f) => (
									<Card key={f.accountId} f={f} focus={f.accountId === focusId} />
								))}
							</Focusable>
						</Section>
					) : (
						<p style={{ margin: 0, fontSize: 24, color: 'var(--sp-muted)' }}>Aucun contact dans cette vue.</p>
					)}
				</div>
			</Focusable>
		</BpFrame>
	);
}
