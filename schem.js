// Hibiki schematic model: component definitions, symbols, net extraction,
// and conversion to the simulator netlist and to the layout part list. Pure JS (browser + node).
(function (root) {
'use strict';
const Sim = root.Sim || require('./sim.js');

// Pin coordinates are in grid units at rot = 0. `lab` is where the text label goes.
const DEFS = {
  R:    { name: 'Resistor',  prefix: 'R',  pins: [[-2, 0], [2, 0]], lab: [0, -0.8], props: { value: '10k' } },
  C:    { name: 'Capacitor', prefix: 'C',  pins: [[-2, 0], [2, 0]], lab: [0, -0.9], props: { value: '100n' } },
  L:    { name: 'Inductor',  prefix: 'L',  pins: [[-2, 0], [2, 0]], lab: [0, -0.8], props: { value: '500m' } },
  POT:  { name: 'Pot',       prefix: 'VR', pins: [[-2, 0], [0, 2], [2, 0]], lab: [0, -0.8], props: { value: '100k', taper: 'lin', pos: 0.5, label: '' } },
  D:    { name: 'Diode',     prefix: 'D',  pins: [[-2, 0], [2, 0]], lab: [0, -0.9], props: { model: '1N4148' } },
  NPN:  { name: 'NPN',       prefix: 'Q',  pins: [[1, -2], [-2, 0], [1, 2]], lab: [1.6, 0], props: { model: '2N3904', hfe: '' } },
  PNP:  { name: 'PNP',       prefix: 'Q',  pins: [[1, -2], [-2, 0], [1, 2]], lab: [1.6, 0], props: { model: '2N3906', hfe: '' } },
  JFET: { name: 'JFET (N)',  prefix: 'Q',  pins: [[1, -2], [-2, 0], [1, 2]], lab: [1.6, 0], props: { model: 'J201' } },
  NMOS: { name: 'MOSFET (N)', prefix: 'Q', pins: [[1, -2], [-2, 0], [1, 2]], lab: [1.6, 0], props: { model: 'IRFZ44N' } },
  LDR:  { name: 'LDR',       prefix: 'LDR', pins: [[-2, 0], [2, 0]], lab: [0, -1.5], props: { dark: '1M', lit: '2k', light: 0.5, led: '' } },
  NE555: { name: '555 timer', prefix: 'U', pins: [[-4, 2], [-4, 0], [-4, -2], [4, -2], [4, 2]], pinLab: ['TR', 'TH', 'DIS', 'OUT', 'CV'], lab: [0, -3.6], props: {} },
  OPA:  { name: 'Op-amp',    prefix: 'U',  pins: [[-3, 1], [-3, -1], [3, 0]], lab: [-0.4, 0.2], props: { model: 'TL082' } },
  V:    { name: 'Supply',    pins: [[0, 0]], lab: [0, -1.3], props: { value: '9' } },
  GND:  { name: 'Ground',    pins: [[0, 0]], props: {} },
  NET:  { name: 'Net label', pins: [[0, 0]], lab: [0, -1.2], props: { name: 'VREF' } },
  IN:   { name: 'Input',     pins: [[0, 0]], lab: [-1.85, 0], props: { rs: '0', ls: '0' } },
  OUT:  { name: 'Output',    pins: [[0, 0]], lab: [1.85, 0], props: { rload: '1M' } },
};

// SVG path data for each symbol, in pixels (1 grid unit = 20 px), drawn at rot = 0.
const SYM = {
  R: 'M-40 0H-18L-15 -7L-9 7L-3 -7L3 7L9 -7L15 7L18 0H40',
  C: 'M-40 0H-4M4 0H40M-4 -12V12M4 -12V12',
  Cpol: 'M-40 0H-4M4 0H40M-4 -12V12M4 -12V12M-17 -9h7M-13.5 -12.5v7',
  L: 'M-40 0H-24a6 6 0 0 1 12 0a6 6 0 0 1 12 0a6 6 0 0 1 12 0a6 6 0 0 1 12 0H40',
  POT: 'M-40 0H-18L-15 -7L-9 7L-3 -7L3 7L9 -7L15 7L18 0H40M0 40V11M-4 18L0 10L4 18',
  D: 'M-40 0H-8M8 0H40M-8 -9V9L8 0ZM8 -9V9',
  LED: 'M-40 0H-8M8 0H40M-8 -9V9L8 0ZM8 -9V9M0 -13l6 -6m-4 0h4v4M9 -11l6 -6m-4 0h4v4',
  ZEN: 'M-40 0H-8M8 0H40M-8 -9V9L8 0ZM4 -12L8 -9V9L12 12',
  NMOS: 'M-40 0H-10M-10 -10V10M-4 -14V14M-4 -9H20V-40M-4 9H20V40M-4 0H20V9M-4 0l7 -4v8Z',
  LDR: 'M-40 0H-18L-15 -7L-9 7L-3 -7L3 7L9 -7L15 7L18 0H40M-10 -24l6 6m-4 0h4v-4M2 -24l6 6m-4 0h4v-4',
  NE555: 'M-60 -60H60V60H-60ZM-80 -40H-60M-80 0H-60M-80 40H-60M60 -40H80M60 40H80',
  NPN: 'M-40 0H-6M-6 -14V14M-6 -6L20 -22V-40M-6 6L20 22V40M17 20.2L8.1 19.4L12.3 12.6Z',
  PNP: 'M-40 0H-6M-6 -14V14M-6 -6L20 -22V-40M-6 6L20 22V40M1 10.3L5.7 17.9L9.9 11.1Z',
  JFET: 'M-40 0H-6M-6 0L-14 -4V4ZM-6 -14V14M-6 -8H20V-40M-6 8H20V40',
  OPA: 'M-40 -36V36L40 0ZM-60 -20H-40M-60 20H-40M40 0H60M-35 -20h8M-35 20h8M-31 16v8',
  V: 'M0 0V-14M-9 -14H9',
  GND: 'M0 0V10M-12 10H12M-7 15H7M-2 20H2',
  NET: 'M0 0V-5L5 -10L0 -15L-5 -10L0 -5',
  IN: 'M0 0H-14L-22 -9H-52V9H-22L-14 0',
  OUT: 'M0 0H14L22 -9H52V9H22L14 0',
};

const SUPPLY = /^[+-]\d+(\.\d+)?V$/i;
const MULT = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, '': 1 };
// '10k', '4.7n', '4k7', '2.2u', '1M', '470' -> number (NaN if unreadable)
function parseVal(s) {
  const m = /^\s*(-?[\d.]+)\s*([pnuµmkKMGR]?)(\d*)/.exec(String(s));
  if (!m) return NaN;
  return parseFloat(m[3] ? m[1] + '.' + m[3] : m[1]) * MULT[m[2]];
}

function xform(c, p) {
  let x = p[0], y = c.flip ? -p[1] : p[1];
  for (let i = 0; i < (c.rot || 0); i++) [x, y] = [-y, x];
  return [c.x + x, c.y + y];
}
const pinPos = c => DEFS[c.type].pins.map(p => xform(c, p));
const isPolar = c => c.type === 'C' && parseVal(c.value) >= 1e-6;
const symbol = c => (c.type === 'C' && isPolar(c) ? SYM.Cpol : c.type === 'D' && /LED/.test(c.model) ? SYM.LED : c.type === 'D' && (Sim.DIODES[c.model] || {}).Bv ? SYM.ZEN : SYM[c.type]);

function onSeg(p, w) {
  const cross = (w.x2 - w.x1) * (p[1] - w.y1) - (w.y2 - w.y1) * (p[0] - w.x1);
  return cross === 0 && p[0] >= Math.min(w.x1, w.x2) && p[0] <= Math.max(w.x1, w.x2) &&
    p[1] >= Math.min(w.y1, w.y2) && p[1] <= Math.max(w.y1, w.y2);
}

// Works out which pins are connected. Returns
// { comps: [{c, nets}], supplies: [{net, value}], netAt: Map 'x,y' -> net, warnings: [..] }
function extract(sch) {
  const par = new Map(), K = p => p[0] + ',' + p[1];
  const find = k => { if (!par.has(k)) par.set(k, k); let r = k; while (par.get(r) !== r) r = par.get(r); par.set(k, r); return r; };
  const uni = (a, b) => par.set(find(a), find(b));
  const pts = [];
  for (const w of sch.wires) { const a = [w.x1, w.y1], b = [w.x2, w.y2]; uni(K(a), K(b)); pts.push(a, b); }
  const pins = sch.comps.map(pinPos);
  for (const ps of pins) for (const p of ps) { find(K(p)); pts.push(p); }
  for (const p of pts) for (const w of sch.wires) if (onSeg(p, w)) uni(K(p), K([w.x1, w.y1]));

  // Tie together all grounds, all supplies of equal voltage, and all net labels with the same name.
  // A label called GND or +9V counts as that symbol.
  const warnings = [], first = new Map();
  sch.comps.forEach((c, i) => {
    if (c.type !== 'GND' && c.type !== 'V' && c.type !== 'NET') return;
    const nm = c.type === 'NET' ? String(c.name).trim() : '';
    const v = c.type === 'V' ? parseVal(c.value) : SUPPLY.test(nm) ? parseFloat(nm) : NaN;
    const tag = c.type === 'GND' || /^(gnd|0)$/i.test(nm) ? '0' : v === v ? (v >= 0 ? '+' : '') + v + 'V' : 'L:' + nm;
    if (first.has(tag)) uni(K(pins[i][0]), first.get(tag)); else first.set(tag, K(pins[i][0]));
  });
  const names = new Map(), supplies = [], used = new Set(['0']);
  if (first.has('0')) names.set(find(first.get('0')), '0'); else warnings.push('No ground symbol: the circuit needs at least one.');
  for (const [tag, k] of first) {
    if (tag === '0' || tag.startsWith('L:')) continue;
    const r = find(k);
    if (names.has(r)) { warnings.push('Supply ' + tag + ' is shorted to ' + (names.get(r) === '0' ? 'ground' : names.get(r)) + '.'); continue; }
    names.set(r, tag); used.add(tag); supplies.push({ net: tag, value: parseFloat(tag) });
  }
  for (const [tag, k] of first) {
    const r = find(k);
    if (tag.startsWith('L:') && !names.has(r)) { names.set(r, tag.slice(2)); used.add(tag.slice(2)); }
  }
  let auto = 0;
  const nameOf = k => {
    const r = find(k);
    if (!names.has(r)) { let nm; do nm = 'n' + (++auto); while (used.has(nm)); names.set(r, nm); }
    return names.get(r);
  };
  const count = new Map(), comps = [];
  sch.comps.forEach((c, i) => {
    const nets = pins[i].map(p => nameOf(K(p)));
    nets.forEach(n => count.set(n, (count.get(n) || 0) + 1));
    comps.push({ c, nets });
  });
  for (const { c, nets } of comps) {
    if (c.type === 'GND' || c.type === 'V' || c.type === 'NET') continue;
    nets.forEach((n, j) => { if (count.get(n) === 1 && !(c.type === 'NE555' && j === 4)) warnings.push(   // a 555's control pin may be left open
      (c.ref || c.type) + ' pin ' + (j + 1) + ' is not connected.'); });
  }
  if (!sch.comps.some(c => c.type === 'IN')) warnings.push('No input: place an IN jack.');
  if (!sch.comps.some(c => c.type === 'OUT')) warnings.push('No output: place an OUT jack.');
  const netAt = new Map();
  for (const k of par.keys()) netAt.set(k, nameOf(k));
  return { comps, supplies, netAt, warnings };
}

// Netlist for Sim.Circuit.
function toSim(ex) {
  const out = [], num = (v, d) => { const x = parseVal(v); return x === x ? x : d; };
  for (const { c, nets: n } of ex.comps) {
    switch (c.type) {
      case 'R': case 'C': case 'L': out.push({ type: c.type, ref: c.ref, n, value: num(c.value, 1) }); break;
      case 'POT': out.push({ type: 'POT', ref: c.ref, n, value: num(c.value, 1e5), pos: +c.pos, taper: c.taper }); break;
      case 'D': out.push({ type: 'D', ref: c.ref, n, model: c.model }); break;
      case 'NPN': case 'PNP': out.push({ type: 'Q', ref: c.ref, n, model: c.model, hfe: num(c.hfe, 0) }); break;
      case 'JFET': out.push({ type: 'J', ref: c.ref, n, model: c.model }); break;
      case 'OPA': out.push({ type: 'U', ref: c.ref, n, model: c.model }); break;
      case 'NMOS': out.push({ type: 'M', ref: c.ref, n, model: c.model }); break;
      case 'LDR': out.push({ type: 'LDR', ref: c.ref, n, dark: num(c.dark, 1e6), lit: num(c.lit, 2e3), light: Math.max(0, Math.min(1, +c.light || 0)), led: String(c.led || '').trim() }); break;
      case 'NE555': out.push({ type: 'T', ref: c.ref, n }); break;
      case 'IN': out.push({ type: 'IN', ref: 'IN' + out.length, n, rs: num(c.rs, 0), ls: num(c.ls, 0) }); break;
      case 'OUT': out.push({ type: 'OUT', n, rload: num(c.rload, 0) }); break;
    }
  }
  for (const s of ex.supplies) out.push({ type: 'V', n: [s.net], value: s.value });
  return { comps: out };
}

// Physical parts for the board layouts. Pots, jacks and power are off-board (wired to the board).
function toParts(ex) {
  const parts = [], vcc = ex.supplies.length ? ex.supplies.reduce((a, b) => (b.value > a.value ? b : a)).net : null;
  const opas = [];
  let jacks = 0;
  for (const { c, nets } of ex.comps) {
    const two = (style, label) => parts.push({ ref: c.ref, kind: 'two', style, nets, label });
    switch (c.type) {
      case 'R': two('res', c.value); break;
      case 'L': two('ind', c.value); break;
      case 'C': two(isPolar(c) ? 'elec' : 'cap', c.value); break;
      case 'D': two(/LED/.test(c.model) ? 'led' : 'diode', c.model); break;
      case 'LDR': two('ldr', 'LDR'); break;
      case 'NE555': {                      // DIP-8: 1 GND, 2 TRIG, 3 OUT, 4 RESET (tied to V+), 5 CTRL, 6 THR, 7 DIS, 8 V+
        const cv = ex.comps.filter(e => !['GND', 'V', 'NET'].includes(e.c.type) && e.nets.includes(nets[4])).length > 1 ? nets[4] : null;
        parts.push({ ref: c.ref, kind: 'dip', label: 'NE555', nets: ['0', nets[0], nets[3], vcc, cv, nets[1], nets[2], vcc] });
        break;
      }
      case 'NPN': case 'PNP': case 'JFET': case 'NMOS': {
        const fet = c.type === 'JFET' || c.type === 'NMOS', m = (c.type === 'JFET' ? Sim.JFETS : c.type === 'NMOS' ? Sim.MOSFETS : Sim.BJTS)[c.model];
        const order = fet ? 'DGS' : 'CBE', pn = (m && m.pins) || (fet ? 'DGS' : 'EBC');
        parts.push({ ref: c.ref, kind: 'to92', nets: [...pn].map(ch => nets[order.indexOf(ch)]), pinNames: pn, label: c.model });
        break;
      }
      case 'OPA': opas.push({ c, nets }); break;
      case 'POT': parts.push({ ref: c.ref, kind: 'off', name: (c.label || c.ref) + ' ' + c.value, pins: nets.map((net, i) => ({ name: (c.label || c.ref) + ' lug ' + (i + 1), net })) }); break;
      case 'IN': case 'OUT': parts.push({ ref: c.type + (++jacks), kind: 'off', name: c.type + ' jack', pins: [{ name: c.type + ' tip', net: nets[0] }, { name: c.type + ' sleeve', net: '0' }] }); break;
    }
  }
  // Op-amps share packages by model. Single and dual are DIP-8, quad is DIP-14 (TL074 / TL084 / LM324 pinout).
  while (opas.length) {
    const a = opas.shift(), units = (Sim.OPAMPS[a.c.model] || {}).units || 2, grp = [a];
    for (let k = 0; k < opas.length && grp.length < units;) { if (opas[k].c.model === a.c.model) grp.push(opas.splice(k, 1)[0]); else k++; }
    const u = i => (grp[i] ? [grp[i].nets[2], grp[i].nets[1], grp[i].nets[0]] : [null, null, null]);   // out, in-, in+
    const A = u(0), B = u(1), C = u(2), D = u(3);
    const nets = units === 1 ? [null, A[1], A[2], '0', null, A[0], vcc, null]
      : units === 2 ? [A[0], A[1], A[2], '0', B[2], B[1], B[0], vcc]
      : [A[0], A[1], A[2], vcc, B[2], B[1], B[0], C[0], C[1], C[2], '0', D[2], D[1], D[0]];
    parts.push({ ref: grp.map(g => g.c.ref).join('/'), kind: 'dip', label: a.c.model, nets });
  }
  const power = [{ name: 'GND (DC -)', net: '0' }];
  for (const s of ex.supplies) power.unshift({ name: s.net + ' (DC)', net: s.net });
  parts.push({ ref: 'PWR', kind: 'off', name: 'Power', pins: power });
  return { parts, vcc };
}

// ---- Netlist form: the circuit as components with named nets, no drawing. Used by the MCP server.
// { name, about, components: [{ type, ref?, value?/model?/..., nets: [...] }] }
// Net names: 'GND' is ground, '+9V' style is a supply, anything else is a signal net.
const PIN_NAMES = { R: ['1', '2'], C: ['+ / 1', '2'], L: ['1', '2'], POT: ['lug1', 'wiper', 'lug3'], D: ['anode', 'cathode'],
  NPN: ['C', 'B', 'E'], PNP: ['C', 'B', 'E'], JFET: ['D', 'G', 'S'], NMOS: ['D', 'G', 'S'], LDR: ['1', '2'], NE555: ['trig', 'thr', 'dis', 'out', 'ctrl'], OPA: ['in+', 'in-', 'out'], IN: ['tip'], OUT: ['tip'] };
const PORTS = ['GND', 'V', 'NET'];

function toNetlist(sch) {
  const ex = extract(sch);
  return {
    name: sch.name || '', about: sch.about || '',
    components: ex.comps.filter(e => !PORTS.includes(e.c.type)).map(({ c, nets }) => {
      const o = { type: c.type };
      if (c.ref) o.ref = c.ref;
      for (const k of Object.keys(DEFS[c.type].props)) if (c[k] !== '' && c[k] != null) o[k] = c[k];
      o.nets = nets.map(n => (n === '0' ? 'GND' : n));
      return o;
    }),
    warnings: ex.warnings,
  };
}

const nextId = sch => Math.max(0, ...sch.comps.map(c => c.id), ...sch.wires.map(w => w.id)) + 1;
const isGnd = s => /^(gnd|0)$/i.test(s), isRail = s => isGnd(s) || SUPPLY.test(s);
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 0 up, 1 right, 2 down, 3 left
const pinDir = (type, dx, dy) => (!dx && !dy ? (type === 'IN' ? 1 : 3) : Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 0 : 2) : dx > 0 ? 1 : 3);

// Adds one netlist component (no symbols on its pins yet).
function makeComp(sch, n, x, y, rot, flip) {
  const d = DEFS[n.type];
  if (!d || PORTS.includes(n.type)) throw new Error('Unknown component type "' + n.type + '". Use: ' + Object.keys(PIN_NAMES).join(', '));
  const c = Object.assign({ id: nextId(sch), type: n.type, ref: '', x, y, rot, flip }, d.props);
  for (const k of Object.keys(d.props)) if (n[k] != null) c[k] = k === 'pos' ? Math.max(0, Math.min(1, +n[k])) : String(n[k]);
  if (d.prefix) {
    if (n.ref && sch.comps.some(o => o.ref === n.ref)) throw new Error('Reference ' + n.ref + ' is already used.');
    let k = 1;
    while (sch.comps.some(o => o.ref === d.prefix + k)) k++;
    c.ref = n.ref || d.prefix + k;
  }
  if ((n.nets || []).length !== d.pins.length) throw new Error(`${c.ref || n.type} needs ${d.pins.length} nets in this order: ${PIN_NAMES[n.type].join(', ')}.`);
  sch.comps.push(c);
  return c;
}
// A ground, supply or net-label symbol on a pin, pointing in direction dir.
function addPort(sch, name, x, y, dir) {
  const id = nextId(sch);
  if (isGnd(name)) sch.comps.push({ id, type: 'GND', ref: '', x, y, rot: (dir + 2) % 4, flip: false });
  else if (SUPPLY.test(name)) sch.comps.push({ id, type: 'V', ref: '', x, y, rot: dir, flip: false, value: String(parseFloat(name)) });
  else sch.comps.push({ id, type: 'NET', ref: '', x, y, rot: dir, flip: false, name });
}

// Adds one netlist component at (x, y), with a ground / supply / net-label symbol sitting on each pin.
function placeComponent(sch, n, x, y) {
  const c = makeComp(sch, n, x, y, n.type === 'POT' ? 3 : DEFS[n.type] && DEFS[n.type].pins.length === 2 ? 1 : 0, n.type === 'OPA');
  pinPos(c).forEach((p, j) => addPort(sch, String(n.nets[j]).trim(), p[0], p[1], pinDir(n.type, p[0] - x, p[1] - y)));
  return c;
}

// Fallback drawing: parts on a grid, every connection made with labels on the pins. Always correct, never tidy.
function gridNetlist(nl) {
  const sch = { name: nl.name || 'Untitled', about: nl.about || '', comps: [], wires: [] };
  (nl.components || []).forEach((n, i) => placeComponent(sch, n, 6 + (i % 5) * 14, 6 + Math.floor(i / 5) * 12));
  return sch;
}

// ---- Automatic drawing. The signal path from IN to OUT is laid out left to right, every other part is put next to
// what it connects to (ground ends down, supply ends up), then the nets are wired with a maze router. A connection
// that would need a long wire gets a net label on each end instead. Grounds and supplies are always symbols.
const FLOW3 = [[1, 0], [1, 2]];   // through a transistor: base / gate to collector / drain or emitter / source
const FLOW = { NPN: FLOW3, PNP: FLOW3, JFET: FLOW3, NMOS: FLOW3, OPA: [[0, 2], [1, 2]], NE555: [], IN: [], OUT: [],
  POT: [[0, 1], [1, 0], [1, 2], [2, 1], [0, 2], [2, 0]] };
const BODY = { OPA: [-2, -2, 2, 2], NE555: [-3, -3, 3, 3], IN: [-3, -1, -1, 1], OUT: [1, -1, 3, 1] };   // cells a part covers at rot 0 (default: -1..1)
const K = (x, y) => (x + 4000) * 8192 + y + 4000;
const WIRE_MAX = 34;              // longest wire (in cost units) before two labels are used instead

// Pins, covered cells and a preference cost of one component in one orientation, relative to its origin.
function shape(n, rot, flip, entry, exit) {
  const d = DEFS[n.type], o = { x: 0, y: 0, rot, flip }, pins = d.pins.map(p => xform(o, p));
  const dirs = pins.map(p => pinDir(n.type, p[0], p[1])), cells = [];
  const b = BODY[n.type] || [-1, -1, 1, 1], [ax, ay] = xform(o, [b[0], b[1]]), [bx, by] = xform(o, [b[2], b[3]]);
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) cells.push([x, y]);
  if (d.lab && !BODY[n.type]) {                 // room for the text label
    const [lx, ly] = xform(o, d.lab), y = Math.round(ly);
    const L = Math.ceil(((n.label || n.ref || 'XX') + ' ' + (n.value || n.model || '')).length * 0.33);
    const x0 = lx > 0.5 ? Math.ceil(lx) : lx < -0.5 ? Math.floor(lx) - L : -Math.ceil(L / 2);
    for (let x = x0; x <= x0 + (Math.abs(lx) > 0.5 ? L : 2 * Math.ceil(L / 2)); x++) cells.push([x, y]);
  }
  const xs = pins.map(p => p[0]), ys = pins.map(p => p[1]);
  let cost = rot * 0.1 + (flip ? 0.2 : 0) + (d.pins.length > 2 && n.type !== 'POT' && rot ? 8 : 0);
  if (entry != null) cost += 4 * (pins[entry][0] - Math.min(...xs));
  if (exit != null) cost += 4 * (Math.max(...xs) - pins[exit][0]);
  n.nets.forEach((net, j) => {
    net = String(net).trim();
    if (!isRail(net)) return;
    const up = !isGnd(net), [dx, dy] = DIRS[dirs[j]];
    cost += 3 * (up ? pins[j][1] - Math.min(...ys) : Math.max(...ys) - pins[j][1]) + (dirs[j] === (up ? 0 : 2) ? 0 : 7);   // sideways symbols only when nothing else fits
    cells.push([pins[j][0] + dx, pins[j][1] + dy], [pins[j][0] + 2 * dx, pins[j][1] + 2 * dy]);   // the symbol
  });
  return { rot, flip, pins, dirs, cost, cells: cells.filter(c => !pins.some(p => p[0] === c[0] && p[1] === c[1])) };
}

function drawNetlist(nl, names) {
  const list = (nl.components || []).map(n => Object.assign({}, n, { nets: n.nets.map(s => String(s).trim()) }));
  const netId = new Map();
  for (const n of list) for (const s of n.nets) if (!isRail(s) && !netId.has(s)) netId.set(s, netId.size);
  const idOf = s => (isRail(s) ? -1 : netId.get(s));
  // A net with a big capacitor to a rail carries no signal (half-supply bias, bypassed emitter): the signal path
  // never runs through it. With many pins it is a bias rail: its far ends get labels, like VREF on a hand drawing.
  const quiet = new Set(), bias = new Set();
  for (const n of list) if (n.type === 'C' && parseVal(n.value) >= 1e-6 && isRail(n.nets[0]) !== isRail(n.nets[1])) quiet.add(n.nets.find(s => !isRail(s)));
  for (const s of quiet) if (list.reduce((t, n) => t + n.nets.filter(x => x === s).length, 0) >= 5) bias.add(s);
  const body = new Set(), keep = new Map(), pinNet = new Map(), H = new Map(), V = new Map(), VX = new Map();
  const points = new Map(), paths = new Map(), placed = new Array(list.length).fill(null);
  const used = k => body.has(k) || pinNet.has(k) || H.has(k) || V.has(k);
  const box = [0, 0, 0, 0];

  const fits = (n, sh, x, y) => {
    for (const c of sh.cells) { const k = K(x + c[0], y + c[1]); if (used(k) || keep.has(k)) return false; }
    return sh.pins.every((p, j) => {
      const k = K(x + p[0], y + p[1]), id = idOf(n.nets[j]), [ux, uy] = DIRS[sh.dirs[j]];
      if (body.has(k) || (id < 0 && used(k)) || (keep.has(k) && keep.get(k) !== id)) return false;
      if (id >= 0 && body.has(K(x + p[0] + ux, y + p[1] + uy))) return false;        // a pin needs a way out
      return [pinNet, H, V].every(m => !m.has(k) || m.get(k) === id);
    });
  };
  const put = (i, sh, x, y) => {
    placed[i] = { sh, x, y };
    for (const c of sh.cells) body.add(K(x + c[0], y + c[1]));
    sh.pins.forEach((p, j) => {
      const net = list[i].nets[j], px = x + p[0], py = y + p[1];
      pinNet.set(K(px, py), idOf(net));
      for (const m of [1, 2]) { const k = K(px + m * DIRS[sh.dirs[j]][0], py + m * DIRS[sh.dirs[j]][1]); if (!keep.has(k)) keep.set(k, idOf(net)); }   // kept clear for its wire or label
      if (!isRail(net)) { if (!points.has(net)) points.set(net, []); points.get(net).push([px, py]); }
    });
    for (const c of sh.cells.concat(sh.pins)) {
      box[0] = Math.min(box[0], x + c[0]); box[1] = Math.min(box[1], y + c[1]); box[2] = Math.max(box[2], x + c[0]); box[3] = Math.max(box[3], y + c[1]);
    }
  };
  // records a wire (a list of cells, one step apart) of net id
  const addPath = (id, cells) => {
    cells.forEach((c, i) => {
      const k = K(c[0], c[1]), a = cells[i - 1], b = cells[i + 1];
      const horiz = (a && a[1] === c[1]) || (b && b[1] === c[1]), vert = (a && a[0] === c[0]) || (b && b[0] === c[0]);
      if (horiz) H.set(k, id);
      if (vert) V.set(k, id);
      if (!a || !b || (horiz && vert)) VX.set(k, id);
    });
    if (!paths.has(id)) paths.set(id, []);
    paths.get(id).push({ cells, keys: cells.map(c => K(c[0], c[1])) });
  };
  const orients = (n, entry, exit) => {
    const out = [];
    for (let rot = 0; rot < (BODY[n.type] && n.type !== 'OPA' ? 1 : 4); rot++) for (const flip of BODY[n.type] && n.type !== 'OPA' ? [false] : [false, true]) out.push(shape(n, rot, flip, entry, exit));
    return out.sort((a, b) => a.cost - b.cost);
  };

  // 1. the signal path: shortest chain of parts from the input net to the output net
  const iIn = list.findIndex(n => n.type === 'IN'), iOut = list.findIndex(n => n.type === 'OUT');
  const spine = [];
  if (iIn >= 0 && !isRail(list[iIn].nets[0])) {
    const start = list[iIn].nets[0], goal = iOut >= 0 ? list[iOut].nets[0] : null, prev = new Map([[start, null]]), queue = [start];
    for (let q = 0; q < queue.length && !prev.has(goal); q++) list.forEach((n, i) => {
      for (const [a, b] of FLOW[n.type] || [[0, 1], [1, 0]]) if (n.nets[a] === queue[q] && !isRail(n.nets[b]) && !quiet.has(n.nets[b]) && !prev.has(n.nets[b])) { prev.set(n.nets[b], { i, a, b, from: queue[q] }); queue.push(n.nets[b]); }
    });
    for (let s = prev.get(goal); s; s = prev.get(s.from)) spine.unshift(s);
    let cur = [0, 0];
    put(iIn, shape(list[iIn], 0, false), 0, 0);
    const onSpine = new Set(spine.map(s => s.i).concat(iIn, iOut));
    const step = (i, entry, exit, net) => {
      const others = list.reduce((t, n, k) => t + (onSpine.has(k) ? 0 : n.nets.filter(s => s === net).length), 0);
      const sh = orients(list[i], entry, exit)[0];
      let x = cur[0] + 2 + 4 * Math.min(others, 3) - sh.pins[entry][0];
      while (!fits(list[i], sh, x, cur[1] - sh.pins[entry][1])) x++;
      const y = cur[1] - sh.pins[entry][1], wire = [];
      for (let wx = cur[0]; wx <= x + sh.pins[entry][0]; wx++) wire.push([wx, cur[1]]);
      put(i, sh, x, y);
      addPath(idOf(net), wire);
      points.get(net).push(...wire);
      if (exit != null) cur = [x + sh.pins[exit][0], y + sh.pins[exit][1]];
    };
    for (const s of spine) step(s.i, s.a, s.b, s.from);
    if (spine.length && iOut >= 0) step(iOut, 0, null, goal);
  }

  // 2. everything else, next to what it connects to
  const biasOnly = n => n.nets.every(s => isRail(s) || bias.has(s)), gathered = new Map();
  const near = (n, net) => (biasOnly(n) && gathered.get(net)) || points.get(net);
  const score = (n, sh, x, y) => {
    let c = sh.cost;
    const pull = n.nets.some(s => points.has(s) && !bias.has(s));      // a bias rail only attracts parts that have nothing else
    n.nets.forEach((net, j) => {
      const pts = near(n, net);
      if (!pts || (pull && bias.has(net))) return;
      const px = x + sh.pins[j][0], py = y + sh.pins[j][1], [ux, uy] = DIRS[sh.dirs[j]];
      let best = 1e9;
      for (const [bx, by] of pts) {
        const dx = bx - px, dy = by - py;
        const d = Math.abs(dx) + Math.abs(dy) + (dx && dy ? 2 : 0) + (dx * ux + dy * uy < 0 ? 4 : 0);
        if (d < best) best = d;
      }
      c += best;
    });
    return c;
  };
  for (;;) {
    let i = -1, most = -1;
    list.forEach((n, k) => { if (placed[k]) return; const m = new Set(n.nets.filter(s => points.has(s))).size - 0.9 * new Set(n.nets.filter(s => points.has(s) && bias.has(s))).size; if (m > most) { most = m; i = k; } });
    if (i < 0) break;
    const n = list[i], all = orients(n);
    let best = null, bestCost = 1e9;
    for (const [reach, shapes] of [[6, all.filter(s => s.cost < all[0].cost + 4)], [14, all]]) {
      if (best || !most) break;
      for (const sh of shapes) {
        const seen = new Set();
        n.nets.forEach((net, j) => {
          for (const [ax, ay] of near(n, net) || []) for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
            const x = ax + dx - sh.pins[j][0], y = ay + dy - sh.pins[j][1], k = K(x, y);
            if (seen.has(k)) continue;
            seen.add(k);
            const c = score(n, sh, x, y);
            if (c < bestCost && fits(n, sh, x, y)) { bestCost = c; best = [sh, x, y]; }
          }
        });
      }
    }
    if (!best) {                              // nothing nearby (or not connected to anything yet): a free spot under the drawing
      let x = box[0] + 4;
      while (!fits(n, all[0], x, box[3] + 5)) x++;
      best = [all[0], x, box[3] + 5];
    }
    put(i, ...best);
    if (biasOnly(n)) best[0].pins.forEach((p, j) => { if (bias.has(n.nets[j])) gathered.set(n.nets[j], (gathered.get(n.nets[j]) || []).concat([[best[1] + p[0], best[2] + p[1]]])); });
  }

  // 3. wires. Dijkstra over (cell, direction): a wire may cross another net's wire at right angles, but never
  // bends or ends on it, never touches its corners or pins, and never runs through a part.
  const sch = { name: nl.name || 'Untitled', about: nl.about || '', comps: [], wires: [] };
  const comps = list.map((n, i) => makeComp(sch, n, placed[i].x, placed[i].y, placed[i].sh.rot, placed[i].sh.flip));
  const pinsOf = new Map();
  list.forEach((n, i) => placed[i].sh.pins.forEach((p, j) => {
    const x = placed[i].x + p[0], y = placed[i].y + p[1], dir = placed[i].sh.dirs[j];
    if (isRail(n.nets[j])) addPort(sch, n.nets[j], x, y, dir);
    else { if (!pinsOf.has(n.nets[j])) pinsOf.set(n.nets[j], []); pinsOf.get(n.nets[j]).push({ x, y, dir }); }
  }));
  const foreign = (k, id) => (H.has(k) && H.get(k) !== id) || (V.has(k) && V.get(k) !== id);
  const route = (id, sx, sy, tree, max) => {
    const best = new Map(), prev = new Map(), buckets = [];
    const push = (cost, x, y, d, from) => {
      const s = K(x, y) * 5 + d;
      if (best.has(s) && best.get(s) <= cost) return;
      best.set(s, cost); prev.set(s, from); (buckets[cost] = buckets[cost] || []).push([x, y, d, s]);
    };
    push(0, sx, sy, 4, null);
    for (let c = 0; c <= max; c++) for (let q = 0; buckets[c] && q < buckets[c].length; q++) {
      const [x, y, d, s] = buckets[c][q], k = K(x, y);
      if (best.get(s) !== c) continue;
      const crossing = foreign(k, id);
      if (d !== 4 && tree.has(k) && !crossing) {
        const cells = [];
        for (let t = [x, y, d, s]; t; t = prev.get(t[3])) cells.unshift([t[0], t[1]]);
        return cells;
      }
      for (let e = 0; e < 4; e++) {
        if ((d !== 4 && e === (d + 2) % 4) || (crossing && e !== d)) continue;
        const nx = x + DIRS[e][0], ny = y + DIRS[e][1], nk = K(nx, ny);
        if (nx < box[0] - 4 || nx > box[2] + 4 || ny < box[1] - 4 || ny > box[3] + 4 || body.has(nk)) continue;
        if ((pinNet.has(nk) && pinNet.get(nk) !== id) || (VX.has(nk) && VX.get(nk) !== id)) continue;
        const along = e % 2 ? H : V, across = e % 2 ? V : H;
        if (along.has(nk) && along.get(nk) !== id) continue;
        push(c + 1 + (d !== 4 && e !== d ? 2 : 0) + (across.has(nk) && across.get(nk) !== id ? 3 : 0), nx, ny, e, [x, y, d, s]);
      }
    }
    return null;
  };
  const label = (name, p) => {
    // first choice two free cells, then one, then on top of whatever is there (a label only connects at its own point)
    for (const need of [2, 1, 0]) for (const dir of [p.dir, 0, 2, 1, 3]) {
      const a = K(p.x + DIRS[dir][0], p.y + DIRS[dir][1]), b = K(p.x + 2 * DIRS[dir][0], p.y + 2 * DIRS[dir][1]);
      if ((need > 0 && used(a)) || (need > 1 && used(b))) continue;
      body.add(a); body.add(b);
      addPort(sch, name, p.x, p.y, dir);
      return true;
    }
  };
  const span = ps => Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x)) + Math.max(...ps.map(p => p.y)) - Math.min(...ps.map(p => p.y));
  for (const [name, pins] of [...pinsOf].sort((a, b) => span(a[1]) - span(b[1]))) {
    const id = netId.get(name), tree = new Set();
    if (!paths.has(id)) paths.set(id, []);
    const mine = paths.get(id);
    const grow = k => {                       // everything already joined to cell k
      tree.add(k);
      for (let more = true; more;) {
        more = false;
        for (const p of mine) if (!p.done && p.keys.some(q => tree.has(q))) { p.keys.forEach(q => tree.add(q)); p.done = more = true; }
      }
    };
    grow(K(pins[0].x, pins[0].y));
    let labelled = false;
    const d0 = p => Math.abs(p.x - pins[0].x) + Math.abs(p.y - pins[0].y);
    for (const p of pins.slice(1).sort((a, b) => d0(a) - d0(b))) {
      if (tree.has(K(p.x, p.y))) continue;
      const cells = route(id, p.x, p.y, tree, bias.has(name) ? 8 : WIRE_MAX);
      if (cells) addPath(id, cells);
      else {
        if (!labelled && !pins.some(t => tree.has(K(t.x, t.y)) && label(name, t))) return null;
        if (!label(name, p)) return null;
        labelled = true;
      }
      grow(K(p.x, p.y));
    }
    if (names && !labelled && !pins.some(t => label(name, t))) return null;
  }
  for (const ps of paths.values()) for (const { cells } of ps) {
    let a = cells[0];
    cells.forEach((c, i) => {
      const b = cells[i + 1];
      if (i && (!b || (b[0] !== a[0] && b[1] !== a[1]))) { sch.wires.push({ id: nextId(sch), x1: a[0], y1: a[1], x2: c[0], y2: c[1] }); a = c; }
    });
  }
  const dx = 5 - box[0], dy = 4 - box[1];
  for (const c of sch.comps) { c.x += dx; c.y += dy; }
  for (const w of sch.wires) { w.x1 += dx; w.x2 += dx; w.y1 += dy; w.y2 += dy; }

  // 4. proof: the drawing must give back exactly the connections of the netlist
  const ex = extract(sch).comps.filter(e => !PORTS.includes(e.c.type)), fwd = new Map(), rev = new Map();
  const norm = s => (isGnd(s) ? '0' : SUPPLY.test(s) ? (parseFloat(s) >= 0 ? '+' : '') + parseFloat(s) + 'V' : s);
  const same = ex.length === comps.length && ex.every((e, i) => e.nets.every((a, j) => {
    const b = norm(list[i].nets[j]);
    if (!fwd.has(a)) fwd.set(a, b);
    if (!rev.has(b)) rev.set(b, a);
    return fwd.get(a) === b && rev.get(b) === a && (!names || a === b);
  }));
  return same ? sch : null;
}

// Draws a whole netlist as a schematic. Wired drawing when it can be proven right, else the labelled grid.
// names: false drops the net names (nets become n1, n2, ...) for a cleaner drawing.
function fromNetlist(nl, opt) {
  const ok = (nl.components || []).every(n => DEFS[n.type] && !PORTS.includes(n.type) && (n.nets || []).length === DEFS[n.type].pins.length);
  return (ok && drawNetlist(nl, !opt || opt.names !== false)) || gridNetlist(nl);
}

// Adds a component to an existing drawing. A net that so far only exists as wires gets a label first.
function addComponent(sch, n) {
  const ex = extract(sch);
  for (const raw of n.nets || []) {
    const name = String(raw).trim();
    if (/^(gnd|0)$/i.test(name) || SUPPLY.test(name) || sch.comps.some(c => c.type === 'NET' && String(c.name).trim() === name)) continue;
    let at = null;
    for (const [k, net] of ex.netAt) if (net === name) { at = k.split(',').map(Number); break; }
    if (at) sch.comps.push({ id: Math.max(0, ...sch.comps.map(c => c.id), ...sch.wires.map(w => w.id)) + 1, type: 'NET', ref: '', x: at[0], y: at[1], rot: 0, flip: false, name });
  }
  let maxY = 0, minX = 6;
  for (const c of sch.comps) for (const p of pinPos(c)) { maxY = Math.max(maxY, p[1]); minX = Math.min(minX, p[0]); }
  const c = placeComponent(sch, n, minX + 6, maxY + 8);   // new parts go on their own row under the drawing
  return c;
}

const Schem = { DEFS, SYM, PIN_NAMES, parseVal, xform, pinPos, isPolar, symbol, extract, toSim, toParts, toNetlist, fromNetlist, drawNetlist, addComponent };
if (typeof module !== 'undefined' && module.exports) module.exports = Schem; else root.Schem = Schem;
})(typeof window !== 'undefined' ? window : globalThis);
