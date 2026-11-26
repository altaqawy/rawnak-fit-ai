// The production Bag Atelier can run without any cross-origin script requests.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=new URL('../node_modules/three/',import.meta.url),out=new URL('../vendor/three/',import.meta.url);
const files=['LICENSE','build/three.module.min.js','build/three.core.min.js','examples/jsm/controls/OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js','examples/jsm/exporters/GLTFExporter.js'];
for(const file of files){
  const from=await readFile(new URL(file,base)),to=new URL(file,out);
  if(process.argv.includes('--check')){
    if(!from.equals(await readFile(to)))throw Error('Vendored Three.js differs: '+file);
  }else{
    await mkdir(dirname(fileURLToPath(to)),{recursive:true});await writeFile(to,from);
  }
}
