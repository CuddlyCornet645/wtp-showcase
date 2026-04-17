// ═══════════════════════════════════════════════════════════════════════
// API: Backend communication
// ═══════════════════════════════════════════════════════════════════════

export async function fetchConfig() {
  const res = await fetch('/api/config');
  return await res.json();
}

export async function fetchSettings() {
  const res = await fetch('/api/settings');
  return await res.json();
}

export async function updateSettings(settings) {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Public: only returns visible projects
export async function fetchProjects() {
  const res = await fetch('/api/projects');
  return await res.json();
}

// Admin: returns ALL projects including hidden
export async function fetchAllProjects() {
  const res = await fetch('/api/admin/projects');
  return await res.json();
}

export async function submitProject(name, title, url, token) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, title, url, token })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function deleteProject(id) {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function updateProject(id, name, title, url, hidden) {
  const body = { name, title, url };
  if (hidden !== undefined) body.hidden = hidden;
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Admin endpoints
export async function adminCheck() {
  const res = await fetch('/api/admin/check');
  return await res.json();
}

export async function adminLogin(password, token) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, token })
  });
  return res.ok;
}

export async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
}
