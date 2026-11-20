import test from 'node:test';
import assert from 'node:assert/strict';
import { analysePixels, fitFromEvidence, STAGES } from '../bag-evidence.js';
import { makePattern } from '../bag-patterns.js';
import { createBagSpec } from '../bag-spec.js';
function sample(alpha = false) {
  const w = 84,
    h = 72,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const body = y > 22 && y < 66 && Math.abs(x - 42) < 12 + (65 - y) * 0.3;
      const handle =
        y > 5 &&
        y <= 22 &&
        (Math.abs(x - 28) < 2 || Math.abs(x - 55) < 2 || (y < 9 && x > 27 && x < 56));
      data.set(
        body || handle ? [111, 57, 38, 255] : [242, 242, 242, alpha ? 0 : 255],
        4 * (y * w + x),
      );
    }
  return { data, w, h };
}
test('local object masks separate handles, recover colors, abstain on empty and clipped views', () => {
  for (const alpha of [true, false]) {
    const { data, w, h } = sample(alpha),
      r = analysePixels(data, w, h);
    assert.equal(r.status, 'candidate');
    assert.equal(r.color, '#6f3926');
    assert.ok(r.widthProfile[0] < r.widthProfile[4]);
    assert.ok(r.bands.length > 20);
    for (let y = 30; y < 40; y++)
      for (let x = 0; x < 43; x++) data.set([111, 57, 38, 255], (y * w + x) * 4);
    assert.equal(analysePixels(data, w, h).reason, 'clipped');
  }
  const blank = new Uint8ClampedArray(100 * 100 * 4);
  assert.equal(analysePixels(blank, 100, 100).status, 'abstained');
});
test('only explicitly assigned, attached frontal evidence can fit a pattern; disagreeing views abstain', () => {
  const { data, w, h } = sample(),
    analysis = analysePixels(data, w, h),
    ref = { id: 'a', view: 'front', source: 'filename', analysis };
  assert.equal(fitFromEvidence([ref]).fit, null);
  ref.source = 'merchant';
  const { fit } = fitFromEvidence([ref]);
  assert.deepEqual(fit.sources, ['a']);
  const s = createBagSpec({});
  assert.notDeepEqual(makePattern(s).width, makePattern(s, fit.widths).width);
  assert.equal(fitFromEvidence([{ ...ref, linked: false }]).fit, null);
  assert.equal(
    fitFromEvidence([
      ref,
      { ...ref, view: 'back', analysis: { ...analysis, widthProfile: [1, 1, 1, 1, 1] } },
    ]).status,
    'inconsistent-views',
  );
  assert.equal(STAGES.interiorInference, 'unavailable');
});
test('optional reconstruction stages abstain on unknown sources and record provider failures independently', async () => {
  const { reconstructDraft } = await import('../bag-evidence.js');
  const p = { id: 'known', view: 'inside', source: 'merchant', url: 'blob:private', bytes: 125 };
  const result = await reconstructDraft(createBagSpec({}), [p], {
    provider: {
      capabilities: ['part-segmentation', 'interior-inference', 'viewpoint-estimation'],
      runStage({ stage, evidence }) {
        assert.ok(evidence.every((r) => !r.url && !r.bytes));
        if (stage === 'interior-inference') throw Error('offline');
        return {
          findings: [
            { label: 'divider', sources: [stage === 'part-segmentation' ? 'known' : 'other'] },
          ],
        };
      },
    },
  });
  const stage = (id) => result.stages.find((s) => s.id === id).status;
  assert.equal(stage('part-segmentation'), 'candidate');
  assert.equal(stage('viewpoint-estimation'), 'abstained');
  assert.equal(stage('interior-inference'), 'failed');
  assert.equal(stage('multiview-texture-baking'), 'unavailable');
  assert.equal(result.photoGeometryVerified, false);
});

test('reference swatches ignore object-fit letterboxes in landscape and portrait views', async () => {
  const { photoPoint } = await import('../bag-evidence.js');
  assert.deepEqual(photoPoint(500, 300, 200, 400, 250, 150), [0.5, 0.5]);
  assert.equal(photoPoint(500, 300, 200, 400, 5, 150), null);
  assert.equal(photoPoint(100, 300, 400, 200, 50, 15), null);
  assert.deepEqual(photoPoint(100, 300, 400, 200, 50, 175), [0.5, 1]);
});

test('guided body contours can fit a busy backdrop and keep manual evidence distinct', async () => {
  const { tracedEnvelope } = await import('../bag-outline.js');
  const { fitFromEvidence } = await import('../bag-evidence.js');
  const points = [
    [0.11, 0.86],
    [0.08, 0.59],
    [0.15, 0.35],
    [0.35, 0.25],
    [0.7, 0.25],
    [0.84, 0.36],
    [0.92, 0.6],
    [0.88, 0.86],
  ];
  assert.equal(
    tracedEnvelope([
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ]),
    null,
  );
  assert.equal(
    tracedEnvelope([
      [0.2, 0.2],
      [0.21, 0.22],
      [0.23, 0.23],
      [0.22, 0.21],
    ]),
    null,
  );
  assert.equal(tracedEnvelope(points).widthProfile.length, 5);
  const p = {
    id: 'photo',
    view: 'front',
    source: 'merchant',
    linked: true,
    analysis: { status: 'abstained', reason: 'complex-background' },
    outline: { view: 'front', points },
  };
  const fit = fitFromEvidence([p]);
  assert.deepEqual(fit.fit.guidedSources, ['photo']);
  assert.ok(fit.fit.widths.every((v) => v >= 0.35 && v <= 1));
  assert.equal(fitFromEvidence([{ ...p, linked: false }]).fit, null);
  assert.equal(fitFromEvidence([{ ...p, view: 'back' }]).fit, null);
});

test('a slightly tilted straight hem preserves traced width at the foot', async () => {
  const { tracedEnvelope } = await import('../bag-outline.js');
  const shape = [
    [0.12, 0.8],
    [0.08, 0.62],
    [0.18, 0.39],
    [0.39, 0.25],
    [0.66, 0.25],
    [0.83, 0.39],
    [0.91, 0.63],
    [0.86, 0.8],
  ];
  const skew = shape.map(([x, y]) => [x, y + (x - 0.5) * 0.075]);
  const clean = tracedEnvelope(shape).widthProfile,
    corrected = tracedEnvelope(skew).widthProfile;
  assert.ok(clean.every((v, i) => Math.abs(v - corrected[i]) < 1e-6));
});
