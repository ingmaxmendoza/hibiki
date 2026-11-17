// Self-check: node test.js
// Simulator against hand-calculated answers, then every preset through netlist, simulation and both layouts.
const assert = require('assert');
const Sim = require('./sim.js'), Schem = require('./schem.js'), Layout = require('./layout.js'), Presets = require('./presets.js');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} +/- ${tol}`);
const FS = 48000;

function run(net, input, os = 1) {
  const c = new Sim.Circuit(net);
  assert(c.start(FS * os), 'start failed: ' + c.error);
  const out = new Float32Array(input.length);
  c.process(input, out, os, 0, input.length);
  return { c, out };
}
const sine = (f, amp, n) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / FS));
const peak = (a, from = 0) => a.slice(from).reduce((m, v) => Math.max(m, Math.abs(v)), 0);

// values
near(Schem.parseVal('4k7'), 4700, 1e-9, 'parse 4k7');
near(Schem.parseVal('2.2u'), 2.2e-6, 1e-12, 'parse 2.2u');
near(Schem.parseVal('1M'), 1e6, 1e-6, 'parse 1M');

// divider
{
  const c = new Sim.Circuit({ comps: [{ type: 'V', n: ['v'], value: 9 }, { type: 'R', n: ['v', 'm'], value: 1e4 }, { type: 'R', n: ['m', '0'], value: 1e4 }] });
  assert(c.dc()); near(c.voltage('m'), 4.5, 1e-6, 'divider');
}
// RC low-pass step response: v(t) = 1 - exp(-t/RC), RC = 1 ms
{
  const net = { comps: [{ type: 'IN', ref: 'i', n: ['a'], rs: 0, ls: 0 }, { type: 'R', n: ['a', 'b'], value: 1e3 }, { type: 'C', n: ['b', '0'], value: 1e-6 }, { type: 'OUT', n: ['b'], rload: 0 }] };
  const { out } = run(net, new Float32Array(480).fill(1));
  near(out[47], 1 - Math.exp(-(48 / FS) / 1e-3), 0.01, 'RC at 1 ms');
  near(out[479], 1, 1e-3, 'RC settled');
}
// RC low-pass at its corner frequency: -3 dB
{
  const net = { comps: [{ type: 'IN', ref: 'i', n: ['a'], rs: 0, ls: 0 }, { type: 'R', n: ['a', 'b'], value: 1e3 }, { type: 'C', n: ['b', '0'], value: 159.155e-9 }, { type: 'OUT', n: ['b'], rload: 0 }] };
  const { out } = run(net, sine(1000, 1, 4800), 2);
  near(peak(out, 2400), Math.SQRT1_2, 0.01, 'RC -3 dB');
}
// diode clipper: 1 V sine through 1k into antiparallel 1N4148s clips near +/-0.6 V, symmetric
{
  const net = { comps: [{ type: 'IN', ref: 'i', n: ['a'], rs: 0, ls: 0 }, { type: 'R', n: ['a', 'b'], value: 1e3 },
    { type: 'D', n: ['b', '0'], model: '1N4148' }, { type: 'D', n: ['0', 'b'], model: '1N4148' }, { type: 'OUT', n: ['b'], rload: 0 }] };
  const { out, c } = run(net, sine(440, 2, 4800));
  const hi = Math.max(...out), lo = Math.min(...out);
  assert(hi > 0.5 && hi < 0.7, 'clip level ' + hi); near(hi, -lo, 0.01, 'clip symmetry'); assert.strictEqual(c.failed, 0);
}
// op-amp non-inverting gain 11, then clipping at the rails (TL072 on 9 V: 1.5 .. 7.5)
{
  const net = a => ({ comps: [{ type: 'V', n: ['vcc'], value: 9 }, { type: 'R', n: ['vcc', 'ref'], value: 1e4 }, { type: 'R', n: ['ref', '0'], value: 1e4 },
    { type: 'C', n: ['ref', '0'], value: 47e-6 }, { type: 'IN', ref: 'i', n: ['a'], rs: 0, ls: 0 }, { type: 'C', n: ['a', 'p'], value: 1e-6 },
    { type: 'R', n: ['p', 'ref'], value: 1e6 }, { type: 'U', n: ['p', 'm', 'o'], model: 'TL072' }, { type: 'R', n: ['o', 'm'], value: 1e5 },
    { type: 'R', n: ['m', 'ref'], value: 1e4 }, { type: 'OUT', n: ['o'], rload: 0 }] });
  let r = run(net(), sine(1000, 0.1, 4800));
  near(r.c.voltage('ref'), 4.5, 0.01, 'vref');
  near((Math.max(...r.out.slice(2400)) - Math.min(...r.out.slice(2400))) / 2, 1.1, 0.02, 'op-amp gain 11');
  r = run(net(), sine(1000, 1, 4800));
  near(Math.max(...r.out), 7.5, 0.01, 'op-amp high rail'); near(Math.min(...r.out), 1.5, 0.01, 'op-amp low rail');
  assert.strictEqual(r.c.failed, 0, 'op-amp clipping converges');
}
// inductor: RL high-pass corner. L = 159.155 mH, R = 1k -> 1 kHz
{
  const net = { comps: [{ type: 'IN', ref: 'i', n: ['a'], rs: 0, ls: 0 }, { type: 'R', n: ['a', 'b'], value: 1e3 }, { type: 'L', n: ['b', '0'], value: 0.159155 }, { type: 'OUT', n: ['b'], rload: 0 }] };
  near(peak(run(net, sine(1000, 1, 4800), 2).out, 2400), Math.SQRT1_2, 0.01, 'RL -3 dB');
}

// presets
const expectGain = { 'Transistor booster': [4, 30], 'Two-transistor fuzz': [1, 200], 'Op-amp overdrive': [1, 60], 'Op-amp distortion': [0.2, 40], 'JFET preamp': [3, 30], 'Optical tremolo (555)': [0.1, 1.1], 'Optical compressor': [4, 25],
  'Sovtek Big Muff (Civil War / Green Russian)': [1, 500], 'EHX Big Muff (Ram\'s Head "47", 1973)': [1, 500], 'Orange Squeezer compressor (JFET)': [1, 30], 'Sovtek Red Army Overdrive (first Russian Big Muff, 1990)': [1, 500],
  'Sovtek Big Muff (Black Russian)': [1, 500], 'EHX Big Muff (Triangle, V1 1967)': [1, 500], 'EHX Big Muff (V6, 1978-84)': [1, 500] };
for (const name of Presets.names) {
  const sch = Presets.load(name), ex = Schem.extract(sch);
  assert.deepStrictEqual(ex.warnings, [], name + ' warnings');
  if (Presets.pedals[name]) {            // netlist examples: drawn with wires (not the label-grid fallback), same connections either way
    const nl = Presets.pedals[name];
    assert(Schem.drawNetlist(nl, false), name + ': automatic drawing fell back to the label grid');
    assert.deepStrictEqual(Schem.toNetlist(Schem.fromNetlist(nl)).components.map(c => c.nets), nl.components.map(c => c.nets), name + ' drawing matches its netlist');
  }
  const c = new Sim.Circuit(Schem.toSim(ex));
  assert(c.start(FS * 2), name + ': ' + c.error);
  const dc = {};
  for (const n of c.nodes.keys()) dc[n] = +c.x[c.nodes.get(n)].toFixed(3);
  const inp = sine(220, 0.01, 9600), out = new Float32Array(inp.length);
  c.process(inp, out, 2, 0, inp.length);
  const tail = out.slice(4800), g = (Math.max(...tail) - Math.min(...tail)) / 0.02;
  assert.strictEqual(c.failed, 0, name + ' convergence');
  const [lo, hi] = expectGain[name] || (Presets.pedals[name] && Presets.pedals[name].gain) || [0.2, 500];   // pedals: anything alive and sane
  assert(g > lo && g < hi, `${name}: small-signal gain ${g.toFixed(2)} outside ${lo}..${hi}`);
  // loud input must stay finite and bounded by the supply
  const c2 = new Sim.Circuit(Schem.toSim(ex)); c2.start(FS * 2);
  const loud = sine(220, 0.5, 9600), out2 = new Float32Array(loud.length);
  c2.process(loud, out2, 2, 0, loud.length);
  assert(out2.every(v => Math.abs(v) < 9.5), name + ' output bounded');
  const { parts, vcc } = Schem.toParts(ex);
  const sizes = [];
  for (const kind of ['bread', 'strip']) {
    const L = Layout.auto(kind, parts, vcc), errs = Layout.verify(L, parts);
    assert.deepStrictEqual(errs, [], `${name} ${kind} layout`);
    assert.strictEqual(L.parts.length, parts.filter(p => p.kind !== 'off').length, `${name} ${kind} all parts placed`);
    sizes.push(`${kind} ${L.cols}x${L.rows}`);
  }
  console.log(`${name}: gain x${g.toFixed(1)}, loud peak ${peak(out2, 4800).toFixed(2)} V, failed steps ${c2.failed}, ${sizes.join(', ')}`);
  console.log('   DC:', JSON.stringify(dc));
}
// LED models: forward voltage at 10 mA within 0.15 V of the typical value
for (const [m, vf] of [['LED red', 1.8], ['LED orange', 2.0], ['LED yellow', 2.05], ['LED green', 2.1], ['LED blue', 3.0], ['LED white', 3.0]]) {
  const d = Sim.DIODES[m];
  near(d.n * 0.025852 * Math.log(0.01 / d.Is), vf, 0.15, m + ' Vf');
}
// quad op-amp: one TL084 section still gets a 14-pin package, and both boards verify
{
  const sch = Presets.load('Op-amp overdrive');
  sch.comps.find(c => c.type === 'OPA').model = 'TL084';
  const { parts, vcc } = Schem.toParts(Schem.extract(sch)), ic = parts.find(p => p.kind === 'dip');
  assert.strictEqual(ic.nets.length, 14, 'TL084 is DIP-14');
  assert.strictEqual(ic.nets[3], vcc); assert.strictEqual(ic.nets[10], '0');
  for (const kind of ['bread', 'strip']) assert.deepStrictEqual(Layout.verify(Layout.auto(kind, parts, vcc), parts), [], 'TL084 ' + kind);
}
// building blocks: wire each one between an input and an output jack; nothing may dangle and it must pass signal
for (const name of Presets.blocks) {
  const b = Presets.block(name), sch = { comps: b.comps.map((c, i) => Object.assign({ id: i + 1, ref: 'X' + i }, c)), wires: b.wires };
  const tg = Presets.tags(name), led = sch.comps.find(c => c.type === 'D' && /LED/.test(c.model));
  assert(tg[0] !== 'other' && name.includes(': '), name + ' needs a known category');
  for (const c of sch.comps) if (c.led === '@') c.led = led ? led.ref : '';     // the app links an LDR to an LED when the block is placed
  if (!b.io) { Schem.extract(sch); continue; }
  const [ix, iy] = b.io[0];
  if (b.vref) {                           // active block: bias its free resistor ends at half supply, feed it through a cap
    b.vref.forEach((p, i) => sch.comps.push({ id: 800 + i, type: 'V', ref: '', x: p[0], y: p[1], rot: 0, value: '4.5' }));
    sch.comps.push({ id: 899, type: 'V', ref: '', x: 200, y: 200, rot: 0, value: '9' }, { id: 897, type: 'GND', ref: '', x: 210, y: 200, rot: 0 }, { id: 898, type: 'C', ref: 'CIN', x: ix - 2, y: iy, rot: 0, value: '1u' });
  }
  sch.comps.push({ id: 900, type: 'IN', ref: '', x: b.vref ? ix - 4 : ix, y: iy, rot: 0, rs: '1k' }, { id: 901, type: 'OUT', ref: '', x: b.io[1][0], y: b.io[1][1], rot: 0, rload: '1M' });
  const ex = Schem.extract(sch);
  assert.deepStrictEqual(ex.warnings, [], name + ' wiring');
  const c = new Sim.Circuit(Schem.toSim(ex));
  assert(c.start(FS), name + ': ' + c.error);
  const inp = sine(1000, 0.05, 4800), out = new Float32Array(4800);
  c.process(inp, out, 1, 0, 4800);
  const g = peak(out, 2400) / 0.05;
  assert.strictEqual(c.failed, 0, name + ' convergence');
  const [lo, hi] = b.gain || (b.active ? [0.3, 3] : [0.02, 1.01]);
  assert(g > lo && g <= hi, `${name}: gain ${g.toFixed(3)} at 1 kHz with the knobs as placed, expected ${lo}..${hi}`);
  console.log(`block ${name}: x${g.toFixed(3)} at 1 kHz`);
}
// the checker must catch a broken layout
{
  const ex = Schem.extract(Presets.load('Transistor booster')), { parts, vcc } = Schem.toParts(ex);
  const L = Layout.auto('strip', parts, vcc);
  L.parts[1].pins[0][1] += 1;   // move one leg to the next strip
  assert(Layout.verify(L, parts).length > 0, 'verify detects a moved pin');
}
// zener: 9 V through 1k, cathode up, regulates near 5.1 V (a little under, at 4 mA); the other way round it is a plain diode
{
  const net = (a, k) => ({ comps: [{ type: 'V', n: ['v'], value: 9 }, { type: 'R', n: ['v', 'z'], value: 1e3 }, { type: 'D', n: [a, k], model: '1N4733A' }] });
  let c = new Sim.Circuit(net('0', 'z')); assert(c.dc(), c.error); near(c.voltage('z'), 5.0, 0.2, 'zener 5.1 V');
  c = new Sim.Circuit(net('z', '0')); assert(c.dc(), c.error); near(c.voltage('z'), 0.7, 0.15, 'zener forward');
}
// MOSFET: 2N7000 common source, Id = Beta (Vgs - Vto)^2 = 0.05 * 0.4^2 = 8 mA through 470R; IRFZ44N as a switch
{
  const net = (model, vg, rd) => ({ comps: [{ type: 'V', n: ['v'], value: 9 }, { type: 'V', n: ['g'], value: vg }, { type: 'R', n: ['v', 'd'], value: rd }, { type: 'M', n: ['d', 'g', '0'], model }] });
  let c = new Sim.Circuit(net('2N7000', 2.5, 470)); assert(c.dc(), c.error); near(c.voltage('d'), 9 - 0.008 * 470, 0.25, '2N7000 drain');
  c = new Sim.Circuit(net('IRFZ44N', 9, 1e3)); assert(c.dc(), c.error); assert(c.voltage('d') < 0.05, 'IRFZ44N on: ' + c.voltage('d'));
  c = new Sim.Circuit(net('IRFZ44N', 0, 1e3)); assert(c.dc(), c.error); near(c.voltage('d'), 9, 0.01, 'IRFZ44N off');
}
// LDR: fixed light, then lit by an LED (14 mA is a bit under the 20 mA reference, so a bit above `lit`), then LED dark
{
  const net = extra => ({ comps: [{ type: 'V', n: ['v'], value: 9 }, { type: 'R', n: ['v', 'm'], value: 1e4 }, ...extra] });
  const rOf = c => 1e4 * c.voltage('m') / (9 - c.voltage('m'));
  const ldr = o => Object.assign({ type: 'LDR', n: ['m', '0'], dark: 1e6, lit: 2e3, light: 0.5 }, o);
  let c = new Sim.Circuit(net([ldr({ light: 1 })])); assert(c.dc()); near(rOf(c), 2e3, 1, 'LDR lit');
  c = new Sim.Circuit(net([ldr({ light: 0 })])); assert(c.dc()); near(rOf(c), 1e6, 1e3, 'LDR dark');
  c = new Sim.Circuit(net([ldr({ led: 'D1' }), { type: 'R', n: ['v', 'a'], value: 430 }, { type: 'D', ref: 'D1', n: ['a', '0'], model: 'LED blue' }]));
  assert(c.dc(), c.error); assert(rOf(c) > 2e3 && rOf(c) < 4e3, 'LDR lit by LED: ' + rOf(c));
  c = new Sim.Circuit(net([ldr({ led: 'D1' }), { type: 'D', ref: 'D1', n: ['0', '0x'], model: 'LED blue' }, { type: 'R', n: ['0x', '0'], value: 1e3 }]));
  assert(c.dc(), c.error); near(rOf(c), 1e6, 2e4, 'LDR with LED off');
}
// 555 optical tremolo, drawn from a netlist: astable at 1.44 / ((RA + 2 RB) C) = 48 Hz blinks an LED that shines on an LDR to ground
{
  const sch = Schem.fromNetlist({ components: [
    { type: 'NE555', ref: 'U1', nets: ['tc', 'tc', 'dis', 'sq', 'cv'] },
    { type: 'R', value: '10k', nets: ['+9V', 'dis'] }, { type: 'R', value: '10k', nets: ['dis', 'tc'] }, { type: 'C', value: '1u', nets: ['tc', 'GND'] },
    { type: 'R', value: '470', nets: ['sq', 'led'] }, { type: 'D', ref: 'D1', model: 'LED blue', nets: ['led', 'gate'] },
    { type: 'NMOS', ref: 'Q1', model: 'IRFZ44N', nets: ['gate', '+9V', 'GND'] },          // always on: only here to put a MOSFET on the boards
    { type: 'D', model: '1N4733A', nets: ['GND', 'sq'] },
    { type: 'IN', nets: ['in'] }, { type: 'R', value: '10k', nets: ['in', 'out'] }, { type: 'LDR', ref: 'LDR1', led: 'D1', nets: ['out', 'GND'] }, { type: 'OUT', nets: ['out'] }] });
  const ex = Schem.extract(sch);
  assert.deepStrictEqual(ex.warnings, [], '555 tremolo wiring');
  const c = new Sim.Circuit(Schem.toSim(ex));
  c.start(FS); assert(!c.error, c.error);
  const n = FS, inp = sine(1000, 0.1, n), out = new Float32Array(n), sq = new Float32Array(n), iq = c.nodes.get('sq');
  for (let i = 0; i < n; i++) { out[i] = c.step(inp[i]); sq[i] = c.x[iq]; }
  assert.strictEqual(c.failed, 0, '555 convergence');
  let edges = 0, high = 0;
  for (let i = FS / 2; i < n; i++) { if (sq[i] > 3 && sq[i - 1] <= 3) edges++; if (sq[i] > 3) high++; }
  near(edges * 2, 48, 3, '555 frequency'); near(high / (FS / 2), 2 / 3, 0.03, '555 duty');
  assert(Math.max(...sq) < 5.3, 'zener clamps the 555 output: ' + Math.max(...sq));
  const env = []; for (let i = FS / 2; i < n; i += 48) env.push(peak(out.subarray(i, i + 48)));
  assert(Math.max(...env) / Math.min(...env) > 1.5, 'tremolo depth ' + Math.max(...env) / Math.min(...env));
  const { parts, vcc } = Schem.toParts(ex), ic = parts.find(p => p.kind === 'dip');
  assert.deepStrictEqual(ic.nets, ['0', 'tc', 'sq', vcc, null, 'tc', 'dis', vcc], '555 pinout');
  assert.strictEqual(parts.find(p => p.ref === 'Q1').pinNames, 'GDS');
  for (const kind of ['bread', 'strip']) assert.deepStrictEqual(Layout.verify(Layout.auto(kind, parts, vcc), parts), [], '555 tremolo ' + kind);
  console.log(`555 tremolo: ${edges * 2} Hz, duty ${(high / (FS / 2)).toFixed(2)}, depth x${(Math.max(...env) / Math.min(...env)).toFixed(1)}`);
}
// a circuit too wide for one 63-column breadboard continues on a second one: every part on one board, rails joined, still matches
{
  const comps = [{ type: 'IN', nets: ['s0'] }];
  for (let i = 0; i < 14; i++) comps.push({ type: 'C', value: '100n', nets: ['s' + i, 'b' + i] }, { type: 'R', value: '430k', nets: ['+9V', 'b' + i] }, { type: 'R', value: '43k', nets: ['b' + i, 'GND'] },
    { type: 'NPN', model: '2N3904', nets: ['s' + (i + 1), 'b' + i, 'e' + i] }, { type: 'R', value: '10k', nets: ['+9V', 's' + (i + 1)] }, { type: 'R', value: '390', nets: ['e' + i, 'GND'] });
  comps.push({ type: 'OUT', nets: ['s14'] });
  const { parts, vcc } = Schem.toParts(Schem.extract(Schem.fromNetlist({ components: comps }))), L = Layout.auto('bread', parts, vcc), B = Layout.BOARD;
  assert(L.cols > B && L.cols % B === 0, 'wide circuit uses whole extra boards: ' + L.cols);
  assert.deepStrictEqual(Layout.verify(L, parts), [], 'two-board breadboard');
  for (const p of L.parts) assert.strictEqual(new Set(p.pins.map(h => Math.floor(h[0] / B))).size, 1, p.ref + ' sits across two boards');
  assert(L.wires.some(w => w.a[1] === w.b[1] && (w.a[1] < 2 || w.a[1] > 11) && Math.floor(w.a[0] / B) !== Math.floor(w.b[0] / B)), 'rails are jumpered between boards');
  const cutRails = Object.assign({}, L, { wires: L.wires.filter(w => Math.floor(w.a[0] / B) === Math.floor(w.b[0] / B) || (w.a[1] > 1 && w.a[1] < 12)) });
  assert(Layout.verify(cutRails, parts).some(e => /^Open/.test(e)), 'without the rail jumpers the second board has no power');
  console.log(`two-board breadboard: ${L.cols} columns, ${L.parts.length} parts, ${L.wires.length} jumpers`);
}
// the two optical examples must do their job: the tremolo pulses at 1.44 / ((R1 + 2 (R2 + RATE)) C1) = 4.9 Hz, the compressor turns loud input down
{
  const load = name => { const c = new Sim.Circuit(Schem.toSim(Schem.extract(Presets.load(name)))); c.start(FS); assert(!c.error, c.error); return c; };
  const level = (c, amp, secs, cb) => { let pk = 0; for (let i = 0; i < FS * secs; i++) { const o = Math.abs(c.step(amp * Math.sin(2 * Math.PI * 440 * i / FS))); if (i > FS * (secs - 0.1)) pk = Math.max(pk, o); if (cb) cb(i, o); } return pk; };
  let c = load('Optical tremolo (555)'), dips = 0, pk = 0, was = 1, lo = 9, hi = 0;
  level(c, 0.1, 3, (i, o) => { pk = Math.max(pk, o); if (i % 480 === 479) { if (i > FS) { if (pk < 0.04 && was >= 0.04) dips++; lo = Math.min(lo, pk); hi = Math.max(hi, pk); } was = pk; pk = 0; } });
  near(dips / 2, 4.9, 0.6, 'tremolo rate'); assert(hi / lo > 3, 'tremolo depth ' + hi / lo); assert.strictEqual(c.failed, 0);
  const quiet = level(load('Optical compressor'), 0.005, 1) / 0.005; c = load('Optical compressor');
  const loud = level(c, 0.4, 1) / 0.4;
  assert(quiet > 8 && loud < quiet / 3, `compressor gain quiet x${quiet.toFixed(1)}, loud x${loud.toFixed(1)}`); assert.strictEqual(c.failed, 0);
  console.log(`tremolo ${dips / 2} Hz, depth x${(hi / lo).toFixed(1)}; compressor gain x${quiet.toFixed(1)} quiet, x${loud.toFixed(1)} loud`);
}
console.log('all checks passed');

// MCP server: speak the protocol to a real child process and run the documented example end to end
{
  const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
  const example = JSON.parse(/```json\n([\s\S]*?)```/.exec(fs.readFileSync(path.join(__dirname, 'MCP.md'), 'utf8'))[1]);
  // open_app serves the page itself: every script index.html loads must be on the server's list of files
  const served = /if \(!\[([^\]]+)\]\.includes\(name\)\)/.exec(fs.readFileSync(path.join(__dirname, 'mcp.js'), 'utf8'))[1];
  for (const m of fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)) assert(served.includes(`'${m[1]}'`), 'mcp.js does not serve ' + m[1]);
  const call = (id, name, args) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  const P = '_selftest', wavIn = path.join(__dirname, 'projects', P + '-in.wav');
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    call(3, 'hibiki_guide', {}), call(4, 'set_circuit', { project: P, circuit: example }), call(5, 'simulate', { project: P }),
    call(6, 'edit_circuit', { project: P, ops: [{ op: 'set', ref: 'R3', props: { value: '4.7k' } }, { op: 'set', ref: 'BOOST', props: { pos: 1 } },
      { op: 'add', component: { type: 'D', model: 'LED blue', nets: ['out', 'GND'] } }, { op: 'add', component: { type: 'D', model: 'LED blue', nets: ['GND', 'out'] } }] }),
    call(7, 'simulate', { project: P, amplitude: 0.5, knobs: { BOOST: 0.5 } }), call(8, 'frequency_response', { project: P, points: 5 }),
    call(9, 'board_layout', { project: P, board: 'stripboard' }), call(10, 'board_layout', { project: P, board: 'breadboard' }),
    call(11, 'render_audio', { project: P, input: wavIn, seconds: 0.5 }), call(12, 'get_circuit', { project: 'does not exist' }),
    call(13, 'load_example', { example: 'Op-amp overdrive', project: P + '2' }),
    call(14, 'edit_circuit', { project: P + '2', ops: [{ op: 'add', component: { type: 'R', value: '1M', nets: ['n1', 'GND'] } }] }), call(15, 'list_projects', {}),
    call(16, 'simulate', { project: P, amplitude: 0.5 }),
  ];
  fs.mkdirSync(path.join(__dirname, 'projects'), { recursive: true });
  const pcm = Buffer.alloc(44 + 48000 * 2);   // half a second of 220 Hz at 48 kHz, 16-bit mono
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + 96000, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(48000, 24); pcm.writeUInt32LE(96000, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(96000, 40);
  for (let i = 0; i < 48000; i++) pcm.writeInt16LE(Math.round(20000 * Math.sin(2 * Math.PI * 220 * i / 48000)), 44 + i * 2);
  fs.writeFileSync(wavIn, pcm);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'mcp.js')], { input: msgs.map(m => JSON.stringify(m)).join('\n') + '\n', encoding: 'utf8' });
  const out = new Map(r.stdout.trim().split('\n').map(l => JSON.parse(l)).map(m => [m.id, m]));
  const text = id => { const m = out.get(id); assert(m && m.result, 'no result for request ' + id + ': ' + JSON.stringify(m) + r.stderr); return m.result.content[0].text; };
  assert.strictEqual(out.size, msgs.length - 1, 'one reply per request, none for the notification');
  assert.strictEqual(out.get(1).result.protocolVersion, '2025-06-18');
  assert(out.get(2).result.tools.length >= 10 && out.get(2).result.tools.every(t => t.inputSchema.type === 'object'), 'tool list');
  assert(/Netlist format/.test(text(3)) && /LED blue/.test(text(3)), 'guide');
  assert(/No wiring warnings/.test(text(4)), 'example netlist wires up cleanly: ' + text(4));
  const coll = +/Q1 \(2N3904\): C=([\d.]+)/.exec(text(5))[1], gain = +/gain x([\d.]+)/.exec(text(5))[1];
  assert(coll > 3 && coll < 7, 'booster collector bias ' + coll); assert(gain > 4 && gain < 30, 'booster gain ' + gain);
  assert(/added D1/.test(text(6)) && /value=4.7k/.test(text(6)) && /No wiring warnings/.test(text(6)), 'edit: ' + text(6));
  const peaks = id => /output peaks \+([\d.]+) \/ -([\d.]+)/.exec(text(id)).slice(1).map(Number);
  const loud = peaks(16), quiet = peaks(7);   // 16: saved knob (full), 7: temporary knob override at half
  assert(loud.every(v => v > 1.5 && v < 3.2), 'blue LEDs (or the supply) limit the output to a few volts: ' + loud);
  assert(quiet.every((v, i) => v < loud[i] * 0.5), 'knob override lowers the output without being saved: ' + quiet);
  assert.strictEqual(text(8).split('\n').length, 6, 'frequency response rows');
  for (const id of [9, 10]) assert(/Check: every connection matches/.test(text(id)), 'layout ' + id + ': ' + text(id));
  assert(/Wrote .*_selftest-out\.wav/.test(text(11)) && fs.statSync(path.join(__dirname, 'projects', P + '-out.wav')).size > 40000, 'render: ' + text(11));
  assert(out.get(12).result.isError && /No project/.test(text(12)), 'missing project is a tool error');
  assert(/added R\d+/.test(text(14)) && !/not connected/.test(text(14)), 'add onto a wired net: ' + text(14));
  assert(text(15).includes(P), 'project listed');
  // netlist round trip: draw -> extract gives back the same connections
  const back = Schem.toNetlist(Schem.fromNetlist(example));
  assert.deepStrictEqual(back.components.map(c => c.nets), example.components.map(c => c.nets), 'netlist round trip');
  for (const f of [P + '.json', P + '2.json', P + '-in.wav', P + '-out.wav']) fs.unlinkSync(path.join(__dirname, 'projects', f));
  console.log('MCP server: protocol, design loop, layouts and audio render OK');
  console.log('   ' + text(5).split('\n').filter(l => /Q1|gain|distortion/.test(l)).map(s => s.trim()).join(' | '));
}
console.log('all checks passed (including MCP)');
