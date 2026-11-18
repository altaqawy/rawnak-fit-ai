/* RAWNAK FIT — Three.js transparent WebGL renderer for actual 3D demo meshes.
 * These are real, light-weight 3D geometries with depth/lighting, NOT AI-reconstructed
 * or merchant-verified replicas. All geometry rendering stays on the shopper's device.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';

const standard=(color,metalness=0,roughness=.68,extras={})=>
  new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide,...extras});
const silver=()=>standard('#d8e0e0',.8,.23);
const gold=()=>standard('#dac28d',.76,.32);
const add=(root,geo,mat,name,x=0,y=0,z=0)=>{
  const obj=new THREE.Mesh(geo,mat);
  obj.name=name;obj.position.set(x,y,z);root.add(obj);return obj;
};
function line(root,points,radius,mat,name){
  return add(root,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
    points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*6),
    radius,6,false),mat,name);
}
function buildWatch(){
  const g=new THREE.Group();g.name='Silver/white watch — 3D example';
  const strap=standard('#f3f1e9',.02,.88);
  const edge=standard('#b6bebc',.67,.31);
  const white=standard('#f7f8f7',.11,.36);
  for(const side of [-1,1]){
    add(g,new THREE.BoxGeometry(.60,.86,.13),strap,'White leather band',0,side*.88,-.11);
    add(g,new THREE.BoxGeometry(.62,.11,.18),edge,'Band fitting',0,side*.53,-.05);
    for(let i=0;i<4;i++)add(g,new THREE.BoxGeometry(.44,.008,.008),
      standard('#d9d7d3',.1,.9),'Leather seam',0,side*(.60+i*.18),-.02);
  }
  const body=add(g,new THREE.CylinderGeometry(.50,.50,.17,40),silver(),'Steel case',0,0,.065);
  body.rotation.x=Math.PI/2;
  const dial=add(g,new THREE.CylinderGeometry(.445,.445,.012,40),white,'White dial',0,0,.166);
  dial.rotation.x=Math.PI/2;
  add(g,new THREE.TorusGeometry(.47,.026,10,48),silver(),'Metal bezel',0,0,.169);
  for(let i=0;i<12;i++){
    const t=i*Math.PI/6;
    const tick=add(g,new THREE.BoxGeometry(.012,i%3===0?.106:.06,.008),
      standard('#8a9491',.62,.33),'Dial hour index',
      Math.sin(t)*.366,-Math.cos(t)*.366,.185);
    tick.rotation.z=-t;
  }
  const minute=add(g,new THREE.BoxGeometry(.018,.27,.009),silver(),'Minute hand',.065,-.10,.20);
  minute.rotation.z=.53;
  const hour=add(g,new THREE.BoxGeometry(.023,.21,.01),silver(),'Hour hand',-.058,.058,.205);
  hour.rotation.z=.82;
  add(g,new THREE.SphereGeometry(.028,9,8),silver(),'Dial pivot',0,0,.22);
  const crown=add(g,new THREE.CylinderGeometry(.055,.055,.07,12),silver(),'Watch crown',.515,0,.035);
  crown.rotation.z=Math.PI/2;
  g.userData.modelWidth=1.05;
  g.userData.modelHeight=2.65;
  return g;
}
function buildRing(){
  const g=new THREE.Group();g.name='Ring illustrative reusable 3D template';
  const band=add(g,new THREE.TorusGeometry(.37,.065,20,80),gold(),'Golden ring band');
  band.rotation.x=.22;
  const stone=add(g,new THREE.SphereGeometry(.14,16,12),
    standard('#b4ddf5',.10,.12),'Placeholder gemstone',0,.43,.045);
  stone.scale.set(.84,1.22,.74);
  const setting=standard('#decda0',.65,.27);
  for(const x of [-.10,.10])add(g,new THREE.CylinderGeometry(.018,.015,.16,8),
    setting,'Stone prong',x,.435,.02);
  g.userData.modelWidth=1.08;g.userData.modelHeight=1.20;
  return g;
}
function buildEarrings(){
  const g=new THREE.Group();g.name='Earrings illustrative reusable 3D template';
  for(const side of [-1,1]){
    const x=side*.34;
    add(g,new THREE.TorusGeometry(.16,.026,12,48),gold(),'Hoop earring',x,-.05,0);
    add(g,new THREE.SphereGeometry(.045,14,10),silver(),'Earring pin',x,.16,0);
    add(g,new THREE.SphereGeometry(.07,14,10),standard('#f2deac',.45,.19),
      'Small pendant',x,-.23,0);
  }
  g.userData.modelWidth=1.0;g.userData.modelHeight=.66;
  return g;
}
function buildBracelet(){
  const g=new THREE.Group();g.name='Metal bangle — 3D example';
  const body=add(g,new THREE.TorusGeometry(.43,.075,14,48),gold(),'Gold bracelet');
  body.rotation.x=.35;
  add(g,new THREE.TorusGeometry(.43,.018,8,48),standard('#fff0c4',.65,.3),
    'Brass bevel').position.z=.065;
  g.userData.modelWidth=1.04;g.userData.modelHeight=1.04;
  return g;
}
function buildGlasses(){
  const g=new THREE.Group();g.name='Round metal-frame glasses — 3D example';
  const frame=standard('#111b1e',.32,.24);
  const temples=standard('#d9c595',.67,.26);
  const glass=standard('#d1e4ec',.05,.14,{transparent:true,opacity:.13,depthWrite:false});
  for(const sign of [-1,1]){
    const ring=add(g,new THREE.TorusGeometry(.46,.038,9,42),frame,'Round frame',sign*.54,0,.04);
    ring.scale.y=.85;
    const lens=add(g,new THREE.CircleGeometry(.445,32),glass,'Transparent lens',sign*.54,0,.025);
    lens.scale.y=.85;
    line(g,[[sign*.94,-.02,0],[sign*1.18,0,-.07],[sign*1.27,.05,-.55],
      [sign*1.19,.12,-1.02]],.022,temples,'3D metal temple');
    add(g,new THREE.SphereGeometry(.048,8,8),temples,'Temple hinge',sign*.96,0,.04);
  }
  line(g,[[-.14,-.09,.045],[0,-.17,.065],[.14,-.09,.045]],.037,frame,'Bridge');
  g.userData.modelWidth=2.15;g.userData.modelHeight=.92;
  return g;
}
function roundedShape(width,height,radius){
  const x=-width/2,y=-height/2,r=Math.min(radius,width/2,height/2);
  const shape=new THREE.Shape();
  shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);
  shape.quadraticCurveTo(x+width,y,x+width,y+r);
  shape.lineTo(x+width,y+height-r);
  shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  shape.lineTo(x+r,y+height);
  shape.quadraticCurveTo(x,y+height,x,y+height-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  return shape;
}
function buildBag(){
  const g=new THREE.Group();g.name='Structured brown leather shoulder bag — 3D example';
  const leather=standard('#9b5634',.04,.76);
  const trim=standard('#713c25',.02,.82);
  const metal=gold();
  const bagBody=new THREE.ExtrudeGeometry(roundedShape(1.35,.94,.13),{
    depth:.32,steps:1,bevelEnabled:true,bevelSize:.05,bevelThickness:.045,bevelSegments:2,
    curveSegments:5
  });
  add(g,bagBody,leather,'Structured leather body',0,.26,-.16);
  const flap=new THREE.ExtrudeGeometry(roundedShape(1.23,.35,.09),{
    depth:.032,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:1
  });
  add(g,flap,trim,'Flap closure',0,-.02,.23);
  const clasp=add(g,new THREE.BoxGeometry(.13,.08,.034),metal,'Metal bag clasp',0,.13,.29);
  clasp.rotation.z=.02;
  line(g,[[-.56,-.11,.06],[-.69,-.65,-.04],[-.52,-1.34,-.16],[0,-1.60,-.19],
    [.52,-1.34,-.16],[.69,-.65,-.04],[.56,-.11,.06]],.046,trim,'3D shoulder strap');
  for(const x of [-.55,.55])add(g,new THREE.TorusGeometry(.07,.014,7,18),metal,
    'Strap clip',x,-.11,.20);
  g.userData.modelWidth=1.50;g.userData.modelHeight=2.15;
  return g;
}
// Alpha 1.0: smooth, open 3D clothing shell — no flat polygon extrusion.
// Geometry is deliberately generic (not a reconstructed customer SKU).
function parametricShell(rows,segments,point) {
  const positions=[],uv=[],indices=[],ring=segments+1;
  for(let row=0;row<=rows;row++){
    const v=row/rows;
    for(let i=0;i<=segments;i++){
      const t=i/segments,theta=t*Math.PI*2;
      const p=point(v,theta);
      positions.push(p[0],p[1],p[2]);
      uv.push(t,v);
    }
  }
  for(let j=0;j<rows;j++)for(let k=0;k<segments;k++){
    const n=j*ring+k;
    indices.push(n,n+1,n+ring,n+1,n+ring+1,n+ring);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function pointOnTorso(v,angle){
  const expansion=Math.min(1,v/.16);
  const ease=expansion*(2-expansion);
  const rx=.275+(.505-.275)*ease-.045*Math.sin(Math.PI*v)+.008*v;
  const rz=.158+(.235-.158)*ease-.01*Math.sin(Math.PI*v);
  // Different front/back necklines, with round U-opening instead of a V-notch.
  const neckFront=Math.pow(Math.max(0,Math.cos(angle)),4)*.135;
  const neckBack=Math.pow(Math.max(0,-Math.cos(angle)),4)*.048;
  const neckY=neckFront+neckBack;
  const y=neckY+v*(1.50-neckY)+.010*v*v*Math.cos(angle*6);
  const ripples=v*v*.012*Math.sin(7*angle+v*8);
  const x=Math.sin(angle)*(rx+ripples);
  const z=Math.cos(angle)*(rz+ripples*.7)+
    Math.cos(4*angle+v*12)*.009*v;
  return [x,y,z];
}
function sleevePoint(v,angle,side){
  const length=.43;
  const dx=side*.34,dy=.25;
  const magnitude=Math.hypot(dx,dy);
  // Elliptical fabric tube around an oblique arm, open at its cuff.
  const normalX=dy/magnitude,normalY=-dx/magnitude;
  const radius=.152+.014*v;
  const frontRadius=.165+.010*v;
  const x=side*.015+dx*v+normalX*radius*Math.cos(angle);
  const y=.01+dy*v+normalY*radius*Math.cos(angle);
  const z=.006+frontRadius*Math.sin(angle)+
    Math.sin(angle*6+v*4)*.005*v;
  return [x,y,z];
}
function closedSeam(root,points,material,radius,name){
  const curve=new THREE.CatmullRomCurve3(
    points.map(p=>new THREE.Vector3(...p)),true,'centripetal');
  return add(root,new THREE.TubeGeometry(curve,Math.max(32,points.length*2),
    radius,6,true),material,name);
}
function cottonWeaveTexture() {
  // 64px procedural swatch tiled on the mesh; no online image generation, tiny GPU cost.
  // Material is illustrative and deliberately not a claim about an actual merchant fabric.
  if(!THREE.CanvasTexture || !document?.createElement)return null;
  try {
    const canvas=document.createElement('canvas');
    canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    ctx.fillStyle='#eeeeee';
    ctx.fillRect(0,0,64,64);
    for(let i=0;i<64;i+=4){
      ctx.fillStyle='rgba(85,85,85,.12)';
      ctx.fillRect(i,0,1,64);
      ctx.fillStyle='rgba(255,255,255,.17)';
      ctx.fillRect(0,i,64,1);
    }
    const tex=new THREE.CanvasTexture(canvas);
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(6,9);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.needsUpdate=true;
    return tex;
  } catch {return null;}
}
function buildShirt(jacket=false){
  const g=new THREE.Group();
  g.name=(jacket?'Light jacket':'Sage-green tee')+' — rounded fabric shell demo';
  const fabric=standard(jacket?'#426d73':'#467a5a',0,.96);
  const fabricMap=cottonWeaveTexture();
  if(fabricMap){fabric.map=fabricMap;fabric.needsUpdate=true;}
  const rib=standard(jacket?'#294c56':'#315c43',.01,.91);
  const seam=standard(jacket?'#6c9391':'#65947a',.01,.9);
  const shell=parametricShell(30,36,pointOnTorso);
  const torso=add(g,shell,fabric,jacket?'Rounded jacket body':'Rounded cotton torso',0,0,0);
  g.userData.garmentMesh=torso;
  g.userData.restPositions=new Float32Array(shell.attributes.position.array);
  const Motion=window.RawnakFitGarmentMotion;
  g.userData.sleeveSpring=Motion?new Motion.SleeveSpring():null;

  const neckline=[],hemline=[];
  for(let k=0;k<48;k++){
    const angle=k/48*Math.PI*2;
    const neck=pointOnTorso(0,angle);
    const hem=pointOnTorso(1,angle);
    neckline.push([neck[0],neck[1],neck[2]+Math.cos(angle)*.006]);
    hemline.push([hem[0],hem[1]-.01,hem[2]+Math.cos(angle)*.004]);
  }
  closedSeam(g,neckline,rib,.018,'Soft rounded neck rib');
  closedSeam(g,hemline,seam,.009,'Full rounded hem stitch');

  // Separated tubular sleeves, each attached to a shoulder pivot.
  // Unlike the former solid extrusion, both the sleeves and torso have
  // front, back, and side surfaces visible during 360° rotation.
  const sleeves={};
  for(const side of [-1,1]){
    const pivot=new THREE.Group();
    pivot.name=side<0?'Left sleeve pivot':'Right sleeve pivot';
    pivot.position.set(side*.47,.22,0);
    g.add(pivot);
    const sleeve=parametricShell(10,24,(v,angle)=>sleevePoint(v,angle,side));
    add(pivot,sleeve,fabric,side<0?'Left arm fabric':'Right arm fabric');
    const cuff=[];
    for(let k=0;k<24;k++)cuff.push(sleevePoint(1,k/24*Math.PI*2,side));
    closedSeam(pivot,cuff,seam,.013,'Stitched sleeve cuff');
    sleeves[side<0?'left':'right']=pivot;
  }
  g.userData.sleeves=sleeves;

  if(jacket){
    // Simple front seam and hardware: still a generic placeholder product.
    line(g,[[0,.24,.24],[0,.65,.245],[0,1.46,.25]],.012,
      standard('#d4c6a3',.42,.38),'Jacket zipper');
    add(g,new THREE.BoxGeometry(.05,.08,.016),gold(),
      'Zipper pull',0,.66,.27);
  }
  g.userData.modelWidth=1.95;
  g.userData.modelHeight=1.55;
  return g;
}
function buildShoe(){
  const g=new THREE.Group();g.name='Demo white sneaker 3D';
  const upper=standard('#ecede5',.04,.78);
  const sole=standard('#b6beb6',.05,.72);
  const side=new THREE.Shape();
  side.moveTo(-.55,.23);side.lineTo(-.5,-.13);side.quadraticCurveTo(-.20,-.42,.04,-.12);
  side.quadraticCurveTo(.38,-.11,.63,.20);
  side.lineTo(.63,.31);side.lineTo(-.55,.31);side.closePath();
  add(g,new THREE.ExtrudeGeometry(side,{depth:.32,bevelEnabled:true,bevelSize:.035,bevelThickness:.03,bevelSegments:1}),
    upper,'Sneaker upper',0,0,-.16);
  add(g,new THREE.BoxGeometry(1.27,.18,.43),sole,'Rubber sole',0,.34,0);
  line(g,[[-.28,-.06,.25],[-.02,-.02,.25],[.23,.08,.25]],.015,sole,'Laces');
  g.userData.modelWidth=1.30;g.userData.modelHeight=.8;
  return g;
}
function disposeGroup(node){
  const materials=new Set();
  node.traverse(x=>{
    x.geometry?.dispose?.();
    if(x.material)(Array.isArray(x.material)?x.material:[x.material])
      .forEach(m=>materials.add(m));
  });
  for(const material of materials){
    material.map?.dispose?.();
    material.dispose?.();
  }
}
const makers={
  watch:buildWatch,ring:buildRing,earrings:buildEarrings,
  bracelet:buildBracelet,glasses:buildGlasses,
  bag:buildBag,tee:()=>buildShirt(false),jacket:()=>buildShirt(true),shoes:buildShoe
};

export class Fit3DRenderer {
  constructor(parent){
    if(!parent)throw new Error('Missing camera canvas container');
    this.canvas=document.createElement('canvas');
    this.canvas.className='fit-3d-layer';
    this.canvas.setAttribute('aria-label','3D render matching the tracking landmarks');
    parent.append(this.canvas);
    this.renderer=new THREE.WebGLRenderer({
      canvas:this.canvas,alpha:true,antialias:false,preserveDrawingBuffer:true,
      powerPreference:'low-power'
    });
    this.renderer.setClearColor(0x000000,0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.4;
    this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(0,1,0,1,.01,1800);
    this.camera.position.z=900;
    this.scene.add(new THREE.HemisphereLight('#f4fff3','#8c978e',3.1));
    const key=new THREE.DirectionalLight('#ffffff',3.0);
    key.position.set(-200,-260,330);this.scene.add(key);
    const side=new THREE.DirectionalLight('#d6e2ff',1.15);
    side.position.set(300,50,-110);this.scene.add(side);
    this.meshes={};
    for(const [id,factory] of Object.entries(makers)){
      const mesh=factory();
      mesh.visible=false;this.meshes[id]=mesh;this.scene.add(mesh);
    }
    this.lastWidth=0;this.lastHeight=0;this.destroyed=false;
    this.referenceTee=null;
    this.referencePromise=null;
    this.referenceGeneration=0;
    this.referenceStatus={status:'idle',assetId:'RAWNAK-REF-TEE-001',approved:false};
    this.useReferenceGLB=true;
  }
  getActiveModel(category){
    return category==='tee' && this.useReferenceGLB && this.referenceTee
      ? this.referenceTee : this.meshes[category];
  }
  setUseReferenceGLB(enabled){
    this.useReferenceGLB=Boolean(enabled);
    this.clear();
  }
  installGarmentSource(source){
    if(this.destroyed)return null;
    const yFlip=new THREE.Group();
    yFlip.name='GLB_Yup_to_camera_Ydown';
    yFlip.rotation.x=Math.PI;
    yFlip.add(source.source);
    const holder=new THREE.Group();
    holder.name=source.status==='local_unverified'?'LOCAL_GLB_UNVERIFIED':'REFERENCE_TEE_GLTF_NOT_VERIFIED';
    holder.add(yFlip);
    holder.visible=false;
    holder.userData.modelWidth=source.modelWidth;
    holder.userData.modelHeight=source.modelHeight;
    holder.userData.assetId=source.id;
    holder.userData.riggedGarment=true;
    holder.userData.approved=false;
    holder.userData.bones=source.joints;
    const Motion=window.RawnakFitGarmentMotion;
    holder.userData.sleeveSpring=Motion?new Motion.SleeveSpring():null;
    if(this.referenceTee){
      this.scene.remove(this.referenceTee);
      disposeGroup(this.referenceTee);
    }
    this.referenceTee=holder;
    this.scene.add(holder);
    this.referenceStatus={status:source.status==='local_unverified'?'local_unverified':'ready',
      assetId:source.id,fileName:source.fileName||null,approved:false};
    return holder;
  }
  async ensureReferenceGarment(){
    if(this.destroyed)return null;
    if(this.referenceTee)return this.referenceTee;
    if(this.referencePromise)return this.referencePromise;
    const generation=++this.referenceGeneration;
    this.referenceStatus={status:'loading',assetId:'RAWNAK-REF-TEE-001',approved:false};
    this.referencePromise=(async()=>{
      const {loadReferenceGarment}=await import('./fit-glb-assets.js?v=20261118-alpha110');
      const source=await loadReferenceGarment('tee');
      if(this.destroyed||generation!==this.referenceGeneration)return null;
      return this.installGarmentSource(source);
    })().catch(error=>{
      if(generation===this.referenceGeneration){
        this.referenceStatus={status:'error',assetId:'RAWNAK-REF-TEE-001',
          approved:false,message:String(error?.message||error)};
        console.warn('[RAWNAK FIT GLB] Reference load failed:',error);
      }
      return null;
    }).finally(()=>{this.referencePromise=null;});
    return this.referencePromise;
  }
  async importLocalGarment(file){
    if(this.destroyed)throw new Error('Renderer destroyed');
    const generation=++this.referenceGeneration;
    this.referenceStatus={status:'loading_local',approved:false,assetId:'LOCAL-UNVERIFIED'};
    try{
      const {parseLocalGarmentFile}=await import('./fit-glb-assets.js?v=20261118-alpha110');
      const source=await parseLocalGarmentFile(file);
      if(this.destroyed||generation!==this.referenceGeneration)return null;
      const holder=this.installGarmentSource(source);
      this.useReferenceGLB=true;
      return holder;
    }catch(error){
      if(generation===this.referenceGeneration){
        this.referenceStatus={status:'error',approved:false,assetId:'LOCAL-UNVERIFIED',
          message:String(error?.message||error)};
      }
      throw error;
    }
  }
  resize(width,height){
    if(width===this.lastWidth&&height===this.lastHeight)return;
    this.lastWidth=width;this.lastHeight=height;
    this.renderer.setSize(width,height,false);
    // Camera is centered on the preview. Use centered, Y-down view extents
    // so pixel (0,0) is top-left and a product at (x,y) sits on that exact pixel.
    this.camera.left=-width/2;this.camera.right=width/2;
    this.camera.top=-height/2;this.camera.bottom=height/2;
    this.camera.position.set(width/2,height/2,900);
    this.camera.lookAt(width/2,height/2,0);
    this.camera.updateProjectionMatrix();
  }
  clear(){
    Object.values(this.meshes).forEach(mesh=>{mesh.visible=false;});
    if (this.referenceTee) this.referenceTee.visible=false;
    if (this.secondShoe) this.secondShoe.visible = false;
    this.renderer.clear();
  }
  updateGarment(category,landmarks,placement,options){
    if(category!=='tee'&&category!=='jacket')return;
    const garment=this.getActiveModel(category),motion=window.RawnakFitGarmentMotion;
    if(!garment||!motion)return;
    const sleeves=garment.userData.sleeves;
    const spring=garment.userData.sleeveSpring;
    const enabled=options.garmentMotion!==false;
    if(!enabled)spring?.reset();
    const targets=enabled
      ? motion.targetSleeves(landmarks,placement,options.project,options.width,options.height)
      : {left:0,right:0};
    const dynamics=enabled&&spring
      ? spring.update(targets,Date.now()) : {left:0,right:0,phase:0,energy:0};
    // Imported GLB: native glTF skinning weighs vertices against named joint
    // transforms. Local source mesh is Y-up and flipped 180deg into camera Y-down.
    if(garment.userData.riggedGarment){
      const bones=garment.userData.bones;
      if(bones){
        bones.left.rotation.z=-Math.max(-1.1,Math.min(1.1,dynamics.left*.92));
        bones.right.rotation.z=-Math.max(-1.1,Math.min(1.1,dynamics.right*.92));
      }
      return;
    }
    // Legacy procedural mesh, used only for explicit comparison or load failure.
    if(sleeves){
      sleeves.left.rotation.z=Math.max(-1.1,Math.min(1.1,dynamics.left*.92));
      sleeves.right.rotation.z=Math.max(-1.1,Math.min(1.1,dynamics.right*.92));
    }
    const target=garment.userData.garmentMesh;
    const base=garment.userData.restPositions;
    const attr=target?.geometry?.attributes?.position;
    if(!attr||!base)return;
    const amplitude=enabled?Math.min(.012,dynamics.energy*.15):0;
    if(amplitude<.0002 && !garment.userData.torsoWasMoving)return;
    const positions=attr.array;
    if(amplitude<.0002){
      positions.set(base);
      garment.userData.torsoWasMoving=false;
    }else{
      const phase=dynamics.phase;
      for(let i=0;i<base.length;i+=3){
        const y=base[i+1],x=base[i];
        positions[i]=base[i];
        positions[i+1]=y;
        positions[i+2]=base[i+2]+Math.sin(y*11+x*9+phase)*amplitude*Math.min(1,y);
      }
      garment.userData.torsoWasMoving=true;
    }
    attr.needsUpdate=true;
    target.geometry.computeVertexNormals();
  }
  resetGarment(category){
    if(category!=='tee'&&category!=='jacket')return;
    const obj=this.getActiveModel(category);
    if(obj?.userData.riggedGarment){
      const bones=obj.userData.bones;
      if(bones){bones.left.rotation.z=0;bones.right.rotation.z=0;}
      obj.userData.sleeveSpring?.reset();
      return;
    }
    const garment=obj?.userData.garmentMesh,rest=obj?.userData.restPositions;
    if(obj?.userData.sleeves){
      obj.userData.sleeves.left.rotation.z=0;
      obj.userData.sleeves.right.rotation.z=0;
    }
    obj?.userData.sleeveSpring?.reset();
    if(!garment||!rest||!obj.userData.torsoWasMoving)return;
    garment.geometry.attributes.position.array.set(rest);
    garment.geometry.attributes.position.needsUpdate=true;
    garment.geometry.computeVertexNormals();
    obj.userData.torsoWasMoving=false;
  }
  render(category,landmarks,options){
    if(this.destroyed)return {ok:false,reason:'3D renderer disposed'};
    const {width,height,project,worldLandmarks,scale}=options;
    this.resize(width,height);
    const solve=window.RawnakFit3DPose;
    if(!solve){this.clear();return {ok:false,reason:'جاري تجهيز تتبع 3D'};}
    const placement=solve.compute(category,landmarks,{width,height,project,worldLandmarks,scale});
    if(!placement.ok){this.clear();return placement;}
    this.clear();
    const mesh=this.getActiveModel(category);
    if(!mesh){return {ok:false,reason:'مجسم غير متاح للفئة'};}
    if(category==='shoes'){
      // One 3D shoe per detected ankle, both with depth and lighting.
      const positions=placement.feet;
      const first=mesh;
      first.visible=true;
      const a=positions[0];
      first.position.set(a.x,a.y,2);
      first.scale.setScalar(a.widthPx/first.userData.modelWidth);
      first.rotation.set(.06,0,a.angle);
      if(positions.length>1){
        // Second shoe is an independent instance sharing geometry/materials.
        if(!this.secondShoe){this.secondShoe=buildShoe();this.scene.add(this.secondShoe);}
        const b=positions[1],other=this.secondShoe;other.visible=true;
        other.position.set(b.x,b.y,2);
        other.scale.setScalar(b.widthPx/other.userData.modelWidth);
        other.rotation.set(.06,0,b.angle);
      }else if(this.secondShoe)this.secondShoe.visible=false;
    } else {
      mesh.visible=true;
      if(category==='tee'||category==='jacket')
        this.updateGarment(category,landmarks,placement,options);
      mesh.position.set(placement.x,placement.y,0);
      mesh.rotation.set(placement.pitch||0,placement.yaw||0,placement.angle||0,'ZYX');
      const wScale=placement.widthPx/mesh.userData.modelWidth;
      if(category==='tee'||category==='jacket'){
        const hScale=placement.heightPx/mesh.userData.modelHeight;
        mesh.scale.set(wScale,hScale,wScale);
      }else mesh.scale.setScalar(wScale);
    }
    this.renderer.render(this.scene,this.camera);
    return {ok:true,canvas:this.canvas,placement};
  }
  preview(category,{yaw=0,tilt=0,scale=1,sleeveAngle=0}={}){
    if(this.destroyed)return false;
    const width=Math.max(240,this.canvas.parentElement?.clientWidth||480);
    const height=Math.max(240,this.canvas.parentElement?.clientHeight||430);
    this.resize(width,height);
    this.clear();
    const mesh=this.getActiveModel(category);
    if(!mesh)return false;
    mesh.visible=true;
    this.resetGarment(category);
    if((category==='tee'||category==='jacket')){
      const a=Math.max(-1.12,Math.min(1.12,Number(sleeveAngle)||0));
      if(mesh.userData.riggedGarment){
        mesh.userData.bones.left.rotation.z=-a;
        mesh.userData.bones.right.rotation.z=a;
      } else if(mesh.userData.sleeves){
        mesh.userData.sleeves.left.rotation.z=a;
        mesh.userData.sleeves.right.rotation.z=a === 0 ? 0 : -a;
      }
    }
    const fitted=Math.min(width*.62/mesh.userData.modelWidth,
      height*.70/mesh.userData.modelHeight)*Math.min(1.3,Math.max(.7,scale));
    mesh.scale.setScalar(fitted);
    mesh.rotation.set(tilt,yaw,0,'ZYX');
    // Garment geometry starts at its collar; other models are centered.
    const y=category==='tee'||category==='jacket'
      ? (height-mesh.userData.modelHeight*fitted)*.5 : height*.5;
    mesh.position.set(width*.5,y,0);
    this.renderer.render(this.scene,this.camera);
    return true;
  }
  dispose(){
    if(this.destroyed)return;
    this.destroyed=true;
    for(const mesh of Object.values(this.meshes))disposeGroup(mesh);
    if(this.referenceTee)disposeGroup(this.referenceTee);
    if(this.secondShoe)disposeGroup(this.secondShoe);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
