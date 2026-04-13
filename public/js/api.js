// ═══════════════════════════════════════════════════════════════════════
// API: Backend communication
// ═══════════════════════════════════════════════════════════════════════

export async function fetchProjects() {
  const res = await fetch('/api/projects');
  return await res.json();
}

export async function submitProject(name, title, url) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, title, url })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function deleteProject(id) {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function updateProject(id, name, title, url) {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, title, url })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Admin endpoints
export async function adminCheck() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();
  return data;
}

export async function adminLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return res.ok;
}

export async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
}
