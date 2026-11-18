import * as THREE from 'three';
import {BAG_MATERIALS} from './bag-spec.js';

const finishes={
  leather:[.48,.30],faux_leather:[.39,.25],suede:[.96,.48],canvas:[.90,.45],
  nylon:[.48,.23],woven:[.88,.70],rigid_case:[.32,.09],cotton:[.93,.36],polyester:[.77,.23]
};
// Periodic, deterministic micro-normal swatches; never attributed to a photo.
function grain(kind){
  const size=64,data=new Uint8Array(size*size*4);
  const woven=['woven','canvas','cotton','polyester','nylon'].includes(kind);
  function height(x,y) {
    const a=x*2*Math.PI/size,b=y*2*Math.PI/size;
    return woven ? .5*Math.cos(8*a)*Math.cos(4*b)+.38*Math.sin(8*b)*Math.sin(4*a)
      : .28*Math.sin(6*a+2*Math.sin(3*b))+.12*Math.cos(11*b+4*Math.sin(a))+.11*Math.cos(7*a+9*b);
  }
  for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i+=4){
    const dx=height(x-1,y)-height(x+1,y),dy=height(x,y-1)-height(x,y+1);
    const norm=Math.hypot(dx,dy,1);
    for(const [c,v] of [dx,dy,1].entries())data[i+c]=Math.round(127.5*(1+v/norm));
    data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.name='Template micrograin · '+kind;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,6);
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
  return t;
}
export function makeMaterials(spec,maps={}){
  const standard=(color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});
  const finish=finishes[spec.material]||[BAG_MATERIALS[spec.material].roughness,.2];
  const skin=standard(maps.material?'#ffffff':spec.bodyColor,finish[0]);
  skin.normalMap=maps.normal||grain(spec.material);skin.normalScale.setScalar(maps.normal?1:finish[1]);
  for(const [key,slot] of [['material','map'],['roughness','roughnessMap'],['metalness','metalnessMap'],['ao','aoMap']]){
    if(maps[key])skin[slot]=maps[key];
  }
  if(skin.roughnessMap)skin.roughness=1;if(skin.metalnessMap)skin.metalness=1;
  const trim=skin.clone();trim.color.multiplyScalar(.80);
  const lining=standard(spec.lining==='leather'?'#955c40':spec.lining==='cotton'?'#dcc5a7':'#ac8773',.85);
  lining.normalMap=grain(spec.lining);lining.normalScale.setScalar(.21);
  const edge=standard(new THREE.Color(spec.bodyColor).multiplyScalar(.44),.60);
  const thread=standard(new THREE.Color(spec.bodyColor).lerp(new THREE.Color('#efcf9e'),.56),.87);
  const metal=standard(spec.metalColor,.25,.82),zip=standard('#61584c',.44,.58);
  const plastic=standard('#37352f',.38),art=standard('#ffffff',.68);
  art.transparent=true;art.alphaTest=.025;art.depthWrite=false;art.polygonOffset=true;art.polygonOffsetFactor=-2;
  if(maps.logo)art.map=maps.logo;
  return {skin,trim,lining,edge,thread,metal,zip,plastic,art};
}
