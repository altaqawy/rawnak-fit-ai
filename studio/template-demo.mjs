// A small original technical fixture for checking the part editor.
 // Not an imported BlenderKit asset or a commercial bag reconstruction.
export async function makeDemoBag(){
 const T=await import('three'),{GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
 const model=new T.Group();model.name='RAWNAK_TEMPLATE_TEST_BAG';
 const leather=new T.MeshStandardMaterial({color:0x876040,roughness:.82});
 const lining=new T.MeshStandardMaterial({color:0x41352c,roughness:1});
 const metal=new T.MeshStandardMaterial({color:0xc5a05b,metalness:.75,roughness:.34});
 const add=(name,geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);model.add(m);return m;};
 const box=(name,w,h,d,mat,x,y,z)=>add(name,new T.BoxGeometry(w,h,d),mat,x,y,z);
 box('front_panel',.30,.21,.008,leather,0,.105,.06);
 box('back_panel',.30,.21,.008,leather,0,.105,-.06);
 box('left_gusset',.008,.21,.112,leather,-.146,.105,0);
 box('right_gusset',.008,.21,.112,leather,.146,.105,0);
 box('bottom_base',.30,.009,.128,leather,0,.004,0);
 box('lining_divider',.282,.17,.004,lining,0,.09,0);
 box('front_pocket',.135,.09,.007,leather,0,.075,.067);
 box('metal_clasp',.038,.023,.014,metal,0,.18,.068);
 const points=[new T.Vector3(-.12,.21,0),new T.Vector3(-.095,.32,0),new T.Vector3(0,.355,0),new T.Vector3(.095,.32,0),new T.Vector3(.12,.21,0)];
 add('handle',new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.009,8,false),leather,0,0,0);
 try{
  const result=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:false});
  if(!(result instanceof ArrayBuffer))throw Error('GLB export failed');
  return new File([result],'rawnak-demo-bag.glb',{type:'model/gltf-binary'});
 }finally{model.traverse(o=>o.geometry?.dispose());leather.dispose();lining.dispose();metal.dispose();}
}
