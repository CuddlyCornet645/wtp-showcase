const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LISTEN_ON = process.env.LISTEN_ON || "0.0.0.0";
const DATA_FILE = path.join(__dirname, 'projects.json');

// ── Config ──────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-10);
const TURNSTILE_SITE_KEY = process.env.SITE_KEY || null;
const TURNSTILE_SECRET_KEY = process.env.SECRET_KEY || null;

if (!process.env.ADMIN_PASSWORD) {
  console.log(`\n   No Admin-Password provided!`);
  console.log(`   Generated a new one: ${ADMIN_PASSWORD}`);
}
if (!TURNSTILE_SITE_KEY || !TURNSTILE_SECRET_KEY) {
  console.log(`   ⚠ Turnstile disabled (SITE_KEY/SECRET_KEY not set)`);
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'wtp-showcase-secret-8f3k2',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { autoStart: true, projects: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(raw)) return { autoStart: true, projects: raw };
    return {
      autoStart: raw.autoStart !== undefined ? !!raw.autoStart : true,
      projects: Array.isArray(raw.projects) ? raw.projects : []
    };
  } catch { return { autoStart: true, projects: [] }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isAdmin(req) { return req.session && req.session.isAdmin === true; }

async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token })
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ hasTurnstile: !!TURNSTILE_SITE_KEY, siteKey: TURNSTILE_SITE_KEY || '' });
});

app.post('/api/admin/login', async (req, res) => {
  const { password, token } = req.body;
  if (TURNSTILE_SECRET_KEY) {
    const isValid = await verifyTurnstile(token);
    if (!isValid) return res.status(400).json({ error: 'Captcha verification failed.' });
  }
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Falsches Passwort.' });
  }
});

app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });
app.get('/api/admin/check', (req, res) => { res.json({ isAdmin: isAdmin(req) }); });

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const data = loadData();
  res.json({ autoStart: data.autoStart });
});

app.patch('/api/settings', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const { autoStart } = req.body;
  if (typeof autoStart !== 'boolean') return res.status(400).json({ error: 'autoStart muss ein Boolean sein.' });
  const data = loadData();
  data.autoStart = autoStart;
  saveData(data);
  res.json({ ok: true, autoStart: data.autoStart });
});

// ── Projects – public ─────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  const data = loadData();
  res.json(data.projects.filter(p => !p.hidden));
});

app.post('/api/projects', async (req, res) => {
  const { name, url, title, token } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name und URL sind erforderlich.' });
  if (TURNSTILE_SECRET_KEY) {
    const isValid = await verifyTurnstile(token);
    if (!isValid) return res.status(400).json({ error: 'Captcha verification failed.' });
  }
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Ungültige URL.' }); }
  const validHosts = ['webtigerpython.ethz.ch', 'test.webtigerpython.ethz.ch'];
  if (!validHosts.includes(parsedUrl.hostname))
    return res.status(400).json({ error: 'Nur WebTigerPython-Links sind erlaubt.' });
  const data = loadData();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const project = {
    id: `${Date.now()}-${randomSuffix}`,
    name: name.trim(),
    title: title?.trim() || `${name.trim()}s Projekt`,
    url: url.trim(),
    submittedAt: new Date().toISOString(),
    hidden: false,
  };
  data.projects.push(project);
  saveData(data);
  res.status(201).json(project);
});

// ── Projects – admin only ─────────────────────────────────────────────────────
app.get('/api/admin/projects', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const data = loadData();
  res.json(data.projects);
});

app.delete('/api/projects/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const data = loadData();
  const before = data.projects.length;
  data.projects = data.projects.filter(p => p.id !== req.params.id);
  if (data.projects.length === before) return res.status(404).json({ error: 'Nicht gefunden.' });
  saveData(data);
  res.json({ ok: true });
});

app.patch('/api/projects/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const data = loadData();
  const idx = data.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nicht gefunden.' });
  const { name, title, url, hidden } = req.body;
  if (name !== undefined) data.projects[idx].name = name.trim();
  if (title !== undefined) data.projects[idx].title = title.trim();
  if (url !== undefined) data.projects[idx].url = url.trim();
  if (hidden !== undefined) data.projects[idx].hidden = !!hidden;
  saveData(data);
  res.json(data.projects[idx]);
});

app.post('/api/admin/reorder', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids muss ein Array sein.' });
  const data = loadData();
  const map = Object.fromEntries(data.projects.map(p => [p.id, p]));
  const inList = new Set(ids);
  const reordered = ids.map(id => map[id]).filter(Boolean);
  data.projects.filter(p => !inList.has(p.id)).forEach(p => reordered.push(p));
  data.projects = reordered;
  saveData(data);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, LISTEN_ON, () => {
  console.log(`\nWTP Library -> http://${LISTEN_ON}:${PORT}`);
  console.log(`Admin Panel   -> http://${LISTEN_ON}:${PORT}/admin.html`);
});
