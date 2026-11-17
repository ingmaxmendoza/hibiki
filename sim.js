// Hibiki circuit simulator: Modified Nodal Analysis + Newton-Raphson, fixed-step transient.
// Pure JS, no DOM: runs in the browser (window.Sim) and in node (require).
(function (root) {
'use strict';

const VT = 0.025852;   // thermal voltage at ~27 C
const GMIN = 1e-12;    // tiny conductance to ground on every node, keeps floating nodes solvable
const THETA = 0.55;    // integration: 0.5 = trapezoidal, 1 = backward Euler. 0.55 damps trapezoidal ringing.
const AOL = 1e5;       // op-amp open-loop gain
const TOL = 1e-5;      // Newton convergence, volts

// Device models. Values are the usual published SPICE parameters (DC only, no junction capacitances).
// Real parts spread a lot (JFETs and germanium especially): treat them as typical, not exact.
const DIODES = {
  '1N4148':     { Is: 2.52e-9,  n: 1.752 },
  '1N4001':     { Is: 14.11e-9, n: 1.984 },
  '1N34A (Ge)': { Is: 2.6e-6,   n: 1.6 },
  '1N4007':     { Is: 7.03e-9,  n: 1.808 },
  '1N5817':     { Is: 31.7e-6,  n: 1.373 },
  '1N5819':     { Is: 31.7e-6,  n: 1.373 },
  // 5 mm LEDs, fitted to typical forward voltages at 10 mA: red 1.8, orange 2.0, yellow 2.05, green 2.1, blue/white 3.0 V
  'LED red':    { Is: 93.2e-12, n: 3.73 },
  'LED orange': { Is: 3.1e-13,  n: 3.2 },
  'LED yellow': { Is: 1.7e-13,  n: 3.2 },
  'LED green':  { Is: 9.3e-14,  n: 3.2 },
  'LED blue':   { Is: 3.4e-15,  n: 4 },
  'LED white':  { Is: 2.5e-15,  n: 4 },
  // Zeners (1 W): Bv is the nominal voltage at the datasheet test current Izt. Reverse knee is an exponential fitted through that point.
  '1N4728A':    { Is: 14.11e-9, n: 1.984, Bv: 3.3,  Izt: 0.076 },
  '1N4733A':    { Is: 14.11e-9, n: 1.984, Bv: 5.1,  Izt: 0.049 },
  '1N4739A':    { Is: 14.11e-9, n: 1.984, Bv: 9.1,  Izt: 0.028 },
  '1N4742A':    { Is: 14.11e-9, n: 1.984, Bv: 12,   Izt: 0.021 },
};
const BJTS = {   // pins: TO-92 pin order, flat side facing you, left to right
  '2N5088': { pnp: false, Is: 5.911e-15, Bf: 1122,  Br: 1.271, pins: 'EBC' },
  '2N3904': { pnp: false, Is: 6.734e-15, Bf: 416.4, Br: 0.7371, pins: 'EBC' },
  '2N2222': { pnp: false, Is: 14.34e-15, Bf: 255.9, Br: 6.092, pins: 'EBC' },
  'BC547':  { pnp: false, Is: 2.39e-14,  Bf: 294.3, Br: 7.946, pins: 'CBE' },
  'BC108':  { pnp: false, Is: 1.8e-14,   Bf: 400,   Br: 35.5,  pins: 'CBE' },
  '2N3906': { pnp: true,  Is: 1.41e-15,  Bf: 180.7, Br: 4.977, pins: 'EBC' },
  'BC557':  { pnp: true,  Is: 3.8e-14,   Bf: 250,   Br: 10,    pins: 'CBE' },
  'AC128 (Ge)': { pnp: true, Is: 2e-6,   Bf: 90,    Br: 10,    pins: 'EBC' },
  'OC44 (Ge)':  { pnp: true, Is: 1e-6,   Bf: 100,   Br: 10,    pins: 'EBC' },   // typical figures, not a fitted model
};
const JFETS = {  // N-channel, Shichman-Hodges
  'J201':   { Vto: -0.8, Beta: 1.25e-3, Lambda: 2e-3, pins: 'DSG' },
  '2N5457': { Vto: -1.8, Beta: 1.1e-3,  Lambda: 2e-3, pins: 'DSG' },
  'MPF102': { Vto: -3.0, Beta: 1.0e-3,  Lambda: 2e-3, pins: 'DSG' },
};
const MOSFETS = { // N-channel enhancement, Shichman-Hodges. Beta (= Kp/2) fitted to datasheet typical Vth and gfs; real Vth spreads +/-1 V
  '2N7000':  { Vto: 2.1, Beta: 0.05, Lambda: 0.01,  pins: 'SGD' },
  'BS170':   { Vto: 2.1, Beta: 0.1,  Lambda: 0.01,  pins: 'DGS' },
  'IRFZ44N': { Vto: 3.0, Beta: 3.6,  Lambda: 0.005, pins: 'GDS' },   // TO-220, legs in line
};
const OPAMPS = { // hi/lo: how close the output gets to each supply rail, volts. units: op-amps per package (1, 2 = DIP-8, 4 = DIP-14)
  'TL072':   { hi: 1.5, lo: 1.5, units: 2 },
  'TL082':   { hi: 1.5, lo: 1.5, units: 2 },
  'NE5532':  { hi: 2.0, lo: 2.0, units: 2 },
  'RC4558':  { hi: 1.5, lo: 1.5, units: 2 },
  'LM358':   { hi: 1.5, lo: 0.05, units: 2 },
  'LM833':   { hi: 1.5, lo: 1.5, units: 2 },
  'OPA2134': { hi: 1.5, lo: 1.5, units: 2 },
  'TLC2272': { hi: 0.1, lo: 0.1, units: 2 },
  'TL074':   { hi: 1.5, lo: 1.5, units: 4 },
  'TL084':   { hi: 1.5, lo: 1.5, units: 4 },
  'LM324':   { hi: 1.5, lo: 0.05, units: 4 },
  'TL071':   { hi: 1.5, lo: 1.5, units: 1 },
  'TL081':   { hi: 1.5, lo: 1.5, units: 1 },
  'NE5534':  { hi: 2.0, lo: 2.0, units: 1 },
  'LM741':   { hi: 2.0, lo: 2.0, units: 1 },
  'LM308':   { hi: 1.5, lo: 1.5, units: 1 },
};

// Fraction of the pot track between lug 1 and the wiper for knob position pos (0..1).
function potFrac(pos, taper) {
  if (taper === 'log') return (Math.pow(81, pos) - 1) / 80;            // 10% at half rotation
  if (taper === 'rev') return 1 - (Math.pow(81, 1 - pos) - 1) / 80;
  return pos;
}

// SPICE junction voltage limiting: stops exp() from blowing up between Newton iterations.
function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else vnew = vt * Math.log(vnew / vt);
  }
  return vnew;
}
const vcrit = (Is, vt) => vt * Math.log(vt / (Math.SQRT2 * Is));

// Dense Gaussian elimination with partial pivoting; solution is left in b. Returns false if singular.
function gauss(A, b, n) {
  for (let k = 0; k < n; k++) {
    let p = k, max = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > max) { max = v; p = i; } }
    if (max < 1e-30) return false;
    if (p !== k) {
      for (let j = k; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; }
      const t = b[k]; b[k] = b[p]; b[p] = t;
    }
    const pk = k * n, piv = A[pk + k];
    for (let i = k + 1; i < n; i++) {
      const ri = i * n, f = A[ri + k] / piv;
      if (f === 0) continue;
      for (let j = k + 1; j < n; j++) A[ri + j] -= f * A[pk + j];
      b[i] -= f * b[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * b[j];
    b[i] = s / A[i * n + i];
  }
  return true;
}

// netlist: { comps: [ {type, n:[node names], ...} ] }, node '0' is ground. Types:
//  R,C,L {value}  POT {n:[lug1,wiper,lug3], value, pos, taper}  D {n:[anode,cathode], model}
//  Q {n:[c,b,e], model, hfe?}  J {n:[d,g,s], model}  U {n:[in+,in-,out], model}
//  M {n:[d,g,s], model} (N-MOSFET)   LDR {n:[a,b], dark, lit, light 0..1, led?: ref of the D that lights it}
//  T {n:[trig,thr,dis,out,ctrl]} (555, powered from the highest supply and ground, reset tied high)
//  V {n:[node], value}  (DC supply to ground)   IN {n:[node], rs, ls}   OUT {n:[node], rload}
function Circuit(net) {
  const idx = new Map();
  const node = name => { if (name === '0') return -1; if (!idx.has(name)) idx.set(name, idx.size); return idx.get(name); };
  this.R = []; this.C = []; this.L = []; this.V = []; this.D = []; this.Q = []; this.J = []; this.U = []; this.O = []; this.T = [];
  this.out = -2; this.error = null;
  let vmax = 0, vmin = 0, any = false;
  const res = (a, b, r) => { if (a !== b) this.R.push({ a, b, r: Math.max(r, 0.1) }); };
  const diode = (a, k, Is, nvt) => ({ a, k, Is, nvt, vc: vcrit(Is, nvt), vo: 0 });
  const vsrc = (p, value, input) => { if (p >= 0 && !this.V.some(v => v.p === p)) this.V.push({ p, value, input }); };
  for (const c of net.comps) {
    const n = c.n.map(node);
    switch (c.type) {
      case 'R': res(n[0], n[1], c.value); break;
      case 'C': if (n[0] !== n[1]) this.C.push({ a: n[0], b: n[1], c: c.value, v: 0, i: 0, g: 0, ieq: 0 }); break;
      case 'L': if (n[0] !== n[1]) this.L.push({ a: n[0], b: n[1], l: c.value, v: 0, i: 0, g: 0, ieq: 0 }); break;
      case 'POT': { const f = potFrac(c.pos, c.taper); res(n[0], n[1], c.value * f); res(n[1], n[2], c.value * (1 - f)); break; }
      case 'D': {
        const m = DIODES[c.model] || DIODES['1N4148'], d = diode(n[0], n[1], m.Is, m.n * VT);
        d.ref = c.ref; this.D.push(d);
        if (m.Bv) {                        // zener: a second junction the other way round, shifted so it carries Izt at Bv
          const z = diode(n[1], n[0], 1e-12, 2 * VT);
          z.off = m.Bv - z.nvt * Math.log(m.Izt / z.Is); this.D.push(z);
        }
        break;
      }
      case 'Q': {
        const m = BJTS[c.model] || BJTS['2N3904'];
        this.Q.push({ c: n[0], b: n[1], e: n[2], pol: m.pnp ? -1 : 1, Is: m.Is, Bf: c.hfe || m.Bf, Br: m.Br, vc: vcrit(m.Is, VT), vbe: 0, vbc: 0 });
        break;
      }
      case 'J': {
        const m = JFETS[c.model] || JFETS['J201'];
        this.J.push({ d: n[0], g: n[1], s: n[2], m, ds: [diode(n[1], n[2], 1e-14, VT), diode(n[1], n[0], 1e-14, VT)] });
        break;
      }
      case 'M': {                          // same square law as the JFET, insulated gate, body diode source -> drain
        const m = MOSFETS[c.model] || MOSFETS['2N7000'];
        this.J.push({ d: n[0], g: n[1], s: n[2], m, ds: [diode(n[2], n[0], 1e-12, VT)] });
        break;
      }
      case 'LDR': if (n[0] !== n[1]) this.O.push({ a: n[0], b: n[1], dark: c.dark, k: Math.max(Math.log(c.dark / Math.max(c.lit, 1)), 1e-3), light: c.light, x: c.light, led: c.led }); break;
      case 'T': this.T.push({ trig: n[0], thr: n[1], dis: n[2], out: n[3], ctrl: n[4], st: 1 }); break;
      case 'U': { const m = OPAMPS[c.model] || OPAMPS['TL072']; this.U.push({ p: n[0], n: n[1], o: n[2], m, st: 0 }); break; }
      case 'V': vsrc(n[0], c.value, false); vmax = Math.max(vmax, c.value); vmin = Math.min(vmin, c.value); any = true; break;
      case 'IN': {
        let p = n[0];
        if (c.ls > 0) { const q = node(c.ref + '#l'); this.L.push({ a: q, b: p, l: c.ls, v: 0, i: 0, g: 0, ieq: 0 }); p = q; }
        if (c.rs > 0) { const q = node(c.ref + '#r'); res(q, p, c.rs); p = q; }
        vsrc(p, 0, true);
        break;
      }
      case 'OUT': if (this.out === -2) this.out = n[0]; if (c.rload > 0) res(n[0], -1, c.rload); break;
    }
  }
  this.vcc = vmax;
  for (const o of this.O) o.d = (o.led && this.D.find(d => d.ref === o.led)) || null;
  for (const u of this.U) { u.vhi = any ? vmax - u.m.hi : 1e9; u.vlo = any ? vmin + u.m.lo : -1e9; }
  this.nodes = idx; this.nn = idx.size;
  let nb = this.nn;
  for (const v of this.V) v.br = nb++;
  for (const u of this.U) u.br = nb++;
  const N = this.N = nb;
  this.nonlinear = this.D.length + this.Q.length + this.J.length + this.U.length > 0;   // LDRs and 555s are linear within one solve
  this.base = new Float64Array(N * N); this.M = new Float64Array(N * N);
  this.lin = new Float64Array(N); this.rhs = new Float64Array(N); this.x = new Float64Array(N);
  this.h = 0; this.failed = 0;
}

// Builds the constant part of the matrix for time step h (h = 0: DC, capacitors open, inductors shorted).
Circuit.prototype.build = function (h) {
  const N = this.N, B = this.base;
  B.fill(0);
  const g2 = (a, b, g) => {
    if (a >= 0) B[a * N + a] += g;
    if (b >= 0) B[b * N + b] += g;
    if (a >= 0 && b >= 0) { B[a * N + b] -= g; B[b * N + a] -= g; }
  };
  for (let i = 0; i < this.nn; i++) B[i * N + i] += GMIN;
  for (const r of this.R) g2(r.a, r.b, 1 / r.r);
  for (const c of this.C) { c.g = h ? c.c / (h * THETA) : 0; g2(c.a, c.b, c.g); }
  for (const l of this.L) { l.g = h ? h * THETA / l.l : 1e3; g2(l.a, l.b, l.g); }
  for (const v of this.V) { B[v.p * N + v.br] += 1; B[v.br * N + v.p] += 1; }
  for (const u of this.U) if (u.o >= 0) B[u.o * N + u.br] += 1;
  this.h = h;
};

// One Newton solve at the current time point. Returns iterations used, 0 = not converged, -1 = singular.
Circuit.prototype.solve = function (vin, scale, maxIt) {
  const N = this.N, M = this.M, rhs = this.rhs, x = this.x, lin = this.lin, nn = this.nn;
  const V = i => (i >= 0 ? x[i] : 0);
  const G = (a, b, g) => {                 // conductance g between a and b
    if (a >= 0) M[a * N + a] += g;
    if (b >= 0) M[b * N + b] += g;
    if (a >= 0 && b >= 0) { M[a * N + b] -= g; M[b * N + a] -= g; }
  };
  const I = (a, b, i) => { if (a >= 0) rhs[a] -= i; if (b >= 0) rhs[b] += i; };   // current i flowing a -> b
  const T = (a, b, c, d, g) => {           // current a -> b equal to g * (Vc - Vd)
    if (a >= 0) { if (c >= 0) M[a * N + c] += g; if (d >= 0) M[a * N + d] -= g; }
    if (b >= 0) { if (c >= 0) M[b * N + c] -= g; if (d >= 0) M[b * N + d] += g; }
  };
  const junction = (d, pol) => {           // diode d.a -> d.k, returns [current, conductance, limited voltage]
    const off = d.off || 0, raw = pol * (V(d.a) - V(d.k)) - off, v = pnjlim(raw, d.vo, d.nvt, d.vc);
    if (Math.abs(v - raw) > TOL) limited = true;
    d.vo = v;
    const e = Math.exp(v / d.nvt);
    return [d.Is * (e - 1), d.Is * e / d.nvt + GMIN, v + off];
  };

  lin.fill(0);
  for (const v of this.V) lin[v.br] = (v.input ? vin : v.value) * scale;
  if (this.h) {
    for (const c of this.C) { if (c.a >= 0) lin[c.a] += c.ieq; if (c.b >= 0) lin[c.b] -= c.ieq; }
    for (const l of this.L) { if (l.a >= 0) lin[l.a] -= l.ieq; if (l.b >= 0) lin[l.b] += l.ieq; }
  }

  let limited = false;                     // a junction voltage was clamped: the solution is not final yet
  for (let it = 1; it <= maxIt; it++) {
    M.set(this.base); rhs.set(lin); limited = false;
    for (const d of this.D) {
      const [id, g, v] = junction(d, 1);
      G(d.a, d.k, g); I(d.a, d.k, id - g * v);
    }
    for (const q of this.Q) {              // Ebers-Moll transport model
      const pol = q.pol;
      const rbe = pol * (V(q.b) - V(q.e)), rbc = pol * (V(q.b) - V(q.c));
      const vbe = q.vbe = pnjlim(rbe, q.vbe, VT, q.vc), vbc = q.vbc = pnjlim(rbc, q.vbc, VT, q.vc);
      if (Math.abs(vbe - rbe) > TOL || Math.abs(vbc - rbc) > TOL) limited = true;
      const ef = Math.exp(vbe / VT), er = Math.exp(vbc / VT);
      const If = q.Is * (ef - 1), Ir = q.Is * (er - 1);
      const gf = q.Is * ef / VT + GMIN, gr = q.Is * er / VT + GMIN;
      G(q.b, q.e, gf / q.Bf); I(q.b, q.e, pol * (If / q.Bf - gf / q.Bf * vbe));
      G(q.b, q.c, gr / q.Br); I(q.b, q.c, pol * (Ir / q.Br - gr / q.Br * vbc));
      T(q.c, q.e, q.b, q.e, gf); T(q.c, q.e, q.b, q.c, -gr);
      I(q.c, q.e, pol * (If - Ir - gf * vbe + gr * vbc));
    }
    for (const j of this.J) {
      for (const d of j.ds) { const [id, g, v] = junction(d, 1); G(d.a, d.k, g); I(d.a, d.k, id - g * v); }
      let d = j.d, s = j.s;
      if (V(d) < V(s)) { d = j.s; s = j.d; }   // symmetric device: the lower terminal acts as source
      const vgs = V(j.g) - V(s), vds = V(d) - V(s), vgst = vgs - j.m.Vto, b = j.m.Beta, lam = 1 + j.m.Lambda * vds;
      let id = 0, gm = 0, gds = 0;
      if (vgst > 0) {
        if (vds < vgst) {
          id = b * vds * (2 * vgst - vds) * lam; gm = 2 * b * vds * lam;
          gds = b * (2 * vgst - 2 * vds) * lam + j.m.Lambda * b * vds * (2 * vgst - vds);
        } else { id = b * vgst * vgst * lam; gm = 2 * b * vgst * lam; gds = j.m.Lambda * b * vgst * vgst; }
      }
      gds += 1e-9;
      T(d, s, j.g, s, gm); G(d, s, gds); I(d, s, id - gm * vgs - gds * vds);
    }
    for (const o of this.O) G(o.a, o.b, Math.exp(o.k * o.x) / o.dark);
    for (const t of this.T) {              // 555: the latch only changes between solves (tick), so here it is plain resistors and sources
      G(t.ctrl, -1, 3e-4); if (t.ctrl >= 0) rhs[t.ctrl] += this.vcc / 5000 * scale;                    // internal 5k / 10k divider
      G(t.out, -1, 0.1); if (t.out >= 0) rhs[t.out] += 0.1 * (t.st ? this.vcc - 1.4 : 0.1) * scale;    // output stage, 10 ohm
      if (!t.st) G(t.dis, -1, 0.1);                                                                    // discharge transistor on
    }
    for (const u of this.U) {              // ideal gain when linear, fixed voltage when clipped at a rail
      const r = u.br * N;
      if (u.st === 0) { if (u.p >= 0) M[r + u.p] += 1; if (u.n >= 0) M[r + u.n] -= 1; if (u.o >= 0) M[r + u.o] -= 1 / AOL; }
      else { if (u.o >= 0) M[r + u.o] += 1; rhs[u.br] = u.st > 0 ? u.vhi : u.vlo; }
    }
    if (!gauss(M, rhs, N)) return -1;
    let err = 0;
    for (let i = 0; i < nn; i++) { const e = Math.abs(rhs[i] - x[i]); if (!(e <= err)) err = e; }
    x.set(rhs);
    if (!this.nonlinear) return 1;
    let changed = false;
    for (const u of this.U) {
      const want = AOL * (V(u.p) - V(u.n));
      let st = u.st;
      if (st === 0) { if (V(u.o) > u.vhi) st = 1; else if (V(u.o) < u.vlo) st = -1; }
      else if ((st > 0 && want < u.vhi) || (st < 0 && want > u.vlo)) st = 0;
      if (st !== u.st) { u.st = st; changed = true; }
    }
    if (err < TOL && !changed && !limited) return it;
    if (err !== err) return -1;            // NaN
  }
  return 0;
};

// Light level 0..1 that the coupled LED puts on an LDR: 1 at 20 mA, resistance falling as current^0.7 (typical CdS cell).
// Calibrate with the LDR's own `lit` and `dark` resistances.
Circuit.prototype.lux = function (o) {
  const i = o.d.Is * (Math.exp(o.d.vo / o.d.nvt) - 1);
  return i > 1e-12 ? Math.max(0, Math.min(1, 1 + 0.7 * Math.log(i / 0.02) / o.k)) : 0;
};
// State that changes between solves: 555 latches, and LDRs following their LED (h = 0: jump straight there, for DC).
// ponytail: the 555 switches on sample boundaries, fine for an LFO; an audio-rate 555 will alias, interpolate the crossing if that matters.
Circuit.prototype.tick = function (h) {
  let changed = false;
  for (const t of this.T) {
    const cv = this.vof(t.ctrl), st = this.vof(t.trig) < cv / 2 ? 1 : this.vof(t.thr) > cv ? 0 : t.st;
    if (st !== t.st) { t.st = st; changed = true; }
  }
  for (const o of this.O) if (o.d) {
    const want = this.lux(o);
    if (!h) { if (Math.abs(want - o.x) > 1e-3) changed = true; o.x = want; }
    else o.x += (want - o.x) * (1 - Math.exp(-h / (want > o.x ? 0.003 : 0.03)));   // CdS cells are slow: about 3 ms to light up, 30 ms to recover
  }
  return changed;
};

Circuit.prototype.reset = function (keep) {
  this.x.fill(0);
  for (const d of this.D) d.vo = 0;
  for (const q of this.Q) q.vbe = q.vbc = 0;
  for (const j of this.J) for (const d of j.ds) d.vo = 0;
  for (const u of this.U) u.st = 0;
  if (keep) return;
  for (const t of this.T) t.st = 1;        // as at power-up: timing capacitor empty, output high
  for (const o of this.O) o.x = o.light;
};

// DC operating point (input at 0 V). Falls back to ramping the supplies if plain Newton fails.
Circuit.prototype.dc = function () {
  this.error = null;
  if (!this.N) return true;
  this.build(0); this.reset();
  let r = 0;
  for (let pass = 0; pass < 4; pass++) {   // 555 latches and LED-lit LDRs settle between solves (an astable 555 never does: 4 tries, then go)
    r = this.solve(0, 1, 300);
    if (r === 0) {
      this.reset(true);
      for (let s = 1; s <= 20 && r >= 0; s++) r = this.solve(0, s / 20, 200);
    }
    if (r <= 0 || !this.tick(0)) break;
  }
  if (r < 0) this.error = 'Circuit cannot be solved (singular): check for shorted supplies or an output wired to a supply.';
  else if (r === 0) this.error = 'DC operating point did not converge.';
  for (const c of this.C) { c.v = this.vof(c.a) - this.vof(c.b); c.i = 0; }
  for (const l of this.L) { l.v = 0; l.i = (this.vof(l.a) - this.vof(l.b)) * 1e3; }
  return r > 0;
};
Circuit.prototype.vof = function (i) { return i >= 0 ? this.x[i] : 0; };
Circuit.prototype.voltage = function (name) { return name === '0' ? 0 : this.nodes.has(name) ? this.x[this.nodes.get(name)] : NaN; };

// Prepare a transient run at fs samples per second. Returns false if the circuit has no DC solution.
Circuit.prototype.start = function (fs) {
  const ok = this.dc();
  this.build(1 / fs); this.failed = 0; this.prevIn = 0;
  return ok && this.N > 0;
};

Circuit.prototype.step = function (vin) {
  const k = (1 - THETA) / THETA, h = this.h;
  for (const c of this.C) c.ieq = c.g * c.v + k * c.i;
  for (const l of this.L) l.ieq = l.i + h * (1 - THETA) / l.l * l.v;
  if (this.solve(vin, 1, 40) <= 0) this.failed++;
  this.tick(h);
  for (const c of this.C) { const v = this.vof(c.a) - this.vof(c.b); c.i = c.g * v - c.ieq; c.v = v; }
  for (const l of this.L) { const v = this.vof(l.a) - this.vof(l.b); l.i = l.g * v + l.ieq; l.v = v; }
  return this.out >= 0 ? this.x[this.out] : 0;
};

// Process a block: inp in volts at the audio rate, the circuit runs at os times that rate
// (start() must have been called with fs * os).
// ponytail: linear-interpolation upsampling and boxcar decimation; swap for a polyphase FIR if aliasing is audible.
Circuit.prototype.process = function (inp, out, os, from, to) {
  for (let i = from; i < to; i++) {
    const v = inp[i];
    let acc = 0;
    for (let k = 1; k <= os; k++) acc += this.step(this.prevIn + (v - this.prevIn) * k / os);
    this.prevIn = v;
    out[i] = acc / os;
  }
};

const Sim = { Circuit, DIODES, BJTS, JFETS, MOSFETS, OPAMPS, potFrac };
if (typeof module !== 'undefined' && module.exports) module.exports = Sim; else root.Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
