import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendBag,validObservation,selectedPatch} from '../bag-recommendations.js';
import {PATTERNS} from '../bag-patterns.js';
import {createBagSpec} from '../bag-spec.js';
const photo=(id,view,extra={})=>({id,view,source:'merchant',linked:true,...extra});
const silhouette=(id,view,style,color='#987654')=>photo(id,view,{analysis:{status:'candidate',widthProfile:PATTERNS[style].width,bodyAspect:style==='tote'?37/29:1.4,color}});
test('filename hints and unlinked references do not produce proposals',()=>{
 const r=recommendBag(createBagSpec(),[{...silhouette('a','front','tote'),source:'filename'},{...silhouette('b','front','tote'),linked:false}]);
 assert.equal(r.proposals.length,0);assert.equal(r.ranking.length,0);
});
test('compatible front/back evidence suggests ranked templates and color, never dimensions',()=>{
 const r=recommendBag(createBagSpec(),[silhouette('a','front','tote'),silhouette('b','back','tote')]);
 assert.equal(r.ranking[0].style,'tote');
 const p=r.proposals.find(p=>p.key==='bodyColor');assert.equal(p.value,'#987654');assert.deepEqual(p.sources,['a','b']);
 assert.ok(!r.proposals.some(p=>['widthCm','heightCm','depthCm','material','closure'].includes(p.key)));
 const result=selectedPatch(r,['bodyColor']);assert.deepEqual(result.patch,{bodyColor:'#987654'});
});
test('incompatible silhouettes and colors abstain instead of forcing a template',()=>{
 const a=silhouette('a','front','tote','#111111'),b=silhouette('b','back','backpack','#eeeeee');
 b.analysis.widthProfile=[1,1,.35,.35,.35];
 const r=recommendBag(createBagSpec(),[a,b]);assert.ok(r.conflicts.includes('silhouette'));assert.ok(r.conflicts.includes('bodyColor'));
 assert.equal(r.ranking.length,0);assert.equal(r.proposals.length,0);
});
test('interior counts require eligible confirmed photo and conflicting counts are blocked',()=>{
 const refs=[photo('a','inside'),photo('b','pockets'),photo('c','front')];
 assert.equal(validObservation('innerOpenPockets',2,refs[2]),false);
 assert.equal(validObservation('innerOpenPockets',9,refs[0]),false);
 assert.equal(validObservation('innerOpenPockets',2,refs[0]),true);
 const observations=[{key:'innerOpenPockets',value:2,photoId:'a'},{key:'innerOpenPockets',value:3,photoId:'b'},{key:'closure',value:'zipper',photoId:'c'},{key:'mainCompartments',value:3,photoId:'a'}];
 const r=recommendBag(createBagSpec(),refs,observations);assert.ok(r.conflicts.includes('innerOpenPockets'));
 assert.equal(r.proposals.find(p=>p.key==='mainCompartments').value,3);
 assert.equal(r.proposals.some(p=>p.key==='closure'),false);
});
test('selected patches carry only chosen values and referenced sources',()=>{
 const refs=[photo('m','material'),photo('c','closure')];
 const obs=[{key:'material',value:'canvas',photoId:'m'},{key:'closure',value:'zipper',photoId:'c'}];
 const r=recommendBag(createBagSpec(),refs,obs);
 assert.deepEqual(selectedPatch(r,['closure']),{patch:{closure:'zipper'},sources:['c']});
 assert.deepEqual(selectedPatch(r,[]),{patch:{},sources:[]});
});
