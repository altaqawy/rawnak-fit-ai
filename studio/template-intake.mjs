// Local GLB intake contract for artist-owned / verified CC0 templates.
// This is technical preflight, not a license audit or a complete glTF validator.
export const MAX_BYTES=20*1024*1024;
export const CATEGORIES=['bag','top','bottom','dress','watch','glasses','material'];
const EXT=new Set(['KHR_materials_unlit','KHR_texture_transform']);
export function inspectGLB(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<28||buffer.byteLength>MAX_BYTES)throw Error('GLB must be under 20 MB');
 const v=new DataView(buffer);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength)throw Error('Invalid GLB v2 header');
 let offset=12,json=null,binary=null;
 while(offset<buffer.byteLength){
  if(offset+8>buffer.byteLength)throw Error('Incomplete chunk header');
  const size=v.getUint32(offset,true),type=v.getUint32(offset+4,true);offset+=8;
  if(size%4||offset+size>buffer.byteLength)throw Error('Invalid chunk size');
  if(type===0x4e4f534a&&json===null&&offset===20)json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buffer,offset,size)));
  else if(type===0x004e4942&&json&&binary===null)binary=size;
  else throw Error('Unsupported or duplicate GLB chunk');
  offset+=size;
 }
 if(!json||json.asset?.version!=='2.0'||!Array.isArray(json.meshes)||!json.meshes.length||json.meshes.length>60)throw Error('A valid mesh is required (max 60 meshes)');
 if(!Array.isArray(json.buffers)||json.buffers.length!==1||json.buffers[0].uri!=null||binary===null||!Number.isInteger(json.buffers[0].byteLength)||json.buffers[0].byteLength>binary||binary-json.buffers[0].byteLength>3)throw Error('Embedded BIN buffer required');
 if((json.images||[]).some(x=>x.uri!=null||!Number.isInteger(x.bufferView)))throw Error('External images are not allowed');
 if([...(json.extensionsRequired||[]),...(json.extensionsUsed||[])].some(x=>!EXT.has(x)))throw Error('Unsupported compression or material extension');
 for(const view of json.bufferViews||[]){
  const start=view.byteOffset??0;
  if(view.buffer!==0||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(view.byteLength)||view.byteLength<0||start+view.byteLength>json.buffers[0].byteLength)throw Error('Invalid buffer view');
 }
 let triangles=0;
 for(const mesh of json.meshes){
  if(!Array.isArray(mesh.primitives)||!mesh.primitives.length)throw Error('Missing mesh primitives');
  for(const p of mesh.primitives){
   if(p.mode!=null&&p.mode!==4)throw Error('Only triangle meshes supported');
   const position=json.accessors?.[p.attributes?.POSITION];
   if(!position||position.type!=='VEC3'||position.componentType!==5126||!Number.isSafeInteger(position.count)||position.count<3||position.count>750000)throw Error('Invalid vertex accessor');
   const count=p.indices!=null?json.accessors?.[p.indices]?.count:position.count;
   if(!Number.isSafeInteger(count)||count<3||count%3)throw Error('Invalid triangle count');
   triangles+=count/3;
   if(triangles>250000)throw Error('Triangle budget exceeded (250,000)');
  }
 }
 return {triangles,meshes:json.meshes.length,materials:(json.materials||[]).length,skins:(json.skins||[]).length,animations:(json.animations||[]).length};
}
export function buildEntry(meta,sha256){
 if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(meta.id)||!CATEGORIES.includes(meta.category))throw Error('Invalid template ID or category');
 if(!['CC0-1.0','OWNED'].includes(meta.license)||meta.confirmed!==true)throw Error('Confirm verified CC0 or owned rights first');
 const url=new URL(meta.source);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('HTTPS provenance URL required');
 if(!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid checksum');
 return {id:meta.id,category:meta.category,file:'local-assets/'+meta.id+'.glb',license:meta.license,source:url.href,sha256};
}
export async function checksum(buffer,subtle=globalThis.crypto?.subtle){
 if(!subtle)throw Error('SHA-256 requires HTTPS or localhost');
 const digest=await subtle.digest('SHA-256',buffer);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
