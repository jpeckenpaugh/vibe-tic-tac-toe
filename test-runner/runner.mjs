import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.env.GAME_ROOT || '/game';
const output = '/artifacts';
const port = 4173;
const targetVideoDurationMs = 30_000;
const showcaseMode = process.env.VIBE_TTT_SHOWCASE === '1';
const errors = [];
let browser;
let context;
let video;
let server;
let videoStartedAt;

const result = {
  status: 'failed',
  mode: showcaseMode ? 'showcase' : 'fast-smoke',
  startedAt: new Date().toISOString(),
  browser: null,
  steps: [],
  errors,
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const record = (step) => result.steps.push({ step, status: 'passed' });
const snap = (page, name) => page.screenshot({ path: path.join(output, name), fullPage: true });

try {
  await fs.mkdir(output, { recursive: true });
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      assert(file.startsWith(path.resolve(root) + path.sep), 'Invalid static path');
      const data = await fs.readFile(file);
      const ext = path.extname(file);
      res.writeHead(200, {
        'Content-Type':
          ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[ext] ||
          'application/octet-stream',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(port, '0.0.0.0', resolve));

  browser = await chromium.launch({ headless: true });
  result.browser = {
    playwright: '1.55.0',
    chromium: browser.version(),
    viewport: { width: 1280, height: 720 },
  };
  context = await browser.newContext({
    viewport: result.browser.viewport,
    ...(showcaseMode ? { recordVideo: { dir: output, size: result.browser.viewport } } : {}),
  });
  if (showcaseMode) videoStartedAt = process.hrtime.bigint();

  const page = await context.newPage();
  video = showcaseMode ? page.video() : null;
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await snap(page, '01-title.png');
  record('title screen loaded');

  if (showcaseMode) {
    // 00s - 04s: Title screen + How to Play & About modal
    await page.waitForTimeout(1000);
    await page.click('#about-btn');
    await page.waitForTimeout(1800);
    await snap(page, '02-about.png');
    await page.click('#about-close');
    await page.waitForTimeout(400);
    record('how to play modal shown');

    // 04s - 09s: Options modal & theme exploration
    await page.click('#options-btn');
    await page.waitForTimeout(600);
    await page.click('.theme-option[data-theme="cats"]');
    await page.waitForTimeout(600);
    await page.click('.theme-option[data-theme="stars"]');
    await page.waitForTimeout(600);
    await page.click('.theme-option[data-theme="swords"]');
    await page.waitForTimeout(700);
    await snap(page, '03-options.png');
    await page.click('#options-close');
    await page.waitForTimeout(400);
    record('options configured to Swords & Shields');

    // 09s - 18s: Round 1 (Swords & Shields diagonal win + confetti)
    await page.click('#start');
    await page.waitForTimeout(500);
    for (const move of [0, 1, 4, 2, 8]) {
      const cell = page.locator(`#board .cell >> nth=${move}`);
      await cell.hover();
      await page.waitForTimeout(350);
      await cell.click();
      await page.waitForTimeout(650);
    }
    await snap(page, '04-round1-win.png');
    await page.waitForTimeout(1500);
    record('round 1 Swords win with confetti');

    // 18s - 26s: Switch to Pizza & Burger and play Round 2
    await page.click('#to-menu');
    await page.waitForTimeout(400);
    await page.click('#options-btn');
    await page.waitForTimeout(500);
    await page.click('.theme-option[data-theme="food"]');
    await page.waitForTimeout(600);
    await page.click('#options-close');
    await page.waitForTimeout(400);
    await page.click('#start');
    await page.waitForTimeout(500);
    for (const move of [0, 3, 1, 4, 6, 5]) {
      const cell = page.locator(`#board .cell >> nth=${move}`);
      await cell.hover();
      await page.waitForTimeout(300);
      await cell.click();
      await page.waitForTimeout(550);
    }
    await snap(page, '05-round2-win.png');
    await page.waitForTimeout(1400);
    record('round 2 Burger win with confetti');

    // 26s - 30s: Return to Menu and show Leaderboard
    await page.click('#to-menu');
    await page.waitForTimeout(400);
    await page.click('#leaderboard-btn');
    await snap(page, '06-leaderboard.png');
    record('leaderboard displayed');

    while (Number(process.hrtime.bigint() - videoStartedAt) / 1e6 < targetVideoDurationMs - 1_500) {
      await page.waitForTimeout(150);
    }
    result.video = { targetDurationSeconds: targetVideoDurationMs / 1000 };
  } else {
    // Fast smoke test
    await page.click('#options-btn');
    await page.click('.theme-option[data-theme="swords"]');
    await page.click('#options-close');
    await page.click('#start');
    for (const move of [0, 1, 4, 2, 8]) {
      await page.locator(`#board .cell >> nth=${move}`).click();
    }
    assert(await page.locator('#game-over.show').count() === 1, 'Game over modal did not appear');
    await page.click('#to-menu');
    await page.click('#leaderboard-btn');
    assert((await page.locator('#lb-x').textContent()) === '1', 'Leaderboard X win not recorded');
    record('fast smoke flow verified');
  }

  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  result.status = 'passed';
} catch (error) {
  result.failure = error.stack || String(error);
  errors.push(String(error));
} finally {
  if (context) {
    try {
      await context.close();
    } catch (error) {
      errors.push(`context close: ${error.message}`);
    }
  }
  if (video) {
    try {
      await video.saveAs(path.join(output, 'demo.webm'));
    } catch (error) {
      errors.push(`video save: ${error.message}`);
    }
  }
  if (videoStartedAt && (await fs.stat(path.join(output, 'demo.webm')).then(() => true, () => false))) {
    try {
      const probe = spawnSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(output, 'demo.webm')],
        { encoding: 'utf8' }
      );
      assert(probe.status === 0, `ffprobe failed: ${probe.stderr || probe.error || 'unknown error'}`);
      const durationSeconds = Number(probe.stdout.trim());
      assert(Number.isFinite(durationSeconds), `Invalid WebM duration: ${probe.stdout}`);
      result.video = { ...result.video, durationSeconds };
      if (result.status === 'passed') {
        assert(durationSeconds >= 28 && durationSeconds <= 32.5, `Demo duration ${durationSeconds.toFixed(2)}s outside 28-32.5s target`);
      }
    } catch (error) {
      errors.push(`video validation: ${error.message}`);
    }
  }
  if (showcaseMode && browser && result.status === 'passed' && errors.length === 0) {
    try {
      result.gallery = await capturePromotionalGallery(browser, errors);
    } catch (error) {
      errors.push(`gallery capture: ${error.stack || error}`);
    }
  }
  if (errors.length && result.status === 'passed') {
    result.status = 'failed';
    result.failure = `Browser or artifact errors: ${errors.join('; ')}`;
  }
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'passed') process.exitCode = 1;

async function capturePromotionalGallery(activeBrowser, browserErrors) {
  const galleryDirectory = path.join(output, 'gallery');
  await fs.mkdir(galleryDirectory, { recursive: true });
  const captures = [];

  await withGalleryPage(activeBrowser, browserErrors, async (page) => {
    await page.screenshot({ path: path.join(galleryDirectory, 'title.png') });
    captures.push('title.png');

    await page.click('#about-btn');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(galleryDirectory, 'about.png') });
    captures.push('about.png');
    await page.click('#about-close');

    await page.click('#options-btn');
    await page.waitForTimeout(300);
    await page.click('.theme-option[data-theme="swords"]');
    await page.screenshot({ path: path.join(galleryDirectory, 'options.png') });
    captures.push('options.png');
    await page.click('#options-close');

    await page.click('#start');
    await page.waitForTimeout(300);
    for (const move of [0, 1, 4, 2, 8]) {
      await page.locator(`#board .cell >> nth=${move}`).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(galleryDirectory, 'swords.png') });
    captures.push('swords.png');

    await page.click('#to-menu');
    await page.click('#options-btn');
    await page.click('.theme-option[data-theme="cats"]');
    await page.click('#options-close');
    await page.click('#start');
    for (const move of [4, 0, 2, 6, 3]) {
      await page.locator(`#board .cell >> nth=${move}`).click();
      await page.waitForTimeout(80);
    }
    await page.locator('#board .cell >> nth=5').hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(galleryDirectory, 'cats.png') });
    captures.push('cats.png');

    await page.click('#reset');
    for (const move of [0, 3, 1, 4, 6, 5]) {
      await page.locator(`#board .cell >> nth=${move}`).click();
      await page.waitForTimeout(80);
    }
    await page.click('#to-menu');
    await page.click('#leaderboard-btn');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(galleryDirectory, 'leaderboard.png') });
    captures.push('leaderboard.png');
  });

  return { directory: 'gallery/', screenshots: captures };
}

async function withGalleryPage(activeBrowser, browserErrors, fn) {
  const ctx = await activeBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (error) => browserErrors.push(`gallery pageerror: ${error.message}`));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await fn(page);
  } finally {
    await ctx.close();
  }
}
