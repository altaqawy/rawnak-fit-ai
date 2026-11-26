// Semantic roles are suggestions from authored mesh names, not AI geometry segmentation.
export const ROLES=Object.freeze({unassigned:'غير محدد',front:'الواجهة الأمامية',back:'الخلف',left:'الجانب الأيسر',right:'الجانب الأيمن',base:'القاعدة',shell:'الجسم',strap:'الحزام',handle:'اليد',flap:'الغطاء',zipper:'السوستة',hardware:'المعدن والقفل',lining:'البطانة',pocket:'الجيب',divider:'الفاصل الداخلي',logo:'الشعار',sleeve:'الكم',collar:'الياقة',other:'أخرى'});
const RULES=[['zipper',/zipper|zip_pull|zip-pull|سوست/],['hardware',/buckle|clasp|lock|hardware|snap|metal|قفل/],['divider',/divider|partition|compartment|فاصل/],['lining',/lining|liner|بطان/],['pocket',/pocket|جيب/],['strap',/strap|حزام/],['handle',/handle|مقبض/],['flap',/flap|lid|غطاء/],['logo',/logo|شعار/],['collar',/collar|neckline|ياقة/],['sleeve',/sleeve|كم/],['front',/front|أمام/],['back',/back|خلف/],['left',/left|gusset_l|يسار/],['right',/right|gusset_r|يمين/],['base',/bottom|base|قاعد/],['shell',/shell|body|جسم/]];
export function suggestRole(name){
 const n=String(name||'').toLowerCase();return RULES.find(([,r])=>r.test(n))?.[0]||'unassigned';
}
export function collectParts(root){
 const parts=[];function visit(node,path){
  if(node.isMesh)parts.push({key:path.join('/'),name:String(node.name||'Mesh'),role:suggestRole(node.name),editable:!node.isSkinnedMesh&&!node.morphTargetInfluences?.length&&!(node.children||[]).length,node,baseScale:[node.scale.x,node.scale.y,node.scale.z],basePosition:[node.position.x,node.position.y,node.position.z],baseVisible:node.visible});
  (node.children||[]).forEach((child,i)=>visit(child,[...path,i]));
 }visit(root,[0]);return parts;
}
export function normalizeEdit(edit={}){
 const role=Object.hasOwn(ROLES,edit.role)?edit.role:'unassigned';
 const scale=Array.isArray(edit.scale)?edit.scale:[1,1,1];
 if(scale.length!==3||scale.some(x=>!Number.isFinite(x)||x<.5||x>2))throw Error('Scale must be 50–200%');
 const mobility=['fixed','hinged','sliding','flexible','unknown'].includes(edit.mobility)?edit.mobility:'unknown';
 return {role,scale:[...scale],visible:edit.visible!==false,mobility};
}
export function applyPart(part,edit){
 const next=normalizeEdit(edit);
 if(!part.editable&&(next.scale.some(v=>v!==1)||next.visible!==part.baseVisible))throw Error('Rigged, morph or parent mesh transforms are locked');
 part.node.scale.set(...part.baseScale.map((s,i)=>s*next.scale[i]));
 part.node.visible=next.visible;part.node.userData={...part.node.userData,rawnakRole:next.role,rawnakMobility:next.mobility};return next;
}
export function makePartPlan(parts,edits,sourceHash){
 if(!/^[a-f0-9]{64}$/.test(sourceHash))throw Error('Original SHA-256 required');
 return {schema:'rawnak.template-parts.v1',sourceSha256:sourceHash,previewOnly:true,parts:parts.map(p=>({key:p.key,name:p.name,...normalizeEdit(edits[p.key]||{role:p.role,visible:p.baseVisible})}))};
}
export function applyPlan(parts,plan,sourceHash){
 if(plan?.schema!=='rawnak.template-parts.v1'||plan.sourceSha256!==sourceHash||!Array.isArray(plan.parts)||plan.parts.length!==parts.length)throw Error('Plan does not match original template');
 const map=new Map(plan.parts.map(p=>[p.key,p]));
 if(map.size!==parts.length)throw Error('Duplicate part key');
 const prepared=parts.map(p=>{const e=map.get(p.key);if(!e||e.name!==p.name)throw Error('Part identity mismatch');const n=normalizeEdit(e);if(!p.editable&&(n.scale.some(x=>x!==1)||n.visible!==p.baseVisible))throw Error('Rigged, morph or parent mesh transforms are locked');return [p,n];});
 return Object.fromEntries(prepared.map(([p,n])=>[p.key,applyPart(p,n)]));
}
