import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetPath=path.join(root,'assets/garments/reference-tee-v1.glb');
const data=readFileSync(assetPath);
const magic=data.toString('ascii',0,4);
const size=data.readUInt32LE(8);
const jsonLen=data.readUInt32LE(12);
const jsonType=data.toString('ascii',16,20);
const json=JSON.parse(data.toString('utf8',20,20+jsonLen));
const binStart=20+jsonLen;
const binLen=data.readUInt32LE(binStart);
const binType=data.toString('ascii',binStart+4,binStart+8);
const payload=data.subarray(binStart+8,binStart+8+binLen);

function accessor(index){
  const a=json.accessors[index],v=json.bufferViews[a.bufferView];
  const off=(v.byteOffset??0)+(a.byteOffset??0);
  const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  const fmt={5126:{stride:4,read:(o)=>payload.readFloatLE(o)},5123:{stride:2,read:(o)=>payload.readUInt16LE(o)}}[a.componentType];
  assert.ok(fmt,'accessor component type supported by this test');
  const len=n*a.count,result=[];
  for(let i=0;i<len;i++)result.push(fmt.read(off+i*fmt.stride));
  return {values:result,info:a};
}
const primitive=json.meshes[0].primitives[0];
const pos=accessor(primitive.attributes.POSITION);
const normal=accessor(primitive.attributes.NORMAL);
const joint=accessor(primitive.attributes.JOINTS_0);
const weights=accessor(primitive.attributes.WEIGHTS_0);
const indices=accessor(primitive.indices);

test('reference garment is an actual glTF 2.0 binary with valid chunks',()=>{
  assert.equal(magic,'glTF');
  assert.equal(data.readUInt32LE(4),2);
  assert.equal(size,data.length);
  assert.equal(jsonType,'JSON');
  assert.equal(binType,'BIN\u0000');
  assert.equal(json.buffers[0].byteLength,payload.byteLength);
  assert.ok(data.length<500_000,'mobile reference asset stays under 500 KB');
  for(const view of json.bufferViews){
    assert.ok((view.byteOffset??0)%4===0,'4-byte aligned buffer view');
    assert.ok((view.byteOffset??0)+view.byteLength<=payload.byteLength,'view fits binary buffer');
  }
});

test('reference model contains skinned geometry and named shoulder joints',()=>{
  assert.equal(json.asset.version,'2.0');
  assert.equal(json.skins.length,1);
  assert.equal(json.skins[0].joints.length,3);
  assert.deepEqual(json.nodes.map(n=>n.name).slice(0,4),
    ['RAWNAK_REF_TEE','RigRoot','Shoulder_L','Shoulder_R']);
  assert.ok(pos.info.count>1000);
  assert.equal(normal.info.count,pos.info.count);
  assert.equal(joint.info.count,pos.info.count);
  assert.equal(weights.info.count,pos.info.count);
  assert.equal(indices.info.count%3,0);
  assert.ok(indices.values.every(i=>i<pos.info.count));
  const used=new Set(joint.values);
  assert.ok(used.has(1)&&used.has(2),'both shoulder bones influence real vertices');
  for(let i=0;i<weights.values.length;i+=4){
    const sum=weights.values.slice(i,i+4).reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(sum-1)<1e-5, 'vertex skinning weights must sum to one');
  }
  assert.ok(json.accessors[json.skins[0].inverseBindMatrices].count===3);
});

test('reference garment never claims merchant fit certification',()=>{
 const manifest=JSON.parse(readFileSync(
   path.join(root,'assets/garments/reference-tee-v1.manifest.json'),'utf8'));
 assert.equal(manifest.assets.referenceOnly,true);
 assert.equal(manifest.assets.approvedForCommercialUse,false);
 assert.equal(manifest.assets.physicalFitVerified,false);
 assert.equal(manifest.qualityGate.merchantApproved,false);
 const assetCode=readFileSync(path.join(root,'src/fit-glb-assets.js'),'utf8');
 assert.ok(assetCode.includes("new URL(entry.relativeUrl, import.meta.url)"));
 assert.ok(assetCode.includes('isSkinnedMesh'));
 assert.ok(assetCode.includes("GLTFLoader"));
 const renderer=readFileSync(path.join(root,'src/fit-3d-renderer.js'),'utf8');
 assert.ok(renderer.includes('bones.left.rotation.z'),'imported bone drives actual skinning');
});
