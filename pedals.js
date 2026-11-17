// Hibiki examples read from published schematics, written as netlists. Schem.fromNetlist draws them as wired
// schematics (signal path left to right). How to add one, step by step: EXAMPLES.md.
// One part per line: <ref> <value or model> <nets...>. The ref prefix gives the type:
//   R, C, L, D, Q (NPN or PNP from the model table), J (N-JFET), U (op-amp: in+ in- out), IN (tip [source resistance]), OUT.
//   VR is a pot: value/taper/LABEL[/pos], nets lug1 wiper lug3 (pos 0 = wiper at lug1). A value of 1u and up is an
//   electrolytic: its first net is the + side. Supplies are nets named like +9V or -9V; GND is ground.
// Bypass switches, LED indicators and polarity-protection diodes are left out.
(function (root) {
'use strict';
const Sim = root.Sim || require('./sim.js');
const ALIAS = { LED_red: 'LED red','1N914': '1N4148', '1N34A': '1N34A (Ge)', AC128: 'AC128 (Ge)', OC44: 'OC44 (Ge)' };

function parse(about, text) {
  const components = [];
  for (const line of text.trim().split('\n')) {
    const [ref, val, ...nets] = line.trim().split(/\s+/);
    if (ref === 'IN') { components.push({ type: 'IN', nets: [val], rs: nets[0] || '0' }); continue; }
    if (ref === 'OUT') { components.push({ type: 'OUT', nets: [val] }); continue; }
    const p = ref.match(/^(VR|R|C|L|D|Q|J|U)/)[1], model = ALIAS[val] || val;
    if (p === 'VR') {
      const [value, taper, label, pos] = val.split('/');
      components.push({ type: 'POT', ref, value, taper, label, pos: pos == null ? 0.5 : +pos, nets });
    } else if (p === 'Q') {
      if (!Sim.BJTS[model]) throw new Error(ref + ': no transistor model ' + model);
      components.push({ type: Sim.BJTS[model].pnp ? 'PNP' : 'NPN', ref, model, nets });
    } else if (p === 'D' || p === 'J' || p === 'U') components.push({ type: { D: 'D', J: 'JFET', U: 'OPA' }[p], ref, model, nets });
    else components.push({ type: p, ref, value: val, nets });
  }
  return { about, components };
}

// [name, about, netlist]. "GGG" = General Guitar Gadgets schematic (generalguitargadgets.com), file named in the about text.
const LIST = [
['EHX LPB-1 booster', 'Electro-Harmonix LPB-1, from the GGG schematic (ggg_cb1_sc). One NPN stage, about 20 dB of clean boost. The original uses a 2N5089; the 2N5088 model stands in.', `
IN in
R6 1.5M in GND
C1 100n in b
R1 430k +9V b
R2 43k b GND
Q1 2N5088 c b e
R3 10k +9V c
R4 390 e GND
C2 100n c v
VR5 100k/log/VOLUME/0.8 GND out v
OUT out`],
['MXR Micro Amp', 'MXR Micro Amp, from the GGG schematic (ggg_mamp_sc). Non-inverting op-amp stage: the LEVEL pot (500k reverse log, as a variable resistor) sets the gain from 1 to about 26 dB. TL061 in the original; TL071 model.', `
IN in
R1 22M in GND
C1 100n in p
R7 100k +9V vb
R8 100k vb GND
C4 1u vb GND
R2 10M vb p
R3 1k p pp
U1 TL071 pp n o
R6 2.7k m g
C3 4.7u m GND
VR5 500k/rev/LEVEL g g n
R4 56k n o
C2 47p n o
C5 15u o x
R9 470 x out
R10 10k out GND
OUT out`],
['Orange treble-bass booster (PNP)', 'Orange Treble-Bass Booster, from the GGG replica schematic (ggg_geb_orange_pnp_sc). Positive ground: one germanium PNP stage, with a TONE pot that blends the input between a 2.2 nF (treble) and a 47 nF (fuller) coupling cap. The original OC76 is modelled with the OC44.', `
IN in
VR10 500k/lin/TONE t in bs
C1 2.2n t b
C7 47n bs GND
R1 470k -9V b
R2 82k b GND
Q1 OC44 c b e
R3 10k -9V c
R4 2k e GND
C4 33u GND e
C2 100n c out
OUT out`],
['Alembic Stratoblaster', 'Alembic Stratoblaster (original), from the GGG schematic (ggg_sbb_sc). One JFET stage; BOOST is a 50k variable resistor that bypasses the source resistor. The gate has no bias resistor, so it relies on the guitar (here the ideal input) for its DC path.', `
IN in
R1 68k in g
J1 2N5457 d g s
R2 22k +9V d
R3 12k s GND
VR4 50k/lin/BOOST s bc bc
C1 10u bc GND
C2 1.5u d out
R5 100k out GND
OUT out`],
['Ibanez TS-808 Tube Screamer', 'Ibanez TS-808, from the GGG ITS8 replica schematic (ggg_its8_sc). Emitter-follower input buffer, op-amp gain stage with two 1N914s in the feedback loop (soft clipping, gain 1 + (51k + DRIVE) / 4.7k), the TS tone stage (TONE pot between the + and - sides of the second op-amp) and an emitter-follower output. The 2N4401 buffers are modelled with the 2N3904.', `
IN in
R9 10k +9V vr
R10 10k vr GND
C7 47u vr GND
R22 1.5M in GND
C1 22n in a
R1 1k a b
R2 510k vr b
Q1 2N3904 +9V b e1
R3 10k e1 GND
C2 1u p e1
R5 10k p vr
U1 RC4558 p n o1
R6 4.7k vr x
C3 47n x n
R7 51k n dr
VR19 500k/log/DRIVE/0.5 dr o1 o1
D1 1N914 n o1
D2 1N914 o1 n
C4 51p n o1
R8 1k o1 t
C5 220n t GND
R16 10k t vr
U2 RC4558 t m o2
VR20 20k/lin/TONE/0.5 t w m
C9 220n w w2
R11 220 w2 GND
R17 1k m o2
C8 1u o2 v1
R18 1k v1 vt
VR21 100k/log/VOLUME/0.7 vr vw vt
C10 100n vw b2
R12 510k b2 vr
Q2 2N3904 +9V b2 e2
R14 10k e2 GND
R15 100 e2 x2
C11 10u x2 out
R13 10k out GND
OUT out`],
['Boss OD-1 OverDrive (ITS8 version)', 'Boss OD-1 values on the ITS8 board, from the GGG schematic (ggg_its8_od1_sc). Like the Tube Screamer but with asymmetric clipping (two 1N914s in series one way, one the other) and no tone control: the second op-amp is an inverting low-pass (10k / 10k with 18 nF, about 880 Hz).', `
IN in
R9 33k +9V vr
R10 33k vr GND
C7 47u vr GND
R22 1.5M in GND
C1 47n in a
R1 1k a b
R2 470k vr b
Q1 2N3904 +9V b e1
R3 10k e1 GND
C2 4.7n e1 p
R5 100k p vr
U1 RC4558 p n o1
R6 4.7k vr x
C3 47n x n
R7 33k n dr
VR19 1M/log/DRIVE/0.5 dr o1 o1
D2 1N914 o1 dd
D3 1N914 dd n
D1 1N914 n o1
R8 10k o1 m
R24 10k pp vr
U2 RC4558 pp m o2
R17 10k m o2
C13 18n m o2
C8 1u o2 v1
R18 4.7k v1 vt
VR21 10k/lin/VOLUME/0.7 vr vw vt
C10 47n vw b2
R12 1M b2 vr
Q2 2N3904 +9V b2 e2
R14 10k e2 GND
R15 1k e2 x2
C11 1u x2 out
R13 100k out GND
OUT out`],
['Boss SD-1 Super OverDrive (ITS8 version)', 'Boss SD-1 values on the ITS8 board, from the GGG schematic (ggg_its8_sd1_sc). Tube Screamer layout with asymmetric clipping (2 + 1 diodes), 18 nF coupling into the op-amp (less bass into the clipping) and a tone stage with 10k / 10 nF feedback.', `
IN in
R9 33k +9V vr
R10 33k vr GND
C7 47u vr GND
R22 1.5M in GND
C1 47n in a
R1 10k a b
R2 470k vr b
Q1 2N3904 +9V b e1
R3 10k e1 GND
C2 18n e1 p
R5 100k p vr
U1 RC4558 p n o1
R6 4.7k vr x
C3 47n x n
R7 33k n dr
VR19 1M/log/DRIVE/0.5 dr o1 o1
D2 1N914 o1 dd
D3 1N914 dd n
D1 1N914 n o1
R8 10k o1 t
C5 18n t vr
U2 RC4558 t m o2
VR20 20k/lin/TONE/0.5 t w m
C9 27n w w2
R11 470 w2 GND
R17 10k m o2
C13 10n m o2
C8 1u o2 v1
R18 4.7k v1 vt
VR21 10k/lin/VOLUME/0.7 vr vw vt
C10 47n vw b2
R12 1M b2 vr
Q2 2N3904 +9V b2 e2
R14 10k e2 GND
R15 1k e2 x2
C11 1u x2 out
R13 100k out GND
OUT out`],
['DOD 250 Overdrive', 'DOD 250 OverDrive, from the GGG schematic (ggg_dist_250_sc). Op-amp gain stage (GAIN: 500k reverse-log variable resistor to ground) into two 1N4148s to ground: hard clipping. LM741.', `
IN in
R1 1.5M in GND
R2 22k +9V vb
R3 22k vb GND
C1 10u vb GND
R4 470k vb p
C2 10n in a
R5 10k a p
U1 LM741 p n o
C4 47n n x
R6 4.7k x y
VR7 500k/rev/GAIN GND GND y
C5 25p n o
R8 1M n o
C6 4.7u o d
R9 10k d e
D1 1N4148 e GND
D2 1N4148 GND e
C7 1n e GND
VR10 100k/log/LEVEL/0.7 GND out e
OUT out`],
['MXR Distortion+', 'MXR Distortion+, from the GGG schematic (ggg_dist_plus_sc). Same layout as the DOD 250 with 1M bias resistors, a 1 nF input filter and a 50k level pot. GGG draws 1N4148 clipping diodes; the original used germanium ones (set the model to 1N34A to hear that).', `
IN in
R1 1.5M in GND
C3 1n in GND
R2 1M +9V vb
R3 1M vb GND
C1 1u vb GND
R4 1M vb p
C2 10n in a
R5 10k a p
U1 LM741 p n o
C4 47n n x
R6 4.7k x y
VR7 500k/rev/GAIN GND GND y
C5 10p n o
R8 1M n o
C6 1u o d
R9 10k d e
D1 1N4148 e GND
D2 1N4148 GND e
C7 1n e GND
VR10 50k/log/LEVEL/0.7 GND out e
OUT out`],
['Ross Distortion', 'Ross Distortion, from the GGG schematic (ggg_dist_ross_sc). The Distortion+ circuit with 1N34A germanium clipping diodes and no feedback capacitor (originally a TL072).', `
IN in
R1 1.5M in GND
C3 1n in GND
R2 1M +9V vb
R3 1M vb GND
C1 1u vb GND
R4 1M vb p
C2 10n in a
R5 10k a p
U1 LM741 p n o
C4 47n n x
R6 4.7k x y
VR7 500k/rev/GAIN GND GND y
R8 1M n o
C6 1u o d
R9 10k d e
D1 1N34A e GND
D2 1N34A GND e
C7 1n e GND
VR10 50k/log/LEVEL/0.7 GND out e
OUT out`],
['ProCo RAT (GGG Rodent)', 'ProCo RAT, from the GGG Rodent replica schematic (ggg_rodent_sc). LM308 gain stage with two RC legs to ground (560 ohm + 4.7 uF, 47 ohm + 2.2 uF), 1N914s to ground, the FILTER treble cut and a JFET output buffer (2N5458, modelled with the 2N5457). The simulated op-amp has no slew-rate limit, so the LM308 character is not reproduced.', `
IN in
R17 1M in GND
R15 10k +9V vb
R16 10k vb GND
C12 47u vb GND
C1 22n in a
R1 1M vb a
R2 1k a p
C2 1n p GND
U1 LM308 p n o
VR3 100k/log/DISTORTION/0.5 n o o
C3 100p n o
R4 560 n x
C5 4.7u x GND
R5 47 n y
C6 2.2u y GND
R6 1k o z
C7 4.7u z d
D1 1N914 d GND
D2 1N914 GND d
VR7 100k/log/FILTER/0.3 d f f
R8 1.5k f h
C8 3.3n h GND
R13 22k +9V jb
R12 10k jb GND
C14 47u jb GND
C9 22n h g
R9 1M g jb
J1 2N5457 +9V g s
R10 10k s GND
C10 1u s v
VR21 100k/log/VOLUME/0.7 GND out v
OUT out`],
['Ibanez SD-9 Sonic Distortion', 'Ibanez SD-9, from the GGG ISD9 replica schematic (ggg_isd9_sc). Emitter-follower buffer, op-amp gain stage (DRIVE in the feedback leg), 1N914s to ground after a 2.2k resistor, a two-way tone network and VOLUME. 2N4401 modelled with the 2N3904.', `
IN in
R1 10k +9V vb
R2 10k vb GND
C1 47u vb GND
R19 1.5M in GND
R3 1k in a
C2 47n a b
R4 511k vb b
Q1 2N3904 +9V b e
R6 10k e GND
C4 47n e p
R8 100k p vb
U1 RC4558 p n o
R5 470 vb x
C3 220n x n
C5 220p n o
R7 33k n r
VR9 250k/lin/DRIVE/0.5 r o o
C6 470n o t
R10 2.2k t m
D1 1N914 m GND
D2 1N914 GND m
C7 10n m GND
R11 2.2k m k
C9 27n k j
R12 6.8k j GND
R13 6.8k m q
C8 100n q GND
VR14 20k/lin/TONE/0.5 q tw j
VR15 100k/lin/VOLUME/0.7 r16 vw tw
R16 1k r16 GND
R17 10k vw y
C10 100n y out
R18 1.5M out GND
OUT out`],
['Red Fuzz Distortion', 'Red Fuzz Distortion, a GGG design (ggg_dist_redfuzz_sc). Op-amp gain stage with two red LEDs in the feedback loop (INTENSITY sets the gain), a simple TONE low-pass and a J201 source-follower output. LF351 modelled with the TL071.', `
IN in
R1 1M in GND
C3 1n in GND
C2 47n in p
R2 470k +9V p
R3 470k p GND
U1 TL071 p n o
R8 10k n r
VR9 1M/log/INTENSITY/0.5 r o o
D1 LED_red n o
D2 LED_red o n
R4 1.8k n x
C4 220n x GND
C6 100n o t
VR12 100k/lin/TONE/0.5 t t u
R15 2.2k u v
C7 3.3n v GND
C9 100n v g
R14 1M g GND
J1 J201 +9V g s
R13 10k s GND
C10 10u s w
VR10 100k/log/VOLUME/0.7 GND out w
OUT out`],
['EHX Muff Fuzz (transistor)', 'Electro-Harmonix Muff Fuzz, transistor version, from the GGG schematic (ggg_muff_tr_sc). Two direct-coupled 2N5088s with DC feedback from the emitter of Q2, then two 1N914s to ground.', `
IN in
C1 100n in b1
Q1 2N5088 c1 b1 GND
R1 100k +9V c1
R3 100k b1 GND
R4 100k b1 e2
Q2 2N5088 c2 c1 e2
R2 10k +9V c2
R5 2.7k e2 GND
C2 100n c2 d
D1 1N914 d GND
D2 1N914 GND d
VR6 100k/log/VOLUME/0.7 GND out d
OUT out`],
['Dallas Arbiter Fuzz Face (germanium)', 'Fuzz Face, germanium version, from the GGG schematic (ggg_ff5_sc_pnp). Positive ground: the supply is -9 V. Two PNP germanium transistors (AC128 model) in the feedback pair; FUZZ bypasses the emitter resistance. Input models a pickup (7k), which this circuit depends on. Germanium gain and leakage vary a lot: set hFE on Q1 and Q2 to your parts.', `
IN in 7k
C1 2.2u in b1
Q1 AC128 c1 b1 GND
R2 33k -9V c1
Q2 AC128 c2 c1 e2
R4 470 -9V k
R5 8.2k k c2
R3 100k b1 e2
VR6 1k/lin/FUZZ/0.9 GND w e2
C2 22u GND w
C3 10n k v
VR10 500k/log/VOLUME/0.7 GND out v
OUT out`],
['Fulltone \'69 (Fuzz Face, germanium)', 'Boutique late-60s Fuzz Face (Fulltone \'69 style), from the GGG schematic (ggg_ff5_sc_b69). The germanium Fuzz Face plus a BIAS pot in series with the input (it acts like rolling back the guitar volume), a CONTOUR pot in the supply to Q2 and a 10k trimmer for Q2\'s collector voltage. Positive ground, -9 V supply, AC128 models.', `
IN in 7k
VR7 50k/lin/BIAS/0.3 ci in in
C1 2.2u ci b1
Q1 AC128 c1 b1 GND
R2 33k -9V c1
Q2 AC128 c2 c1 e2
VR8 1k/lin/CONTOUR/0.5 -9V -9V x
R4 220 x k
R5 1k k t
VR5T 10k/lin/TRIM/0.5 t c2 c2
R3 100k b1 e2
VR6 1k/lin/FUZZ/0.9 GND w e2
C2 22u GND w
C3 100n k v
VR10 500k/log/VOLUME/0.7 GND out v
OUT out`],
['ZVEX Fuzz Factory', 'ZVEX Fuzz Factory (1995), from two traces that agree: M. Chittum\'s rev 1.1 (solgrind.wordpress.com, 2008) and the PCBWay "ZVEX - Fuzz Factory" project schematic (pot lugs numbered); the knob directions match the ZVEX manual. A 2N3904 gain stage drives a Fuzz Face pair of germanium PNPs mounted the other way up (emitters to the + rail, collectors loaded to ground), so it runs from a normal negative-ground 9 V. Every bias point is a knob: STAB is a series resistance in the supply (starves it), GATE the collector load of Q2, COMP the DC emitter resistance of Q3 (fully up shorts it and pinches the tone; DRIVE then does nothing), DRIVE how much of Q3\'s emitter the 10 uF bypasses. R1 (1M input pulldown) is not on the PedalPCB Fuzz Foundry drawing of the same circuit, which was used as a cross-check; it has no effect on the sound. Knobs at ZVEX\'s "smooth fuzz" setting. The real pedal squeals at many settings; this simulation starts at the DC point with no noise, so feedback oscillation may not start on its own. Builders aim for hFE 70 to 100 on Q2 and 100 to 150 on Q3; the AC128 model has 90.', `
IN in
R1 1M in GND
C1 10u b1 in
Q1 2N3904 c1 b1 GND
R2 220k c1 b1
R3 10k v c1
VR1 5k/lin/STAB/1 +9V +9V v
C2 100n c1 b2
R4 47k b2 e3
Q2 AC128 c2 b2 v
R5 470 c2 g
VR2 10k/lin/GATE/0 GND GND g
Q3 AC128 c3 c2 e3
VR3 10k/lin/COMP/0.8 e3 e3 v
VR4 10k/lin/DRIVE/1 v dw e3
C3 10u v dw
R6 5.1k c3 vt
VR5 5k/lin/VOLUME/0.3 GND vo vt
C4 10u vo out
R7 220k out GND
OUT out`],
['ColorSound Tone Bender Mark II Professional', 'Tone Bender Mk II Professional, germanium PNP version, from the GGG replica schematic (ggg_tb_m2p_sc_pg). Positive ground (-9 V supply): a single germanium stage in front of a Fuzz Face pair. ATTACK (1k reverse log with 4.7 uF) sets the gain of the pair. The OC81D transistors are modelled with the AC128.', `
IN in 7k
R9 1.5M in GND
C6 10n in GND
C1 4.7u in b1
R1 100k b1 GND
Q1 AC128 c1 b1 GND
R2 10k -9V c1
C2 100n c1 b2
Q2 AC128 c2 b2 GND
R3 47k -9V c2
Q3 AC128 c3 c2 e3
R5 1k -9V k
R6 8.2k k c3
R4 100k b2 e3
VR7 1k/rev/ATTACK/0.8 GND w e3
C4 4.7u GND w
C3 10n k v
VR8 100k/log/VOLUME/0.7 GND out v
OUT out`],
['Jordan Bosstone', 'Jordan Bosstone, from the GGG schematic (ggg_jbt_sc). An NPN gain stage drives a PNP whose emitter shares an 18k supply resistor with the whole circuit; the output is taken from that supply node, then clipped by two 1N914s. ATTACK is the input level pot.', `
IN in
VR1 100k/log/ATTACK/0.8 GND w in
C1 22n w b
R6 18k +9V v
R4 560k v m
R3 560k m b
C2 22n m GND
R2 150k b GND
Q1 2N2222 c1 b GND
R5 18k v c1
C3 51p v c1
Q2 2N3906 GND c1 v
C4 22n v d
D1 1N914 d GND
D2 1N914 GND d
VR7 100k/log/VOLUME/0.7 GND out d
OUT out`],
['Dan Armstrong Green Ringer', 'Dan Armstrong Green Ringer, from the GGG schematic (ggg_gro_sc). A gain stage drives a phase splitter (2N3906); two diodes biased at half supply pass whichever phase is higher to an emitter follower: a full-wave rectifier, so the octave up comes with ring-modulator-like overtones. Set the guitar volume and play above the 12th fret for the clearest octave.', `
IN in
R13 1.5M in GND
C1 47n in b1
R1 560k +9V b1
R2 160k b1 GND
Q1 2N5088 c1 b1 e1
R3 18k +9V c1
R4 6.2k e1 GND
Q2 2N3906 qc c1 qe
R5 10k +9V qe
R6 10k qc GND
C2 47n qe a1
C3 47n qc a2
R9 22k +9V m
R10 22k m GND
R7 68k a1 m
R8 68k a2 m
D1 1N4148 a1 b3
D2 1N4148 a2 b3
Q3 2N5088 +9V b3 e3
R11 10k e3 GND
C5 100n e3 out
R12 47k out GND
OUT out`],
['fOXX Tone Machine (octave on)', 'fOXX Tone Machine fuzz / octave, from the GGG schematic (ggg_ftm_sc), with the OCTAVE switch on. A phase splitter feeds two germanium diodes (full-wave rectifier, the octave), SUSTAIN sets the level into a gain stage that clips into two more germanium diodes, then a TONE blend between a 3.3 nF high-pass and a 22k / 47 nF low-pass, and a recovery stage. Transistors 2N3565 in the original; 2N3904 models.', `
IN in
R1 1.5M in GND
C1 100n in b1
Q1 2N3904 c1 b1 e1
R2 47k +9V c1
R3 1k e1 GND
R4 47k b1 f
C3 100n f GND
R5 100k f GND
R6 100k f e2
C2 1n b1 e2
Q2 2N3904 c2 c1 e2
R7 4.7k +9V c2
R8 4.7k e2 GND
C4 10u c2 a
R10 100k a GND
C5 10u e2 bb
R9 100k bb GND
D2 1N34A k a
D1 1N34A k bb
R13 100k +9V k
C6 10u k s1
VR11 50k/lin/SUSTAIN/0.7 s2 sw s1
R12 220 s2 GND
C7 10u b3 sw
R14 150k +9V b3
R15 15k b3 GND
Q3 2N3904 c3 b3 e3
R16 10k +9V c3
R17 1k e3 GND
C9 10u e3 GND
C8 10u c3 t
D3 1N34A t GND
D4 1N34A GND t
C10 3.3n t th
R18 22k t u
C11 47n u GND
R19 4.7k u tl
VR20 50k/lin/TONE/0.5 tl tw th
C12 10u b4 tw
R21 470k +9V b4
R22 47k b4 GND
Q4 2N3904 c4 b4 e4
R23 10k +9V c4
R24 1.5k e4 GND
C13 10u c4 v
VR25 50k/lin/VOLUME/0.7 GND out v
OUT out`],
['ColorSound Tone Bender (3-knob)', 'ColorSound Tone Bender 3-knob (Mk III), from the GGG replica schematic (ggg_tb3ss_sc). Positive ground, -9 V supply, germanium PNPs (AC128 model). A compound pair (Q1 drives Q2, both collectors joined) feeds FUZZ, a series 100k pot, into a third stage whose base is biased only by the leakage of a germanium diode (1N270, modelled with the 1N34A), then a TONE blend of a 100 nF and a 2.2 nF path.', `
IN in
R1 1.5M in GND
C1 100n in b1
R3 220k -9V b1
R2 47k b1 GND
C2 220p b1 c1
Q1 AC128 c1 b1 e1
R4 10k -9V c1
R5 10k e1 GND
Q2 AC128 c1 e1 e2
R6 3.3k e2 GND
C5 10u GND e2
C4 220n c1 f
VR7 100k/lin/FUZZ/0.5 f d d
D1 1N34A d GND
Q3 AC128 c3 d GND
R8 18k c3 t
R9 10k -9V t
R10 10k t GND
C6 100n t th
C7 2.2n c3 tl
R12 10k tl GND
VR11 100k/lin/TONE/0.5 tl tw th
R16 220k tw vt
VR13 100k/lin/VOLUME/0.7 GND out vt
OUT out`],
['ColorSound Supa Tone Bender', 'ColorSound Supa Tone Bender, from the GGG replica schematic (ggg_tb_supa_sc). Big Muff relative: a gain stage, a GAIN pot, a clean second stage, a third stage with germanium diodes in its feedback loop, germanium diodes to ground, the Muff-style TONE blend and a recovery stage. BC546 transistors, modelled with the BC547.', `
IN in
R26 1.5M in GND
C1 100n in a
R1 33k a b1
R2 100k b1 GND
R3 470k b1 c1
C2 560p b1 c1
Q1 BC547 c1 b1 e1
R5 15k +9V c1
R4 100 e1 GND
C3 100n c1 g
VR6 10k/log/GAIN/0.7 r7 w g
R7 1k r7 GND
C4 100n w x
R8 8.2k x b2
R9 100k b2 GND
R10 470k b2 c2
C5 560p b2 c2
Q2 BC547 c2 b2 e2
R11 10k +9V c2
R12 100 e2 GND
C7 100n c2 y
R13 8.2k y b3
R14 100k b3 GND
R15 470k b3 c3
C8 560p b3 c3
C9 100n b3 z
D1 1N34A z c3
D2 1N34A c3 z
Q3 BC547 c3 b3 e3
R17 15k +9V c3
R16 100 e3 GND
C16 100n c3 t
D3 1N34A t GND
D4 1N34A GND t
C10 4.7n t th
R18 33k th GND
R19 33k t tl
C11 10n tl GND
VR20 100k/lin/TONE/0.5 th tw tl
C12 100n tw b4
R22 470k +9V b4
R21 100k b4 GND
Q4 BC547 c4 b4 e4
R24 10k +9V c4
R23 2.7k e4 GND
C13 100n c4 v
C17 10u c4 v
VR25 10k/log/VOLUME/0.7 GND out v
OUT out`],
['Marshall Bluesbreaker pedal', 'Marshall Bluesbreaker (original black-box version), from the GGG modernized replica schematic (ggg_mbb_sc). A non-inverting stage with GAIN in its feedback, then an inverting stage with two pairs of 1N4148s (two in series each way) in its feedback, a TONE network and VOLUME, all referenced to the half-supply.', `
IN in
R14 47k +9V vb
R5 47k vb GND
C11 100u vb GND
R1 1.5M in GND
C1 10n in p1
R4 1M p1 vb
U1 TL072 p1 n1 o1
R3 3.3k n1 x
C2 10n x y
R2 4.7k n1 y
C3 10n y GND
C4 47p n1 o1
VR15 100k/lin/GAIN/0.5 n1 o1 g3
C6 100n g3 c6
R8 10k c6 n2
U2 TL072 vb n2 o2
R10 220k n2 o2
R11 6.8k n2 d1
D2 1N4148 d1 dm
D4 1N4148 dm o2
D5 1N4148 o2 dn
D3 1N4148 dn d1
R9 1k o2 t1
VR16 25k/lin/TONE/0.5 t1 tw tb
C8 10n tb vb
R12 6.8k tw vt
C9 10n vt vb
VR17 100k/log/VOLUME/0.7 vb vw vt
C10 100n vw out
R13 1.5M out GND
OUT out`],
['Marshall Guv\'nor', 'Marshall Guv\'nor (original), from the GGG schematic (ggg_mgv_sc_guv). Non-inverting stage with GAIN, an inverting stage (gain about 68), a 1k resistor into two LEDs to ground, then a passive three-band stack (BASS, MID, TREBLE) and LEVEL. The tone stack is read from a small drawing; check it against the PDF before building. The effects loop is left out.', `
IN in
R4 47k +9V vb
R5 47k vb GND
C7 10u vb GND
R16 2.2M in GND
C5 10n in p1
R3 1M p1 vb
U1 TL072 p1 n1 o1
C1 100n GND r1
R1 2.2k r1 n1
VR1 100k/lin/GAIN/0.5 n1 o1 g3
C2 100p n1 o1
C3 220n g3 x
R2 10k x m
C4 100n m n2
U2 TL072 vb n2 o2
R6 680k n2 o2
C8 220p n2 o2
C9 220n o2 y
R7 1k y d
D1 LED_red d GND
D2 LED_red GND d
C13 4.7n d tt
C12 10n tt r11
R11 100 r11 mt
VR3 10k/log/MID/0.5 GND mw mt
R9 1.5k d e
C11 220n e mw
C10 100n e f
R8 680 f GND
R10 680 e h
VR2 10k/log/BASS/0.5 GND f h
C6 68n h GND
VR4 10k/lin/TREBLE/0.5 h tw tt
VR5 100k/lin/LEVEL/0.7 GND lw tw
R12 22k lw out
C14 470p out GND
OUT out`],
['Vox V847 wah (pedal at mid travel)', 'Vox V847 wah, from the GGG modernized schematic (ggg_wah_vox847_sc). Q1 and Q2 with the 500 mH inductor form a resonant band-pass; the PEDAL pot (100k) sets the peak frequency: about 2.3 kHz at 0 (toe down) to about 440 Hz at 1 (heel down), simulated. The inductor value is the standard 500 mH (not printed on the schematic). MPSA18 transistors, modelled with the 2N5088.', `
IN in
R1 68k in a
C1 10n a b1
R2 1.5k b1 m
Q1 2N5088 c1 b1 e1
R3 22k +9V c1
R4 510 e1 GND
R6 470k c1 k
R5 470k c1 b2
L1 500m k m
R7 33k k m
C3 4.7u k GND
R8 100k k GND
Q2 2N5088 c2 b2 e2
R9 1k +9V c2
R10 10k e2 GND
C2 10n e2 m
C5 220n c1 out
VR11 100k/log/PEDAL/0.5 GND w out
C4 220n w b2
OUT out`],
['Shin-ei Companion Fuzz FY-2', 'Shin-ei Companion Fuzz FY-2, from the GGG schematic (ggg_secf_sc, version 2012January23). Two NPN collector-feedback stages in series (Q1 with R1 2.2M and C2 1 nF, Q2 with R3 1.2M), then the 50k FUZZ pot, wired as drawn: Q2 (through C5, 3.3 nF) feeds its lower lug, Q1 (through C4, 2.2 nF) feeds its wiper, and its upper lug goes to a passive notch filter (R5, R6, C6, C7) and the 50k VOLUME pot. The two wires cross on the drawing without joining. Lug 1 here is the lower (Q2) end; the source does not say which way the knob turns. The original uses low-gain C536F7G transistors, which are not in Hibiki; both are modelled with the 2N3904. R11 (1.5M input pulldown) is on the GGG drawing and is kept. The bypass switch, LED indicator with R10, battery and DC jack are left out. R9 100k with C8 47 nF decouple the supply to Q2.', `
IN in
R11 1M5 in GND
C1 47n in b1
Q1 2N3904 c1 b1 GND
R1 2M2 c1 b1
C2 1n c1 b1
R2 22k +9V c1
C3 47n c1 b2
Q2 2N3904 c2 b2 GND
R3 1M2 c2 b2
R4 47k vs c2
R9 100k +9V vs
C8 47n +9V vs
C5 3n3 c2 fb
C4 2n2 c1 fw
VR8 50k/lin/FUZZ/0.5 fb fw a
C6 1n a b
R5 10k a m
R6 15k b m
C7 100n m GND
VR7 50k/lin/VOLUME/0.8 GND out b
OUT out`],
['Ampeg Scrambler', 'Ampeg Scrambler octave fuzz, from the GGG original schematic (ggg_scramb_sc_orig, version 2014March06). An emitter follower (Q1) feeds both the dry path (C3, R6) and a collector-feedback gain stage (Q2) whose output drives a diode network (D2 to D5, TEXTURE pot R10 wired as a variable resistor, R11) that rectifies and clips; Q3 and Q4 share the emitter resistor R15 and act as a differential pair, and C6 feeds the network back to the Q2 base. The 50k BALANCE pot blends dry (0) and effect (1). Q1, Q3 and Q4 are 2N5306 Darlingtons in the original and Q2 a BC169B; Hibiki has no Darlington model, so Q1, Q3 and Q4 are modelled as single 2N5088s (about 0.6 V less base-emitter drop, so the emitter voltages are higher than on the real unit) and Q2 as a BC547. The 1N456 diodes are modelled as 1N4148. The GGG drawing shows the Q4 emitter arrow pointing in (a PNP symbol), but its parts list says 2N5306 and the stage only works as an NPN, so Q4 is an NPN here. Sw1 (effect on/off in series with the effect end of the BALANCE pot) is taken as closed and left out, as are the battery and its switching on the input jack.', `
IN in
C1 10n in b1
R2 1M +9V b1
R3 1M b1 GND
Q1 2N5088 +9V b1 e1
R4 4.7k e1 GND
C3 1u e1 dry
R6 47k dry GND
C2 4.7u e1 r5
R5 2.2k r5 b2
R8 4.7k +9V c2
R7 470k c2 b2
Q2 BC547 c2 b2 e2
D1 1N4148 e2 b2
R9 220 e2 GND
C5 100u e2 GND
C6 4.7u tm b2
C4 4.7u n4 c2
D2 1N4148 n4 ta
D3 1N4148 tb n4
VR10 10k/lin/TEXTURE/0.5 ta ta tm
R11 8.2k tm tb
D4 1N4148 ta tm
D5 1N4148 tm tb
R12 220k +9V tm
R13 220k tm GND
Q3 2N5088 +9V ta e3
Q4 2N5088 c4 tb e3
R15 4.7k e3 GND
R14 1k +9V c4
C7 1u c4 fx
R16 47k fx GND
VR17 50k/lin/BALANCE/0.5 dry out fx
OUT out`],
];

const PEDALS = {};
for (const [name, about, text] of LIST) PEDALS[name] = parse(about, text);
if (typeof module !== 'undefined' && module.exports) module.exports = PEDALS; else root.PEDALS = PEDALS;
})(typeof window !== 'undefined' ? window : globalThis);
