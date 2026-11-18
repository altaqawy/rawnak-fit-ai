/* RAWNAK FIT — body-relative AR placement helpers.
 * Lightweight geometry only; no identification, no inferred centimeters, no camera uploads.
 * Validity is intentionally conservative in the 2D photo proof-of-concept.
 */
(function(root) {
  'use strict';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const reject=(reason)=>({ok:false,reason});
  function readablePoint(raw, mapper, width, height, minVisibility=.55, margin=12) {
    if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y) ||
      raw.visibility != null && raw.visibility < minVisibility ||
      raw.presence != null && raw.presence < .35) return null;
    if(raw.x < -.01 || raw.x > 1.01 || raw.y < -.01 || raw.y > 1.01)return null;
    const point=mapper(raw,width,height);
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))return null;
    // Object-fit cover may crop a point even when MediaPipe detects it in camera space.
    if(point.x < margin || point.y < margin || point.x > width-margin || point.y > height-margin)return null;
    return point;
  }
  function alphaBounds(image) {
    const fallback={x:0,y:0,width:image.naturalWidth||image.width||1,height:image.naturalHeight||image.height||1};
    if(typeof document==='undefined')return fallback;
    try {
      const off=document.createElement('canvas');
      const size=256;
      const iw=fallback.width,ih=fallback.height,scale=Math.min(1,size/Math.max(iw,ih));
      off.width=Math.max(1,Math.round(iw*scale));
      off.height=Math.max(1,Math.round(ih*scale));
      const cx=off.getContext('2d',{willReadFrequently:true});
      cx.drawImage(image,0,0,off.width,off.height);
      const {data}=cx.getImageData(0,0,off.width,off.height);
      let minX=off.width,minY=off.height,maxX=-1,maxY=-1,opaque=0;
      for(let y=0;y<off.height;y++)for(let x=0;x<off.width;x++){
        if(data[(y*off.width+x)*4+3]<40)continue;
        minX=Math.min(minX,x);minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);opaque++;
      }
      if(opaque < 16)return fallback;
      const pad=3;
      const x=clamp(minX-pad,0,off.width-1),y=clamp(minY-pad,0,off.height-1);
      const right=clamp(maxX+pad,0,off.width-1),bottom=clamp(maxY+pad,0,off.height-1);
      return {
        x:x/off.width*iw,y:y/off.height*ih,
        width:Math.max(1,(right-x+1)/off.width*iw),
        height:Math.max(1,(bottom-y+1)/off.height*ih)
      };
    } catch {return fallback;}
  }
  function createPlacement(kind, landmarks, options) {
    const {width:w,height:h,project:mapper,crop,
      scale:scaleInput=1,worldLandmarks=null}=options||{};
    if(!landmarks || typeof mapper!=='function' || !w || !h || !crop)return reject('التتبع غير جاهز');
    const ratio=clamp(crop.width/Math.max(1,crop.height),.2,5);
    const scale=clamp(Number(scaleInput)||1,.7,1.3);
    const pt=(index,minVis=.55,margin=12)=>readablePoint(landmarks[index],mapper,w,h,minVis,margin);
    if(kind==='tee'||kind==='jacket'){
      const l=pt(11),r=pt(12),hl=pt(23),hr=pt(24);
      if(!l||!r||!hl||!hr)return reject('ارجع خطوة لورا واظهر كتفيك وخصرك بالكامل');
      const shoulders=dist(l,r),top=mid(l,r),bottom=mid(hl,hr);
      const torso=dist(top,bottom);
      if(shoulders<64 || torso<72 || torso<shoulders*.65)return reject('ابعد شوية عن الكاميرا علشان نشوف الجزء العلوي كامل');
      if(worldLandmarks?.[11] && worldLandmarks?.[12]){
        const a=worldLandmarks[11],b=worldLandmarks[12];
        const across=Math.hypot(a.x-b.x,a.y-b.y);
        const depth=Math.abs(a.z-b.z);
        if(across>0.001 && depth/across>0.9)return reject('القطعة الحالية أمامية 2D — واجه الكاميرا لحد ما يتجهز 3D');
      }
      let photoWidth=Math.min(shoulders*(kind==='jacket'?1.55:1.45)*scale,w*.92);
      let photoHeight=photoWidth/ratio;
      if(photoHeight>torso*1.35){photoHeight=torso*1.35;photoWidth=photoHeight*ratio;}
      // The top edge belongs at the shoulders: never anchor a shirt above the face.
      const center={x:top.x,y:top.y+photoHeight*.42};
      if(center.x-photoWidth*.5<-w*.03 || center.x+photoWidth*.5>w*1.03 ||
        center.y-photoHeight*.5<12 || center.y+photoHeight*.5>h-8)
        return reject('حرك الكاميرا لحد ما التيشيرت كله يدخل في الصورة');
      return {ok:true,x:center.x,y:center.y,width:photoWidth,height:photoHeight,
        angle:Math.atan2(r.y-l.y,r.x-l.x),metrics:{shouldersPx:Math.round(shoulders),torsoPx:Math.round(torso)}};
    }
    if(kind==='bag'){
      const sl=pt(11),sr=pt(12),hl=pt(23),hr=pt(24);
      if(!sl||!sr||!hl||!hr)return reject('اظهر الكتفين والخصر علشان نثبت الشنطة بجانب الجسم');
      const shoulders=dist(sl,sr),hip=dist(hl,hr);
      if(shoulders<66||hip<35)return reject('ابتعد عن الكاميرا علشان نشوف الجذع بشكل أوضح');
      const top=mid(sl,sr),bottom=mid(hl,hr);
      if(dist(top,bottom)<shoulders*.7)return reject('اظهر الجذع كامل علشان نحدد مكان الشنطة');
      const rightmost=sr.x>=sl.x?{shoulder:sr,hip:hr,other:hl}:{shoulder:sl,hip:hl,other:hr};
      const outward=Math.sign(rightmost.hip.x-rightmost.other.x)||1;
      let photoWidth=shoulders*.67*scale,photoHeight=photoWidth/ratio;
      const center={x:rightmost.hip.x+outward*shoulders*.18,y:rightmost.hip.y-photoHeight*.22};
      if(center.x-photoWidth*.5<12||center.x+photoWidth*.5>w-12 ||
         center.y-photoHeight*.5<12||center.y+photoHeight*.5>h-12)
        return reject('الشنطة خارج الإطار — ابعد عن الكاميرا أو اتحرك للوسط');
      return {ok:true,x:center.x,y:center.y,width:photoWidth,height:photoHeight,angle:0,
        metrics:{shouldersPx:Math.round(shoulders),hipPx:Math.round(hip)}};
    }
    if(kind==='watch'||kind==='bracelet'){
      const wrist=pt(0,.1),pinky=pt(17,.1),index=pt(5,.1),middle=pt(9,.1);
      if(!wrist||!pinky||!index||!middle)return reject('اظهر المعصم وكف إيدك بالكامل');
      const palmWidth=dist(index,pinky),palmLength=dist(wrist,middle);
      if(palmWidth<26||palmLength<28)return reject('قرب إيدك شوية للكاميرا وافرد الكف');
      let photoWidth=clamp(palmWidth*(kind==='watch'?1.02:1.12)*scale,25,125);
      let photoHeight=photoWidth/ratio;
      const dx=middle.x-wrist.x,dy=middle.y-wrist.y;
      const center={x:wrist.x-dx*.26,y:wrist.y-dy*.26};
      const angle=Math.atan2(dy,dx)-Math.PI/2;
      // Bounds checked with a rotated rectangle, not axis-aligned placeholder size.
      const halfWidth=(Math.abs(Math.cos(angle))*photoWidth+Math.abs(Math.sin(angle))*photoHeight)/2;
      const halfHeight=(Math.abs(Math.sin(angle))*photoWidth+Math.abs(Math.cos(angle))*photoHeight)/2;
      if(center.x-halfWidth<8||center.x+halfWidth>w-8||center.y-halfHeight<8||center.y+halfHeight>h-8)
        return reject('اظهر المعصم والساعد في منتصف الكادر');
      return {ok:true,x:center.x,y:center.y,width:photoWidth,height:photoHeight,angle,
        metrics:{palmWidthPx:Math.round(palmWidth),palmLengthPx:Math.round(palmLength)}};
    }
    if(kind==='glasses'){
      const left=pt(33,.1),right=pt(263,.1),nose=pt(1,.1);
      if(!left||!right||!nose)return reject('اظهر وجهك بالكامل في منتصف الكاميرا');
      const eyeSpan=dist(left,right);
      if(eyeSpan<35)return reject('قرّب وجهك شوية لحد ما النظارة تبان');
      const c=mid(left,right);
      const yawRatio=Math.abs(nose.x-c.x)/eyeSpan;
      if(yawRatio>.19)return reject('للتجربة الجانبية نحتاج نظارة 3D — واجه الكاميرا حاليًا');
      const width=eyeSpan*2.15*scale,height=width/ratio;
      if(c.x-width/2<10||c.x+width/2>w-10)return reject('وسّط وجهك في الكادر');
      return {ok:true,x:c.x,y:c.y,width,height,
        angle:Math.atan2(right.y-left.y,right.x-left.x),
        metrics:{eyeSpanPx:Math.round(eyeSpan),yawProxy:yawRatio}};
    }
    return reject('نوع المنتج غير مدعوم في تركيب Photo AR');
  }
  root.RawnakFitCalibration={createPlacement,alphaBounds,readablePoint};
})(typeof window!=='undefined'?window:globalThis);
