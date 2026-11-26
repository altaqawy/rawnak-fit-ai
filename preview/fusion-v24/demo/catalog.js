// RAWNAK FIT demo catalog: synthetic images, demonstration metadata only.
// Do not treat these invented items as real merchant stock or certified product twins.
export const DEMO_PRODUCTS = Object.freeze({
  "WATCH-DEMO-01": {
    sku:"WATCH-DEMO-01",name:"ساعة Classic White",category:"watch",engine:"parametric-watch",
    tracking:"hand",color:"#f3f1eb",variant:"white-silver-demo",
    photos:[{src:"./assets/watch-front.webp",view:"أمامي",angle:"front"},
            {src:"./assets/watch-angle.webp",view:"مائل 45°",angle:"three-quarter"}],
    materialParts:[{name:"الهيكل والمينا",motion:"rigid",material:"silver metal / glass"},
                   {name:"السوار",motion:"deformable",material:"white leather"},
                   {name:"المشبك",motion:"hinged",material:"steel"}],
    measurements:{label:"قطر الساعة",value:"غير متاح — يحتاج قياس المورد"},
    photoQA:"صورتان مولدتان، لا تكفيان لمجسم معتمد 360°",
    hasAccurate3D:false,hasActualProductOverlay:false,hasPhotoAR2D:true,cutoutSrc:"./assets/watch-cutout.webp"
  },
  "TEE-DEMO-02": {
    sku:"TEE-DEMO-02",name:"Everyday Sage T-shirt",category:"tshirt",engine:"garment-pattern",
    tracking:"pose",color:"#8ba58b",variant:"sage-demo",
    photos:[{src:"./assets/tshirt-front.webp",view:"أمامي",angle:"front"},
            {src:"./assets/tshirt-back.webp",view:"خلفي",angle:"back"}],
    materialParts:[{name:"الجسم والأكمام",motion:"cloth",material:"cotton-like fabric"},
                   {name:"الحواف والياقة",motion:"deformable",material:"rib knit"}],
    measurements:{label:"قياسات القصّة",value:"غير متاحة — يحتاج جدول مقاسات وخامة"},
    photoQA:"أمام وخلف فقط، ولا توجد قياسات GSM أو استرتش",
    hasAccurate3D:false,hasActualProductOverlay:false,hasPhotoAR2D:true,cutoutSrc:"./assets/tshirt-cutout.webp"
  },
  "GLASSES-DEMO-03": {
    sku:"GLASSES-DEMO-03",name:"Metro Black Gold",category:"glasses",engine:"parametric-glasses",
    tracking:"face",color:"#111416",variant:"black-gold-demo",
    photos:[{src:"./assets/glasses-front.webp",view:"أمامي",angle:"front"},
            {src:"./assets/glasses-angle.webp",view:"مائل 45°",angle:"three-quarter"}],
    materialParts:[{name:"الإطار والعدسات",motion:"rigid",material:"black acetate / clear lens"},
                   {name:"الأذرع",motion:"hinged",material:"gold metal"}],
    measurements:{label:"عرض الإطار والجسر",value:"غير متاح — يحتاج قياسات المورد"},
    photoQA:"صورتان، تفاصيل المفصل والذراع الخلفي تحتاج مراجع إضافية",
    hasAccurate3D:false,hasActualProductOverlay:false,hasPhotoAR2D:true,cutoutSrc:"./assets/glasses-cutout.webp"
  },
  "BAG-DEMO-04": {
    sku:"BAG-DEMO-04",name:"Loop Brown Leather",category:"bag",engine:"bag-image-to-3d",
    tracking:"pose",color:"#995c39",variant:"cognac-demo",
    photos:[{src:"./assets/bag-front.webp",view:"أمامي",angle:"front"},
            {src:"./assets/bag-angle.webp",view:"مائل 45°",angle:"three-quarter"}],
    materialParts:[{name:"جسم الشنطة",motion:"deformable",material:"brown leather"},
                   {name:"الحزام",motion:"deformable",material:"leather"},
                   {name:"حلقات الحزام والقفل",motion:"rigid",material:"gold metal"}],
    measurements:{label:"الطول والعرض والعمق",value:"غير متاحة — يحتاج قياس المورد"},
    photoQA:"صورتان، تفاصيل الظهر والقاع والداخل غير مثبتة",
    hasAccurate3D:false,hasActualProductOverlay:false,hasPhotoAR2D:true,cutoutSrc:"./assets/bag-cutout.webp"
  }
});
export function getDemoProduct(sku) {
  return Object.hasOwn(DEMO_PRODUCTS,sku)?DEMO_PRODUCTS[sku]:null;
}
