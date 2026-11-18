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
function shirtShape(){
  const s=new THREE.Shape();
  s.moveTo(-.51,0);s.lineTo(-.72,.12);s.lineTo(-.88,.44);
  s.lineTo(-.58,.57);s.lineTo(-.49,.39);s.lineTo(-.47,1.49);
  s.quadraticCurveTo(0,1.53,.47,1.49);
  s.lineTo(.49,.39);s.lineTo(.58,.57);s.lineTo(.88,.44);
  s.lineTo(.72,.12);s.lineTo(.51,0);s.lineTo(.24,0);
  s.quadraticCurveTo(0,.29,-.24,0);s.lineTo(-.51,0);
  return s;
}
function buildShirt(jacket=false){
  const g=new THREE.Group();
  g.name=(jacket?'Light jacket':'Sage-green tee')+' — wearable 3D prototype';
  const fabric=standard(jacket?'#7b9b9e':'#6c937a',.03,jacket?.72:.94);
  const edge=standard(jacket?'#526f70':'#4e735e',.06,.9);
  const geom=new THREE.ExtrudeGeometry(shirtShape(),{
    depth:.24,bevelEnabled:true,bevelThickness:.04,bevelSize:.028,bevelSegments:1,
    curveSegments:5,steps:1
  });
  const garment=add(g,geom,fabric,jacket?'Jacket cloth volume':'Cotton jersey garment volume',0,0,-.13);
  // Keep neutral/rest vertex positions to avoid cumulative deformation artifacts.
  // The garment is a small dynamic 3D mesh, NOT a commercial cloth solver.
  g.userData.garmentMesh=garment;
  g.userData.restPositions=new Float32Array(geom.attributes.position.array);
  const Motion=window.RawnakFitGarmentMotion;
  g.userData.sleeveSpring=Motion?new Motion.SleeveSpring():null;
  line(g,[[-.24,.005,.16],[-.16,.12,.17],[0,.24,.17],[.16,.12,.17],[.24,.005,.16]],
    .022,edge,'Ribbed neckline');
  line(g,[[-.43,1.47,.13],[0,1.51,.13],[.43,1.47,.13]],.012,edge,'Hem stitch');
  if(jacket){
    line(g,[[0,.18,.18],[0,.75,.19],[0,1.50,.18]],.015,standard('#d4c6a3',.75,.36),'Zipper');
    add(g,new THREE.BoxGeometry(.065,.07,.025),gold(),'Zipper pull',0,.75,.21);
  }
  g.userData.modelWidth=1.8;g.userData.modelHeight=1.55;
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
  node.traverse(x=>{
    x.geometry?.dispose?.();
    if(x.material)(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m.dispose?.());
  });
}
const makers={
  watch:buildWatch,bracelet:buildBracelet,glasses:buildGlasses,
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
    if (this.secondShoe) this.secondShoe.visible = false;
    this.renderer.clear();
  }
  updateGarment(category,landmarks,placement,options){
    if(category!=='tee'&&category!=='jacket')return;
    const shirt=this.meshes[category],motion=window.RawnakFitGarmentMotion;
    const target=shirt?.userData.garmentMesh;
    const rest=shirt?.userData.restPositions;
    const spring=shirt?.userData.sleeveSpring;
    if(!target||!rest||!motion)return;
    const active=options.garmentMotion!==false;
    if(!active)spring?.reset();
    const detected=active
      ? motion.targetSleeves(landmarks,placement,options.project,options.width,options.height)
      : {left:0,right:0};
    const dynamics=active&&spring?spring.update(detected,Date.now())
      : {left:0,right:0,phase:0,energy:0};
    const attr=target.geometry.attributes.position;
    motion.deformGarment(attr.array,rest,dynamics);
    attr.needsUpdate=true;
    // Low-poly CPU normal refresh only on pose-inference frames.
    target.geometry.computeVertexNormals();
  }
  resetGarment(category){
    if(category!=='tee'&&category!=='jacket')return;
    const obj=this.meshes[category];
    const garment=obj?.userData.garmentMesh,rest=obj?.userData.restPositions;
    if(!garment||!rest)return;
    garment.geometry.attributes.position.array.set(rest);
    garment.geometry.attributes.position.needsUpdate=true;
    garment.geometry.computeVertexNormals();
    obj.userData.sleeveSpring?.reset();
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
    const mesh=this.meshes[category];
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
    const mesh=this.meshes[category];
    if(!mesh)return false;
    mesh.visible=true;
    this.resetGarment(category);
    if((category==='tee'||category==='jacket') && sleeveAngle!==0){
      const attr=mesh.userData.garmentMesh?.geometry.attributes.position;
      const rest=mesh.userData.restPositions;
      const motion=window.RawnakFitGarmentMotion;
      if(attr&&rest&&motion){
        const a=Math.max(-1.12,Math.min(1.12,Number(sleeveAngle)||0));
        motion.deformGarment(attr.array,rest,{left:a,right:-a,energy:0,phase:0});
        attr.needsUpdate=true;
        mesh.userData.garmentMesh.geometry.computeVertexNormals();
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
    if(this.secondShoe)disposeGroup(this.secondShoe);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
