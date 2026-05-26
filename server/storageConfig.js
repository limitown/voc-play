import path from 'node:path';

export function getStorageConfig(env, rootDir) {
  return {
    databasePath: resolveLocalPath(env.DATABASE_PATH || 'data/videos.sqlite', rootDir),
    uploadDir: resolveLocalPath(env.UPLOAD_DIR || 'uploads', rootDir)
  };
}

function resolveLocalPath(value, rootDir) {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}
