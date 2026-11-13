// Lakaz laptop server for the band's home/away events (demo).
// The app's LIVE mode (EXPO_PUBLIC_USE_MOCK=false) reads it: REST + Socket.IO, contract section 7.
// Help alerts still go band -> Supabase; this server only adds left home / back home / SOS / OK.
// Run:  npm install   then   node server.js     (port 3000, allow Node through Windows Firewall)
const http = require('http');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const KEY = 'demo-key';                       // must match LAPTOP_KEY in the band sketch
const PERSON = { person_id: 'p-01', name: 'Marie-Claire' };

let alerts = [];                              // newest first
let nextId = 1;
const seen = new Set();                       // event_ids already handled (band retries)
let status = { status: 'HOME', person_name: PERSON.name, since: new Date().toISOString(), level: null };
const device = { device_id: 'band-01', battery_pct: null, last_seen: null, gps_fix: false };

const now = () => new Date().toISOString();
const openOf = (type) => alerts.find((a) => a.type === type && a.status !== 'Resolved');

function newAlert(type, statusText) {
  const a = {
    alert_id: `a-${String(nextId++).padStart(4, '0')}`,
    person_id: PERSON.person_id,
    device_id: device.device_id,
    type, level: 1, status: statusText,
    created_at: now(),
    acknowledged_by: null,
    last_location: null, location_fresh: false,   // no GPS on the band
    resolved_at: null,
  };
  alerts.unshift(a);
  io.emit('alert:new', a);
  return a;
}
function update(a) { io.emit('alert:update', a); }
function setStatus(text, level) {
  status = { status: text, person_name: PERSON.name, since: now(), level };
  io.emit('status:update', status);
}

function handleEvent(e) {
  device.last_seen = now();
  io.emit('device:update', device);
  if (seen.has(e.event_id)) return;            // duplicate retry: already handled
  seen.add(e.event_id);

  if (e.type === 'left_home' && !openOf('unexpected_exit')) {
    newAlert('unexpected_exit', 'Active');
    setStatus('LEFT HOME', 1);
  } else if (e.type === 'back_home') {
    const a = openOf('unexpected_exit');
    if (a) { a.status = 'Resolved'; a.resolved_at = now(); update(a); }
    setStatus('HOME', null);
  } else if (e.type === 'sos') {
    newAlert('sos', 'Critical');
  } else if (e.type === 'ok_pressed') {
    for (const a of alerts) {
      if (a.status === 'Active' || a.status === 'Critical') {
        a.status = 'Acknowledged'; a.acknowledged_by = `${PERSON.name} (band button)`; update(a);
      }
    }
  }
  if (e.type !== 'heartbeat') console.log(new Date().toLocaleTimeString(), e.type, 'signal', e.home_rssi);
}

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req, cb) {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
  req.on('end', () => { try { cb(raw ? JSON.parse(raw) : {}); } catch { cb(null); } });
}

const server = http.createServer((req, res) => {
  // The app on the web (Expo) calls from another port, so allow cross-origin requests.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (req.method === 'POST' && path === '/api/events') {
    if (req.headers['x-device-key'] !== KEY) return send(res, 401, { ok: false });
    return readJson(req, (e) => {
      if (!e || typeof e.event_id !== 'string' || typeof e.type !== 'string') return send(res, 400, { ok: false });
      handleEvent(e);
      send(res, 200, { ok: true, cmd: null });
    });
  }
  if (req.method === 'GET' && path === '/api/alerts') {
    const want = url.searchParams.get('status');
    return send(res, 200, want ? alerts.filter((a) => a.status === want) : alerts);
  }
  if (req.method === 'GET' && /^\/api\/devices\/[^/]+\/status$/.test(path)) return send(res, 200, status);
  if (req.method === 'GET' && path === '/api/devices') return send(res, 200, [device]);

  const m = path.match(/^\/api\/alerts\/([^/]+)\/(ack|resolve)$/);
  if (req.method === 'POST' && m) {
    const a = alerts.find((x) => x.alert_id === decodeURIComponent(m[1]));
    if (!a) return send(res, 404, { error: 'not_found' });
    return readJson(req, (body) => {
      if (m[2] === 'ack') {
        if (a.status !== 'Resolved') { a.status = 'Acknowledged'; a.acknowledged_by = (body && body.acknowledged_by) || 'carer'; }
      } else {
        a.status = 'Resolved'; a.resolved_at = a.resolved_at || now();
        if (a.type === 'unexpected_exit') setStatus('HOME', null);
      }
      update(a);
      send(res, 200, a);
    });
  }
  if (req.method === 'POST' && path === '/api/demo/reset') {
    alerts = []; seen.clear(); setStatus('HOME', null);
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'not_found' });
});

const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', (s) => { s.emit('status:update', status); s.emit('device:update', device); });

server.listen(PORT, () => console.log(`Lakaz laptop server on :${PORT} (app: EXPO_PUBLIC_API_URL=http://<laptop-ip>:${PORT})`));
