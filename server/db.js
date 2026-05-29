import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_pages (
      id TEXT PRIMARY KEY,
      videoId TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      theme TEXT NOT NULL,
      layout TEXT NOT NULL DEFAULT '{"descriptionBelowVideo":false,"actionsBelowVideo":true}',
      blocks TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  ensureColumn(db, 'video_pages', 'layout', 'TEXT NOT NULL DEFAULT \'{"descriptionBelowVideo":false,"actionsBelowVideo":true}\'');
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
    id,
    passwordEnabled: (patch.passwordEnabled ?? existing.passwordEnabled) ? 1 : 0,
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

export function updateVideoFile(db, id, file) {
  const existing = getVideo(db, id);
  if (!existing) return null;

  db.prepare(`
    UPDATE videos SET
      originalName = @originalName,
      storedName = @storedName,
      mimeType = @mimeType,
      size = @size,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run({
    id,
    originalName: file.originalName,
    storedName: file.storedName,
    mimeType: file.mimeType,
    size: file.size,
    updatedAt: new Date().toISOString()
  });

  return getVideo(db, id);
}

export function deleteVideo(db, id) {
  const existing = getVideo(db, id);
  if (!existing) return null;

  db.prepare('DELETE FROM video_pages WHERE videoId = ?').run(id);
  db.prepare('DELETE FROM videos WHERE id = ?').run(id);
  return existing;
}

export function getVideoPageByVideoId(db, videoId) {
  const row = db.prepare('SELECT * FROM video_pages WHERE videoId = ?').get(videoId);
  return row ? hydrateVideoPage(row) : null;
}

export function getVideoPageBySlug(db, slug) {
  const row = db.prepare('SELECT * FROM video_pages WHERE slug = ?').get(slug);
  return row ? hydrateVideoPage(row) : null;
}

export function upsertVideoPage(db, page) {
  const existing = getVideoPageByVideoId(db, page.videoId);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE video_pages SET
        slug = @slug,
        title = @title,
        description = @description,
        theme = @theme,
        layout = @layout,
        blocks = @blocks,
        updatedAt = @updatedAt
      WHERE videoId = @videoId
    `).run({
      ...page,
      layout: JSON.stringify(page.layout),
      blocks: JSON.stringify(page.blocks),
      updatedAt: now
    });
    return getVideoPageByVideoId(db, page.videoId);
  }

  db.prepare(`
    INSERT INTO video_pages (
      id, videoId, slug, title, description, theme, layout, blocks, createdAt, updatedAt
    ) VALUES (
      @id, @videoId, @slug, @title, @description, @theme, @layout, @blocks, @createdAt, @updatedAt
    )
  `).run({
    id: randomUUID(),
    ...page,
    layout: JSON.stringify(page.layout),
    blocks: JSON.stringify(page.blocks),
    createdAt: now,
    updatedAt: now
  });

  return getVideoPageByVideoId(db, page.videoId);
}

export function insertUser(db, user) {
  db.prepare(`
    INSERT INTO users (
      id, username, passwordHash, role, createdAt, updatedAt
    ) VALUES (
      @id, @username, @passwordHash, @role, @createdAt, @updatedAt
    )
  `).run(user);
  return getUserByUsername(db, user.username);
}

export function listUsers(db) {
  return db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all().map(toPublicUser);
}

export function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
}

export function ensureAdminUser(db, { username, passwordHash }) {
  const existing = getUserByUsername(db, username);
  if (existing) return existing;

  const now = new Date().toISOString();
  return insertUser(db, {
    id: randomUUID(),
    username,
    passwordHash,
    role: 'admin',
    createdAt: now,
    updatedAt: now
  });
}

export function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function hydrateVideo(row) {
  return {
    ...row,
    passwordEnabled: Boolean(row.passwordEnabled),
    playerOptions: JSON.parse(row.playerOptions)
  };
}

function hydrateVideoPage(row) {
  return {
    ...row,
    layout: JSON.parse(row.layout || '{"descriptionBelowVideo":false,"actionsBelowVideo":true}'),
    blocks: JSON.parse(row.blocks)
  };
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
