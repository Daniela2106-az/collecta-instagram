// Renueva el token de Instagram (dura 60 días). Escribe el nuevo token en el archivo indicado.
// Uso: IG_ACCESS_TOKEN=... node scripts/refresh-token.mjs salida.txt
import fs from 'node:fs';
const { IG_ACCESS_TOKEN, GRAPH_BASE = 'https://graph.instagram.com' } = process.env;
const out = process.argv[2];
if (!IG_ACCESS_TOKEN || !out) { console.error('Uso: IG_ACCESS_TOKEN=... node scripts/refresh-token.mjs salida.txt'); process.exit(2); }
const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
url.searchParams.set('grant_type', 'ig_refresh_token');
url.searchParams.set('access_token', IG_ACCESS_TOKEN);
const res = await fetch(url);
const j = await res.json().catch(() => ({}));
if (!res.ok || !j.access_token) { console.error('No se pudo renovar:', JSON.stringify(j.error || j)); process.exit(1); }
fs.writeFileSync(out, j.access_token);
console.log(`Token renovado. Vence en ~${Math.round((j.expires_in || 0) / 86400)} días.`);
