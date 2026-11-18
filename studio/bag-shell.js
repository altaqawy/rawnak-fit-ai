import {blend,clamp,mix,TAU} from './bag-patterns.js';
import {disk,grid,sampled,updateGrid} from './bag-surfaces.js';

const quarter=Math.PI/4;
export function buildShell(c){
  const {p,s,m,mesh,sheet,path,parts,detail}=c, {surface,volume,thickness}=p;
  const faces=['front_panel','right_gusset','back_panel','left_gusset'];
  for(const [i,id] of faces.entries()){
    const theta=u=>(i*2-1)*quarter+u*2*quarter;
    sheet(id,id.toUpperCase(),detail,9,(u,v,o)=>surface(theta(u),v,0,o),m.skin);
    // Cut edge and interior shell exist even with the lining removed.
    sheet(id,'FLESH_'+id,detail,9,(u,v,o)=>surface(theta(u),v,thickness,o),m.trim,true);
    sheet(id,'CUT_EDGE_'+id,detail,1,(u,v,o)=>surface(theta(u),1,thickness*v,o),m.edge);
    path('piping','SEAM_'+i,12,(t,o)=>surface(theta(0),t,-thickness*.17,o),thickness*.49,m.edge);
    path('piping','TOPSTITCH_'+i,36,(t,o)=>surface(theta(.014),t,-thickness*.22,o),thickness*.14,m.thread,true);
  }
  const floor=(id,name,offset,height,mat,down=false)=>{
    mesh(id,name,disk(detail*4,a=>surface(a,height,offset),volume(0,0,height,offset),down),mat);
  };
  floor('bottom_panel','BASE_OUTER',0,0,m.skin,true);
  floor('bottom_panel','BASE_INNER',thickness,0,m.trim);
  path('bottom_panel','BASE_WELT',detail*4,(t,o)=>surface(t*TAU,.012,-thickness*.18,o),thickness*.48,m.edge);
  if(s.reinforced)floor('base_insert','BASE_INSERT',thickness*1.1,.012,m.trim);
  if(s.lining!=='none'){
    sheet('lining','INNER_LINING',detail*4,10,(u,v,o)=>surface(TAU*u,mix(.021,.955,v),true,o),m.lining,true);
    floor('lining','LINED_FLOOR',true,.021,m.lining);
  }
  sheet('opening','TURNED_RIM',detail*4,3,(u,v,o)=>surface(u*TAU,mix(.948,1,v),-thickness*.30,o),m.trim);
  path('opening','RIM_BEAD',detail*4,(t,o)=>surface(t*TAU,1,thickness*.5,o),thickness*.56,m.edge);
  path('opening','RIM_STITCH',detail*8,(t,o)=>surface(t*TAU,.961,-thickness*.45,o),thickness*.14,m.thread,true);
  for(let i=1;i<=s.mainCompartments;i++){
    const lo=-1+2*(i-1)/s.mainCompartments,hi=-1+2*i/s.mainCompartments;
    const node=parts.get('compartment_'+i);
    node.position=volume(0,(lo+hi)/2,.40);
    node.geometryConstraints={kind:'empty-lined-volume',normalizedDepthInterval:[lo,hi]};
    node.dimensions={width:p.w*.85,height:p.h*.68,depth:p.d*(hi-lo)/2};
    if(i===s.mainCompartments)break;
    const id='divider_'+i;
    const divider=(u,v,o)=>{
      const x=u*2-1;
      const t=mix(.024,.735-.065*(1-x*x),v);
      return volume(x,hi,t,true,o);
    };
    sheet(id,'DIVIDER_'+i,detail*2,7,divider,m.lining);
    path(id,'BOUND_DIVIDER_'+i,detail*2,(u,o)=>divider(u,1,o),thickness*.59,m.trim);
  }
}

// A pouch is sewn to the support at the sides and bottom. The free lip
// stands away from the support so its contents can be inspected from above.
export function buildPockets(c){
  const {p,s,m,parts,edits,mesh,path,detail,motions}=c;
  const place=(ids,back,outside)=>{
    const cols=Math.min(ids.length,3), rows=Math.ceil(ids.length/cols);
    for(const [index,id] of ids.entries()){
      const part=parts.get(id),edit=edits[id]||{},row=Math.floor(index/cols);
      const column=index%cols,count=Math.min(cols,ids.length-cols*row);
      const cell=1.55/count;
      const center=-.775+cell*(column+.5)+clamp(edit.offsetX||0,-.24,.24)*cell*.30;
      const half=cell*.423*(edit.widthScale||1);
      const bottom=.14+row*.62/rows,top=bottom+.49/rows;
      const depthSign=(outside?1:-1)*(back?-1:1);
      const mouth=Math.min(p.d*.18/s.mainCompartments,p.h*.07/rows,p.w*cell*.10);
      const base=(u,v)=>{
        const a=center+(2*u-1)*half;
        return p.surface(back?Math.PI-a:a,mix(bottom,top,v),outside?-p.thickness*.40:p.thickness*1.42);
      };
      const face=(u,v)=>{
        const at=base(u,v);
        at[2]+=depthSign*mouth*Math.sin(Math.PI*u)*v**.85;
        at[1]-=p.h*.012*Math.sin(Math.PI*u)*v;
        return at;
      };
      const cloth=outside?m.skin:m.lining;
      mesh(id,'POUCH_'+id,grid(detail,6,face,back!==outside),cloth);
      // Interior pocket backing also keeps the mouth meaningful without a liner.
      mesh(id,'BACKING_'+id,grid(detail,4,base,back===outside),cloth);
      path(id,'POCKET_BINDING',detail,(u)=>face(u,1),p.thickness*.43,outside?m.trim:m.thread);
      for(const side of [0,1])path(id,'POCKET_SEAM_'+side,10,(v)=>face(side,v),p.thickness*.16,m.thread,true);
      if(part.role!=='zip_pocket')continue;
      const sliderId=id+'_slider';
      const track=(u,amount)=>{
        const lip=face(u,1),flat=base(u,1),gap=clamp((amount-u)*12,0,1);
        return blend(lip,flat,.48*(1-gap));
      };
      const tape=(u,v,n)=>blend(face(u,1),track(u,n),v);
      const tape2=(u,v,n)=>blend(base(u,1),blend(base(u,1),face(u,1),.52*(1-clamp((n-u)*12,0,1))),v);
      const a=mesh(id,'POCKET_ZIP_TAPE',grid(detail,1,(u,v)=>tape(u,v,0)),m.zip);
      const b=mesh(id,'POCKET_ZIP_TAPE_BACK',grid(detail,1,(u,v)=>tape2(u,v,0)),m.zip);
      const pull=c.hardware(sliderId,'POCKET_PULL',Math.min(p.w*.027,mouth*.75),m.metal);
      const move=amount=>{
        const n=amount*c.limit(sliderId);pull.position.set(...track(n,n));
        updateGrid(a.geometry,detail,1,(u,v)=>tape(u,v,n));
        updateGrid(b.geometry,detail,1,(u,v)=>tape2(u,v,n));
      };
      motions.pockets.push(move);move(0);
      parts.get(sliderId).anchors={start:track(0,0),end:track(1,1)};
    }
  };
  const ids=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+(i+1));
  place([...ids('inner_open_pocket_',s.innerOpenPockets),...ids('card_slot_',s.cardSlots),...ids('accessory_',s.accessoryPockets)],false,false);
  place(ids('inner_zip_pocket_',s.innerZippedPockets),true,false);
  place(ids('outer_pocket_',s.outerPockets),false,true);
}
