// Browser test harness. Each scenario gets a fresh browser context (so fresh storage), seeded
// with whatever saved data it needs, and fails on any console error or uncaught exception.
//
//   BASE_URL     defaults to http://localhost:8081
//   CHROME_PATH  defaults to the standard macOS Google Chrome location
//   HEADED=1     shows the browser window
//   E2E_SCREENSHOTS  where screenshots go (default: <tmp>/habit-tracker-e2e)
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8081';
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Outside the project on purpose: Metro watches the project, and new files appearing mid-run make
// it re-crawl and intermittently fail server renders with a 500.
const SCREENSHOTS = join(process.env.E2E_SCREENSHOTS ?? join(tmpdir(), 'habit-tracker-e2e'), '/');
const TIMEOUT = 8000;

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: CHROME_PATH, headless: !process.env.HEADED });
});
after(async () => {
  await browser?.close();
});

// ---------- Data builders (mirroring src/lib types) ----------

/** Local `YYYY-MM-DD` for `offset` days from today. */
export function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function habit(id, overrides = {}) {
  return {
    id,
    name: id,
    emoji: '⭐',
    color: '#3c87f7',
    kind: 'check',
    target: 1,
    intentionTime: null,
    createdAt: day(-10),
    log: {},
    ...overrides,
  };
}

/** Saved data for an onboarded user, as localStorage entries. */
export function saved(habits, overrides = {}) {
  return {
    'app:v2': JSON.stringify({
      onboarded: true,
      habits,
      challenge: null,
      badges: [],
      settings: { sound: false, reminders: { morning: '08:00', evening: '20:00' } },
      celebratedPerfectDay: null,
      ...overrides,
    }),
  };
}

// ---------- Scenarios ----------

/**
 * Declares a browser test. `sanity: true` puts it in the sanity suite too.
 * `storage` seeds localStorage once before the app first loads (reloads keep app changes).
 */
export function scenario(name, options, run) {
  const { sanity = false, storage = {}, path = '/', viewport, colorScheme } = options;
  test(sanity ? `@sanity ${name}` : name, async () => {
    const context = await browser.newContext({
      viewport: viewport ?? { width: 420, height: 900 },
      colorScheme: colorScheme ?? 'light',
    });
    await context.addInitScript((entries) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      sessionStorage.setItem('e2e-seeded', '1');
      localStorage.clear();
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, storage);

    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const problems = [];
    page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text().slice(0, 300)}`);
    });
    const network = [];
    page.on('requestfailed', (request) =>
      network.push(`failed: ${request.url().slice(0, 150)} (${request.failure()?.errorText})`)
    );
    page.on('response', (response) => {
      if (response.status() >= 400) network.push(`${response.status()}: ${response.url().slice(0, 150)}`);
    });
    // Confirmations (delete, reset) are accepted, as a user tapping "OK" would.
    page.on('dialog', (dialog) => dialog.accept());

    const app = new App(page);
    try {
      await app.goto(path);
      await run(app);
      assert.deepEqual(problems, [], 'no console errors or uncaught exceptions');
    } catch (error) {
      mkdirSync(SCREENSHOTS, { recursive: true });
      const file = `${SCREENSHOTS}FAILED-${name.replace(/[^a-z0-9]+/gi, '-')}.png`;
      await page.screenshot({ path: file, timeout: 5000 }).catch(() => {});
      const details = [
        `url: ${page.url()}`,
        `screenshot: ${file}`,
        ...(problems.length ? [`console: ${problems.join(' | ')}`] : []),
        ...(network.length ? [`network: ${network.join(' | ')}`] : []),
      ];
      // Node prints the stack, which captured the original message, so wrap rather than mutate.
      throw new Error(`${error.message}\n  ${details.join('\n  ')}`, { cause: error });
    } finally {
      await context.close();
    }
  });
}

// ---------- Page helpers ----------

class App {
  constructor(page) {
    this.page = page;
  }

  async goto(path) {
    await this.page.goto(BASE_URL + path, { timeout: 60_000 });
    await this.waitForContent(60_000);
  }

  async reload() {
    await this.page.reload();
    await this.waitForContent();
  }

  /** The app renders nothing until hydrated; wait for visible text (not the injected <style>). */
  async waitForContent(timeout = TIMEOUT) {
    await this.page.locator('#root [dir="auto"]').filter({ visible: true }).first().waitFor({ timeout });
  }

  /** First visible element containing `text` (inactive tabs stay mounted but hidden). */
  find(text, { exact = false } = {}) {
    return this.page.getByText(text, { exact }).filter({ visible: true }).first();
  }

  async see(text, options) {
    await this.find(text, options)
      .waitFor({ state: 'visible' })
      .catch(() => assert.fail(`expected to see "${text}"`));
  }

  async dontSee(text, options) {
    await this.find(text, options)
      .waitFor({ state: 'hidden', timeout: 1500 })
      .catch(() => assert.fail(`expected not to see "${text}"`));
  }

  /** Asserts the button containing `text` is disabled. */
  async expectDisabled(text) {
    const disabled = await this.find(text).evaluate(
      (el) => el.closest('[aria-disabled]')?.getAttribute('aria-disabled') === 'true'
    );
    assert.equal(disabled, true, `expected "${text}" to be disabled`);
  }

  async count(text) {
    return this.page.getByText(text, { exact: true }).filter({ visible: true }).count();
  }

  async tap(text, options) {
    await this.find(text, options).click();
    await this.settle();
  }

  async tapLabel(label) {
    await this.page.getByLabel(label, { exact: true }).filter({ visible: true }).first().click();
    await this.settle();
  }

  /** A habit row on Today, by habit name. */
  row(name) {
    return this.page
      .locator(`[aria-label="${name}"]`)
      .filter({ visible: true })
      .first();
  }

  async logHabit(name, times = 1) {
    for (let i = 0; i < times; i++) await this.row(name).click();
    await this.settle();
  }

  async longPress(name) {
    await this.row(name).hover();
    await this.page.mouse.down();
    await this.page.waitForTimeout(800);
    await this.page.mouse.up();
    await this.settle();
  }

  async openTab(name) {
    await this.find(name, { exact: true }).click();
    await this.settle();
  }

  async expectPath(path) {
    await this.page
      .waitForURL((url) => url.pathname === path, { timeout: TIMEOUT })
      .catch(() => assert.fail(`expected path ${path}, got ${new URL(this.page.url()).pathname}`));
  }

  path() {
    return new URL(this.page.url()).pathname;
  }

  /** The app's saved state, straight from storage. */
  async savedState() {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('app:v2') ?? 'null'));
  }

  /** Fails if anything makes the page wider than the window (content cut off on phones). */
  async expectNoHorizontalOverflow() {
    const offenders = await this.page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll('#root *')]
        .filter((el) => el.checkVisibility?.() ?? true)
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.right > width + 1 || rect.left < -1))
        .map(({ el, rect }) => {
          const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40);
          return `<${el.tagName.toLowerCase()}> "${label}" spans ${Math.round(rect.left)}–${Math.round(rect.right)}px of ${width}px`;
        });
    });
    assert.deepEqual(offenders, [], `content overflows the window on ${this.path()}`);
  }

  async screenshot(name) {
    mkdirSync(SCREENSHOTS, { recursive: true });
    await this.page.screenshot({ path: `${SCREENSHOTS}${name}.png` });
  }

  /** Lets taps, animations and navigation finish. */
  async settle(ms = 350) {
    await this.page.waitForTimeout(ms);
  }
}
