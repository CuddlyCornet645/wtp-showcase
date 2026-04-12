const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LISTEN_ON = process.env.LISTEN_ON || "0.0.0.0";
const DATA_FILE = path.join(__dirname, 'projects.json');

// ── Config ──────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-10);;

if (!process.env.ADMIN_PASSWORD) {
  console.log(`   No Admin-Password provided!`);
  console.log(`   Generated a new one: ${ADMIN_PASSWORD}`);
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
function loadProjects() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function saveProjects(projects) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
}
function isAdmin(req) { return req.session && req.session.isAdmin === true; }

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Falsches Passwort.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: isAdmin(req) });
});

// ── Projects – public ─────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  res.json(loadProjects());
});

app.post('/api/projects', (req, res) => {
  const { name, url, title } = req.body;
  if (!name || !url)
    return res.status(400).json({ error: 'Name und URL sind erforderlich.' });

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch {
    return res.status(400).json({ error: 'Ungültige URL.' });
  }
  const validHosts = ['webtigerpython.ethz.ch', 'test.webtigerpython.ethz.ch'];
  if (!validHosts.includes(parsedUrl.hostname))
    return res.status(400).json({ error: 'Nur WebTigerPython-Links sind erlaubt.' });

  const projects = loadProjects();

  // Generate unique ID with random suffix to ensure uniqueness
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const project = {
    id: `${Date.now()}-${randomSuffix}`,
    name: name.trim(),
    title: title?.trim() || `${name.trim()}s Projekt`,
    url: url.trim(),
    submittedAt: new Date().toISOString(),
  };
  projects.push(project);
  saveProjects(projects);
  res.status(201).json(project);
});

// ── Projects – admin only ─────────────────────────────────────────────────────
app.delete('/api/projects/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  let projects = loadProjects();
  const before = projects.length;
  projects = projects.filter(p => p.id !== req.params.id);
  if (projects.length === before) return res.status(404).json({ error: 'Nicht gefunden.' });
  saveProjects(projects);
  res.json({ ok: true });
});

app.patch('/api/projects/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  let projects = loadProjects();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nicht gefunden.' });
  const { name, title, url } = req.body;
  if (name !== undefined) projects[idx].name = name.trim();
  if (title !== undefined) projects[idx].title = title.trim();
  if (url !== undefined) projects[idx].url = url.trim();
  saveProjects(projects);
  res.json(projects[idx]);
});

app.post('/api/admin/reorder', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Nicht autorisiert.' });
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids muss ein Array sein.' });
  let projects = loadProjects();
  const map = Object.fromEntries(projects.map(p => [p.id, p]));
  const inList = new Set(ids);
  const reordered = ids.map(id => map[id]).filter(Boolean);
  projects.filter(p => !inList.has(p.id)).forEach(p => reordered.push(p));
  saveProjects(reordered);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, LISTEN_ON, () => {
  console.log(`\nWTP Library -> http://${LISTEN_ON}:${PORT}`);
  console.log(`Admin Panel   -> http://${LISTEN_ON}:${PORT}/admin.html`);
});
