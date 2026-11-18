// Pattern space: metres, Y up, +Z front. The four exterior pieces share exact
// seam curves. The liner, floor and pockets sample the same interior volume.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const blend = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
export const TAU = Math.PI * 2;
const smooth = t => t * t * (3 - 2 * t);
const profile = (width, depth, exponent, rise, dip, extras = {}) =>
  ({width, depth, exponent, rise, dip, ...extras});

export const PATTERNS = {
  structured: profile([.90,1,.99,.94,.84], [.87,1,.97,.83,.65], 4.8,.045,.008),
  tote:       profile([.69,.78,.88,.96,1], [.71,.83,.92,1,.94], 4.0,.035,.075),
  baguette:   profile([.81,.99,1,.96,.82], [.73,.97,1,.88,.58], 3.5,.14,.095),
  hobo:       profile([.56,.93,1,.96,.86], [.58,.91,1,.79,.46], 2.7,.30,.43),
  bucket:     profile([.80,.88,.97,1,.98], [.81,.90,.97,1,.99], 2.1,.024,.025,{pleats:10}),
  clutch:     profile([.91,.99,1,.99,.92], [.50,.90,1,.77,.36], 5.0,.078,.018),
  saddle:     profile([.46,.82,.97,1,.99], [.49,.83,.99,1,.76], 3.3,.32,.035,{asymmetry:.17}),
  backpack:   profile([.88,1,.99,.87,.57], [.81,1,.96,.82,.58], 3.7,.055,.02,{crown:.16})
};

export const FAMILY_PRESETS = {
  structured:{widthCm:28,heightCm:20,depthCm:11,closure:'flap',strapCount:0,handlesCount:1,strapType:'shoulder',bodyColor:'#844e38'},
  tote:{widthCm:37,heightCm:29,depthCm:15,closure:'open',strapCount:0,handlesCount:2,handleDropCm:21,bodyColor:'#aa7049'},
  baguette:{widthCm:30,heightCm:14,depthCm:7,closure:'zipper',strapCount:1,strapLengthCm:47,handlesCount:0,bodyColor:'#904653'},
  hobo:{widthCm:34,heightCm:25,depthCm:11,closure:'magnetic',strapCount:1,strapLengthCm:45,handlesCount:0,bodyColor:'#826746'},
  bucket:{widthCm:23,heightCm:26,depthCm:18,closure:'drawstring',strapCount:1,strapLengthCm:48,handlesCount:0,bodyColor:'#a66e4c'},
  clutch:{widthCm:26,heightCm:13,depthCm:5,closure:'flap',strapType:'none',strapCount:0,handlesCount:0,bodyColor:'#5c7464'},
  saddle:{widthCm:25,heightCm:20,depthCm:8,closure:'flap',strapType:'crossbody',strapCount:1,strapLengthCm:72,handlesCount:0,bodyColor:'#98522e'},
  backpack:{widthCm:25,heightCm:29,depthCm:13,closure:'zipper',strapType:'backpack',strapCount:2,strapLengthCm:56,handlesCount:1,handleDropCm:4,outerPockets:1,bodyColor:'#616c50'}
};

export function sampleProfile(values, t) {
  const at = clamp(t,0,1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(at));
  // Monotone cubic Hermite interpolation keeps rounded shoulders free of overshoot.
  const a=values[i], b=values[i+1], f=at-i, slope=b-a;
  const tangent=(previous,next) => previous*next>0 ? 2*previous*next/(previous+next) : 0;
  const m0=i ? tangent(a-values[i-1],slope) : slope;
  const m1=i+2<values.length ? tangent(slope,values[i+2]-b) : slope;
  return mix(a,b,smooth(f)) + f*(1-f)*((1-f)*m0-f*m1);
}

export function makePattern(spec, fittedWidths) {
  const family=PATTERNS[spec.style], w=spec.widthCm/100, h=spec.heightCm/100, d=spec.depthCm/100;
  const thickness=Math.min(spec.panelThicknessMm/1000, d*.065,h*.035,w*.025);
  const widths=family.width.map((value,i) => {
    const f=fittedWidths?.[i];
    const fitted=Number.isFinite(f) ? mix(value,clamp(f,.35,1),.55) : value;
    return fitted*(1+(spec.sideTaper/100)*(i/4-.5)*.62);
  });
  const max=Math.max(...widths);
  const width=widths.map(v=>v/max);
  const power=clamp(family.exponent+(50-spec.roundness)/32,2,7);
  const inset=t=> t===true ? thickness*1.25 : Number(t)||0;
  function surface(angle,t,offset=0,open=1) {
    const sn=Math.sin(angle), cs=Math.cos(angle);
    const polar=(Math.abs(sn)**power+Math.abs(cs)**power)**(-1/power);
    const nx=sn*polar, nz=cs*polar, edge=Math.abs(nx);
    const base=h*(family.rise*spec.baseCurve/50*edge**2.8+
      (family.asymmetry||0)*Math.max(0,-nx)**2);
    const crown=h*(1-family.dip*(1-edge**2)-(family.crown||0)*edge**2);
    const neck=smooth(clamp((t-.72)/.28,0,1));
    const pinch=spec.closure==='drawstring' ? (1-open)*neck : 0;
    const fluting=family.pleats ? 1-(.022+.075*pinch)*neck*(1-Math.cos(angle*family.pleats))/2 : 1;
    const opening=mix(1,spec.openingScale/100,neck);
    const gusset=1-(1-spec.gussetWidth/100)*Math.sin(Math.PI*t)*.55;
    const rx=w*.5*sampleProfile(width,t)*opening*fluting*(1-.27*pinch);
    const rz=d*.5*sampleProfile(family.depth,t)*opening*fluting*gusset*(1-.55*pinch);
    const off=inset(offset);
    return [nx*(rx-off),mix(base,crown,t)+off*(1-1.25*t),nz*(rz-off)];
  }
  function volume(x,z,t,offset=true,open=1) {
    const r=Math.max(Math.abs(x),Math.abs(z));
    const edge=surface(Math.atan2(x,z),t,offset,open);
    return [r*edge[0],mix(t*h+inset(offset)*(1-1.25*t),edge[1],r*r),r*edge[2]];
  }
  // A section cuts front and back at exactly the same x, including the side tips.
  const lip=(q,back,t=1,offset=0,open=1)=>
    surface(back?Math.PI-q*Math.PI/2:q*Math.PI/2,t,offset,open);
  return {w,h,d,thickness,width,surface,volume,lip,spec,family};
}
