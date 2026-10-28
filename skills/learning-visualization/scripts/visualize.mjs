#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const GENERATOR = 'learning-visualization';
const GENERATOR_VERSION = '1.0.0';
const DEFAULT_ARCHIFY = 'C:\\Users\\zhang\\.agents\\skills\\archify';
const SUPPORTED_IMAGES = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.svg', 'image/svg+xml']
]);

function fail(message, details = [], code = 1) {
  const error = new Error(message);
  error.details = details;
  error.exitCode = code;
  throw error;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readJson(filePath) {
  if (!path.isAbsolute(filePath)) fail('路径必须是绝对路径', [filePath]);
  if (!fs.existsSync(filePath)) fail('输入路径不存在', [filePath], 2);
  if (!fs.statSync(filePath).isFile()) fail('输入必须是文件', [filePath], 2);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('JSON 无法读取', [error.message], 2);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectIds(pkg) {
  return [
    ...asArray(pkg.concepts), ...asArray(pkg.examples), ...asArray(pkg.steps),
    ...asArray(pkg.spatial?.items)
  ].map((item) => item?.id).filter(Boolean);
}

function chooseMode(pkg) {
  const preferred = textValue(pkg.visualization_request?.preferred_mode).toLowerCase();
  if (['explainer', 'process', '3d'].includes(preferred)) return preferred;
  if (pkg.visualization_request?.allow_3d && asArray(pkg.spatial?.items).length >= 2) return '3d';
  if (asArray(pkg.steps).length >= 2) return 'process';
  if (asArray(pkg.concepts).length && asArray(pkg.examples).length >= 2) return 'explainer';
  return 'explainer';
}

function evaluatePackage(pkg) {
  const errors = [];
  const warnings = [];
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) errors.push('根节点必须是对象');
  if (!textValue(pkg?.topic)) errors.push('缺少 topic');
  if (!textValue(pkg?.purpose)) errors.push('缺少 purpose');

  const ids = collectIds(pkg || {});
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(`ID 重复: ${[...new Set(duplicateIds)].join(', ')}`);
  const idSet = new Set(ids);

  for (const relation of asArray(pkg?.relations)) {
    if (!textValue(relation?.from) || !textValue(relation?.to) || !textValue(relation?.meaning)) {
      errors.push('relations 每项都需要 from、to、meaning');
      continue;
    }
    if (!idSet.has(relation.from)) errors.push(`relation.from 未找到: ${relation.from}`);
    if (!idSet.has(relation.to)) errors.push(`relation.to 未找到: ${relation.to}`);
  }

  const mode = chooseMode(pkg || {});
  if (mode === 'explainer' && (asArray(pkg?.concepts).length || asArray(pkg?.examples).length)) {
    if (asArray(pkg.concepts).length < 1) errors.push('解释页缺少 concepts');
    if (asArray(pkg.examples).length < 2) errors.push('解释页至少需要两个已有例子');
    for (const example of asArray(pkg.examples)) {
      for (const field of ['id', 'angle', 'title', 'content', 'mapping', 'boundary']) {
        if (!textValue(example?.[field])) errors.push(`example ${example?.id || '(无 id)'} 缺少 ${field}`);
      }
    }
    if (asArray(pkg.relations).length < 1) errors.push('解释页缺少 relations');
  }
  if (mode === 'process') {
    if (asArray(pkg?.steps).length < 2) errors.push('过程图至少需要两个 steps');
    for (const step of asArray(pkg.steps)) {
      if (!textValue(step?.id) || !textValue(step?.title) || !textValue(step?.content)) {
        errors.push('steps 每项都需要 id、title、content');
      }
    }
  }
  if (mode === '3d') {
    const items = asArray(pkg?.spatial?.items);
    if (items.length < 2) errors.push('简化三维至少需要两个 spatial.items');
    for (const item of items) {
      if (!textValue(item?.id) || !textValue(item?.label)) errors.push('spatial.items 每项都需要 id 和 label');
      const position = item?.position;
      if (!position || !['x', 'y', 'z'].every((key) => Number.isFinite(Number(position[key])))) {
        errors.push(`spatial item ${item?.id || '(无 id)'} 缺少数值 position.x/y/z`);
      }
    }
    if (!asArray(pkg?.spatial?.relations).length && !asArray(pkg?.relations).length) {
      errors.push('简化三维缺少空间关系');
    }
  }

  for (const source of asArray(pkg?.sources)) {
    for (const field of ['title', 'url', 'accessed_at', 'supports', 'evidence_status']) {
      if (source?.[field] === undefined || source?.[field] === null || source?.[field] === '') {
        warnings.push(`来源 ${source?.title || '(未命名)'} 缺少 ${field}`);
      }
    }
  }

  const objectCount = asArray(pkg?.concepts).length + asArray(pkg?.examples).length
    + asArray(pkg?.steps).length + asArray(pkg?.relations).length + asArray(pkg?.spatial?.items).length;
  const relationMeanings = [
    ...asArray(pkg?.relations).map((item) => textValue(item?.meaning)),
    ...asArray(pkg?.spatial?.relations).map((item) => textValue(item?.meaning))
  ].join(' ');
  const temporalOrSpatial = asArray(pkg?.steps).length >= 2
    || asArray(pkg?.spatial?.items).length >= 2
    || /(因果|时序|顺序|状态|方向|空间|旋转|运动|cause|sequence|state|direction|spatial)/i.test(relationMeanings);
  const mapping = asArray(pkg?.concepts).length > 0 && asArray(pkg?.examples).length > 0
    && asArray(pkg?.relations).length > 0;
  const confusion = asArray(pkg?.confusions).length > 0 || /(对照|限制|混淆|contrast|limit)/i.test(relationMeanings);
  const interactive = textValue(pkg?.visualization_request?.interaction).toLowerCase() !== 'none'
    && objectCount >= 2;
  const hardToExpress = pkg?.visualization_request?.hard_to_express === true;
  const conditions = [
    { id: 1, met: objectCount >= 2, reason: '存在多个对象、步骤或关系' },
    { id: 2, met: temporalOrSpatial, reason: '存在因果、时序、空间、状态或方向变化' },
    { id: 3, met: mapping, reason: '存在例子、概念与关系映射' },
    { id: 4, met: confusion, reason: '存在容易混淆的关系' },
    { id: 5, met: interactive, reason: '交互能展示多个已有内容项' },
    { id: 6, met: hardToExpress, reason: '输入明确说明普通文字、代码或表格难以表达' }
  ];
  const gateScore = conditions.filter((item) => item.met).length;
  return { ok: errors.length === 0, mode, errors, warnings, gate: gateScore >= 2, gateScore, conditions };
}

function isoTimestamp() {
  return new Date().toISOString();
}

function localDateStamp() {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function receiptPathFor(htmlPath) {
  return path.join(path.dirname(htmlPath), `${path.basename(htmlPath, path.extname(htmlPath))}.visualization.json`);
}

function stableFiles(outDir, basename) {
  return {
    html: path.join(outDir, `${basename}.html`),
    source: path.join(outDir, `${basename}.json`),
    candidate: path.join(outDir, `${basename}.archify.json`),
    receipt: path.join(outDir, `${basename}.visualization.json`)
  };
}

function verifyReceiptEntries(receipt, baseDir) {
  const errors = [];
  if (receipt?.generator !== GENERATOR) errors.push('回执生成器不匹配');
  for (const entry of asArray(receipt?.files)) {
    const filePath = path.resolve(baseDir, entry.path);
    if (!fs.existsSync(filePath)) errors.push(`回执文件不存在: ${entry.path}`);
    else if (sha256File(filePath) !== entry.sha256) errors.push(`文件被修改: ${entry.path}`);
  }
  return errors;
}

function preflightUpdate(outDir, basename) {
  if (!path.isAbsolute(outDir)) fail('输出目录必须是绝对路径', [outDir]);
  const files = stableFiles(outDir, basename);
  const existing = Object.values(files).filter((filePath) => fs.existsSync(filePath));
  if (!existing.length) return { backupPaths: [], firstGeneration: true };
  if (!fs.existsSync(files.receipt)) {
    fail('已有可视化来源不明，拒绝覆盖', existing, 3);
  }
  const receipt = readJson(files.receipt);
  const ownershipErrors = verifyReceiptEntries(receipt, outDir);
  if (ownershipErrors.length) fail('已有可视化可能被手工修改，拒绝覆盖', ownershipErrors, 3);

  const historyDir = path.join(outDir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  const stamp = localDateStamp();
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-${stamp}-(\\d+)`);
  const indexes = fs.readdirSync(historyDir)
    .map((name) => name.match(pattern)?.[1]).filter(Boolean).map(Number);
  const index = indexes.length ? Math.max(...indexes) + 1 : 1;
  const backupPaths = [];
  for (const filePath of existing) {
    const suffix = path.basename(filePath).slice(basename.length);
    const backupPath = path.join(historyDir, `${basename}-${stamp}-${index}${suffix}`);
    fs.copyFileSync(filePath, backupPath);
    backupPaths.push(backupPath);
  }
  return { backupPaths, firstGeneration: false };
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function buildReceipt(htmlPath, sourcePath, engine, candidatePath = '') {
  const baseDir = path.dirname(htmlPath);
  const paths = [htmlPath, sourcePath, candidatePath].filter(Boolean);
  const receipt = {
    schema_version: 1,
    generator: GENERATOR,
    generator_version: GENERATOR_VERSION,
    engine,
    created_at: isoTimestamp(),
    files: paths.map((filePath) => ({ path: path.relative(baseDir, filePath), sha256: sha256File(filePath) }))
  };
  const receiptPath = receiptPathFor(htmlPath);
  atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return { receiptPath, receipt };
}

function resolveAssets(pkg, packagePath) {
  const result = [];
  for (const asset of asArray(pkg.assets)) {
    const raw = textValue(asset?.path);
    if (!raw) continue;
    const filePath = path.isAbsolute(raw) ? raw : path.resolve(path.dirname(packagePath), raw);
    const extension = path.extname(filePath).toLowerCase();
    const mime = SUPPORTED_IMAGES.get(extension);
    const item = { title: textValue(asset.title) || path.basename(filePath), originalPath: raw, available: false };
    if (mime && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      item.available = true;
      item.dataUri = `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
    }
    result.push(item);
  }
  return result;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function renderHtml(pkg, mode, assets) {
  const payload = safeJson(pkg);
  const assetPayload = safeJson(assets);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="${GENERATOR}/${GENATOR_SAFE}">
<title>${escapeHtml(textValue(pkg.topic))} · 学习内容可视化</title>
<style>
:root{color-scheme:dark;--bg:#07111f;--panel:#101f33;--panel2:#162a43;--line:#34506f;--text:#eef7ff;--muted:#a8bdd1;--cyan:#42d3ff;--amber:#ffca63;--rose:#ff7f9f;--green:#67e8a5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#15385a 0,transparent 35%),var(--bg);color:var(--text);font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.6}header,main{width:min(1180px,calc(100% - 32px));margin:auto}header{padding:48px 0 24px}h1{margin:0 0 8px;font-size:clamp(30px,5vw,58px);line-height:1.08}h2{font-size:20px;margin:0 0 14px}.kicker{color:var(--cyan);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.purpose{max-width:760px;color:var(--muted);font-size:18px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.btn,.tab{border:1px solid var(--line);background:rgba(16,31,51,.9);color:var(--text);padding:10px 15px;border-radius:12px;cursor:pointer}.btn:hover,.tab:hover,.tab.active,.btn.active{border-color:var(--cyan);box-shadow:0 0 0 2px #42d3ff22}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.panel{grid-column:span 12;background:linear-gradient(150deg,#12243aee,#0b1829ee);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 18px 60px #0005}.half{grid-column:span 6}.third{grid-column:span 4}.muted{color:var(--muted)}.card{border:1px solid var(--line);background:var(--panel2);border-radius:14px;padding:14px;margin:10px 0;transition:.2s}.card.active{border-color:var(--cyan);transform:translateY(-2px);box-shadow:0 10px 28px #42d3ff1d}.tag{display:inline-block;padding:3px 8px;border-radius:999px;background:#42d3ff1c;color:var(--cyan);font-size:12px;margin-right:8px}.boundary{border-left:3px solid var(--amber);padding-left:12px;color:#ffe0a0}.relation{width:100%;text-align:left;margin:6px 0}.steps{display:flex;gap:12px;overflow:auto;padding-bottom:8px}.step{min-width:220px;position:relative}.step:not(:last-child)::after{content:'→';position:absolute;right:-13px;top:42%;color:var(--cyan)}pre{white-space:pre-wrap;word-break:break-word;background:#06101d;padding:12px;border-radius:10px}details{border-top:1px solid var(--line);padding:12px 0}a{color:var(--cyan)}.asset{max-width:100%;border-radius:12px;border:1px solid var(--line)}#space-canvas{width:100%;height:440px;background:#07101d;border:1px solid var(--line);border-radius:14px;touch-action:none}.notice{color:#ffe0a0;border:1px solid #9e7629;background:#32260d;padding:10px 12px;border-radius:10px}.hidden{display:none!important}footer{padding:28px 0 50px;color:var(--muted);font-size:13px}@media(max-width:760px){.half,.third{grid-column:span 12}header{padding-top:28px}.steps{flex-direction:column}.step{min-width:0}.step::after{display:none}#space-canvas{height:340px}}
</style>
</head>
<body>
<!-- learning-visualization:generated -->
<header><div class="kicker">${escapeHtml(modeLabel(mode))}</div><h1>${escapeHtml(textValue(pkg.topic))}</h1><div class="purpose">${escapeHtml(textValue(pkg.purpose))}</div><div class="toolbar" id="main-toolbar"></div></header>
<main id="app"><noscript>此页面需要启用 JavaScript 才能使用交互；源内容请查看同名 JSON。</noscript></main>
<footer>页面只展示输入中已有的内容，不代表学习完成或真实工程验证。</footer>
<script id="lv-data" type="application/json">${payload}</script>
<script id="lv-assets" type="application/json">${assetPayload}</script>
<script>
const data=JSON.parse(document.getElementById('lv-data').textContent);const assets=JSON.parse(document.getElementById('lv-assets').textContent);const mode=${JSON.stringify(mode)};const app=document.getElementById('app');const bar=document.getElementById('main-toolbar');let selected=0;
const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const btn=(id,label,extra='')=>'<button class="btn '+extra+'" id="'+id+'">'+esc(label)+'</button>';
function sourcePanel(){const sources=data.sources||[];const assetHtml=assets.map(a=>a.available?'<figure><img class="asset" src="'+a.dataUri+'" alt="'+esc(a.title)+'"><figcaption class="muted">'+esc(a.title)+'</figcaption></figure>':'<div class="notice">资源未内嵌：'+esc(a.originalPath)+'</div>').join('');return '<section class="panel"><h2>来源与资源</h2>'+sources.map(s=>'<details><summary>'+esc(s.title||'未命名来源')+'</summary><div class="muted">URL：'+esc(s.url||'缺失')+'<br>读取时间：'+esc(s.accessed_at||'缺失')+'<br>证据状态：'+esc(s.evidence_status||'缺失')+'</div></details>').join('')+assetHtml+'</section>'}
function relationButtons(){return (data.relations||[]).map((r,i)=>'<button class="btn relation" id="rel-'+i+'" data-rel="'+i+'" data-from="'+esc(r.from)+'" data-to="'+esc(r.to)+'">'+esc(r.from)+' → '+esc(r.to)+'：'+esc(r.meaning)+'</button>').join('')}
function renderExplainer(){const ex=data.examples||[],concepts=data.concepts||[];bar.innerHTML=ex.map((e,i)=>'<button class="tab '+(i===selected?'active':'')+'" data-example="'+i+'">'+esc(e.angle||e.title)+'</button>').join('')+btn('next-step','下一项');const e=ex[selected]||{};app.innerHTML='<div class="grid"><section class="panel half"><h2>已有例子</h2><div class="card active" id="node-'+esc(e.id)+'" data-node="'+esc(e.id)+'"><span class="tag">'+esc(e.angle)+'</span><strong>'+esc(e.title)+'</strong><p>'+esc(e.content)+'</p><p><b>对应：</b>'+esc(e.mapping)+'</p><p class="boundary"><b>边界：</b>'+esc(e.boundary)+'</p></div></section><section class="panel half"><h2>已有概念</h2>'+concepts.map(c=>'<article class="card" id="node-'+esc(c.id)+'" data-node="'+esc(c.id)+'"><b>'+esc(c.label)+'</b><p>'+esc(c.explanation)+'</p></article>').join('')+'</section><section class="panel half"><h2>已有关系</h2>'+relationButtons()+'</section><section class="panel half"><h2>逐步对照</h2><ol><li>查看输入中的例子</li><li>查看输入中的概念</li><li>点击节点或关系进行高亮</li><li>核对边界与来源</li></ol></section>'+sourcePanel()+'</div>';bindCommon();document.querySelectorAll('[data-example]').forEach(el=>el.onclick=()=>{selected=Number(el.dataset.example);renderExplainer()});document.getElementById('next-step').onclick=()=>{selected=(selected+1)%Math.max(ex.length,1);renderExplainer()}}
function renderProcess(){const steps=data.steps||[];bar.innerHTML=btn('prev-step','上一步')+btn('next-step','下一步');const current=steps[selected]||{};app.innerHTML='<div class="grid"><section class="panel"><h2>过程</h2><div class="steps">'+steps.map((s,i)=>'<button class="card step '+(i===selected?'active':'')+'" id="node-'+esc(s.id)+'" data-node="'+esc(s.id)+'" data-step="'+i+'"><span class="tag">'+(i+1)+'</span><b>'+esc(s.title)+'</b></button>').join('')+'</div></section><section class="panel half"><h2>'+esc(current.title||'步骤')+'</h2><p>'+esc(current.content||'')+'</p>'+(current.code?'<pre>'+esc(current.code)+'</pre>':'')+'</section><section class="panel half"><h2>已有关系</h2>'+relationButtons()+'</section>'+sourcePanel()+'</div>';bindCommon();document.querySelectorAll('[data-step]').forEach(el=>el.onclick=()=>{selected=Number(el.dataset.step);renderProcess()});document.getElementById('next-step').onclick=()=>{selected=Math.min(selected+1,steps.length-1);renderProcess()};document.getElementById('prev-step').onclick=()=>{selected=Math.max(selected-1,0);renderProcess()}}
let yaw=.65,pitch=.42,drag=false,lastX=0,lastY=0;function render3d(){bar.innerHTML=btn('view-3d','三维示意','active')+btn('view-2d','二维退路')+btn('reset-view','重置视角');app.innerHTML='<div class="grid"><section class="panel"><div class="notice">示意模型，不代表真实尺寸、材料或工程仿真。</div><canvas id="space-canvas" aria-label="简化三维模型"></canvas><div id="space-2d" class="hidden"></div></section><section class="panel half"><h2>空间项</h2>'+(data.spatial?.items||[]).map(i=>'<div class="card"><b>'+esc(i.label)+'</b><div class="muted">x='+esc(i.position?.x)+'，y='+esc(i.position?.y)+'，z='+esc(i.position?.z)+'</div></div>').join('')+'</section><section class="panel half"><h2>已有空间关系</h2>'+(data.spatial?.relations||data.relations||[]).map(r=>'<div class="card">'+esc(r.from)+' → '+esc(r.to)+'：'+esc(r.meaning)+'</div>').join('')+'</section>'+sourcePanel()+'</div>';const canvas=document.getElementById('space-canvas');const fallback=document.getElementById('space-2d');function draw(){const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);c.strokeStyle='#34506f';c.beginPath();c.moveTo(20,h*.78);c.lineTo(w-20,h*.78);c.stroke();const points=(data.spatial?.items||[]).map(item=>{let x=Number(item.position.x),y=Number(item.position.y),z=Number(item.position.z);const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const rx=x*cy-z*sy,rz=x*sy+z*cy,ry=y*cp-rz*sp,depth=y*sp+rz*cp;const scale=70/(1+Math.max(-.7,depth*.08));return{item,x:w/2+rx*scale,y:h*.62-ry*scale,depth}}).sort((a,b)=>a.depth-b.depth);for(const p of points){c.fillStyle=p.item.color||'#42d3ff';c.beginPath();c.arc(p.x,p.y,13,0,Math.PI*2);c.fill();c.fillStyle='#eef7ff';c.font='14px Segoe UI';c.fillText(p.item.label,p.x+18,p.y+5)}}draw();canvas.onpointerdown=e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.01;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-lastY)*.01));lastX=e.clientX;lastY=e.clientY;draw()};canvas.onpointerup=()=>drag=false;window.addEventListener('resize',draw,{passive:true});document.getElementById('reset-view').onclick=()=>{yaw=.65;pitch=.42;draw()};document.getElementById('view-2d').onclick=()=>{canvas.classList.add('hidden');fallback.classList.remove('hidden');fallback.innerHTML=(data.spatial?.items||[]).map(i=>'<div class="card"><b>'+esc(i.label)+'</b> — ('+esc(i.position.x)+', '+esc(i.position.y)+', '+esc(i.position.z)+')</div>').join('')};document.getElementById('view-3d').onclick=()=>{fallback.classList.add('hidden');canvas.classList.remove('hidden');draw()}}
function bindCommon(){const clear=()=>{document.querySelectorAll('.card,.relation').forEach(el=>el.classList.remove('active'))};const highlightRelation=(r,index)=>{clear();document.getElementById('rel-'+index)?.classList.add('active');for(const id of [r?.from,r?.to])document.getElementById('node-'+id)?.classList.add('active')};document.querySelectorAll('[data-rel]').forEach(el=>el.onclick=()=>{const index=Number(el.dataset.rel);highlightRelation((data.relations||[])[index],index)});document.querySelectorAll('[data-node]').forEach(el=>el.onclick=()=>{const id=el.dataset.node;clear();el.classList.add('active');(data.relations||[]).forEach((r,index)=>{if(r.from===id||r.to===id)document.getElementById('rel-'+index)?.classList.add('active')})})}
if(mode==='3d')render3d();else if(mode==='process')renderProcess();else renderExplainer();
</script>
</body></html>`;
}

const GENATOR_SAFE = GENERATOR_VERSION;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function modeLabel(mode) {
  return mode === '3d' ? '简化三维模型' : mode === 'process' ? '交互过程图' : '交互解释页';
}

function renderBuiltin(packagePath, outDir, basename) {
  const pkg = readJson(packagePath);
  const evaluation = evaluatePackage(pkg);
  if (!evaluation.ok) fail('内容包字段不完整', evaluation.errors, 2);
  if (!evaluation.gate) fail('可视化门禁未通过', evaluation.conditions.filter((item) => !item.met).map((item) => item.reason), 2);
  if (!path.isAbsolute(outDir)) fail('输出目录必须是绝对路径', [outDir], 2);
  const files = stableFiles(outDir, basename);
  if (path.resolve(packagePath) === path.resolve(files.source)) fail('输出 JSON 不能覆盖输入内容包', [files.source], 2);
  const html = renderHtml(pkg, evaluation.mode, resolveAssets(pkg, packagePath));
  if (!html.includes('learning-visualization:generated') || !html.includes('id="main-toolbar"')) {
    fail('生成页面结构检查失败');
  }
  fs.mkdirSync(outDir, { recursive: true });
  const update = preflightUpdate(outDir, basename);
  const source = {
    ...pkg,
    _visualization: {
      generator: GENERATOR,
      generator_version: GENERATOR_VERSION,
      mode: evaluation.mode,
      generated_at: isoTimestamp(),
      input_package_sha256: sha256File(packagePath)
    }
  };
  atomicWrite(files.source, `${JSON.stringify(source, null, 2)}\n`);
  atomicWrite(files.html, html);
  const recorded = buildReceipt(files.html, files.source, 'builtin');
  return { ok: true, mode: evaluation.mode, engine: 'builtin', html: files.html, source: files.source, receipt: recorded.receiptPath, backups: update.backupPaths, warnings: evaluation.warnings };
}

function probeArchify(archifyDir = DEFAULT_ARCHIFY) {
  if (!path.isAbsolute(archifyDir) || !fs.existsSync(archifyDir)) fail('Archify 不存在', [archifyDir], 4);
  const releasePath = path.join(archifyDir, 'skill-release.json');
  const packagePath = path.join(archifyDir, 'package.json');
  const cliPath = path.join(archifyDir, 'bin', 'archify.mjs');
  if (!fs.existsSync(cliPath)) fail('Archify 命令行入口不存在', [cliPath], 4);
  let version = '';
  if (fs.existsSync(releasePath)) version = JSON.parse(fs.readFileSync(releasePath, 'utf8')).version || '';
  if (!version && fs.existsSync(packagePath)) version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '';
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[1]) !== 3 || Number(match[2]) !== 2) {
    fail('Archify 版本不在适配范围 >=3.2.0 <3.3.0', [version || 'unknown'], 4);
  }
  return { ok: true, version, cli: cliPath, compatible: true };
}

function collectRequiredStrings(pkg) {
  const strings = [];
  const add = (value) => { const text = textValue(value); if (text.length >= 2) strings.push(text); };
  add(pkg.topic); add(pkg.purpose);
  for (const item of asArray(pkg.concepts)) { add(item.label); add(item.explanation); }
  for (const item of asArray(pkg.examples)) { add(item.title); add(item.content); add(item.mapping); add(item.boundary); }
  for (const item of asArray(pkg.steps)) { add(item.title); add(item.content); }
  for (const item of asArray(pkg.relations)) add(item.meaning);
  for (const item of asArray(pkg.sources)) { add(item.title); add(item.url); add(item.accessed_at); add(item.evidence_status); }
  for (const item of asArray(pkg.spatial?.items)) add(item.label);
  for (const item of asArray(pkg.spatial?.relations)) add(item.meaning);
  return [...new Set(strings)];
}

function compareArchify(packagePath, candidatePath) {
  const pkg = readJson(packagePath);
  const candidate = readJson(candidatePath);
  const evaluation = evaluatePackage(pkg);
  if (!evaluation.ok) fail('内容包字段不完整', evaluation.errors, 2);
  if (!evaluation.gate) fail('可视化门禁未通过', [], 2);
  const serialized = JSON.stringify(candidate);
  const missing = collectRequiredStrings(pkg).filter((value) => !serialized.includes(value));
  if (missing.length) fail('Archify 候选遗漏输入内容', missing, 5);
  return { ok: true, checkedStrings: collectRequiredStrings(pkg).length, missing: [] };
}

function verifyArtifact(htmlPath, sourcePath) {
  if (!path.isAbsolute(htmlPath) || !path.isAbsolute(sourcePath)) fail('验证路径必须是绝对路径');
  if (!fs.existsSync(htmlPath) || !fs.existsSync(sourcePath)) fail('HTML 或 JSON 不存在', [htmlPath, sourcePath], 2);
  const receiptPath = receiptPathFor(htmlPath);
  if (!fs.existsSync(receiptPath)) fail('缺少可视化回执', [receiptPath], 2);
  const receipt = readJson(receiptPath);
  const receiptErrors = verifyReceiptEntries(receipt, path.dirname(htmlPath));
  const html = fs.readFileSync(htmlPath, 'utf8');
  const source = readJson(sourcePath);
  const checks = {
    files_readable: true,
    receipt_hashes: receiptErrors.length === 0,
    html_document: /<!doctype html>/i.test(html) && /<meta charset="utf-8">/i.test(html),
    main_interaction: receipt.engine === 'archify' || (html.includes('id="main-toolbar"') && html.includes('function bindCommon')),
    no_empty_image_src: !/<img[^>]+\bsrc=(["'])\s*\1/i.test(html),
    source_metadata: receipt.engine === 'archify' || source?._visualization?.generator === GENERATOR,
    two_dimensional_fallback: source?._visualization?.mode !== '3d' || html.includes("btn('view-2d'")
  };
  const evidenceErrors = [];
  for (const evidence of asArray(source.input_evidence)) {
    const evidencePath = textValue(evidence?.path);
    if (!evidencePath || !textValue(evidence?.sha256)) continue;
    if (!fs.existsSync(evidencePath)) evidenceErrors.push(`输入证据不存在: ${evidencePath}`);
    else if (sha256File(evidencePath) !== evidence.sha256) evidenceErrors.push(`输入证据哈希已变化: ${evidencePath}`);
  }
  checks.input_evidence_unchanged = evidenceErrors.length === 0;
  const failures = [...receiptErrors, ...evidenceErrors, ...Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)];
  if (failures.length) fail('验证失败', failures, 6);
  return { ok: true, engine: receipt.engine, checks, notVerified: ['浏览器人工视觉检查', '真实工程或目标板行为'] };
}

function parseOptions(args) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = args[index + 1];
      if (next && !next.startsWith('--')) { options[key] = next; index += 1; }
      else options[key] = true;
    } else positionals.push(value);
  }
  return { positionals, options };
}

function usage() {
  return `用法:
  visualize.mjs validate <package.json>
  visualize.mjs render <package.json> --out-dir <absolute-dir> --basename <name>
  visualize.mjs probe-archify [--archify-dir <absolute-dir>]
  visualize.mjs compare-archify <package.json> <candidate.json>
  visualize.mjs preflight <absolute-dir> <basename>
  visualize.mjs record <html> <source.json> --engine <archify|builtin> [--candidate <candidate.json>]
  visualize.mjs verify <html> <source.json>`;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positionals, options } = parseOptions(rest);
  let result;
  switch (command) {
    case 'validate': {
      const pkg = readJson(positionals[0]);
      result = evaluatePackage(pkg);
      if (!result.ok || !result.gate) process.exitCode = 2;
      break;
    }
    case 'render': {
      if (!options['out-dir'] || !options.basename) fail('render 缺少 --out-dir 或 --basename');
      result = renderBuiltin(positionals[0], options['out-dir'], options.basename);
      break;
    }
    case 'probe-archify':
      result = probeArchify(options['archify-dir'] || DEFAULT_ARCHIFY);
      break;
    case 'compare-archify':
      result = compareArchify(positionals[0], positionals[1]);
      break;
    case 'preflight':
      result = { ok: true, ...preflightUpdate(positionals[0], positionals[1]) };
      break;
    case 'record': {
      const engine = options.engine || 'archify';
      if (!['archify', 'builtin'].includes(engine)) fail('未知 engine', [engine]);
      if (!fs.existsSync(positionals[0]) || !fs.existsSync(positionals[1])) fail('record 的 HTML 或 JSON 不存在');
      if (options.candidate && !fs.existsSync(options.candidate)) fail('Archify 候选不存在', [options.candidate]);
      const recorded = buildReceipt(positionals[0], positionals[1], engine, options.candidate || '');
      result = { ok: true, receipt: recorded.receiptPath };
      break;
    }
    case 'verify':
      result = verifyArtifact(positionals[0], positionals[1]);
      break;
    case 'help':
    case '--help':
    case undefined:
      process.stdout.write(`${usage()}\n`);
      return;
    default:
      fail('未知命令', [command, usage()]);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message, details: error.details || [] }, null, 2)}\n`);
  process.exitCode = error.exitCode || 1;
});
