// Hibiki UI: schematic editor, live scope, audio test bench, board layout views.
'use strict';
const $ = s => document.querySelector(s);
const U = 20, KEY = 'hibiki.project', CIN = '#4da3ff', COUT = '#f0a030';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let sch = null, last = '', sel = null, tool = 'select', ghost = null, ghostBlock = null, wireStart = null, mouse = [0, 0], drag = null;
let multi = null, boxSel = null;         // multi: { c: Set of part ids, w: Set of wire ids } picked with the selection box
let tab = 'sch', boardKind = 'bread', boardMode = 'move', sim = { ex: null, dc: null };
const view = { x: 0, y: 0, k: 1 }, undo = [], redo = [];
const svg = $('#sch');

// ---------- project state ----------
// Opened by the MCP server as http://127.0.0.1:port/?project=name: the project file on disk is the shared copy.
// Edits here are written to it, and changes Claude makes to it show up here within a couple of seconds.
const remoteName = /^http/.test(location.protocol) ? new URLSearchParams(location.search).get('project') : null;
let remoteMtime = '', remoteReady = false;
const remoteUrl = () => 'api/project?name=' + encodeURIComponent(remoteName);
const store = () => {
  try { localStorage.setItem(KEY, last); } catch (e) { /* private mode: no autosave */ }
  if (remoteName && remoteReady) fetch(remoteUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: last })
    .then(r => r.json()).then(r => { if (r.mtime) remoteMtime = String(r.mtime); }).catch(() => {});
};
async function remotePull() {
  try {
    const r = await (await fetch(remoteUrl() + '&since=' + remoteMtime)).json(), first = !remoteReady;
    remoteReady = true;
    if (r.same || !r.project) return;
    remoteMtime = String(r.mtime);
    if (JSON.stringify(r.project) === last || drag || bdrag) return;
    r.project.layouts = r.project.layouts || {};
    if (first) { setProject(r.project); return; }
    undo.push(last); sch = r.project; sel = null; last = JSON.stringify(sch);   // an outside edit is one undo step
    try { localStorage.setItem(KEY, last); } catch (e) { /* ignore */ }
    refresh();
  } catch (e) { /* server gone: keep working locally */ }
}
function setProject(s) {
  sch = s; sch.layouts = sch.layouts || {}; sel = null; undo.length = redo.length = 0;
  last = JSON.stringify(sch); store(); refresh(); fit();
}
function commit() {                      // call after every change: records undo, autosaves, redraws
  undo.push(last); if (undo.length > 200) undo.shift();
  redo.length = 0; last = JSON.stringify(sch); store(); refresh();
}
function step(from, to) {
  if (!from.length) return;
  to.push(last); last = from.pop(); sch = JSON.parse(last); sel = null; multi = null; store(); refresh();
}
function refresh() {
  renderSch(); renderProps(); renderKnobs(); scheduleSim();
  if (tab === 'bread' || tab === 'strip') renderBoard();
}
const comp = id => sch.comps.find(c => c.id === id);
const selComp = () => (sel && sel.kind === 'c' ? comp(sel.id) : null);
const nextId = () => Math.max(0, ...sch.comps.map(c => c.id), ...sch.wires.map(w => w.id)) + 1;
function nextRef(prefix) { let n = 1; while (sch.comps.some(c => c.ref === prefix + n)) n++; return prefix + n; }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- schematic rendering ----------
function label(c) {
  switch (c.type) {
    case 'R': case 'C': case 'L': return c.ref + ' ' + c.value;
    case 'POT': return (c.label || c.ref) + ' ' + c.value;
    case 'D': case 'NPN': case 'PNP': case 'JFET': case 'NMOS': return c.ref + ' ' + c.model;
    case 'LDR': return c.ref + (c.led && c.led !== '@' ? ' ← ' + c.led : '');
    case 'NE555': return c.ref + ' 555';
    case 'OPA': return c.ref;
    case 'V': return (Schem.parseVal(c.value) >= 0 ? '+' : '') + c.value + 'V';
    case 'IN': return 'IN';
    case 'OUT': return 'OUT';
    case 'NET': return c.name;
  }
  return '';
}
const BOX = { NET: [-9, -18, 18, 22], V: [-12, -30, 24, 34], GND: [-14, -4, 28, 28], IN: [-56, -12, 60, 24], OUT: [-4, -12, 60, 24], OPA: [-62, -38, 124, 76], NE555: [-82, -62, 164, 124] };
const CENTER = new Set(['IN', 'OUT', 'OPA', 'V', 'NE555']);
function compSvg(c, cls) {
  const d = Schem.DEFS[c.type];
  let box = BOX[c.type];
  if (!box) {
    const xs = d.pins.map(p => p[0] * U), ys = d.pins.map(p => p[1] * U);
    box = [Math.min(...xs) - 6, Math.min(...ys) - 14, Math.max(...xs) - Math.min(...xs) + 12, Math.max(...ys) - Math.min(...ys) + 28];
  }
  let h = `<g class="${cls}" data-id="${c.id}"><g transform="translate(${c.x * U} ${c.y * U}) rotate(${(c.rot || 0) * 90}) scale(1 ${c.flip ? -1 : 1})">` +
    `<rect class="hit" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}"/><path class="sym" d="${Schem.symbol(c)}"/>`;
  for (const p of d.pins) h += `<circle class="pin" cx="${p[0] * U}" cy="${p[1] * U}" r="2.5"/>`;
  h += '</g>';
  (d.pinLab || []).forEach((t, i) => {     // pin names inside the box (555)
    const p = d.pins[i], [px, py] = Schem.xform({ x: 0, y: 0, rot: c.rot, flip: c.flip }, [p[0] - Math.sign(p[0]) * 1.9, p[1]]);
    h += `<text class="lab" style="font-size:9px" text-anchor="middle" x="${(c.x + px) * U}" y="${(c.y + py) * U + 3}">${t}</text>`;
  });
  if (d.lab) {
    const [lx, ly] = Schem.xform({ x: 0, y: 0, rot: c.rot, flip: c.flip }, d.lab);
    const anchor = CENTER.has(c.type) ? 'middle' : lx > 0.5 ? 'start' : lx < -0.5 ? 'end' : 'middle';
    h += `<text class="lab" text-anchor="${anchor}" x="${(c.x + lx) * U}" y="${(c.y + ly) * U + 4}">${esc(label(c))}</text>`;
  }
  return h + '</g>';
}
const onWire = (x, y, w) => (w.x2 - w.x1) * (y - w.y1) === (w.y2 - w.y1) * (x - w.x1) &&
  x >= Math.min(w.x1, w.x2) && x <= Math.max(w.x1, w.x2) && y >= Math.min(w.y1, w.y2) && y <= Math.max(w.y1, w.y2);
const isEnd = (x, y, w) => (x === w.x1 && y === w.y1) || (x === w.x2 && y === w.y2);
const elbow = (a, b) => (a[0] === b[0] || a[1] === b[1] ? [a, b] : [a, [b[0], a[1]], b]);

function renderSch() {
  let h = '<rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#grid)"/>';
  const deg = new Map(), bump = (x, y, n) => deg.set(x + ',' + y, (deg.get(x + ',' + y) || 0) + n);
  for (const w of sch.wires) {
    const on = (sel && sel.kind === 'w' && sel.id === w.id) || (multi && multi.w.has(w.id));
    h += `<line class="wire${on ? ' sel' : ''}" x1="${w.x1 * U}" y1="${w.y1 * U}" x2="${w.x2 * U}" y2="${w.y2 * U}"/>`;
    bump(w.x1, w.y1, 1); bump(w.x2, w.y2, 1);
  }
  for (const c of sch.comps) for (const p of Schem.pinPos(c)) bump(p[0], p[1], 1);
  for (const k of [...deg.keys()]) {
    const [x, y] = k.split(',').map(Number);
    for (const w of sch.wires) if (onWire(x, y, w) && !isEnd(x, y, w)) bump(x, y, 2);
    if (deg.get(k) >= 3) h += `<circle class="dot" cx="${x * U}" cy="${y * U}" r="4"/>`;
  }
  for (const c of sch.comps) h += compSvg(c, (sel && sel.kind === 'c' && sel.id === c.id) || (multi && multi.c.has(c.id)) ? 'sel' : '');
  // Click targets, drawn last so they win: wires over part outlines (a wire next to a part must stay selectable), pins over wires.
  for (const w of sch.wires) h += `<line class="wirehit" data-w="${w.id}" x1="${w.x1 * U}" y1="${w.y1 * U}" x2="${w.x2 * U}" y2="${w.y2 * U}"/>`;
  for (const c of sch.comps) for (const p of Schem.pinPos(c)) h += `<circle class="pinhit" data-pin="1" data-id="${c.id}" cx="${p[0] * U}" cy="${p[1] * U}" r="7"/>`;
  for (const [k, n] of deg) if (n === 1) {             // loose wire ends can be picked up like pins
    const [x, y] = k.split(',').map(Number);
    if (sch.wires.some(w => isEnd(x, y, w))) h += `<circle class="pinhit" data-pin="1" cx="${x * U}" cy="${y * U}" r="7"/>`;
  }
  const sc = selComp();
  if (sc && !(drag && drag.c)) {                       // rotate / flip / delete buttons above the selected part
    const ps = Schem.pinPos(sc), top = Math.min(sc.y, ...ps.map(p => p[1])) * U - 42;
    [['r', '⟳', 'Rotate (R, Space or right-click)'], ['f', '⇋', 'Flip (F)'], ['d', '✕', 'Delete (Del)']].forEach(([a, ch, tip], i) => {
      h += `<g class="act" data-act="${a}" transform="translate(${sc.x * U - 33 + i * 23} ${top})"><title>${tip}</title><rect width="20" height="20" rx="4"/><text x="10" y="14.5">${ch}</text></g>`;
    });
  }
  if ($('#showdc').checked && sim.dc && sim.ex) {          // one DC voltage label per net
    const seen = new Set(['0']);
    const pass = want => { for (const c of sch.comps) {
      if (c.type === 'GND' || c.type === 'V' || c.type === 'NET' || want !== /NPN|PNP|JFET|NMOS|NE555|OPA/.test(c.type)) continue;
      for (const p of Schem.pinPos(c)) {
        const net = sim.ex.netAt.get(p[0] + ',' + p[1]), v = sim.dc.get(net);
        if (net == null || seen.has(net) || v == null || v !== v) continue;
        seen.add(net);
        h += `<text class="dcv" x="${p[0] * U + 5}" y="${p[1] * U - 5}">${v.toFixed(2)}V</text>`;
      }
    } };
    pass(true); pass(false);
  }
  if (boxSel) {
    const [a, b] = boxSel;
    h += `<rect class="boxsel" x="${Math.min(a[0], b[0]) * U}" y="${Math.min(a[1], b[1]) * U}" width="${Math.abs(a[0] - b[0]) * U}" height="${Math.abs(a[1] - b[1]) * U}"/>`;
  }
  if (ghost) h += compSvg(ghost, 'ghost');
  if (ghostBlock) {
    for (const c of ghostBlock.comps) h += compSvg(Object.assign({}, c, { id: 0, ref: '', x: c.x + mouse[0], y: c.y + mouse[1] }), 'ghost');
    for (const w of ghostBlock.wires) h += `<line class="wire ghost" x1="${(w.x1 + mouse[0]) * U}" y1="${(w.y1 + mouse[1]) * U}" x2="${(w.x2 + mouse[0]) * U}" y2="${(w.y2 + mouse[1]) * U}"/>`;
  }
  if (wireStart) h += `<polyline class="wire ghost" fill="none" points="${elbow(wireStart, mouse).map(p => p[0] * U + ',' + p[1] * U).join(' ')}"/>`;
  $('#view').innerHTML = h;
}
const applyView = () => $('#view').setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
function fit() {
  const xs = [], ys = [], r = svg.getBoundingClientRect();
  for (const c of sch.comps) for (const p of Schem.pinPos(c)) { xs.push(p[0]); ys.push(p[1]); }
  for (const w of sch.wires) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
  if (!xs.length || !r.width) { view.k = 1; view.x = r.width / 2; view.y = r.height / 2; }
  else {
    const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
    view.k = Math.min(1.6, r.width / ((x1 - x0) * U), r.height / ((y1 - y0) * U));
    view.x = r.width / 2 - (x0 + x1) / 2 * U * view.k; view.y = r.height / 2 - (y0 + y1) / 2 * U * view.k;
  }
  applyView();
}

// ---------- schematic editing ----------
const TOOLS = [['select', 'Select', 'Esc'], ['wire', 'Wire', 'W'], ['erase', 'Erase', 'E'], null, ['R', 'Resistor'], ['C', 'Capacitor'], ['POT', 'Pot'], ['D', 'Diode'],
  ['D:LED blue', 'LED'], ['D:1N4733A', 'Zener'], ['NPN', 'NPN'], ['PNP', 'PNP'], ['JFET', 'JFET'], ['NMOS', 'MOSFET'], ['OPA', 'Op-amp'], ['NE555', '555'], ['LDR', 'LDR'], ['L', 'Inductor'], null, ['V', '+V supply'], ['GND', 'Ground'], ['NET', 'Net label'], ['IN', 'Input'], ['OUT', 'Output']];
$('#palette').innerHTML = TOOLS.map(t => (t ? `<button data-tool="${t[0]}" title="${t[2] || ''}">${t[1]}</button>` : '<hr>')).join('');
$('#palette').innerHTML += `<hr><button id="blocksbtn" class="primary" title="Pre-wired groups of parts (B)">Blocks…</button>`;
$('#palette').addEventListener('click', e => { if (e.target.dataset.tool) setTool(e.target.dataset.tool); });
// Block picker: a pop-up with search, tag filters and a choice of drawn previews or a plain list.
const dlg = $('#blockdlg'), previews = new Map();
let bview = 'grid', btag = '';
try { bview = localStorage.getItem('hibiki.bview') || 'grid'; } catch (e) { /* storage blocked: keep the default */ }
function blockPreview(name) {
  if (previews.has(name)) return previews.get(name);
  const b = Presets.block(name), xs = [], ys = [];
  for (const c of b.comps) for (const p of Schem.pinPos(c)) { xs.push(p[0]); ys.push(p[1]); }
  for (const w of b.wires) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
  const x0 = Math.min(...xs) - 4, y0 = Math.min(...ys) - 3, w = Math.max(...xs) - x0 + 5, h = Math.max(...ys) - y0 + 3;
  const s = `<svg viewBox="${x0 * U} ${y0 * U} ${w * U} ${h * U}">` +
    b.wires.map(l => `<line class="wire" x1="${l.x1 * U}" y1="${l.y1 * U}" x2="${l.x2 * U}" y2="${l.y2 * U}"/>`).join('') +
    b.comps.map(c => compSvg(Object.assign({ id: 0, ref: '' }, c), '')).join('') + '</svg>';
  previews.set(name, s);
  return s;
}
function renderBlocks() {
  const q = $('#bsearch').value.toLowerCase().split(/\s+/).filter(Boolean), count = new Map();
  const all = Presets.blocks.map(n => ({ n, tags: Presets.tags(n) })).sort((a, b) => a.n.localeCompare(b.n));   // by name, so categories sit together
  for (const b of all) for (const t of b.tags) count.set(t, (count.get(t) || 0) + 1);
  const hits = all.filter(b => (!btag || b.tags.includes(btag)) && q.every(w => (b.n + ' ' + b.tags.join(' ')).toLowerCase().includes(w)));
  $('#btags').innerHTML = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, k]) =>
    `<button class="tag${t === btag ? ' on' : ''}" data-tag="${esc(t)}">${esc(t)} <small>${k}</small></button>`).join('');
  const el = $('#blist');
  el.className = bview;
  el.innerHTML = hits.map(b => `<div class="bitem" tabindex="0" data-block="${esc(b.n)}">${bview === 'grid' ? blockPreview(b.n) : ''}<b>${esc(b.n)}</b>` +
    `<span>${b.tags.map(t => `<i>${esc(t)}</i>`).join('')}</span></div>`).join('') || '<p class="hint">No block matches. Clear the search or the tag filter.</p>';
  for (const b of dlg.querySelectorAll('[data-view]')) b.classList.toggle('on', b.dataset.view === bview);
}
function pickBlock(name) {               // the block follows the cursor until it is clicked into place
  dlg.close();
  setTool('select'); tool = 'block'; ghostBlock = Presets.block(name);
  svg.style.cursor = 'crosshair'; renderSch();
}
function openBlocks() { $('#bsearch').value = ''; btag = ''; renderBlocks(); dlg.showModal(); $('#bsearch').focus(); }
$('#blocksbtn').onclick = openBlocks;
$('#bsearch').oninput = renderBlocks;
dlg.addEventListener('click', e => {
  const t = e.target.closest('[data-tag], [data-view], [data-block], #bclose');
  if (e.target === dlg || (t && t.id === 'bclose')) dlg.close();          // a click on the backdrop lands on the dialog itself
  else if (!t) return;
  else if (t.dataset.block) pickBlock(t.dataset.block);
  else if (t.dataset.tag) { btag = btag === t.dataset.tag ? '' : t.dataset.tag; renderBlocks(); }
  else { bview = t.dataset.view; try { localStorage.setItem('hibiki.bview', bview); } catch (err) { /* not remembered, still works */ } renderBlocks(); }
  if (dlg.open) $('#bsearch').focus();   // keep typing (and Enter) working after a tag or view click
});
dlg.addEventListener('keydown', e => {    // Enter takes the focused block, or the first match while typing
  if (e.key !== 'Enter') return;
  const it = e.target.closest('.bitem') || (e.target.id === 'bsearch' && $('#blist .bitem'));
  if (it) { pickBlock(it.dataset.block); e.preventDefault(); }
});
function placeBlock(p) {
  const n0 = sch.comps.length, isLed = c => c.type === 'D' && /LED/.test(c.model);
  for (const c of ghostBlock.comps) {
    const pre = Schem.DEFS[c.type].prefix;
    sch.comps.push(Object.assign({}, c, { id: nextId(), ref: pre ? nextRef(pre) : '', x: c.x + p[0], y: c.y + p[1] }));
  }
  // An LDR marked '@' is lit by the LED in its own block, or else by the LED placed most recently (drop the LFO block first).
  const led = sch.comps.slice(n0).find(isLed) || sch.comps.slice(0, n0).reverse().find(isLed);
  for (const c of sch.comps.slice(n0)) if (c.led === '@') c.led = led ? led.ref : '';
  for (const w of ghostBlock.wires) sch.wires.push({ id: nextId(), x1: w.x1 + p[0], y1: w.y1 + p[1], x2: w.x2 + p[0], y2: w.y2 + p[1] });
  ghostBlock = null; tool = 'select'; svg.style.cursor = 'default';
  commit();
}
function setTool(t) {
  tool = t; wireStart = null; ghostBlock = null; multi = null;
  const [type, model] = t.split(':');
  ghost = Schem.DEFS[type] ? Object.assign({ id: 0, type, ref: '', x: mouse[0], y: mouse[1], rot: 0, flip: false }, Schem.DEFS[type].props, model ? { model } : {}) : null;
  for (const b of document.querySelectorAll('#palette button')) b.classList.toggle('on', b.dataset.tool === t);
  svg.style.cursor = t === 'select' ? 'default' : t === 'erase' ? 'not-allowed' : 'crosshair';
  renderSch();
}
function gridAt(e) {
  const r = svg.getBoundingClientRect();
  return [Math.round((e.clientX - r.left - view.x) / view.k / U), Math.round((e.clientY - r.top - view.y) / view.k / U)];
}
function fracAt(e) {                     // pointer position in grid units, not snapped
  const r = svg.getBoundingClientRect();
  return [(e.clientX - r.left - view.x) / view.k / U, (e.clientY - r.top - view.y) / view.k / U];
}
function eraseAt(e) {                    // eraser: removes the part or wire under the pointer
  const el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest('#sch [data-id]'), w = el && el.closest('#sch [data-w]');
  if (g) sch.comps = sch.comps.filter(c => c.id !== +g.dataset.id);
  else if (w) sch.wires = sch.wires.filter(x => x.id !== +w.dataset.w);
  else return;
  sel = null; drag.moved = true; renderSch();
}
function wireClick(p) {
  if (!wireStart) { wireStart = p; return; }
  const a = wireStart;
  if (a[0] === p[0] && a[1] === p[1]) { wireStart = null; renderSch(); return; }
  const lands = sch.wires.some(w => onWire(p[0], p[1], w)) || sch.comps.some(c => Schem.pinPos(c).some(q => q[0] === p[0] && q[1] === p[1]));
  const pts = elbow(a, p);
  for (let i = 1; i < pts.length; i++) sch.wires.push({ id: nextId(), x1: pts[i - 1][0], y1: pts[i - 1][1], x2: pts[i][0], y2: pts[i][1] });
  wireStart = lands ? null : p;          // keep drawing until the wire lands on a pin or another wire
  commit();
}
svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture(e.pointerId);
  const p = mouse = gridAt(e);
  if (e.button !== 0) {                  // right/middle drag pans; a right-click without moving rotates (see pointerup)
    const g = e.target.closest('[data-id]');
    drag = { pan: [e.clientX, e.clientY], rc: e.button === 2 ? [e.clientX, e.clientY] : null, id: g ? +g.dataset.id : 0 };
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act) { if (act.dataset.act === 'd') del(); else turn(act.dataset.act); return; }
  if (ghostBlock) { placeBlock(p); return; }
  if (ghost) {
    const pre = Schem.DEFS[ghost.type].prefix;
    sch.comps.push(Object.assign({}, ghost, { id: nextId(), ref: pre ? nextRef(pre) : '', x: p[0], y: p[1] }));
    commit(); return;
  }
  if (tool === 'erase') { drag = { erase: true, moved: false }; eraseAt(e); return; }   // click or drag across things to delete them
  if (tool === 'wire' || wireStart) { wireClick(p); return; }
  if (e.target.dataset.pin) {            // pressing a pin or a loose wire end starts a wire, no Wire tool needed
    wireStart = p; drag = { wire: p }; renderSch(); return;
  }
  const g = e.target.closest('[data-id]'), w = e.target.closest('[data-w]');
  if (multi && ((g && multi.c.has(+g.dataset.id)) || (w && multi.w.has(+w.dataset.w)))) { drag = { group: p, moved: false }; return; }   // drag the whole selection
  multi = null;
  if (g) { const c = comp(+g.dataset.id); sel = { kind: 'c', id: c.id }; drag = { c, from: p, ox: c.x, oy: c.y, moved: false }; }
  else if (w) sel = { kind: 'w', id: +w.dataset.w };
  else { sel = null; drag = { box: fracAt(e) }; }      // empty background: start a selection box
  renderSch(); renderProps();
});
svg.addEventListener('pointermove', e => {
  mouse = gridAt(e);
  if (drag && drag.pan) { view.x += e.clientX - drag.pan[0]; view.y += e.clientY - drag.pan[1]; drag.pan = [e.clientX, e.clientY]; applyView(); }
  else if (drag && drag.erase) eraseAt(e);
  else if (drag && drag.box) { boxSel = [drag.box, fracAt(e)]; renderSch(); }
  else if (drag && drag.group) {
    const dx = mouse[0] - drag.group[0], dy = mouse[1] - drag.group[1];
    if (dx || dy) {
      for (const c of sch.comps) if (multi.c.has(c.id)) { c.x += dx; c.y += dy; }
      for (const w of sch.wires) if (multi.w.has(w.id)) { w.x1 += dx; w.x2 += dx; w.y1 += dy; w.y2 += dy; }
      drag.group = mouse; drag.moved = true; renderSch();
    }
  } else if (drag && drag.c) {
    const nx = drag.ox + mouse[0] - drag.from[0], ny = drag.oy + mouse[1] - drag.from[1];
    if (nx !== drag.c.x || ny !== drag.c.y) { drag.c.x = nx; drag.c.y = ny; drag.moved = true; renderSch(); }
  } else if (ghost) { ghost.x = mouse[0]; ghost.y = mouse[1]; renderSch(); }
  else if (wireStart || ghostBlock) renderSch();
});
svg.addEventListener('pointerup', e => {
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.box) {                            // finish the selection box: parts whose centre is inside, wires with both ends inside
    if (boxSel) {
      const [a, b] = boxSel, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const cs = sch.comps.filter(c => inside(c.x, c.y)), ws = sch.wires.filter(w => inside(w.x1, w.y1) && inside(w.x2, w.y2));
      if (cs.length === 1 && !ws.length) sel = { kind: 'c', id: cs[0].id };
      else if (cs.length + ws.length) multi = { c: new Set(cs.map(c => c.id)), w: new Set(ws.map(w => w.id)) };
    }
    boxSel = null; renderSch(); renderProps(); return;
  }
  if (d.moved) commit();
  else if (d.wire && wireStart && (mouse[0] !== d.wire[0] || mouse[1] !== d.wire[1])) wireClick(mouse);   // dragged from a pin: finish the wire here
  else if (d.rc && Math.hypot(e.clientX - d.rc[0], e.clientY - d.rc[1]) < 5) {   // right-click
    if (ghost || ghostBlock) turn('r');
    else if (wireStart) { wireStart = null; renderSch(); }
    else if (tool !== 'select') setTool('select');
    else if (d.id) { sel = { kind: 'c', id: d.id }; turn('r'); }
  } else if (sel && sel.kind === 'c') renderSch();       // bring the on-canvas buttons back after a drag
});
svg.addEventListener('contextmenu', e => e.preventDefault());
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const k = clamp(view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.25, 4);
  view.x = mx - (mx - view.x) * k / view.k; view.y = my - (my - view.y) * k / view.k; view.k = k;
  applyView();
}, { passive: false });
function del() {
  if (multi) {
    sch.comps = sch.comps.filter(c => !multi.c.has(c.id)); sch.wires = sch.wires.filter(w => !multi.w.has(w.id));
    multi = null; commit(); return;
  }
  if (!sel) return;
  if (sel.kind === 'c') sch.comps = sch.comps.filter(c => c.id !== sel.id); else sch.wires = sch.wires.filter(w => w.id !== sel.id);
  sel = null; commit();
}
function turn(k) {
  if (ghostBlock) {                       // a block being placed rotates as a whole
    if (k !== 'r') return;
    for (const c of ghostBlock.comps) { [c.x, c.y] = [-c.y, c.x]; c.rot = ((c.rot || 0) + 1) % 4; }
    for (const w of ghostBlock.wires) { [w.x1, w.y1, w.x2, w.y2] = [-w.y1, w.x1, -w.y2, w.x2]; }
    renderSch(); return;
  }
  if (multi && !ghost) {                  // a box selection rotates about its middle
    if (k !== 'r') return;
    const cs = sch.comps.filter(c => multi.c.has(c.id)), ws = sch.wires.filter(w => multi.w.has(w.id));
    const xs = [...cs.map(c => c.x), ...ws.flatMap(w => [w.x1, w.x2])], ys = [...cs.map(c => c.y), ...ws.flatMap(w => [w.y1, w.y2])];
    const px = Math.round((Math.min(...xs) + Math.max(...xs)) / 2), py = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
    const rot = (x, y) => [px - (y - py), py + (x - px)];
    for (const c of cs) { [c.x, c.y] = rot(c.x, c.y); c.rot = ((c.rot || 0) + 1) % 4; }
    for (const w of ws) { [w.x1, w.y1] = rot(w.x1, w.y1); [w.x2, w.y2] = rot(w.x2, w.y2); }
    commit(); return;
  }
  const c = ghost || selComp();
  if (!c) return;
  if (k === 'r') c.rot = ((c.rot || 0) + 1) % 4; else c.flip = !c.flip;
  if (ghost) renderSch(); else commit();
}
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || dlg.open) return;
  const k = e.key.toLowerCase();
  if (k === 'b' && !e.ctrlKey && tab === 'sch') { openBlocks(); e.preventDefault(); return; }
  if (e.ctrlKey && k === 'z') { step(undo, redo); e.preventDefault(); }
  else if (e.ctrlKey && k === 'y') { step(redo, undo); e.preventDefault(); }
  else if (e.ctrlKey && k === 'a' && tab === 'sch') {
    multi = { c: new Set(sch.comps.map(c => c.id)), w: new Set(sch.wires.map(w => w.id)) }; sel = null; renderSch(); renderProps(); e.preventDefault();
  } else if (tab !== 'sch' || e.ctrlKey) return;
  else if (k === 'escape') setTool('select');
  else if (k === 'w') setTool('wire');
  else if (k === 'e') setTool('erase');
  else if (k === 'r' || k === 'f') turn(k);
  else if (k === ' ') { turn('r'); e.preventDefault(); }
  else if (k === 'delete' || k === 'backspace') del();
});

// ---------- properties and knobs ----------
function renderProps() {
  const el = $('#props'), c = selComp();
  if (!c) {
    el.innerHTML = `<h3>Project</h3><div class="row"><span>Name</span><input data-proj="name" value="${esc(sch.name || '')}"></div>` +
      `<p class="hint">${esc(sch.about || '')}</p><p class="hint">Pick a part on the left, click to place. <b>Wire:</b> click (or drag from) any pin or loose wire end; ` +
      `<kbd>W</kbd> starts a wire anywhere. <b>Rotate:</b> right-click, <kbd>R</kbd> or <kbd>Space</kbd>, also while placing or dragging; <kbd>F</kbd> flips. ` +
      `<b>Erase:</b> <kbd>E</kbd>, then click or drag across parts and wires; <kbd>Del</kbd> deletes the selection. <kbd>Esc</kbd> cancel. ` +
      `<b>Move several:</b> drag a box on the background (or <kbd>Ctrl+A</kbd>), then drag the selection; <kbd>R</kbd> rotates it, <kbd>Del</kbd> deletes it. ` +
      `Wheel zooms, right-drag pans. A wire that ends on another wire makes a junction; plain crossings do not connect.</p>`;
    return;
  }
  const F = [], S = Sim;
  let hint = '';
  if (Schem.DEFS[c.type].prefix) F.push(['Ref', 'ref']);
  switch (c.type) {
    case 'R': F.push(['Value', 'value']); hint = 'Ohms: 470, 10k, 4k7, 1M'; break;
    case 'C': F.push(['Value', 'value']); hint = 'Farads: 100p, 47n, 2.2u. 1u and up is treated as electrolytic (+ on the marked side).'; break;
    case 'L': F.push(['Value', 'value']); hint = 'Henries: 500m'; break;
    case 'POT': F.push(['Name', 'label'], ['Value', 'value'], ['Taper', 'taper', ['lin', 'log', 'rev']]); hint = 'Lug 1 is the counter-clockwise end, the arrow is the wiper. Turn it in the Knobs panel.'; break;
    case 'D': F.push(['Model', 'model', Object.keys(S.DIODES)]); hint = 'Zeners: 1N4728A 3.3 V, 1N4733A 5.1 V, 1N4739A 9.1 V, 1N4742A 12 V. The bar is the cathode.'; break;
    case 'NPN': case 'PNP': F.push(['Model', 'model', Object.keys(S.BJTS).filter(m => S.BJTS[m].pnp === (c.type === 'PNP'))], ['hFE', 'hfe']); hint = 'hFE blank = typical for the model. Set your measured gain to see the real bias.'; break;
    case 'JFET': F.push(['Model', 'model', Object.keys(S.JFETS)]); break;
    case 'NMOS': F.push(['Model', 'model', Object.keys(S.MOSFETS)]); hint = 'N-channel. Pins: drain (top), gate, source. Threshold is typical; real parts vary by about a volt.'; break;
    case 'LDR': F.push(['Dark R', 'dark'], ['Lit R', 'lit'], ['Light 0..1', 'light'], ['Lit by LED', 'led']); hint = 'Light sets the resistance between Dark R (0) and Lit R (1). Or type the ref of an LED in this circuit (for example D1) in "Lit by LED": the LDR then follows that LED, reaching Lit R at 20 mA, with the slow response of a real cell. Measure your own LDR and LED pair and enter its two resistances.'; break;
    case 'NE555': hint = 'Powered from the highest supply and ground, reset tied high (pins not drawn). TR trigger (pin 2), TH threshold (6), DIS discharge (7), OUT (3), CV control (5, may be left open). Astable: supply - RA - DIS - RB - TH+TR - C - ground; f = 1.44 / ((RA + 2 RB) C).'; break;
    case 'OPA': F.push(['Model', 'model', Object.keys(S.OPAMPS)]); hint = 'Powered from the highest supply and ground (pins not drawn). Output clips near the rails.'; break;
    case 'V': F.push(['Volts', 'value']); break;
    case 'NET': F.push(['Name', 'name']); hint = 'Every label with the same name is one net, as if wired together. Handy for VREF, the supply, or long runs.'; break;
    case 'IN': F.push(['Source R', 'rs'], ['Source L', 'ls']); hint = 'Signal source impedance. 0 = ideal. A passive pickup is roughly 7k and 2.5 (henries).'; break;
    case 'OUT': F.push(['Load R', 'rload']); hint = 'What the pedal drives: an amp input is about 1M.'; break;
  }
  el.innerHTML = `<h3>${Schem.DEFS[c.type].name}</h3>` + F.map(([lab, k, opts]) => `<div class="row"><span>${lab}</span>` + (opts
    ? `<select data-k="${k}">${opts.map(o => `<option${o === c[k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input data-k="${k}" value="${esc(c[k] == null ? '' : c[k])}">`) + '</div>').join('') +
    `<div class="row"><button data-act="r">Rotate</button><button data-act="f">Flip</button><button data-act="d">Delete</button></div><p class="hint">${hint}</p>`;
}
$('#props').addEventListener('change', e => {
  const c = selComp(), d = e.target.dataset;
  if (d.proj) sch[d.proj] = e.target.value; else if (d.k && c) c[d.k] = e.target.value.trim(); else return;
  commit();
});
$('#props').addEventListener('click', e => { const a = e.target.dataset.act; if (a === 'd') del(); else if (a) turn(a); });
function renderKnobs() {
  const pots = sch.comps.filter(c => c.type === 'POT');
  $('#knobs').innerHTML = pots.length ? pots.map(c => `<div class="row"><span>${esc(c.label || c.ref)}</span>` +
    `<input type="range" min="0" max="1" step="0.01" value="${c.pos}" data-id="${c.id}"><b>${(c.pos * 10).toFixed(1)}</b></div>`).join('') : '<p class="hint">No pots in this circuit.</p>';
}
$('#knobs').addEventListener('input', e => {
  const c = comp(+e.target.dataset.id);
  c.pos = +e.target.value; e.target.nextSibling.textContent = (c.pos * 10).toFixed(1); scheduleSim();
});
$('#knobs').addEventListener('change', commit);

// ---------- canvas helpers ----------
function prep(cv) {
  const d = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * d; cv.height = h * d;
  const g = cv.getContext('2d');
  g.scale(d, d); g.lineWidth = 1.2; g.font = '11px system-ui, sans-serif';
  return [g, w, h];
}
// draws samples a..b of data across width w; min/max per pixel when zoomed out
function trace(g, data, a, b, w, mid, scale, color) {
  const n = b - a;
  g.strokeStyle = color; g.beginPath();
  if (n <= w * 2) for (let i = 0; i < n; i++) { const x = i / Math.max(1, n - 1) * w, y = mid - data[a + i] * scale; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  else for (let px = 0; px < w; px++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = a + Math.floor(px * n / w), e = a + Math.floor((px + 1) * n / w); i < e; i++) { const v = data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    g.moveTo(px + 0.5, mid - hi * scale - 0.5); g.lineTo(px + 0.5, mid - lo * scale + 0.5);
  }
  g.stroke();
}
const peakOf = a => { let m = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
const db = x => (20 * Math.log10(x)).toFixed(1);

// ---------- live scope: DC operating point + a short sine test on every change ----------
let simTimer = 0;
function scheduleSim() { clearTimeout(simTimer); simTimer = setTimeout(liveSim, 120); }
function liveSim() {
  const ex = Schem.extract(sch), msgs = ex.warnings.map(w => `<div class="bad">${esc(w)}</div>`);
  sim = { ex, dc: null };
  const [g, w, h] = prep($('#scope'));
  let info = '';
  try {
    const c = new Sim.Circuit(Schem.toSim(ex)), fs = 96000, f = clamp(+$('#freq').value || 220, 20, 10000), amp = +$('#amp').value || 0.2;
    const ok = c.start(fs);
    if (c.error) msgs.push(`<div class="bad">${esc(c.error)}</div>`);
    sim.dc = new Map([...c.nodes.keys()].map(n => [n, c.voltage(n)]));
    if (ok && w) {
      const per = fs / f, n = Math.round(Math.ceil(Math.max(0.05 * f, 8)) * per), show = Math.round(2 * per);
      const vi = new Float32Array(n), vo = new Float32Array(n);
      for (let i = 0; i < n; i++) vi[i] = amp * Math.sin(2 * Math.PI * f * i / fs);
      c.process(vi, vo, 1, 0, n);
      const a = n - show, tail = vo.subarray(a);
      let mean = 0, hi = -Infinity, lo = Infinity;
      for (const v of tail) { mean += v / show; if (v > hi) hi = v; if (v < lo) lo = v; }
      for (let i = a; i < n; i++) vo[i] -= mean;
      const scale = (h / 2 - 8) / Math.max(amp, hi - mean, mean - lo, 1e-6);
      g.strokeStyle = '#2e333d'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      trace(g, vi, a, n, w, h / 2, scale, CIN); trace(g, vo, a, n, w, h / 2, scale, COUT);
      const gain = (hi - lo) / (2 * amp);
      info = `<div><span style="color:${CIN}">in</span> ±${amp} V, <span style="color:${COUT}">out</span> +${(hi - mean).toFixed(3)} / −${(mean - lo).toFixed(3)} V` +
        (Math.abs(mean) > 0.01 ? ` (on ${mean.toFixed(2)} V DC)` : '') + `<br>gain ×${gain.toFixed(2)} (${gain > 0 ? db(gain) : '−∞'} dB)</div>`;
      if (c.failed) msgs.push(`<div class="bad">Solver did not converge on ${c.failed} steps: results may be off.</div>`);
    }
  } catch (err) { msgs.push(`<div class="bad">${esc(err.message)}</div>`); }
  $('#status').innerHTML = msgs.join('') + info;
  renderSch();
}
$('#freq').addEventListener('change', liveSim); $('#amp').addEventListener('change', liveSim); $('#showdc').addEventListener('change', renderSch);

// ---------- test bench: run an audio clip through the circuit ----------
const bench = { fs: 44100, src: null, name: '', inp: null, out: null, z: [0, 0], run: 0, node: null, t0: 0, peakV: 0.2, pkI: 1, pkO: 1 };
let actx = null;
const audio = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());
function setSource(data, fs, name) {
  stop();
  Object.assign(bench, { src: data, fs, name, inp: null, out: null, run: bench.run + 1 });
  $('#srcName').textContent = `${name}: ${(data.length / fs).toFixed(1)} s, ${fs} Hz`;
  $('#t0').value = 0; $('#benchMsg').textContent = ''; $('#prog').value = 0;
  drawBench();
}
function demoRiff() {                    // Karplus-Strong plucked strings: a stand-in for a clean guitar DI track
  const fs = 44100, len = fs * 8, out = new Float32Array(len);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const pluck = (f, t, dur, amp) => {
    const N = Math.round(fs / f), buf = new Float32Array(N), s = Math.round(t * fs), n = Math.round(dur * fs);
    let p = 0;
    for (let i = 0; i < N; i++) buf[i] = rnd();
    for (let k = 0; k < 6; k++) for (let i = 0; i < N; i++) buf[i] = p = 0.5 * (p + buf[i]);   // darken the pluck
    for (let i = 0; i < n && s + i < len; i++) { const j = i % N; out[s + i] += amp * buf[j] * Math.min(1, (n - i) / 900); buf[j] = 0.4985 * (buf[j] + buf[(j + 1) % N]); }
  };
  const E = 82.41, seq = [E, E * 2, 98, 110, E, 146.83, 123.47, 110, E, E * 2, 98, 110, 146.83, 164.81, 146.83, 123.47];
  seq.forEach((f, i) => pluck(f, i * 0.25, 0.7, 0.6));
  for (const f of [E, 123.47, 164.81]) pluck(f, 4.2, 3.8, 0.5);
  const pk = peakOf(out);
  for (let i = 0; i < len; i++) out[i] *= 0.95 / pk;
  setSource(out, fs, 'Demo riff');
}
$('#demo').onclick = demoRiff;
$('#loadAudio').onclick = () => $('#audioFile').click();
$('#audioFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const buf = await audio().decodeAudioData(await f.arrayBuffer()), mono = new Float32Array(buf.length);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels; }
    setSource(mono, buf.sampleRate, f.name);
  } catch (err) { $('#benchMsg').textContent = 'Could not decode that file: ' + err.message; }
  e.target.value = '';
};
$('#run').onclick = async () => {
  if (!bench.src) demoRiff();
  stop();
  const id = ++bench.run, os = +$('#os').value, fs = bench.fs, msg = $('#benchMsg');
  const ex = Schem.extract(sch), c = new Sim.Circuit(Schem.toSim(ex));
  if (!c.start(fs * os)) { msg.textContent = c.error || 'Nothing to simulate: draw a circuit first.'; return; }
  if (c.out < -1) { msg.textContent = 'The circuit has no OUT jack.'; return; }
  const a = clamp(Math.floor((+$('#t0').value || 0) * fs), 0, bench.src.length - 1), n = Math.min(Math.floor((+$('#tlen').value || 8) * fs), bench.src.length - a);
  const peakV = +$('#peak').value || 0.2, inp = new Float32Array(n), out = new Float32Array(n), t0 = performance.now();
  for (let i = 0; i < n; i++) inp[i] = bench.src[a + i] * peakV;
  msg.textContent = 'Simulating…';
  for (let i = 0; i < n;) {              // main thread, in slices, so the page stays responsive
    const t = performance.now();
    while (i < n && performance.now() - t < 40) { const j = Math.min(n, i + 512); c.process(inp, out, os, i, j); i = j; }
    $('#prog').value = i / n;
    await new Promise(r => setTimeout(r));
    if (id !== bench.run) return;
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i] / n;
  for (let i = 0; i < n; i++) out[i] -= mean;
  Object.assign(bench, { inp, out, z: [0, n], peakV, pkI: peakOf(inp) || 1, pkO: peakOf(out) || 1 });
  const secs = (performance.now() - t0) / 1000;
  msg.textContent = `Done in ${secs.toFixed(1)} s (${(secs / (n / fs)).toFixed(1)}× real time). Output peak ±${bench.pkO.toFixed(3)} V` +
    (c.failed ? `. Solver did not converge on ${c.failed} of ${n * os} steps.` : '.');
  drawBench();
};

function drawBench() {
  if (tab !== 'bench') return;
  const [g, w, h] = prep($('#ov')), A = bench.inp || bench.src;
  g.fillStyle = '#8b93a3';
  if (!A) g.fillText('Load an audio file (a clean guitar recording works best) or use the demo riff, then press Run.', 12, 24);
  else {
    trace(g, A, 0, A.length, w, bench.out ? h * 0.26 : h / 2, h * 0.22 / (peakOf(A) || 1), CIN);
    if (bench.out) {
      trace(g, bench.out, 0, A.length, w, h * 0.74, h * 0.22 / bench.pkO, COUT);
      g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(bench.z[0] / A.length * w, 0, (bench.z[1] - bench.z[0]) / A.length * w, h);
    } else g.fillText('Not processed yet: press Run.', 12, 16);
  }
  drawZoom(); drawSpec();
}
function drawZoom() {
  const [g, w, h] = prep($('#zoom'));
  if (!bench.out) return;
  const [a, b] = bench.z, s = (h / 2 - 16);
  g.strokeStyle = '#2e333d'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  trace(g, bench.inp, a, b, w, h / 2, s / bench.pkI, CIN); trace(g, bench.out, a, b, w, h / 2, s / bench.pkO, COUT);
  g.fillStyle = '#8b93a3';
  g.fillText(`${(a / bench.fs).toFixed(3)} to ${(b / bench.fs).toFixed(3)} s   |   full height: input ±${bench.pkI.toFixed(3)} V, output ±${bench.pkO.toFixed(3)} V (each scaled to its own peak)`, 10, 14);
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function drawSpec() {
  const [g, w, h] = prep($('#spec'));
  if (!bench.out) return;
  const [a, b] = bench.z;
  let N = 256;
  while (N * 2 <= Math.min(b - a, 32768)) N *= 2;
  g.fillStyle = '#8b93a3';
  if (b - a < N) { g.fillText('Zoom out a little to see the spectrum.', 10, 14); return; }
  const spec = data => {
    const re = new Float64Array(N), im = new Float64Array(N), m = new Float32Array(N / 2);
    for (let i = 0; i < N; i++) re[i] = data[a + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) m[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) * 4 / N + 1e-12);
    return m;
  };
  const si = spec(bench.inp), so = spec(bench.out), top = Math.ceil(Math.max(peakOf2(si), peakOf2(so)) / 10) * 10 + 5, span = 90;
  const f0 = 40, f1 = Math.min(20000, bench.fs / 2), fx = f => Math.log(f / f0) / Math.log(f1 / f0) * w, dy = v => (top - v) / span * h;
  g.strokeStyle = '#2e333d'; g.beginPath();
  for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) { g.moveTo(fx(f), 0); g.lineTo(fx(f), h); g.fillText(f >= 1000 ? f / 1000 + 'k' : f, fx(f) + 3, h - 5); }
  for (let v = top - 5; v > top - span; v -= 20) { g.moveTo(0, dy(v)); g.lineTo(w, dy(v)); g.fillText(v + ' dBV', 4, dy(v) - 3); }
  g.stroke();
  for (const [m, col] of [[si, CIN], [so, COUT]]) {
    g.strokeStyle = col; g.beginPath();
    let lastX = -1, best = -Infinity, started = false;
    for (let k = 1; k < N / 2; k++) {
      const f = k * bench.fs / N;
      if (f < f0 || f > f1) continue;
      const x = Math.floor(fx(f));
      if (x !== lastX && lastX >= 0) { if (started) g.lineTo(lastX, dy(best)); else { g.moveTo(lastX, dy(best)); started = true; } best = -Infinity; }
      lastX = x; if (m[k] > best) best = m[k];
    }
    g.stroke();
  }
  g.fillText(`Spectrum of the first ${N} samples of the view`, w - 250, 14);
}
const peakOf2 = a => { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };

// overview: drag to pick the zoom window; detail view: wheel to zoom
{
  const ov = $('#ov'), at = e => clamp((e.clientX - ov.getBoundingClientRect().left) / ov.clientWidth, 0, 1);
  let from = null;
  ov.addEventListener('pointerdown', e => { if (bench.out) { from = at(e); ov.setPointerCapture(e.pointerId); } });
  ov.addEventListener('pointermove', e => {
    if (from == null) return;
    const n = bench.out.length, t = at(e), a = Math.floor(Math.min(from, t) * n), b = Math.ceil(Math.max(from, t) * n);
    bench.z = b - a < 64 ? [clamp(a - Math.round(0.02 * bench.fs), 0, n), clamp(a + Math.round(0.02 * bench.fs), 0, n)] : [a, b];
    drawBench();
  });
  ov.addEventListener('pointerup', () => { from = null; });
  ov.addEventListener('dblclick', () => { if (bench.out) { bench.z = [0, bench.out.length]; drawBench(); } });
  $('#zoom').addEventListener('wheel', e => {
    if (!bench.out) return;
    e.preventDefault();
    const cv = $('#zoom'), t = clamp((e.clientX - cv.getBoundingClientRect().left) / cv.clientWidth, 0, 1), n = bench.out.length;
    const [a, b] = bench.z, len = clamp(Math.round((b - a) * (e.deltaY < 0 ? 0.7 : 1 / 0.7)), 64, n), c = a + t * (b - a);
    const na = clamp(Math.round(c - t * len), 0, n - len);
    bench.z = [na, na + len]; drawBench();
  }, { passive: false });
}

// playback
function rendered(wet) {                 // samples scaled for listening, -1..1
  const n = bench.inp.length, d = new Float32Array(n);
  if (!wet) { for (let i = 0; i < n; i++) d[i] = bench.inp[i] / bench.peakV; return d; }
  let g = 1 / bench.peakV;
  if ($('#match').checked) {
    let si = 0, so = 0;
    for (let i = 0; i < n; i++) { si += bench.inp[i] * bench.inp[i]; so += bench.out[i] * bench.out[i]; }
    if (so > 0) g = Math.sqrt(si / so) / bench.peakV;
  }
  g = Math.min(g, 0.98 / bench.pkO);     // never clip the playback itself
  for (let i = 0; i < n; i++) d[i] = bench.out[i] * g;
  return d;
}
function stop() {
  if (bench.node) { try { bench.node.stop(); } catch (e) { /* already ended */ } bench.node = null; }
  $('#playhead').style.display = 'none';
}
function play(wet) {
  stop();
  if (!bench.out) { $('#benchMsg').textContent = 'Run the simulation first.'; return; }
  const ctx = audio(), d = rendered(wet), buf = ctx.createBuffer(1, d.length, bench.fs), node = ctx.createBufferSource();
  buf.copyToChannel(d, 0); node.buffer = buf; node.connect(ctx.destination);
  ctx.resume(); node.start(); bench.node = node; bench.t0 = ctx.currentTime;
  node.onended = () => { if (bench.node === node) stop(); };
  const tick = () => {
    if (bench.node !== node) return;
    const ph = $('#playhead');
    ph.style.display = 'block'; ph.style.left = clamp((ctx.currentTime - bench.t0) / buf.duration, 0, 1) * $('#ov').clientWidth + 'px';
    requestAnimationFrame(tick);
  };
  tick();
}
$('#playDry').onclick = () => play(false); $('#playWet').onclick = () => play(true); $('#stop').onclick = stop;
$('#wav').onclick = () => {
  if (!bench.out) { $('#benchMsg').textContent = 'Run the simulation first.'; return; }
  const d = rendered(true), n = d.length, b = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, t) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, bench.fs, true); b.setUint32(28, bench.fs * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, clamp(d[i], -1, 1) * 32767, true);
  download(new Blob([b], { type: 'audio/wav' }), (sch.name || 'pedal') + '.wav');
};

// ---------- board layouts ----------
const NETCOL = ['#2e7dd1', '#2aa84a', '#e08a1e', '#8a4fd1', '#d1489b', '#1aa3a3', '#9a8a10', '#7a5a3a'];
const BAND = ['#111', '#7a4a1e', '#d22', '#f80', '#eed202', '#2a2', '#22d', '#92c', '#888', '#fff'];
const LEDCOL = { red: '#e33', orange: '#f80', yellow: '#ec0', green: '#3b3', blue: '#36f', white: '#f4f4f4' };
let cur = null;                          // what is on screen: { L, parts, vcc, G }
const bsvg = $('#board');
function netColor(net, vcc) {
  if (net == null) return '#8d8d8d';
  if (net === '0') return '#1c1c1c';
  if (net === vcc) return '#d92b2b';
  let h = 0;
  for (const ch of net) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NETCOL[h % NETCOL.length];
}
function bands(ohm) {                    // resistor colour code: two digits, multiplier, gold tolerance
  if (!(ohm >= 1)) return [];
  let e = Math.floor(Math.log10(ohm)) - 1, m = Math.round(ohm / 10 ** e);
  if (m >= 100) { m = Math.round(m / 10); e++; }
  return [BAND[Math.floor(m / 10)], BAND[m % 10], e >= 0 ? BAND[e] : '#c9a227', '#c9a227'];
}
function boardState() {
  const ex = Schem.extract(sch), { parts, vcc } = Schem.toParts(ex);
  const sig = JSON.stringify(parts.map(p => [p.ref, p.kind, p.nets || p.pins.map(q => q.net)]));
  let e = sch.layouts[boardKind];
  if (!e || e.sig !== sig) {             // connectivity changed (or first time): lay it out again
    e = sch.layouts[boardKind] = { sig, L: Layout.auto(boardKind, parts, vcc) };
    last = JSON.stringify(sch); store();
  }
  return { L: e.L, parts, vcc };
}
function geom(L) {
  const P = 22, room = new Map();          // label length per board edge, to size the margins
  for (const o of L.off) for (const q of o.pins) {
    const far = L.kind === 'bread' ? q.at[1] > 6 : q.at[0] >= L.cols / 2, k = (far ? 'b' : 'a') + (L.kind === 'bread' ? q.at[0] : q.at[1]);
    room.set(k, (room.get(k) || 0) + q.name.length + 2);
  }
  const need = side => 34 + 5.6 * Math.max(0, ...[...room].filter(e => e[0][0] === side).map(e => e[1]));
  if (L.kind === 'bread') {
    const OY = Math.max(60, need('a') + 22), ys = [0, 22, 66, 88, 110, 132, 154, 198, 220, 242, 264, 286, 330, 352].map(v => v + OY);
    const GAP = 40, nb = Math.ceil(L.cols / Layout.BOARD);     // boards side by side, with a gap between them
    return { P, nb, hx: x => 40 + x * P + Math.floor(x / Layout.BOARD) * GAP, hy: y => ys[y], W: 80 + (L.cols - 1) * P + (nb - 1) * GAP, H: OY + 352 + Math.max(60, need('b') + 22), bx: 18, by: OY - 22, bw: 44 + (L.cols - 1) * P, bh: 396 };
  }
  const ML = Math.max(44, need('a') + 18);
  return { P, hx: x => ML + x * P, hy: y => 44 + y * P, W: ML + (L.cols - 1) * P + Math.max(44, need('b') + 18), H: 88 + (L.rows - 1) * P, bx: ML - 18, by: 26, bw: 36 + (L.cols - 1) * P, bh: 36 + (L.rows - 1) * P };
}
function partSvg(p, src, G) {
  const pts = p.pins.map(h => [G.hx(h[0]), G.hy(h[1])]), lab = src ? src.label : p.label, style = src ? src.style : p.style;
  const txt = (x, y, s, anchor = 'middle', extra = '') => `<text x="${x}" y="${y}" font-size="9" text-anchor="${anchor}" fill="#111" stroke="#fff" stroke-width="2.5" paint-order="stroke" ${extra}>${esc(s)}</text>`;
  if (p.kind === 'two') {
    const [a, b] = pts, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI, len = Math.max(14, Math.min(d - 10, 40));
    let body;
    if (style === 'res') body = `<rect x="${-len / 2}" y="-6" width="${len}" height="12" rx="5" fill="#dcc08e" stroke="#8a6a3a"/>` +
      bands(Schem.parseVal(lab)).map((c, i) => `<rect x="${-len / 2 + 4 + i * (len - 11) / 3}" y="-6" width="3" height="12" fill="${c}"/>`).join('');
    else if (style === 'ind') body = `<rect x="${-len / 2}" y="-6" width="${len}" height="12" rx="5" fill="#3f7f4f" stroke="#1f4f2f"/>`;
    else if (style === 'diode') body = `<rect x="${-len / 2}" y="-5" width="${len}" height="10" rx="2" fill="#222"/><rect x="${len / 2 - 7}" y="-5" width="4" height="10" fill="#ddd"/>`;
    else if (style === 'led') body = `<circle r="8" fill="${LEDCOL[(/LED (\w+)/.exec(lab) || [])[1]] || '#e33'}" stroke="#333"/><path d="M5 -6.2V6.2" stroke="#333" stroke-width="2"/>`;
    else if (style === 'ldr') body = '<circle r="8" fill="#e9dfc4" stroke="#8a6a3a"/><path d="M-5 -4h10v2.7h-10v2.6h10v2.7h-10" fill="none" stroke="#b5432a"/>';
    else if (style === 'elec') body = '<circle r="11" fill="#27408b" stroke="#111"/><path d="M4.5 -10A11 11 0 0 1 4.5 10Z" fill="#cfd3e6"/><text x="-6" y="4" font-size="12" text-anchor="middle" fill="#fff">+</text>';
    else body = '<ellipse rx="9" ry="6.5" fill="#e3a12f" stroke="#8f6212"/>';
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#9aa3ad" stroke-width="2.5" stroke-linecap="round"/>` +
      `<g transform="translate(${mx} ${my}) rotate(${ang})">${body}</g>` +
      `<g transform="translate(${mx} ${my}) rotate(${ang > 90 || ang < -90 ? ang + 180 : ang})">${txt(0, style === 'elec' ? -14 : -9, p.ref)}</g>`;
  }
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, horiz = pts[0][1] === pts[1][1];
  if (p.kind === 'to92') {
    let h = `<rect x="${x0 - 10}" y="${y0 - 10}" width="${x1 - x0 + 20}" height="${y1 - y0 + 20}" rx="9" fill="#262626" stroke="#000"/>`;
    pts.forEach((q, i) => { h += `<text x="${q[0]}" y="${q[1] + 3}" font-size="8" text-anchor="middle" fill="#fff">${esc((p.pinNames || '')[i] || '')}</text>`; });
    return h + (horiz ? txt(cx, y0 - 13, p.ref + ' ' + lab) : txt(x1 + 13, cy + 3, p.ref + ' ' + lab, 'start'));
  }
  let h = horiz ? `<rect x="${x0 - 10}" y="${y0 + 5}" width="${x1 - x0 + 20}" height="${y1 - y0 - 10}" rx="3" fill="#262626" stroke="#000"/>`
    : `<rect x="${x0 + 5}" y="${y0 - 10}" width="${x1 - x0 - 10}" height="${y1 - y0 + 20}" rx="3" fill="#262626" stroke="#000"/>`;
  for (const q of pts) h += `<rect x="${q[0] - 3.5}" y="${q[1] - 3.5}" width="7" height="7" fill="#b9bec6"/>`;
  const d1 = Math.hypot(cx - pts[0][0], cy - pts[0][1]) || 1;
  h += `<circle cx="${pts[0][0] + (cx - pts[0][0]) / d1 * 13}" cy="${pts[0][1] + (cy - pts[0][1]) / d1 * 13}" r="2.5" fill="#ddd"/>`;
  return h + `<text x="${cx}" y="${cy + 3}" font-size="9" text-anchor="middle" fill="#fff" ${horiz ? '' : `transform="rotate(-90 ${cx} ${cy})"`}>${esc(p.ref + ' ' + lab)}</text>`;
}
function renderBoard() {
  const { L, parts, vcc } = boardState(), G = geom(L), X = G.hx, Y = G.hy, bread = L.kind === 'bread';
  cur = { L, parts, vcc, G };
  const byRef = new Map(parts.map(p => [p.ref, p]));
  let h = `<rect width="${G.W}" height="${G.H}" fill="#23262d"/>`, handles = '';
  const handle = (hole, id) => { handles += `<circle cx="${X(hole[0])}" cy="${Y(hole[1])}" r="9" fill="transparent" style="cursor:grab" data-h="${id}"/>`; };
  if (bread) {
    for (let b = 0; b < G.nb; b++) {
      const x0 = b * Layout.BOARD, x1 = Math.min(L.cols, x0 + Layout.BOARD) - 1;
      h += `<rect x="${X(x0) - 22}" y="${G.by}" width="${X(x1) - X(x0) + 44}" height="${G.bh}" rx="8" fill="#f1efe6" stroke="#b9b6a8"/>`;
      for (const [y, col, off] of [[0, '#d92b2b', -11], [1, '#2b5fd9', 11], [12, '#d92b2b', -11], [13, '#2b5fd9', 11]])
        h += `<line x1="${X(x0) - 8}" x2="${X(x1) + 8}" y1="${Y(y) + off}" y2="${Y(y) + off}" stroke="${col}" stroke-width="1.5"/>`;
      for (let x = x0; x <= x1; x++) {
        for (let y = 0; y < 14; y++) h += `<rect x="${X(x) - 3}" y="${Y(y) - 3}" width="6" height="6" rx="1" fill="#5a5a55"/>`;
        if ((x - x0) % 5 === 4 || x === x0) h += `<text x="${X(x)}" y="${Y(2) - 13}" font-size="8" text-anchor="middle" fill="#999">${x - x0 + 1}</text>`;
      }
      'ABCDEFGHIJ'.split('').forEach((ch, i) => { h += `<text x="${X(x0) - 14}" y="${Y(i + 2) + 3}" font-size="8" text-anchor="middle" fill="#999">${ch}</text>`; });
      if (G.nb > 1) h += `<text x="${X(x0) + 6}" y="${Y(6) + 26}" font-size="11" fill="#999">Board ${b + 1}</text>`;
    }
  } else {
    h += `<rect x="${G.bx}" y="${G.by}" width="${G.bw}" height="${G.bh}" rx="4" fill="#c7a26a" stroke="#8a6a3a"/>`;
    for (let y = 0; y < L.rows; y++) {
      h += `<rect x="${X(0) - 10}" y="${Y(y) - 7}" width="${(L.cols - 1) * G.P + 20}" height="14" rx="3" fill="#d98646"/>`;
      h += `<text x="${X(0) - 14}" y="${Y(y) + 3}" font-size="7" text-anchor="middle" fill="#5a3a1a">${y + 1}</text>`;
      for (let x = 0; x < L.cols; x++) h += `<circle cx="${X(x)}" cy="${Y(y)}" r="3" fill="#4a3320"/>`;
    }
    for (let x = 0; x < L.cols; x++) h += `<text x="${X(x)}" y="${G.by + 9}" font-size="7" text-anchor="middle" fill="#5a3a1a">${x + 1}</text>`;
    for (const c of L.cuts) h += `<circle cx="${X(c[0])}" cy="${Y(c[1])}" r="8" fill="#c7a26a"/>`;
  }
  L.wires.forEach((w, i) => {
    const x1 = X(w.a[0]), y1 = Y(w.a[1]), x2 = X(w.b[0]), y2 = Y(w.b[1]), bow = bread ? 0.12 : 0;   // breadboard jumpers arc, stripboard links are straight
    h += `<path data-wire="${i}" d="M${x1} ${y1}Q${(x1 + x2) / 2 + (y2 - y1) * bow} ${(y1 + y2) / 2 - (x2 - x1) * bow} ${x2} ${y2}" fill="none" stroke="${netColor(w.net, vcc)}" stroke-width="${bread ? 3.5 : 4.5}" stroke-linecap="round"${boardMode === 'del' ? ' style="cursor:pointer"' : ''}/>`;
    handle(w.a, 'w,' + i + ',0'); handle(w.b, 'w,' + i + ',1');
  });
  L.parts.forEach((p, i) => {
    const src = byRef.get(p.ref);
    h += `<g><title>${esc(p.ref + ' ' + (src ? src.label : p.label))}</title>${partSvg(p, src, G)}</g>`;
    p.pins.forEach((q, j) => handle(q, 'p,' + i + ',' + j));
  });
  for (const c of L.cuts) h += `<path d="M${X(c[0]) - 5} ${Y(c[1]) - 5}l10 10m0 -10l-10 10" stroke="#e0182b" stroke-width="2.5"/>`;
  const groups = new Map();              // off-board wires: a ring in the hole, one label per column/row at the board edge
  L.off.forEach((o, i) => {
    const src = byRef.get(o.ref);
    o.pins.forEach((q, j) => {
      const col = netColor(q.net, vcc), far = bread ? q.at[1] > 6 : q.at[0] >= L.cols / 2, k = (bread ? q.at[0] : q.at[1]) + (far ? 'b' : 'a');
      h += `<circle cx="${X(q.at[0])}" cy="${Y(q.at[1])}" r="6" fill="#fff" stroke="${col}" stroke-width="3.5"/>`;
      const grp = groups.get(k) || groups.set(k, { far, at: q.at, names: [], col }).get(k);
      if (bread ? (far ? q.at[1] > grp.at[1] : q.at[1] < grp.at[1]) : (far ? q.at[0] > grp.at[0] : q.at[0] < grp.at[0])) grp.at = q.at;
      grp.names.push(src && src.pins[j] ? src.pins[j].name : q.name);
      handle(q.at, 'o,' + i + ',' + j);
    });
  });
  for (const gr of groups.values()) {
    const x = X(gr.at[0]), y = Y(gr.at[1]), name = esc(gr.names.join(', ')), wire = (x2, y2) => `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${gr.col}" stroke-width="2.5" stroke-dasharray="5 3"/>`;
    if (bread) {
      const ey = gr.far ? G.by + G.bh + 8 : G.by - 8;
      h += wire(x, ey) + `<text font-size="10" fill="#d9dde6" text-anchor="${gr.far ? 'end' : 'start'}" transform="translate(${x + 3.5} ${gr.far ? ey + 4 : ey - 4}) rotate(-90)">${name}</text>`;
    } else {
      const ex = gr.far ? G.bx + G.bw + 8 : G.bx - 8;
      h += wire(ex, y) + `<text font-size="10" fill="#d9dde6" text-anchor="${gr.far ? 'start' : 'end'}" x="${gr.far ? ex + 4 : ex - 4}" y="${y + 3.5}">${name}</text>`;
    }
  }
  if (wireFrom) h += `<circle cx="${X(wireFrom[0])}" cy="${Y(wireFrom[1])}" r="8" fill="none" stroke="#f0a030" stroke-width="2"/>`;
  bsvg.setAttribute('width', G.W); bsvg.setAttribute('height', G.H); bsvg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
  bsvg.innerHTML = h + (boardMode === 'move' ? handles : '');

  const errs = Layout.verify(L, parts);
  $('#boardstatus').innerHTML = errs.length ? '<ul class="bad">' + errs.map(e => `<li>${esc(e)}</li>`).join('') + '</ul>'
    : '<div class="good">✓ Every connection matches the schematic, with no shorts.</div>';
  const notes = bread
    ? [`${L.cols <= 30 ? 'Half-size breadboard (400 points), 30 columns' : L.cols <= Layout.BOARD ? 'Full-size breadboard (830 points), 63 columns' : G.nb + ' full-size breadboards (830 points each) side by side'}. Red rail is ${vcc || 'the supply'}, blue rail is ground.`,
      'White rings are wires that leave the board (pots, jacks, power); the dashed line points to their label.',
      'Drag any leg or wire end to another hole; the check above updates as you go.']
    : [`Board: ${L.cols} × ${L.rows} holes (about ${(L.cols * 2.54).toFixed(0)} × ${(L.rows * 2.54).toFixed(0)} mm). Seen from the component side; copper strips run left to right.`,
      L.cuts.length ? `${L.cuts.length} track cuts (column, row): ${L.cuts.map(c => `${c[0] + 1},${c[1] + 1}`).join('  ')}` : 'No track cuts.',
      'Coloured lines are wire links. White rings are wires that leave the board (pots, jacks, power).',
      'One strip per net: electrically right but not the smallest possible board.'];
  $('#boardnotes').innerHTML = '<ul>' + notes.concat(L.notes || []).map(n => `<li>${esc(n)}</li>`).join('') + '</ul>';
  const what = { res: 'resistor', cap: 'capacitor', elec: 'electrolytic, + on the marked leg', diode: 'diode, band = cathode', led: 'LED, flat side = cathode', ind: 'inductor', ldr: 'photoresistor, either way round' };
  $('#bom').innerHTML = '<table>' + parts.map(p => p.kind === 'off' ? (p.ref === 'PWR' ? '' : `<tr><td>${esc(p.name)}</td><td>off-board</td></tr>`)
    : `<tr><td>${esc(p.ref)} <b>${esc(p.label)}</b></td><td>${p.kind === 'two' ? what[p.style] : p.kind === 'to92' ? 'pins ' + esc(p.pinNames.split('').join('-')) + (p.label === 'IRFZ44N' ? ', TO-220, printed side facing you' : ', flat side facing you') : 'DIP-' + p.nets.length + ', dot = pin 1'}</td></tr>`).join('') +
    '</table><p class="hint">Pinouts differ between manufacturers: check the datasheet of the part in your hand.</p>';
  for (const b of document.querySelectorAll('#boardtools button')) { b.classList.toggle('on', b.dataset.mode === boardMode); if (b.dataset.mode === 'cut') b.disabled = bread; }
}

// board editing
let bdrag = null, wireFrom = null;
function holeAt(e) {
  const r = bsvg.getBoundingClientRect(), { L, G } = cur, py = e.clientY - r.top;
  let y = 0, best = Infinity;
  for (let i = 0; i < L.rows; i++) { const d = Math.abs(G.hy(i) - py); if (d < best) { best = d; y = i; } }
  let x = 0;
  best = Infinity;
  for (let i = 0; i < L.cols; i++) { const d = Math.abs(G.hx(i) - (e.clientX - r.left)); if (d < best) { best = d; x = i; } }
  return [x, y];
}
bsvg.addEventListener('pointerdown', e => {
  if (!cur) return;
  const L = cur.L, hole = holeAt(e);
  if (boardMode === 'move') {
    if (!e.target.dataset.h) return;
    const [k, i, j] = e.target.dataset.h.split(',');
    bdrag = { k, i: +i, j: +j, moved: false }; bsvg.setPointerCapture(e.pointerId);
  } else if (boardMode === 'wire') {
    if (!wireFrom) { wireFrom = hole; renderBoard(); }
    else if (wireFrom[0] === hole[0] && wireFrom[1] === hole[1]) { wireFrom = null; renderBoard(); }
    else { L.wires.push({ a: wireFrom, b: hole, net: null }); wireFrom = null; commit(); }
  } else if (boardMode === 'cut' && L.kind === 'strip') {
    const i = L.cuts.findIndex(c => c[0] === hole[0] && c[1] === hole[1]);
    if (i >= 0) L.cuts.splice(i, 1); else L.cuts.push(hole);
    commit();
  } else if (boardMode === 'del' && e.target.dataset.wire != null) { L.wires.splice(+e.target.dataset.wire, 1); commit(); }
});
bsvg.addEventListener('pointermove', e => {
  if (!bdrag) return;
  const L = cur.L, h = holeAt(e), { k, i, j } = bdrag;
  const pin = k === 'p' ? L.parts[i].pins[j] : k === 'w' ? L.wires[i][j ? 'b' : 'a'] : L.off[i].pins[j].at;
  const dx = h[0] - pin[0], dy = h[1] - pin[1];
  if (!dx && !dy) return;
  if (k === 'p' && L.parts[i].kind !== 'two') for (const q of L.parts[i].pins) { q[0] += dx; q[1] += dy; }   // ICs and transistors move as a whole
  else { pin[0] = h[0]; pin[1] = h[1]; }
  bdrag.moved = true; renderBoard();
});
bsvg.addEventListener('pointerup', () => { if (bdrag && bdrag.moved) commit(); bdrag = null; });
$('#boardtools').addEventListener('click', e => { if (e.target.dataset.mode) { boardMode = e.target.dataset.mode; wireFrom = null; renderBoard(); } });
$('#relayout').onclick = () => { delete sch.layouts[boardKind]; commit(); };
// Export: the board drawing as a standalone SVG, or as a PNG at twice the screen size (sharp when printed or zoomed).
function boardSvg() {
  const s = bsvg.cloneNode(true);
  for (const n of s.querySelectorAll('[data-h]')) n.remove();          // invisible drag handles
  s.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');        // the page's font does not travel with the file
  return new XMLSerializer().serializeToString(s);
}
const boardFile = ext => `${sch.name || 'pedal'}-${boardKind === 'bread' ? 'breadboard' : 'stripboard'}.${ext}`;
$('#svgout').onclick = () => download(new Blob([boardSvg()], { type: 'image/svg+xml' }), boardFile('svg'));
$('#pngout').onclick = () => {
  const img = new Image(), k = 2, c = document.createElement('canvas');
  c.width = bsvg.getAttribute('width') * k; c.height = bsvg.getAttribute('height') * k;
  img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => download(b, boardFile('png')), 'image/png'); };
  img.onerror = () => { $('#boardnotes').innerHTML = '<ul><li>Could not make the PNG in this browser; use Download SVG instead.</li></ul>'; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(boardSvg());
};

// ---------- top bar ----------
function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.tab === t);
  const board = t === 'bread' || t === 'strip';
  $('#tab-sch').hidden = t !== 'sch'; $('#tab-bench').hidden = t !== 'bench'; $('#tab-board').hidden = !board;
  if (board) { boardKind = t; wireFrom = null; if (t === 'bread' && boardMode === 'cut') boardMode = 'move'; renderBoard(); }
  if (t === 'bench') drawBench();
  if (t === 'sch') liveSim();
}
document.querySelector('nav').addEventListener('click', e => { if (e.target.dataset.tab) setTab(e.target.dataset.tab); });
$('#preset').innerHTML += Presets.names.map(n => `<option>${esc(n)}</option>`).join('');
$('#preset').onchange = e => {
  if (!e.target.value) return;
  sch = Presets.load(e.target.value); sch.layouts = {}; sel = null; e.target.value = '';
  commit(); fit();
};
$('#new').onclick = () => { sch = { name: 'Untitled', about: '', comps: [], wires: [], layouts: {} }; sel = null; commit(); fit(); };
$('#save').onclick = () => download(new Blob([JSON.stringify(sch, null, 1)], { type: 'application/json' }), (sch.name || 'pedal') + '.json');
$('#open').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.comps) || !Array.isArray(s.wires)) throw new Error('not a Hibiki project');
    sch = s; sch.layouts = sch.layouts || {}; sel = null; commit(); fit();
  } catch (err) { alert('Could not open that file: ' + err.message); }
  e.target.value = '';
};
$('#undo').onclick = () => step(undo, redo); $('#redo').onclick = () => step(redo, undo); $('#fit').onclick = fit;
addEventListener('resize', () => { if (tab === 'bench') drawBench(); else if (tab === 'sch') liveSim(); });

// ---------- start ----------
{
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* corrupt autosave: start fresh */ }
  setProject(saved && Array.isArray(saved.comps) ? saved : Presets.load('Transistor booster'));
  setTool('select');
  if (remoteName) { document.title = remoteName + ' · Hibiki'; remotePull(); setInterval(remotePull, 1500); }
}
