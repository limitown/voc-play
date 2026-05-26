import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStorageConfig } from './storageConfig.js';

describe('storage config', () => {
  it('uses local data and uploads folders by default', () => {
    const rootDir = path.resolve('app-root');
    const config = getStorageConfig({}, rootDir);

    expect(config.databasePath).toBe(path.join(rootDir, 'data', 'videos.sqlite'));
    expect(config.uploadDir).toBe(path.join(rootDir, 'uploads'));
  });

  it('resolves custom local storage paths from environment variables', () => {
    const rootDir = path.resolve('app-root');
    const config = getStorageConfig({
      DATABASE_PATH: 'local-db/videos.sqlite',
      UPLOAD_DIR: 'local-videos'
    }, rootDir);

    expect(config.databasePath).toBe(path.join(rootDir, 'local-db', 'videos.sqlite'));
    expect(config.uploadDir).toBe(path.join(rootDir, 'local-videos'));
  });
});
