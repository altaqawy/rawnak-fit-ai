/* RAWNAK FIT AI — Same-Type Garment Color Transfer (experimental).
 *
 * Uses the existing MediaPipe pose landmarks to constrain a browser-local
 * recolor to a conservative area of the worn upper garment in the SAME frame.
 * This is NOT semantic garment segmentation or a realistic clothing swap.
 * Users should wear a similarly shaped top for the best preview.
 * The implementation deliberately avoids modifying camera frames outside the
 * estimated central torso; sleeves, skin, fit and product prints are NOT recreated.
 */
(function(root) {
  'use strict';
  const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const visible = p => finite(p) &&
    (p.visibility == null || p.visibility >= .5) &&
    (p.presence == null || p.presence >= .4);
  const lerp = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));

  function getTorsoQuad(pose, {width,height,project}={}) {
    if (!Array.isArray(pose) || typeof project !== 'function' || !width || !height)
      return {ok:false,reason:'بيانات الجسم غير متاحة'};
    const ids=[11,12,23,24];
    if (!ids.every(i => visible(pose[i])))
      return {ok:false,reason:'اظهر الكتفين والخصر كاملين أمام الكاميرا'};
    const projected=ids.map(i => project(pose[i],width,height));
    if (!projected.every(finite))
      return {ok:false,reason:'تعذر تحديد موضع الجسم'};
    const [s1,s2,h1,h2]=projected;
    const shoulders=dist(s1,s2);
    const hips=dist(h1,h2);
    const shMid=lerp(s1,s2,.5),hipMid=lerp(h1,h2,.5);
    const torso=dist(shMid,hipMid);
    if (shoulders < 55 || hips < 28 || torso < shoulders*.6)
      return {ok:false,reason:'ابعد عن الكاميرا شوية علشان يظهر الجزء العلوي كامل'};
    if (Math.abs(s1.y-s2.y)>shoulders*.38 ||
        Math.abs(s1.x-s2.x)<shoulders*.75)
      return {ok:false,reason:'واجه الكاميرا بشكل مباشر لتجربة اللون'};
    // Stay in the fabric core: don't recolor the neck, skin or outstretched arms.
    const top1=lerp(s1,h1,.20),top2=lerp(s2,h2,.20);
    const bottom1=lerp(s1,h1,.93),bottom2=lerp(s2,h2,.93);
    const topMid=lerp(top1,top2,.5),bottomMid=lerp(bottom1,bottom2,.5);
    const points=[
      lerp(top1,topMid,.13),
      lerp(top2,topMid,.13),
      lerp(bottom2,bottomMid,.10),
      lerp(bottom1,bottomMid,.10)
    ];
    if (points.some(p => p.x < -width*.02 || p.x > width*1.02 ||
      p.y < -height*.02 || p.y > height*1.02))
      return {ok:false,reason:'وسّط جسمك بالكامل داخل إطار الكاميرا'};
    return {ok:true,points,shoulderWidth:shoulders,torsoHeight:torso};
  }

  function tintGarment(ctx, pose, {
    width,height,project,color='#c5ed99',strength=.90
  }={}) {
    if (!ctx || !ctx.canvas || !width || !height)
      return {ok:false,reason:'لوحة المعاينة غير متاحة'};
    const geometry=getTorsoQuad(pose,{width,height,project});
    if (!geometry.ok) return geometry;
    // Use only explicit project palette colors, not user-supplied CSS/URL strings.
    if (!/^#[0-9a-f]{6}$/i.test(color))
      return {ok:false,reason:'لون القطعة غير صالح'};
    const alpha=clamp(Number(strength)||.90,.15,1);
    ctx.save();
    try {
      ctx.beginPath();
      const [first,...rest]=geometry.points;
      ctx.moveTo(first.x,first.y);
      rest.forEach(p=>ctx.lineTo(p.x,p.y));
      ctx.closePath();
      // "color" retains much of the source garment luminance / shadow.
      // It does NOT recover fabric texture, shape, true fit, or hidden portions.
      ctx.globalCompositeOperation='color';
      ctx.globalAlpha=alpha;
      ctx.fillStyle=color;
      ctx.fill();
    } finally {
      ctx.restore();
    }
    return {ok:true,mode:'pose-guided-tint',approximate:true};
  }

  root.RawnakFitClothingSwap={getTorsoQuad,tintGarment};
})(typeof window!=='undefined'?window:globalThis);
