import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PILOTS,VIEW_LABELS,getPilot,validatePhotoMetadata,evaluatePilot,createAssetDraft,selectRecommendedRoute}
  from '../asset-pipeline.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const img=(name,view)=>({name,view,bytes:1200000,width:2560,height:2560});
const samples={
 tshirt:{
  views:['front','back','left','right','detail','angle','angle','detail'],
  measures:{chest:'54',shoulder:'47',length:'73',sleeve:'23'}},
 watch:{
  views:['front','back','left','right','top','detail','angle','angle'],
  measures:{case:'42',thickness:'9.6',strap:'20'}},
 bag:{
  views:['front','back','left','right','top','inside','detail','angle','angle','angle'],
  measures:{width:'28',height:'19',depth:'12',strap:'90'}}
};
const ready=category=>({
 category,name:'Real item',sku:'RW-TEST',photos:samples[category].views.map((view,i)=>img('img-'+i+'.jpg',view)),
 measurements:samples[category].measures,rightsConfirmed:true,categoryConfirmed:true
});
test('three pilots have distinct templates, valid route and measurement fields',()=>{
 assert.deepEqual(Object.keys(PILOTS).sort(),['bag','tshirt','watch']);
 assert.equal(Object.keys(VIEW_LABELS).includes('inside'),true);
 assert.equal(getPilot('watch').family,'rigid-hybrid');
 assert.equal(getPilot('tshirt').recommendedTemplate,'crew-neck-set-in-sleeve');
 assert.equal(getPilot('car'),null);
 assert.equal(selectRecommendedRoute('bag').generationEnabled,false);
 assert.equal(selectRecommendedRoute('unknown'),null);
});
test('input ready does not imply model generation or merchant approval',()=>{
 for(const key of Object.keys(samples)){
  const x=evaluatePilot(ready(key));
  assert.equal(x.intakeReady,true,key+' should have complete intake');
  assert.equal(x.qualityScore,100);
  assert.equal(x.merchantApproved,false);
  assert.equal(x.publicationAllowed,false);
  assert.equal(x.physicalFitVerified,false);
  assert.equal(x.reconstructionStatus,'not-connected');
  const draft=createAssetDraft(ready(key));
  assert.equal(draft.stage,'ready-for-reconstruction');
  assert.equal(draft.approval.readyForPublication,false);
  assert.equal(draft.quality.verified360,false);
 }
});
test('photos must include actual views, not just enough identical angle photos',()=>{
 const sample=ready('tshirt');
 sample.photos=Array.from({length:13},(_,i)=>img('x'+i+'.png','front'));
 const report=evaluatePilot(sample);
 assert.equal(report.intakeReady,false);
 assert.ok(report.missingViews.includes('back'));
 assert.ok(report.missingViews.includes('right'));
 assert.ok(report.blockers.some(x=>x.includes('زوايا')));
});
test('size/format/resolution/rights gate and unknown categories block draft',()=>{
 const x=ready('watch');
 x.photos[0].width=900;x.photos[0].height=900;
 x.photos[1].bytes=12*1048576;
 x.photos[2].name='malware.exe';
 x.rightsConfirmed=false;x.measurements.case='0';
 const r=evaluatePilot(x);
 assert.equal(r.intakeReady,false);
 assert.ok(r.photoProblems.length>=3);
 assert.ok(r.missingMeasurements.includes('case'));
 assert.ok(r.blockers.some(s=>s.includes('حقوق')));
 assert.equal(validatePhotoMetadata(img('x.jpg','angle')).length,0);
 assert.ok(validatePhotoMetadata(img('x.jpg','incorrect')).includes('unassigned-view'));
 assert.throws(()=>evaluatePilot({category:'other'}));
});
test('export includes metadata only and cannot smuggle images or approved status',()=>{
 const record=ready('bag');
 record.name='Leather Bag';record.sku='BAG-420';
 record.photos[0].url='blob:https://secret-image';
 record.localGlb={name:'test.glb',bytes:20000,buffer:'huge binary'};
 record.merchantApproved=true;
 const data=createAssetDraft(record);
 assert.equal(data.product.sku,'BAG-420');
 assert.equal(data.uploadedGlb.previewOnly,true);
 assert.equal(data.uploadedGlb.includedInExport,false);
 assert.equal(data.approval.merchantApproved,false);
 assert.equal(data.approval.geometryApproved,false);
 const json=JSON.stringify(data);
 assert.ok(!json.includes('blob:https://'));
 assert.ok(!json.includes('huge binary'));
 assert.ok(!json.includes('data:image'));
 assert.throws(()=>createAssetDraft({...record,sku:''}));
});
test('merchant UI wires all pilot inputs without pushing photos to an API',()=>{
 const html=readFileSync(path.join(root,'library.html'),'utf8');
 const app=readFileSync(path.join(root,'library.js'),'utf8');
 const studio=readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['upload-images','photo-list','measurements','rights-confirmed','category-confirmed',
  'qa-blockers','upload-glb','model-stage','download-manifest','copy-report']){
   assert.ok(html.includes('id="'+id+'"'),id);
  }
 assert.ok(html.includes('type="importmap"'),'Three.js addon import map');
 assert.ok(app.includes('evaluatePilot(input)'));
 assert.ok(app.includes("await new GLTFLoader().parseAsync(data,'')"));
 assert.ok(app.includes('URL.revokeObjectURL'));
 assert.ok(app.includes('createAssetDraft(draftInput())'));
 assert.ok(!app.includes('fetch(file'),'photo upload cannot be hidden in fetch');
 assert.ok(studio.includes('href="./library.html"'));
});
