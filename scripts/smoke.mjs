import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { chromium } from 'playwright';

const rootDir = path.resolve(import.meta.dirname, '..');
const artifactDir = path.join(rootDir, 'output', 'playwright');
fs.mkdirSync(artifactDir, { recursive: true });

const fixturePath = path.join(artifactDir, 'smoke.mp4');
fs.writeFileSync(fixturePath, Buffer.from('smoke-video'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  const heading = await page.locator('h1').first().textContent();
  if (!heading?.includes('VOC PLAY')) {
    throw new Error(`Unexpected heading: ${heading}`);
  }

  await page.locator('input[name="username"]').fill(process.env.ADMIN_USERNAME || 'vocadmin2');
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD || 'change-this-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('button', { name: /upload and host/i }).waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: /^users$/i }).click();
  await page.locator('input[name="username"]').fill(`smokeuser${Date.now()}`);
  await page.locator('input[name="password"]').fill('smoke-pass');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByText('Account created.').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: /^studio$/i }).click();

  await page.locator('input[name="title"]').fill('Smoke Upload');
  await page.locator('input[name="video"]').setInputFiles(fixturePath);
  await Promise.all([
    page.waitForResponse((response) => (
      response.url().includes('/api/videos') &&
      response.request().method() === 'POST' &&
      response.status() === 201
    )),
    page.getByRole('button', { name: /upload and host/i }).click()
  ]);
  await page.getByText('Smoke Upload').first().waitFor({ timeout: 10000 });

  const embedCode = await page.locator('textarea').inputValue();
  if (!embedCode.includes('/embed/')) {
    throw new Error('Generated embed code does not include an embed URL.');
  }

  await page.screenshot({ path: path.join(artifactDir, 'dashboard.png'), fullPage: true });

  if (errors.length) {
    throw new Error(`Browser console errors: ${errors.join(' | ')}`);
  }

  console.log('Browser smoke passed');
} catch (error) {
  await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true });
  throw error;
} finally {
  await browser.close();
}
