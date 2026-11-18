/* RAWNAK FIT — geometry-only wearable anchoring for the 3D renderer.
 * Normalized MediaPipe coordinates are projected with the SAME object-fit-cover mapping
 * used to display the captured frame. No real-world sizing claims.
 */
(function (root) {
  'use strict';
  const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const invalid=reason=>({ok:false,reason});
  const allowed=new Set(['watch','bracelet','glasses','tee','jacket','bag','shoes']);
  function compute(category,landmarks,{width,height,project,worldLandmarks,scale=1}={}) {
    if(!allowed.has(category))return invalid('مفيش مجسم 3D جاهز للفئة دي');
    if(!landmarks || !width || !height || typeof project !== 'function')return invalid('اظهر الجزء المطلوب من جسمك');
    const p=(i,visibility=.34)=>{
      const v=landmarks[i];
      if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<-.02||v.x>1.02||v.y<-.02||v.y>1.02 ||
        (v.visibility!=null && v.visibility<visibility) ||
        (v.presence!=null && v.presence<.28))return null;
      const pt=project(v,width,height);
      if(!pt||!Number.isFinite(pt.x)||!Number.isFinite(pt.y)||
        pt.x<-12||pt.y<-12||pt.x>width+12||pt.y>height+12)return null;
      return pt;
    };
    const adjust=clamp(Number(scale)||1,.7,1.3);
    const within=(x,y,r=25)=>x>=-r&&x<=width+r&&y>=-r&&y<=height+r;
    if(category==='watch'||category==='bracelet'){
      const wrist=p(0,.12),index=p(5,.12),pinky=p(17,.12),middle=p(9,.12);
      if(!wrist||!middle||!index||!pinky)return invalid('اظهر الكف والمعصم مع بعض علشان الساعة تظهر');
      const palmWidth=distance(index,pinky),palmLength=distance(wrist,middle);
      if(palmWidth<18||palmLength<20)return invalid('قرب إيدك للكاميرا شوية');
      const dir={x:(middle.x-wrist.x)/palmLength,y:(middle.y-wrist.y)/palmLength};
      const x=wrist.x-dir.x*palmLength*.22,y=wrist.y-dir.y*palmLength*.22;
      if(!within(x,y,15))return invalid('خلّي المعصم في منتصف الكادر');
      const widthPx=clamp(palmWidth*(category==='watch'?1.30:1.38)*adjust,25,Math.min(width*.40,150));
      return {ok:true,x,y,widthPx,heightPx:widthPx*2.7,
        // local watch model points up (negative screen y). Rotate it to wrist -> fingers
        angle:Math.atan2(dir.x,-dir.y), yaw:clamp(((landmarks[5]?.z||0)-(landmarks[17]?.z||0))*3,-.8,.8),
        pitch:0,metrics:{palmWidthPx:Math.round(palmWidth)}};
    }
    if(category==='glasses'){
      const left=p(33,.05),right=p(263,.05),nose=p(1,.05);
      if(!left||!right||!nose)return invalid('خلّي عينيك ووشك ظاهرين داخل الكادر');
      const widthEyes=distance(left,right);
      if(widthEyes<20)return invalid('قرّب وجهك شوية');
      const center=mid(left,right);
      const yawProxy=clamp((nose.x-center.x)/widthEyes*2.4,-1.05,1.05);
      const depthYaw=landmarks[33] && landmarks[263] ?
        clamp((landmarks[263].z-landmarks[33].z)*3,-1,1):0;
      return {ok:true,x:center.x,y:center.y+widthEyes*.06,
        widthPx:widthEyes*2.38*adjust,heightPx:widthEyes*.9*adjust,
        angle:Math.atan2(right.y-left.y,right.x-left.x),yaw:clamp(yawProxy+depthYaw*.55,-1.15,1.15),
        pitch:0,metrics:{eyeSpanPx:Math.round(widthEyes)}};
    }
    const left=p(11),right=p(12),hipL=p(23),hipR=p(24);
    if(category==='shoes'){
      const feet=[27,28].map((id,i)=>{
        const a=p(id,.25);if(!a)return null;
        const toe=p(i?32:31,.15);
        const leg=p(i?26:25,.2);
        return {x:a.x,y:a.y+(toe?distance(a,toe)*.22:6),
          widthPx:clamp((leg?distance(leg,a)*.36:width*.095)*adjust,26,width*.24),
          angle:toe?Math.atan2(toe.y-a.y,toe.x-a.x):0};
      }).filter(Boolean);
      if(!feet.length)return invalid('اظهر القدمين بالكامل علشان الأحذية تظهر');
      return {ok:true,feet,metrics:{visibleFeet:feet.length}};
    }
    if(!left||!right)return invalid('ارجع خطوة لورا لحد ما الكتفين يظهروا');
    const shoulders=distance(left,right);
    if(shoulders<40)return invalid('قرّب شوية علشان نحدد عرض الكتفين');
    const top=mid(left,right);
    const roll=Math.atan2(right.y-left.y,right.x-left.x);
    let yaw=0;
    if(worldLandmarks?.[11]&&worldLandmarks?.[12]){
      const a=worldLandmarks[11],b=worldLandmarks[12];
      const dx=Math.abs(b.x-a.x),dz=b.z-a.z;
      if(Number.isFinite(dx)&&Number.isFinite(dz))yaw=clamp(Math.atan2(dz,Math.max(dx,.02)),-1.25,1.25);
    }
    if(category==='tee'||category==='jacket'){
      if(!hipL||!hipR)return invalid('خلّي كتافك وخصرك ظاهرين علشان التيشيرت يتثبت تحت رقبتك');
      const centerHip=mid(hipL,hipR),torso=distance(top,centerHip);
      if(torso<48)return invalid('ابعد شوية عن الكاميرا علشان طول الجذع يبان');
      return {ok:true,x:top.x,y:top.y+shoulders*.04,
        widthPx:shoulders*(category==='jacket'?1.47:1.36)*adjust,
        heightPx:torso*1.19*adjust,angle:roll,yaw,pitch:0,
        metrics:{shouldersPx:Math.round(shoulders),torsoPx:Math.round(torso)}};
    }
    if(category==='bag'){
      if(!hipL||!hipR)return invalid('اظهر الكتفين والخصر علشان الشنطة تتثبت على الجسم');
      const centerHip=mid(hipL,hipR);
      const torso=distance(top,centerHip);
      if(torso<45)return invalid('ابعد عن الكاميرا علشان نقدر نحدد الكتف والخصر');
      // Choose the screen-right shoulder/hip for an illustrative shoulder bag.
      const side=left.x>right.x?{shoulder:left,hip:hipL,other:hipR}:{shoulder:right,hip:hipR,other:hipL};
      const sign=Math.sign(side.hip.x-side.other.x)||1;
      const bagW=shoulders*.66*adjust;
      const x=side.hip.x+sign*shoulders*.14;
      const y=side.hip.y-torso*.14;
      if(!within(x,y,bagW*.48))return invalid('حرّك الجسم للوسط علشان الشنطة تبان');
      return {ok:true,x,y,widthPx:bagW,heightPx:bagW*1.35,
        angle:roll*.25,yaw:clamp(yaw*.65,-.8,.8),pitch:0,
        metrics:{shouldersPx:Math.round(shoulders),torsoPx:Math.round(torso)}};
    }
    return invalid('مجسم غير معروف');
  }
  root.RawnakFit3DPose={compute};
})(typeof window!=='undefined'?window:globalThis);
