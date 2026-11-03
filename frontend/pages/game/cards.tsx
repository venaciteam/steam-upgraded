// Cartes de la fiche d'un jeu.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { forgetOwners } from '../library/data';
import { avatarUrl, formatLastPlayed, Member, openStorePage } from '../../core/steam';
import {
	Achievements,
	collectionsOf,
	Copy,
	dayToDate,
	formatDate,
	formatDuration,
	Friend,
	liveName,
	monthlyFromLog,
	Reading,
	setPreferredCopy,
} from './data';

const card: CSSProperties = { padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 };
const sideCard: CSSProperties = { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 };

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }} title={title}>
			<span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{value}</span>
			<span className="sp-muted" style={{ fontSize: 12 }}>
				{label}
			</span>
		</div>
	);
}

// ---------- Temps de jeu ----------

export function PlaytimeCard({ app, log, borrowed }: { app: any; log: Reading[] | null; borrowed: Member | null }) {
	const total = app.minutes_playtime_forever || 0;
	const recent = app.minutes_playtime_last_two_weeks || 0;
	const last = app.rt_last_time_played || 0;
	const bought = app.rt_purchased_time || 0;
	const months = log ? monthlyFromLog(log) : [];
	const max = Math.max(1, ...months.map((m) => m.minutes));
	const peak = months.reduce((p, m) => (m.minutes > (p?.minutes || 0) ? m : p), null as null | (typeof months)[number]);
	const since = log && log.length ? dayToDate(log[0][0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
	// Graphique seulement s'il y a du temps joué à montrer (sinon une barre vide et un seul mois)
	const played = months.some((m) => m.minutes > 0);

	return (
		<section className="sp-card" style={card} aria-labelledby="sp-game-playtime">
			<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 16 }}>
				<h2 id="sp-game-playtime" className="sp-h2" style={{ flex: 1 }}>
					Votre temps de jeu
				</h2>
				{played && <span className="sp-muted">{months.length > 1 ? `${months.length} derniers mois` : 'Ce mois-ci'}</span>}
			</div>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 36px' }}>
				<Stat value={formatDuration(total)} label="au total" />
				<Stat value={formatDuration(recent)} label="ces 2 dernières semaines" />
				<Stat value={last ? formatLastPlayed(last) : 'jamais'} label="dernière session" title={last ? formatDate(last) : undefined} />
				{bought > 0 && <Stat value={formatDate(bought)} label={borrowed ? `achat de la copie de ${borrowed.name}` : "date d'achat"} />}
			</div>
			{played ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div
						role="img"
						aria-label={`Temps joué par mois${peak && peak.minutes ? `, maximum en ${peak.label} (${formatDuration(peak.minutes)})` : ''}`}
						style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(months.length, 6)}, minmax(0, 1fr))`, gap: 8, alignItems: 'end', height: 150 }}
					>
						{months.map((m) => {
							const pct = m.minutes ? Math.max(3, Math.round((m.minutes / max) * 100)) : 0;
							const isPeak = peak && m.key === peak.key && m.minutes > 0;
							return (
								<div key={m.key} title={`${m.label} : ${formatDuration(m.minutes)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%', minWidth: 0 }}>
									<span style={{ fontSize: 11, fontWeight: 700, color: isPeak ? 'var(--sp-text)' : 'var(--sp-muted)', whiteSpace: 'nowrap' }}>{m.minutes ? formatDuration(m.minutes) : ''}</span>
									<div style={{ width: '100%', flex: `0 0 ${pct}%`, maxHeight: 'calc(100% - 40px)', minHeight: 2, borderRadius: '4px 4px 0 0', background: isPeak ? 'var(--sp-accent)' : 'var(--sp-surface2)', border: isPeak ? 0 : '1px solid var(--sp-line)' }} />
									<span className="sp-muted" style={{ fontSize: 11 }}>
										{m.label}
									</span>
								</div>
							);
						})}
					</div>
					<span className="sp-muted" style={{ fontSize: 12 }}>
						D'après les relevés pris à chaque visite de cette fiche depuis le {since}. Le temps joué entre deux relevés est compté dans le mois du second.
					</span>
				</div>
			) : (
				<p className="sp-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
					{since ? `Aucune partie depuis le premier relevé, le ${since}. ` : ''}
					Steam ne garde pas l'historique mois par mois : le graphique se remplit au fil de vos sessions, d'après un relevé pris à chaque visite de cette fiche.
				</p>
			)}
		</section>
	);
}

// ---------- Progression ----------

export function ProgressCard({ data, loading }: { data: Achievements; loading: boolean }) {
	if (!loading && !data) return null;
	const pct = data && data.total ? Math.round((data.achieved / data.total) * 100) : 0;
	return (
		<section className="sp-card" style={card} aria-labelledby="sp-game-progress">
			<h2 id="sp-game-progress" className="sp-h2">
				Progression
			</h2>
			{loading ? (
				<span className="sp-muted">Chargement des succès…</span>
			) : data && data.total === 0 ? (
				<span className="sp-muted">Ce jeu n'a pas de succès Steam.</span>
			) : (
				data && (
					<>
						<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
							<span style={{ fontWeight: 700 }}>
								Succès {data.achieved} / {data.total}
							</span>
							<span className="sp-muted">{pct} %</span>
						</div>
						<div className="sp-bar" style={{ height: 8, borderRadius: 4 }} role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.achieved} aria-label="Succès obtenus">
							<i style={{ width: `${pct}%`, borderRadius: 4 }} />
						</div>
						{data.recent.length > 0 ? (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
								<span className="sp-label">Derniers succès obtenus</span>
								{data.recent.map((a) => (
									<div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
										<img src={a.image} alt="" width={40} height={40} style={{ borderRadius: 'var(--sp-r-sm)', flex: 'none', background: 'var(--sp-surface2)' }} />
										<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
											<span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
											<span className="sp-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
												{a.description}
											</span>
										</div>
										<span className="sp-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
											{a.unlocked ? formatDate(a.unlocked) : ''}
										</span>
									</div>
								))}
							</div>
						) : (
							<span className="sp-muted" style={{ fontSize: 13 }}>
								Aucun succès obtenu pour l'instant.
							</span>
						)}
					</>
				)
			)}
		</section>
	);
}

// ---------- Clé ----------

/** Photo de profil du membre (contour à sa couleur), ou son initiale si la photo manque. */
function Initial({ name, color, size = 40, accountId }: { name: string; color?: string; size?: number; accountId?: number }) {
	const [broken, setBroken] = useState(false);
	const src = accountId ? avatarUrl(accountId) : undefined;
	if (src && !broken)
		return (
			<img
				src={src}
				alt=""
				width={size}
				height={size}
				onError={() => setBroken(true)}
				style={{ width: size, height: size, borderRadius: '50%', flex: 'none', objectFit: 'cover', boxShadow: color ? `0 0 0 2px ${color}` : 'none' }}
			/>
		);
	return (
		<span
			className="sp-avatar"
			aria-hidden="true"
			style={{ width: size, height: size, fontSize: size * 0.42, background: color || 'var(--sp-surface2)', color: color ? '#0a0d12' : 'var(--sp-text)' }}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	);
}

/** « de Camille », « d'Alex » (élision devant une voyelle). */
function deName(name: string): string {
	return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** Toutes les copies du jeu dans la famille, la copie utilisée marquée, et le choix d'une autre copie. */
function CopiesChooser({ app, copies, onChanged }: { app: any; copies: Copy[]; onChanged: () => void }) {
	const [pending, setPending] = useState<number | null>(null);
	const [error, setError] = useState('');
	const ds = Number(app.display_status ?? 0);
	const running = ds === 4 || ds === 1 || ds === 36;
	const sorted = [...copies].sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, 'fr'));
	const choose = async (c: Copy) => {
		setPending(c.accountId);
		setError('');
		try {
			const ok = await setPreferredCopy(app.appid, c.accountId);
			if (!ok) setError("Steam n'a pas pu changer de copie. Réessayez dans un instant.");
		} catch (e) {
			console.error('[steam-upgraded] changement de copie impossible', app.appid, e);
			setError("Steam n'a pas pu changer de copie. Réessayez dans un instant.");
		} finally {
			setPending(null);
			forgetOwners(app.appid);
			onChanged();
		}
	};
	return (
		<div role="group" aria-labelledby="sp-game-copies" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
			<span id="sp-game-copies" className="sp-label">
				{copies.length} copies dans la famille
			</span>
			{sorted.map((c) => {
				const who = liveName(c.accountId, c.name);
				const name = c.isMe ? 'Votre copie' : `Copie ${deName(who)}`;
				return (
					<div
						key={c.accountId}
						style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '4px 6px 4px 6px', borderRadius: 'var(--sp-r-sm)', background: c.preferred ? 'var(--sp-surface2)' : 'transparent' }}
					>
						<Initial name={c.isMe ? 'T' : who} color={c.isMe ? 'var(--sp-accent)' : c.color} size={26} accountId={c.accountId} />
						<span title={name} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.preferred ? 700 : 500, fontSize: 14 }}>{name}</span>
						{c.preferred ? (
							<span className="sp-badge" style={{ flex: 'none' }}>
								Utilisée
							</span>
						) : (
							<button
								type="button"
								className="sp-btn"
								disabled={running || pending !== null}
								title={running ? 'Quitte le jeu pour changer de copie' : undefined}
								aria-label={`Utiliser ${c.isMe ? 'votre copie' : `la copie ${deName(who)}`}`}
								onClick={() => choose(c)}
								style={{ flex: 'none', alignItems: 'center', height: 30, padding: '0 12px', fontSize: 13, opacity: running ? 0.55 : 1, cursor: running ? 'default' : 'pointer' }}
							>
								{pending === c.accountId ? 'Changement…' : 'Utiliser'}
							</button>
						)}
					</div>
				);
			})}
			{running && (
				<span className="sp-muted" style={{ fontSize: 12 }}>
					Quitte le jeu pour changer de copie.
				</span>
			)}
			{error && (
				<span role="alert" style={{ fontSize: 13, fontWeight: 700 }}>
					{error}
				</span>
			)}
		</div>
	);
}

export function KeyCard({ app, details, lender, copies, onCopiesChanged }: { app: any; details: any; lender: Member | null; copies: Copy[] | null; onCopiesChanged: () => void }) {
	const several = !!copies && copies.length > 1;
	const playing = Number(details?.unMembersPlaying || 0);
	const ds = Number(app.display_status ?? 0);

	if (lender) {
		const busy = ds === 37 || ds === 17;
		return (
			<section className="sp-card" style={{ ...sideCard, border: `2px solid ${lender.color}` }} aria-labelledby="sp-game-key">
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<Initial name={lender.name} color={lender.color} accountId={lender.accountId} />
					<div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
						<h2 id="sp-game-key" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
							Clé {deName(lender.name)}
						</h2>
						<span className="sp-muted" style={{ fontSize: 13 }}>
							Prêtée via la Famille Steam
						</span>
					</div>
				</div>
				<ul className="sp-muted" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
					<li style={{ color: busy ? 'var(--sp-text)' : undefined, fontWeight: busy ? 700 : undefined }}>
						{busy ? 'Cette copie est utilisée en ce moment.' : 'Libre en ce moment : vous pouvez jouer.'}
					</li>
					<li>Une copie ne sert qu'à une personne à la fois : si {lender.name} lance le jeu, votre partie devra s'arrêter.</li>
					<li>Vos sauvegardes, vos succès et votre temps de jeu vous restent.</li>
				</ul>
				{several && <CopiesChooser app={app} copies={copies!} onChanged={onCopiesChanged} />}
				<button
					type="button"
					onClick={() => openStorePage(app.appid)}
					style={{ alignSelf: 'flex-start', alignItems: 'center', padding: 0, border: 0, background: 'transparent', color: 'var(--sp-accent)', fontWeight: 700 }}
				>
					Voir le prix pour l'acheter →
				</button>
			</section>
		);
	}

	const excluded = !!details?.bIsExcludedFromSharing;
	return (
		<section className="sp-card" style={sideCard} aria-labelledby="sp-game-key">
			<h2 id="sp-game-key" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
				Ce jeu est à vous
			</h2>
			<span className="sp-muted" style={{ fontSize: 13 }}>
				{excluded
					? "Ce jeu ne peut pas être prêté à la Famille Steam."
					: "Votre famille peut l'emprunter quand vous n'y jouez pas : une seule personne à la fois sur votre copie."}
			</span>
			{several && <CopiesChooser app={app} copies={copies!} onChanged={onCopiesChanged} />}
			{playing > 0 && (
				<span className="sp-muted" style={{ fontSize: 13 }}>
					{playing === 1 ? 'Un membre de la famille y joue en ce moment.' : `${playing} membres de la famille y jouent en ce moment.`}
				</span>
			)}
		</section>
	);
}

// ---------- Collections ----------

export function CollectionsCard({ appid }: { appid: number }) {
	const list = collectionsOf(appid);
	return (
		<section className="sp-card" style={sideCard} aria-labelledby="sp-game-collections">
			<h2 id="sp-game-collections" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
				Collections
			</h2>
			{list.length ? (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{list.map((c) => (
						<span key={c.id} style={{ padding: '6px 10px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13 }}>
							{c.name}
						</span>
					))}
				</div>
			) : (
				<span className="sp-muted" style={{ fontSize: 13 }}>
					Dans aucune de vos collections.
				</span>
			)}
		</section>
	);
}

// ---------- Amis ----------

export function FriendsCard({ friends, title = 'Contacts qui y jouent' }: { friends: Friend[] | null; title?: string }) {
	if (friends && friends.length === 0) return null;
	const inGame = friends ? friends.filter((f) => f.inGame).length : 0;
	return (
		<section className="sp-card" style={sideCard} aria-labelledby="sp-game-friends">
			<h2 id="sp-game-friends" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
				{title}
			</h2>
			{!friends ? (
				<span className="sp-muted" style={{ fontSize: 13 }}>
					Recherche parmi vos contacts…
				</span>
			) : (
				<>
					<span className="sp-muted" style={{ fontSize: 13 }}>
						{friends.length === 1 ? '1 contact l’a' : `${friends.length} contacts l’ont`}
						{inGame ? ` · ${inGame} en jeu maintenant` : ''}
					</span>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						{friends.slice(0, 8).map((f) => (
							<div key={f.accountId} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
								{f.avatar ? (
									<img src={f.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', flex: 'none' }} />
								) : (
									<Initial name={f.name} size={28} />
								)}
								<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liveName(f.accountId, f.name)}</span>
								{f.inGame && (
									<span className="sp-badge" style={{ background: 'var(--sp-online)', color: 'var(--sp-deal-ink)' }}>
										En jeu
									</span>
								)}
							</div>
						))}
						{friends.length > 8 && (
							<span className="sp-muted" style={{ fontSize: 12 }}>
								et {friends.length - 8} autre{friends.length - 8 > 1 ? 's' : ''}
							</span>
						)}
					</div>
				</>
			)}
		</section>
	);
}
