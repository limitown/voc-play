import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './db.js';
import { createApp } from './routes.js';

let tmpDir;
let app;
let db;
let adminToken;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-mvp-'));
  db = createDatabase(path.join(tmpDir, 'test.sqlite'));
  app = createApp({
    db,
    uploadDir: path.join(tmpDir, 'uploads'),
    jwtSecret: 'test-secret',
    adminUsername: 'vocadmin2',
    adminPassword: 'DF416rqfd$r5!x',
    storageInfo: {
      databasePath: path.join(tmpDir, 'test.sqlite'),
      uploadDir: path.join(tmpDir, 'uploads')
    }
  });
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('video API', () => {
  async function login(username = 'vocadmin2', password = 'DF416rqfd$r5!x') {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username, password });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.username).toBe(username);
    adminToken = response.body.token;
    return adminToken;
  }

  function withAdmin(requestBuilder) {
    return requestBuilder.set('Authorization', `Bearer ${adminToken}`);
  }

  it('requires admin login for dashboard video APIs', async () => {
    const list = await request(app).get('/api/videos');
    expect(list.status).toBe(401);

    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'vocadmin2', password: 'wrong' });
    expect(badLogin.status).toBe(401);

    await login();

    const authedList = await withAdmin(request(app).get('/api/videos'));
    expect(authedList.status).toBe(200);
  });

  it('lets admins create user accounts and blocks users from account management', async () => {
    await login();

    const created = await withAdmin(request(app)
      .post('/api/admin/users')
      .send({ username: 'creator1', password: 'creator-pass', role: 'user' }));

    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ username: 'creator1', role: 'user' });
    expect(created.body.user.passwordHash).toBeUndefined();

    const users = await withAdmin(request(app).get('/api/admin/users'));
    expect(users.status).toBe(200);
    expect(users.body.users.map((user) => user.username)).toContain('creator1');

    await login('creator1', 'creator-pass');

    const dashboard = await withAdmin(request(app).get('/api/videos'));
    expect(dashboard.status).toBe(200);

    const blocked = await withAdmin(request(app)
      .post('/api/admin/users')
      .send({ username: 'blocked', password: 'blocked-pass', role: 'user' }));
    expect(blocked.status).toBe(403);
  });

  it('uploads and lists a public video', async () => {
    await login();
    const fixture = path.join(tmpDir, 'sample.mp4');
    fs.writeFileSync(fixture, Buffer.from('fake-video'));

    const upload = await withAdmin(request(app)
      .post('/api/videos')
      .field('title', 'Launch Clip')
      .attach('video', fixture));

    expect(upload.status).toBe(201);
    expect(upload.body.video.title).toBe('Launch Clip');
    expect(upload.body.video.passwordEnabled).toBe(false);

    const list = await withAdmin(request(app).get('/api/videos'));

    expect(list.status).toBe(200);
    expect(list.body.videos).toHaveLength(1);
    expect(list.body.videos[0].title).toBe('Launch Clip');
  });

  it('protects media until the correct password is verified', async () => {
    await login();
    const fixture = path.join(tmpDir, 'secret.mp4');
    fs.writeFileSync(fixture, Buffer.from('classified-video'));

    const upload = await withAdmin(request(app)
      .post('/api/videos')
      .field('title', 'Private Cut')
      .field('password', 'open-sesame')
      .attach('video', fixture));

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
    expect(Buffer.from(media.body).toString()).toBe('classified-video');
  });

  it('replaces an uploaded video file without changing the video id', async () => {
    await login();
    const firstFixture = path.join(tmpDir, 'first.mp4');
    const secondFixture = path.join(tmpDir, 'second.mp4');
    fs.writeFileSync(firstFixture, Buffer.from('first-video'));
    fs.writeFileSync(secondFixture, Buffer.from('second-video'));

    const upload = await withAdmin(request(app)
      .post('/api/videos')
      .field('title', 'Replace Me')
      .attach('video', firstFixture));

    const id = upload.body.video.id;
    const firstStoredName = db.prepare('SELECT storedName FROM videos WHERE id = ?').get(id).storedName;

    const replaced = await withAdmin(request(app)
      .put(`/api/videos/${id}/file`)
      .attach('video', secondFixture));

    expect(replaced.status).toBe(200);
    expect(replaced.body.video.id).toBe(id);
    expect(replaced.body.video.originalName).toBe('second.mp4');
    expect(replaced.body.video.size).toBe(Buffer.byteLength('second-video'));
    expect(fs.existsSync(path.join(tmpDir, 'uploads', firstStoredName))).toBe(false);

    const media = await request(app).get(`/media/${id}`);
    expect(media.status).toBe(200);
    expect(Buffer.from(media.body).toString()).toBe('second-video');
  });

  it('creates a public landing page for an uploaded video', async () => {
    await login();
    const fixture = path.join(tmpDir, 'tutorial.mp4');
    fs.writeFileSync(fixture, Buffer.from('tutorial-video'));

    const upload = await withAdmin(request(app)
      .post('/api/videos')
      .field('title', 'Training Clip')
      .attach('video', fixture));

    const id = upload.body.video.id;
    const saved = await withAdmin(request(app)
      .put(`/api/videos/${id}/page`)
      .send({
        pageName: 'My Training Page',
        title: 'How to Watch This Training',
        description: 'Use this page to follow the video.',
        theme: 'sage',
        layout: {
          descriptionBelowVideo: true,
          actionsBelowVideo: true
        },
        blocks: [
          { type: 'button', label: 'Download Guide', url: 'https://example.com/guide' },
          { type: 'linkText', label: 'Read notes', url: 'https://example.com/notes' }
        ]
      }));

    expect(saved.status).toBe(200);
    expect(saved.body.page).toMatchObject({
      videoId: id,
      slug: 'my-training-page',
      title: 'How to Watch This Training',
      theme: 'sage'
    });
    expect(saved.body.page.blocks).toHaveLength(2);
    expect(saved.body.page.layout.descriptionBelowVideo).toBe(true);

    const page = await request(app).get('/api/pages/my-training-page');
    expect(page.status).toBe(200);
    expect(page.body.page.description).toBe('Use this page to follow the video.');
    expect(page.body.video.id).toBe(id);
  });

  it('shows storage information and deletes a video record with its local file', async () => {
    await login();
    const fixture = path.join(tmpDir, 'delete-me.mp4');
    fs.writeFileSync(fixture, Buffer.from('delete-video'));

    const upload = await withAdmin(request(app)
      .post('/api/videos')
      .field('title', 'Delete Me')
      .attach('video', fixture));

    const id = upload.body.video.id;
    const storage = await withAdmin(request(app).get('/api/admin/storage'));

    expect(storage.status).toBe(200);
    expect(storage.body.storage.databasePath).toContain('test.sqlite');
    expect(storage.body.storage.uploadDir).toContain('uploads');

    const deleted = await withAdmin(request(app).delete(`/api/videos/${id}`));
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted.id).toBe(id);

    const embed = await request(app).get(`/api/embed/${id}`);
    expect(embed.status).toBe(404);
    expect(fs.existsSync(path.join(tmpDir, 'uploads', deleted.body.deleted.storedName))).toBe(false);
  });
});
