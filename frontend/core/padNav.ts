// Navigation à la manette dans une fenêtre HTML ordinaire (boutons, champs) affichée dans Big Picture.
// La navigation de Steam ne connaît que ses propres composants (Focusable, DialogButton) : tant que la
// fenêtre est ouverte, on intercepte les boutons (FocusNavController.SetCatchAllGamepadInput) et on déplace
// nous-mêmes le focus vers l'élément le plus proche dans la direction demandée.

const w = window as any;

// Valeurs de GamepadButton (millennium)
const OK = 1;
const CANCEL = 2;
const UP = 9;
const DOWN = 10;
const LEFT = 11;
const RIGHT = 12;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function candidates(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0 && el.getAttribute('aria-hidden') !== 'true';
	});
}

/** Élément le plus proche dans la direction : écart sur l'axe principal + pénalité sur l'axe perpendiculaire. */
function nearest(from: HTMLElement, list: HTMLElement[], dir: number): HTMLElement | null {
	const a = from.getBoundingClientRect();
	const ax = a.left + a.width / 2;
	const ay = a.top + a.height / 2;
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const el of list) {
		if (el === from) continue;
		const b = el.getBoundingClientRect();
		const bx = b.left + b.width / 2;
		const by = b.top + b.height / 2;
		let main: number;
		let cross: number;
		if (dir === DOWN) [main, cross] = [b.top - a.bottom, Math.abs(bx - ax)];
		else if (dir === UP) [main, cross] = [a.top - b.bottom, Math.abs(bx - ax)];
		else if (dir === RIGHT) [main, cross] = [b.left - a.right, Math.abs(by - ay)];
		else [main, cross] = [a.left - b.right, Math.abs(by - ay)];
		// tolère un léger chevauchement (éléments alignés de hauteur différente)
		if (main < -8) continue;
		const score = Math.max(0, main) + cross * 2;
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	return best;
}

/**
 * Pilote `root` à la manette jusqu'à l'appel de la fonction renvoyée. B déclenche `onCancel`.
 * (Simuler la touche Échap ne marche pas : en Big Picture, Steam intercepte le clavier avant le document.)
 */
export function padNavigate(root: HTMLElement, onCancel: () => void): () => void {
	const controller = w.FocusNavController;
	if (!controller?.SetCatchAllGamepadInput) return () => {};
	const doc = root.ownerDocument;
	const cancel = onCancel;
	root.classList.add('sp-padnav');
	const handle = controller.SetCatchAllGamepadInput((button: number, down: boolean) => {
		if (!root.isConnected) return false;
		if (!down) return true;
		const list = candidates(root);
		const current = doc.activeElement as HTMLElement | null;
		// le fond de la fenêtre peut avoir le focus : on ne part que d'un élément navigable
		const inside = !!current && list.includes(current);
		if (button === UP || button === DOWN || button === LEFT || button === RIGHT) {
			const next = inside ? nearest(current!, list, button) : list[0];
			if (next) {
				next.focus({ preventScroll: true });
				next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
			}
		} else if (button === OK) {
			if (inside) current!.click();
			else list[0]?.focus();
		} else if (button === CANCEL) cancel();
		// les autres boutons (Steam, accès rapide) restent à Steam
		else return false;
		return true;
	});
	return () => {
		root.classList.remove('sp-padnav');
		handle?.Unregister?.();
	};
}
