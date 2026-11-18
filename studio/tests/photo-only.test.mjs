import test from 'node:test';
import assert from 'node:assert/strict';
import {PHOTO_TEMPLATES,inferTemplate,inferViewFromFilename,createAutoDraft}
  from '../auto-template-registry.js';

const images=names=>names.map(name=>({name}));
test('eleven product families are routable without manually entering SKU or measurements',()=>{
 const categories=['tshirt','hoodie','jacket','dress','watch','ring','bangle','glasses','earrings','bag','shoes'];
 assert.deepEqual(Object.keys(PHOTO_TEMPLATES).sort(),categories.sort());
 for(const item of Object.values(PHOTO_TEMPLATES)){
  assert.ok(item.id);
  assert.ok(item.family);
  assert.ok(item.tracking);
 }
});
test('image labels pick a non-verified reference template',()=>{
 const tee=inferTemplate(images(['front-shirt.jpg']),
  [{className:'jersey, T-shirt',probability:.86}]);
 assert.equal(tee.category,'tshirt');
 assert.equal(tee.renderer,'tee');
 assert.equal(tee.previewAvailable,true);
 assert.equal(tee.previewOnly,true);
 assert.equal(tee.merchantApproved,false);
 assert.equal(tee.reconstructionConnected,false);
 const ring=inferTemplate(images(['gold ring.jpg']),[{className:'ring',probability:.64}]);
 assert.equal(ring.renderer,'ring');
 assert.equal(ring.previewAvailable,true);
 const earrings=inferTemplate(images(['earrings.jpg']),[{className:'earring',probability:.8}]);
 assert.equal(earrings.renderer,'earrings');
});
test('without visual or filename evidence no fake 3D category is chosen',()=>{
 const x=inferTemplate(images(['IMG_9910.jpg']),[{className:'tabby cat',probability:.96}]);
 assert.equal(x.category,null);
 assert.equal(x.previewAvailable,false);
 assert.equal(x.uncertain,true);
});
test('ambiguous filenames and old categories remain uncertain',()=>{
 const x=inferTemplate(images(['green hoodie.jpg']),[]);
 assert.equal(x.category,'hoodie');
 assert.equal(x.previewAvailable,false);
 assert.equal(x.uncertain,true);
 assert.equal(inferViewFromFilename('DSC_0003.jpg').view,'unknown');
 assert.equal(inferViewFromFilename('front_shot.jpg').view,'front');
});
test('metadata export never implies 360 or live size accuracy',()=>{
 const x=inferTemplate(images(['watch_front.jpg']),
   [{className:'analog clock',probability:.88}]);
 const doc=createAutoDraft([{name:'watch_front.jpg',width:2300,height:2300,bytes:456} ],x,
   {color:'#b19c8e',confidence:'low'});
 assert.equal(doc.model.reconstructedFromPhotos,false);
 assert.equal(doc.model.accurate360,false);
 assert.equal(doc.model.actualDimensionsKnown,false);
 assert.equal(doc.permissions.readyForPublication,false);
 assert.equal(doc.materialHint.approved,false);
 assert.equal(doc.input.photos[0].estimatedView.view,'front');
 assert.ok(!JSON.stringify(doc).includes('data:image'));
});
test('upload-only page does not demand human measurements or 3D uploads',async()=>{
 const fs=await import('node:fs');
 const html=fs.readFileSync(new URL('../library.html',import.meta.url),'utf8');
 const script=fs.readFileSync(new URL('../auto.js',import.meta.url),'utf8');
 assert.ok(html.includes('id="product-photos"'));
 assert.ok(html.includes('id="viewer"'));
 assert.ok(!html.includes('id="upload-glb"'));
 assert.ok(!html.includes('id="sku"'));
 assert.ok(!html.includes('id="measurements"'));
 assert.ok(script.includes('mobilenet'));
 assert.ok(script.includes("estimateColorFromImageFile(state.photos[0].file)"));
 assert.ok(!script.includes('getUserMedia('));
});
