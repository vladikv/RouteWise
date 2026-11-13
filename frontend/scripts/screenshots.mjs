// Captures every RouteWise screen at 1920, 1280 and 375 px against the running app
// (UI on :4200, API on :8087), logged in with the public demo account.
//
//   npm run screenshots                          -> docs/screenshots/work/<screen>-<width>.png
//   npm run screenshots -- --prefix after-       -> docs/screenshots/work/after-<screen>-<width>.png
//   npm run screenshots -- --final --prefix after-   -> docs/screenshots/after-…  (committed sets)
//   npm run screenshots -- --only trips-list,account-menu --widths 1920
//
// Step reviews belong in docs/screenshots/work/ (git-ignored); only final before-/after- sets go
// to docs/screenshots/. Never point it at docs/photo.jpg.
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.ROUTEWISE_UI_URL ?? 'http://localhost:4200';
const API_URL = process.env.ROUTEWISE_API_URL ?? 'http://localhost:8087';
const DEMO = { email: 'demo@routewise.app', password: 'demo1234' };
const HEIGHTS = { 1920: 1080, 1280: 800, 375: 812 };

const args = parseArgs(process.argv.slice(2));
const docs = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots');
const outDir = args.final ? docs : join(docs, 'work');
const widths = (args.widths ?? '1920,1280,375').split(',').map(Number);
const only = args.only ? new Set(args.only.split(',')) : null;

/** Each screen: where to go and what to do there before the capture. */
const SCREENS = [
  { name: 'home', path: '/' },
  { name: 'home-route', path: '/?from={berlin}&to={vienna}', settle: 2500 },
  {
    name: 'home-map',
    path: '/?from={berlin}&to={vienna}',
    minWidth: 1440,
    layout: 'map',
    settle: 2500,
  },
  { name: 'trips', path: '/trips' },
  {
    name: 'trips-list',
    path: '/trips',
    action: (page) => page.getByRole('radio', { name: 'List' }).first().click(),
  },
  { name: 'trip-details', path: '/trips/{firstTrip}', settle: 2000 },
  { name: 'trip-form', path: '/trips/new' },
  { name: 'modes', path: '/modes' },
  {
    name: 'account-menu',
    minWidth: 768,
    path: '/trips',
    action: (page) =>
      page
        .getByRole('button', { name: /account menu/i })
        .first()
        .click(),
  },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const ids = await lookupIds();
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: HEIGHTS[width] ?? 900 },
      deviceScaleFactor: 1,
      // The app is dark; headless Chromium would otherwise report a light preference.
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    // Headless Chromium reports reduced transparency (solid glass); the review shows the glass look.
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'no-preference' }],
    });
    await login(page);
    for (const screen of SCREENS) {
      if ((only && !only.has(screen.name)) || (screen.minWidth && width < screen.minWidth)) {
        continue;
      }
      await page.evaluate(
        (layout) => localStorage.setItem('routewise.homeLayout', layout),
        screen.layout ?? 'split',
      );
      await page.goto(BASE_URL + fill(screen.path, ids), { waitUntil: 'networkidle' });
      if (screen.action) {
        await screen.action(page);
        await page.waitForLoadState('networkidle');
      }
      await page.waitForTimeout(screen.settle ?? 1200);
      const file = join(outDir, `${args.prefix ?? ''}${screen.name}-${width}.png`);
      await page.screenshot({ path: file });
      console.log(`saved ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await clickText(page, 'button', 'Try the demo');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** City and trip ids for the URLs, read from the API so the script survives reseeding. */
async function lookupIds() {
  const cities = await (await fetch(`${API_URL}/api/cities`)).json();
  const id = (name) => cities.find((city) => city.name === name)?.id;
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  const trips = await page.evaluate(async (api) => {
    const response = await fetch(`${api}/api/trips?size=1`, { credentials: 'include' });
    return response.ok ? response.json() : null;
  }, API_URL);
  await context.close();
  return { berlin: id('Berlin'), vienna: id('Vienna'), firstTrip: trips?.items?.[0]?.id ?? 1 };
}

function fill(path, ids) {
  return path.replace(/\{(\w+)\}/g, (_, key) => String(ids[key]));
}

async function clickText(page, role, text) {
  await page.getByRole(role, { name: text, exact: false }).first().click();
}

function parseArgs(list) {
  const result = {};
  for (let i = 0; i < list.length; i++) {
    const key = list[i].replace(/^--/, '');
    const next = list[i + 1];
    if (next === undefined || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i++;
    }
  }
  return result;
}
