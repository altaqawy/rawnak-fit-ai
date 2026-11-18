import * as THREE from 'three';
import {blend,clamp,mix,TAU} from './bag-patterns.js';
import {grid,cord,ribbon,sampled,updateGrid} from './bag-surfaces.js';

const vec=a=>new THREE.Vector3(...a);
export function buildCarriers(c){
  const {p,s,m,parts,groups,edits,mesh,path,detail,motions,anchor}=c;
  for(const part of parts.values()){
    if(!['strap','handle'].includes(part.role))continue;
    const handle=part.role==='handle',id=part.id,index=Number(id.split('_')[1])-1;
    const pack=!handle&&s.strapType==='backpack', e=edits[id]||{};
    const side=index%2?-1:1;
    const shift=e.anchorShift||0;
    const front=handle?side:(s.strapCount>1?side:0);
    let bases;
    const t=s.closure==='drawstring'?.70:(handle?.82:.87);
    if(pack){
      const angle=Math.PI+side*(.33+shift);
      bases=[p.surface(angle,t),p.surface(Math.PI+side*(.80+shift),.16)];
    }else if(front===0){
      bases=[p.surface(-Math.PI/2+shift,t),p.surface(Math.PI/2-shift,t)];
    }else{
      const a=(handle?.48:1.05)+shift;
      bases=[p.surface(front>0?-a:Math.PI+a,t),p.surface(front>0?a:Math.PI-a,t)];
    }
    const ringR=Math.min(p.w*.036,p.h*.055,p.d*.12);
    const ends=bases.map((at,i)=>{
      const suffix=i?'b':'a', tab=id+'_tab_'+suffix,ring=id+'_ring_'+suffix;
      const bearing=Math.atan2(at[0]/p.w,at[2]/p.d);
      const outward=[Math.sin(bearing),0,Math.cos(bearing)];
      const offset=(height,extension)=>[at[0]+outward[0]*extension,at[1]+height,at[2]+outward[2]*extension];
      const center=offset(ringR*1.35,ringR*.45);
      const ringMesh=mesh(ring,'D_RING',new THREE.TorusGeometry(ringR,ringR*.19,7,20),m.metal);
      ringMesh.position.set(...center);ringMesh.rotation.y=bearing;
      const tangent=[Math.cos(bearing),0,-Math.sin(bearing)];
      const tabPoint=(u,v)=>{
        const width=ringR*1.65*(.77+.23*Math.sin(v*Math.PI));
        const q=offset(mix(-ringR*2.45,ringR*.97,v),ringR*(.25+.22*v));
        return q.map((n,k)=>n+(u-.5)*width*tangent[k]);
      };
      mesh(tab,'FOLDED_TAB',grid(4,5,tabPoint),m.trim);
      for(const edge of [.1,.9])path(tab,'TAB_STITCH',8,v=>tabPoint(edge,v),ringR*.042,m.thread,true);
      const stud=c.hardware(tab,'RIVET',ringR*.27,m.metal);stud.position.set(...offset(-ringR*1.68,ringR*.38));
      const tip=offset(ringR*2.27,ringR*.45);
      parts.get(tab).anchors={sewn:at,loop:center};
      parts.get(ring).anchors={center,attachment:tip};
      anchor(id+'_'+suffix,tip);
      return vec(tip);
    });
    const [a,b]=ends,span=a.distanceTo(b),axis=b.clone().sub(a).normalize();
    const rise=pack?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    rise.addScaledVector(axis,-rise.dot(axis)).normalize();
    const curveAt=drop=>{
      const mid=a.clone().lerp(b,.5);
      const point=(f,r)=>a.clone().lerp(b,f).addScaledVector(rise,r*drop);
      return new THREE.CatmullRomCurve3([a,point(.045,.56),point(.19,.90),
        mid.addScaledVector(rise,drop),point(.81,.90),point(.955,.56),b]);
    };
    let drop=s.handleDropCm/100*(e.lengthScale||1);
    const requested=s.strapLengthCm/100*(e.lengthScale||1);
    if(!handle){
      let lo=0,hi=Math.max(span,requested);
      for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(curveAt(mid).getLength()<requested)lo=mid;else hi=mid;}
      drop=Math.max(span*.05,(lo+hi)/2);
    }
    const curve=curveAt(drop),w=Math.min((handle?Math.min(p.w*.065,.019):s.strapWidthCm/100)*(e.widthScale||1),span*.27);
    const piv=groups.get(id);piv.name=(handle?'HANDLE_ANCHOR_':'STRAP_ANCHOR_')+(index+1);
    piv.position.copy(a);
    const local=new THREE.CatmullRomCurve3(curve.points.map(pt=>pt.clone().sub(a)));
    mesh(id,'FOLDED_LEATHER',ribbon(local,w,Math.min(w*.25,p.thickness*1.8),detail*3),m.trim);
    const centerLine=u=>local.getPointAt(u);
    // Bound edges follow the transported ribbon columns exactly.
    const belt=groups.get(id).children[0].geometry.attributes.position,steps=detail*3;
    for(const row of [0,1]){
      const points=sampled(steps,t=>{
        const i=row*(steps+1)+Math.round(t*steps);return [belt.getX(i),belt.getY(i),belt.getZ(i)];
      });
      mesh(id,'ROLLED_EDGE_'+row,cord(points,p.thickness*.32),m.edge);
    }
    const carry=(id2,f)=>{const g=groups.get(id2);piv.add(g);g.position.copy(centerLine(f));return g;};
    if(!handle&&s.adjustable){
      const g=carry(id+'_buckle',.19);
      const diameter=w*.61;
      const ring=mesh(id+'_buckle','ADJUSTMENT_FRAME',new THREE.TorusGeometry(diameter,w*.073,6,20),m.metal);
      ring.scale.y=1.35;g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),local.getTangentAt(.19));
    }
    if(!handle&&s.detachable){
      const g=groups.get(id+'_clips');piv.add(g);
      for(const f of [.012,.988]){
        const hook=mesh(id+'_clips','SWIVEL_CLIP',new THREE.TorusGeometry(ringR*.69,ringR*.18,6,16),m.metal);
        hook.position.copy(centerLine(f));hook.scale.y=1.6;
      }
    }
    part.anchors={a:a.toArray(),b:b.toArray(),carry:curve.getPointAt(.5).toArray()};
    part.connections=[id+'_ring_a',id+'_ring_b'];
    part.geometryConstraints={requestedLengthM:handle?null:requested,actualCenterlineM:curve.getLength(),minimumSpanM:span,widthM:w,handleDropM:drop};
    part.range={unit:'degrees',min:-32*c.limit(id),max:32*c.limit(id),axis:axis.toArray()};
    anchor(id+'_carry',part.anchors.carry,piv,a);
    motions.swing.push(amount=>piv.quaternion.setFromAxisAngle(axis,amount*part.range.max*Math.PI/180));
  }
}
export function buildClosure(c){
  const {p,s,m,parts,groups,mesh,sheet,path,detail,motions,edits}=c;
  if(s.closure==='open')return;
  const part=parts.get('closure'), group=groups.get('closure');
  const factor=c.limit('closure'),size=Math.min(p.w*.045,p.h*.071,p.d*.16);
  if(['flap','clasp','buckle'].includes(s.closure)){
    const hinge=p.lip(0,true);group.position.set(...hinge);group.name='CLOSURE_HINGE';
    const local=a=>a.map((n,k)=>n-hinge[k]);
    const length=s.flapLength/100*(edits.closure?.lengthScale||1);
    const flap=(u,v)=>{
      const q=(u*2-1)*.78, edge=Math.abs(2*u-1);
      const back=p.lip(q,true),front=p.lip(q,false);
      if(v<=.47){
        const f=v/.47,point=blend(back,front,f);
        point[1]+=p.thickness*(1.5+Math.sin(f*Math.PI)*1.65);return local(point);
      }
      const f=(v-.47)/.53;
      const shape=s.style==='clutch'?.95:s.style==='saddle'?.74:.24;
      const t=1-f*length*(1-shape*edge**2);
      const point=p.lip(q*(1-.075*f**3),false,t,-p.thickness*1.15);
      point[1]+=p.thickness*1.5*(1-f);return local(point);
    };
    mesh('closure','FLAP_OUTER',grid(detail*2,18,flap),m.skin);
    const under=(u,v)=>{const q=flap(u,v);q[1]-=p.thickness*.65;q[2]-=p.thickness*.45;return q;};
    mesh('closure','FLAP_LINER',grid(detail,12,under,true),m.trim);
    for(const [name,fn] of [['TIP',u=>flap(u,1)],['L',u=>flap(0,u)],['R',u=>flap(1,u)]]){
      path('closure','FLAP_WELT_'+name,detail*2,fn,p.thickness*.56,m.edge);
    }
    path('closure','SADDLE_STITCH',detail*4,u=>{const pt=flap(.018+.964*u,.97);pt[2]+=p.thickness*.32;return pt;},p.thickness*.18,m.thread,true);
    const lock=c.hardware('closure','TURN_LOCK',size,m.metal);lock.scale.set(1,.73,.36);
    lock.position.set(...flap(.5,.91));lock.position.z+=p.thickness*.68;
    const tongue=c.hardware('closure','LOCK_BAR',size*.57,m.metal);
    tongue.position.copy(lock.position);tongue.position.z+=size*.30;tongue.scale.set(.97,.31,.31);
    part.anchors={hinge,axisEnd:[hinge[0]+p.w*.25,hinge[1],hinge[2]]};
    part.range={unit:'degrees',min:0,max:112*factor,axis:[-1,0,0]};
    motions.open.push(n=>group.rotation.x=-n*part.range.max*Math.PI/180);
  }else if(s.closure==='zipper'){
    const point=(u,v,back,open)=>{
      const q=(u*2-1)*.995,a=p.lip(q,back),b=p.lip(q,!back);
      const gap=.065+.75*clamp((open-u)*9,0,1);
      const pt=blend(a,b,v*(1-gap)/2);
      pt[1]+=p.thickness*(.6+1.4*v);return pt;
    };
    const tracks=[];
    for(const back of [false,true]){
      for(const [name,lo,hi,mat] of [['ZIP_TAPE',0,.90,m.trim],['ZIP_CHAIN',.90,1,m.zip]]){
        const fn=(u,v,n)=>point(u,mix(lo,hi,v),back,n);
        const g=grid(detail*3,2,(u,v)=>fn(u,v,0),!back);
        mesh('closure',name,g,mat);tracks.push([g,fn]);
      }
    }
    const center=u=>blend(point(u,1,false,u),point(u,1,true,u),.5);
    const pull=c.hardware('closure','ZIPPER_SLIDER',size*.73,m.metal);pull.scale.set(1.3,.48,1.1);
    const tab=mesh('closure','ZIP_PULL_TAB',new THREE.TorusGeometry(size*.54,size*.13,6,14),m.metal);
    const move=n=>{
      const pos=center(n);pull.position.set(...pos);tab.position.set(pos[0]-size*.65,pos[1]+size*.25,pos[2]);tab.rotation.x=Math.PI/2;
      for(const [g,fn] of tracks)updateGrid(g,detail*3,2,(u,v)=>fn(u,v,n));
    };
    part.anchors={start:center(0),end:center(1)};
    part.range={unit:'path-fraction',min:0,max:factor,points:sampled(20,center)};
    motions.open.push(n=>move(n*factor));
  }else if(s.closure==='drawstring'){
    const at=(u,o)=>p.surface(u*TAU,.925,-p.thickness*1.2,o);
    path('closure','DRAW_CORD',detail*4,at,p.thickness*.82,m.trim);
    for(const sign of [-1,1]){
      const end=(u,o)=>{
        const q=p.surface(sign*.12,.925,-p.thickness*1.1,o);
        q[0]+=sign*u*p.w*.075;q[1]-=u*p.h*(.29+(1-o)*.20);q[2]+=p.d*.11*Math.sin(Math.PI*u)+p.thickness*2;return q;
      };
      path('closure','CORD_END',12,end,p.thickness*.83,m.trim);
      const tip=c.hardware('closure','AGLET',size*.31,m.metal);
      motions.open.push(n=>tip.position.set(...end(1,n*factor)));
    }
    part.anchors={mouth:p.surface(0,.925)};
    part.range={unit:'opening-fraction',min:0,max:factor};
  }else{
    // Snap/button lips meet at the central short bridge and separate on release.
    const fixed=p.lip(0,true,1),loose=p.lip(0,false,1);
    const fn=(u,v,n)=>{
      const q=blend(fixed,blend(loose,fixed,n*.78),v);q[0]+=(u-.5)*size*1.8;
      q[1]+=p.thickness+Math.sin(Math.PI*v)*n*p.h*.11;return q;
    };
    const g=grid(4,14,(u,v)=>fn(u,v,0));mesh('closure','SNAP_TAB',g,m.trim);
    const stud=c.hardware('closure','PRESS_STUD',size*.53,s.closure==='button'?m.plastic:m.metal);
    stud.scale.set(1,.26,1);
    motions.open.push(n=>{updateGrid(g,4,14,(u,v)=>fn(u,v,n*factor));stud.position.set(...fn(.5,.96,n*factor));});
    part.anchors={sewn:fixed,socket:loose};part.range={unit:'release-fraction',min:0,max:factor};
  }
}
