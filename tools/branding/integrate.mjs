import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const kit=path.join(root,'docs/branding/kit');
const dest=path.join(root,'src-tauri/icons/brand-v1');
await fs.mkdir(dest,{recursive:true});
const copies={
  'desktop/windows/icon.ico':'icon.ico',
  'desktop/macos/icon.icns':'icon.icns',
  'master/app-icon-1024.png':'icon.png',
  'desktop/png/32x32.png':'32x32.png',
  'desktop/png/48x48.png':'48x48.png',
  'desktop/png/128x128.png':'128x128.png',
  'desktop/png/256x256.png':'128x128@2x.png',
  'desktop/png/512x512.png':'512x512.png',
};
for(const [source,target] of Object.entries(copies)) await fs.copyFile(path.join(kit,source),path.join(dest,target));
const publicDir=path.join(root,'public/brand');
await fs.mkdir(publicDir,{recursive:true});
for(const file of await fs.readdir(path.join(kit,'website'))) {
  if(file==='head-snippet.html') continue; // Example domain placeholders never enter the app bundle.
  await fs.copyFile(path.join(kit,'website',file),path.join(publicDir,file));
}
console.log('Copied desktop assets to src-tauri/icons/brand-v1 and website assets to public/brand.');
