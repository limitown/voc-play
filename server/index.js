import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';
import { createApp } from './routes.js';
import { getStorageConfig } from './storageConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const { databasePath, uploadDir } = getStorageConfig(process.env, rootDir);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const db = createDatabase(databasePath);
const app = createApp({
  db,
  uploadDir,
  jwtSecret: process.env.JWT_SECRET || 'replace-this-secret',
  adminUsername: process.env.ADMIN_USERNAME || 'vocadmin2',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-this-password',
  storageInfo: {
    databasePath,
    uploadDir
  }
});

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Video embed backend running at http://localhost:${port}`);
  console.log(`Videos stored in ${uploadDir}`);
  console.log(`Metadata stored in ${databasePath}`);
});
