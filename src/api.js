import { withAppBase } from './paths.js';

const tokenKey = 'videoEmbedAdminToken';

export function getAdminToken() {
  return localStorage.getItem(tokenKey);
}

export function setAdminToken(token) {
  localStorage.setItem(tokenKey, token);
}

export function clearAdminToken() {
  localStorage.removeItem(tokenKey);
}

export async function loginAdmin({ username, password }) {
  const data = await parse(await fetch(withAppBase('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }));
  setAdminToken(data.token);
  return data;
}

export async function getCurrentAdmin() {
  return parse(await fetch(withAppBase('/api/auth/me'), { headers: authHeaders() }));
}

export async function uploadVideo({ title, password, file }) {
  const form = new FormData();
  form.append('title', title);
  if (password) form.append('password', password);
  form.append('video', file);
  return parse(await fetch(withAppBase('/api/videos'), {
    method: 'POST',
    headers: authHeaders(),
    body: form
  }));
}

export async function listVideos() {
  return parse(await fetch(withAppBase('/api/videos'), { headers: authHeaders() }));
}

export async function updateVideo(id, payload) {
  return parse(await fetch(withAppBase(`/api/videos/${id}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  }));
}

export async function replaceVideoFile(id, file) {
  const form = new FormData();
  form.append('video', file);
  return parse(await fetch(withAppBase(`/api/videos/${id}/file`), {
    method: 'PUT',
    headers: authHeaders(),
    body: form
  }));
}

export async function getVideoPage(id) {
  return parse(await fetch(withAppBase(`/api/videos/${id}/page`), { headers: authHeaders() }));
}

export async function saveVideoPage(id, payload) {
  return parse(await fetch(withAppBase(`/api/videos/${id}/page`), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  }));
}

export async function deleteVideo(id) {
  return parse(await fetch(withAppBase(`/api/videos/${id}`), {
    method: 'DELETE',
    headers: authHeaders()
  }));
}

export async function getStorageInfo() {
  return parse(await fetch(withAppBase('/api/admin/storage'), { headers: authHeaders() }));
}

export async function listUsers() {
  return parse(await fetch(withAppBase('/api/admin/users'), { headers: authHeaders() }));
}

export async function createUser(payload) {
  return parse(await fetch(withAppBase('/api/admin/users'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  }));
}

export async function getEmbedVideo(id) {
  return parse(await fetch(withAppBase(`/api/embed/${id}`)));
}

export async function verifyPassword(id, password) {
  return parse(await fetch(withAppBase(`/api/embed/${id}/verify`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  }));
}

export async function getPublicVideoPage(slug) {
  return parse(await fetch(withAppBase(`/api/pages/${slug}`)));
}

async function parse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function authHeaders(extra = {}) {
  const token = getAdminToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}
