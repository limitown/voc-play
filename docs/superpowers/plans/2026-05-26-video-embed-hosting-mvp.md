# Video Embed Hosting MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MVP website where creators upload videos, configure public or password-protected embeds, and copy iframe code for static HTML sites.

**Architecture:** A Vite React frontend talks to an Express backend. Express stores uploaded video files in `uploads/`, stores metadata and password hashes in SQLite, serves embed metadata, verifies passwords, and streams public or token-authorized protected videos.

**Tech Stack:** Node.js, Express, Multer, SQLite via `better-sqlite3`, bcrypt, JSON Web Tokens, Vite, React, Vitest, Supertest.

---

## File Structure

- Create `package.json`: root scripts, dependencies, and dev dependencies.
- Create `vite.config.js`: Vite config with React plugin and API proxy.
- Create `index.html`: frontend HTML entry.
- Create `server/index.js`: Express app bootstrap and static production serving.
- Create `server/db.js`: SQLite schema and video metadata persistence functions.
- Create `server/videoStore.js`: upload naming, option normalization, public DTO shaping.
- Create `server/routes.js`: API, embed metadata, password verification, and media streaming routes.
- Create `server/routes.test.js`: backend API tests with Supertest.
- Create `src/main.jsx`: React app entry.
- Create `src/App.jsx`: dashboard, editor, embed route, and sample page routing.
- Create `src/api.js`: frontend API helper functions.
- Create `src/styles.css`: polished app and embed player styles.
- Create `sample-static-site.html`: static page example using the generated iframe pattern.
- Create `.gitignore`: ignore dependencies, database, build output, and uploaded videos.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: Create package scripts and dependencies**

`package.json`:

```json
{
  "name": "video-embed-hosting-mvp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "node --watch server/index.js",
    "dev:client": "vite --host 0.0.0.0",
    "build": "vite build",
    "start": "NODE_ENV=production node server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "uuid": "^11.0.5"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "concurrently": "^9.1.2",
    "jsdom": "^25.0.1",
    "supertest": "^7.0.0",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create Vite config**

`vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000'
    }
  }
});
```

- [ ] **Step 3: Create HTML entry**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Video Embed Hosting MVP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Ignore generated files**

`.gitignore`:

```gitignore
node_modules/
dist/
data/
uploads/
.env
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

---

### Task 2: Backend Persistence And Video Helpers

**Files:**
- Create: `server/db.js`
- Create: `server/videoStore.js`
- Create: `server/routes.test.js`

- [ ] **Step 1: Write persistence tests**

`server/routes.test.js` should start with:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './routes.js';
import { createDatabase } from './db.js';

let tmpDir;
let app;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-mvp-'));
  const db = createDatabase(path.join(tmpDir, 'test.sqlite'));
  app = createApp({
    db,
    uploadDir: path.join(tmpDir, 'uploads'),
    jwtSecret: 'test-secret'
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('video API', () => {
  it('uploads and lists a public video', async () => {
    const fixture = path.join(tmpDir, 'sample.mp4');
    fs.writeFileSync(fixture, Buffer.from('fake-video'));

    const upload = await request(app)
      .post('/api/videos')
      .field('title', 'Launch Clip')
      .attach('video', fixture);

    expect(upload.status).toBe(201);
    expect(upload.body.video.title).toBe('Launch Clip');
    expect(upload.body.video.passwordEnabled).toBe(false);

    const list = await request(app).get('/api/videos');

    expect(list.status).toBe(200);
    expect(list.body.videos).toHaveLength(1);
    expect(list.body.videos[0].title).toBe('Launch Clip');
  });
});
```

- [ ] **Step 2: Run tests to verify scaffold failure**

Run: `npm test -- server/routes.test.js`

Expected: FAIL because `server/routes.js` and `server/db.js` do not exist yet.

- [ ] **Step 3: Implement SQLite database**

`server/db.js`:

```js
import Database from 'better-sqlite3';

export function createDatabase(filename = 'data/videos.sqlite') {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      passwordEnabled INTEGER NOT NULL DEFAULT 0,
      passwordHash TEXT,
      playerOptions TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  return db;
}

export function insertVideo(db, video) {
  db.prepare(`
    INSERT INTO videos (
      id, title, originalName, storedName, mimeType, size,
      passwordEnabled, passwordHash, playerOptions, createdAt, updatedAt
    ) VALUES (
      @id, @title, @originalName, @storedName, @mimeType, @size,
      @passwordEnabled, @passwordHash, @playerOptions, @createdAt, @updatedAt
    )
  `).run(video);
  return getVideo(db, video.id);
}

export function listVideos(db) {
  return db.prepare('SELECT * FROM videos ORDER BY createdAt DESC').all().map(hydrateVideo);
}

export function getVideo(db, id) {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
  return row ? hydrateVideo(row) : null;
}

export function updateVideo(db, id, patch) {
  const existing = getVideo(db, id);
  if (!existing) return null;
  const next = {
    ...existing,
    ...patch,
    passwordEnabled: patch.passwordEnabled ?? existing.passwordEnabled,
    passwordHash: Object.hasOwn(patch, 'passwordHash') ? patch.passwordHash : existing.passwordHash,
    playerOptions: JSON.stringify(patch.playerOptions ?? existing.playerOptions),
    updatedAt: new Date().toISOString()
  };
  db.prepare(`
    UPDATE videos SET
      title = @title,
      passwordEnabled = @passwordEnabled,
      passwordHash = @passwordHash,
      playerOptions = @playerOptions,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);
  return getVideo(db, id);
}

function hydrateVideo(row) {
  return {
    ...row,
    passwordEnabled: Boolean(row.passwordEnabled),
    playerOptions: JSON.parse(row.playerOptions)
  };
}
```

- [ ] **Step 4: Implement video DTO helpers**

`server/videoStore.js`:

```js
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const defaultPlayerOptions = {
  width: 800,
  height: 450,
  controls: true,
  muted: false,
  autoplay: false
};

export function createStoredName(originalName) {
  const extension = path.extname(originalName).toLowerCase() || '.mp4';
  return `${randomUUID()}${extension}`;
}

export function normalizePlayerOptions(input = {}) {
  return {
    width: clampNumber(input.width, 320, 1920, defaultPlayerOptions.width),
    height: clampNumber(input.height, 180, 1080, defaultPlayerOptions.height),
    controls: Boolean(input.controls ?? defaultPlayerOptions.controls),
    muted: Boolean(input.muted ?? defaultPlayerOptions.muted),
    autoplay: Boolean(input.autoplay ?? defaultPlayerOptions.autoplay)
  };
}

export function toDashboardVideo(video) {
  return {
    id: video.id,
    title: video.title,
    originalName: video.originalName,
    mimeType: video.mimeType,
    size: video.size,
    passwordEnabled: video.passwordEnabled,
    playerOptions: video.playerOptions,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt
  };
}

export function toEmbedVideo(video) {
  return {
    id: video.id,
    title: video.title,
    passwordEnabled: video.passwordEnabled,
    playerOptions: video.playerOptions
  };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- server/routes.test.js`

Expected: FAIL because routes are still missing.

---

### Task 3: Backend API, Uploads, Passwords, And Media

**Files:**
- Create: `server/routes.js`
- Create: `server/index.js`
- Modify: `server/routes.test.js`

- [ ] **Step 1: Add password and media tests**

Append inside `describe('video API', ...)` in `server/routes.test.js`:

```js
  it('protects media until the correct password is verified', async () => {
    const fixture = path.join(tmpDir, 'secret.mp4');
    fs.writeFileSync(fixture, Buffer.from('classified-video'));

    const upload = await request(app)
      .post('/api/videos')
      .field('title', 'Private Cut')
      .field('password', 'open-sesame')
      .attach('video', fixture);

    const id = upload.body.video.id;

    const blocked = await request(app).get(`/media/${id}`);
    expect(blocked.status).toBe(403);

    const wrong = await request(app)
      .post(`/api/embed/${id}/verify`)
      .send({ password: 'wrong' });
    expect(wrong.status).toBe(401);

    const verified = await request(app)
      .post(`/api/embed/${id}/verify`)
      .send({ password: 'open-sesame' });
    expect(verified.status).toBe(200);
    expect(verified.body.token).toEqual(expect.any(String));

    const media = await request(app).get(`/media/${id}?token=${verified.body.token}`);
    expect(media.status).toBe(200);
    expect(media.text).toBe('classified-video');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- server/routes.test.js`

Expected: FAIL because route logic is not implemented.

- [ ] **Step 3: Implement Express routes**

`server/routes.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { getVideo, insertVideo, listVideos, updateVideo } from './db.js';
import {
  createStoredName,
  normalizePlayerOptions,
  toDashboardVideo,
  toEmbedVideo
} from './videoStore.js';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function createApp({ db, uploadDir = 'uploads', jwtSecret = 'dev-secret' }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const app = express();
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => cb(null, createStoredName(file.originalname))
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      cb(null, file.mimetype.startsWith('video/'));
    }
  });

  app.use(cors());
  app.use(express.json());

  app.post('/api/videos', upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Upload a video file.' });
    const now = new Date().toISOString();
    const password = String(req.body.password || '').trim();
    const passwordEnabled = password.length > 0;
    const passwordHash = passwordEnabled ? await bcrypt.hash(password, 10) : null;
    const video = insertVideo(db, {
      id: randomUUID(),
      title: String(req.body.title || req.file.originalname).trim(),
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      passwordEnabled: passwordEnabled ? 1 : 0,
      passwordHash,
      playerOptions: JSON.stringify(normalizePlayerOptions()),
      createdAt: now,
      updatedAt: now
    });
    return res.status(201).json({ video: toDashboardVideo(video) });
  });

  app.get('/api/videos', (_req, res) => {
    res.json({ videos: listVideos(db).map(toDashboardVideo) });
  });

  app.get('/api/videos/:id', (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ video: toDashboardVideo(video) });
  });

  app.patch('/api/videos/:id', async (req, res) => {
    const existing = getVideo(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Video not found.' });
    const password = String(req.body.password || '').trim();
    const passwordEnabled = Boolean(req.body.passwordEnabled);
    const patch = {
      title: String(req.body.title || existing.title).trim(),
      passwordEnabled,
      passwordHash: passwordEnabled
        ? password
          ? await bcrypt.hash(password, 10)
          : existing.passwordHash
        : null,
      playerOptions: normalizePlayerOptions(req.body.playerOptions)
    };
    const video = updateVideo(db, req.params.id, patch);
    return res.json({ video: toDashboardVideo(video) });
  });

  app.get('/api/embed/:id', (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ video: toEmbedVideo(video) });
  });

  app.post('/api/embed/:id/verify', async (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    if (!video.passwordEnabled) return res.json({ token: signToken(jwtSecret, video.id) });
    const valid = await bcrypt.compare(String(req.body.password || ''), video.passwordHash || '');
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });
    return res.json({ token: signToken(jwtSecret, video.id) });
  });

  app.get('/media/:id', (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    if (video.passwordEnabled && !hasValidToken(jwtSecret, video.id, req.query.token)) {
      return res.status(403).json({ error: 'Password required.' });
    }
    const filePath = path.join(uploadDir, video.storedName);
    res.type(video.mimeType);
    return res.sendFile(path.resolve(filePath));
  });

  return app;
}

function signToken(secret, videoId) {
  return jwt.sign({ videoId }, secret, { expiresIn: '30m' });
}

function hasValidToken(secret, videoId, token) {
  try {
    return jwt.verify(String(token || ''), secret).videoId === videoId;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implement server bootstrap**

`server/index.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';
import { createApp } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadDir = path.join(rootDir, 'uploads');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = createDatabase(path.join(dataDir, 'videos.sqlite'));
const app = createApp({
  db,
  uploadDir,
  jwtSecret: process.env.JWT_SECRET || 'replace-this-secret'
});

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Video embed backend running at http://localhost:${port}`);
});
```

- [ ] **Step 5: Run backend tests**

Run: `npm test -- server/routes.test.js`

Expected: PASS for upload/list and password media tests.

---

### Task 4: Frontend API And Application UI

**Files:**
- Create: `src/api.js`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/styles.css`

- [ ] **Step 1: Implement frontend API helpers**

`src/api.js`:

```js
export async function uploadVideo({ title, password, file }) {
  const form = new FormData();
  form.append('title', title);
  if (password) form.append('password', password);
  form.append('video', file);
  return parse(await fetch('/api/videos', { method: 'POST', body: form }));
}

export async function listVideos() {
  return parse(await fetch('/api/videos'));
}

export async function updateVideo(id, payload) {
  return parse(await fetch(`/api/videos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }));
}

export async function getEmbedVideo(id) {
  return parse(await fetch(`/api/embed/${id}`));
}

export async function verifyPassword(id, password) {
  return parse(await fetch(`/api/embed/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  }));
}

async function parse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
```

- [ ] **Step 2: Implement React entry**

`src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Implement dashboard, editor, and embed routes**

`src/App.jsx` should include:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { getEmbedVideo, listVideos, updateVideo, uploadVideo, verifyPassword } from './api.js';

const defaultOptions = { width: 800, height: 450, controls: true, muted: false, autoplay: false };

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith('/embed/')) return <EmbedPlayer id={path.split('/').pop()} />;
  return <Dashboard />;
}

function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await listVideos();
    setVideos(data.videos);
    setSelectedId((current) => current || data.videos[0]?.id || null);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await uploadVideo({
        title: form.get('title'),
        password: form.get('password'),
        file: form.get('video')
      });
      event.currentTarget.reset();
      await refresh();
      setSelectedId(data.video.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = videos.find((video) => video.id === selectedId);

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Self-hosted player</p>
          <h1>Video Embed Studio</h1>
        </div>
        <a className="sample-link" href="/sample-static-site.html">Sample static page</a>
      </section>

      <section className="workspace">
        <aside className="panel upload-panel">
          <h2>Upload video</h2>
          <form onSubmit={handleUpload}>
            <label>Title<input name="title" placeholder="Product walkthrough" /></label>
            <label>Video file<input required name="video" type="file" accept="video/*" /></label>
            <label>Password optional<input name="password" type="password" placeholder="Leave blank for public" /></label>
            <button disabled={busy}>{busy ? 'Uploading...' : 'Upload and host'}</button>
          </form>
          {error && <p className="error">{error}</p>}

          <h2>Hosted videos</h2>
          <div className="video-list">
            {videos.map((video) => (
              <button
                className={video.id === selectedId ? 'video-row active' : 'video-row'}
                key={video.id}
                onClick={() => setSelectedId(video.id)}
              >
                <span>{video.title}</span>
                <small>{video.passwordEnabled ? 'Protected' : 'Public'}</small>
              </button>
            ))}
            {!videos.length && <p className="muted">No videos uploaded yet.</p>}
          </div>
        </aside>

        <section className="panel editor-panel">
          {selected ? <VideoEditor video={selected} onSaved={refresh} /> : <EmptyState />}
        </section>
      </section>
    </main>
  );
}

function VideoEditor({ video, onSaved }) {
  const [title, setTitle] = useState(video.title);
  const [passwordEnabled, setPasswordEnabled] = useState(video.passwordEnabled);
  const [password, setPassword] = useState('');
  const [options, setOptions] = useState(video.playerOptions || defaultOptions);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setTitle(video.title);
    setPasswordEnabled(video.passwordEnabled);
    setPassword('');
    setOptions(video.playerOptions || defaultOptions);
    setStatus('');
  }, [video.id]);

  const embedCode = useMemo(() => {
    const origin = window.location.origin;
    return `<iframe src="${origin}/embed/${video.id}" width="${options.width}" height="${options.height}" allow="fullscreen" frameborder="0"></iframe>`;
  }, [video.id, options.width, options.height]);

  async function save() {
    setStatus('Saving...');
    try {
      await updateVideo(video.id, { title, passwordEnabled, password, playerOptions: options });
      await onSaved();
      setStatus('Saved.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="editor-grid">
      <div>
        <p className="eyebrow">Embed settings</p>
        <h2>{video.title}</h2>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="toggle"><input checked={passwordEnabled} type="checkbox" onChange={(event) => setPasswordEnabled(event.target.checked)} />Require password</label>
        {passwordEnabled && <label>New password<input value={password} type="password" placeholder="Keep blank to preserve" onChange={(event) => setPassword(event.target.value)} /></label>}
        <div className="option-grid">
          <label>Width<input type="number" value={options.width} onChange={(event) => setOptions({ ...options, width: event.target.value })} /></label>
          <label>Height<input type="number" value={options.height} onChange={(event) => setOptions({ ...options, height: event.target.value })} /></label>
        </div>
        <label className="toggle"><input checked={options.controls} type="checkbox" onChange={(event) => setOptions({ ...options, controls: event.target.checked })} />Controls</label>
        <label className="toggle"><input checked={options.muted} type="checkbox" onChange={(event) => setOptions({ ...options, muted: event.target.checked })} />Muted</label>
        <label className="toggle"><input checked={options.autoplay} type="checkbox" onChange={(event) => setOptions({ ...options, autoplay: event.target.checked })} />Autoplay</label>
        <button onClick={save}>Save settings</button>
        <p className="status">{status}</p>
      </div>
      <div>
        <h2>Embed code</h2>
        <textarea readOnly value={embedCode} />
        <button onClick={() => navigator.clipboard.writeText(embedCode)}>Copy code</button>
        <div className="preview-frame">
          <iframe title="Embed preview" src={`/embed/${video.id}`} width="100%" height="315" />
        </div>
      </div>
    </div>
  );
}

function EmbedPlayer({ id }) {
  const [video, setVideo] = useState(null);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getEmbedVideo(id).then((data) => setVideo(data.video)).catch((err) => setError(err.message));
  }, [id]);

  async function unlock(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await verifyPassword(id, password);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !video) return <div className="embed-shell"><p>{error}</p></div>;
  if (!video) return <div className="embed-shell"><p>Loading video...</p></div>;
  const unlocked = !video.passwordEnabled || token;
  const options = video.playerOptions || defaultOptions;
  const src = `/media/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  return (
    <main className="embed-shell">
      {unlocked ? (
        <video
          src={src}
          title={video.title}
          controls={options.controls}
          muted={options.muted}
          autoPlay={options.autoplay}
          playsInline
        />
      ) : (
        <form className="password-gate" onSubmit={unlock}>
          <h1>{video.title}</h1>
          <label>Password<input value={password} type="password" onChange={(event) => setPassword(event.target.value)} /></label>
          <button>Unlock video</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  );
}

function EmptyState() {
  return <div className="empty"><h2>Upload a video to generate an embed.</h2></div>;
}
```

- [ ] **Step 4: Implement polished styles**

`src/styles.css` should define a calm creator-tool interface with responsive two-column layout, compact controls, a high-contrast embed player, and mobile-safe text wrapping.

- [ ] **Step 5: Build frontend**

Run: `npm run build`

Expected: Vite production build completes successfully.

---

### Task 5: Sample Static Page And Verification

**Files:**
- Create: `sample-static-site.html`

- [ ] **Step 1: Create sample static page**

`sample-static-site.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sample Static Embed Page</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f4f0e8;
        color: #20211f;
        font-family: Georgia, serif;
      }
      main {
        width: min(920px, calc(100vw - 32px));
      }
      iframe {
        width: 100%;
        aspect-ratio: 16 / 9;
        border: 0;
        background: #111;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Static Website Video Slot</h1>
      <p>Paste the generated iframe from the dashboard below.</p>
      <iframe src="http://localhost:5173/embed/REPLACE_WITH_VIDEO_ID" allow="fullscreen"></iframe>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Run backend tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Start dev server**

Run: `npm run dev`

Expected: frontend at `http://localhost:5173`, backend at `http://localhost:3000`.

- [ ] **Step 5: Manual browser verification**

Open `http://localhost:5173`. Upload a video, confirm it appears in the video list, copy the iframe code, open the embed preview, enable password protection, verify a wrong password fails, and verify the correct password unlocks playback.

---

## Self-Review

- Spec coverage: upload, local hosting, metadata storage, embed generation, public embeds, password-protected embeds, player options, errors, and verification are covered.
- Placeholder scan: the plan avoids `TBD`, `TODO`, and undefined future work. The only broad area is visual CSS, which will be implemented directly during execution according to the existing frontend-design requirements.
- Type consistency: video fields match the spec and route payloads use `playerOptions`, `passwordEnabled`, and `password` consistently.
