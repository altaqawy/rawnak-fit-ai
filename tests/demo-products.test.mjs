import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DEMO_PRODUCTS,getDemoProduct} from '../demo/catalog.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p));
const text=p=>read(p).toString('utf8');

test('four distinct demo products have two real images each',()=>{
  assert.equal(Object.keys(DEMO_PRODUCTS).length,4);
  for(const item of Object.values(DEMO_PRODUCTS)){
    assert.equal(item.photos.length,2,item.sku);
    assert.equal(item.hasAccurate3D,false,item.sku);
    assert.equal(item.hasActualProductOverlay,false,item.sku);
    assert.ok(item.materialParts.length>0,item.sku);
    for(const photo of item.photos){
      const asset='demo/'+photo.src.replace(/^\.\//,'');
      assert.ok(existsSync(path.join(root,asset)),asset+' is committed to repo');
      const bytes=read(asset);
      assert.equal(bytes.toString('ascii',0,4),'RIFF',asset+' has WebP RIFF header');
      assert.equal(bytes.toString('ascii',8,12),'WEBP',asset+' is WebP');
      assert.ok(bytes.byteLength>5000,asset+' nontrivial image');
    }
  }
  assert.equal(getDemoProduct('__proto__'),null,'unsafe SKU not resolved');
});

test('all four photo AR mask cutouts exist as actual WebP files',()=>{
  for(const category of ['watch','tshirt','glasses','bag']){
    const file='demo/assets/'+category+'-cutout.webp';
    assert.ok(existsSync(path.join(root,file)),file);
    const bytes=read(file);
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.byteLength>5000);
  }
});

test('processing page exposes real analysis, clearly separates unfinished model tasks',()=>{
  const html=text('demo/process.html'),js=text('demo/process.js'),studio=text('studio/app.js');
  assert.ok(html.includes('id="analyze-button"'));
  assert.ok(html.includes('غير مُنفّذ'));
  assert.ok(js.includes('dominantProductColor('));
  assert.ok(js.includes('model.classify(image,5)'));
  assert.ok(js.includes('getDemoProduct('));
  assert.ok(studio.includes('void openDemoFixture()'),'can import real test photos into Studio');
});

test('3D is default while optional 2D comparison stays allowlisted',()=>{
  const app=text('src/app.js'), html=text('index.html');
  assert.ok(app.includes('demoAssetPaths = Object.freeze'));
  assert.ok(app.includes("state.assetMode === 'photo'"));
  assert.ok(app.includes("state.assetMode = 'generic'"));
  assert.ok(app.includes('drawDemoPhoto(ctx, state.landmarks, w, h)'));
  assert.ok(html.includes('id="asset-photo"')&&html.includes('id="asset-generic"'));
  assert.ok(html.includes('LIVE 3D MESH'));
  assert.ok(html.includes('id="asset-3d"'));
  assert.ok(app.includes("assetMode: '3d'"));
  assert.ok(app.includes("state.three.render(state.selected.id"));
});
