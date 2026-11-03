// Lecture des vidéos du magasin (bandes-annonces) : Steam ne les fournit qu'en DASH (manifeste .mpd, segments
// de quelques secondes, vidéo et audio séparés). Petit lecteur sans bibliothèque : Media Source Extensions,
// segments chargés à la suite. Le serveur vidéo de Steam autorise les requêtes depuis l'interface (CORS ouvert).

type Rep = { id: string; codecs: string; mime: string; bandwidth: number; height: number; init: string; media: string; start: number; segSec: number };

/** « PT1M22.5S » -> 82,5 secondes. */
function isoSeconds(s: string): number {
	const m = /PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(s || '');
	return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

function readReps(doc: Document, type: string): Rep[] {
	const out: Rep[] = [];
	for (const set of Array.from(doc.getElementsByTagName('AdaptationSet'))) {
		if (set.getAttribute('contentType') !== type) continue;
		const setTpl = set.getElementsByTagName('SegmentTemplate')[0];
		for (const rep of Array.from(set.getElementsByTagName('Representation'))) {
			const tpl = rep.getElementsByTagName('SegmentTemplate')[0] || setTpl;
			if (!tpl) continue;
			const timescale = Number(tpl.getAttribute('timescale') || 1);
			out.push({
				id: rep.getAttribute('id') || '',
				codecs: rep.getAttribute('codecs') || '',
				mime: rep.getAttribute('mimeType') || set.getAttribute('mimeType') || `${type}/mp4`,
				bandwidth: Number(rep.getAttribute('bandwidth') || 0),
				height: Number(rep.getAttribute('height') || 0),
				init: tpl.getAttribute('initialization') || '',
				media: tpl.getAttribute('media') || '',
				start: Number(tpl.getAttribute('startNumber') || 1),
				segSec: Number(tpl.getAttribute('duration') || 0) / timescale,
			});
		}
	}
	return out;
}

function fill(tpl: string, rep: Rep, n?: number): string {
	return tpl.replace(/\$RepresentationID\$/g, rep.id).replace(/\$Number(?:%0(\d+)d)?\$/g, (_m, pad) => (n === undefined ? '' : String(n).padStart(Number(pad || 0), '0')));
}

function appendTo(sb: SourceBuffer, data: ArrayBuffer): Promise<void> {
	return new Promise((ok, ko) => {
		const done = () => {
			sb.removeEventListener('updateend', done);
			sb.removeEventListener('error', fail);
			ok();
		};
		const fail = () => {
			sb.removeEventListener('updateend', done);
			sb.removeEventListener('error', fail);
			ko(new Error('segment refusé'));
		};
		sb.addEventListener('updateend', done);
		sb.addEventListener('error', fail);
		sb.appendBuffer(data);
	});
}

/**
 * Lit la vidéo DASH `mpd` dans `video` (720p au plus : net sur une télévision, sans charger trop de mémoire).
 * Renvoie la fonction d'arrêt. `onError` est appelé si la lecture est impossible.
 */
export function playDash(video: HTMLVideoElement, mpd: string, onError: () => void): () => void {
	const ctrl = new AbortController();
	const win = (video.ownerDocument.defaultView || window) as any;
	const MS = win.MediaSource;
	let url = '';
	const stop = () => {
		ctrl.abort();
		try {
			video.pause();
			video.removeAttribute('src');
			video.load();
		} catch {}
		if (url) win.URL.revokeObjectURL(url);
	};
	if (!MS) {
		onError();
		return stop;
	}
	(async () => {
		const text = await (await fetch(mpd, { signal: ctrl.signal })).text();
		const doc = new win.DOMParser().parseFromString(text, 'application/xml') as Document;
		const duration = isoSeconds(doc.documentElement.getAttribute('mediaPresentationDuration') || '');
		const videos = readReps(doc, 'video').filter((r) => MS.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`));
		const audio = readReps(doc, 'audio').filter((r) => MS.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`))[0];
		const pick = videos.filter((r) => r.height <= 720).sort((a, b) => b.bandwidth - a.bandwidth)[0] || videos.sort((a, b) => a.bandwidth - b.bandwidth)[0];
		if (!pick || !duration) throw new Error('vidéo illisible');
		const base = mpd.slice(0, mpd.lastIndexOf('/') + 1);
		const query = mpd.includes('?') ? mpd.slice(mpd.indexOf('?')) : '';
		const get = async (path: string) => (await fetch(base + path + query, { signal: ctrl.signal })).arrayBuffer();

		const ms = new MS();
		url = win.URL.createObjectURL(ms);
		video.src = url;
		await new Promise((ok) => ms.addEventListener('sourceopen', ok, { once: true }));
		ms.duration = duration;

		// toutes les sources sont créées avant le premier segment (exigence de Media Source Extensions)
		const tracks: [Rep, SourceBuffer][] = [pick, audio].filter(Boolean).map((rep) => [rep!, ms.addSourceBuffer(`${rep!.mime}; codecs="${rep!.codecs}"`)]);
		const feed = async ([rep, sb]: [Rep, SourceBuffer]) => {
			await appendTo(sb, await get(fill(rep.init, rep)));
			const count = Math.ceil(duration / (rep.segSec || duration));
			for (let i = 0; i < count && !ctrl.signal.aborted; i++) {
				await appendTo(sb, await get(fill(rep.media, rep, rep.start + i)));
				// deux segments d'avance (environ 6 s) : la lecture peut commencer sans s'arrêter aussitôt
				if ((i === 1 || count === 1) && rep === pick) video.play().catch(() => {});
			}
		};
		await Promise.all(tracks.map(feed));
		if (!ctrl.signal.aborted && ms.readyState === 'open') ms.endOfStream();
	})().catch((e) => {
		if (!ctrl.signal.aborted) {
			console.error('[steam-upgraded] vidéo du magasin', e);
			onError();
		}
	});
	return stop;
}
