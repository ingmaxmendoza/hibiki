// Hibiki starter circuits. Classic pedal topologies, drawn on the schematic grid.
// Component: [type, ref, x, y, rot, props]   Wire: polyline of [x, y] points.
(function (root) {
'use strict';

const RAW = {
  'Transistor booster': {
    about: 'One NPN common-emitter stage (LPB-1 style). About 26 dB of clean gain, starts to clip with hot pickups.',
    comps: [
      ['IN', '', 2, 10, 0, {}], ['C', 'C1', 5, 10, 0, { value: '100n' }],
      ['NPN', 'Q1', 12, 10, 0, { model: '2N5088' }],
      ['R', 'R1', 9, 7, 1, { value: '430k' }], ['R', 'R2', 9, 13, 1, { value: '43k' }], ['GND', '', 9, 15, 0, {}],
      ['R', 'R3', 13, 5, 1, { value: '10k' }], ['R', 'R4', 13, 14, 1, { value: '390' }], ['GND', '', 13, 16, 0, {}],
      ['V', '', 11, 3, 0, { value: '9' }],
      ['C', 'C2', 17, 8, 0, { value: '100n' }],
      ['POT', 'VR1', 21, 10, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'BOOST' }], ['GND', '', 21, 12, 0, {}],
      ['OUT', '', 25, 10, 0, {}],
    ],
    wires: [
      [[2, 10], [3, 10]], [[7, 10], [10, 10]], [[9, 9], [9, 10], [9, 11]], [[13, 7], [13, 8]],
      [[9, 5], [9, 3], [13, 3]], [[13, 8], [15, 8]], [[19, 8], [21, 8]], [[23, 10], [25, 10]],
    ],
  },
  'Two-transistor fuzz': {
    about: 'Fuzz Face topology (NPN, negative ground). Very sensitive to transistor gain: edit hFE on Q1/Q2 and watch the bias. Input models a pickup source resistance.',
    comps: [
      ['IN', '', 2, 10, 0, { rs: '7k' }], ['C', 'C1', 5, 10, 0, { value: '2.2u' }],
      ['NPN', 'Q1', 12, 10, 0, { model: 'BC108' }], ['GND', '', 13, 12, 0, {}],
      ['R', 'R1', 13, 5, 1, { value: '33k' }],
      ['NPN', 'Q2', 18, 8, 0, { model: 'BC108' }],
      ['R', 'R3', 19, 4, 1, { value: '8.2k' }], ['R', 'R2', 19, 0, 1, { value: '330' }],
      ['V', '', 16, -2, 0, { value: '9' }],
      ['C', 'C3', 23, 2, 0, { value: '10n' }],
      ['POT', 'VR2', 27, 4, 3, { value: '500k', taper: 'log', pos: 1, label: 'VOLUME' }], ['GND', '', 27, 6, 0, {}],
      ['OUT', '', 31, 4, 0, {}],
      ['POT', 'VR1', 19, 12, 3, { value: '1k', taper: 'lin', pos: 0.9, label: 'FUZZ' }], ['GND', '', 19, 14, 0, {}],
      ['C', 'C2', 23, 12, 0, { value: '22u' }], ['GND', '', 25, 12, 0, {}],
      ['R', 'R4', 12, 15, 0, { value: '100k' }],
    ],
    wires: [
      [[2, 10], [3, 10]], [[7, 10], [10, 10]], [[13, 7], [13, 8]], [[13, 8], [16, 8]],
      [[13, 3], [13, -2], [19, -2]], [[19, 2], [21, 2]], [[25, 2], [27, 2]], [[29, 4], [31, 4]],
      [[9, 10], [9, 15], [10, 15]], [[14, 15], [17, 15], [17, 10], [19, 10]],
    ],
  },
  'Op-amp overdrive': {
    about: 'Soft clipping: diodes in the op-amp feedback loop (Tube Screamer style gain stage, simplified passive tone).',
    comps: [
      ['IN', '', 0, 12, 0, {}], ['C', 'C1', 3, 12, 0, { value: '47n' }],
      ['OPA', 'U1', 15, 13, 0, { model: 'RC4558', flip: true }],
      ['R', 'R1', 8, 9, 1, { value: '510k' }],
      ['V', '', 2, 1, 0, { value: '9' }], ['R', 'R5', 2, 3, 1, { value: '10k' }], ['R', 'R6', 2, 7, 1, { value: '10k' }], ['GND', '', 2, 9, 0, {}],
      ['C', 'C6', 5, 7, 1, { value: '47u' }], ['GND', '', 5, 9, 0, {}],
      ['R', 'R2', 14, 17, 0, { value: '51k' }],
      ['POT', 'VR1', 18, 17, 0, { value: '500k', taper: 'log', pos: 0.6, label: 'DRIVE' }],
      ['D', 'D1', 16, 21, 0, { model: '1N4148' }], ['D', 'D2', 16, 23, 2, { model: '1N4148' }],
      ['C', 'C3', 16, 26, 0, { value: '51p' }],
      ['R', 'R3', 10, 16, 1, { value: '4.7k' }], ['C', 'C2', 10, 20, 1, { value: '47n' }], ['GND', '', 10, 22, 0, {}],
      ['R', 'R4', 24, 13, 0, { value: '1k' }], ['C', 'C4', 27, 15, 1, { value: '220n' }],
      ['POT', 'VR2', 27, 19, 3, { value: '20k', taper: 'lin', pos: 0.5, label: 'TONE' }], ['GND', '', 27, 21, 0, {}],
      ['C', 'C5', 31, 13, 0, { value: '1u' }],
      ['POT', 'VR3', 35, 15, 3, { value: '100k', taper: 'log', pos: 0.9, label: 'LEVEL' }], ['GND', '', 35, 17, 0, {}],
      ['OUT', '', 39, 15, 0, {}],
    ],
    wires: [
      [[0, 12], [1, 12]], [[5, 12], [12, 12]], [[8, 11], [8, 12]], [[2, 5], [8, 5], [8, 7]],
      [[12, 14], [12, 26], [14, 26]], [[12, 21], [14, 21]], [[12, 23], [14, 23]],
      [[18, 19], [20, 19], [20, 17], [21, 17]], [[18, 13], [22, 13]], [[21, 13], [21, 26], [18, 26]],
      [[18, 21], [21, 21]], [[18, 23], [21, 23]], [[10, 14], [12, 14]],
      [[26, 13], [29, 13]], [[29, 19], [29, 17], [27, 17]], [[33, 13], [35, 13]], [[37, 15], [39, 15]],
    ],
  },
  'Op-amp distortion': {
    about: 'Hard clipping: op-amp gain stage, then a pair of germanium diodes to ground (Distortion+ style).',
    comps: [
      ['IN', '', 0, 12, 0, {}], ['C', 'C1', 3, 12, 0, { value: '10n' }], ['R', 'R1', 8, 12, 0, { value: '10k' }],
      ['OPA', 'U1', 15, 13, 0, { model: 'LM741', flip: true }],
      ['R', 'R2', 11, 9, 1, { value: '1M' }],
      ['V', '', 2, 1, 0, { value: '9' }], ['R', 'R6', 2, 3, 1, { value: '10k' }], ['R', 'R7', 2, 7, 1, { value: '10k' }], ['GND', '', 2, 9, 0, {}],
      ['C', 'C5', 5, 7, 1, { value: '1u' }], ['GND', '', 5, 9, 0, {}],
      ['R', 'R3', 15, 17, 0, { value: '1M' }],
      ['R', 'R4', 10, 16, 1, { value: '4.7k' }], ['C', 'C2', 10, 20, 1, { value: '47n' }],
      ['POT', 'VR1', 10, 24, 3, { value: '500k', taper: 'rev', pos: 0.7, label: 'DIST' }], ['GND', '', 12, 26, 0, {}],
      ['C', 'C3', 23, 13, 0, { value: '1u' }], ['R', 'R5', 28, 13, 0, { value: '10k' }],
      ['D', 'D1', 31, 15, 1, { model: '1N34A (Ge)' }], ['D', 'D2', 33, 15, 3, { model: '1N34A (Ge)' }],
      ['C', 'C4', 35, 15, 1, { value: '1n' }], ['GND', '', 33, 17, 0, {}],
      ['POT', 'VR2', 38, 15, 3, { value: '10k', taper: 'log', pos: 0.8, label: 'LEVEL' }], ['GND', '', 38, 17, 0, {}],
      ['OUT', '', 42, 15, 0, {}],
    ],
    wires: [
      [[0, 12], [1, 12]], [[5, 12], [6, 12]], [[10, 12], [12, 12]], [[11, 11], [11, 12]], [[2, 5], [11, 5], [11, 7]],
      [[12, 14], [12, 17], [13, 17]], [[17, 17], [20, 17], [20, 13]], [[18, 13], [21, 13]], [[10, 14], [12, 14]],
      [[12, 24], [12, 26], [10, 26]], [[25, 13], [26, 13]], [[30, 13], [38, 13]], [[31, 17], [35, 17]], [[40, 15], [42, 15]],
    ],
  },
  'JFET preamp': {
    about: 'Self-biased J201 common-source stage. Real J201s vary a lot: check the drain voltage (about half the supply) and trim R2.',
    comps: [
      ['IN', '', 2, 10, 0, {}], ['C', 'C1', 5, 10, 0, { value: '22n' }],
      ['JFET', 'Q1', 12, 10, 0, { model: 'J201' }],
      ['R', 'R1', 9, 13, 1, { value: '1M' }], ['GND', '', 9, 15, 0, {}],
      ['R', 'R2', 13, 5, 1, { value: '22k' }], ['V', '', 13, 3, 0, { value: '9' }],
      ['R', 'R3', 13, 14, 1, { value: '2.2k' }], ['GND', '', 13, 16, 0, {}],
      ['C', 'C2', 16, 14, 1, { value: '10u' }],
      ['C', 'C3', 19, 8, 0, { value: '100n' }],
      ['POT', 'VR1', 23, 10, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', '', 23, 12, 0, {}],
      ['OUT', '', 27, 10, 0, {}],
    ],
    wires: [
      [[2, 10], [3, 10]], [[7, 10], [10, 10]], [[9, 10], [9, 11]], [[13, 7], [13, 8]],
      [[13, 12], [16, 12]], [[13, 16], [16, 16]], [[13, 8], [17, 8]], [[21, 8], [23, 8]], [[25, 10], [27, 10]],
    ],
  },
  'Optical tremolo (555)': {
    about: 'A 555 blinks an LED at 4 to 7 Hz (RATE); the LED shines on an LDR that pulls the signal down (DEPTH). Passive signal path, so it is a little quieter than bypass. Tape the LED and LDR together in the dark, and enter your LDR\'s measured resistances.',
    comps: [
      ['NE555', 'U1', 12, 8, 0, {}],
      ['V', '', 5, 0, 0, { value: '9' }], ['R', 'R1', 5, 2, 1, { value: '10k' }], ['R', 'R2', 5, 8, 1, { value: '4.7k' }],
      ['POT', 'VR1', 5, 12, 1, { value: '10k', taper: 'lin', pos: 0.5, label: 'RATE' }],
      ['C', 'C1', 5, 16, 1, { value: '10u' }], ['GND', '', 5, 18, 0, {}],
      ['R', 'R3', 19, 6, 0, { value: '1k' }], ['D', 'D1', 22, 8, 1, { model: 'LED blue' }], ['GND', '', 22, 10, 0, {}],
      ['IN', '', 9, 20, 0, {}], ['C', 'C2', 12, 20, 0, { value: '100n' }], ['R', 'R4', 17, 20, 0, { value: '22k' }],
      ['POT', 'VR2', 22, 22, 1, { value: '10k', taper: 'lin', pos: 1, label: 'DEPTH' }],
      ['LDR', 'LDR1', 22, 26, 1, { led: 'D1' }], ['GND', '', 22, 28, 0, {}],
      ['OUT', '', 26, 20, 0, {}],
    ],
    wires: [
      [[5, 4], [5, 6], [8, 6]], [[3, 12], [3, 10], [5, 10]], [[5, 14], [7, 14], [7, 10], [8, 10]], [[7, 10], [7, 8], [8, 8]],
      [[16, 6], [17, 6]], [[21, 6], [22, 6]],
      [[9, 20], [10, 20]], [[14, 20], [15, 20]], [[19, 20], [26, 20]], [[20, 22], [20, 20]],
    ],
  },
  'Optical compressor': {
    about: 'An op-amp gain stage with an LDR across its feedback resistor. When the output passes about 0.7 V, Q1 lights the LED on the LDR and the gain drops from about 19 towards 2. SUSTAIN sets how early that happens. C4 and R7 set the release.',
    comps: [
      ['IN', '', 0, 12, 0, {}], ['C', 'C1', 3, 12, 0, { value: '100n' }],
      ['OPA', 'U1', 15, 13, 0, { model: 'TL082', flip: true }],
      ['R', 'R1', 8, 9, 1, { value: '1M' }],
      ['V', '', 2, 1, 0, { value: '9' }], ['R', 'R5', 2, 3, 1, { value: '10k' }], ['R', 'R6', 2, 7, 1, { value: '10k' }], ['GND', '', 2, 9, 0, {}],
      ['C', 'C6', 5, 7, 1, { value: '100u' }], ['GND', '', 5, 9, 0, {}],
      ['R', 'R2', 15, 17, 0, { value: '220k' }], ['LDR', 'LDR1', 15, 20, 0, { led: 'D1' }],
      ['R', 'R3', 10, 16, 1, { value: '10k' }], ['C', 'C2', 10, 20, 1, { value: '10u' }], ['GND', '', 10, 22, 0, {}],
      ['C', 'C5', 26, 13, 0, { value: '100n' }],
      ['POT', 'VR2', 30, 15, 3, { value: '250k', taper: 'lin', pos: 0.5, label: 'LEVEL' }], ['GND', '', 30, 17, 0, {}],
      ['OUT', '', 34, 15, 0, {}],
      ['C', 'C3', 22, 26, 1, { value: '100n' }],
      ['POT', 'VR1', 22, 30, 3, { value: '250k', taper: 'lin', pos: 0.7, label: 'SUSTAIN' }], ['GND', '', 22, 32, 0, {}],
      ['R', 'R4', 27, 30, 0, { value: '10k' }], ['NPN', 'Q1', 32, 30, 0, { model: '2N3904' }], ['GND', '', 33, 32, 0, {}],
      ['V', '', 33, 20, 0, { value: '9' }], ['R', 'R7', 33, 22, 1, { value: '4.7k' }], ['D', 'D1', 33, 26, 1, { model: 'LED blue' }],
      ['C', 'C4', 36, 24, 1, { value: '10u' }],
    ],
    wires: [
      [[0, 12], [1, 12]], [[5, 12], [12, 12]], [[8, 11], [8, 12]], [[2, 5], [8, 5], [8, 7]],
      [[12, 14], [12, 20], [13, 20]], [[12, 17], [13, 17]], [[10, 14], [12, 14]],
      [[18, 13], [24, 13]], [[17, 17], [20, 17], [20, 13]], [[17, 20], [20, 20], [20, 17]],
      [[28, 13], [30, 13]], [[32, 15], [34, 15]],
      [[22, 13], [22, 24]], [[24, 30], [25, 30]], [[29, 30], [30, 30]],
      [[33, 20], [36, 20], [36, 22]], [[36, 26], [36, 28], [33, 28]],
    ],
  },
};

// Full Big Muff (four transistors), drawn from one stage template. Values per version are read from Kit Rae's traces (bigmuffpage.com).
function bigMuff(about, v) {
  const comps = [['IN', '', -2, 0, 0, {}]], wires = [], n = {};
  const add = (type, x, y, rot, props) => {
    const pre = { R: 'R', C: 'C', D: 'D', NPN: 'Q', POT: 'VR' }[type];
    comps.push([type, pre ? pre + (n[pre] = (n[pre] || 0) + 1) : '', x, y, rot, props || {}]);
  };
  const w = (x, ...pts) => wires.push(pts.map(p => [p[0] + x, p[1]]));
  const part = (t, x, y, val) => add(t, x, y, /~$/.test(val) ? 2 : 0, { value: val.replace('~', '') });   // 'value~': electrolytic with its + on the right
  const stage = (x, a, b, clip, rc) => {     // input parts a, b, then a collector-feedback stage; clip = capacitor in series with the feedback diodes
    part(a[0], x + 2, 0, a[1]); part(b[0], x + 6, 0, b[1]); add('NPN', x + 13, 0, 0, { model: v.q });
    add('R', x + 9, 2, 1, { value: '100k' }); add('GND', x + 9, 4, 0); add('R', x + 14, 4, 1, { value: v.re }); add('GND', x + 14, 6, 0);
    add('R', x + 14, -4, 1, { value: rc }); add('V', x + 14, -6, 0, { value: '9' });
    add('R', x + 13, -9, 0, { value: '470k' }); add('C', x + 13, -11, 0, { value: v.cf });
    w(x, [8, 0], [11, 0]); w(x, [10, 0], [10, clip ? -13 : -11]); w(x, [10, -9], [11, -9]); w(x, [15, -9], [19, -9]);
    w(x, [10, -11], [11, -11]); w(x, [15, -11], [19, -11]); w(x, [14, -2], [19, -2], [19, clip ? -15 : -11]);
    if (clip) {
      part('C', x + 12, -13, clip); add('D', x + 16, -13, 0, { model: '1N4148' }); add('D', x + 16, -15, 2, { model: '1N4148' });
      w(x, [18, -13], [19, -13]); w(x, [14, -13], [14, -15]); w(x, [18, -15], [19, -15]);
    }
  };
  w(0, [-2, 0], [0, 0]);
  const rc = [].concat(v.rc), pot = v.pot || '100k';
  stage(0, ['R', v.rin], ['C', v.c1], null, rc[0]);
  add('C', 22, -2, 0, { value: v.c4 }); add('POT', 26, 0, 3, { value: pot, taper: 'lin', pos: 0.7, label: 'SUSTAIN' }); add('R', 26, 4, 1, { value: v.r23 }); add('GND', 26, 6, 0);
  w(0, [19, -2], [20, -2]); w(0, [24, -2], [26, -2]); w(0, [28, 0], [30, 0]);
  stage(30, ['C', v.c5], ['R', v.rs], v.clip2, rc[1] || rc[0]);
  w(0, [49, -2], [51, -2], [51, 0], [52, 0]);
  stage(52, ['C', v.c13], ['R', v.rs], v.clip3, rc[2] || rc[0]);
  w(0, [71, -2], [72, -2], [72, 0], [74, 0]);                 // tone: high-pass on top of the pot, low-pass on the bottom
  add('C', 76, -2, 0, { value: v.thp }); add('R', 78, 0, 1, { value: v.rhp }); add('GND', 78, 2, 0);
  add('R', 76, 4, 0, { value: v.rlp }); add('C', 78, 6, 1, { value: v.clp }); add('GND', 78, 8, 0);
  add('POT', 81, 1, 3, { value: pot, taper: 'lin', pos: 0.5, label: 'TONE' });
  w(0, [74, -2], [74, 4]); w(0, [78, 4], [81, 4], [81, 3]); w(0, [78, -2], [81, -2], [81, -1]); w(0, [83, 1], [84, 1]);
  add('C', 86, 1, 0, { value: v.c3 }); add('NPN', 93, 1, 0, { model: v.q });       // recovery stage
  add('R', 90, -1, 1, { value: v.r7 || '470k' }); add('R', 90, 3, 1, { value: '100k' }); add('GND', 90, 5, 0);
  add('R', 94, -3, 1, { value: v.rc4 }); add('V', 94, -5, 0, { value: '9' }); add('R', 94, 5, 1, { value: v.r4 || '2.7k' }); add('GND', 94, 7, 0);
  add('C', 97, -1, 0, { value: v.c2 }); add('POT', 101, 1, 3, { value: pot, taper: 'lin', pos: 0.5, label: 'VOLUME' }); add('GND', 101, 3, 0);
  comps.push(['OUT', '', 105, 1, 0, {}]);
  w(0, [88, 1], [91, 1]); w(0, [90, -3], [90, -5], [94, -5]); w(0, [94, -1], [95, -1]); w(0, [99, -1], [101, -1]); w(0, [103, 1], [105, 1]);
  return { about, comps, wires };
}
RAW['Sovtek Big Muff (Civil War / Green Russian)'] = bigMuff('Sovtek version 7: all-green Civil War and tall-font Green Russian, from Kit Rae\'s trace. Three clipping-capable stages (the first has no diodes), the tone control, and a recovery stage. The originals used unmarked transistors; 2N5088 is close, and 2N3904 works with a little less gain.',
  { q: '2N5088', rin: '39k', c1: '100n', rc: '12k', re: '390', cf: '500p', c4: '100n', r23: '1k', c5: '100n', rs: '10k', clip2: '47n', c13: '100n', clip3: '47n',
    thp: '3.9n', rhp: '22k', rlp: '20k', clp: '10n', c3: '100n', rc4: '10k', c2: '100n' });
RAW['EHX Big Muff (Ram\'s Head "47", 1973)'] = bigMuff('Electro-Harmonix version 2 "47" Ram\'s Head, from Kit Rae\'s trace of nine units. Same layout as the Sovtek, with bigger coupling caps (fuller bass), lower emitter resistors (more gain) and a 33k / 33k tone control.',
  { q: '2N5088', rin: '33k', c1: '470n', rc: '12k', re: '100', cf: '470p', c4: '470n', r23: '1.2k', c5: '470n', rs: '7.5k', clip2: '470n', c13: '47n', clip3: '47n',
    thp: '4n', rhp: '33k', rlp: '33k', clp: '12n', c3: '470n', rc4: '12k', c2: '470n' });
const SOV = { q: '2N5088', rin: '39k', c1: '100n', rc: '12k', re: '390', cf: '500p', c4: '100n', r23: '1k', c5: '100n', rs: '10k', clip2: '47n', c13: '100n', clip3: '47n',
  thp: '3.9n', rhp: '22k', rlp: '20k', clp: '10n', c3: '100n', rc4: '10k', c2: '100n' };
RAW['Sovtek Red Army Overdrive (first Russian Big Muff, 1990)'] = bigMuff('Sovtek Red Army Overdrive, first edition, from Kit Rae\'s trace. The circuit every later Russian Big Muff kept: the only difference from the Civil War is 430 pF feedback caps. Originals used KT3102E transistors.',
  Object.assign({}, SOV, { cf: '430p' }));
RAW['Sovtek Big Muff (Black Russian)'] = bigMuff('Sovtek bubble-font Green Russian, Black Russian and small-box version 8, from Kit Rae\'s trace: the Civil War circuit with single 470 pF feedback caps and BC547C / BC549C transistors.',
  Object.assign({}, SOV, { cf: '470p', q: 'BC547' }));
RAW['EHX Big Muff (Triangle, V1 1967)'] = bigMuff('Electro-Harmonix version 1 "Triangle", unit 67 #1 from Kit Rae\'s trace, the most common V1 circuit. 100 nF clipping caps and 100 ohm emitter resistors: more gain and a brighter edge than the Russian ones.',
  { q: '2N5088', rin: '33k', c1: '100n', rc: ['10k', '10k', '15k'], re: '100', cf: '500p', c4: '100n', r23: '820', c5: '100n', rs: '8.2k', clip2: '100n', c13: '100n', clip3: '100n',
    thp: '4n', rhp: '33k', rlp: '33k', clp: '10n', c3: '100n', r7: '390k', rc4: '12k', c2: '100n' });
RAW['EHX Big Muff (V6, 1978-84)'] = bigMuff('Electro-Harmonix version 6 (red and black box), from Kit Rae\'s trace, without its tone-bypass switch. 1 uF electrolytics in the signal path and clipping loops, 150k pots.',
  { q: '2N5088', rin: '39k', c1: '1u~', rc: '15k', re: '100', cf: '470p', c4: '1u', r23: '1k', c5: '100n', rs: '8.2k', clip2: '1u~', c13: '100n', clip3: '1u~',
    thp: '4n', rhp: '22k', rlp: '39k', clp: '10n', c3: '100n', r7: '390k', rc4: '10k', r4: '2.2k', c2: '1u', pot: '150k' });
RAW['EHX Big Muff (late 70s, 3rd version)'] = bigMuff('Electro-Harmonix Big Muff, late-70s third version, from the General Guitar Gadgets BMP replica schematic (ggg_bmp_l70_sc). 1 uF coupling caps between the stages, 15k collector resistors, 100 nF clipping caps and a 39k / 100k tone control.',
  { q: '2N5088', rin: '39k', c1: '100n', rc: '15k', re: '100', cf: '500p', c4: '1u', r23: '1k', c5: '1u', rs: '8.2k', clip2: '100n', c13: '1u', clip3: '100n',
    thp: '3.9n', rhp: '100k', rlp: '39k', clp: '10n', c3: '100n', r7: '390k', rc4: '10k', r4: '2.2k', c2: '100n' });
RAW['Orange Squeezer compressor (JFET)'] = {
  about: 'Dan Armstrong Orange Squeezer, from the General Guitar Gadgets replica schematic. Q2 is a voltage-controlled resistor that shunts the signal ahead of the op-amp (gain 23); D1 and C7 rectify the output and push Q2\'s gate up as you play louder. Q1 is a current source that sets Q2\'s resting point through the BIAS trimmer: turn it down for more squeeze (below about 4 it chokes the signal). JFETs vary a lot, so the trimmer position is set by ear on the real thing.',
  comps: [
    ['IN', '', 0, 10, 0, {}], ['R', 'R1', 2, 12, 1, { value: '1.5M' }], ['GND', '', 2, 14, 0, {}],
    ['C', 'C1', 5, 10, 0, { value: '47n' }], ['R', 'R2', 9, 10, 0, { value: '82k' }],
    ['JFET', 'Q2', 12, 13, 2, { model: '2N5457', flip: true }], ['JFET', 'Q1', 6, 16, 2, { model: '2N5457', flip: true }], ['V', '', 5, 14, 0, { value: '9' }],
    ['R', 'R5', 8, 20, 0, { value: '2.4k' }], ['C', 'C3', 11, 24, 1, { value: '4.7u' }], ['GND', '', 11, 26, 0, {}],
    ['POT', 'VR1', 8, 24, 1, { value: '10k', taper: 'lin', pos: 0.5, label: 'BIAS' }], ['GND', '', 8, 26, 0, {}],
    ['C', 'C2', 17, 12, 1, { value: '2.2n' }], ['R', 'R3', 17, 16, 1, { value: '470k' }], ['R', 'R6', 17, 20, 1, { value: '470k' }],
    ['C', 'C4', 23, 10, 0, { value: '47n' }], ['R', 'R4', 27, 8, 1, { value: '390k' }], ['V', '', 27, 6, 0, { value: '9' }], ['R', 'R8', 27, 12, 1, { value: '470k' }], ['GND', '', 27, 14, 0, {}],
    ['OPA', 'U1', 32, 11, 0, { model: 'RC4558', flip: true }], ['R', 'R9', 32, 15, 0, { value: '220k' }],
    ['R', 'R10', 29, 17, 1, { value: '10k' }], ['C', 'C5', 29, 21, 1, { value: '4.7u' }], ['GND', '', 29, 23, 0, {}],
    ['C', 'C6', 39, 11, 0, { value: '4.7u' }], ['R', 'R11', 43, 13, 1, { value: '1.5k' }], ['D', 'D1', 43, 17, 1, { model: '1N34A (Ge)' }],
    ['C', 'C7', 43, 21, 1, { value: '4.7u' }], ['GND', '', 43, 23, 0, {}], ['R', 'R12', 40, 21, 1, { value: '100k' }], ['GND', '', 40, 23, 0, {}],
    ['POT', 'VR2', 47, 13, 3, { value: '10k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', '', 47, 15, 0, {}], ['OUT', '', 51, 13, 0, {}],
  ],
  wires: [
    [[0, 10], [3, 10]], [[11, 10], [21, 10]], [[11, 10], [11, 11]], [[11, 15], [11, 22]], [[8, 16], [11, 16]], [[5, 18], [5, 20], [6, 20]], [[10, 20], [11, 20]],
    [[8, 22], [11, 22]], [[6, 24], [6, 26], [8, 26]], [[14, 13], [15, 13], [15, 18], [17, 18]], [[17, 22], [17, 26], [36, 26], [36, 19], [40, 19]], [[40, 19], [43, 19]],
    [[25, 10], [29, 10]], [[29, 12], [29, 15], [30, 15]], [[34, 15], [36, 15], [36, 11]], [[35, 11], [37, 11]], [[41, 11], [47, 11]], [[49, 13], [51, 13]],
  ],
};

// Building blocks: pre-wired groups dropped into a schematic. Same compact form, coordinates relative
// to the cursor. `io` marks the signal input and output ends (used by the self-test).
const fmv = (slope, c1, c2, c3, rt, rb, rm, tb) => ({
  io: [[0, 0], [14, 2]],
  comps: [
    ['C', 4, 0, 0, { value: c1 }], ['R', 3, 6, 0, { value: slope }], ['C', 7, 4, 0, { value: c2 }], ['C', 7, 8, 0, { value: c3 }],
    ['POT', 10, 2, 3, { value: rt, taper: 'log', pos: 0.5, label: 'TREBLE' }],
    ['POT', 10, 6, 3, { value: rb, taper: tb, pos: 0.5, label: 'BASS' }],
    ['POT', 10, 10, 3, { value: rm, taper: 'lin', pos: 0.5, label: 'MID' }], ['GND', 10, 12, 0, {}],
  ],
  wires: [[[0, 0], [2, 0]], [[1, 0], [1, 6]], [[6, 0], [10, 0]], [[12, 2], [14, 2]], [[5, 4], [5, 8]], [[9, 4], [10, 4]],
    [[12, 6], [12, 4], [10, 4]], [[9, 8], [10, 8]], [[12, 10], [12, 8], [10, 8]]],
});
// Big Muff tone control and its variants. Input splits into a low-pass (r1, c1) and a high-pass (c2, r2);
// the TONE pot blends them.
function muff(r1, c1, c2, r2, pot, kind) {
  const b = {
    io: [[0, 0], [12, 1]],
    comps: [['C', 3, -2, 0, { value: c2 }], ['R', 3, 4, 0, { value: r1 }], ['C', 5, 6, 1, { value: c1 }], ['GND', 5, 8, 0, {}],
      ['POT', 8, 1, 3, { value: pot, taper: 'lin', pos: 0.5, label: 'TONE' }]],
    wires: [[[0, 0], [1, 0]], [[1, kind === 'musket' || kind === 'pickle' ? -6 : -2], [1, 4]], [[5, 4], [8, 4], [8, 3]], [[10, 1], [12, 1]]],
  };
  if (r2) b.comps.push(['R', 5, 0, 1, { value: r2 }], ['GND', 5, 2, 0, {}]);
  if (kind !== 'pickle') b.wires.push([[5, -2], [8, -2], [8, -1]]);
  if (kind === 'hoof') {                 // mids pot in series with the high-pass shunt resistor
    b.comps.push(['POT', 5, -4, 1, { value: '25k', taper: 'lin', pos: 0.5, label: 'MIDS', flip: true }], ['R', 9, -6, 0, { value: '2.2k' }], ['GND', 11, -6, 0, {}]);
    b.wires.push([[7, -4], [7, -6], [5, -6]]);
  } else if (kind === 'musket') {        // second, larger cap fed into the high-pass node through the mids pot
    b.comps.push(['C', 3, -6, 0, { value: '47n' }], ['POT', 5, -4, 1, { value: '100k', taper: 'lin', pos: 0.5, label: 'MIDS', flip: true }]);
    b.wires.push([[7, -4], [7, -6], [5, -6]]);
  } else if (kind === 'pickle') {        // voice pot blends two caps, scoop pot sets the shunt to ground
    b.comps.push(['C', 3, -6, 0, { value: '33n' }], ['POT', 5, -4, 1, { value: '500k', taper: 'lin', pos: 0.5, label: 'VOICE', flip: true }],
      ['POT', 12, -4, 0, { value: '50k', taper: 'lin', pos: 0.5, label: 'SCOOP' }], ['R', 16, -4, 0, { value: '1.5k' }], ['GND', 18, -4, 0, {}]);
    b.wires.push([[7, -4], [10, -4]], [[8, -4], [8, -1]], [[12, -2], [14, -2], [14, -4]]);
  }
  return b;
}
// Sovtek stacks: like the Fender/Marshall one, but the mid pot's wiper (not its top) takes the mid cap.
function sovtek(r1, c2, rt, tt, rm, comps, wires) {
  return {
    io: [[0, 0], [14, 2]],
    comps: [['C', 4, 0, 0, { value: '470p' }], ['R', 3, 6, 0, { value: r1 }], ['C', 7, 4, 0, { value: c2 }], ['C', 7, 14, 0, { value: '22n' }],
      ['POT', 10, 2, 3, { value: rt, taper: tt, pos: 0.5, label: 'TREBLE' }],
      ['POT', 10, 6, 3, { value: '1M', taper: 'log', pos: 0.5, label: 'BASS' }],
      ['POT', 10, 10, 3, { value: rm, taper: 'lin', pos: 0.5, label: 'MID' }], ['GND', 10, 12, 0, {}], ...comps],
    wires: [[[0, 0], [2, 0]], [[1, 0], [1, 6]], [[6, 0], [10, 0]], [[12, 2], [14, 2]], [[5, 4], [5, 14]], [[9, 4], [10, 4]],
      [[12, 6], [12, 4], [10, 4]], [[9, 14], [14, 14], [14, 10], [12, 10]], [[14, 10], [16, 10]], ...wires],
  };
}
// Gyrator (simulated inductor) used by the Boss EQs: series cap, then an op-amp follower. Input at (x, y).
function gyr(b, x, y, cs, cp, rb, ro) {
  b.comps.push(['C', x + 2, y, 0, { value: cs }], ['C', x + 6, y, 0, { value: cp }], ['OPA', x + 12, y + 1, 0, { model: 'TL072', flip: true }],
    ['R', x + 8, y - 2, 1, { value: rb }], ['R', x + 10, y + 6, 0, { value: ro }]);
  b.wires.push([[x + 8, y], [x + 9, y]], [[x + 9, y + 2], [x + 9, y + 4], [x + 16, y + 4], [x + 16, y + 1], [x + 15, y + 1]],
    [[x + 4, y], [x + 4, y + 6], [x + 8, y + 6]], [[x + 12, y + 6], [x + 16, y + 6], [x + 16, y + 4]]);
  b.vref.push([x + 8, y - 4]);
}
// Boss active EQ core: two pots between the op-amp inputs, each wiper going to a frequency-selective network.
// `vref` lists the free resistor ends that must be wired to the half-supply bias.
function boss(rin, rf, cf, rbias, rout, potv, names, add) {
  const b = {
    active: true, vref: [[-11, -5]], io: [[-12, -1], rout ? [15, 0] : [11, 0]],
    comps: [['R', -8, -1, 0, { value: rin }], ['R', -11, -3, 1, { value: rbias }], ['OPA', 0, 0, 0, { model: 'TL072', flip: true }],
      ['R', 0, 4, 0, { value: rf }], ['C', 0, 6, 0, { value: cf }], ['C', 7, 0, 0, { value: '10u' }],
      ['POT', -8, 9, 0, { value: potv, taper: 'lin', pos: 0.5, label: names[0] }],
      ['POT', -8, 23, 0, { value: potv, taper: 'lin', pos: 0.5, label: names[1] }]],
    wires: [[[-12, -1], [-10, -1]], [[-6, -1], [-3, -1]], [[-3, 1], [-3, 23], [-6, 23]], [[-3, 4], [-2, 4]], [[-3, 6], [-2, 6]],
      [[2, 4], [4, 4], [4, 0]], [[2, 6], [4, 6], [4, 4]], [[3, 0], [5, 0]], [[-6, 9], [-3, 9]],
      [[-5, -1], [-5, 2], [-13, 2], [-13, 23], [-10, 23]], [[-13, 9], [-10, 9]]],
  };
  if (rout) { b.comps.push(['R', 11, 0, 0, { value: rout }]); b.wires.push([[13, 0], [15, 0]]); } else b.wires.push([[9, 0], [11, 0]]);
  add(b);
  return b;
}
const BLOCKS = {
  'Power: half-supply bias (Vref)': {
    comps: [['V', 0, 0, 0, { value: '9' }], ['R', 0, 2, 1, { value: '10k' }], ['R', 0, 6, 1, { value: '10k' }], ['GND', 0, 8, 0, {}],
      ['C', 3, 6, 1, { value: '47u' }], ['GND', 3, 8, 0, {}]],
    wires: [[[0, 4], [3, 4], [5, 4]]],
  },
  'Input: pulldown + coupling cap': {
    io: [[0, 0], [6, 0]],
    comps: [['R', 1, 2, 1, { value: '1M' }], ['GND', 1, 4, 0, {}], ['C', 4, 0, 0, { value: '100n' }]],
    wires: [[[0, 0], [2, 0]]],
  },
  'Gain: op-amp stage (non-inverting)': {
    comps: [['OPA', 0, 0, 0, { model: 'TL072', flip: true }], ['R', 0, 4, 0, { value: '100k' }], ['R', -3, 6, 1, { value: '10k' }],
      ['C', -3, 10, 1, { value: '1u' }], ['GND', -3, 12, 0, {}], ['R', -5, -3, 1, { value: '1M' }]],
    wires: [[[-3, 1], [-3, 4], [-2, 4]], [[2, 4], [4, 4], [4, 0]], [[3, 0], [6, 0]], [[-7, -1], [-3, -1]]],
  },
  'Clipper: diodes to ground': {
    io: [[0, 0], [4, 0]],
    comps: [['D', 1, 2, 3, { model: '1N4148' }], ['D', 3, 2, 1, { model: '1N4148' }], ['GND', 2, 4, 0, {}]],
    wires: [[[0, 0], [4, 0]], [[1, 4], [3, 4]]],
  },
  'Tone: treble cut (RAT filter)': {
    io: [[0, 0], [11, 0]],
    comps: [['R', 2, 0, 0, { value: '1.5k' }], ['POT', 6, 0, 0, { value: '100k', taper: 'log', pos: 0.3, label: 'FILTER' }],
      ['C', 10, 2, 1, { value: '3.3n' }], ['GND', 10, 4, 0, {}]],
    wires: [[[6, 2], [8, 2], [8, 0]], [[8, 0], [11, 0]]],
  },
  'Tone: Big Muff': muff('39k', '10n', '4n', '22k', '100k'),
  "Tone: Big Muff (Ram's Head)": muff('33k', '12n', '4n', '33k', '100k'),
  'Tone: Big Muff (Green Russian)': muff('20k', '10n', '3.9n', '22k', '100k'),
  'Tone: Big Muff (Op-amp)': muff('5.6k', '120n', '120n', '1.2k', '100k'),
  'Tone: Big Muff / Hoof (mids)': muff('39k', '6.8n', '6.8n', null, '100k', 'hoof'),
  'Tone: Big Muff / Musket (mids)': muff('10k', '47n', '3.3n', '56k', '250k', 'musket'),
  'Tone: Big Muff / Pickle (scoop, voice)': muff('33k', '100n', '3.3n', null, '100k', 'pickle'),
  'Tone stack: Fender (blackface)': fmv('100k', '250p', '100n', '47n', '250k', '250k', '10k', 'log'),
  'Tone stack: Marshall': fmv('33k', '470p', '22n', '22n', '220k', '1M', '22k', 'log'),
  'Tone stack: Hiwatt CP': {
    io: [[0, 0], [14, 2]],
    comps: [['C', 2, 0, 0, { value: '47n' }], ['C', 7, 0, 0, { value: '220p' }], ['R', 4, 2, 3, { value: '100k' }],
      ['POT', 10, 2, 3, { value: '250k', taper: 'lin', pos: 0.5, label: 'TREBLE' }],
      ['POT', 10, 6, 3, { value: '500k', taper: 'log', pos: 0.5, label: 'BASS' }], ['GND', 10, 8, 0, {}],
      ['R', 14, 6, 1, { value: '10k' }], ['C', 14, 10, 1, { value: '47n' }], ['GND', 14, 12, 0, {}]],
    wires: [[[4, 0], [5, 0]], [[9, 0], [10, 0]], [[12, 2], [14, 2]], [[4, 4], [14, 4]], [[12, 6], [12, 8], [14, 8]]],
  },
  'Tone stack: Hiwatt DR': {
    io: [[0, 0], [18, 2]],
    comps: [['C', 4, 0, 0, { value: '1n' }], ['C', 8, 0, 0, { value: '220p' }], ['R', 6, 2, 3, { value: '220k' }],
      ['POT', 10, 2, 3, { value: '220k', taper: 'lin', pos: 0.5, label: 'TREBLE' }], ['R', 14, 2, 0, { value: '22k' }],
      ['R', 10, 6, 1, { value: '22k' }],
      ['POT', 10, 10, 3, { value: '100k', taper: 'lin', pos: 0.5, label: 'MID' }],
      ['POT', 10, 14, 3, { value: '470k', taper: 'log', pos: 0.5, label: 'BASS' }], ['GND', 10, 16, 0, {}],
      ['C', 6, 10, 3, { value: '1n' }], ['R', 1, 2, 3, { value: '100k' }], ['C', 1, 6, 1, { value: '47n' }], ['GND', 1, 8, 0, {}],
      ['C', 3, 12, 0, { value: '47n' }]],
    wires: [[[0, 0], [2, 0]], [[16, 2], [18, 2]], [[6, 4], [10, 4]], [[12, 10], [12, 8], [10, 8]], [[12, 14], [12, 12], [10, 12]],
      [[6, 8], [10, 8]], [[5, 12], [10, 12]], [[1, 4], [-1, 4], [-1, 12], [1, 12]]],
  },
  'Tone stack: Sovtek MIG-60': sovtek('56k', '33n', '250k', 'lin', '25k',
    [['C', 16, 12, 1, { value: '470p' }], ['GND', 16, 14, 0, {}]], []),
  'Tone stack: Sovtek MIG-100H': sovtek('47k', '22n', '500k', 'log', '10k',
    [['R', 16, 12, 1, { value: '33k' }], ['GND', 16, 14, 0, {}], ['R', 15, 8, 0, { value: '100' }]], [[[10, 8], [13, 8]], [[17, 8], [17, 10], [16, 10]]]),
  'EQ: Boss FZ-2 (active)': boss('10k', '10k', '47p', '100k', null, '50k', ['TREBLE', 'BASS'], b => {
    b.comps.push(['C', -8, 13, 1, { value: '15n' }], ['R', -8, 17, 1, { value: '3.3k' }], ['GND', -8, 19, 0, {}]);
    b.wires.push([[-8, 25], [-8, 27], [-6, 27]]);
    gyr(b, -6, 27, '150n', '47n', '100k', '3.3k');
  }),
  'EQ: Boss HM-2 (active)': boss('3.3k', '3.3k', '470p', '1M', '10k', '10k', ['COLOR L', 'COLOR H'], b => {
    b.wires.push([[-8, 11], [-8, 13], [-1, 13]], [[-8, 25], [-8, 27], [-6, 27]], [[-8, 27], [-8, 39], [-6, 39]]);
    gyr(b, -1, 13, '1.5u', '68n', '100k', '330');
    gyr(b, -6, 27, '150n', '6.8n', '82k', '330');
    gyr(b, -6, 39, '100n', '4.7n', '100k', '330');
  }),
  'Tone stack: Fender Bassman 5F6-A': fmv('56k', '250p', '20n', '20n', '250k', '1M', '25k', 'log'),
  'Tone stack: Fender treble / bass (two-knob)': (() => {      // blackface stack with the mid pot replaced by a fixed 6.8k
    const b = fmv('100k', '250p', '100n', '47n', '250k', '250k', '10k', 'log');
    b.comps[6] = ['R', 10, 10, 1, { value: '6.8k' }]; b.wires.pop();
    return b;
  })(),
  'Tone stack: Vox (top boost)': {
    io: [[0, 0], [14, 2]],
    comps: [['C', 4, 0, 0, { value: '47p' }], ['R', 3, 6, 0, { value: '100k' }], ['C', 7, 4, 0, { value: '22n' }], ['C', 7, 10, 0, { value: '22n' }],
      ['POT', 10, 2, 3, { value: '1M', taper: 'log', pos: 0.5, label: 'TREBLE' }],
      ['POT', 10, 6, 1, { value: '1M', taper: 'log', pos: 0.5, label: 'BASS', flip: true }], ['GND', 10, 8, 0, {}],   // lug 1 on top, so clockwise is more bass
      ['R', 12, 12, 1, { value: '10k' }], ['GND', 12, 14, 0, {}]],
    wires: [[[0, 0], [2, 0]], [[1, 0], [1, 6]], [[6, 0], [10, 0]], [[12, 2], [14, 2]], [[5, 4], [5, 10]], [[9, 4], [10, 4]], [[9, 10], [12, 10], [12, 6]]],
  },
  'Tone: James / Baxandall passive (bass, treble)': {
    io: [[0, 0], [10, 9]],
    comps: [['R', 3, 2, 1, { value: '2.2k' }], ['POT', 3, 6, 3, { value: '10k', taper: 'lin', pos: 0.5, label: 'BASS' }], ['R', 3, 10, 1, { value: '2.2k' }], ['GND', 3, 12, 0, {}],
      ['C', 0, 6, 1, { value: '220n' }], ['R', 8, 6, 0, { value: '2.2k' }],
      ['C', 12, 2, 1, { value: '10n' }], ['POT', 12, 6, 3, { value: '10k', taper: 'lin', pos: 0.5, label: 'TREBLE', flip: true }], ['C', 12, 10, 1, { value: '10n' }], ['GND', 12, 12, 0, {}]],
    wires: [[[0, 0], [12, 0]], [[0, 4], [3, 4]], [[0, 8], [3, 8]], [[5, 6], [6, 6]], [[10, 6], [10, 9]]],
  },
  'Tone: SWTC 1 (treble cut + volume)': {
    io: [[0, 0], [14, 2]],
    comps: [['R', 2, 0, 0, { value: '1k' }], ['POT', 6, 0, 2, { value: '50k', taper: 'lin', pos: 0.5, label: 'TONE', flip: true }], ['C', 6, 4, 1, { value: '10n' }], ['GND', 6, 6, 0, {}],
      ['POT', 10, 2, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', 10, 4, 0, {}]],
    wires: [[[8, 0], [10, 0]], [[12, 2], [14, 2]]],
  },
  'Tone: SWTC 3 (bright / dark + volume)': {
    io: [[0, 0], [16, 2]],
    comps: [['R', 2, 0, 0, { value: '10k' }], ['R', 6, 0, 0, { value: '47k' }], ['C', 4, 2, 1, { value: '22n' }],
      ['POT', 8, 2, 3, { value: '100k', taper: 'lin', pos: 0.5, label: 'TONE', flip: true }], ['GND', 8, 4, 0, {}],
      ['POT', 12, 2, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', 12, 4, 0, {}]],
    wires: [[[4, 4], [6, 4], [6, 2]], [[8, 0], [12, 0]], [[14, 2], [16, 2]]],
  },
  'Tone: SWTC 4 (two caps + volume)': {
    io: [[0, 0], [17, 4]],
    comps: [['R', 2, 0, 0, { value: '4.7k' }], ['C', 4, 2, 1, { value: '3.3n' }], ['GND', 4, 4, 0, {}],
      ['POT', 8, 2, 3, { value: '10k', taper: 'lin', pos: 0.5, label: 'TONE' }], ['C', 8, 6, 1, { value: '22n' }], ['GND', 8, 8, 0, {}],
      ['POT', 13, 4, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', 13, 6, 0, {}]],
    wires: [[[4, 0], [8, 0]], [[10, 2], [13, 2]], [[15, 4], [17, 4]]],
  },
  'Tone: mid scoop (Framus)': {
    io: [[0, 0], [11, 2]],
    comps: [['C', 2, 2, 1, { value: '1n' }], ['R', 2, 6, 1, { value: '100k' }], ['GND', 2, 8, 0, {}], ['C', 5, 4, 0, { value: '1n' }],
      ['POT', 7, 2, 3, { value: '1M', taper: 'lin', pos: 0.5, label: 'MID' }]],
    wires: [[[0, 0], [7, 0]], [[2, 4], [3, 4]], [[9, 2], [11, 2]]],
  },
  'EQ: Tilt (active)': {
    active: true, vref: [[-5, 3]], io: [[-11, -6], [9, 0]],
    comps: [['OPA', 0, 0, 0, { model: 'TL082' }], ['POT', -3, -6, 0, { value: '50k', taper: 'lin', pos: 0.5, label: 'TILT' }],
      ['R', -9, -6, 0, { value: '47k' }], ['R', 3, -6, 0, { value: '47k' }],
      ['C', -9, -9, 0, { value: '5.6n' }], ['R', -3, -9, 0, { value: '15k' }], ['C', -3, -12, 0, { value: '5.6n' }], ['R', 2, -12, 0, { value: '15k' }], ['C', 7, 0, 0, { value: '10u' }]],
    wires: [[[-3, -4], [-3, -1]], [[-7, -6], [-5, -6]], [[-1, -6], [1, -6]], [[5, -12], [5, 0], [3, 0]],
      [[-11, -6], [-11, -9]], [[-7, -9], [-5, -9]], [[-1, -9], [0, -9], [0, -6]],
      [[-6, -6], [-6, -12], [-5, -12]], [[-1, -12], [0, -12]], [[4, -12], [5, -12]], [[-3, 1], [-5, 1], [-5, 3]]],
  },
  'Filter: low-pass 2-pole (Sallen-Key, 3.4 kHz)': {
    active: true, vref: [[-13, -5]], io: [[-13, -1], [9, 0]],
    comps: [['OPA', 0, 0, 0, { model: 'TL082', flip: true }], ['R', -11, -1, 0, { value: '10k' }], ['R', -7, -1, 0, { value: '10k' }],
      ['C', -5, 1, 1, { value: '3.3n' }], ['GND', -5, 3, 0, {}], ['C', -2, 7, 0, { value: '6.8n' }], ['R', -13, -3, 1, { value: '1M' }], ['C', 7, 0, 0, { value: '10u' }]],
    wires: [[[-5, -1], [-3, -1]], [[-3, 1], [-3, 5], [5, 5], [5, 0], [3, 0]], [[-9, -1], [-9, 7], [-4, 7]], [[0, 7], [5, 7], [5, 5]]],
  },
  'Buffer: op-amp follower': {
    active: true, vref: [[-5, -5]], io: [[-7, -1], [8, 0]],
    comps: [['OPA', 0, 0, 0, { model: 'TL082', flip: true }], ['R', -5, -3, 1, { value: '1M' }], ['C', 6, 0, 0, { value: '10u' }]],
    wires: [[[-7, -1], [-3, -1]], [[-3, 1], [-3, 3], [4, 3], [4, 0], [3, 0]]],
  },
  'Buffer: emitter follower (2N3904)': {
    io: [[0, 0], [14, 2]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['NPN', 8, 0, 0, { model: '2N3904' }],
      ['R', 5, -2, 1, { value: '1M' }], ['V', 5, -4, 0, { value: '9' }], ['R', 5, 2, 1, { value: '1M' }], ['GND', 5, 4, 0, {}],
      ['V', 9, -2, 0, { value: '9' }], ['R', 9, 4, 1, { value: '10k' }], ['GND', 9, 6, 0, {}], ['C', 12, 2, 0, { value: '10u' }]],
    wires: [[[4, 0], [6, 0]], [[9, 2], [10, 2]]],
  },
  'Gain: NPN stage (LPB-1 style)': {
    gain: [5, 40], io: [[0, 0], [15, -2]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['NPN', 9, 0, 0, { model: '2N3904' }],
      ['R', 6, -2, 1, { value: '430k' }], ['R', 6, 2, 1, { value: '43k' }], ['GND', 6, 4, 0, {}],
      ['V', 10, -6, 0, { value: '9' }], ['R', 10, -4, 1, { value: '10k' }], ['R', 10, 4, 1, { value: '390' }], ['GND', 10, 6, 0, {}],
      ['C', 13, -2, 0, { value: '100n' }]],
    wires: [[[4, 0], [7, 0]], [[6, -4], [6, -6], [10, -6]], [[10, -2], [11, -2]]],
  },
  'Clipper: asymmetric (2 + 1 diodes)': {
    io: [[0, 0], [4, 0]],
    comps: [['D', 1, 2, 3, { model: '1N4148' }], ['D', 3, 2, 1, { model: '1N4148' }], ['D', 3, 6, 1, { model: '1N4148' }], ['GND', 2, 8, 0, {}]],
    wires: [[[0, 0], [4, 0]], [[1, 4], [1, 8], [3, 8]]],
  },
  'Clipper: feedback pair (soft clipping)': {
    comps: [['D', 2, 0, 0, { model: '1N4148' }], ['D', 2, 2, 2, { model: '1N4148' }]],
    wires: [[[-1, 0], [0, 0], [0, 2]], [[4, 2], [4, 0], [5, 0]]],
  },
  'Power: polarity protection + filter': {
    comps: [['V', 0, 0, 0, { value: '9' }], ['D', 2, 0, 0, { model: '1N5819' }], ['C', 5, 2, 1, { value: '100u' }], ['GND', 5, 4, 0, {}],
      ['C', 8, 2, 1, { value: '100n' }], ['GND', 8, 4, 0, {}], ['NET', 10, 0, 0, { name: 'VCC' }]],
    wires: [[[4, 0], [10, 0]]],
  },
  'Power: 5.1 V zener rail': {
    comps: [['V', 0, 0, 0, { value: '9' }], ['R', 2, 0, 0, { value: '470' }], ['D', 5, 2, 3, { model: '1N4733A' }], ['GND', 5, 4, 0, {}],
      ['C', 8, 2, 1, { value: '10u' }], ['GND', 8, 4, 0, {}], ['NET', 10, 0, 0, { name: '5V' }]],
    wires: [[[4, 0], [10, 0]]],
  },
  'LFO: 555 + LED (drives an LDR)': {
    comps: [['NE555', 7, 8, 0, {}], ['V', 0, 0, 0, { value: '9' }], ['R', 0, 2, 1, { value: '10k' }], ['R', 0, 8, 1, { value: '4.7k' }],
      ['POT', 0, 12, 1, { value: '10k', taper: 'lin', pos: 0.5, label: 'RATE' }], ['C', 0, 16, 1, { value: '10u' }], ['GND', 0, 18, 0, {}],
      ['R', 14, 6, 0, { value: '1k' }], ['D', 17, 8, 1, { model: 'LED blue' }], ['GND', 17, 10, 0, {}]],
    wires: [[[0, 4], [0, 6], [3, 6]], [[-2, 12], [-2, 10], [0, 10]], [[0, 14], [2, 14], [2, 10], [3, 10]], [[2, 10], [2, 8], [3, 8]], [[11, 6], [12, 6]], [[16, 6], [17, 6]]],
  },
  'Tremolo: LDR attenuator (needs an LED)': {       // led '@': linked to an LED when the block is placed
    io: [[0, 0], [9, 0]],
    comps: [['R', 2, 0, 0, { value: '22k' }], ['POT', 7, 2, 1, { value: '10k', taper: 'lin', pos: 1, label: 'DEPTH' }],
      ['LDR', 7, 6, 1, { dark: '1M', lit: '2k', light: 0.5, led: '@' }], ['GND', 7, 8, 0, {}]],
    wires: [[[4, 0], [9, 0]], [[5, 2], [5, 0]]],
  },
  'Compressor: optical (op-amp + LDR + LED)': {
    active: true, gain: [2, 25], vref: [[-4, -5]], io: [[-7, 0], [22, 3]],
    comps: [['OPA', 3, 1, 0, { model: 'TL082', flip: true }], ['R', -4, -3, 1, { value: '1M' }],
      ['R', 3, 5, 0, { value: '220k' }], ['LDR', 3, 8, 0, { dark: '1M', lit: '2k', light: 0.5, led: '@' }],
      ['R', -2, 4, 1, { value: '10k' }], ['C', -2, 8, 1, { value: '10u' }], ['GND', -2, 10, 0, {}],
      ['C', 14, 1, 0, { value: '100n' }], ['POT', 18, 3, 3, { value: '250k', taper: 'lin', pos: 0.5, label: 'LEVEL' }], ['GND', 18, 5, 0, {}],
      ['C', 10, 14, 1, { value: '100n' }], ['POT', 10, 18, 3, { value: '250k', taper: 'lin', pos: 0.7, label: 'SUSTAIN' }], ['GND', 10, 20, 0, {}],
      ['R', 15, 18, 0, { value: '10k' }], ['NPN', 20, 18, 0, { model: '2N3904' }], ['GND', 21, 20, 0, {}],
      ['V', 21, 8, 0, { value: '9' }], ['R', 21, 10, 1, { value: '4.7k' }], ['D', 21, 14, 1, { model: 'LED blue' }], ['C', 24, 12, 1, { value: '10u' }]],
    wires: [[[-7, 0], [0, 0]], [[-4, -1], [-4, 0]], [[0, 2], [0, 8], [1, 8]], [[0, 5], [1, 5]], [[-2, 2], [0, 2]],
      [[6, 1], [12, 1]], [[5, 5], [8, 5], [8, 1]], [[5, 8], [8, 8], [8, 5]], [[16, 1], [18, 1]], [[20, 3], [22, 3]],
      [[10, 1], [10, 12]], [[12, 18], [13, 18]], [[17, 18], [18, 18]], [[21, 8], [24, 8], [24, 10]], [[24, 14], [24, 16], [21, 16]]],
  },
  'Tone stack: Blackstar HT-5 (with ISF)': {      // ISF is a dual-gang pot on the amp: move both ISF knobs together
    io: [[0, 0], [19, 4]],
    comps: [['POT', 2, 2, 3, { value: '10k', taper: 'log', pos: 0.5, label: 'ISF' }], ['R', 2, 6, 1, { value: '4.7k' }], ['C', 2, 10, 1, { value: '220n' }], ['GND', 2, 12, 0, {}],
      ['C', 6, 2, 1, { value: '470n' }], ['R', 6, 6, 1, { value: '6.8k' }],
      ['POT', 6, 10, 1, { value: '2.2k', taper: 'lin', pos: 0.5, label: 'MID' }],
      ['C', 8, 8, 0, { value: '220n' }], ['C', 10, 0, 0, { value: '4.7n' }], ['R', 12, 2, 1, { value: '22k' }],
      ['POT', 12, 6, 1, { value: '10k', taper: 'log', pos: 0.5, label: 'ISF (b)' }],
      ['POT', 15, 4, 3, { value: '47k', taper: 'lin', pos: 0.5, label: 'TREBLE' }],
      ['R', 12, 10, 1, { value: '1k' }], ['POT', 12, 14, 1, { value: '100k', taper: 'log', pos: 0.5, label: 'BASS' }], ['GND', 12, 16, 0, {}]],
    wires: [[[0, 0], [8, 0]], [[4, 2], [4, 4], [6, 4]], [[4, 10], [4, 8], [2, 8]], [[6, 12], [4, 12], [4, 10]], [[10, 6], [10, 8]], [[10, 8], [12, 8]],
      [[12, 0], [15, 0], [15, 2]], [[12, 8], [15, 8], [15, 6]], [[17, 4], [19, 4]], [[10, 14], [10, 16], [12, 16]]],
  },
  'Tone stack: Dumble (rock)': {
    io: [[0, 0], [15, 2]],
    comps: [['R', 0, 2, 1, { value: '150k' }], ['C', 4, 0, 0, { value: '2n' }], ['R', 6, 2, 1, { value: '4.7M' }], ['GND', 6, 4, 0, {}], ['C', 9, 0, 0, { value: '390p' }],
      ['POT', 11, 2, 3, { value: '250k', taper: 'log', pos: 0.5, label: 'TREBLE' }],
      ['C', 2, 6, 0, { value: '100n' }], ['POT', 4, 8, 1, { value: '250k', taper: 'log', pos: 0.5, label: 'BASS' }], ['C', 7, 8, 1, { value: '1n' }],
      ['R', 4, 12, 1, { value: '10k' }], ['GND', 4, 14, 0, {}],
      ['C', 0, 10, 1, { value: '10n' }], ['POT', 0, 14, 1, { value: '250k', taper: 'log', pos: 0.5, label: 'MID' }], ['GND', 0, 16, 0, {}]],
    wires: [[[0, 0], [2, 0]], [[6, 0], [7, 0]], [[0, 4], [0, 8]], [[4, 6], [11, 6], [11, 4]], [[2, 8], [2, 10], [4, 10]], [[4, 10], [7, 10]],
      [[-2, 14], [-2, 16], [0, 16]], [[13, 2], [15, 2]]],
  },
  'Distortion: Tube Screamer stage (soft clipping)': {
    active: true, gain: [2, 40], vref: [[-4, -5]], io: [[-7, 0], [14, 1]],
    comps: [['OPA', 3, 1, 0, { model: 'NE5532', flip: true }], ['R', -4, -3, 1, { value: '510k' }],
      ['R', 2, 5, 0, { value: '51k' }], ['POT', 6, 5, 0, { value: '500k', taper: 'log', pos: 0.5, label: 'DRIVE' }],
      ['D', 4, 9, 0, { model: '1N4148' }], ['D', 4, 11, 2, { model: '1N4148' }], ['C', 4, 14, 0, { value: '51p' }],
      ['R', -2, 4, 1, { value: '4.7k' }], ['C', -2, 8, 1, { value: '47n' }], ['GND', -2, 10, 0, {}], ['C', 12, 1, 0, { value: '10u' }]],
    wires: [[[-7, 0], [0, 0]], [[-4, -1], [-4, 0]], [[0, 2], [0, 14], [2, 14]], [[0, 9], [2, 9]], [[0, 11], [2, 11]], [[-2, 2], [0, 2]],
      [[6, 7], [8, 7], [8, 5], [9, 5]], [[6, 1], [10, 1]], [[9, 1], [9, 14], [6, 14]], [[6, 9], [9, 9]], [[6, 11], [9, 11]]],
  },
  'Distortion: Distortion+ / DOD 250 stage (hard clipping)': {
    active: true, gain: [0.5, 12], vref: [[-1, -5]], io: [[-11, 0], [25, 1]],
    comps: [['C', -9, 0, 0, { value: '10n' }], ['R', -4, 0, 0, { value: '10k' }], ['OPA', 3, 1, 0, { model: 'LM741', flip: true }], ['R', -1, -3, 1, { value: '1M' }],
      ['R', 3, 5, 0, { value: '1M' }], ['R', -2, 4, 1, { value: '4.7k' }], ['C', -2, 8, 1, { value: '47n' }],
      ['POT', -2, 12, 3, { value: '500k', taper: 'rev', pos: 0.7, label: 'DIST' }], ['GND', 0, 14, 0, {}],
      ['C', 11, 1, 0, { value: '1u' }], ['R', 16, 1, 0, { value: '10k' }],
      ['D', 19, 3, 1, { model: '1N34A (Ge)' }], ['D', 21, 3, 3, { model: '1N34A (Ge)' }], ['C', 23, 3, 1, { value: '1n' }], ['GND', 21, 5, 0, {}]],
    wires: [[[-7, 0], [-6, 0]], [[-2, 0], [0, 0]], [[-1, -1], [-1, 0]], [[0, 2], [0, 5], [1, 5]], [[5, 5], [8, 5], [8, 1]], [[6, 1], [9, 1]], [[-2, 2], [0, 2]],
      [[0, 12], [0, 14], [-2, 14]], [[13, 1], [14, 1]], [[18, 1], [25, 1]], [[19, 5], [23, 5]]],
  },
  'Distortion: RAT stage (hard clipping)': {
    active: true, gain: [2, 20], vref: [[-7, -4]], io: [[-11, 0], [23, 1]],
    comps: [['C', -9, 0, 0, { value: '22n' }], ['R', -4, 0, 0, { value: '1k' }], ['R', -7, -2, 1, { value: '1M' }], ['OPA', 3, 1, 0, { model: 'TL081', flip: true }],
      ['POT', 3, 5, 0, { value: '100k', taper: 'log', pos: 0.5, label: 'DISTORTION' }], ['C', 3, 9, 0, { value: '100p' }],
      ['R', 0, 13, 1, { value: '47' }], ['C', 0, 17, 1, { value: '2.2u' }], ['GND', 0, 19, 0, {}],
      ['R', -3, 13, 1, { value: '560' }], ['C', -3, 17, 1, { value: '4.7u' }], ['GND', -3, 19, 0, {}],
      ['C', 11, 1, 0, { value: '4.7u' }], ['R', 16, 1, 0, { value: '1k' }],
      ['D', 19, 3, 1, { model: '1N4148' }], ['D', 21, 3, 3, { model: '1N4148' }], ['GND', 20, 5, 0, {}]],
    wires: [[[-7, 0], [-6, 0]], [[-2, 0], [0, 0]], [[0, 2], [0, 11]], [[0, 5], [1, 5]], [[0, 9], [1, 9]], [[3, 7], [5, 7], [5, 5]], [[5, 5], [8, 5], [8, 1]],
      [[5, 9], [8, 9], [8, 5]], [[6, 1], [9, 1]], [[-3, 11], [0, 11]], [[13, 1], [14, 1]], [[18, 1], [23, 1]], [[19, 5], [21, 5]]],
  },
  'Distortion: Big Muff stage (Sovtek values)': {
    gain: [2, 60], io: [[0, 0], [24, -2]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['R', 6, 0, 0, { value: '10k' }], ['NPN', 13, 0, 0, { model: '2N3904' }],
      ['R', 9, 2, 1, { value: '100k' }], ['GND', 9, 4, 0, {}], ['R', 14, 4, 1, { value: '390' }], ['GND', 14, 6, 0, {}],
      ['R', 14, -4, 1, { value: '12k' }], ['V', 14, -6, 0, { value: '9' }],
      ['R', 13, -9, 0, { value: '470k' }], ['C', 13, -11, 0, { value: '500p' }], ['C', 12, -13, 0, { value: '47n' }],
      ['D', 16, -13, 0, { model: '1N4148' }], ['D', 16, -15, 2, { model: '1N4148' }], ['C', 22, -2, 0, { value: '100n' }]],
    wires: [[[8, 0], [11, 0]], [[10, 0], [10, -13]], [[10, -9], [11, -9]], [[10, -11], [11, -11]], [[14, -2], [19, -2], [19, -15]], [[19, -2], [20, -2]],
      [[15, -9], [19, -9]], [[15, -11], [19, -11]], [[18, -13], [19, -13]], [[14, -13], [14, -15]], [[18, -15], [19, -15]]],
  },
  'Distortion: Bazz Fuss (one transistor, one diode)': {
    gain: [0.5, 60], io: [[0, 0], [16, -2]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['NPN', 8, 0, 0, { model: '2N3904' }], ['GND', 9, 2, 0, {}],
      ['D', 7, -4, 2, { model: '1N4148' }], ['R', 12, -4, 1, { value: '10k' }], ['V', 12, -6, 0, { value: '9' }], ['C', 14, -2, 0, { value: '100n' }]],
    wires: [[[4, 0], [6, 0]], [[9, -2], [12, -2]], [[9, -2], [9, -4]], [[5, -4], [5, 0]]],
  },
  'Distortion: Fuzz Face (two-transistor feedback fuzz)': {      // negative-ground NPN version of the ElectroSmash schematic; the germanium original has 470 ohm for the 330
    gain: [0.2, 60], io: [[1, 0], [29, -6]],
    comps: [['C', 3, 0, 0, { value: '2.2u' }], ['NPN', 10, 0, 0, { model: 'BC108' }], ['GND', 11, 2, 0, {}], ['R', 11, -5, 1, { value: '33k' }],
      ['NPN', 16, -2, 0, { model: 'BC108' }], ['R', 17, -6, 1, { value: '8.2k' }], ['R', 17, -10, 1, { value: '330' }], ['V', 14, -12, 0, { value: '9' }],
      ['C', 21, -8, 0, { value: '10n' }], ['POT', 25, -6, 3, { value: '500k', taper: 'log', pos: 0.5, label: 'VOLUME' }], ['GND', 25, -4, 0, {}],
      ['POT', 17, 2, 3, { value: '1k', taper: 'lin', pos: 0.9, label: 'FUZZ' }], ['GND', 17, 4, 0, {}], ['C', 21, 2, 0, { value: '22u' }], ['GND', 23, 2, 0, {}],
      ['R', 10, 5, 0, { value: '100k' }]],
    wires: [[[5, 0], [8, 0]], [[11, -3], [11, -2]], [[11, -2], [14, -2]], [[11, -7], [11, -12], [17, -12]], [[17, -8], [19, -8]], [[23, -8], [25, -8]], [[27, -6], [29, -6]],
      [[7, 0], [7, 5], [8, 5]], [[12, 5], [15, 5], [15, 0], [17, 0]]],
  },
  'Distortion: Fuzz Factory pair (germanium PNP, negative ground)': {   // the ZVEX Fuzz Factory example minus its 2N3904 input stage; lugs and knob directions as in that example
    gain: [0.2, 60], io: [[0, 0], [25, 10]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['PNP', 8, 0, 0, { model: 'AC128 (Ge)', flip: true }], ['PNP', 16, 2, 0, { model: 'AC128 (Ge)', flip: true }],
      ['V', 2, -10, 0, { value: '9' }], ['POT', 4, -8, 0, { value: '5k', taper: 'lin', pos: 1, label: 'STAB' }],
      ['R', 13, -4, 0, { value: '47k' }], ['R', 9, 4, 1, { value: '470' }], ['POT', 9, 8, 3, { value: '10k', taper: 'lin', pos: 0, label: 'GATE' }], ['GND', 9, 10, 0, {}],
      ['POT', 20, -4, 3, { value: '10k', taper: 'lin', pos: 0.8, label: 'COMP' }], ['POT', 26, -4, 1, { value: '10k', taper: 'lin', pos: 1, label: 'DRIVE' }], ['C', 24, -6, 1, { value: '10u' }],
      ['R', 17, 6, 1, { value: '5.1k' }], ['POT', 17, 10, 3, { value: '5k', taper: 'lin', pos: 0.5, label: 'VOLUME' }], ['GND', 17, 12, 0, {}], ['C', 21, 10, 0, { value: '10u' }]],
    wires: [[[4, 0], [6, 0]], [[4, -6], [2, -6], [2, -10]], [[6, -8], [26, -8]], [[9, -2], [9, -8]], [[20, -6], [20, -8]], [[26, -6], [26, -8]],
      [[6, 0], [6, -4], [11, -4]], [[15, -4], [15, 0], [26, 0], [26, -2]], [[22, -4], [22, -2], [20, -2], [20, 0]],
      [[9, 2], [14, 2]], [[11, 8], [11, 10], [9, 10]], [[23, 10], [25, 10]]],
  },
  'Distortion: octave-up fuzz (phase splitter + rectifier)': {
    gain: [0.5, 30], io: [[0, 0], [42, 1]],
    comps: [['C', 2, 0, 0, { value: '100n' }], ['NPN', 9, 0, 0, { model: '2N3904' }], ['R', 6, -2, 1, { value: '430k' }], ['R', 6, 2, 1, { value: '43k' }], ['GND', 6, 4, 0, {}],
      ['V', 10, -6, 0, { value: '9' }], ['R', 10, -4, 1, { value: '10k' }], ['R', 10, 4, 1, { value: '390' }], ['GND', 10, 6, 0, {}],
      ['C', 13, -2, 0, { value: '100n' }], ['NPN', 21, -2, 0, { model: '2N3904' }], ['R', 17, -4, 1, { value: '220k' }], ['R', 17, 0, 1, { value: '100k' }], ['GND', 17, 2, 0, {}],
      ['R', 22, -6, 1, { value: '10k' }], ['V', 22, -8, 0, { value: '9' }], ['R', 22, 2, 1, { value: '10k' }], ['GND', 22, 4, 0, {}],
      ['C', 26, -4, 0, { value: '100n' }], ['C', 26, 6, 0, { value: '100n' }],
      ['R', 30, -2, 1, { value: '100k' }], ['GND', 30, 0, 0, {}], ['R', 30, 8, 1, { value: '100k' }], ['GND', 30, 10, 0, {}],
      ['D', 36, -4, 0, { model: '1N5819' }], ['D', 36, 6, 0, { model: '1N5819' }], ['R', 40, 3, 1, { value: '100k' }], ['GND', 40, 5, 0, {}]],
    wires: [[[4, 0], [7, 0]], [[6, -4], [6, -6], [10, -6]], [[10, -2], [11, -2]], [[15, -2], [19, -2]], [[17, -6], [17, -8], [22, -8]],
      [[22, -4], [24, -4]], [[22, 0], [23, 0], [23, 6], [24, 6]], [[28, -4], [34, -4]], [[28, 6], [34, 6]], [[38, -4], [38, 6]], [[38, 1], [42, 1]]],
  },
  'Gain: Rangemaster treble booster (germanium PNP)': {
    gain: [1, 80], io: [[0, 0], [16, 4]],
    comps: [['C', 2, 0, 0, { value: '5n' }], ['PNP', 9, 0, 0, { model: 'OC44 (Ge)', flip: true }],
      ['R', 6, -2, 1, { value: '68k' }], ['R', 6, 2, 1, { value: '470k' }], ['GND', 6, 4, 0, {}],
      ['R', 10, -4, 1, { value: '3.9k' }], ['C', 13, -4, 1, { value: '47u' }], ['V', 10, -6, 0, { value: '9' }],
      ['POT', 10, 4, 3, { value: '10k', taper: 'log', pos: 1, label: 'BOOST' }], ['GND', 10, 6, 0, {}], ['C', 14, 4, 0, { value: '10n' }]],
    wires: [[[4, 0], [7, 0]], [[6, -4], [6, -6], [10, -6]], [[10, -6], [13, -6]], [[10, -2], [13, -2]]],
  },
  'Dynamics: one-transistor optical limiter': {
    gain: [1, 12], io: [[0, 0], [32, 0]],
    comps: [['R', 2, 0, 0, { value: '47k' }], ['LDR', 4, 2, 1, { dark: '1M', lit: '2k', light: 0.5, led: '@' }], ['GND', 4, 4, 0, {}],
      ['C', 6, 0, 0, { value: '100n' }], ['NPN', 13, 0, 0, { model: '2N3904' }],
      ['R', 10, -2, 1, { value: '430k' }], ['R', 10, 2, 1, { value: '43k' }], ['GND', 10, 4, 0, {}],
      ['R', 14, -4, 1, { value: '10k' }], ['V', 14, -6, 0, { value: '9' }], ['R', 14, 4, 1, { value: '390' }], ['GND', 14, 6, 0, {}],
      ['C', 16, 0, 1, { value: '10u' }], ['R', 16, 4, 1, { value: '220' }], ['D', 16, 8, 1, { model: 'LED red' }], ['GND', 16, 10, 0, {}],
      ['D', 19, 4, 3, { model: '1N4148' }], ['GND', 19, 6, 0, {}],
      ['C', 24, -2, 0, { value: '100n' }], ['POT', 28, 0, 3, { value: '250k', taper: 'lin', pos: 0.5, label: 'LEVEL' }], ['GND', 28, 2, 0, {}]],
    wires: [[[8, 0], [11, 0]], [[10, -4], [10, -6], [14, -6]], [[14, -2], [22, -2]], [[16, 2], [19, 2]], [[26, -2], [28, -2]], [[30, 0], [32, 0]]],
  },
  'Dynamics: LED limiter (sustain by soft clipping)': {
    active: true, gain: [3, 45], vref: [[-4, -5]], io: [[-7, 0], [14, 1]],
    comps: [['OPA', 3, 1, 0, { model: 'TL082', flip: true }], ['R', -4, -3, 1, { value: '1M' }], ['R', 3, 5, 0, { value: '220k' }],
      ['D', 3, 7, 0, { model: 'LED red' }], ['D', 3, 9, 2, { model: 'LED red' }],
      ['R', -2, 4, 1, { value: '1k' }], ['POT', -2, 8, 1, { value: '10k', taper: 'lin', pos: 0.5, label: 'SUSTAIN' }], ['C', -2, 12, 1, { value: '10u' }], ['GND', -2, 14, 0, {}],
      ['C', 12, 1, 0, { value: '10u' }]],
    wires: [[[-7, 0], [0, 0]], [[-4, -1], [-4, 0]], [[0, 2], [0, 9], [1, 9]], [[0, 5], [1, 5]], [[0, 7], [1, 7]], [[5, 5], [8, 5]], [[5, 7], [8, 7]],
      [[5, 9], [8, 9], [8, 1]], [[-2, 2], [0, 2]], [[-4, 8], [-4, 6], [-2, 6]], [[6, 1], [10, 1]]],
  },
  'Output: coupling cap + volume': {
    io: [[0, 0], [10, 2]],
    comps: [['C', 2, 0, 0, { value: '1u' }], ['POT', 6, 2, 3, { value: '100k', taper: 'log', pos: 0.8, label: 'VOLUME' }], ['GND', 6, 4, 0, {}]],
    wires: [[[4, 0], [6, 0]], [[8, 2], [10, 2]]],
  },
};
function block(name) {
  const b = BLOCKS[name], out = { io: b.io, vref: b.vref, active: b.active, gain: b.gain, comps: [], wires: [] };
  for (const [type, x, y, rot, props] of b.comps) out.comps.push(Object.assign({ type, x, y, rot, flip: false }, props));
  for (const line of b.wires) for (let i = 1; i < line.length; i++) out.wires.push({ x1: line[i - 1][0], y1: line[i - 1][1], x2: line[i][0], y2: line[i][1] });
  return out;
}

// One core-function tag per block, from the category before the colon. Names stay searchable for everything else.
const CORE = { power: 'power', input: 'utility', output: 'utility', buffer: 'utility', gain: 'gain', clipper: 'distortion', distortion: 'distortion',
  tone: 'tone', 'tone stack': 'tone', eq: 'tone', filter: 'tone', dynamics: 'dynamics', compressor: 'dynamics', lfo: 'modulation', tremolo: 'modulation' };
const tags = name => [CORE[name.split(':')[0].toLowerCase()] || 'other'];

// Expands the compact form into a schematic object.
function load(name) {
  if (PEDALS[name]) return (root.Schem || require('./schem.js')).fromNetlist(Object.assign({ name }, PEDALS[name]), { names: false });
  const p = RAW[name];
  let id = 1;
  const sch = { name, about: p.about, comps: [], wires: [] };
  for (const [type, ref, x, y, rot, props] of p.comps) sch.comps.push(Object.assign({ id: id++, type, ref, x, y, rot, flip: false }, props));
  for (const line of p.wires) for (let i = 1; i < line.length; i++)
    sch.wires.push({ id: id++, x1: line[i - 1][0], y1: line[i - 1][1], x2: line[i][0], y2: line[i][1] });
  return sch;
}

const PEDALS = root.PEDALS || require('./pedals.js');
const Presets = { names: Object.keys(RAW).concat(Object.keys(PEDALS)), load, pedals: PEDALS, blocks: Object.keys(BLOCKS), block, tags };
if (typeof module !== 'undefined' && module.exports) module.exports = Presets; else root.Presets = Presets;
})(typeof window !== 'undefined' ? window : globalThis);
