import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const studio = fileURLToPath(new URL('../', import.meta.url)),
  root = resolve(studio, '..'),
  out = resolve(studio, 'test-results/browser');
await mkdir(out, { recursive: true });
const baseline = resolve(studio, 'tests/browser/visual-baseline.json');
const map = {
  imports: {
    three: '/studio/vendor/three/build/three.module.min.js',
    'three/addons/': '/studio/vendor/three/examples/jsm/',
  },
};
const bench =
  '<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}#bench{width:600px;height:460px;background:radial-gradient(ellipse at 50% 35%,#eeeade,#e2ded2)}canvas{display:block}</style><div id="bench"></div><script type="importmap">' +
  JSON.stringify(map) +
  '</script><script type="module" src="/studio/tests/browser/scene.js"></script>';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__bag_qa') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(bench);
    return;
  }
  let file = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (url.pathname.endsWith('/')) file = resolve(file, 'index.html');
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type':
        {
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.html': 'text/html',
          '.webp': 'image/webp',
          '.json': 'application/json',
        }[extname(file)] || 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const args = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
if (process.env.BAG_BROWSER_SINGLE_PROCESS === '1')
  args.push('--single-process', '--no-zygote', '--in-process-gpu');
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.BAG_CHROMIUM || undefined, args });
  const context = await browser.newContext({
    viewport: { width: 1330, height: 870 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage(),
    errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(base + '/studio/bag-builder.html');
  await page.waitForFunction(
    () =>
      document.querySelector('#stage canvas') && document.querySelector('#stage-message').hidden,
  );
  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await settle();
  await page.screenshot({ path: resolve(out, 'atelier-ar.png') });
  await page.click('#language');
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  await page.click('#theme');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.click('#theme');
  const step = (i) => page.locator('#steps button').nth(i).click();
  const input = async (id, value) => {
    await page.locator('#' + id).fill(String(value));
    await page.locator('#' + id).dispatchEvent('change');
  };
  await input('depthCm', 14);
  await page.waitForFunction(() =>
    document.querySelector('#measure-summary').textContent.includes('14'),
  );
  // Real pointer raycast on the visible product must open the part editor.
  const rect = await page.locator('#stage canvas').boundingBox();
  await page.mouse.click(rect.x + rect.width * 0.5, rect.y + rect.height * 0.61);
  assert.equal(await page.locator('.page[data-page="3"]').isVisible(), true);
  await page.selectOption('#part-select', 'handle_1');
  await input('edit-lengthScale', 1.17);
  await page.click('#save-part-correction');
  await page.waitForFunction(
    () => document.querySelector('#reset-part') && !document.querySelector('#reset-part').disabled,
  );
  await page.click('#undo');
  await page.waitForFunction(() => document.querySelector('#reset-part').disabled);
  await page.click('#redo');
  await page.waitForFunction(() => !document.querySelector('#reset-part').disabled);
  await step(0);
  await page
    .locator('details')
    .filter({ hasText: 'Branding and hardware' })
    .locator('summary')
    .click();
  await page.check('#brandLicenseConfirmed');
  await step(1);
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');
    canvas.width = 160;
    canvas.height = 100;
    ctx.fillStyle = '#84442e';
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(140, 20);
    ctx.lineTo(116, 89);
    ctx.lineTo(44, 89);
    ctx.closePath();
    ctx.fill();
    const front = canvas.toDataURL().split(',')[1];
    ctx.clearRect(0, 0, 160, 100);
    ctx.fillStyle = '#ffd380';
    ctx.fillRect(50, 20, 60, 60);
    return { front, logo: canvas.toDataURL().split(',')[1] };
  });
  await page.setInputFiles(
    '#photos-input',
    ['front', 'logo'].map((k) => ({
      name: k + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from(fixture[k], 'base64'),
    })),
  );
  await page.waitForFunction(() => document.querySelectorAll('.photo-row').length === 2);
  await page.getByRole('button', { name: 'Confirm view' }).first().click();
  await page.getByRole('button', { name: 'Confirm view' }).first().click();
  await step(2);
  await page.click('#generate');
  await page.waitForFunction(() =>
    document.querySelector('#fit-status').textContent.includes('Applied'),
  );
  await step(3);
  await page.selectOption('#compare-photo', { label: 'Front · front.png' });
  assert.equal(await page.locator('#camera').inputValue(), 'front');
  await page.check('#show-inside');
  await page.selectOption('#part-select', 'inner_zip_pocket_1');
  await page.screenshot({ path: resolve(out, 'comparison.png') });
  await step(4);
  await page.click('#approve');
  async function download(id) {
    const event = page.waitForEvent('download');
    await page.click('#' + id);
    const file = await event;
    return readFile(await file.path());
  }
  const project = JSON.parse(await download('download-project')),
    graph = JSON.parse(await download('download-json')),
    glb = await download('download-glb');
  assert.equal(project.project.approval, 'merchant-reviewed');
  assert.ok(
    project.project.feedback.some(
      (f) => f.category === 'silhouette-fit' && f.approval === 'merchant-approved',
    ),
  );
  assert.ok(project.images.every((p) => !p.url && !p.data));
  assert.ok(project.project.fit.sources.length === 1);
  assert.equal(graph.units, 'm');
  assert.equal(graph.pose, 'closed-neutral');
  assert.equal(graph.verification.retailARReady, false);
  assert.ok(graph.materials.source.includes('logo'));
  assert.equal(glb.subarray(0, 4).toString(), 'glTF');
  await page.setInputFiles('#project-file', {
    name: 'reopen.fit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await step(1);
  assert.equal(await page.getByText('Choose the original file').count(), 2);
  await page.setInputFiles('#photos-input', {
    name: 'renamed.png',
    mimeType: 'image/png',
    buffer: Buffer.from(fixture.front, 'base64'),
  });
  await page.waitForFunction(() => document.querySelectorAll('.photo-row img').length === 1);
  await step(4);
  const restored = JSON.parse(await download('download-project'));
  assert.equal(restored.images.length, 2);
  assert.equal(restored.project.approval, 'merchant-reviewed');
  assert.deepEqual(restored.project.fit, project.project.fit);
  const conflict = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#84442e';
    ctx.fillRect(20, 20, 120, 69);
    return canvas.toDataURL().split(',')[1];
  });
  await step(1);
  await page.setInputFiles('#photos-input', {
    name: 'back.png',
    mimeType: 'image/png',
    buffer: Buffer.from(conflict, 'base64'),
  });
  await page.waitForFunction(() => document.querySelectorAll('.photo-row img').length === 2);
  await page.getByRole('button', { name: 'Confirm view' }).click();
  await step(4);
  assert.equal(
    JSON.parse(await download('download-project')).project.fit,
    null,
    'a conflicting assigned outline invalidates the previous fit',
  );
  assert.ok(
    requests.every(
      (url) => url.startsWith(base) || url.startsWith('blob:') || url.startsWith('data:'),
    ),
    'builder sent a cross-origin request',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await step(0);
  await settle();
  await page.screenshot({ path: resolve(out, 'mobile.png') });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'mobile horizontal overflow',
  );
  await page.goto(base + '/__bag_qa');
  await page.waitForFunction(() => window.bagQA);
  const shots = {};
  async function capture(id, opts) {
    await page.evaluate((opt) => window.bagQA.pose(opt), opts);
    shots[id] = (await page.evaluate(() => window.bagQA.signature())).sample;
    await page.locator('#bench').screenshot({ path: resolve(out, id + '.png') });
  }
  await page.setViewportSize({ width: 660, height: 500 });
  for (const view of ['front', 'back', 'left', 'right', 'top', 'bottom', 'inside'])
    await capture(view, {
      view,
      open: view === 'inside' ? 1 : 0,
      cut: view === 'inside',
      patch: { mainCompartments: 3 },
    });
  for (const [state, open] of [
    ['closed', 0],
    ['open', 1],
  ])
    await capture(state, { open });
  for (const style of [
    'structured',
    'tote',
    'baguette',
    'hobo',
    'bucket',
    'clutch',
    'saddle',
    'backpack',
  ])
    await capture('family-' + style, { style });
  const roundTrip = await page.evaluate(
    (bytes) => window.bagQA.roundTrip(bytes, 'structured', true),
    Array.from(glb),
  );
  await page.locator('#bench').screenshot({ path: resolve(out, 'glb-reimport.png') });
  const closures = await page.evaluate(() => window.bagQA.otherClosures());
  const sample = await page.evaluate(() => window.bagQA.sampleAsset());
  await writeFile(resolve(out, 'satchel-mobile.glb'), Buffer.from(sample.glb, 'base64'));
  await writeFile(
    resolve(out, 'satchel-mobile.parts.json'),
    JSON.stringify(sample.graph, null, 2) + '\n',
  );
  const memory = await page.evaluate(() => window.bagQA.exercise());
  if (process.argv.includes('--update-baseline'))
    await writeFile(baseline, JSON.stringify(shots, null, 2) + '\n');
  const expected = JSON.parse(await readFile(baseline));
  for (const [id, actual] of Object.entries(shots)) {
    assert.equal(actual.length, expected[id]?.length, id + ' signature size');
    let union = 0,
      error = 0,
      different = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== '0' || expected[id][i] !== '0') union++;
      if ((actual[i] === '0') !== (expected[id][i] === '0')) different++;
      error += Math.abs(Number(actual[i]) - Number(expected[id][i]));
    }
    assert.ok(different / union < 0.1 && error / union < 1.0, id + ' render differs from baseline');
  }
  assert.deepEqual(errors, []);
  const report = {
    browser: browser.version(),
    roundTrip,
    closures,
    sample: sample.checked,
    memory,
    snapshots: Object.keys(shots).length,
  };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  server.close();
}
