// Bouton « Ajouter un jeu » de la bibliothèque (remplace celui de la barre du bas de Steam).
import { useEffect, useRef, useState } from 'react';
import { runNativeMenuItem } from '../../core/nativeMenu';
import { navigate, ROUTES } from '../../core/steam';

const ACTIONS: { label: string; run: () => void }[] = [
	{ label: 'Ajouter un jeu non Steam…', run: () => runNativeMenuItem('Jeux', 'Ajouter un jeu non Steam') },
	{ label: 'Activer un produit sur Steam…', run: () => runNativeMenuItem('Jeux', 'Activer un produit sur Steam') },
	{ label: 'Parcourir le magasin', run: () => navigate(ROUTES.store) },
];

export function AddGameButton() {
	const [open, setOpen] = useState(false);
	const btn = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return undefined;
		const doc = btn.current?.ownerDocument;
		const onDown = (e: MouseEvent) => {
			if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
		doc?.addEventListener('mousedown', onDown);
		doc?.addEventListener('keydown', onKey);
		return () => {
			doc?.removeEventListener('mousedown', onDown);
			doc?.removeEventListener('keydown', onKey);
		};
	}, [open]);

	const rect = btn.current?.getBoundingClientRect();
	// Le bouton est au bord droit de la page : le menu s'aligne sur sa droite pour ne pas sortir de la fenêtre.
	const viewWidth = btn.current?.ownerDocument.documentElement.clientWidth ?? 0;
	return (
		<>
			<button ref={btn} type="button" className="sp-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} style={{ alignItems: 'center' }}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Ajouter un jeu
			</button>
			{open && rect && (
				<div ref={pop} className="sp-pop" role="menu" aria-label="Ajouter un jeu" style={{ top: rect.bottom + 8, right: Math.max(8, viewWidth - rect.right), minWidth: Math.max(rect.width, 260) }}>
					{ACTIONS.map((a) => (
						<button
							key={a.label}
							type="button"
							role="menuitem"
							className="sp-pop-item"
							onClick={() => {
								setOpen(false);
								a.run();
							}}
						>
							{a.label}
						</button>
					))}
				</div>
			)}
		</>
	);
}
