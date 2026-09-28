import {readFile,stat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function modulesIn(dir){const entries=await readdir(root+dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?modulesIn(dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]))).flat();}
const modules=(await modulesIn('dist/src')).map(p=>p.slice(5));
for(const file of [...modules,'public/vendor/vision_bundle.mjs','public/vendor/vision_wasm_internal.js']){
 execFileSync(process.execPath,['--check',root+'dist/'+file]);
 if(file.startsWith('public/vendor/'))continue;
 const source=await readFile(root+'dist/'+file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\()\s*['"](\.[^'"]+)['"]/g))await stat(new URL(match[1].split('?')[0],new URL('dist/'+file,new URL('../',import.meta.url))));
}
const html=await readFile(root+'dist/index.html','utf8');
const app=await readFile(root+'dist/src/main.js','utf8');
const htmlIDs=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
if(htmlIDs.length!==new Set(htmlIDs).size)throw new Error('Duplicate HTML IDs');
const appIDs=[...app.matchAll(/\$\('([\w-]+)'\)/g)].map(x=>x[1]);
for(const id of new Set(appIDs)){if(!htmlIDs.includes(id)&&!['restart-button','stop-button'].includes(id))throw new Error('Missing element: '+id);}
for(const f of ['index.html','styles.css','src/main.js','src/lesson/course.js','src/ui/diagrams.js','src/gestures/recognizer.js','public/vendor/vision_bundle.mjs','public/vendor/vision_wasm_internal.js','public/vendor/vision_wasm_internal.wasm','public/models/hand_landmarker.task','public/vendor/LICENSE-mediapipe.txt']){const size=(await stat(root+'dist/'+f)).size;if(!size)throw new Error('Empty asset: '+f);if(f.endsWith('.wasm')){const bytes=await readFile(root+'dist/'+f);if(bytes.subarray(0,4).toString('hex')!=='0061736d')throw new Error('Invalid wasm: '+f);}}
const model=await readFile(root+'dist/public/models/hand_landmarker.task');if(!model.includes(Buffer.from('TFL3')))throw new Error('Invalid MediaPipe task model');
for(const m of html.matchAll(/(?:href|src)="\.\/([^"#]+)"/g))await stat(root+'dist/'+m[1].split('?')[0]);
console.log('All local assets, WASM signatures, model, DOM references and JS syntax verified.');
