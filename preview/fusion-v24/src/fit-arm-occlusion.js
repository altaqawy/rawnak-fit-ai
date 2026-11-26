/* RAWNAK FIT — experimental arm-front compositing for synchronized frames.
 * Copies pixels from the SAME captured camera frame, inside a conservative
 * pose-driven forearm capsule where the arm crosses the shirt. Not semantic
 * segmentation: do not advertise this as perfect person/garment occlusion.
 */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
    (p.visibility==null||p.visibility>=.6)&&
    (p.presence==null||p.presence>=.4);
  const midpoint=(a,b)=>({x:(a.x+b.x)*.5,y:(a.y+b.y)*.5});
  function capsule(ctx,a,b,radius){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(len<3)return false;
    const normalX=-dy/len,normalY=dx/len;
    const direction=Math.atan2(dy,dx);
    ctx.beginPath();
    ctx.moveTo(a.x+normalX*radius,a.y+normalY*radius);
    ctx.lineTo(b.x+normalX*radius,b.y+normalY*radius);
    ctx.arc(b.x,b.y,radius,direction+Math.PI/2,direction-Math.PI/2,true);
    ctx.lineTo(a.x-normalX*radius,a.y-normalY*radius);
    ctx.arc(a.x,a.y,radius,direction-Math.PI/2,direction+Math.PI/2,true);
    ctx.closePath();
    return true;
  }
  function restoreArms(ctx,source,landmarks,{
    width,height,project,worldLandmarks,
    sourceWidth=source?.width,sourceHeight=source?.height,
    enabled=true
  }={}){
    if(!enabled||!ctx||!source||!Array.isArray(landmarks)||!width||!height||
      !sourceWidth||!sourceHeight||typeof project!=='function')return 0;
    const shoulders=[landmarks[11],landmarks[12]];
    const hips=[landmarks[23],landmarks[24]];
    if(!shoulders.every(visible)||!hips.every(visible))return 0;
    const mapped=[...shoulders,...hips].map(p=>project(p,width,height));
    if(mapped.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 0;
    const shoulderWidth=Math.hypot(mapped[0].x-mapped[1].x,mapped[0].y-mapped[1].y);
    if(shoulderWidth<48)return 0;
    const shMid=midpoint(mapped[0],mapped[1]),hipMid=midpoint(mapped[2],mapped[3]);
    const torsoHeight=Math.hypot(hipMid.x-shMid.x,hipMid.y-shMid.y);
    if(torsoHeight<52)return 0;
    // Never blindly copy background around outstretched arms: clip to central torso.
    const xMin=Math.max(0,Math.min(mapped[0].x,mapped[1].x)-shoulderWidth*.10);
    const xMax=Math.min(width,Math.max(mapped[0].x,mapped[1].x)+shoulderWidth*.10);
    const yMin=Math.max(0,shMid.y-shoulderWidth*.22);
    const yMax=Math.min(height,hipMid.y+shoulderWidth*.12);
    if(xMax<=xMin||yMax<=yMin)return 0;
    const scale=Math.max(width/sourceWidth,height/sourceHeight);
    const drawW=sourceWidth*scale,drawH=sourceHeight*scale;
    const offsetX=(width-drawW)/2,offsetY=(height-drawH)/2;
    let copied=0;
    for(const [shoulderId,elbowId,wristId] of [[11,13,15],[12,14,16]]){
      const shoulder=landmarks[shoulderId],elbow=landmarks[elbowId],wrist=landmarks[wristId];
      if(!visible(shoulder)||!visible(elbow)||!visible(wrist))continue;
      // World z: lower value is closer to the camera. With reliable world
      // landmark depth, skip arms that are clearly behind the torso.
      const wz=worldLandmarks;
      if(wz?.[shoulderId]&&wz?.[elbowId]&&wz?.[wristId]){
        const zTorso=(wz[11]?.z+wz[12]?.z+wz[23]?.z+wz[24]?.z)/4;
        const zArm=(wz[elbowId].z+wz[wristId].z)*.5;
        if(Number.isFinite(zTorso)&&Number.isFinite(zArm)&&zArm>zTorso+.035)continue;
      }
      const a=project(elbow,width,height),b=project(wrist,width,height);
      if(!a||!b||!Number.isFinite(a.x)||!Number.isFinite(b.x))continue;
      const intersects=Math.max(Math.min(a.x,b.x),xMin)<=Math.min(Math.max(a.x,b.x),xMax)&&
        Math.max(Math.min(a.y,b.y),yMin)<=Math.min(Math.max(a.y,b.y),yMax);
      if(!intersects)continue;
      const radius=clamp(shoulderWidth*.095,7,24);
      ctx.save();
      try{
        ctx.beginPath();ctx.rect(xMin,yMin,xMax-xMin,yMax-yMin);ctx.clip();
        if(!capsule(ctx,a,b,radius))continue;
        ctx.clip();
        ctx.drawImage(source,offsetX,offsetY,drawW,drawH);
        copied++;
      }finally{ctx.restore();}
    }
    return copied;
  }
  root.RawnakFitArmOcclusion={restoreArms};
})(typeof window!=='undefined'?window:globalThis);
