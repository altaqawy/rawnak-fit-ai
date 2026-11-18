// Measured construction and rig in metres. No camera or AR runtime dependency.
import * as THREE from 'three';
import {createBagSpec,describeBagComponents} from './bag-spec.js';
import {makePattern,clamp} from './bag-patterns.js';
import {grid,cord,stitches,sampled} from './bag-surfaces.js';
import {makeMaterials} from './bag-materials.js';
import {buildShell,buildPockets} from './bag-shell.js';
import {buildCarriers,buildClosure} from './bag-mechanisms.js';
import {cleanEdit} from './bag-editor.js';

export function buildModularBag(input={},options={}){
  const s=createBagSpec(input), p=makePattern(s,options.fit?.widths);
  const root=new THREE.Group();root.name='RAWNAK_MODULAR_BAG';
  const parts=new Map(),groups=new Map(),edits={},materials=new Set(),variants=new Map();
  const maps=options.maps||{},m=makeMaterials(s,maps);
  Object.values(m).forEach(mat=>materials.add(mat));
  const list=describeBagComponents(s),refs=options.images||[];
  const motions={open:[],swing:[],pockets:[]},morphs=[],anchors={},detail=options.profile==='mobile'?10:16;
  const profile=options.profile==='mobile'?'mobile':'detail';
  for(const source of list){
    const edit=cleanEdit(source,options.edits?.[source.id]);edits[source.id]=edit;
    const hits=refs.filter(img=>source.requires.includes(img.view));
    const part={...source,behavior:edit.behavior||source.behavior,rigidity:edit.behavior||source.behavior,
      flexibility:source.role==='panel'?s.flexibility:null,moving:edit.moving??source.moving,
      mobility:(edit.moving??source.moving)?'movable':'fixed',animationImplemented:source.moving&&edit.moving!==false,
      position:[0,0,0],orientation:[0,0,0,1],dimensions:{width:0,height:0,depth:0},
      thicknessM:['panel','side','bottom','interior_partition','interior'].includes(source.role)?p.thickness:null,
      anchors:{},connections:source.parent?[source.parent]:[],visible:edit.visible!==false,
      geometryConstraints:{pattern:s.style,boundedToParent:true},range:null,
      sourceEvidence:hits.map(i=>i.id||i.name),verification:hits.length?'reference-available':'inferred',
      confidence:null,overrides:edit};
    parts.set(part.id,part);
    const g=new THREE.Group();g.name=part.id;g.userData={partId:part.id};
    groups.set(part.id,g);root.add(g);
  }
  function mesh(id,name,geometry,material){
    const edit=edits[id];
    if(edit?.roughness!==undefined){
      const key=id+'_'+material.uuid;
      if(!variants.has(key)){
        const mat=material.clone();mat.roughness=edit.roughness;
        variants.set(key,mat);materials.add(mat);
      }
      material=variants.get(key);
    }
    const o=new THREE.Mesh(geometry,material);o.name=id+'__'+name;o.userData={partId:id};
    if(material.aoMap)geometry.setAttribute('uv1',geometry.attributes.uv.clone());
    groups.get(id).add(o);return o;
  }
  function deformable(id,name,make,mat,affected){
    const geom=make(0);
    if(s.closure==='drawstring'&&affected){
      const target=make(1);
      geom.morphAttributes.position=[target.attributes.position];
      geom.morphAttributes.normal=[target.attributes.normal];target.dispose();
    }
    const obj=mesh(id,name,geom,mat);
    if(obj.morphTargetInfluences?.length){obj.morphTargetDictionary={open:0};morphs.push(obj);}
    return obj;
  }
  const sheet=(id,name,n,k,fn,mat,reverse=false)=>deformable(id,name,
    o=>grid(n,k,(u,v)=>fn(u,v,o),reverse),mat,fn.length>2);
  const path=(id,name,count,fn,radius,mat,dashed=false)=>deformable(id,name,
    o=>(dashed?stitches:cord)(sampled(count,t=>fn(t,o)),radius),mat,fn.length>1);
  function anchor(name,point,parent=root,origin=null){
    const node=new THREE.Object3D();node.name='anchor_'+name;
    node.position.set(...point);if(origin)node.position.sub(origin);
    node.userData={anchor:name};parent.add(node);anchors[name]={node:node.name,position:point};
  }
  const hardware=(id,name,r,mat)=>mesh(id,name,new THREE.SphereGeometry(r,12,8),mat);
  const limit=id=>edits[id]?.moving===false?0:(edits[id]?.motionLimit??1);
  const c={p,s,m,mesh,sheet,path,parts,groups,edits,detail,motions,anchor,hardware,limit};
  buildShell(c);buildPockets(c);buildCarriers(c);buildClosure(c);
  anchor('base',p.volume(0,0,0,0));anchor('opening',p.volume(0,0,1,0));
  let logo=null;
  function setLogoTexture(texture){
    if(!parts.has('brand_mark'))return;
    const used=s.brandLicenseConfirmed?texture:null;
    const material=logo?.material||m.art;
    if(material.map&&material.map!==used)material.map.dispose();
    material.map=used;material.needsUpdate=true;
    if(logo){groups.get('brand_mark').remove(logo);logo.geometry.dispose();logo=null;}
    if(!used)return;
    const aspect=(used.image?.width||2)/(used.image?.height||1);
    const width=Math.min(p.w*.25,p.h*.14*aspect), height=width/aspect;
    const back=s.logoPlacement!=='front',inside=s.logoPlacement==='inside';
    const angle=back?Math.PI:0,t=inside?.64:.30, center=p.surface(angle,t,inside?p.thickness*2:-p.thickness);
    logo=mesh('brand_mark','BRAND_MARK_IMAGE',new THREE.PlaneGeometry(width,height),material);
    logo.position.set(...center);if(back&&!inside)logo.rotation.y=Math.PI;
    logo.renderOrder=1;
  }
  if(parts.has('brand_mark')){
    if(['metal','patch'].includes(s.logoType)){
      const inside=s.logoPlacement==='inside',angle=s.logoPlacement==='front'?0:Math.PI;
      sheet('brand_mark','BRAND_BACKING',10,4,(u,v)=>p.surface(angle+(u-.5)*.40,.24+v*.12,
        inside?p.thickness*1.8:-p.thickness*.72),s.logoType==='metal'?m.metal:m.trim);
    }
    setLogoTexture(maps.logo);
  }
  const closed=new Set();let cut=false;
  function visibility(){
    for(const part of parts.values()){
      let v=true,up=part;
      while(up){if(!up.visible){v=false;break;}up=parts.get(up.parent);}
      if(cut&&['front_panel','piping','opening','closure','brand_mark'].includes(part.id))v=false;
      if(cut&&(part.role==='outer_pocket'||part.id.startsWith('handle_')||part.id.startsWith('strap_')))v=false;
      groups.get(part.id).visible=v;
    }
    // Front shell and front lining are cut together. Other cavity surfaces stay intact.
    for(const mat of materials){
      mat.clippingPlanes=cut?[new THREE.Plane(new THREE.Vector3(0,0,-1),p.d*.16)]:null;
      mat.clipIntersection=false;
    }
  }
  const unit=n=>clamp(Number(n)||0,0,1);
  function setOpening(value){
    const n=unit(value);
    for(const fn of motions.open)fn(n);
    for(const o of morphs)o.morphTargetInfluences[0]=n*limit('closure');
  }
  const setSwing=n=>motions.swing.forEach(fn=>fn(clamp(Number(n)||0,-1,1)));
  const setPockets=n=>motions.pockets.forEach(fn=>fn(unit(n)));
  setOpening(0);setSwing(0);setPockets(0);visibility();root.updateMatrixWorld(true);
  let triangles=0,draws=0;
  for(const part of parts.values()){
    const group=groups.get(part.id), bounds=new THREE.Box3();
    group.traverse(o=>{
      if(!o.isMesh||o.userData.partId!==part.id)return;
      o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;draws++;
    });
    if(!bounds.isEmpty()){
      const size=bounds.getSize(new THREE.Vector3());
      part.dimensions={width:size.x,height:size.y,depth:size.z};
      part.position=bounds.getCenter(new THREE.Vector3()).toArray();
    }
    part.orientation=group.getWorldQuaternion(new THREE.Quaternion()).toArray();
    group.userData={partId:part.id,role:part.role,semanticParent:part.parent,joint:part.joint,
      range:part.range,rigidity:part.rigidity,animationImplemented:part.animationImplemented};
    if(part.role==='pocket_slider')part.range={unit:'path-fraction',min:0,max:limit(part.id)};
  }
  const body=parts.get('body');body.dimensions={width:p.w,height:p.h,depth:p.d};body.position=[0,p.h/2,0];
  root.userData={schema:'rawnak.fit.bag/2',units:'m',style:s.style,profile,physicalSimulation:false,
    merchantReview:options.approval||'unreviewed',photoGeometryVerified:false,retailARReady:false};
  const carries=[];
  for(const part of parts.values())if(['handle','strap'].includes(part.role)){
    const mode=part.role==='handle'||s.strapType==='hand'?'handheld':s.strapType;
    carries.push({mode,part:part.id,anchor:'anchor_'+part.id+'_carry',attachments:['a','b'].map(k=>'anchor_'+part.id+'_'+k)});
  }
  const graph={schema:'rawnak.fit.bag/2',units:'m',frame:{up:'+Y',front:'+Z',origin:'base-center',handedness:'right'},
    style:s.style,parts:[...parts.values()],anchors,carryingModes:carries,profile,
    performance:{triangles,draws,textureLimit:profile==='mobile'?512:1024},pose:'closed-neutral',
    materials:{outer:s.material,lining:s.lining,baseColor:s.bodyColor,metalColor:s.metalColor,
      source:Object.keys(maps).filter(k=>maps[k]),fallback:'procedural-PBR'},
    verification:{merchantReview:options.approval||'unreviewed',photoGeometryVerified:false,physicalSimulation:false,retailARReady:false}};
  return {root,spec:s,parts:graph.parts,graph,groups,pattern:p,setOpening,setSwing,setPockets,setLogoTexture,
    setInterior(enabled){cut=Boolean(enabled);visibility();},
    dispose(){
      if(closed.has(root))return;closed.add(root);
      const geometries=new Set(),textures=new Set(Object.values(maps).filter(Boolean));
      root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
      for(const mat of materials){for(const prop of Object.values(mat))if(prop?.isTexture)textures.add(prop);mat.dispose();}
      for(const tex of textures)tex.dispose();for(const geo of geometries)geo.dispose();root.clear();
    }
  };
}
