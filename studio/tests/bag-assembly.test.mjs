import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildModularBag} from '../bag-model.js';
import {FAMILY_PRESETS,TAU} from '../bag-patterns.js';
import {newProject,correctPart,changeStructure,EditHistory,approveProject,interpretCommand} from '../bag-editor.js';

test('eight patterns close shared seams, respect dimensions and bound a real cavity',()=>{
  const fingerprints=new Set();
  for(const [style,preset] of Object.entries(FAMILY_PRESETS)){
    const m=buildModularBag({...preset,style,mainCompartments:4},{profile:'mobile'});
    const {pattern:p,graph}=m,ids=new Set(graph.parts.map(v=>v.id));
    assert.equal(ids.size,graph.parts.length);
    for(const part of graph.parts){
      assert.ok(!part.parent||ids.has(part.parent));
      for(const target of part.connections)assert.ok(ids.has(target));
      assert.ok(part.dimensions.width>=0);
    }
    assert.equal(graph.parts.filter(x=>x.role==='compartment').length,4);
    assert.equal(graph.parts.filter(x=>x.role==='interior_partition').length,3);
    const front=m.groups.get('front_panel').children[0].geometry;
    const right=m.groups.get('right_gusset').children[0].geometry;
    for(let j=0;j<10;j++){
      const pos=(g,i)=>new THREE.Vector3().fromBufferAttribute(g.attributes.position,i);
      assert.ok(pos(front,11*j+10).distanceTo(pos(right,11*j))<1e-7,style);
    }
    fingerprints.add([.05,.3,.55,.83,1].map(t=>p.surface(Math.PI/2,t)[0]/p.w).join(','));
    for(let i=0;i<40;i++){
      const edge=p.surface(TAU*i/40,.37),v=p.volume(.65*Math.sin(i),.65*Math.cos(i),.37);
      assert.ok(Math.abs(edge[0])<=p.w/2+1e-8&&Math.abs(edge[2])<=p.d/2+1e-8);
      assert.ok(Math.abs(v[0])<p.w/2&&Math.abs(v[2])<p.d/2);
    }
    m.root.traverse(o=>{
      if(!o.isMesh)return;
      for(const key of ['position','normal','uv'])assert.ok(o.geometry.attributes[key].array.every(Number.isFinite));
    });
    assert.ok(graph.performance.triangles<50000);assert.ok(graph.performance.draws<130);
    m.dispose();m.dispose();
  }
  assert.equal(fingerprints.size,8);
});
test('depth moves gussets, floor, dividers, pockets and carrying mounts',()=>{
  const a=buildModularBag({depthCm:8}),b=buildModularBag({depthCm:15});
  for(const id of ['right_gusset','bottom_panel','lining','handle_1_ring_a','inner_open_pocket_1']){
    const x=a.parts.find(p=>p.id===id),y=b.parts.find(p=>p.id===id);
    assert.ok(Math.abs(x.position[2]-y.position[2])+Math.abs(x.dimensions.depth-y.dimensions.depth)>.0005,id);
  }
  assert.deepEqual(a.parts.find(x=>x.role==='compartment').geometryConstraints.normalizedDepthInterval,[-1,0]);
  a.dispose();b.dispose();
});
test('carrier swing preserves both endpoints across every carrying mode and clamps joint angles',()=>{
  for(const mode of ['hand','shoulder','crossbody','backpack']){
    const model=buildModularBag({strapType:mode,strapCount:2});
    for(const part of model.parts.filter(p=>p.role==='strap'||p.role==='handle')){
      const g=model.groups.get(part.id),a=new THREE.Vector3(...part.anchors.a),b=new THREE.Vector3(...part.anchors.b);
      const localB=b.clone().sub(a);
      for(const amount of [-7,.6,5]){
        model.setSwing(amount);model.root.updateMatrixWorld(true);
        assert.ok(a.distanceTo(g.localToWorld(new THREE.Vector3()))<1e-8);
        assert.ok(b.distanceTo(g.localToWorld(localB.clone()))<1e-8);
        assert.ok(g.quaternion.angleTo(new THREE.Quaternion())<=32*Math.PI/180+1e-7);
      }
    }
    model.dispose();
  }
});
test('closure, pocket travel, morphology and constrained history change the built geometry',()=>{
  for(const closure of ['flap','clasp','zipper','button','magnetic','drawstring','buckle']){
    const model=buildModularBag({closure},{edits:{closure:{motionLimit:.5}}});
    const g=model.groups.get('closure'),fixed=model.groups.get('bottom_panel').matrix.clone();
    const slider=model.groups.get('inner_zip_pocket_1_slider').children[0],origin=slider.position.clone();
    model.setOpening(3);model.setPockets(1);
    assert.ok(slider.position.distanceTo(origin)>.001);assert.ok(model.groups.get('bottom_panel').matrix.equals(fixed));
    if(closure==='flap')assert.ok(Math.abs(g.rotation.x+56*Math.PI/180)<1e-7);
    if(closure==='drawstring')assert.equal(model.groups.get('front_panel').children[0].morphTargetInfluences[0],.5);
    model.dispose();
  }
  const proj=newProject({strapCount:1}),h=new EditHistory(proj);
  h.apply(correctPart(proj,'strap_1',{widthScale:90,visible:false,behavior:'flexible'},['front-id']));
  assert.equal(h.present.edits.strap_1.widthScale,1.5);h.undo();assert.deepEqual(h.present,proj);h.redo();
  const next=interpretCommand('Increase the bag depth',h.present,'front_panel');
  h.apply(next);assert.equal(h.present.spec.depthCm,12);assert.equal(h.present.feedback.length,2);
  assert.ok(approveProject(h.present).feedback.every(f=>f.approval==='merchant-approved'&&!f.trainingConsent));
  assert.equal(changeStructure(approveProject(h.present),{widthCm:47}).approval,'unreviewed');
});
