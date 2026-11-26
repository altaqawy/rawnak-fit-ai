import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBagSpec,
  requiredBagViews,
  describeBagComponents,
  evaluateBagCapture,
  makeBagDraft,
  detectViewFromName,
} from '../bag-spec.js';

test('merchant bag builder retains real dimensions and limits invalid values', () => {
  const spec = createBagSpec({
    style: 'tote',
    widthCm: 36,
    heightCm: 28,
    depthCm: 15,
    mainCompartments: 3,
    innerOpenPockets: 2,
    innerZippedPockets: 1,
    outerPockets: 1,
    strapCount: 2,
    strapType: 'crossbody',
    strapLengthCm: 125,
    flexibility: 72,
    closure: 'zipper',
    logoPlacement: 'front',
    logoType: 'metal',
  });
  assert.equal(spec.widthCm, 36);
  assert.equal(spec.heightCm, 28);
  assert.equal(spec.depthCm, 15);
  assert.equal(spec.mainCompartments, 3);
  assert.equal(spec.strapLengthCm, 125);
  assert.equal(spec.flexibility, 72);
  assert.equal(spec.closure, 'zipper');
  assert.equal(spec.logoPlacement, 'front');
  const invalid = createBagSpec({
    style: 'invalid',
    widthCm: -100,
    depthCm: 9999,
    innerOpenPockets: 200,
    bodyColor: 'red',
  });
  assert.equal(invalid.style, 'structured');
  assert.equal(invalid.widthCm, 28);
  assert.equal(invalid.depthCm, 11);
  assert.equal(invalid.innerOpenPockets, 1);
  assert.equal(invalid.bodyColor, '#996247');
});
test('photos required adapt to compartments, closure, logo and strap', () => {
  const a = requiredBagViews({
    innerOpenPockets: 2,
    closure: 'zipper',
    logoPlacement: 'front',
    strapCount: 1,
  });
  for (const view of [
    'front',
    'back',
    'left',
    'right',
    'bottom',
    'top',
    'open',
    'inside',
    'pockets',
    'closure',
    'logo',
    'strap',
  ])
    assert.ok(a.includes(view), view);
  const b = requiredBagViews({
    innerOpenPockets: 0,
    innerZippedPockets: 0,
    outerPockets: 0,
    strapType: 'none',
    handlesCount: 0,
    closure: 'open',
    logoPlacement: 'none',
  });
  assert.ok(!b.includes('pockets'));
  assert.ok(!b.includes('closure'));
  assert.ok(!b.includes('logo'));
  assert.ok(!b.includes('strap'));
});
test('every structural component has separate movable/rigid behavior', () => {
  const spec = createBagSpec({
    mainCompartments: 3,
    innerOpenPockets: 2,
    innerZippedPockets: 1,
    outerPockets: 1,
    strapCount: 1,
    handlesCount: 2,
    closure: 'flap',
    logoPlacement: 'front',
  });
  const parts = describeBagComponents(spec);
  const ids = parts.map((x) => x.id);
  for (const id of [
    'front_panel',
    'back_panel',
    'left_gusset',
    'right_gusset',
    'bottom_panel',
    'divider_1',
    'divider_2',
    'inner_open_pocket_1',
    'inner_open_pocket_2',
    'inner_zip_pocket_1',
    'outer_pocket_1',
    'strap_1',
    'handle_1',
    'handle_2',
    'closure',
    'brand_mark',
  ]) {
    assert.ok(ids.includes(id), id);
  }
  const flap = parts.find((x) => x.id === 'closure');
  assert.equal(flap.moving, true);
  assert.equal(flap.joint, 'hinge');
  assert.equal(parts.find((x) => x.id === 'front_panel').moving, false);
  assert.equal(parts.find((x) => x.id === 'strap_1').behavior, 'flexible');
  assert.equal(parts.find((x) => x.id === 'divider_1').behavior, 'flexible');
});
test('photo angle hints are conservative and do not assert true visual analysis', () => {
  assert.deepEqual(detectViewFromName('bag-logo-front.png'), {
    view: 'logo',
    confidence: 'low',
    source: 'filename',
  });
  assert.equal(detectViewFromName('IMG_987654.jpg').view, 'unknown');
  assert.equal(detectViewFromName('inside2.jpg').view, 'inside');
});
test('capture report never approves geometry from photo coverage alone', () => {
  const spec = createBagSpec({ closure: 'zipper', logoPlacement: 'front' });
  const views = requiredBagViews(spec);
  const images = views.map((view, i) => ({
    name: 'IMG-' + i + '.jpg',
    view,
    width: 2600,
    height: 2300,
    bytes: 200000,
  }));
  const report = evaluateBagCapture(spec, images);
  assert.equal(report.completeness, 100);
  assert.equal(report.viewsMissing.length, 0);
  assert.equal(report.geometryVerified, false);
  assert.equal(report.logoVerified, false);
  assert.equal(report.compartmentsVerified, false);
  assert.equal(report.mechanicsVerified, false);
  assert.equal(report.automatedReconstructionConnected, false);
  const draft = makeBagDraft(spec, images);
  assert.equal(draft.output.generatedGeometry, 'parametric-preview-only');
  assert.equal(draft.output.photoTo3DFaithful, false);
  assert.equal(draft.output.physicalSimulation, false);
  assert.equal(draft.output.retailARReady, false);
  assert.equal(draft.output.commerciallyApproved, false);
  assert.equal(draft.images.length, views.length);
});
test('opening and internal pocket photo absence is explicitly reported', () => {
  const spec = createBagSpec({
    mainCompartments: 4,
    innerOpenPockets: 3,
    innerZippedPockets: 2,
    closure: 'flap',
    logoPlacement: 'front',
  });
  const report = evaluateBagCapture(spec, [{ name: 'front.jpg', view: 'front' }]);
  assert.ok(report.viewsMissing.includes('inside'));
  assert.ok(report.viewsMissing.includes('open'));
  assert.ok(report.viewsMissing.includes('pockets'));
  assert.ok(report.viewsMissing.includes('logo'));
  assert.ok(report.accuracyLimitations.some((x) => x.includes('الجيوب')));
  assert.ok(report.unobservedParts.includes('divider_1'));
});
test('bag merchant page includes structure, multi-view photo proof, interior and branded model workflow', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../bag-builder.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../bag-builder.js', import.meta.url), 'utf8');
  const fields = readFileSync(new URL('../bag-fields.js', import.meta.url), 'utf8');
  for (const key of [
    'widthCm',
    'heightCm',
    'depthCm',
    'innerOpenPockets',
    'innerZippedPockets',
    'mainCompartments',
    'logoPlacement',
  ])
    assert.ok(fields.includes("'" + key + "'"), key);
  for (const id of [
    'photos-input',
    'show-inside',
    'opening',
    'download-glb',
    'download-json',
    'download-project',
    'stage',
  ])
    assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(js.includes('requiredBagViews(spec)'));
  assert.ok(!js.includes('fetch(file'), 'files must remain local');
  // Runtime graph, mesh names, actual image handling and export live in the
  // assembly suite and real-browser GLTFLoader round trip.
});
