import { Page, expect, test } from '@playwright/test';

/**
 * The idle rotation of the Home globe, seen from outside: the angle the map exposes as `data-longitude`
 * must change while nothing touches the globe, and must not change when the user turned Auto-rotate off.
 * Each case reads the angle twice, a few seconds apart.
 */

const MAP = 'app-route-map svg.map';
const READ_GAP_MS = 4000;

test.beforeEach(async ({ page, context }) => {
  // Headless Chromium reports reduced transparency (solid glass); the app is meant to be seen as glass.
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'no-preference' }],
  });
});

async function openHome(page: Page, layout: 'split' | 'map'): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('routewise.homeLayout', value), layout);
  await page.goto('/');
  await expect(page.locator(MAP)).toBeVisible();
  await expect(page.locator('app-route-map path.land')).toHaveAttribute('d', /.+/);
  await page.mouse.move(2, 2); // off the map
  await page.waitForTimeout(3000);
}

const angle = async (page: Page): Promise<number> =>
  Number(await page.locator(MAP).getAttribute('data-longitude'));

async function angleTwice(page: Page): Promise<[number, number]> {
  const first = await angle(page);
  await page.waitForTimeout(READ_GAP_MS);
  return [first, await angle(page)];
}

async function mapBox(page: Page) {
  const box = await page.locator(MAP).boundingBox();
  if (!box) {
    throw new Error('The globe map has no box');
  }
  return box;
}

test('turns by itself with the mouse off the map', async ({ page }) => {
  await openHome(page, 'split');

  const [first, second] = await angleTwice(page);

  expect(second).not.toBe(first);
});

test('keeps turning with the mouse on the map beside the globe (Split)', async ({ page }) => {
  await openHome(page, 'split');
  const box = await mapBox(page);

  await page.mouse.move(box.x + box.width - 8, box.y + 8); // a corner of the map, clear of the disc
  const [first, second] = await angleTwice(page);

  expect(second).not.toBe(first);
});

test('keeps turning with the mouse on the empty area of the full-width map (Map layout)', async ({
  page,
}) => {
  await openHome(page, 'map');
  const box = await mapBox(page);

  await page.mouse.move(box.x + box.width / 2, box.y + 6);
  const [first, second] = await angleTwice(page);

  expect(second).not.toBe(first);
});

test('stops while the mouse is over the globe', async ({ page }) => {
  await openHome(page, 'split');
  const box = await mapBox(page);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40);
  await page.waitForTimeout(500);
  const [first, second] = await angleTwice(page);

  expect(second).toBe(first);
});

test('resumes 10 s after a click on the globe once the mouse has left the map', async ({
  page,
}) => {
  await openHome(page, 'split');
  const box = await mapBox(page);
  // A spot on the sea or land that is not a city or a control, so the click only focuses the map.
  const spot = await page.evaluate(({ x, y, width, height }) => {
    for (const [dx, dy] of [
      [-0.25, -0.1],
      [0.2, 0.25],
      [-0.3, 0.2],
      [0.3, -0.25],
      [0, 0.3],
    ]) {
      const px = x + width / 2 + dx * width * 0.8;
      const py = y + height / 2 + dy * height * 0.8;
      const hit = document.elementFromPoint(px, py);
      if (hit?.closest('svg.map') && !hit.closest('g.city, .trip-hit')) {
        return { x: px, y: py };
      }
    }
    return null;
  }, box);
  expect(spot).not.toBeNull();

  await page.mouse.click(spot!.x, spot!.y);
  await page.mouse.move(2, 2);
  const inMap = await page.evaluate(() =>
    document.activeElement?.closest('app-route-map') ? true : false,
  );
  expect(inMap).toBe(true); // the click left focus inside the map: it must not block the rotation
  await page.waitForTimeout(11_000);
  const [first, second] = await angleTwice(page);

  expect(second).not.toBe(first);
});

test('does not turn when Auto-rotate is off', async ({ page }) => {
  await openHome(page, 'split');
  const toggle = page.getByRole('button', { name: 'Auto-rotate' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(3000);
  const [first, second] = await angleTwice(page);

  expect(second).toBe(first);
});
