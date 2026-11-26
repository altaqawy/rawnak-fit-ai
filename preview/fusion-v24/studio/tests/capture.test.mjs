import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, COMMON_RULES, getCaptureProfile, captureProgress } from '../capture-profiles.js';

test('every guided capture group has consistent photo counts and correct tiers',()=>{
  for (const [category,profile] of Object.entries(PROFILES)) {
    assert.ok(profile.previewMin>=4,category+' preview minimum exists');
    assert.ok(profile.verifiedMin>=profile.previewMin,category+' 360 photos >= preview');
    assert.ok(profile.verifiedTarget>=profile.verifiedMin,category+' target >= 360 minimum');
    assert.equal(profile.shots.reduce((s,item)=>s+item[1],0),profile.verifiedTarget,category+' shots sum to target');
    assert.ok(profile.parts.length>=1,category+' includes material parts');
    assert.ok(profile.materials.length>=2,category+' has merchant material fields');
    assert.ok(profile.sizing.length>=10,category+' includes real measurements');
    assert.equal(captureProgress(category,0).level,'incomplete');
    assert.equal(captureProgress(category,profile.previewMin).level,'preview');
    assert.equal(captureProgress(category,profile.verifiedMin).level,'reviewable');
    assert.match(captureProgress(category,profile.verifiedMin).label,/مراجعة الجودة/);
  }
  assert.equal(COMMON_RULES.length>=6,true);
});

test('all parts have approved motion classification vocabulary',()=>{
  const allowed = new Set(['rigid','deformable','hinged','cloth','linked']);
  for(const p of Object.values(PROFILES)) for(const part of p.parts) {
    assert.ok(allowed.has(part.motion),p.title+' includes unsupported part motion '+part.motion);
    assert.ok(part.name);
  }
});

test('soft garments and rigid jewelry require different physical properties',()=>{
  assert.ok(PROFILES.tshirt.parts.some(x=>x.motion==='cloth'));
  assert.ok(PROFILES.watch.parts.some(x=>x.motion==='rigid'));
  assert.ok(PROFILES.watch.parts.some(x=>x.motion==='deformable'));
  assert.ok(PROFILES.bangle.parts.some(x=>x.motion==='linked'));
  assert.ok(PROFILES.dress.needsMotion);
  assert.ok(!PROFILES.ring.needsMotion);
  assert.ok(PROFILES.tshirt.materials.some(x=>x.includes('GSM')));
  assert.equal(getCaptureProfile('unrecognised'),null);
});
