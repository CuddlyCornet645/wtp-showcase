// ═══════════════════════════════════════════════════════════════════════
// ADMIN: Admin panel (admin.html)
// ═══════════════════════════════════════════════════════════════════════

import { esc, decodeWTPCode } from './utils.js';
import { WTPRunner } from './wtp-runner.js';
import {
  fetchConfig,
  fetchSettings,
  updateSettings,
  fetchAllProjects,
  submitProject,
  deleteProject,
  updateProject,
  adminCheck,
  adminLogin,
  adminLogout
} from './api.js';

let allProjects = [];
let prevRunner = null;
let prevUrl = '';
let prevOutput = { text: '', isError: false };
let turnstileConfig = { hasTurnstile: false, siteKey: '' };
let loginTurnstileId = null;
let addTurnstileId = null;
let currentAutoStart = true;

// ═══════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════

export async function doLogin() {
  const pw = document.getElementById('a-pw').value;
  const err = document.getElementById('login-err');

  if (!pw) { err.textContent = 'Passwort erforderlich'; return; }

  let token = '';
  if (turnstileConfig.hasTurnstile && window.turnstile) {
    token = window.turnstile.getResponse(loginTurnstileId);
    if (!token) { err.textContent = 'Bitte führe die Captcha-Verifizierung durch'; return; }
  }

  const ok = await adminLogin(pw, token);
  if (ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    loadProjects();
  } else {
    err.textContent = 'Falsches Passwort';
    if (turnstileConfig.hasTurnstile && window.turnstile && loginTurnstileId) {
      window.turnstile.reset(loginTurnstileId);
    }
  }
  document.getElementById('a-pw').value = '';
}

export async function doLogout() {
  await adminLogout();
  location.href = '/';
}

// ═══════════════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════════════

async function loadSettings() {
  const settings = await fetchSettings();
  currentAutoStart = settings.autoStart !== false;
  renderAutoStartToggle();
}

function renderAutoStartToggle() {
  const toggle = document.getElementById('autostart-toggle');
  if (!toggle) return;
  toggle.checked = currentAutoStart;
  const label = document.getElementById('autostart-label');
  if (label) {
    label.textContent = currentAutoStart
      ? 'Projekte starten automatisch'
      : 'Projekte müssen manuell gestartet werden';
  }
}

export async function toggleAutoStart() {
  const toggle = document.getElementById('autostart-toggle');
  if (!toggle) return;
  const newVal = toggle.checked;
  const { ok } = await updateSettings({ autoStart: newVal });
  if (ok) {
    currentAutoStart = newVal;
    renderAutoStartToggle();
  } else {
    // Revert on error
    toggle.checked = currentAutoStart;
    alert('Fehler beim Speichern der Einstellung');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Projects
// ═══════════════════════════════════════════════════════════════════════

export async function loadProjects() {
  allProjects = await fetchAllProjects();
  renderList();
}

function renderList() {
  const today = new Date().toDateString();
  document.getElementById('s-total').textContent = allProjects.length;
  document.getElementById('s-today').textContent = allProjects.filter(
    p => new Date(p.submittedAt).toDateString() === today
  ).length;
  document.getElementById('s-hidden').textContent = allProjects.filter(p => p.hidden).length;

  const list = document.getElementById('proj-list');
  if (!allProjects.length) {
    list.innerHTML = '<div class="empty">Noch keine Projekte.</div>';
    return;
  }

  list.innerHTML = allProjects.map((p, i) => {
    const d = new Date(p.submittedAt).toLocaleDateString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const hiddenClass = p.hidden ? ' proj-item--hidden' : '';
    const hiddenIcon = p.hidden ? '🚫' : '👁';
    const hiddenTitle = p.hidden ? 'Einblenden' : 'Verstecken';
    return `
      <div class="proj-item${hiddenClass}" id="pi-${p.id}">
        <div class="proj-row">
          <div class="proj-meta">
            <div class="proj-name">
              <span class="proj-num">#${i + 1}</span>
              ${p.hidden ? '<span class="hidden-badge">VERSTECKT</span>' : ''}
              ${esc(p.name)}
            </div>
            <div class="proj-sub">${esc(p.title)} · ${d}</div>
          </div>
          <div class="proj-btns">
            <button class="btn btn-sm btn-b" onclick="openPrev('${p.id}')" title="Vorschau">👁</button>
            <button class="btn btn-sm ${p.hidden ? 'btn-y' : ''}" onclick="toggleHidden('${p.id}')" title="${hiddenTitle}">${hiddenIcon}</button>
            <button class="btn btn-sm" onclick="toggleEdit('${p.id}')" title="Bearbeiten">✏</button>
            <button class="btn btn-sm btn-r" onclick="delProject('${p.id}','${esc(p.name)}')" title="Löschen">🗑</button>
          </div>
        </div>
        <div class="edit-panel" id="ep-${p.id}">
          <div class="edit-grid">
            <div class="field"><label>NAME</label><input id="en-${p.id}" value="${esc(p.name)}" maxlength="40" /></div>
            <div class="field"><label>TITEL</label><input id="et-${p.id}" value="${esc(p.title)}" maxlength="60" /></div>
            <div class="field url-field"><label>URL</label><input id="eu-${p.id}" value="${esc(p.url)}" /></div>
          </div>
          <div class="edit-act">
            <button class="btn btn-y btn-sm" onclick="saveEdit('${p.id}')">✓ Speichern</button>
            <button class="btn btn-sm" onclick="toggleEdit('${p.id}')">Abbrechen</button>
          </div>
          <div class="edit-fb fb" id="ef-${p.id}"></div>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleEdit(id) {
  document.getElementById(`ep-${id}`).classList.toggle('open');
}

export async function saveEdit(id) {
  const name = document.getElementById(`en-${id}`).value.trim();
  const title = document.getElementById(`et-${id}`).value.trim();
  const url = document.getElementById(`eu-${id}`).value.trim();
  const fb = document.getElementById(`ef-${id}`);
  fb.textContent = '';

  const { ok, data } = await updateProject(id, name, title, url);
  if (!ok) {
    fb.textContent = data.error;
    fb.className = 'edit-fb fb err';
    return;
  }
  fb.textContent = '✓ Gespeichert';
  fb.className = 'edit-fb fb ok';
  setTimeout(loadProjects, 800);
}

export async function toggleHidden(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  const newHidden = !p.hidden;
  const { ok, data } = await updateProject(id, undefined, undefined, undefined, newHidden);
  if (ok) {
    loadProjects();
  } else {
    alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
  }
}

export async function delProject(id, name) {
  if (!confirm(`Projekt von „${name}" wirklich löschen?`)) return;
  const ok = await deleteProject(id);
  if (ok) loadProjects();
  else alert('Fehler beim Löschen');
}

export async function deleteAll() {
  if (!allProjects.length) return;
  if (!confirm(`Alle ${allProjects.length} Projekte löschen?`)) return;
  if (!confirm('Wirklich? Diese Aktion ist nicht rückgängig zu machen!')) return;
  for (const p of allProjects) {
    await deleteProject(p.id);
  }
  loadProjects();
}

// ═══════════════════════════════════════════════════════════════════════
// Add Project
// ═══════════════════════════════════════════════════════════════════════

export function checkUrl() {
  const url = document.getElementById('a-url').value.trim();
  const hint = document.getElementById('url-hint');
  if (!url) { hint.textContent = ''; hint.className = 'url-hint'; return; }
  if (url.includes('webtigerpython.ethz.ch') && url.includes('code=')) {
    hint.textContent = '✓ Gültiger WTP-Link mit Code';
    hint.className = 'url-hint ok';
  } else if (url.includes('webtigerpython.ethz.ch')) {
    hint.textContent = '⚠ WTP-Link ohne Code-Parameter';
    hint.className = 'url-hint bad';
  } else {
    hint.textContent = '✗ Kein WTP-Link';
    hint.className = 'url-hint bad';
  }
}

export async function doAdd() {
  const name = document.getElementById('a-name').value.trim();
  const title = document.getElementById('a-title').value.trim();
  const url = document.getElementById('a-url').value.trim();
  const fb = document.getElementById('a-fb');
  fb.textContent = '';
  fb.className = 'fb';

  if (!name || !url) {
    fb.textContent = 'Name und URL sind erforderlich.';
    fb.className = 'fb err';
    return;
  }

  let token = '';
  if (turnstileConfig.hasTurnstile && window.turnstile) {
    token = window.turnstile.getResponse(addTurnstileId);
    if (!token) {
      fb.textContent = 'Bitte führe die Captcha-Verifizierung durch';
      fb.className = 'fb err';
      return;
    }
  }

  const { ok, data } = await submitProject(name, title, url, token);
  if (!ok) {
    fb.textContent = data.error;
    fb.className = 'fb err';
    if (turnstileConfig.hasTurnstile && window.turnstile && addTurnstileId) {
      window.turnstile.reset(addTurnstileId);
    }
    return;
  }

  fb.textContent = `✓ Projekt von ${data.name} hinzugefügt!`;
  fb.className = 'fb ok';
  document.getElementById('a-name').value = '';
  document.getElementById('a-title').value = '';
  document.getElementById('a-url').value = '';
  document.getElementById('url-hint').textContent = '';
  if (turnstileConfig.hasTurnstile && window.turnstile && addTurnstileId) {
    window.turnstile.reset(addTurnstileId);
  }
  loadProjects();
}

export function prevFromInput() {
  const url = document.getElementById('a-url').value.trim();
  const name = document.getElementById('a-name').value.trim() || 'Vorschau';
  if (!url) return;
  openPrevWithUrl(url, name);
}

// ═══════════════════════════════════════════════════════════════════════
// Preview Modal
// ═══════════════════════════════════════════════════════════════════════

export function openPrev(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  openPrevWithUrl(p.url, p.name);
}

export function openPrevWithUrl(url, name) {
  prevUrl = url;
  prevOutput = { text: '', isError: false };

  document.getElementById('prev-title').textContent = name ? `Vorschau: ${name}` : 'Vorschau';
  document.getElementById('prev-status').textContent = 'Lädt…';
  document.getElementById('prev-co').textContent = 'Keine Ausgabe';
  document.getElementById('prev-co').className = 'prev-console empty';
  document.getElementById('prev-ov').classList.add('open');

  startPrevFrame();
}

function startPrevFrame() {
  if (prevRunner) prevRunner.destroy();

  const frame = document.getElementById('prev-frame');
  const ld = document.getElementById('prev-ld');
  const ldtxt = document.getElementById('prev-ld-txt');

  ld.classList.remove('hidden');
  ldtxt.textContent = 'Lädt WebTigerPython…';
  prevOutput = { text: '', isError: false };

  const files = decodeWTPCode(prevUrl);
  if (!files) {
    ldtxt.textContent = 'Fehler: Code konnte nicht dekodiert werden';
    document.getElementById('prev-status').textContent = '✗ Fehler';
    ld.classList.add('hidden');
    prevOutput.text = '(Code konnte nicht dekodiert werden)';
    updatePrevConsole();
    return;
  }

  prevRunner = new WTPRunner(frame);
  prevRunner
    .on('ready', () => {
      ldtxt.textContent = 'Sendet Code…';
      prevRunner.sendCode(files);
      setTimeout(() => {
        document.getElementById('prev-status').textContent = 'Wird ausgeführt…';
        ldtxt.textContent = 'Führt aus…';
        ld.classList.add('hidden');
      }, 400);
    })
    .on('output', (text) => { prevOutput.text += text; updatePrevConsole(); })
    .on('error', (text) => { prevOutput.isError = true; prevOutput.text += text; updatePrevConsole(); })
    .on('complete', (text) => {
      prevOutput.text = text;
      document.getElementById('prev-status').textContent = prevOutput.isError ? '✗ Fehler' : '✓ Abgeschlossen';
      updatePrevConsole();
    });

  prevRunner.load();
}

export function prevRun() {
  document.getElementById('prev-co').textContent = 'Keine Ausgabe';
  document.getElementById('prev-co').className = 'prev-console empty';
  startPrevFrame();
}

function updatePrevConsole() {
  const co = document.getElementById('prev-co');
  const text = (prevOutput.text || '').trim();
  if (!text) { co.textContent = '(keine Ausgabe)'; co.className = 'prev-console'; return; }
  co.textContent = text.slice(-600);
  co.className = 'prev-console' + (prevOutput.isError ? ' is-err' : '');
  co.scrollTop = co.scrollHeight;
}

export function closePrev() {
  document.getElementById('prev-ov').classList.remove('open');
  if (prevRunner) { prevRunner.destroy(); prevRunner = null; }
}

export function closePrevIfBg(e) {
  if (e.target === document.getElementById('prev-ov')) closePrev();
}

// ═══════════════════════════════════════════════════════════════════════
// Expose to window
// ═══════════════════════════════════════════════════════════════════════

window.doLogin = doLogin;
window.doLogout = doLogout;
window.toggleAutoStart = toggleAutoStart;
window.loadProjects = loadProjects;
window.toggleEdit = toggleEdit;
window.saveEdit = saveEdit;
window.toggleHidden = toggleHidden;
window.delProject = delProject;
window.deleteAll = deleteAll;
window.checkUrl = checkUrl;
window.doAdd = doAdd;
window.prevFromInput = prevFromInput;
window.openPrev = openPrev;
window.openPrevWithUrl = openPrevWithUrl;
window.prevRun = prevRun;
window.closePrev = closePrev;
window.closePrevIfBg = closePrevIfBg;

// Check session and load
window.addEventListener('DOMContentLoaded', async () => {
  turnstileConfig = await fetchConfig();
  if (turnstileConfig.hasTurnstile && window.turnstile) {
    loginTurnstileId = window.turnstile.render('#login-turnstile', {
      sitekey: turnstileConfig.siteKey, theme: 'light'
    });
    addTurnstileId = window.turnstile.render('#add-turnstile', {
      sitekey: turnstileConfig.siteKey, theme: 'light'
    });
  }

  const d = await adminCheck();
  if (d.isAdmin) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadSettings();
    loadProjects();
  }
});
