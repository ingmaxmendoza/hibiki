#!/usr/bin/env node
// Hibiki MCP server: lets Claude design, simulate and lay out pedals with the same engine the web app uses.
// Transport: stdio, newline-delimited JSON-RPC (Model Context Protocol). No dependencies.
// Register once:  claude mcp add --scope user hibiki -- node "<this file>"
// Projects are the app's own .json files, kept in ./projects. See MCP.md.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { exec } = require('child_process');
const Sim = require('./sim.js'), Schem = require('./schem.js'), Layout = require('./layout.js'), Presets = require('./presets.js');
const DIR = __dirname, PROJ = path.join(DIR, 'projects'), FS = 96000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- project files ----------
function fileOf(name) {
  if (!/^[\w][\w .-]{0,60}$/.test(name || '')) throw new Error('Bad project name: use letters, digits, spaces, "-" and "_".');
  return path.join(PROJ, name + '.json');
}
function load(name) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) throw new Error(`No project "${name}". See list_projects, or create one with set_circuit or load_example.`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function save(name, sch) {
  fs.mkdirSync(PROJ, { recursive: true });
  sch.name = sch.name || name;
  fs.writeFileSync(fileOf(name), JSON.stringify(sch, null, 1));
}
const findComp = (sch, ref) => {
  const k = String(ref).toLowerCase(), c = sch.comps.find(c => (c.ref || '').toLowerCase() === k) || sch.comps.find(c => c.type === 'POT' && (c.label || '').toLowerCase() === k);
  if (!c) throw new Error(`No component "${ref}". References: ${sch.comps.filter(c => c.ref).map(c => c.ref).join(', ')}`);
  return c;
};
// Circuit ready to simulate; `knobs` ({name or ref: 0..1}) are applied to a copy, never saved.
function build(name, knobs) {
  let sch = load(name);
  if (knobs) {
    sch = JSON.parse(JSON.stringify(sch));
    for (const [k, v] of Object.entries(knobs)) { const c = findComp(sch, k); if (c.type !== 'POT') throw new Error(k + ' is not a pot.'); c.pos = clamp(+v, 0, 1); }
  }
  const ex = Schem.extract(sch);
  return { sch, ex, c: new Sim.Circuit(Schem.toSim(ex)) };
}
function describe(name) {
  const nl = Schem.toNetlist(load(name));
  const lines = nl.components.map(c => {
    const { type, ref, nets, ...props } = c;
    return `${(ref || type).padEnd(6)} ${type.padEnd(5)} ${Object.entries(props).map(([k, v]) => k + '=' + v).join(' ').padEnd(34)} nets: ${nets.map((n, i) => Schem.PIN_NAMES[type][i] + '=' + n).join('  ')}`;
  });
  return `Project "${name}"${nl.about ? ': ' + nl.about : ''}\n${lines.join('\n')}` + (nl.warnings.length ? '\nWarnings:\n- ' + nl.warnings.join('\n- ') : '\nNo wiring warnings.');
}

// ---------- measurements ----------
// Amplitude of the k-th harmonic of f in x[from..from+n), by correlating with a sine and cosine.
function harmonic(x, from, n, f, k) {
  let re = 0, im = 0;
  for (let i = 0; i < n; i++) { const a = 2 * Math.PI * k * f * i / FS; re += x[from + i] * Math.cos(a); im += x[from + i] * Math.sin(a); }
  return 2 * Math.hypot(re, im) / n;
}
function runSine(c, f, amp, cycles, tailCycles) {
  const per = FS / f, n = Math.round(cycles * per), m = Math.round(tailCycles * per), inp = new Float32Array(n), out = new Float32Array(n);
  for (let i = 0; i < n; i++) inp[i] = amp * Math.sin(2 * Math.PI * f * i / FS);
  c.process(inp, out, 1, 0, n);
  return { out, from: n - m, m };
}
const dB = x => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');

function simulate(a) {
  const { ex, c } = build(a.project, a.knobs), f = clamp(a.freq || 220, 20, 10000), amp = a.amplitude || 0.2, o = [];
  const ok = c.start(FS);
  if (ex.warnings.length) o.push('Wiring warnings:\n- ' + ex.warnings.join('\n- '));
  if (c.error) o.push('Solver: ' + c.error);
  const dc = new Map([...c.nodes.keys()].map(n => [n, c.voltage(n)]));
  const v = n => (n === '0' ? 0 : dc.get(n));
  o.push('DC operating point (volts):');
  for (const { c: k, nets } of ex.comps) {
    if (!['NPN', 'PNP', 'JFET', 'NMOS', 'NE555', 'OPA', 'D', 'POT'].includes(k.type)) continue;
    o.push(`  ${k.label || k.ref} (${k.model || k.value || k.type}): ` + nets.map((n, i) => `${Schem.PIN_NAMES[k.type][i]}=${v(n) == null ? '?' : v(n).toFixed(3)}`).join('  '));
  }
  o.push('  nets: ' + [...dc].filter(([n]) => !n.includes('#')).map(([n, x]) => `${n}=${x.toFixed(3)}`).join('  '));
  if (ok && c.out >= -1) {
    const { out, from, m } = runSine(c, f, amp, Math.ceil(Math.max(0.1 * f, 12)), 4);
    let mean = 0, hi = -Infinity, lo = Infinity;
    for (let i = from; i < from + m; i++) { mean += out[i] / m; hi = Math.max(hi, out[i]); lo = Math.min(lo, out[i]); }
    const h = [1, 2, 3, 4, 5].map(k => harmonic(out, from, m, f, k));
    o.push(`Sine test: ${f} Hz, ${amp} V peak in.`,
      `  output peaks +${(hi - mean).toFixed(4)} / -${(mean - lo).toFixed(4)} V around ${mean.toFixed(3)} V DC`,
      `  fundamental ${h[0].toFixed(4)} V -> gain x${(h[0] / amp).toFixed(3)} (${dB(h[0] / amp)} dB)`,
      `  harmonics relative to the fundamental: ` + [2, 3, 4, 5].map((k, i) => `H${k} ${dB(h[i + 1] / h[0])} dB`).join('  '),
      `  distortion (H2..H5): ${(100 * Math.hypot(h[1], h[2], h[3], h[4]) / (h[0] || 1)).toFixed(2)} %` + (c.failed ? `\n  WARNING: solver did not converge on ${c.failed} steps.` : ''));
  } else if (ok) o.push('No OUT jack: add one to measure the output.');
  return o.join('\n');
}

function frequencyResponse(a) {
  const { c, ex } = build(a.project, a.knobs), amp = a.amplitude || 0.01, n = clamp(a.points || 25, 3, 80);
  const f0 = clamp(a.fmin || 40, 10, 20000), f1 = clamp(a.fmax || 10000, f0 + 1, 20000), rows = [];
  if (c.out < -1) throw new Error('The circuit has no OUT jack.');
  for (let i = 0; i < n; i++) {
    const f = f0 * Math.pow(f1 / f0, i / (n - 1));
    if (!c.start(FS)) throw new Error(c.error || 'Circuit cannot be simulated. ' + ex.warnings.join(' '));
    const cyc = Math.max(12, Math.ceil(0.04 * f)), { out, from, m } = runSine(c, f, amp, cyc, Math.floor(cyc / 2));
    rows.push(`${f.toFixed(0).padStart(6)} Hz  ${dB(harmonic(out, from, m, f, 1) / amp).padStart(7)} dB`);
  }
  return `Frequency response, ${amp} V peak in (gain of the fundamental):\n` + rows.join('\n');
}

// ---------- audio ----------
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a WAV file: ' + file);
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= b.length;) {
    const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, Math.min(b.length, p + 8 + len));
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error('WAV file has no audio data.');
  const bytes = fmt.bits / 8, frames = Math.floor(data.length / (bytes * fmt.ch)), out = new Float32Array(frames);
  const rd = fmt.tag === 3 ? o => data.readFloatLE(o) : bytes === 2 ? o => data.readInt16LE(o) / 32768 : bytes === 3 ? o => data.readIntLE(o, 3) / 8388608
    : bytes === 4 ? o => data.readInt32LE(o) / 2147483648 : bytes === 1 ? o => (data[o] - 128) / 128 : null;
  if (!rd) throw new Error('Unsupported WAV format.');
  for (let i = 0; i < frames; i++) { let s = 0; for (let ch = 0; ch < fmt.ch; ch++) s += rd((i * fmt.ch + ch) * bytes); out[i] = s / fmt.ch; }
  return { rate: fmt.rate, data: out };
}
function writeWav(file, d, rate) {
  const b = Buffer.alloc(44 + d.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + d.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(d.length * 2, 40);
  for (let i = 0; i < d.length; i++) b.writeInt16LE(Math.round(clamp(d[i], -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(file, b);
}
const stats = d => { let s = 0, p = 0; for (const v of d) { s += v * v; p = Math.max(p, Math.abs(v)); } const rms = Math.sqrt(s / d.length); return { rms, peak: p, crest: 20 * Math.log10(p / (rms || 1e-12)) }; };

function renderAudio(a) {
  const { c, ex } = build(a.project, a.knobs), wav = readWav(a.input), os = 2, peakV = a.guitar_peak_volts || 0.2;
  if (!c.start(wav.rate * os)) throw new Error(c.error || 'Circuit cannot be simulated. ' + ex.warnings.join(' '));
  if (c.out < -1) throw new Error('The circuit has no OUT jack.');
  const from = clamp(Math.floor((a.start || 0) * wav.rate), 0, wav.data.length - 1), n = Math.min(Math.floor(clamp(a.seconds || 5, 0.1, 60) * wav.rate), wav.data.length - from);
  const inp = new Float32Array(n), out = new Float32Array(n), t0 = Date.now();
  for (let i = 0; i < n; i++) inp[i] = wav.data[from + i] * peakV;
  c.process(inp, out, os, 0, n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i] / n;
  for (let i = 0; i < n; i++) out[i] -= mean;
  const si = stats(inp), so = stats(out), g = Math.min(so.rms ? si.rms / so.rms / peakV : 1, 0.98 / (so.peak || 1));   // loudness-matched to the dry track, never clipped
  const file = a.output || path.join(PROJ, a.project + '-out.wav');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeWav(file, out.map(v => v * g), wav.rate);
  return [`Rendered ${(n / wav.rate).toFixed(2)} s at ${wav.rate} Hz (2x oversampled) in ${((Date.now() - t0) / 1000).toFixed(1)} s.`,
    `input : rms ${si.rms.toFixed(4)} V, peak ${si.peak.toFixed(4)} V, crest factor ${si.crest.toFixed(1)} dB`,
    `output: rms ${so.rms.toFixed(4)} V, peak ${so.peak.toFixed(4)} V, crest factor ${so.crest.toFixed(1)} dB (lower crest factor = more compressed / clipped)`,
    `level change ${dB(so.rms / si.rms)} dB` + (c.failed ? `; solver did not converge on ${c.failed} of ${n * os} steps` : ''),
    `Wrote ${file} (loudness-matched to the input for A/B listening).`].join('\n');
}

// ---------- boards ----------
function boardLayout(a) {
  const kind = a.board === 'breadboard' ? 'bread' : 'strip', sch = load(a.project), { parts, vcc } = Schem.toParts(Schem.extract(sch));
  const sig = JSON.stringify(parts.map(p => [p.ref, p.kind, p.nets || p.pins.map(q => q.net)])), kept = (sch.layouts || {})[kind];
  const L = kept && kept.sig === sig ? kept.L : Layout.auto(kind, parts, vcc), errs = Layout.verify(L, parts), byRef = new Map(parts.map(p => [p.ref, p]));
  const row = y => (kind === 'strip' ? 'row ' + (y + 1) : ['+ rail (top)', '- rail (top)', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', '+ rail (bottom)', '- rail (bottom)'][y]);
  const hole = h => (kind === 'strip' ? `col ${h[0] + 1} row ${h[1] + 1}` : `${L.cols > Layout.BOARD ? 'board ' + (Math.floor(h[0] / Layout.BOARD) + 1) + ' ' : ''}${row(h[1])} ${h[0] % Layout.BOARD + 1}`);
  const o = [`${kind === 'strip' ? 'Stripboard' : 'Breadboard'} for "${a.project}": ${L.cols} columns x ${L.rows} rows` + (kept && kept.sig === sig ? ' (layout as edited in the app)' : ' (automatic layout)') + '.',
    kind === 'strip' ? 'Copper strips run along the rows; seen from the component side.' : 'Rows A-E and F-J are the two halves; each column of 5 holes is connected.', 'Parts:'];
  for (const p of L.parts) {
    const src = byRef.get(p.ref) || p;
    o.push(`  ${p.ref} ${src.label}: ` + p.pins.map((h, i) => (p.kind === 'two' ? '' : `pin ${p.pinNames ? p.pinNames[i] : i + 1} `) + hole(h)).join(p.kind === 'two' ? ' to ' : ', '));
  }
  if (L.wires.length) o.push('Wire links:', ...L.wires.map(w => `  ${hole(w.a)} to ${hole(w.b)}` + (w.net ? ` (${w.net === '0' ? 'GND' : w.net})` : '')));
  if (L.cuts.length) o.push('Track cuts: ' + L.cuts.map(hole).join('; '));
  o.push('Off-board wiring:', ...L.off.flatMap(f => f.pins.map(q => `  ${q.name} -> ${hole(q.at)}`)));
  o.push(...(L.notes || []).map(n => 'Note: ' + n));
  o.push(errs.length ? 'CHECK FAILED:\n- ' + errs.join('\n- ') : 'Check: every connection matches the schematic, no shorts.');
  return o.join('\n');
}

// ---------- editing ----------
function setCircuit(a) {
  const sch = Schem.fromNetlist(Object.assign({ name: a.project }, a.circuit));
  save(a.project, sch);
  return 'Saved.\n' + describe(a.project);
}
function editCircuit(a) {
  const sch = load(a.project), log = [];
  for (const op of a.ops || []) {
    if (op.op === 'set') {
      const c = findComp(sch, op.ref);
      for (const [k, v] of Object.entries(op.props || {})) {
        if (!(k in Schem.DEFS[c.type].props) && k !== 'ref') throw new Error(`${c.ref} has no property "${k}". It has: ${Object.keys(Schem.DEFS[c.type].props).join(', ')}`);
        c[k] = k === 'pos' ? clamp(+v, 0, 1) : String(v);
      }
      log.push(`set ${c.ref}: ${JSON.stringify(op.props)}`);
    } else if (op.op === 'remove') {
      const c = findComp(sch, op.ref);
      sch.comps = sch.comps.filter(x => x !== c); log.push('removed ' + c.ref);
    } else if (op.op === 'add') {
      const c = Schem.addComponent(sch, op.component || {}); log.push('added ' + (c.ref || c.type));
    } else throw new Error('Unknown op "' + op.op + '": use set, add or remove.');
  }
  save(a.project, sch);
  return log.join('\n') + '\n' + describe(a.project);
}

// ---------- the web app, served so the browser and this server share the project file ----------
let server = null, port = 0;
function handle(req, rsp) {
  const u = new URL(req.url, 'http://127.0.0.1'), send = (code, body, type = 'application/json') => { rsp.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); rsp.end(body); };
  try {
    // only answer requests addressed to this machine by its loopback name: stops a web page that re-points its own domain here (DNS rebinding)
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403, '{}');
    if (u.pathname === '/api/project') {
      const f = fileOf(u.searchParams.get('name'));
      if (req.method === 'POST') {
        if (!/json/.test(req.headers['content-type'] || '')) return send(415, '{}');   // also keeps other web pages from writing here
        let body = '';
        req.on('data', d => { body += d; if (body.length > 5e6) req.destroy(); });
        req.on('end', () => { try { JSON.parse(body); fs.mkdirSync(PROJ, { recursive: true }); fs.writeFileSync(f, body); send(200, JSON.stringify({ mtime: fs.statSync(f).mtimeMs })); } catch (e) { send(400, '{}'); } });
        return;
      }
      if (!fs.existsSync(f)) return send(200, '{}');
      const m = String(fs.statSync(f).mtimeMs);
      return send(200, m === u.searchParams.get('since') ? '{"same":true}' : JSON.stringify({ mtime: m, project: JSON.parse(fs.readFileSync(f, 'utf8')) }));
    }
    const name = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    if (!['index.html', 'app.js', 'sim.js', 'schem.js', 'layout.js', 'pedals.js', 'presets.js'].includes(name)) return send(404, 'not found', 'text/plain');
    send(200, fs.readFileSync(path.join(DIR, name)), name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
  } catch (e) { send(400, JSON.stringify({ error: e.message })); }
}
const ensureServer = () => new Promise((res, rej) => {
  if (server) return res(port);
  server = http.createServer(handle).on('error', rej);
  server.listen(+process.env.HIBIKI_PORT || 0, '127.0.0.1', () => { port = server.address().port; res(port); });
});
async function openApp(a) {
  load(a.project);
  const url = `http://127.0.0.1:${await ensureServer()}/?project=${encodeURIComponent(a.project)}`;
  if (a.launch !== false) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
  return `Open at ${url}\nThe page and this server share projects/${a.project}.json: edits made in the browser are saved to it, and changes made here show up in the browser within about 2 seconds. The link works while this Claude session is running.`;
}

// ---------- tools ----------
const P = { type: 'string', description: 'Project name (a file in the projects folder, without .json)' };
const KNOBS = { type: 'object', description: 'Temporary knob positions for this run only, by pot name or reference, 0..1. Example: {"GAIN": 0.8}', additionalProperties: { type: 'number' } };
const COMPONENT = {
  type: 'object', description: 'One component. nets lists one net name per pin, in the pin order given by hibiki_guide.',
  properties: { type: { type: 'string', enum: Object.keys(Schem.PIN_NAMES) }, ref: { type: 'string' }, value: { type: 'string' }, model: { type: 'string' },
    label: { type: 'string' }, taper: { type: 'string', enum: ['lin', 'log', 'rev'] }, pos: { type: 'number' }, hfe: { type: 'string' },
    rs: { type: 'string' }, ls: { type: 'string' }, rload: { type: 'string' }, nets: { type: 'array', items: { type: 'string' } } },
  required: ['type', 'nets'],
};
const obj = (properties, required) => ({ type: 'object', properties, required });
const TOOLS = [
  { name: 'hibiki_guide', description: 'Read this first. How to describe a circuit for Hibiki: component types and pin order, value syntax, available part models, workflow and limits.',
    inputSchema: obj({}, []), run: () => fs.readFileSync(path.join(DIR, 'MCP.md'), 'utf8') + '\n\n## Part models available now\n' +
      `Diodes and LEDs: ${Object.keys(Sim.DIODES).join(', ')}\nBJTs: ${Object.entries(Sim.BJTS).map(([k, m]) => `${k} (${m.pnp ? 'PNP' : 'NPN'}, hFE ${m.Bf})`).join(', ')}\n` +
      `JFETs: ${Object.keys(Sim.JFETS).join(', ')}\nN-MOSFETs: ${Object.keys(Sim.MOSFETS).join(', ')}\nZeners are diode models (1N4728A 3.3 V, 1N4733A 5.1 V, 1N4739A 9.1 V, 1N4742A 12 V).\nOp-amps: ${Object.entries(Sim.OPAMPS).map(([k, m]) => `${k} (${m.units} per package)`).join(', ')}` },
  { name: 'list_projects', description: 'List saved projects, the built-in example circuits and the building blocks.', inputSchema: obj({}, []),
    run: () => `Projects: ${fs.existsSync(PROJ) ? fs.readdirSync(PROJ).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).join(', ') || '(none yet)' : '(none yet)'}\n` +
      `Examples (load_example): ${Presets.names.join(', ')}\nBuilding blocks in the app's Blocks menu (for the human; describe them as components here): ${Presets.blocks.join(', ')}` },
  { name: 'load_example', description: 'Copy a built-in example circuit into a new project to study or modify.',
    inputSchema: obj({ example: { type: 'string', enum: Presets.names }, project: P }, ['example', 'project']),
    run: a => { if (!Presets.names.includes(a.example)) throw new Error('Examples: ' + Presets.names.join(', ')); save(a.project, Object.assign(Presets.pedals[a.example] ? Schem.fromNetlist(Presets.pedals[a.example]) : Presets.load(a.example), { name: a.project })); return 'Saved.\n' + describe(a.project); } },
  { name: 'get_circuit', description: 'Show a project as a netlist: every component with its values and the net on each pin, plus wiring warnings.',
    inputSchema: obj({ project: P }, ['project']), run: a => describe(a.project) },
  { name: 'set_circuit', description: 'Create or replace a project from a netlist. The schematic is drawn automatically (signal path left to right, wired, one label per net). Use net "GND" for ground and "+9V" for the supply. Needs one IN and one OUT component.',
    inputSchema: obj({ project: P, circuit: obj({ about: { type: 'string', description: 'One line on what the pedal is' }, components: { type: 'array', items: COMPONENT } }, ['components']) }, ['project', 'circuit']), run: setCircuit },
  { name: 'edit_circuit', description: 'Change an existing project without redrawing it: set values/models/knob positions, add a component, or remove one. Ops run in order.',
    inputSchema: obj({ project: P, ops: { type: 'array', items: { type: 'object', properties: {
      op: { type: 'string', enum: ['set', 'add', 'remove'] }, ref: { type: 'string', description: 'For set/remove: reference (R3) or pot name (GAIN)' },
      props: { type: 'object', description: 'For set: properties to change, e.g. {"value": "47k"} or {"pos": 0.7} or {"model": "LED blue"}' }, component: COMPONENT }, required: ['op'] } } }, ['project', 'ops']), run: editCircuit },
  { name: 'simulate', description: 'DC operating point (bias voltages on transistors, op-amps, diodes, every net) and a sine test: gain, output peaks, harmonics and distortion. Use it after every change.',
    inputSchema: obj({ project: P, freq: { type: 'number', description: 'Test tone in Hz, default 220' }, amplitude: { type: 'number', description: 'Input peak volts, default 0.2 (a guitar is roughly 0.05 to 0.5)' }, knobs: KNOBS }, ['project']), run: simulate },
  { name: 'frequency_response', description: 'Gain in dB against frequency (small-signal sine sweep). Use it for tone controls and filters.',
    inputSchema: obj({ project: P, fmin: { type: 'number' }, fmax: { type: 'number' }, points: { type: 'number' }, amplitude: { type: 'number', description: 'Input peak volts, default 0.01 so the circuit stays linear' }, knobs: KNOBS }, ['project']), run: frequencyResponse },
  { name: 'render_audio', description: 'Run a WAV file (ideally a clean guitar recording) through the pedal and write the result as a WAV for listening. Returns level and crest-factor numbers.',
    inputSchema: obj({ project: P, input: { type: 'string', description: 'Path of the input WAV' }, output: { type: 'string', description: 'Output path, default projects/<project>-out.wav' },
      start: { type: 'number' }, seconds: { type: 'number', description: 'Default 5, max 60' }, guitar_peak_volts: { type: 'number', description: 'Volts for a full-scale sample, default 0.2' }, knobs: KNOBS }, ['project', 'input']), run: renderAudio },
  { name: 'board_layout', description: 'Breadboard or stripboard layout for the project as text: hole of every pin, wire links, track cuts, off-board wiring, and the check against the schematic.',
    inputSchema: obj({ project: P, board: { type: 'string', enum: ['breadboard', 'stripboard'] } }, ['project', 'board']), run: boardLayout },
  { name: 'open_app', description: 'Open the project in the Hibiki web app in the browser, live-linked to the project file, so the human can see and edit the schematic, hear it and view the boards.',
    inputSchema: obj({ project: P, launch: { type: 'boolean', description: 'false = only return the link' } }, ['project']), run: openApp },
];

// ---------- MCP over stdio ----------
const INSTRUCTIONS = 'Hibiki designs guitar effect pedals. Call hibiki_guide once before describing a circuit. Typical loop: set_circuit, simulate (check bias and gain), edit_circuit, simulate again, frequency_response for tone, then open_app so the user can see and hear it.';
async function onMessage(line) {
  let m;
  try { m = JSON.parse(line); } catch (e) { return; }
  if (m.id === undefined || m.id === null) return;       // notifications need no answer
  const reply = r => process.stdout.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id: m.id }, r)) + '\n');
  try {
    if (m.method === 'initialize') reply({ result: { protocolVersion: (m.params && m.params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'hibiki', version: '1.0.0' }, instructions: INSTRUCTIONS } });
    else if (m.method === 'ping') reply({ result: {} });
    else if (m.method === 'tools/list') reply({ result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
    else if (m.method === 'tools/call') {
      const t = TOOLS.find(t => t.name === (m.params || {}).name);
      if (!t) return reply({ error: { code: -32602, message: 'Unknown tool' } });
      try { reply({ result: { content: [{ type: 'text', text: String(await t.run(m.params.arguments || {})) }] } }); }
      catch (e) { reply({ result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } }); }
    } else reply({ error: { code: -32601, message: 'Method not found: ' + m.method } });
  } catch (e) { reply({ error: { code: -32603, message: e.message } }); }
}
if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => {
    buf += d;
    for (let i; (i = buf.indexOf('\n')) >= 0;) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) onMessage(line); }
  });
  process.stdin.on('end', () => process.exit(0));
}
module.exports = { TOOLS, onMessage };
