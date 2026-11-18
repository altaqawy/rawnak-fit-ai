// RAWNAK FIT modular bag preview, actual geometries separated by role.
// This is a dimensional, part-aware reference asset — NOT accurate image-to-3D.
import * as THREE from 'three';
import {createBagSpec,describeBagComponents,BAG_MATERIALS,BAG_CLOSURES} from './bag-spec.js';

const cm=n=>Number(n)/100;
const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
function makeMat(hex,roughness=.8,metalness=0,transparent=false){
  return new THREE.MeshStandardMaterial({color:hex,roughness,metalness,side:THREE.DoubleSide,transparent});
}
function addPart(root,name,role,geometry,material,pos,behavior='rigid',extra={}){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;
  mesh.position.set(...pos);
  mesh.userData={
    type:'bag_component',role,behavior,
    movable:Boolean(extra.movable),joint:extra.joint||null,
    dimensionsCm:extra.dimensionsCm||null,
    verifiedFromPhotos:false,physicsImplemented:false
  };
  root.add(mesh);return mesh;
}
function tubularPath(root,name,role,coords,thickness,mat,behavior='flexible'){
  const pts=coords.map(p=>new THREE.Vector3(...p));
  const path=new THREE.CatmullRomCurve3(pts);
  return addPart(root,name,role,new THREE.TubeGeometry(path,48,thickness,8,false),
    mat,[0,0,0],behavior,{movable:true,joint:'strap_anchor'});
}
function brandedPlane(placement,w,h,d,material){
  const logoW=clamp(w*.30,.032,.16),logoH=logoW*.47;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(logoW,logoH),material);
  mesh.name='BRAND_MARK_IMAGE';
  mesh.userData={type:'bag_component',role:'logo',behavior:'surface-attached',
    movable:false,logoPreviewOnly:true,verifiedFromPhotos:false};
  if(placement==='back'){
    mesh.rotation.y=Math.PI;mesh.position.set(0,h*.07,-d*.5-.004);
  } else if(placement==='inside'){
    mesh.rotation.y=Math.PI;mesh.position.set(0,h*.18,d*.5-.009);
  } else {
    mesh.position.set(0,h*.07,d*.5+.004);
  }
  return mesh;
}
export function buildModularBag(specInput={}){
  const spec=createBagSpec(specInput);
  const w=cm(spec.widthCm),h=cm(spec.heightCm),d=cm(spec.depthCm);
  const skin=makeMat(spec.bodyColor,BAG_MATERIALS[spec.material].roughness);
  const trim=makeMat(spec.bodyColor,.71);
  const inside=makeMat(spec.lining==='leather'?'#866148':'#cfb5a0',.94);
  const metal=makeMat(spec.metalColor,.24,.83);
  const root=new THREE.Group();
  root.name='RAWNAK_MODULAR_BAG_DRAFT';
  root.userData={source:'merchant-supplied-structure',
    isProductExact:false,physicalClothSimulation:false,rigVersion:'bag-schema-v0.1',
    dimensionsCm:{width:spec.widthCm,height:spec.heightCm,depth:spec.depthCm},
    material:spec.material,style:spec.style,fitAccurate:false,
    reviewed:false,interiorSchematic:true};
  const geometryParts={};
  const panelThick=clamp(Math.min(w,h,d)*.038,.002,.009);
  const sideThick=panelThick;
  const front=addPart(root,'FRONT_PANEL','front_panel',new THREE.BoxGeometry(w,h,panelThick),
    skin,[0,0,d/2],'semi-rigid',{dimensionsCm:{width:spec.widthCm,height:spec.heightCm}});
  const back=addPart(root,'BACK_PANEL','back_panel',new THREE.BoxGeometry(w,h,panelThick),
    skin,[0,0,-d/2],'semi-rigid',{dimensionsCm:{width:spec.widthCm,height:spec.heightCm}});
  const left=addPart(root,'LEFT_GUSSET','left_gusset',new THREE.BoxGeometry(sideThick,h,d),
    skin,[-w/2,0,0],BAG_MATERIALS[spec.material].behavior);
  const right=addPart(root,'RIGHT_GUSSET','right_gusset',new THREE.BoxGeometry(sideThick,h,d),
    skin,[w/2,0,0],BAG_MATERIALS[spec.material].behavior);
  const bottom=addPart(root,'BOTTOM_PANEL','bottom_panel',new THREE.BoxGeometry(w,panelThick,d),
    skin,[0,-h/2,0],'semi-rigid');
  Object.assign(geometryParts,{front,back,left,right,bottom});
  // Lining is rendered as a separate, narrow inner surface; no fabric solver yet.
  const lining=addPart(root,'INNER_LINING','lining',
    new THREE.BoxGeometry(w*.98,h*.96,.0015),inside,[0,0,-d*.5+.007],'flexible');
  const dividers=[];
  for(let i=1;i<spec.mainCompartments;i++){
    const z=-d/2+d*i/spec.mainCompartments;
    dividers.push(addPart(root,'DIVIDER_'+i,'interior_partition',
      new THREE.BoxGeometry(w*.96,h*.83,.002),inside,[0,-h*.035,z],'flexible'));
  }
  const pockets=[];
  const pocketW=Math.min(w*.42,.18);
  for(let i=0;i<spec.innerOpenPockets;i++){
    const x=spec.innerOpenPockets===1?0:
      (-.5+i/(spec.innerOpenPockets-1))*Math.min(w*.5,.24);
    pockets.push(addPart(root,'OPEN_POCKET_'+(i+1),'inner_open_pocket',
      new THREE.BoxGeometry(pocketW,.062,.002),inside,[x,-h*.08,d/2-.008],'flexible'));
  }
  for(let i=0;i<spec.innerZippedPockets;i++){
    const x=spec.innerZippedPockets===1?0:
      (-.5+i/(spec.innerZippedPockets-1))*Math.min(w*.5,.24);
    const zip=addPart(root,'ZIP_POCKET_'+(i+1),'inner_zip_pocket',
      new THREE.BoxGeometry(pocketW,.056,.002),inside,[x,h*.1,-d/2+.012],'flexible');
    pockets.push(zip);
    addPart(root,'ZIP_POCKET_PULL_'+(i+1),'zipper_slider',
      new THREE.BoxGeometry(.009,.010,.004),metal,
      [x+pocketW*.35,h*.128,-d/2+.016],'rigid',{movable:true,joint:'slider'});
  }
  for(let i=0;i<spec.outerPockets;i++){
    const pocket=addPart(root,'OUTER_POCKET_'+(i+1),'outer_pocket',
      new THREE.BoxGeometry(w*.43,h*.21,.013),skin,
      [(i%2===0?-.21:.21)*w,-h*.15-i*.006,d/2+.012],
      BAG_MATERIALS[spec.material].behavior);
    pockets.push(pocket);
  }

  const flapPivot=new THREE.Group();
  flapPivot.name='CLOSURE_HINGE';
  flapPivot.position.set(0,h/2,-d/2);
  flapPivot.userData={type:'bag_component',role:'flap_joint',
    behavior:'hinged',moving:true,rangeDegrees:[0,125],
    physicsImplemented:false};
  root.add(flapPivot);
  if(['flap','magnetic','clasp'].includes(spec.closure)){
    addPart(flapPivot,'FLAP_PANEL','flap',
      new THREE.BoxGeometry(w*.97,h*.3,.007),skin,[0,-h*.15,d*.52],
      BAG_MATERIALS[spec.material].behavior,{movable:true,joint:'hinge'});
    addPart(flapPivot,'FLAP_HARDWARE','closure_hardware',
      new THREE.BoxGeometry(.019,.014,.008),metal,
      [0,-h*.29,d*.52+.009],'rigid',{movable:true,joint:'hinge'});
  }
  const sliderGroup=new THREE.Group();sliderGroup.name='ZIPPER_SLIDER';
  sliderGroup.userData={type:'bag_component',role:'zipper_slider',
    behavior:'rigid',movable:true,joint:'translation'};
  root.add(sliderGroup);
  if(spec.closure==='zipper'){
    addPart(root,'ZIPPER_TRACK','zipper',new THREE.BoxGeometry(w*.84,.003,.012),
      metal,[0,h/2+.003,0],'semi-rigid',{movable:false});
    addPart(sliderGroup,'ZIPPER_HANDLE','zipper_slider',
      new THREE.BoxGeometry(.017,.012,.018),metal,
      [0,h/2+.009,0],'rigid',{movable:true,joint:'translation'});
  }

  const strapPivots=[];
  const strapColor=makeMat(spec.bodyColor,.8);
  for(let i=0;i<spec.strapCount;i++){
    const attachment=new THREE.Group();
    attachment.name='STRAP_ANCHOR_'+(i+1);
    const rootY=h/2-.025;
    attachment.position.set(0,rootY,0);
    attachment.userData={type:'bag_component',role:'strap_anchor',
      behavior:'hinged',moving:true,axis:'x'};
    root.add(attachment);
    const hStrap=clamp(cm(spec.strapLengthCm)*.44,w*.24,w*2.0);
    const leftX=-w*.43,rightX=w*.43;
    tubularPath(attachment,'STRAP_'+(i+1),'strap',
      [[leftX,0,0],[leftX-.012,hStrap*.54,0],
        [0,hStrap*.98,0],[rightX+.012,hStrap*.54,0],[rightX,0,0]],
      cm(spec.strapWidthCm)*.17,strapColor);
    strapPivots.push(attachment);
    for(const x of [leftX,rightX])
      addPart(root,'STRAP_ANCHOR_RING','hardware',
        new THREE.TorusGeometry(.014,.0025,8,18),metal,[x,rootY,.008],
        'rigid',{movable:false});
  }
  const handlePivots=[];
  for(let i=0;i<spec.handlesCount;i++){
    const pivot=new THREE.Group();pivot.name='HANDLE_ANCHOR_'+(i+1);
    pivot.position.set(0,h/2-.008,d*.34);root.add(pivot);
    pivot.userData={type:'bag_component',role:'handle_anchor',
      behavior:'semi-rigid',moving:true};
    const span=Math.min(w*.32,.15);
    tubularPath(pivot,'HANDLE_'+(i+1),'handle',
      [[-span,0,0],[-span,.07,0],[0,.13,0],[span,.07,0],[span,0,0]],
      .007,strapColor,'semi-rigid');
    handlePivots.push(pivot);
  }
  const logoMaterial=new THREE.MeshBasicMaterial({
    color:0xffffff,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false
  });
  const logo=brandedPlane(spec.logoPlacement,w,h,d,logoMaterial);
  logo.visible=spec.logoPlacement!=='none';
  root.add(logo);
  const parts=describeBagComponents(spec);
  root.userData.parts=parts;
  const model={
    root,parts,spec,geometryParts,logo,logoMaterial,strapPivots,handlePivots,
    flapPivot,sliderGroup,lining,dividers,pockets,
    setOpening(amount){
      const n=clamp(Number(amount)||0,0,1);
      flapPivot.rotation.x=-n*Math.PI*.66;
      sliderGroup.position.x=(n-.5)*w*.78;
      model.openAmount=n;
    },
    setSwing(amount){
      const n=clamp(Number(amount)||0,-1,1);
      for(const [i,p] of strapPivots.entries())p.rotation.z=n*.28*(i%2?-.85:1);
      for(const [i,p] of handlePivots.entries())p.rotation.z=n*.13*(i%2?-.85:1);
    },
    setInterior(show){
      // The outer front panel hides to expose the *schematic* partitions;
      // this is an inspector X-ray, NOT a physically sewn flap/opening.
      const enabled=Boolean(show);
      front.visible=!enabled;
      lining.visible=enabled;
      dividers.forEach(x=>x.visible=enabled);
      pockets.forEach(x=>{if(x.name.includes('OUTER'))x.visible=!enabled;else x.visible=enabled;});
      model.insideShown=enabled;
    },
    setLogoTexture(texture){
      if(logoMaterial.map && logoMaterial.map!==texture)logoMaterial.map.dispose();
      logoMaterial.map=texture||null;
      logoMaterial.color.set('#ffffff');
      logoMaterial.needsUpdate=true;
      logo.visible=Boolean(texture)&&spec.logoPlacement!=='none';
    },
    dispose(){
      root.traverse(o=>{
        o.geometry?.dispose?.();
      });
      for(const material of new Set([skin,trim,inside,metal,strapColor,logoMaterial]))
        {material.map?.dispose?.();material.dispose();}
    }
  };
  model.setOpening(0);
  model.setSwing(0);
  model.setInterior(false);
  logo.visible=false;
  return model;
}
