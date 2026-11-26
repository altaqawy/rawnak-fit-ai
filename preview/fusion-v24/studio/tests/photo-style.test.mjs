import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateForegroundColor} from '../photo-style.js';
import {createAssetDraft} from '../asset-pipeline.js';

function sample(w=96,h=96,front=[40,140,80],back=[244,244,244]){
  const rgba=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const tone=x>=24&&x<73&&y>=16&&y<80?front:back;
    const k=(y*w+x)*4;
    rgba.set([...tone,255],k);
  }
  return rgba;
}
test('extracts an approximate front-product swatch, distinct from the background',()=>{
  const hint=estimateForegroundColor(sample(),96,96);
  assert.equal(hint.status,'suggested');
  assert.equal(hint.color,'#288c50');
  assert.equal(hint.background,'#f4f4f4');
  assert.ok(['medium','low'].includes(hint.confidence));
});
test('solid background produces no guessed product color',()=>{
  const x=estimateForegroundColor(sample(96,96,[244,244,244],[244,244,244]),96,96);
  assert.equal(x.color,null);
  assert.equal(x.status,'insufficient-contrast');
});
test('rejects malformed pixel input',()=>{
  assert.throws(()=>estimateForegroundColor(null,20,20));
  assert.throws(()=>estimateForegroundColor(new Uint8ClampedArray(4),20,20));
});
test('manifest labels the color hint unverified',()=>{
  const views=['front','back','left','right','detail','angle','angle','detail'];
  const draft=createAssetDraft({
    category:'tshirt',name:'Green Tee',sku:'TEST-001',
    photos:views.map((view,i)=>({view,name:'p'+i+'.jpg',bytes:100000,width:2400,height:2400})),
    measurements:{chest:54,shoulder:44,length:71,sleeve:21},
    rightsConfirmed:true,categoryConfirmed:true,
    visualEstimate:{color:'#288c50',confidence:'medium'}
  });
  assert.equal(draft.visualHint.baseColor,'#288c50');
  assert.equal(draft.visualHint.approved,false);
  assert.equal(draft.approval.readyForPublication,false);
});
