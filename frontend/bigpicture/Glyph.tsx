// Glyphe d'un bouton de manette, dessiné par Steam selon la manette réellement branchée (Xbox, PlayStation…).
// Steam n'exporte pas ce composant : on le retrouve dans son pied de page (props { button, bAllowKeyboard }).
import { useEffect, useState } from 'react';
import { bpWindow } from '../core/steam';

/** Numérotation des glyphes de Steam (différente de GamepadButton). */
export const GLYPH = { A: 0, B: 1, X: 2, Y: 3, MENU: 11, LB: 12, RB: 13 } as const;

let found: any = null;

function findGlyphComponent(): any {
	if (found) return found;
	const doc = bpWindow()?.document;
	for (const el of Array.from(doc?.querySelectorAll('.BasicFooter img, .BasicFooter svg') || [])) {
		const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
		let f = key ? (el as any)[key] : null;
		for (let i = 0; i < 5 && f; i++, f = f.return) {
			if (f.memoizedProps && 'bAllowKeyboard' in f.memoizedProps && typeof f.type === 'function') {
				found = f.type;
				return found;
			}
		}
	}
	return null;
}

/** `fallback` : texte affiché tant que le composant de Steam n'est pas trouvé (ex. « LB »). */
export function Glyph({ button, size, fallback }: { button: number; size: number; fallback: string }) {
	const [C, setC] = useState<any>(() => findGlyphComponent());
	useEffect(() => {
		if (C) return undefined;
		let n = 0;
		const id = setInterval(() => {
			const c = findGlyphComponent();
			if (c || ++n > 20) clearInterval(id);
			if (c) setC(() => c);
		}, 500);
		return () => clearInterval(id);
	}, [C]);
	if (!C)
		return (
			<span className="spbp-glyph-text" style={{ height: size, minWidth: size }}>
				{fallback}
			</span>
		);
	return (
		<span className="spbp-glyph" style={{ height: size }}>
			<C button={button} className="spbp-glyph-img" />
		</span>
	);
}
