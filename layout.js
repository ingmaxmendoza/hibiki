// Hibiki board layouts: automatic breadboard and stripboard placement, plus a connectivity
// checker that compares any layout (auto or hand-edited) against the schematic netlist.
// Pure JS (browser + node).
//
// A layout is { kind:'bread'|'strip', cols, rows, cuts:[[x,y]], parts:[{ref,kind,pins:[[x,y]..]}],
//               wires:[{a:[x,y], b:[x,y], net}], off:[{ref,name,pins:[{name,net,at:[x,y]}]}], unplaced:[] }
// Breadboard rows: 0 '+' rail, 1 '-' rail, 2..6 top half (A-E), 7..11 bottom half (F-J), 12 '+', 13 '-'.
// Stripboard: copper strips run horizontally (one per row); cuts break a strip at a hole.
(function (root) {
'use strict';

const key = (x, y) => x + ',' + y;
// A circuit wider than one full-size breadboard continues on a second one: columns 0..62 are board 1, 63..125 board 2.
// Each board has its own rails; the layout joins them with jumpers.
const BOARD = 63, boardOf = x => Math.floor(x / BOARD);          // columns on a full-size (830 point) breadboard

// Id of the conductor a hole belongs to.
function segOf(L, x, y) {
  if (L.kind === 'bread') return y < 2 || y > 11 ? 'r' + y + ':' + boardOf(x) : (y < 7 ? 't' : 'b') + x;
  let n = 0;
  for (const c of L.cuts) if (c[1] === y && c[0] < x) n++;
  return y + ':' + n;
}

// Returns a list of human-readable problems; empty means the layout matches the schematic.
function verify(L, parts) {
  const errs = [], par = new Map();
  const find = k => { if (!par.has(k)) par.set(k, k); let r = k; while (par.get(r) !== r) r = par.get(r); par.set(k, r); return r; };
  const byRef = new Map(parts.map(p => [p.ref, p]));
  const cut = new Set(L.cuts.map(c => key(c[0], c[1]))), used = new Map(), pins = [];
  const hole = (h, who) => {
    const k = key(h[0], h[1]);
    if (h[0] < 0 || h[1] < 0 || h[0] >= L.cols || h[1] >= L.rows) errs.push(who + ' is off the board.');
    else if (cut.has(k)) errs.push(who + ' sits on a track cut.');
    else if (used.has(k)) errs.push(who + ' shares a hole with ' + used.get(k) + '.');
    used.set(k, who);
  };
  for (const p of L.parts) {
    const src = byRef.get(p.ref);
    if (src) p.pins.forEach((h, i) => { const who = p.ref + ' pin ' + (i + 1); hole(h, who); pins.push({ net: src.nets[i], h, who }); });
  }
  for (const o of L.off) for (const q of o.pins) { hole(q.at, q.name); pins.push({ net: q.net, h: q.at, who: q.name }); }
  for (const w of L.wires) { hole(w.a, 'A wire'); hole(w.b, 'A wire'); par.set(find(segOf(L, w.a[0], w.a[1])), find(segOf(L, w.b[0], w.b[1]))); }
  const netsAt = new Map(), groupsOf = new Map();
  for (const p of pins) {
    if (!p.net) continue;
    const g = find(segOf(L, p.h[0], p.h[1]));
    if (!netsAt.has(g)) netsAt.set(g, new Map());
    if (!netsAt.get(g).has(p.net)) netsAt.get(g).set(p.net, p.who);
    if (!groupsOf.has(p.net)) groupsOf.set(p.net, new Map());
    if (!groupsOf.get(p.net).has(g)) groupsOf.get(p.net).set(g, p.who);
  }
  for (const m of netsAt.values()) if (m.size > 1) errs.push('Short: ' + [...m.values()].join(' and ') + ' are connected but should not be.');
  for (const m of groupsOf.values()) if (m.size > 1) errs.push('Open: ' + [...m.values()].join(' and ') + ' should be connected but are not.');
  for (const u of L.unplaced || []) errs.push('Not placed: ' + u + '.');
  return errs;
}

// Visits parts in signal-flow order starting at the input jack. Calls onFixed for transistors/ICs,
// onNet once per non-power net, and returns the two-pin parts in placement order.
function walk(parts, isPow, onFixed, onNet) {
  const netsOf = p => (p.kind === 'off' ? p.pins.map(q => q.net) : p.nets).filter(Boolean);
  const byNet = new Map();
  for (const p of parts) for (const n of new Set(netsOf(p))) (byNet.get(n) || byNet.set(n, []).get(n)).push(p);
  const seen = new Set(), done = new Set(), twos = [];
  const visit = p => {
    if (done.has(p)) return false;
    done.add(p);
    if (p.kind === 'two') twos.push(p); else if (p.kind !== 'off') onFixed(p);
    return true;
  };
  const inJack = parts.find(p => p.kind === 'off' && /^IN/.test(p.ref)), all = [...byNet.keys()];
  for (const s of [...(inJack ? netsOf(inJack) : []), ...all].filter(n => !isPow(n))) {
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      if (seen.has(n)) continue;
      seen.add(n);
      for (const p of byNet.get(n)) if (visit(p)) for (const m of netsOf(p)) if (!isPow(m)) queue.push(m);
      onNet(n);
    }
  }
  for (const n of all.filter(isPow)) for (const p of byNet.get(n)) visit(p);
  return twos;
}

const between = (a, b) => {   // holes strictly between two holes on the same row or column
  const out = [];
  if (a[0] === b[0]) for (let y = Math.min(a[1], b[1]) + 1; y < Math.max(a[1], b[1]); y++) out.push([a[0], y]);
  else for (let x = Math.min(a[0], b[0]) + 1; x < Math.max(a[0], b[0]); x++) out.push([x, a[1]]);
  return out;
};

// Solderless breadboard. Each net gets a 5-hole column strip, power nets use the rails,
// two-pin parts lie flat along a row (or straight up to a rail).
// ponytail: greedy placement, correct but not the tidiest; drag parts in the UI to taste.
function layoutBread(parts, vcc, roomy) {
  const L = { kind: 'bread', cols: 30, rows: 14, cuts: [], parts: [], wires: [], off: [], unplaced: [], notes: [] };
  const occ = new Set(), strips = new Map(), segs = new Map(), pending = new Map();
  const isPow = n => n === '0' || (!!vcc && n === vcc);
  const railY = (n, top) => (n === '0' ? (top ? 1 : 13) : (top ? 0 : 12));
  const take = h => occ.add(key(h[0], h[1])), free = h => !occ.has(key(h[0], h[1]));
  let col = 1;
  const stripHoles = id => (id[0] === 't' ? [2, 3, 4, 5, 6] : [11, 10, 9, 8, 7]).map(y => [+id.slice(1), y]).filter(free);
  const wire = (a, b, net) => { take(a); take(b); L.wires.push({ a, b, net }); };
  // jumpers take the middle of a strip, leaving the outer hole free for parts that go straight to a rail
  const wireHole = id => (id[0] === 't' ? [4, 3, 6, 5, 2] : [9, 10, 7, 8, 11]).map(y => [+id.slice(1), y]).filter(free)[0];
  const claim = (id, net) => {
    strips.set(id, net);
    if (!net) return;
    if (isPow(net)) wire(stripHoles(id)[0], [+id.slice(1), railY(net, id[0] === 't')], net);   // strip -> rail jumper
    else (segs.get(net) || segs.set(net, []).get(net)).push(id);
  };
  const holes = net => {
    if (!isPow(net)) return (segs.get(net) || []).flatMap(stripHoles);
    const out = [], n = Math.max(col + 2, 30);
    for (const top of [true, false]) for (let x = 0; x < n; x++) if (free([x, railY(net, top)])) out.push([x, railY(net, top)]);
    return out;
  };
  const bump = (n, d) => pending.set(n, (pending.get(n) || 0) + d);

  const twos = walk(parts, isPow, p => {
    let pins;
    const width = p.kind === 'to92' ? p.nets.length : p.nets.length / 2;
    if (boardOf(col) !== boardOf(col + width - 1)) col = boardOf(col + width - 1) * BOARD + 1;   // never across the gap between two boards
    if (p.kind === 'to92') { pins = p.nets.map((n, i) => [col + i, 5]); col += 5; }
    else { const half = p.nets.length / 2; pins = p.nets.map((n, i) => (i < half ? [col + i, 7] : [col + 2 * half - 1 - i, 6])); col += half + 2; }   // DIP across the channel
    pins.forEach(take);
    pins.forEach((h, i) => claim((h[1] < 7 ? 't' : 'b') + h[0], p.nets[i]));
    L.parts.push({ ref: p.ref, kind: p.kind, label: p.label, pinNames: p.pinNames, pins });
  }, n => { if (!segs.has(n)) { claim('t' + col, n); col += 3; } });

  for (const [net, ids] of segs) for (let i = 1; i < ids.length; i++) wire(wireHole(ids[i - 1]), wireHole(ids[i]), net);
  for (const p of twos) p.nets.forEach(n => bump(n, 1));
  for (const p of parts) if (p.kind === 'off') p.pins.forEach(q => bump(q.net, 1));

  const xOf = n => (isPow(n) || !segs.has(n) ? null : +segs.get(n)[0].slice(1));
  const extend = (net, near) => {          // give a net one more column strip, jumpered to an existing one
    if (isPow(net) || !segs.has(net)) return false;
    const from = segs.get(net).map(wireHole).find(Boolean);
    if (!from) return false;
    for (let d = 0; d < 300; d++) for (const x of [near + d, near - d]) {
      if (x < 1 || strips.has('t' + x) || strips.has('b' + x)) continue;
      take(from); strips.set('t' + x, net); segs.get(net).push('t' + x);
      wire(from, wireHole('t' + x), net);
      col = Math.max(col, x + 1);
      return true;
    }
    return false;
  };
  const bridge = net => {                  // make a net available in the bottom half too: jumper across the channel
    if (isPow(net)) return false;
    for (const id of segs.get(net) || []) {
      const x = +id.slice(1);
      if (id[0] !== 't' || strips.has('b' + x) || !free([x, 6]) || !free([x, 7])) continue;
      strips.set('b' + x, net); segs.get(net).push('b' + x);
      wire([x, 6], [x, 7], net);
      return true;
    }
    return false;
  };
  // roomy (second pass, used when the first leaves parts off): keep spare holes so a strip can still be extended, and do not lay parts across strips that are running out
  const ensureFree = () => { for (const [n, k] of pending) if (k > 0 && !isPow(n) && holes(n).length < (roomy ? Math.min(k, 2) + 1 : 2)) extend(n, xOf(n)); };
  const starves = cover => {               // would lying across these holes leave a net that still needs holes with fewer than 2?
    const cnt = new Map();
    for (const [x, y] of cover) {
      const n = y > 1 && y < 12 && strips.get((y < 7 ? 't' : 'b') + x);
      if (n && !isPow(n) && pending.get(n) > 0) cnt.set(n, (cnt.get(n) || 0) + 1);
    }
    for (const [n, c] of cnt) if (holes(n).length - c < 2) return true;
    return false;
  };
  const search = (na, nb, anyAngle) => {
    let best = null;
    for (const a of holes(na)) for (const b of holes(nb)) {
      let cost, cover = [];
      if (a[0] === b[0] || (a[1] === b[1] && a[1] > 1 && a[1] < 12)) {
        cover = between(a, b);
        if (boardOf(a[0]) !== boardOf(b[0])) continue;       // parts stay on one board; only jumpers cross
        if (!cover.every(free) || (roomy && starves(cover))) continue;
        cost = cover.length + (a[0] === b[0] ? 0 : a[1] === 2 || a[1] === 11 ? 0.6 : a[1] === 6 || a[1] === 7 ? 0.3 : 0);   // keep rail-side and channel-side rows clear
      } else if (anyAngle) cost = 100 + Math.hypot(a[0] - b[0], a[1] - b[1]);
      else continue;
      if (!best || cost < best.cost) best = { a, b, cover, cost };
    }
    return best;
  };

  for (const p of twos) {
    const [na, nb] = p.nets;
    p.nets.forEach(n => bump(n, -1));
    if (na === nb) { L.notes.push(p.ref + ' has both pins on the same net (shorted in the schematic): left off the board.'); continue; }
    let hit = null;
    for (let t = 0; t < 8 && !(hit = search(na, nb)); t++) {
      const xa = xOf(na), xb = xOf(nb);
      if (!(bridge(na) || bridge(nb) || extend(na, xb == null ? xa : xb) || extend(nb, xa == null ? xb : xa))) break;
    }
    hit = hit || search(na, nb, true);
    if (!hit) { L.unplaced.push(p.ref); continue; }
    take(hit.a); take(hit.b); hit.cover.forEach(take);
    L.parts.push({ ref: p.ref, kind: 'two', style: p.style, label: p.label, pins: [hit.a, hit.b] });
    ensureFree();
  }
  const offX = new Set();                   // off-board wires of different nets get their own column, so labels do not collide
  for (const p of parts) if (p.kind === 'off') {
    const pins = [];
    for (const q of p.pins) {
      bump(q.net, -1);
      const h = holes(q.net).sort((a, b) => (isPow(q.net) && offX.has(a[0])) - (isPow(q.net) && offX.has(b[0])) || a[1] - b[1] || a[0] - b[0])[0];
      if (!h) { L.unplaced.push(q.name); continue; }
      take(h); offX.add(h[0]); pins.push({ name: q.name, net: q.net, at: h });
      ensureFree();
    }
    L.off.push({ ref: p.ref, name: p.name, pins });
  }

  let maxX = 0, low = [false, false];
  for (const k of occ) { const [x, y] = k.split(',').map(Number); maxX = Math.max(maxX, x); if (y >= 12) low[y - 12] = true; }
  const boards = boardOf(maxX) + 1;
  L.cols = maxX < 30 ? 30 : BOARD * boards;
  const railLink = (ya, yb, net) => {      // join top and bottom rails at the right-hand end
    for (let x = L.cols - 1; x >= 0; x--) if (free([x, ya]) && free([x, yb])) return wire([x, ya], [x, yb], net);
  };
  if (low[0] && vcc) railLink(0, 12, vcc);
  if (low[1]) railLink(1, 13, '0');
  if (boards > 1) {
    L.notes.push(`Too wide for one full-size breadboard: it continues on board ${boards > 2 ? '2 to ' + boards : '2'}, placed to the right. The short jumpers at each join link the power rails.`);
    for (const y of [0, 1, 12, 13]) {       // a rail used on a later board is jumpered back, board by board, to the first
      const net = y % 12 ? '0' : vcc, xs = [...occ].map(k => k.split(',').map(Number)).filter(h => h[1] === y).map(h => h[0]);
      if (!net || !xs.length) continue;
      for (let b = boardOf(Math.max(...xs)); b >= 1; b--) {
        let xa = b * BOARD - 1, xb = b * BOARD;
        while (!free([xa, y])) xa--;
        while (!free([xb, y])) xb++;
        wire([xa, y], [xb, y], net);
      }
    }
  }
  return L;
}

// Stripboard (Veroboard). Each net gets a horizontal strip, parts stand vertically between strips,
// ICs sit across a column of track cuts. Columns are shared whenever parts do not overlap.
// ponytail: one strip per net is correct but bigger than a hand-optimised layout; shrink by hand if it matters.
function layoutStrip(parts, vcc) {
  const L = { kind: 'strip', cols: 0, rows: 0, cuts: [], parts: [], wires: [], off: [], unplaced: [], notes: [] };
  const occ = new Set(), segs = new Map();   // net -> [{y, side}]  side: 0 whole strip, -1 left of the IC cuts, 1 right
  const take = h => occ.add(key(h[0], h[1])), free = h => !occ.has(key(h[0], h[1]));
  const hasIC = parts.some(p => p.kind === 'dip'), X0 = hasIC ? 5 : 1;
  let row = 0;
  const claim = (net, y, side) => { if (net) (segs.get(net) || segs.set(net, []).get(net)).push({ y, side }); };
  const okSide = (s, x) => s.side === 0 || (s.side < 0 ? x < 0 : x > 3);
  const findCol = (a, b) => {              // a free column for something standing between two strips
    if (a.y === b.y) return null;
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    for (let d = 0; d < 120; d++) for (const x of d ? [X0 + d, X0 - d] : [X0]) {
      if (!okSide(a, x) || !okSide(b, x) || (!hasIC && x < 0)) continue;
      let ok = true;
      for (let y = lo; y <= hi && ok; y++) ok = free([x, y]);
      if (ok) return x;
    }
    return null;
  };
  const stand = (a, b, x) => { for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) take([x, y]); return [[x, a.y], [x, b.y]]; };
  const link = (a, b, net) => {
    const x = findCol(a, b);
    if (x == null) return false;
    const [p, q] = stand(a, b, x);
    L.wires.push({ a: p, b: q, net });
    return true;
  };
  const extendRow = net => {               // bring a net out to a fresh full-width strip
    const s = { y: row++, side: 0 };
    segs.get(net).slice().some(t => link(t, s, net));
    segs.get(net).push(s);
  };

  if (vcc) claim(vcc, row++, 0);
  const isPow = n => n === '0' || (!!vcc && n === vcc);
  const twos = walk(parts, isPow, p => {
    let pins;
    if (p.kind === 'to92') {
      pins = p.nets.map((n, i) => [X0 + 1, row + i]);
      p.nets.forEach((n, i) => claim(n, row + i, 0));
      pins.forEach(take); row += 3;
    } else {                               // DIP-8: pins 1-4 down the left, 8-5 down the right, cuts in between
      const half = p.nets.length / 2;
      pins = p.nets.map((n, i) => (i < half ? [0, row + i] : [3, row + 2 * half - 1 - i]));
      p.nets.forEach((n, i) => claim(n, pins[i][1], i < half ? -1 : 1));
      for (let k = 0; k < half; k++) { L.cuts.push([1, row + k]); for (let x = 0; x < 4; x++) take([x, row + k]); }
      row += half;
    }
    L.parts.push({ ref: p.ref, kind: p.kind, label: p.label, pinNames: p.pinNames, pins });
  }, n => { if (!segs.has(n)) claim(n, row++, 0); });
  claim('0', row++, 0);

  for (const [net, ss] of segs) {
    const n0 = ss.length;
    for (let i = 1; i < n0; i++) {
      if (ss.slice(0, i).some(t => link(t, ss[i], net))) continue;
      const s = { y: row++, side: 0 };      // left-side and right-side IC pins: join through a new strip
      ss.slice(0, i).some(t => link(t, s, net)); link(s, ss[i], net); ss.push(s);
    }
  }

  for (const p of twos) {
    const [na, nb] = p.nets;
    if (na === nb) { L.notes.push(p.ref + ' has both pins on the same net (shorted in the schematic): left off the board.'); continue; }
    const best = () => {
      let hit = null;
      for (const a of segs.get(na)) for (const b of segs.get(nb)) {
        const x = findCol(a, b);
        if (x == null) continue;
        const cost = Math.abs(a.y - b.y) * 3 + Math.abs(x - X0);
        if (!hit || cost < hit.cost) hit = { a, b, x, cost };
      }
      return hit;
    };
    let hit = best();
    if (!hit) { extendRow(na); hit = best(); }
    if (!hit) { L.unplaced.push(p.ref); continue; }
    L.parts.push({ ref: p.ref, kind: 'two', style: p.style, label: p.label, pins: stand(hit.a, hit.b, hit.x) });
  }

  let minX = 0, maxX = 0;
  for (const k of occ) { const x = +k.split(',')[0]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  for (const p of parts) if (p.kind === 'off') {   // off-board wires leave from the board edges
    const pins = [];
    for (const q of p.pins) {
      const ss = segs.get(q.net), s = ss.find(t => t.side >= 0) || ss[0];
      let x = s.side < 0 ? minX - 1 : maxX + 1;
      while (!free([x, s.y])) x += s.side < 0 ? -1 : 1;
      take([x, s.y]); pins.push({ name: q.name, net: q.net, at: [x, s.y] });
    }
    L.off.push({ ref: p.ref, name: p.name, pins });
  }

  minX = Infinity; maxX = -Infinity;
  for (const k of occ) { const x = +k.split(',')[0]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const sh = h => { h[0] -= minX; };       // shift so the leftmost used column is 0
  const moved = new Set();
  const once = h => { if (!moved.has(h)) { moved.add(h); sh(h); } };
  L.cuts.forEach(once);
  for (const p of L.parts) p.pins.forEach(once);
  for (const w of L.wires) { once(w.a); once(w.b); }
  for (const o of L.off) for (const q of o.pins) once(q.at);
  L.cols = maxX - minX + 1; L.rows = row;
  return L;
}

const auto = (kind, parts, vcc) => {
  if (kind !== 'bread') return layoutStrip(parts, vcc);
  const L = layoutBread(parts, vcc);
  return L.unplaced.length ? layoutBread(parts, vcc, true) : L;
};
const Layout = { auto, verify, segOf, BOARD };
if (typeof module !== 'undefined' && module.exports) module.exports = Layout; else root.Layout = Layout;
})(typeof window !== 'undefined' ? window : globalThis);
