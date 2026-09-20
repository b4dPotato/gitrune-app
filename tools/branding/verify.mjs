import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const kit=path.join(root,'docs/branding/kit');
const manifest=JSON.parse(await fs.readFile(path.join(kit,'asset-manifest.json'),'utf8'));
const report=[];
for (const item of manifest.assets) {
  const file=path.join(kit,item.path);
  assert.equal((await fs.stat(file)).size,item.bytes,item.path);
  if (/\.svg$/.test(file)) {
    const source=await fs.readFile(file,'utf8');
    assert(!/<image\b|<text\b|<script\b|https?:\/\/(?!www.w3.org)/.test(source),`Nonportable SVG: ${file}`);
    await sharp(file).png().toBuffer();
  }
  if (/\.png$/.test(file)) {
    const metadata=await sharp(file).metadata();
    assert.equal(metadata.width,item.width,item.path);
    assert.equal(metadata.height,item.height,item.path);
    assert.equal(metadata.channels,4,`RGBA required: ${item.path}`);
    assert.equal(metadata.depth,'uchar',`8 bits/channel required: ${item.path}`);
  }
}
report.push(`${manifest.assets.length} files exist; SVGs render without fonts or embedded raster images; PNGs are 8-bit RGBA.`);

async function checkICO(relative,sizes) {
  const buf=await fs.readFile(path.join(kit,relative));
  assert.equal(buf.readUInt16LE(0),0); assert.equal(buf.readUInt16LE(2),1);
  assert.equal(buf.readUInt16LE(4),sizes.length);
  for(let i=0;i<sizes.length;i++) {
    const base=6+i*16;
    assert.equal(buf[base]||256,sizes[i]); assert.equal(buf[base+1]||256,sizes[i]);
    assert.equal(buf.readUInt16LE(base+6),32);
    const length=buf.readUInt32LE(base+8),offset=buf.readUInt32LE(base+12);
    assert(offset+length<=buf.length);
    const meta=await sharp(buf.subarray(offset,offset+length)).metadata();
    assert.equal(meta.width,sizes[i]); assert.equal(meta.height,sizes[i]);
  }
  report.push(`${relative}: verified frames ${sizes.join(', ')} px.`);
}
await checkICO('desktop/windows/icon.ico',[32,16,24,48,64,128,256]);
await checkICO('website/favicon.ico',[16,32,48]);
const icns=await fs.readFile(path.join(kit,'desktop/macos/icon.icns'));
assert.equal(icns.toString('ascii',0,4),'icns'); assert.equal(icns.readUInt32BE(4),icns.length);
const chunks=[];
let pos=8;
while(pos<icns.length) {
  const name=icns.toString('ascii',pos,pos+4),length=icns.readUInt32BE(pos+4);
  assert(length>=8 && pos+length<=icns.length);chunks.push(name);pos+=length;
}
assert.equal(pos,icns.length);
for(const tag of ['ic07','ic08','ic09','ic10','ic11','ic12']) assert(chunks.includes(tag),`Missing ICNS representation ${tag}`);
report.push(`ICNS header, length and representations verified: ${chunks.join(', ')}.`);
const catalog=JSON.parse(await fs.readFile(path.join(kit,'desktop/macos/AppIcon.appiconset/Contents.json'),'utf8'));
assert.equal(catalog.images.length,10);
for(const entry of catalog.images) {
  const meta=await sharp(path.join(kit,'desktop/macos/AppIcon.appiconset',entry.filename)).metadata();
  assert.equal(meta.width,parseInt(entry.size)*parseInt(entry.scale));
}
report.push('All ten macOS asset-catalog slots resolve to correctly sized PNGs.');
const web=JSON.parse(await fs.readFile(path.join(kit,'website/site.webmanifest'),'utf8'));
for(const icon of web.icons) {
  const file=path.join(kit,'website',icon.src),meta=await sharp(file).metadata();
  assert.equal(`${meta.width}x${meta.height}`,icon.sizes);
  if(icon.purpose==='maskable') {
    const {data,info}=await sharp(file).raw().toBuffer({resolveWithObject:true});
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
      const i=(y*info.width+x)*4;
      assert.equal(data[i+3],255,'Maskable icon must be opaque');
      if(data[i+1]>60) assert(Math.hypot(x+.5-info.width/2,y+.5-info.height/2)<=info.width*.4,`Maskable logo outside safe circle: ${icon.src}`);
    }
  }
}
assert((await sharp(path.join(kit,'website/apple-touch-icon.png')).stats()).isOpaque);
assert(!(await sharp(path.join(kit,'logos/mark-1024.png')).stats()).isOpaque);
report.push('Website icon references resolve; touch/maskable icons are opaque; maskable artwork fits the 40% radius safe circle.');
// Compare foreground occupancy, ignoring the color normalization of the vector export.
const original=await sharp(path.join(kit,'master/approved-original.png')).raw().toBuffer({resolveWithObject:true});
const flat=await sharp(path.join(kit,'master/app-icon.svg')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(original.info.width,flat.info.width);
let intersection=0,union=0;
function mark(d,i){ return d[i+3]>128 && d[i+1]>95 && d[i+2]>65; }
for(let i=0;i<original.data.length;i+=4) {
  const a=mark(original.data,i),b=mark(flat.data,i);
  intersection+=a&&b?1:0;union+=a||b?1:0;
}
const similarity=intersection/union;
assert(similarity>.98,`Vector silhouette diverged: ${similarity}`);
report.push(`Approved-original vs vector foreground overlap: ${(similarity*100).toFixed(2)}% (intersection over union).`);
await fs.writeFile(path.join(kit,'validation.txt'),report.join('\n')+'\n\nNative macOS/Linux shell appearance and release builds still require target-platform validation.\n');
console.log(report.join('\n'));
