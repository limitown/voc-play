import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import {
  deleteVideo,
  ensureAdminUser,
  getUserByUsername,
  getVideo,
  getVideoPageBySlug,
  getVideoPageByVideoId,
  insertUser,
  insertVideo,
  listUsers,
  listVideos,
  toPublicUser,
  updateVideo,
  updateVideoFile,
  upsertVideoPage
} from './db.js';
import {
  createStoredName,
  normalizePlayerOptions,
  toDashboardVideo,
  toEmbedVideo
} from './videoStore.js';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const ADMIN_TOKEN_TTL = '8h';
const LOGIN_TOKEN_TTL = '8h';
const PAGE_THEMES = new Set(['paper', 'slate', 'sage', 'contrast', 'gallery']);

export function createApp({
  db,
  uploadDir = 'uploads',
  jwtSecret = 'dev-secret',
  adminUsername = 'admin',
  adminPassword = 'admin',
  storageInfo = {}
}) {
  fs.mkdirSync(uploadDir, { recursive: true });
  ensureAdminUser(db, {
    username: adminUsername,
    passwordHash: bcrypt.hashSync(adminPassword, 10)
  });

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

  function requireLogin(req, res, next) {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Login required.' });
    }
  }

  function requireAdmin(req, res, next) {
    requireLogin(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      return next();
    });
  }

  app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body.username || '');
    const password = String(req.body.password || '');
    const user = getUserByUsername(db, username);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const publicUser = toPublicUser(user);
    return res.json({
      token: jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        jwtSecret,
        { expiresIn: LOGIN_TOKEN_TTL }
      ),
      user: publicUser,
      username: user.username
    });
  });

  app.get('/api/auth/me', requireLogin, (req, res) => {
    res.json({ user: { username: req.user.username, role: req.user.role } });
  });

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    res.json({ users: listUsers(db) });
  });

  app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (getUserByUsername(db, username)) return res.status(409).json({ error: 'Username already exists.' });

    const now = new Date().toISOString();
    const user = insertUser(db, {
      id: randomUUID(),
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      createdAt: now,
      updatedAt: now
    });

    return res.status(201).json({ user: toPublicUser(user) });
  });

  app.get('/api/admin/storage', requireAdmin, (_req, res) => {
    res.json({
      storage: {
        databasePath: storageInfo.databasePath || null,
        uploadDir: storageInfo.uploadDir || uploadDir
      }
    });
  });

  app.post('/api/videos', requireLogin, upload.single('video'), async (req, res) => {
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

  app.get('/api/videos', requireLogin, (_req, res) => {
    res.json({ videos: listVideos(db).map(toDashboardVideo) });
  });

  app.get('/api/videos/:id', requireLogin, (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ video: toDashboardVideo(video) });
  });

  app.get('/api/videos/:id/page', requireLogin, (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ page: getVideoPageByVideoId(db, req.params.id) });
  });

  app.put('/api/videos/:id/page', requireLogin, (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    const title = String(req.body.title || video.title).trim();
    const slug = normalizeSlug(req.body.pageName || title);
    if (!slug) return res.status(400).json({ error: 'Page name is required.' });

    const conflicting = getVideoPageBySlug(db, slug);
    if (conflicting && conflicting.videoId !== video.id) {
      return res.status(409).json({ error: 'Page name is already used.' });
    }

    const page = upsertVideoPage(db, {
      videoId: video.id,
      slug,
      title,
      description: String(req.body.description || '').trim(),
      theme: PAGE_THEMES.has(req.body.theme) ? req.body.theme : 'paper',
      layout: normalizePageLayout(req.body.layout),
      blocks: normalizePageBlocks(req.body.blocks)
    });

    return res.json({ page });
  });

  app.patch('/api/videos/:id', requireLogin, async (req, res) => {
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

  app.put('/api/videos/:id/file', requireLogin, upload.single('video'), (req, res) => {
    const existing = getVideo(db, req.params.id);
    if (!existing) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      return res.status(404).json({ error: 'Video not found.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Upload a video file.' });

    const video = updateVideoFile(db, req.params.id, {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    const oldFilePath = path.join(uploadDir, existing.storedName);
    if (fs.existsSync(oldFilePath)) {
      fs.rmSync(oldFilePath, { force: true });
    }

    return res.json({ video: toDashboardVideo(video) });
  });

  app.delete('/api/videos/:id', requireLogin, (req, res) => {
    const deleted = deleteVideo(db, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Video not found.' });

    const filePath = path.join(uploadDir, deleted.storedName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }

    return res.json({
      deleted: {
        id: deleted.id,
        title: deleted.title,
        storedName: deleted.storedName
      }
    });
  });

  app.get('/api/embed/:id', (req, res) => {
    const video = getVideo(db, req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ video: toEmbedVideo(video) });
  });

  app.get('/api/pages/:slug', (req, res) => {
    const page = getVideoPageBySlug(db, normalizeSlug(req.params.slug));
    if (!page) return res.status(404).json({ error: 'Page not found.' });

    const video = getVideo(db, page.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    return res.json({
      page,
      video: toEmbedVideo(video)
    });
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

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizePageBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return [];
  return blocks.slice(0, 12).map((block) => {
    const url = normalizeBlockUrl(block.url);
    return {
      type: block.type === 'button' ? 'button' : 'linkText',
      label: String(block.label || '').trim().slice(0, 80),
      url
    };
  }).filter((block) => block.label && block.url);
}

function normalizePageLayout(layout = {}) {
  return {
    descriptionBelowVideo: Boolean(layout.descriptionBelowVideo),
    actionsBelowVideo: layout.actionsBelowVideo !== false
  };
}

function normalizeBlockUrl(value) {
  const url = String(value || '').trim().slice(0, 500);
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return '';
}
