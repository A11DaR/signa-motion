import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['app.js','course.js','recognizer.js','diagrams.js','commands.js','vendor/vision_bundle.mjs','vendor/vision_wasm_internal.js'])execFileSync(process.execPath,['--check',root+'dist/'+file]);
const html=await readFile(root+'dist/index.html','utf8');
const app=await readFile(root+'dist/app.js','utf8');
const htmlIDs=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
if(htmlIDs.length!==new Set(htmlIDs).size)throw new Error('Duplicate HTML IDs');
const appIDs=[...app.matchAll(/\$\('([\w-]+)'\)/g)].map(x=>x[1]);
for(const id of new Set(appIDs)){if(!htmlIDs.includes(id)&&!['restart-button','stop-button'].includes(id))throw new Error('Missing element: '+id);}
for(const f of ['index.html','styles.css','app.js','course.js','diagrams.js','recognizer.js','vendor/vision_bundle.mjs','vendor/vision_wasm_internal.js','vendor/vision_wasm_internal.wasm','models/hand_landmarker.task','vendor/LICENSE-mediapipe.txt']){const size=(await stat(root+'dist/'+f)).size;if(!size)throw new Error('Empty asset: '+f);if(f.endsWith('.wasm')){const bytes=await readFile(root+'dist/'+f);if(bytes.subarray(0,4).toString('hex')!=='0061736d')throw new Error('Invalid wasm: '+f);}}
const model=await readFile(root+'dist/models/hand_landmarker.task');if(!model.includes(Buffer.from('TFL3')))throw new Error('Invalid MediaPipe task model');
for(const m of html.matchAll(/(?:href|src)="\.\/([^"#]+)"/g))await stat(root+'dist/'+m[1]);
console.log('All local assets, WASM signatures, model, DOM references and JS syntax verified.');
