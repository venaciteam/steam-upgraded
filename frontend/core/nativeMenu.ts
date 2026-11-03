// Exécute une entrée des menus natifs de Steam (Afficher, Contacts, Jeux, Aide) sans les montrer.
// On passe par le vrai menu pour garder le comportement exact de Steam, même après ses mises à jour.
// Menus et entrées sont retrouvés par leur texte dans la langue de Steam (clés de traduction de Steam), qui peut
// différer de la nôtre : nos libellés français ne servent qu'à l'affichage.
import { mainWindow } from './steam';

const w = window as any;

export type RootMenu = 'Steam' | 'Afficher' | 'Contacts' | 'Jeux' | 'Aide';

const ROOTS: Record<RootMenu, { title: string; token: string }> = {
	Steam: { title: 'Steam Root Menu', token: 'Menu_Steam' },
	Afficher: { title: 'View Root Menu', token: 'Menu_View' },
	Contacts: { title: 'Friends Root Menu', token: 'Menu_Friends' },
	Jeux: { title: 'Games Root Menu', token: 'Menu_Games' },
	Aide: { title: 'Help Root Menu', token: 'Menu_Help' },
};

/** Clés de traduction de Steam de chaque entrée (la première trouvée dans le menu), d'après notre libellé. */
const ITEMS: Record<string, string | string[]> = {
	'Jeux masqués': 'Menu_HiddenGames',
	'Bandes-son': 'Menu_Soundtracks',
	Téléchargements: 'Menu_Downloads',
	'Mode réduit': 'Menu_SmallMode',
	'Mode Big Picture': 'Menu_BigPictureMode',
	'Contacts et chat': 'Menu_FriendsChat',
	'Joueurs et joueuses': 'Menu_Players',
	'Serveurs de jeu': 'Menu_Servers',
	Inventaire: 'Menu_Inventory',
	Actualités: 'Menu_NewForYou',
	'Enregistrements et captures': ['Menu_Screenshots_New', 'Menu_Screenshots'],
	'Voir la liste de contacts': 'Menu_ViewFriendsList',
	'Ajouter un contact': 'Menu_AddFriend',
	'Modifier le nom de profil ou l’avatar': 'Menu_EditProfile',
	'Activer un produit sur Steam': 'Menu_ActivateRetail',
	'Activer un code de portemonnaie': 'Menu_RedeemWallet',
	'Gérer les cadeaux et invitations': 'Menu_ManageGifts',
	'Ajouter un jeu non Steam': 'Menu_AddNonSteam',
	'Support Steam': 'Menu_Support',
	'Rapport système': 'Menu_SystemReport',
	'Informations système': 'Menu_SystemInfo',
	'Politique de protection de la vie privée': 'Menu_PrivacyPolicy',
	'Mentions légales': 'Menu_LegalInfo',
	'Accord de souscription Steam': 'Menu_SSA',
	'À propos de Steam': 'Menu_About',
};

/** Espaces normalisées (Steam met des espaces insécables dans certaines traductions). */
const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();

/** Début du texte de l'entrée dans la langue de Steam (sans « … » ni compteur comme « (%1$s en ligne) »). */
function steamText(token: string, fallback: string): string {
	let s = '';
	try {
		s = String(w.LocalizationManager?.LocalizeString?.(`#${token}`) || '');
	} catch {}
	s = clean(s.split('%')[0].replace(/\(\s*$/, '').replace(/(…|\.\.\.)\s*$/, ''));
	return s || fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function menuDocument(menu: RootMenu): Document | undefined {
	const popup = [...(w.g_PopupManager?.GetPopups?.() || [])].find((p: any) => p.window?.document?.title === ROOTS[menu].title);
	return popup?.window?.document;
}

/** Ouvre le menu racine en silence, clique l'entrée `item` (notre libellé), renvoie false si introuvable. */
export async function runNativeMenuItem(menu: RootMenu, item: string): Promise<boolean> {
	const doc = mainWindow()?.document;
	const rootText = steamText(ROOTS[menu].token, menu);
	const button = [...(doc?.querySelectorAll('.RootMenuBar .RootMenuButton') || [])].find((b) => clean((b as HTMLElement).innerText) === rootText || clean(b.textContent) === rootText);
	if (!button) return false;
	const texts = [ITEMS[item] || []].flat().map((t) => steamText(t, item));
	if (!texts.length) texts.push(item);
	const before = menuDocument(menu);
	before?.documentElement.classList.add('sp-silent');
	(button.firstElementChild as HTMLElement | null)?.click();
	let target: HTMLElement | undefined;
	for (let i = 0; i < 30 && !target; i++) {
		await sleep(50);
		const pd = menuDocument(menu);
		pd?.documentElement.classList.add('sp-silent');
		target = [...(pd?.querySelectorAll('.contextMenuItem') || [])].find((e) => texts.some((t) => clean((e as HTMLElement).innerText).startsWith(t))) as HTMLElement | undefined;
	}
	if (target) target.click();
	else [...(w.g_PopupManager?.GetPopups?.() || [])].find((p: any) => p.window?.document?.title === ROOTS[menu].title)?.Hide?.();
	setTimeout(() => menuDocument(menu)?.documentElement.classList.remove('sp-silent'), 400);
	return !!target;
}

/** Actions des menus natifs regroupées pour la page Paramètres › Steam. */
export const NATIVE_GROUPS: { title: string; menu: RootMenu; items: string[] }[] = [
	{
		title: 'Affichage',
		menu: 'Afficher',
		items: ['Jeux masqués', 'Bandes-son', 'Téléchargements', 'Mode réduit', 'Mode Big Picture', 'Contacts et chat', 'Joueurs et joueuses', 'Serveurs de jeu', 'Inventaire', 'Actualités', 'Enregistrements et captures'],
	},
	{ title: 'Contacts', menu: 'Contacts', items: ['Voir la liste de contacts', 'Ajouter un contact', 'Modifier le nom de profil ou l’avatar'] },
	{ title: 'Jeux', menu: 'Jeux', items: ['Activer un produit sur Steam', 'Activer un code de portemonnaie', 'Gérer les cadeaux et invitations', 'Ajouter un jeu non Steam'] },
	{ title: 'Aide', menu: 'Aide', items: ['Support Steam', 'Rapport système', 'Informations système', 'Politique de protection de la vie privée', 'Mentions légales', 'Accord de souscription Steam', 'À propos de Steam'] },
];
