import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import potrace from 'potrace';
import opentype from 'opentype.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'docs/branding/kit');
const require = createRequire(import.meta.url);
const input = path.join(root, 'docs/branding/gitrune-logo.png');
const teal = '#34c0a2', ink = '#0e1216', mint = '#caffeb', white = '#f4faf8';
const inventory = [];
await fs.mkdir(out, { recursive: true });
async function write(name, content) {
  const dest = path.join(out, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
  inventory.push(name);
}
function svg(w, h, content, title = 'Gitrune') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><title>${title}</title>${content}</svg>`;
}
async function png(name, content, width, height = width) {
  await write(name, await sharp(Buffer.from(content)).resize(width, height).ensureAlpha().png().toBuffer());
}

// Mechanical vector conversion of the approved raster: trace its tile, route,
// and node centers separately. No generative redraw is used in the shipping kit.
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
async function trace(predicate) {
  const binary = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < binary.length; i++) binary[i] = predicate(...data.subarray(i * 4, i * 4 + 4)) ? 0 : 255;
  const buffer = await sharp(binary, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, { threshold: 128, turdSize: 180, optTolerance: 0.35, color: 'currentColor' }, (err, result) => {
      if (err) return reject(err);
      resolve(result.match(/<path[^>]*>/g).join(''));
    });
  });
}
const tilePath = await trace((r,g,b,a) => a > 128);
const markPath = await trace((r,g,b,a) => a > 128 && ((g > 95 && g > r * 1.12 && b > 65) || (r > 150 && g > 190 && b > 150)));
const nodePath = await trace((r,g,b,a) => a > 128 && r > 150 && g > 190 && b > 150);
function color(paths, fill) { return paths.replaceAll('fill="currentColor"', `fill="${fill}"`); }
function rawMark(body = teal, nodes = mint) { return color(markPath, body) + color(nodePath, nodes); }
// Approved mark bounds are approximately x=230..1020, y=236..1018 in the 1254 canvas.
// Use a square 840-unit symbol box with deliberate clear space around these bounds.
function symbol(x, y, size, body = teal, nodes = mint, mono = false) {
  const nodeRings = color(nodePath, body).replaceAll('stroke="none"', `stroke="${body}" stroke-width="48"`);
  const content = mono ? `<mask id="node-cutouts" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254"><rect width="1254" height="1254" fill="white"/>${color(nodePath, 'black')}</mask><g mask="url(#node-cutouts)">${color(markPath, body)}${nodeRings}</g>` : rawMark(body, nodes);
  return `<g transform="translate(${x} ${y}) scale(${size / 840}) translate(-205 -205)">${content}</g>`;
}
const appSVG = svg(1254, 1254, color(tilePath, ink) + rawMark());
const markSVG = svg(820, 820, symbol(0, 0, 820));
const lightMarkSVG = svg(820, 820, symbol(0, 0, 820, '#087f6d', ink));
const blackSVG = svg(820, 820, symbol(0, 0, 820, '#000000', '', true));
const whiteSVG = svg(820, 820, symbol(0, 0, 820, '#ffffff', '', true));
await write('master/approved-original.png', await fs.readFile(input));
await write('master/concept-prompt.md', await fs.readFile(path.join(root,'docs/branding/logo-prompt.md')));
await write('master/app-icon.svg', appSVG);
await write('master/mark.svg', markSVG);
await write('master/mark-on-light.svg', lightMarkSVG);
await write('master/mark-black.svg', blackSVG);
await write('master/mark-white.svg', whiteSVG);
await png('master/app-icon-1024.png', appSVG, 1024);
await png('master/app-icon-2048.png', appSVG, 2048);
for (const [name, source] of [['mark',markSVG],['mark-on-light',lightMarkSVG],['mark-black',blackSVG],['mark-white',whiteSVG]]) {
  for (const size of [256,512,1024,2048]) await png(`logos/${name}-${size}.png`, source, size);
  await write(`logos/${name}.svg`, source);
}

const fontFile = path.join(here, 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff');
// Load via exact ArrayBuffer to avoid pooled Buffer offsets across Node versions.
const fontBuffer = await fs.readFile(fontFile);
const textFont = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
function text(content, x, baseline, size, fill) {
  let result = '', previous;
  for (const character of content) {
    const glyph = textFont.charToGlyph(character);
    if (previous) x += textFont.getKerningValue(previous, glyph) * size / textFont.unitsPerEm;
    result += glyph.getPath(x, baseline, size).toPathData(2) + ' ';
    x += (glyph.advanceWidth || 0) * size / textFont.unitsPerEm;
    previous = glyph;
  }
  return `<path d="${result.trim()}" fill="${fill}"/>`;
}
function textWidth(content, size) {
  let width = 0, previous;
  for (const character of content) {
    const glyph = textFont.charToGlyph(character);
    width += ((glyph.advanceWidth || 0) + (previous ? textFont.getKerningValue(previous, glyph) : 0)) * size / textFont.unitsPerEm;
    previous = glyph;
  }
  return width;
}
await write('licenses/Inter-OFL.txt', await fs.readFile(path.join(here, 'node_modules/@fontsource/inter/LICENSE')));
for (const mode of ['on-dark', 'on-light', 'white', 'black']) {
  const dark = mode === 'on-dark';
  const mono = ['white','black'].includes(mode);
  const foreground = mode === 'white' ? '#ffffff' : mode === 'black' ? '#000000' : dark ? white : ink;
  const body = mono ? foreground : dark ? teal : '#087f6d';
  const nodes = dark ? mint : ink;
  const horizontal = svg(600,160,symbol(8,8,144,body,nodes,mono) + text('Gitrune',185,110,88,foreground));
  const labelWidth = textWidth('Gitrune',72);
  const stacked = svg(480,520,symbol(90,24,300,body,nodes,mono) + text('Gitrune',(480-labelWidth)/2,438,72,foreground));
  for (const [name, content, w, h] of [['horizontal',horizontal,600,160], ['stacked',stacked,480,520]]) {
    await write(`logos/${name}-${mode}.svg`,content);
    await png(`logos/${name}-${mode}.png`,content,w,h);
    await png(`logos/${name}-${mode}@2x.png`,content,w*2,h*2);
  }
}

// Tauri's own installed CLI produces the macOS ICNS container. Keep its extra
// mobile/store outputs in a tools cache, not in the delivered desktop kit.
const tauriOutput = path.join(here,'.cache/tauri');
await fs.mkdir(tauriOutput,{recursive:true});
const tauriCLI = require.resolve('@tauri-apps/cli/tauri.js', { paths: [root] });
execFileSync(process.execPath,[tauriCLI,'icon',path.join(out,'master/app-icon.svg'),'--output',tauriOutput],{cwd:root,stdio:'pipe'});
await write('desktop/macos/icon.icns',await fs.readFile(path.join(tauriOutput,'icon.icns')));
const sizes = [16,24,32,48,64,96,128,256,512,1024];
for (const size of sizes) {
  await png(`desktop/png/${size}x${size}.png`,appSVG,size);
  await png(`desktop/linux/hicolor/${size}x${size}/apps/gitrune.png`,appSVG,size);
}
await write('desktop/linux/hicolor/scalable/apps/gitrune.svg',appSVG);
for (const size of [16,32,128,256,512]) {
  for (const scale of [1,2]) {
    const suffix = scale === 2 ? '@2x' : '';
    await png(`desktop/macos/Gitrune.iconset/icon_${size}x${size}${suffix}.png`,appSVG,size*scale);
    await png(`desktop/macos/AppIcon.appiconset/icon_${size}x${size}${suffix}.png`,appSVG,size*scale);
  }
}
await write('desktop/macos/AppIcon.appiconset/Contents.json',JSON.stringify({images:[16,32,128,256,512].flatMap(size=>[1,2].map(scale=>({idiom:'mac',size:`${size}x${size}`,scale:`${scale}x`,filename:`icon_${size}x${size}${scale===2?'@2x':''}.png`}))),info:{version:1,author:'gitrune'}},null,2)+'\n');
// Native ICNS remains the shipping path. These are import layers, not a .icon project.
await write('desktop/macos/icon-composer/foreground.svg',svg(1024,1024,`<g transform="scale(${1024/1254})">${rawMark()}</g>`));
await write('desktop/macos/icon-composer/background.svg',svg(1024,1024,`<rect width="1024" height="1024" fill="${ink}"/>`));
await png('desktop/macos/icon-composer/foreground.png',svg(1024,1024,`<g transform="scale(${1024/1254})">${rawMark()}</g>`),1024);
await png('desktop/macos/icon-composer/background.png',svg(1024,1024,`<rect width="1024" height="1024" fill="${ink}"/>`),1024);

async function ico(source, dimensions) {
  const frames = await Promise.all(dimensions.map(size=>sharp(Buffer.from(source)).resize(size,size).ensureAlpha().png().toBuffer()));
  const header = Buffer.alloc(6+16*frames.length);
  header.writeUInt16LE(1,2); header.writeUInt16LE(frames.length,4);
  let offset=header.length;
  frames.forEach((buffer,i)=>{
    const base=6+16*i, size=dimensions[i];
    header[base]=size===256?0:size; header[base+1]=size===256?0:size;
    header.writeUInt16LE(1,base+4); header.writeUInt16LE(32,base+6);
    header.writeUInt32LE(buffer.length,base+8); header.writeUInt32LE(offset,base+12);
    offset+=buffer.length;
  });
  return Buffer.concat([header,...frames]);
}
await write('desktop/windows/icon.ico',await ico(appSVG,[32,16,24,48,64,128,256]));
for (const size of [16,18,20,22,24,32,36,40,44,48]) {
  await png(`optional/tray/black-${size}.png`,blackSVG,size);
  await png(`optional/tray/white-${size}.png`,whiteSVG,size);
}
await write('optional/tray/tray-template.svg',blackSVG);
await png('optional/tray/trayTemplate.png',blackSVG,18);
await png('optional/tray/trayTemplate@2x.png',blackSVG,36);
await write('website/favicon.svg',lightMarkSVG);
await write('website/favicon.ico',await ico(lightMarkSVG,[16,32,48]));
for(const size of [16,32,48,96]) await png(`website/favicon-${size}x${size}.png`,lightMarkSVG,size);
await write('website/safari-pinned-tab.svg',blackSVG);
const touchSVG=svg(1024,1024,`<rect width="1024" height="1024" fill="${ink}"/>${symbol(172,172,680)}`);
await png('website/apple-touch-icon.png',touchSVG,180);
for(const size of [192,512]) await png(`website/icon-${size}.png`,appSVG,size);
// 560-square bounds fit entirely inside radius=0.4*1024 circular safe area.
const maskableSVG=svg(1024,1024,`<rect width="1024" height="1024" fill="${ink}"/>${symbol(232,232,560)}`);
for(const size of [192,512]) await png(`website/maskable-${size}.png`,maskableSVG,size);
await write('website/site.webmanifest',JSON.stringify({name:'Gitrune',short_name:'Gitrune',description:'A local-first visual Git client.',start_url:'/',scope:'/',display:'browser',background_color:ink,theme_color:ink,icons:[... [192,512].map(size=>({src:`icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'})),...[192,512].map(size=>({src:`maskable-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'maskable'}))]},null,2)+'\n');
for(const file of ['horizontal-on-dark.svg','horizontal-on-light.svg','mark.svg','mark-on-light.svg','mark-black.svg','mark-white.svg']) await write(`website/${file}`,await fs.readFile(path.join(out,'logos',file)));

function social(w,h) {
  const iconSize=Math.min(h*.57,360), left=72, top=(h-iconSize)/2;
  return svg(w,h,`<rect width="${w}" height="${h}" fill="${ink}"/><path d="M0 ${h-5} H${w}" stroke="${teal}" stroke-width="10"/><g transform="translate(${left} ${top}) scale(${iconSize/1254})">${color(tilePath,'#192329')}${rawMark()}</g>${text('Gitrune',left+iconSize+40,h*.47,90,white)}${text('Your code. Your history.',left+iconSize+42,h*.60,31,'#a6b8c1')}${text('A local-first visual Git client',left+iconSize+42,h*.70,23,teal)}`);
}
for(const [name,w,h] of [['open-graph',1200,630],['social-wide',1200,600]]) {
  const content=social(w,h);
  await write(`social/${name}.svg`,content);
  await png(`social/${name}.png`,content,w,h);
}
await png('social/avatar-512.png',appSVG,512);
await png('social/avatar-1024.png',appSVG,1024);
await write('website/open-graph.png',await fs.readFile(path.join(out,'social/open-graph.png')));
await write('website/social-wide.png',await fs.readFile(path.join(out,'social/social-wide.png')));

// A compact board shows actual assets; no screenshot or product UI is fabricated.
const pieces=[{input:await sharp(path.join(out,'master/app-icon-1024.png')).resize(260,260).toBuffer(),left:70,top:120},
 {input:await sharp(path.join(out,'logos/horizontal-on-dark.svg')).resize(540,144).toBuffer(),left:440,top:135},
 {input:await sharp(path.join(out,'logos/horizontal-on-light.svg')).resize(540,144).toBuffer(),left:440,top:350},
 {input:await sharp(path.join(out,'logos/mark-white.svg')).resize(90,90).toBuffer(),left:115,top:435},
 {input:await sharp(path.join(out,'logos/mark-black.svg')).resize(90,90).toBuffer(),left:290,top:435}];
const boardSVG=svg(1200,850,`<rect width="1200" height="850" fill="${ink}"/><rect x="410" y="325" width="730" height="190" rx="16" fill="#edf0f2"/><rect x="265" y="415" width="140" height="140" rx="16" fill="#edf0f2"/>${text('Gitrune / Brand assets',64,62,32,white)}${text('APP ICON',100,405,16,'#a6b8c1')}${text('MONOCHROME',85,585,16,'#a6b8c1')}${text('ACTUAL PIXEL SIZES',64,650,16,'#a6b8c1')}${text('macOS  /  Windows  /  Linux  /  Web',64,800,25,teal)}`);
let x=64;
for(const size of [16,24,32,48,64,128]) {
  pieces.push({input:await sharp(Buffer.from(appSVG)).resize(size,size).toBuffer(),left:x,top:720-Math.floor(size/2)});
  x+=size+35;
}
await write('preview.png',await sharp(Buffer.from(boardSVG)).composite(pieces).png().toBuffer());
await write('README.md',await fs.readFile(path.join(here,'BRAND_GUIDE.md')));
await write('website/head-snippet.html',await fs.readFile(path.join(here,'head-snippet.html')));
const assets=[];
for(const name of inventory.sort()) {
  const file=path.join(out,name), bytes=(await fs.stat(file)).size;
  let dimensions={};
  if(/\.(png|svg)$/.test(name)) {
    const metadata=await sharp(file).metadata();
    dimensions={width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha};
  }
  assets.push({path:name,bytes,...dimensions});
}
await fs.writeFile(path.join(out,'asset-manifest.json'),JSON.stringify({brand:'Gitrune',source:'master/approved-original.png',assets},null,2)+'\n');
console.log(`Generated ${assets.length} assets in ${out}`);
