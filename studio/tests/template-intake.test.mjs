import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGLB,buildEntry,checksum} from '../template-intake.mjs';
function fixture(change=()=>{}){
 const json={asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]};
 change(json);
 const raw=new TextEncoder().encode(JSON.stringify(json)),n=Math.ceil(raw.length/4)*4;
 const b=new ArrayBuffer(12+8+n+8+36),v=new DataView(b),a=new Uint8Array(b);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,b.byteLength,true);v.setUint32(12,n,true);v.setUint32(16,0x4e4f534a,true);a.fill(32,20,20+n);a.set(raw,20);v.setUint32(20+n,36,true);v.setUint32(24+n,0x004e4942,true);return b;
}
test('accepts local self-contained triangle and returns technical stats',()=>{assert.deepEqual(inspectGLB(fixture()),{triangles:1,meshes:1,materials:0,skins:0,animations:0});});
test('rejects external URLs, unsupported extensions and invalid geometry',()=>{
 for(const alter of [j=>j.buffers[0].uri='https://example.com/b.bin',j=>j.images=[{uri:'https://example.com/texture.png'}],j=>j.extensionsUsed=['KHR_draco_mesh_compression'],j=>j.accessors[0].count=750003,j=>j.bufferViews[0].byteLength=900])assert.throws(()=>inspectGLB(fixture(alter)));
});
test('requires explicit verified provenance and checksum',async()=>{
 const meta={id:'bag-01',category:'bag',license:'CC0-1.0',source:'https://example.com/asset',confirmed:true};
 const hash=await checksum(fixture());assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(buildEntry(meta,hash).file,'local-assets/bag-01.glb');
 for(const changes of [{confirmed:false},{license:'royalty-free'},{id:'../bad'},{source:'http://example.com'}])assert.throws(()=>buildEntry({...meta,...changes},hash));
});
