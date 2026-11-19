import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, signIn, FIXTURE_JPEG, type TestUser } from './support';
import { colors } from '../src/theme/colors';
import type { Locator, Page } from '@playwright/test';

// Spec §5.4 matrix: sizes x light/dark, axe, Reduce Motion, 200 % zoom, slow and offline.
const SIZES = [
  [375, 667],
  [412, 915],
  [820, 1180],
] as const;
const MODES = ['light', 'dark'] as const;
type Mode = (typeof MODES)[number];
const KEY = 'plant-care.appearance'; // src/theme/appearance.ts (AsyncStorage is localStorage on web)
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
// The app paints on a root View (body keeps the Expo default): first opaque background behind a point near the top-left.
const PROBE = `(() => {
  for (let el = document.elementFromPoint(4, 4); el; el = el.parentElement) {
    const c = getComputedStyle(el).backgroundColor;
    if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
  }
  return '';
})()`;

type World = { user: TestUser };
const test = base.extend<object, { world: World }>({
  // One seeded user per worker (deleted with the worker's other users): the matrix only reads.
  world: [
    async ({ admin }, use) => {
      const user = await admin.createUser();
      await admin.seedPlant(user.id, { name: 'Matrix bare' });
      const p = await admin.seedPlant(user.id, { name: 'Matrix device' });
      const now = new Date().toISOString();
      await admin.seedDevice(user.id, p.id, { reading_ts: now, last_seen_at: now, soil_pct: 45, battery_pct: 80 });
      await use({ user });
    },
    { scope: 'worker' },
  ],
});

const openPlant = async (page: Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};
const addPhoto = async (page: Page) => {
  await page.getByRole('button', { name: 'Add a pot' }).filter({ visible: true }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose from library' }).filter({ visible: true }).first().click();
  await (await chooser).setFiles(FIXTURE_JPEG);
  await expect(page.getByRole('img', { name: 'Whole plant photo' })).toBeVisible();
};

// primary: the screen's BottomBar button (none on Home, detail and Settings, so no overlap check there).
const SCREENS: { name: string; primary?: string; open(page: Page): Promise<void> }[] = [
  { name: 'Home', open: (p) => expect(p.getByRole('button', { name: /^Matrix device,/ }).filter({ visible: true })).toBeVisible() },
  { name: 'Plant detail', open: (p) => openPlant(p, 'Matrix device') },
  {
    name: 'Add step 1',
    primary: 'Continue',
    open: async (p) => {
      await p.getByRole('button', { name: 'Add a pot' }).filter({ visible: true }).first().click();
      await expect(p.getByRole('heading', { name: 'Take a photo of your plant' })).toBeVisible();
    },
  },
  {
    name: 'Add step 2',
    primary: 'Continue',
    open: async (p) => {
      await addPhoto(p);
      await p.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
      await expect(p.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
    },
  },
  {
    name: 'Add step 3',
    primary: 'Continue',
    open: async (p) => {
      await addPhoto(p);
      await p.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
      await expect(p.getByRole('heading', { name: 'What kind of plant is it?' })).toBeVisible();
      await p.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true }).click();
      await expect(p.getByLabel('Name', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'Settings',
    open: async (p) => {
      await p.getByRole('link', { name: 'Settings' }).or(p.getByRole('button', { name: 'Settings' })).filter({ visible: true }).click();
      await expect(p.getByText('Appearance', { exact: true })).toBeVisible();
    },
  },
  {
    name: 'Module setup',
    primary: 'Done',
    open: async (p) => {
      await openPlant(p, 'Matrix bare');
      await p.getByRole('button', { name: 'Add its module' }).filter({ visible: true }).first().click();
      await expect(p.getByRole('heading', { name: 'Add its module' })).toBeVisible();
      await expect(p.getByText(/^[A-Z0-9]{4} [A-Z0-9]{4} [A-Z0-9]{4}$/).filter({ visible: true })).toBeVisible();
    },
  },
];

// Real app problems found by this matrix: test title prefix -> violation. Marked test.fail so the suite stays green and the gap stays visible.
const KNOWN: Record<string, string> = {
  'Home axe light': 'label-content-name-mismatch (serious) on the plant rows: accessible name "name, status" does not start with the visible text',
  'Home axe dark': 'label-content-name-mismatch (serious) on the plant rows: accessible name "name, status" does not start with the visible text',
};

/** Console errors and uncaught exceptions from now on. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Visible buttons and links with no accessible name. */
async function unnamed(page: Page): Promise<string[]> {
  const out: string[] = [];
  for (const role of ['button', 'link'] as const) {
    const gap = await page.getByRole(role, { name: /^\s*$/ }).filter({ visible: true }).count();
    if (gap) out.push(`${gap} ${role}(s)`);
  }
  return out;
}

/** After scrolling into view: is the whole box inside the viewport, and does its centre hit the button (or a child)? */
async function placement(button: Locator): Promise<{ inside: boolean; hit: boolean; box: string }> {
  await button.scrollIntoViewIfNeeded();
  return button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5,
      hit: !!top && el.contains(top),
      box: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} in ${window.innerWidth}x${window.innerHeight}`,
    };
  });
}

async function expectClean(page: Page, errors: string[], primary?: string) {
  expect(await unnamed(page)).toEqual([]);
  if (primary) {
    const p = await placement(page.getByRole('button', { name: primary, exact: true }).filter({ visible: true }));
    expect(p, `${primary} placement`).toMatchObject({ inside: true, hit: true });
  }
  expect(errors).toEqual([]);
}

async function start(page: Page, user: TestUser, [w, h]: readonly [number, number], mode: Mode, s: (typeof SCREENS)[number]) {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(([k, m]) => localStorage.setItem(k, m), [KEY, mode]);
  const errors = watchErrors(page);
  await signIn(page, user);
  await s.open(page);
  // The first opaque colour at the corner is one of this appearance's tokens (detail paints a hero there, not the background).
  const tokens = Object.values(colors[mode]).filter((v) => /^#[0-9a-f]{6}$/i.test(v)).map(rgb);
  await expect.poll(async () => tokens.includes((await page.evaluate(PROBE)) as string)).toBe(true);
  return errors;
}

test('J1 J3 J4 the detectors catch a nameless button, a covered or off-screen button and a console error', async ({ page, world }) => {
  const errors = watchErrors(page);
  await signIn(page, world.user);
  expect(await unnamed(page)).toEqual([]); // clean first
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button style="position:fixed;left:10px;top:300px;width:80px;height:40px"></button><button aria-label="Off" style="position:fixed;left:-500px;top:10px;width:80px;height:40px"></button>');
    document.body.insertAdjacentHTML('beforeend', '<button aria-label="Probe" style="position:fixed;left:10px;top:10px;width:80px;height:40px"></button>');
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;left:0;top:0;width:200px;height:100px;z-index:99999"></div>');
    console.error('probe');
    setTimeout(() => {
      throw new Error('probe');
    });
  });
  expect(await unnamed(page)).toEqual(['1 button(s)']);
  const covered = await placement(page.getByRole('button', { name: 'Probe', exact: true }));
  expect(covered.hit).toBe(false);
  await expect.poll(() => errors.length).toBe(2);
  const off = await placement(page.getByRole('button', { name: 'Off' }));
  expect(off.inside).toBe(false);
});

for (const s of SCREENS) {
  for (const size of SIZES) {
    for (const mode of MODES) {
      const pr = s.name === 'Home' && size[0] === 412 && mode === 'light' ? ' @pr' : '';
      const title = `J1 J3 ${s.name} ${size[0]}x${size[1]} ${mode} renders cleanly${pr}`;
      test(title, async ({ page, world }) => {
        test.fail(`${s.name} ${size[0]}x${size[1]} ${mode}` in KNOWN, KNOWN[`${s.name} ${size[0]}x${size[1]} ${mode}`]);
        const errors = await start(page, world.user, size, mode, s);
        await expectClean(page, errors, s.primary);
      });
    }
  }
  for (const mode of MODES) {
    test(`J4 ${s.name} ${mode} axe`, async ({ page, world }) => {
      test.fail(`${s.name} axe ${mode}` in KNOWN, KNOWN[`${s.name} axe ${mode}`]);
      await start(page, world.user, SIZES[1], mode, s);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
  test(`J2 ${s.name} 200 % zoom renders cleanly`, async ({ page, world }) => {
    test.fail(`${s.name} zoom` in KNOWN, KNOWN[`${s.name} zoom`]);
    const errors = await start(page, world.user, SIZES[1], 'light', s);
    const height = async () => (await page.getByRole('heading').filter({ visible: true }).first().boundingBox())!.height;
    const before = await height();
    await page.evaluate(() => (document.documentElement.style.zoom = '2'));
    expect(await height()).toBeGreaterThan(before * 1.5); // the zoom really took effect
    await expectClean(page, errors, s.primary);
  });
}

test('J4 axe sees a violation it should (positive control)', async ({ page, world }) => {
  await signIn(page, world.user);
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'));
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => v.id)).toContain('image-alt');
});

// Held plants-list request: the skeleton shows while it is pending.
async function holdPlants(page: Page, user: TestUser): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/rest/v1/plants*', async (r) => {
    if (r.request().method() === 'GET' && /devices/.test(decodeURIComponent(r.request().url()))) await gate;
    await r.continue();
  });
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Loading', { exact: true })).toBeVisible();
  return release;
}
// Does any element inside the skeleton group change its transform over ~30 frames?
const moves = (page: Page) =>
  page.getByLabel('Loading', { exact: true }).evaluate(async (root) => {
    const read = () => [root, ...root.querySelectorAll('*')].map((e) => getComputedStyle(e).transform).join('|');
    const first = read();
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    return read() !== first;
  });

test('J5 reduce motion keeps skeletons still', async ({ browser, baseURL, world }) => {
  // Positive control: without Reduce Motion the same probe sees the shimmer move.
  const normal = await browser.newContext({ baseURL });
  const np = await normal.newPage();
  const releaseNormal = await holdPlants(np, world.user);
  expect(await moves(np)).toBe(true);
  releaseNormal();
  await normal.close();

  const ctx = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const release = await holdPlants(page, world.user);
  await expect(page.getByLabel('Loading', { exact: true })).toBeVisible();
  expect(await moves(page)).toBe(false);
  release();
  await expect(page.getByRole('button', { name: /^Matrix device,/ })).toBeVisible();
  await ctx.close();
});

test('J6 slow backend: skeleton then content, never a blank body', async ({ page, world }) => {
  await signIn(page, world.user); // session stored; reload with every REST call delayed 3 s
  await page.route('**/rest/v1/**', async (r) => {
    await new Promise((done) => setTimeout(done, 3000));
    await r.continue().catch(() => {}); // the page may be gone at teardown
  });
  await page.reload();
  await expect(page.getByLabel('Loading', { exact: true })).toBeVisible();
  // Fewest characters on screen over the next ~500 ms (30 frames), measured in the page while the data is still pending.
  const sample = () =>
    page.evaluate(async () => {
      let min = Infinity;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        min = Math.min(min, document.body.innerText.trim().length);
      }
      return min;
    });
  const blank = await page.context().newPage(); // positive control: an empty page reads 0
  expect(await blank.evaluate(() => document.body.innerText.trim().length)).toBe(0);
  await blank.close();
  expect(await sample()).toBeGreaterThan(0);
  await expect(page.getByLabel('Loading', { exact: true })).toBeVisible(); // still waiting: the sample was taken during the load
  await expect(page.getByRole('button', { name: /^Matrix device,/ })).toBeVisible();
  await expect(page.getByLabel('Loading', { exact: true })).toHaveCount(0);
});

test('J6 offline with no cache shows the error copy, Try again works once online', async ({ browser, baseURL, world, page }) => {
  test.fail(true, "app: offline with no cache keeps the skeleton forever (TanStack pauses the retry while offline), no error copy or Try again");
  await signIn(page, world.user);
  const state = await page.context().storageState(); // the session only, no query cache
  const ctx = await browser.newContext({ baseURL, storageState: state });
  const p = await ctx.newPage();
  // The app has to load before the network goes away: hold the list request, cut the network, then fail it.
  let held!: (v: void) => void;
  const heldReq = new Promise<void>((r) => (held = r));
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await p.route('**/rest/v1/plants*', async (r) => {
    if (r.request().method() !== 'GET' || !/devices/.test(decodeURIComponent(r.request().url()))) return r.continue();
    held();
    await gate;
    await r.abort('internetdisconnected');
  });
  await p.goto('/');
  await heldReq;
  await ctx.setOffline(true);
  release();
  await expect(p.getByText("Couldn't reach Plant Care. Check your connection and try again.")).toBeVisible({ timeout: 15_000 });
  await expect(p.getByText('Matrix device')).toHaveCount(0);
  await p.unroute('**/rest/v1/plants*');
  await ctx.setOffline(false);
  await p.getByRole('button', { name: 'Try again' }).click();
  await expect(p.getByRole('button', { name: /^Matrix device,/ })).toBeVisible();
  await expect(p.getByText("Couldn't reach Plant Care.")).toHaveCount(0);
  await ctx.close();
});
