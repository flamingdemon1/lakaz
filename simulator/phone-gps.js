// Phone GPS stand-in for the demo (the band has no GPS; disclosed to judges).
// GPS phone (iPhone): opens https://<tunnel>/phone?key=<PHONE_KEY> and taps Start -> sends its position every 5 s.
// iPhones only share location with https pages, hence the Cloudflare tunnel in front of this server.
// Carer app: reads the latest position from GET /api/phone-location (src/data/tracking.tsx).
// Run on the laptop: node phone-gps.js   (no packages needed; allow Node through Windows Firewall)
const http = require('http');

const PORT = Number(process.env.PORT) || 3000;
// Only the phone opened with ?key=<PHONE_KEY> can send positions; anyone can read the latest one.
const PHONE_KEY = process.env.PHONE_KEY;
if (!PHONE_KEY || PHONE_KEY.length < 8) {
  console.error('Set PHONE_KEY (8+ characters) first, e.g. PowerShell:  $env:PHONE_KEY="pick-a-long-secret"; node phone-gps.js');
  process.exit(1);
}
let last = null; // { lat, lng, at }

// Reading the position needs a signed-in Lakaz carer: Supabase must accept the app's access token.
// Public project values (the same ones the app ships with); override with env vars if the project changes.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vzujmdgfybhjytppcmcc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_mzSQT1alDmGT9_OiyQILQA_NE7YXvvV'; // full publishable key (same as mobile/src/config.ts); the cut-short one made every login check return 401
const okTokens = new Map(); // token -> time it was confirmed (cached 60 s to avoid a Supabase call every 5 s)
async function isSignedInCarer(authHeader) {
  const token = /^Bearer (.+)$/.exec(authHeader || '')?.[1];
  if (!token) return false;
  const seen = okTokens.get(token);
  if (seen && Date.now() - seen < 60000) return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return false;
    okTokens.set(token, Date.now());
    return true;
  } catch { return false; }
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>LAKAZ phone GPS</title>
<style>body{font-family:sans-serif;margin:24px;font-size:18px}button{font-size:20px;padding:14px 20px}</style>
</head><body>
<h2>LAKAZ: phone GPS stand-in</h2>
<p>Carry this phone with the band. Keep this page open and the screen on.</p>
<button id="go">Start sharing location</button>
<p id="state">Not sharing yet.</p>
<script>
const state = document.getElementById('state');
const key = new URLSearchParams(location.search).get('key') || '';
function send(c) {
  fetch('/api/phone-location', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-phone-key': key, 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({ lat: c.latitude, lng: c.longitude }) })
    .then(r => { state.textContent = (r.ok ? 'Sent ' : r.status === 401 ? 'Wrong or missing ?key= in the link. ' : 'Failed ') + new Date().toLocaleTimeString() + ' (' + c.latitude.toFixed(5) + ', ' + c.longitude.toFixed(5) + ')'; })
    .catch(() => { state.textContent = 'Laptop not reachable'; });
}
document.getElementById('go').onclick = () => {
  if (!window.isSecureContext || !navigator.geolocation) {
    state.textContent = 'This browser blocks location on plain http. Open the https:// tunnel link instead.';
    return;
  }
  let lastSent = 0;
  navigator.geolocation.watchPosition(p => {
    if (Date.now() - lastSent < 5000) return;
    lastSent = Date.now();
    send(p.coords);
  }, e => { state.textContent = 'Location error: ' + e.message; }, { enableHighAccuracy: true });
  state.textContent = 'Waiting for GPS...';
};
</script></body></html>`;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');           // the app (web or APK) reads from another origin
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-phone-key, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url.split('?')[0] === '/phone') {
    res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE);
  }
  if (req.url === '/api/phone-location' && req.method === 'POST') {
    if (req.headers['x-phone-key'] !== PHONE_KEY) { res.writeHead(401); return res.end(); }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 512) req.destroy(); });
    req.on('end', () => {
      let p;
      try { p = JSON.parse(raw); } catch { p = null; }
      const ok = p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
      if (!ok) { res.writeHead(400); return res.end(); }
      last = { lat: p.lat, lng: p.lng, at: new Date().toISOString() };
      console.log(new Date().toLocaleTimeString(), 'phone at', p.lat.toFixed(5), p.lng.toFixed(5));
      res.writeHead(204); res.end();
    });
    return;
  }
  if (req.url === '/api/phone-location' && req.method === 'GET') {
    isSignedInCarer(req.headers.authorization).then((ok) => {
      if (!ok) { res.writeHead(401); return res.end(); }
      if (!last) { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(last));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`Phone GPS stand-in on :${PORT}  GPS phone: http://<laptop-ip>:${PORT}/phone`));
