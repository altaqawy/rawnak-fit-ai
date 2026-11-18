import test from 'node:test';
import assert from 'node:assert/strict';
import {analysePixels,fitFromEvidence,STAGES} from '../bag-evidence.js';
import {makePattern} from '../bag-patterns.js';
import {createBagSpec} from '../bag-spec.js';
function sample(alpha=false){
  const w=84,h=72,data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const body=y>22&&y<66&&Math.abs(x-42)<12+(65-y)*.3;
    const handle=y>5&&y<=22&&(Math.abs(x-28)<2||Math.abs(x-55)<2||y<9&&x>27&&x<56);
    data.set(body||handle?[111,57,38,255]:[242,242,242,alpha?0:255],4*(y*w+x));
  }
  return {data,w,h};
}
test('local object masks separate handles, recover colors, abstain on empty and clipped views',()=>{
  for(const alpha of [true,false]){
    const {data,w,h}=sample(alpha),r=analysePixels(data,w,h);
    assert.equal(r.status,'candidate');assert.equal(r.color,'#6f3926');
    assert.ok(r.widthProfile[0]<r.widthProfile[4]);assert.ok(r.bands.length>20);
    for(let y=30;y<40;y++)for(let x=0;x<43;x++)data.set([111,57,38,255],(y*w+x)*4);
    assert.equal(analysePixels(data,w,h).reason,'clipped');
  }
  const blank=new Uint8ClampedArray(100*100*4);assert.equal(analysePixels(blank,100,100).status,'abstained');
});
test('only explicitly assigned, attached frontal evidence can fit a pattern; disagreeing views abstain',()=>{
  const {data,w,h}=sample(),analysis=analysePixels(data,w,h),ref={id:'a',view:'front',source:'filename',analysis};
  assert.equal(fitFromEvidence([ref]).fit,null);
  ref.source='merchant';const {fit}=fitFromEvidence([ref]);assert.deepEqual(fit.sources,['a']);
  const s=createBagSpec({});assert.notDeepEqual(makePattern(s).width,makePattern(s,fit.widths).width);
  assert.equal(fitFromEvidence([{...ref,linked:false}]).fit,null);
  assert.equal(fitFromEvidence([ref,{...ref,view:'back',analysis:{...analysis,widthProfile:[1,1,1,1,1]}}]).status,'inconsistent-views');
  assert.equal(STAGES.interiorInference,'unavailable');
});
