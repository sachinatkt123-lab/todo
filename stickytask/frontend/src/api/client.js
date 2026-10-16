// Minimal typed-ish wrapper around the REST API.
const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const isText = res.headers.get('content-type')?.includes('text/plain');
  const body = isText ? await res.text() : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export const api = {
  listTasks: ({ status, priority, tag, showSnoozed = false } = {}) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (priority) q.set('priority', priority);
    if (tag) q.set('tag', tag);
    if (showSnoozed) q.set('showSnoozed', 'true');
    const qs = q.toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },

  getTask: (id) => request(`/tasks/${id}`),

  createTask: (task) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(task) }),

  updateTask: (id, patch) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),

  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  setStatus: (id, status) =>
    request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  parse: (text) => request('/tasks/parse', { method: 'POST', body: JSON.stringify({ text }) }),

  digest: () => request('/tasks/digest', { method: 'POST' }),
};
