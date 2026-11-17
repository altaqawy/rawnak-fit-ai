import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CATEGORIES, normalizeCategory, classifyProduct,
  planProduct, createRecord, dominantProductColor
} from '../engine.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('supported category routing covers garments and accessories', () => {
  for (const key of ['watch','ring','bangle','bag','shoes','glasses','tshirt','hoodie','jacket','dress']) {
    assert.ok(CATEGORIES[key], 'category exists: ' + key);
    assert.ok(CATEGORIES[key].engine, 'engine set: ' + key);
  }
  assert.equal(normalizeCategory('__invalid__'),'unknown');
  assert.equal(CATEGORIES.watch.engine,'parametric-watch');
  assert.equal(CATEGORIES.hoodie.engine,'garment-pattern');
});

test('Arabic/English filename category hints never pretend to be vision AI', () => {
  const cases = [
    ['ساعة رجالي فضي','watch'],
    ['wristwatch_001.png','watch'],
    ['خاتم فضة','ring'],
    ['هودي رجالي','hoodie'],
    ['black_handbag.png','bag'],
    ['حذاء رياضي','shoes']
  ];
  for (const [name,expected] of cases) {
    const output = classifyProduct(name);
    assert.equal(output.category, expected, name);
    assert.equal(output.method, 'filename');
    assert.equal(output.requiresReview,true);
  }
  assert.equal(classifyProduct('IMG_20261117.jpeg').category,'unknown');
});

test('MobileNet ImageNet labels can inform category but remain reviewable', () => {
  const result = classifyProduct('IMG_123.jpg',[{className:'analog clock, wristwatch',probability:.72}]);
  assert.equal(result.category,'watch');
  assert.equal(result.method,'vision');
  assert.equal(result.modelLabel,'analog clock, wristwatch');
  const conflict = classifyProduct('خاتم فضة',[{className:'backpack',probability:.81}]);
  assert.equal(conflict.category,'ring');
  assert.equal(conflict.method,'conflict');
  assert.equal(conflict.requiresReview,true);
});

test('templates only build for measured watch/ring/bangle with a photo', () => {
  const watch = planProduct({ category:'watch',measurement:42,photos:2 });
  assert.equal(watch.canBuild,true);
  assert.equal(watch.verified360,false);
  assert.equal(watch.fidelity,'illustrative-only');
  assert.equal(planProduct({category:'ring', measurement:18, photos:0}).canBuild,false);
  assert.equal(planProduct({category:'bag',measurement:30,photos:4}).canBuild,false);
  assert.equal(planProduct({category:'hoodie',measurement:53,photos:4}).canBuild,false);
  assert.equal(planProduct({category:'unknown',measurement:33,photos:1}).canBuild,false);
});

test('metadata export does not claim exact reconstructed product', () => {
  const record = createRecord({
    name:'Test Watch',sku:'SKU-04',category:'watch',measurement:42,
    photos:3,categorySource:'vision',color:'#aa33cc'
  });
  assert.equal(record.engine,'parametric-watch');
  assert.equal(record.status,'preview-ready');
  assert.equal(record.verified360,false);
  assert.equal(record.assetType,'editable-parametric-template');
  assert.equal(record.fidelity,'illustrative-only');
  assert.ok(!JSON.stringify(record).includes('data:image/'));
  assert.throws(()=>createRecord({
    name:'',sku:'x',category:'watch',measurement:42,photos:1,color:'#aaccdd'
  }));
});

test('extracts approximate non-white product color from pixels', () => {
  const rgba = new Uint8ClampedArray(32*32*4);
  for(let i=0;i<rgba.length;i+=4) {
    rgba[i]=210;rgba[i+1]=50;rgba[i+2]=48;rgba[i+3]=255;
  }
  const color = dominantProductColor(rgba,32,32);
  assert.match(color,/^#[0-9a-f]{6}$/);
  assert.notEqual(color,'#c2d9b0');
});

test('studio page links local modules and never reads camera', () => {
  const html = readFileSync(path.join(dir,'index.html'),'utf8');
  const app = readFileSync(path.join(dir,'app.js'),'utf8');
  assert.ok(html.includes('src="./app.js?'));
  assert.ok(html.includes('id="dropzone"'));
  assert.ok(html.includes('id="build-model"'));
  assert.ok(html.includes('id="download-glb"'));
  assert.ok(html.includes('id="queue-product"'));
  assert.ok(app.includes('void analyze()'), 'client-side classification starts automatically after upload');
  assert.ok(app.includes("import('./viewer.js')"), '3D viewer loaded on demand');
  assert.ok(!app.includes('getUserMedia('),'merchant studio must not request webcam');
});
