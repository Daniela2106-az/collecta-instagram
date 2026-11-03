// Publica en Instagram lo que esté aprobado y ya venza según schedule.json.
// Node 20+, sin dependencias. Uso:
//   node scripts/publish.mjs                 -> publica lo vencido
//   DRY_RUN=1 node scripts/publish.mjs       -> solo valida (no publica nada)
//   ONLY=P01 node scripts/publish.mjs        -> solo esa publicación (ignora la fecha)
import fs from 'node:fs';

const {
  IG_ACCESS_TOKEN,
  MEDIA_BASE_URL,                       // ej: https://raw.githubusercontent.com/USUARIO/collecta-instagram/main
  GRAPH_BASE = 'https://graph.instagram.com',
  GRAPH_VERSION = 'v23.0',
  DRY_RUN = '',
  ONLY = '',
  MAX_PER_RUN = '3',
} = process.env;

if (!IG_ACCESS_TOKEN || !MEDIA_BASE_URL) {
  console.error('Faltan IG_ACCESS_TOKEN o MEDIA_BASE_URL');
  process.exit(2);
}
const api = (p) => `${GRAPH_BASE}/${GRAPH_VERSION}/${p}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

async function call(method, path, params = {}) {
  const url = new URL(api(path));
  const opts = { method };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', IG_ACCESS_TOKEN);
  } else {
    const body = new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN });
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || { message: `HTTP ${res.status}` };
    throw new Error(`Graph API ${method} ${path}: ${e.message} (code ${e.code ?? '?'}, subcode ${e.error_subcode ?? '-'})`);
  }
  return json;
}

const imageUrl = (id, n) => `${MEDIA_BASE_URL.replace(/\/$/, '')}/media/${id}/${n}.jpg`;

async function checkImage(url) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`La imagen no es pública o no existe (${res.status}): ${url}`);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('jpeg')) throw new Error(`Instagram solo acepta JPEG; recibí "${type}": ${url}`);
}

async function waitReady(containerId) {
  for (let i = 0; i < 30; i++) {
    const r = await call('GET', containerId, { fields: 'status_code,status' });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`Contenedor ${containerId}: ${r.status_code} ${r.status || ''}`);
    await sleep(2000);
  }
  throw new Error(`Contenedor ${containerId} no terminó a tiempo`);
}

function fullCaption(p) {
  const tags = (p.hashtags || []).join(' ');
  return [p.caption, tags].filter(Boolean).join('\n\n');
}

async function publishOne(p, me) {
  const files = p.files.map((_, i) => imageUrl(p.id, i + 1));
  for (const u of files) await checkImage(u);
  if (DRY_RUN) { console.log(`[dry-run] ${p.id} (${p.type}) OK: ${files.length} imagen(es) públicas y JPEG`); return null; }

  let creation;
  if (p.type === 'post') {
    creation = (await call('POST', `${me}/media`, { image_url: files[0], caption: fullCaption(p) })).id;
  } else if (p.type === 'story') {
    creation = (await call('POST', `${me}/media`, { image_url: files[0], media_type: 'STORIES' })).id;
  } else if (p.type === 'carousel') {
    if (files.length < 2 || files.length > 20) throw new Error('Un carrusel necesita entre 2 y 20 imágenes');
    const kids = [];
    for (const u of files) {
      const k = (await call('POST', `${me}/media`, { image_url: u, is_carousel_item: 'true' })).id;
      await waitReady(k); kids.push(k);
    }
    creation = (await call('POST', `${me}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: fullCaption(p) })).id;
  } else throw new Error(`Tipo desconocido: ${p.type}`);

  await waitReady(creation);
  const pub = await call('POST', `${me}/media_publish`, { creation_id: creation });
  let permalink = '';
  try { permalink = (await call('GET', pub.id, { fields: 'permalink' })).permalink || ''; } catch {}
  return { mediaId: pub.id, permalink, publishedAt: new Date().toISOString() };
}

const schedule = readJson('schedule.json', []);
const stateFile = 'state/published.json';
const state = readJson(stateFile, {});
const now = new Date();

let due = schedule.filter((p) => {
  if (state[p.id]) return false;                       // ya publicada
  if (ONLY) return p.id === ONLY;                      // forzada a mano
  return p.status === 'approved' && new Date(p.when) <= now;
});
if (ONLY && due.length && due[0].status !== 'approved') {
  console.error(`${ONLY} no está "approved" (está "${due[0].status}"). No se publica.`); process.exit(3);
}
due.sort((a, b) => new Date(a.when) - new Date(b.when));
due = due.slice(0, Number(MAX_PER_RUN));

if (!due.length) { console.log('Nada para publicar ahora.'); process.exit(0); }

const me = (await call('GET', 'me', { fields: 'user_id,username' }));
console.log(`Cuenta: @${me.username} (${me.user_id})`);

let failed = 0;
for (const p of due) {
  try {
    console.log(`Publicando ${p.id} · ${p.title}…`);
    const r = await publishOne(p, me.user_id || 'me');
    if (r) {
      state[p.id] = r;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
      console.log(`  ✔ ${p.id} publicada ${r.permalink}`);
    }
  } catch (e) {
    failed++;
    console.error(`  ✘ ${p.id}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
