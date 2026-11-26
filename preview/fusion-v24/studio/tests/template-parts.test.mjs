import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestRole,collectParts,normalizeEdit,applyPart,makePartPlan,applyPlan} from '../template-parts.mjs';
const vec=(x=1,y=1,z=1)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;}});
const mesh=(name,extra={})=>({name,isMesh:true,children:[],scale:vec(2,3,4),position:vec(0,0,0),visible:true,...extra});
const hash='a'.repeat(64);
test('semantic suggestions and stable paths distinguish duplicate mesh names',()=>{
 const root={children:[mesh('front_panel'),mesh('front_panel'),mesh('lining'),mesh('metal_clasp'),mesh('unknown')]};
 const parts=collectParts(root);
 assert.deepEqual(parts.map(p=>p.role),['front','front','lining','hardware','unassigned']);
 assert.equal(new Set(parts.map(p=>p.key)).size,5);
 assert.equal(suggestRole('strap_adjustable'),'strap');
});
test('scale edits are relative to original and independent',()=>{
 const a=mesh('strap'),b=mesh('shell'),parts=collectParts({children:[a,b]});
 const e={role:'strap',scale:[1.5,1,.5],visible:false,mobility:'flexible'};
 applyPart(parts[0],e);applyPart(parts[0],e);
 assert.deepEqual([a.scale.x,a.scale.y,a.scale.z],[3,3,2]);
 assert.equal(a.visible,false);assert.equal(a.userData.rawnakMobility,'flexible');
 assert.deepEqual([b.scale.x,b.scale.y,b.scale.z],[2,3,4]);
 assert.throws(()=>normalizeEdit({scale:[100,1,1]}));
});
test('rigged and parent transforms locked but semantic labels allowed',()=>{
 const root={children:[mesh('sleeve',{isSkinnedMesh:true}),mesh('parent',{children:[mesh('inner')]})]};
 const parts=collectParts(root);
 for(const p of parts.slice(0,2)){
  assert.equal(p.editable,false);
  assert.throws(()=>applyPart(p,{role:'other',scale:[1.5,1,1]}));
  assert.equal(applyPart(p,{role:'other',scale:[1,1,1]}).role,'other');
 }
});
test('edit plan binds to exact source and rejects malformed entries before mutating',()=>{
 const a=mesh('pocket'),b=mesh('shell'),parts=collectParts({children:[a,b]});
 const plan=makePartPlan(parts,{[parts[0].key]:{role:'pocket',scale:[1,1.4,1],visible:true}},hash);
 assert.throws(()=>applyPlan(parts,plan,'b'.repeat(64)));
 const bad=JSON.parse(JSON.stringify(plan));bad.parts[1].scale=[0,1,1];
 assert.throws(()=>applyPlan(parts,bad,hash));assert.equal(a.scale.y,3);
 const applied=applyPlan(parts,plan,hash);
 assert.equal(applied[parts[0].key].role,'pocket');assert.ok(Math.abs(a.scale.y-4.2)<1e-9);
});
