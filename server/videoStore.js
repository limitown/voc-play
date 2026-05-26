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
