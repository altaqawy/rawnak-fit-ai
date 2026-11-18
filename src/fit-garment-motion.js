/* Lightweight arm-driven shirt motion.
 * CPU-side shape deformation of a small demo mesh, not full cloth simulation.
 * Uses MediaPipe shoulder (11/12) and elbow (13/14) landmarks.
 * No identity data, no physical size inference, no model inference per frame.
 */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const normalAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const valid=(p,t=.32)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=-.01&&p.x<=1.01&&p.y>=-.01&&p.y<=1.01 &&
    (p.visibility==null||p.visibility>=t)&&(p.presence==null||p.presence>=.25);
  function targetSleeves(pose,placement,project,width,height){
    if(!pose||!placement?.ok||!project||!width||!height)return {left:0,right:0,reliable:false};
    const a=pose[11],b=pose[12];
    if(!valid(a)||!valid(b))return {left:0,right:0,reliable:false};
    const shoulders=[{point:a,elbow:pose[13]},{point:b,elbow:pose[14]}]
      .map(x=>({...x,screen:project(x.point,width,height)}))
      .sort((x,y)=>x.screen.x-y.screen.x);
    const wScale=Math.max(1,placement.widthPx/1.8);
    const hScale=Math.max(1,placement.heightPx/1.55);
    const roll=Number.isFinite(placement.angle)?placement.angle:0;
    const values=[];
    for(let side=0;side<2;side++){
      const {screen,elbow}=shoulders[side];
      if(!valid(elbow,.37)){values.push({target:0,reliable:false});continue;}
      const other=project(elbow,width,height);
      if(!other||!Number.isFinite(other.x)||!Number.isFinite(other.y)){
        values.push({target:0,reliable:false});continue;
      }
      const dx=other.x-screen.x,dy=other.y-screen.y;
      if(Math.hypot(dx,dy)<18){values.push({target:0,reliable:false});continue;}
      // Undo torso roll and nonuniform scale so sleeve angles are in LOCAL mesh space.
      const localX=(dx*Math.cos(roll)+dy*Math.sin(roll))/wScale;
      const localY=(-dx*Math.sin(roll)+dy*Math.cos(roll))/hScale;
      const observed=Math.atan2(localY,localX);
      const rest=Math.atan2(.44,side===0?-.36:.36);
      const delta=normalAngle(observed-rest);
      // Avoid flipping sleeves through the torso during fast/ambiguous arm motions.
      values.push({target:clamp(delta,-1.12,1.12),reliable:true});
    }
    return {left:values[0].target,right:values[1].target,
      reliable:values.some(x=>x.reliable)};
  }
  class SleeveSpring {
    constructor(){this.left=0;this.right=0;this.vLeft=0;this.vRight=0;this.lastTime=null;this.phase=0;}
    reset(){this.left=0;this.right=0;this.vLeft=0;this.vRight=0;this.lastTime=null;this.phase=0;}
    update(target,nowMs){
      const t=Number.isFinite(nowMs)?nowMs:0;
      if(this.lastTime==null){
        this.lastTime=t;
        this.left=target.left||0;this.right=target.right||0;
        return this.snapshot();
      }
      let dt=clamp((t-this.lastTime)/1000,0,.05);
      this.lastTime=t;
      // Critically damped-ish second-order motion with stable small time steps.
      // A strong impulse is prevented when camera frames are paused or switched.
      for(const [key,velKey] of [['left','vLeft'],['right','vRight']]){
        const goal=clamp(Number(target[key])||0,-1.12,1.12);
        this[velKey]+=((goal-this[key])*85-this[velKey]*19)*dt;
        this[key]=clamp(this[key]+this[velKey]*dt,-1.22,1.22);
        if(dt===0)this[velKey]*=.8;
      }
      this.phase+=dt*3.2;
      return this.snapshot();
    }
    snapshot(){
      return {left:this.left,right:this.right,phase:this.phase,
        energy:clamp((Math.abs(this.vLeft)+Math.abs(this.vRight))*.006,0,.10)};
    }
  }
  function deformGarment(positions,base,dynamics){
    // Three ExtrudeGeometry has a manageable number of verts; update at AI Hz,
    // not every RAF, to avoid mobile GPU/CPU load.
    if(!positions||!base||positions.length!==base.length)return false;
    const left=clamp(Number(dynamics?.left)||0,-1.22,1.22);
    const right=clamp(Number(dynamics?.right)||0,-1.22,1.22);
    const energy=clamp(Number(dynamics?.energy)||0,0,.10);
    const phase=Number(dynamics?.phase)||0;
    for(let i=0;i<base.length;i+=3){
      const x=base[i],y=base[i+1],z=base[i+2];
      const side=x<-.465?-1:x>.465?1:0;
      if(!side||y>.65||y<-.15){
        positions[i]=x;positions[i+1]=y;positions[i+2]=z;
        continue;
      }
      const outward=clamp((Math.abs(x)-.465)/.405,0,1);
      const nearSeam=clamp((.73-y)/.50,0,1);
      const weight=outward*outward*(.45+.55*nearSeam);
      const angle=(side<0?left:right)*weight;
      const cx=side*.49,cy=.16;
      const dx=x-cx,dy=y-cy;
      const co=Math.cos(angle),si=Math.sin(angle);
      positions[i]=cx+dx*co-dy*si;
      positions[i+1]=cy+dx*si+dy*co;
      // Restrained surface motion driven by movement energy, not random wind.
      positions[i+2]=z+Math.sin(y*9+phase+side)*energy*weight*.50;
    }
    return true;
  }
  root.RawnakFitGarmentMotion={targetSleeves,SleeveSpring,deformGarment};
})(typeof window!=='undefined'?window:globalThis);
