// ═══════════════════════════════════════════════════════════════════════
// MAIN: Dashboard (index.html)
// ═══════════════════════════════════════════════════════════════════════

import { esc, decodeWTPCode } from './utils.js';
import { WTPRunner } from './wtp-runner.js';
import { fetchConfig, fetchSettings, fetchProjects, submitProject } from './api.js';

let projects = [];
const runners = new Map(); // id -> WTPRunner instance
const output = new Map();  // id -> { text, isError }
let autoStart = true;
let turnstileConfig = { hasTurnstile: false, siteKey: '' };
let submitTurnstileId = null;

// ═══════════════════════════════════════════════════════════════════════
// Load and render projects
// ═══════════════════════════════════════════════════════════════════════

export async function loadProjects() {
  projects = await fetchProjects();
  const count = document.getElementById('count');
  if (count) count.textContent = projects.length;
  renderGrid();
  if (autoStart) {
    autoStartProjects();
  }
  updateProgress();
}

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;

  if (!projects.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emo">📭</div>
        <h3>Noch keine Projekte</h3>
        <p>Klicke auf "Einreichen" um dein Projekt hinzuzufügen</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(p => cardHTML(p)).join('');
}

function cardHTML(p) {
  const showStartBtn = !autoStart;
  return `
    <div class="card" id="card-${p.id}">
      <div class="card-head">
        <div>
          <div class="proj-title"><span class="dot" id="dot-${p.id}"></span> ${esc(p.title || '{null}')}</div>
          <div class="student">${esc(p.name)}</div>
        </div>
      </div>
      <div class="wtp-wrap" id="wrap-${p.id}">
        <div class="wtp-loading" id="ld-${p.id}">
          <div class="spinner"></div>
          <div id="ld-txt-${p.id}">Lädt…</div>
        </div>
        ${showStartBtn ? `
        <div class="manual-start" id="ms-${p.id}">
          <button class="start-btn" onclick="startProject('${p.id}','${esc(p.url)}')">▶ Starten</button>
        </div>` : ''}
      </div>
      <div class="status-line" id="sl-${p.id}"></div>
      <div class="console-out empty" id="co-${p.id}">Wartet auf Ausführung…</div>
      <div class="card-foot">
        <button class="restart-btn" onclick="restartProject('${p.id}','${esc(p.url)}')">↺ Neu starten</button>
        <a class="open-link" href="${esc(p.url)}" target="_blank" rel="noopener">↗ In WTP öffnen</a>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// Start projects automatically
// ═══════════════════════════════════════════════════════════════════════

function autoStartProjects() {
  projects.forEach(p => startProject(p.id, p.url));
}

export function startProject(id, url) {
  // Hide manual-start overlay if present
  const ms = document.getElementById(`ms-${id}`);
  if (ms) ms.style.display = 'none';

  if (!output.has(id)) {
    output.set(id, { text: '', isError: false });
  } else {
    // Reset output on restart
    const o = output.get(id);
    o.text = '';
    o.isError = false;
  }

  // Clean up old runner
  if (runners.has(id)) {
    runners.get(id).destroy();
    runners.delete(id);
  }

  // Show loading
  const ld = document.getElementById(`ld-${id}`);
  if (ld) ld.classList.remove('hidden');

  // Extract files
  const files = decodeWTPCode(url);
  if (!files) {
    const co = document.getElementById(`co-${id}`);
    if (co) {
      co.textContent = '✗ Fehler: Code konnte nicht dekodiert werden';
      co.className = 'console-out is-err';
    }
    if (ld) ld.classList.add('hidden');
    updateDot(id, 'error');
    return;
  }

  // Create iframe
  const wrap = document.getElementById(`wrap-${id}`);
  if (!wrap) return;

  // Remove old iframe if exists
  const oldFrame = document.getElementById(`fr-${id}`);
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = `fr-${id}`;
  iframe.allow = 'usb;clipboard-write';
  iframe.style.display = 'block';
  wrap.appendChild(iframe);

  // Create runner
  const runner = new WTPRunner(iframe);

  runner
    .on('ready', () => {
      setLoadText(id, 'Sendet Code…');
      runner.sendCode(files);
      setTimeout(() => {
        setLoadText(id, 'Führt aus…');
        updateDot(id, 'running');
        hideLoading(id);
      }, 400);
    })
    .on('output', (text) => {
      const o = output.get(id);
      o.text += text;
      updateConsole(id);
    })
    .on('error', (text) => {
      const o = output.get(id);
      o.isError = true;
      o.text += text;
      updateConsole(id);
    })
    .on('complete', (text) => {
      const o = output.get(id);
      o.text = text;
      updateConsole(id);
      updateDot(id, o.isError ? 'error' : 'done');
      updateProgress();
    });

  runner.load();
  runners.set(id, runner);
  updateDot(id, 'running');
}

export function restartProject(id, url) {
  startProject(id, url);
}

// ═══════════════════════════════════════════════════════════════════════
// UI updates
// ═══════════════════════════════════════════════════════════════════════

function hideLoading(id) {
  const ld = document.getElementById(`ld-${id}`);
  if (ld) ld.classList.add('hidden');
}

function setLoadText(id, txt) {
  const el = document.getElementById(`ld-txt-${id}`);
  if (el) el.textContent = txt;
}

function updateDot(id, status) {
  const dot = document.getElementById(`dot-${id}`);
  if (!dot) return;
  dot.className = 'dot';
  if (status === 'running') dot.classList.add('running');
  else if (status === 'done') dot.classList.add('done');
  else if (status === 'error') dot.classList.add('error');
}

function updateConsole(id) {
  const co = document.getElementById(`co-${id}`);
  if (!co) return;
  const o = output.get(id);
  const text = (o.text || '').trim();
  if (!text) {
    co.textContent = '(keine Ausgabe)';
    co.className = 'console-out empty';
    return;
  }
  co.textContent = text.slice(-500);
  co.className = 'console-out' + (o.isError ? ' is-err' : '');
  co.scrollTop = co.scrollHeight;
}

function updateProgress() {
  const done = projects.length > 0
    ? projects.filter(p => {
      const o = output.get(p.id);
      return o && (o.isError || o.text.length > 0);
    }).length
    : 0;
  const el = document.getElementById('progress-text');
  if (el) {
    el.textContent = projects.length > 0 ? `(${done}/${projects.length} ausgeführt)` : '';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Modal
// ═══════════════════════════════════════════════════════════════════════

export function openModal() {
  document.getElementById('overlay').classList.add('open');
  if (turnstileConfig.hasTurnstile && window.turnstile && !submitTurnstileId) {
    submitTurnstileId = window.turnstile.render('#submit-turnstile', {
      sitekey: turnstileConfig.siteKey,
      theme: 'light'
    });
  }
}

export function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  setFb('', null);
  if (turnstileConfig.hasTurnstile && window.turnstile && submitTurnstileId) {
    window.turnstile.reset(submitTurnstileId);
  }
}

export function bgClose(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function setFb(msg, isErr) {
  const el = document.getElementById('m-fb');
  if (el) {
    el.textContent = msg;
    el.className = 'fb' + (isErr ? ' err' : isErr === false ? ' ok' : '');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Submit
// ═══════════════════════════════════════════════════════════════════════

export async function doSubmit() {
  const name = document.getElementById('m-name').value.trim();
  const title = document.getElementById('m-title').value.trim();
  const url = document.getElementById('m-url').value.trim();

  if (!name || !url) {
    setFb('Name und URL sind erforderlich.', true);
    return;
  }

  let token = '';
  if (turnstileConfig.hasTurnstile && window.turnstile) {
    token = window.turnstile.getResponse(submitTurnstileId);
    if (!token) {
      setFb('Bitte führe die Captcha-Verifizierung durch', true);
      return;
    }
  }

  const { ok, data } = await submitProject(name, title, url, token);
  if (!ok) {
    setFb(data.error || 'Fehler beim Einreichen', true);
    if (turnstileConfig.hasTurnstile && window.turnstile && submitTurnstileId) {
      window.turnstile.reset(submitTurnstileId);
    }
    return;
  }

  setFb(`✓ Projekt von ${data.name} hinzugefügt!`, false);
  document.getElementById('m-name').value = '';
  document.getElementById('m-title').value = '';
  document.getElementById('m-url').value = '';

  setTimeout(() => {
    loadProjects();
    closeModal();
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════════════
// Expose to window
// ═══════════════════════════════════════════════════════════════════════

window.loadProjects = loadProjects;
window.startProject = startProject;
window.restartProject = restartProject;
window.openModal = openModal;
window.closeModal = closeModal;
window.bgClose = bgClose;
window.doSubmit = doSubmit;

// Auto-load on page load
window.addEventListener('DOMContentLoaded', async () => {
  [turnstileConfig] = await Promise.all([fetchConfig()]);
  const settings = await fetchSettings();
  autoStart = settings.autoStart !== false;
  loadProjects();
});
