# Adding an example pedal to Hibiki

This is the whole procedure for adding a pedal to the Examples menu. It is written so that any model (or person) can follow it without knowing the rest of the code. Read it top to bottom once; the checklist at the end is the short version.

The one rule that matters: you never draw. You type the circuit as a netlist (one part per line, with the name of the net on each pin) into `pedals.js`. Hibiki draws the schematic itself, wires it, and proves that the drawing has exactly the connections you typed. Do not write grid coordinates, do not add wires, do not edit `presets.js` or `schem.js` to make a pedal look better.

## 1. Before typing anything

- Have the real schematic open (PDF or image) and read every value from it. Never fill in a value from memory or from "what this kind of pedal usually has". If a value is unreadable, zoom in; if it is still unreadable, stop and say which part, or leave the pedal out.
- Do not work from the page at normal size. Render the schematic large (for a PDF, about 400 dpi or more, in two or three overlapping crops) and read from those. `python -c "import fitz; p=fitz.open('file.pdf')[0]; p.get_pixmap(matrix=fitz.Matrix(6,6)).save('big.png')"` does it; crop with `clip=fitz.Rect(x0,y0,x1,y1)` in page points.
- Check every place where two wires meet or cross, one by one. A dot is a junction: the wires are connected. A small arc (a hop) or a plain crossing with no dot is not a connection: the two wires are different nets. This is the most common import mistake: a hop read as a junction once tied two capacitors together and turned a three-lug pot into a variable resistor, and the simulation still passed.
- For every pot, find where each of its three terminals goes (two ends and the arrow). Only write the same net twice if the drawing really ties the wiper to an end.
- For every diode, transistor and electrolytic, zoom until the bar, the arrow or the + mark is unmistakable. If a symbol contradicts the drawing's own parts list (a PNP arrow on a part listed as an NPN type), follow whichever makes the circuit work, and say so in the about text.
- Check the pedal can be simulated at all. Hibiki has no BBD or delay chips, no OTA (CA3080), no transformers, no switches, no charge pumps, no P-channel MOSFETs, and its only oscillator is the 555 (transistor and op-amp LFOs never start). So chorus, flanger, delay, phaser, Dyna Comp style compressors, Octavia and anything with a transistor LFO are out. `README.md`, section "Not done yet", lists what was already rejected and why.
- Leave these out of the netlist: the bypass switch, the LED indicator and its resistor, the polarity-protection diode, the DC jack. If the circuit has a mode switch, pick one position and say which in the about text.

## 2. Where it goes

Add one entry to the `LIST` array in `pedals.js`, before the closing `];`. An entry is `[name, about, netlist]`:

```js
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
```

- `name`: maker and model, as it should read in the menu. Must be unique.
- `about`: one short paragraph. Say where the schematic came from (site and file name), what the circuit is in a sentence or two, and every substitution or thing left out. Escape apostrophes as `\'`. Do not mention who or what typed it.
- `netlist`: inside backticks, one part per line, fields separated by spaces: `<ref> <value or model> <net> <net> ...`. No blank lines, no comments, no spaces inside a field.

## 3. The netlist lines

The first letters of the ref decide the part type. Keep the refs of the original schematic (R1, C3, Q2) so the two can be compared; each ref must be unique.

| Ref starts with | Part | Second field | Nets, in this order |
|---|---|---|---|
| `IN` | input jack | (none) | tip, then optionally the pickup resistance (`IN in 7k`) |
| `OUT` | output jack | (none) | tip |
| `R` | resistor | value (`10k`, `4.7k`, `1M`, `470`) | either order |
| `C` | capacitor | value (`100n`, `47p`, `10u`) | either order below 1u; from `1u` up it is electrolytic and the first net is the + side |
| `L` | inductor | value (`500m`) | either order |
| `D` | diode, LED, zener | model | anode, cathode |
| `Q` | NPN or PNP transistor (the model decides) | model | collector, base, emitter |
| `J` | N-channel JFET | model | drain, gate, source |
| `U` | op-amp, one line per section | model | in+, in-, out |
| `VR` | potentiometer | `value/taper/LABEL/pos` | lug 1, wiper, lug 3 |

Net names: `GND` is ground. A supply is a net named by its voltage: `+9V`, `-9V`, `+18V`. Every other name is yours: short, lower case, no spaces (`b1`, `c1`, `vb`, `tone_w`). Two pins are connected if and only if they carry the same net name, so a typo makes a new, dangling net (the test catches it, see section 6).

Values: `p n u m k M` suffixes, or the `4k7` style. No units, no spaces (`4.7k`, not `4.7 k` or `4.7kΩ`).

Pots (`VR`): `value/taper/LABEL/pos`. Taper is `lin`, `log` or `rev` (reverse log). LABEL is the knob name in capitals with no spaces (`VOLUME`, `DRIVE`). `pos` is the starting position 0..1 and may be left out (0.5). At pos 0 the wiper sits at lug 1, at 1 it sits at lug 3. Choose lug 1 so that turning up means "more": for a volume pot lug 1 is ground and lug 3 is the signal. A pot used as a variable resistor has its wiper tied to one lug: write the same net twice (`VR19 500k/log/DRIVE/0.5 dr o1 o1`).

Models must exist in the tables at the top of `sim.js`. Today they are:

- Diodes: `1N4148`, `1N914` (same as 1N4148), `1N4001`, `1N4007`, `1N5817`, `1N5819`, `1N34A` (germanium), `LED_red` (other colours are not aliased yet: add `LED_blue: 'LED blue'` to `ALIAS` in `pedals.js` if you need one), zeners `1N4728A`, `1N4733A`, `1N4739A`, `1N4742A`.
- NPN: `2N5088`, `2N3904`, `2N2222`, `BC547`, `BC108`. PNP: `2N3906`, `BC557`, germanium `AC128`, `OC44`.
- JFET: `J201`, `2N5457`, `MPF102`.
- Op-amps: `TL071`, `TL072`, `TL074`, `TL081`, `TL082`, `TL084`, `NE5532`, `NE5534`, `RC4558`, `LM358`, `LM324`, `LM833`, `OPA2134`, `TLC2272`, `LM741`, `LM308`.

If the schematic uses a part that is not listed, use the nearest one and say so in the about text. Substitutions already in use: 2N5089 and MPSA18 as `2N5088`, 2N4401 as `2N3904`, BC546 as `BC547`, 2N5458 as `2N5457`, TL061 and LF351 as `TL071`, OC76 and OC81D as `OC44` or `AC128`, 1N270 as `1N34A`. Only add a new model line to `sim.js` if you have its datasheet figures; do not guess parameters.

## 4. Rules that are easy to get wrong

- Op-amps have no power pins: they run from the highest supply and ground on their own. Do not write lines for pins 4 and 8. A dual op-amp is two `U` lines with the same model.
- An op-amp pedal on a single 9 V supply needs its half-supply bias exactly as drawn in the original: two resistors from `+9V` to `GND` meeting at a net (call it `vb` or `vr`) with its filter capacitor to ground. Keep that capacitor: besides being part of the circuit, a net with a capacitor of 1u or more to ground is how the drawing recognises a bias rail and keeps the signal path off it.
- Positive-ground pedals (germanium PNP fuzzes): the supply net is `-9V` and ground stays `GND`. Electrolytics then have their + side on the ground side: `C2 22u GND w`.
- Every net needs at least two pins on it. A pin that is truly unconnected in the original cannot be written; leave that part out and say so.
- There must be exactly one `IN` and one `OUT`, and a path of parts between them.
- Type the direction of diodes and transistors from the drawing, not from habit: anode first, collector first, drain first, in+ first.
- A fuzz that depends on the guitar's impedance (Fuzz Face family) needs a source resistance on the input: `IN in 7k`.

## 5. How it will be drawn (you do nothing, but it helps to know)

`Schem.fromNetlist` finds the shortest chain of parts from `IN` to `OUT` and lays it out left to right. Every other part is placed next to what it connects to, with ground ends pointing down and supply ends pointing up. Nets are then wired; grounds and supplies are symbols; a connection that would need a long wire gets a small net label on each end instead, the way VREF is shown on a hand drawing. Finally the drawing is converted back to a netlist and compared with yours: if they differ in any way the wired drawing is thrown away and a plain grid of labelled parts is used instead, so a drawing can be ugly but never wrong.

The order of the lines does not change the circuit. It only breaks ties in placement, so typing the parts in signal order (input, first stage, ..., output) gives the cleanest result.

## 6. Check it

Run this in the Hibiki folder:

```
node test.js
```

It must end with `all checks passed (including MCP)`. For every entry in `pedals.js`, with no extra test code from you, it checks: no dangling pins, the drawing is wired and matches the netlist, the DC operating point solves, the simulation converges, the small-signal gain is between 0.2 and 500, a loud input stays within the supply, and both board layouts place every part. It also prints one line per pedal with the gain and the DC voltage of every net.

What a failure means:

- `<name> warnings ... 'R7 pin 2 is not connected.'`: a net name is used only once. Almost always a typo or a missed part.
- `no transistor model X` (thrown while loading): the model is not in `sim.js`. Use a substitute from section 3.
- `small-signal gain ... outside 0.2..500`: the circuit is dead or oscillating. Look at the printed DC line: a transistor collector stuck at 0 or at the supply, or an op-amp output at a rail, points to a wrong pin order or a missing bias resistor.
- `automatic drawing fell back to the label grid`: the drawing engine could not prove its own drawing. This is a bug in `schem.js`, not in your netlist. Report it; do not work around it.

Then read the printed DC line against the original: transistor stages should sit where the original's voltage notes say (or roughly mid-supply on the collector for a gain stage), op-amp outputs at half supply. If you know the pedal's real gain, add a tighter range for it to `expectGain` in `test.js` (`'Name': [lo, hi]`); it will then catch a later mistake.

To look at the result, open `index.html` in a browser (reload if it was open) and pick the pedal in the Examples menu. If you cannot open a browser, this prints the essentials:

```
node -e "const P=require('./presets.js'),S=require('./schem.js'),s=P.load(process.argv[1]);console.log(S.extract(s).warnings,s.wires.length+' wires',s.comps.filter(c=>c.type==='NET').length+' labels')" "EHX LPB-1 booster"
```

## 7. Register it in the documentation

An example that is not documented is not finished. Do all of these in the same session, before reporting the work as done:

- `README.md`, "Examples menu": add the pedal to the list of its family (boosters, overdrive and distortion, fuzz, octave, filter), or a new line if it comes from a new source.
- `README.md`, "Where the values come from": name the source under "Read directly from a source" only if you opened the schematic and read the values yourself. If any value came from a small or blurry drawing, say which, as is done for the Guv'nor. If something came from memory or from a search summary, it goes under those headings instead, never under "read directly".
- `README.md`, "References": one line with author or site, title, revision or date, and the URL or file name. Say "read directly" or "seen only as a search summary".
- `README.md`, "Not done yet": if you looked at a pedal and rejected it, add it there with the reason, so nobody repeats the work. If you added one that was listed there, remove it from that list.
- If you added a block as well, list it in the "Blocks" section under its category.
- If you added a model to `sim.js` or an alias to `pedals.js`, add it to the substitution list in the README paragraph after the GGG examples and to section 3 of this guide.
- Maintainer's reference library: if you are working for the maintainer and can reach it, file the source there too; otherwise list in your report which sources are new.
- Do not write process notes into any of these (who typed it, which tool, how many attempts). Documentation states what the circuit is, where it came from and what is not verified.

## 8. More rules

Fidelity to the source:

- Every part in the netlist must be on the source schematic. If you add one that is not (an input pulldown, an output load), say so in the about text and name the part. The reverse too: every part left out is named in the about text.
- Cite only sources you actually opened. "Two traces that agree" means you compared both, part by part. If you worked from one drawing and a parts list, say that.
- When two sources disagree on a value, do not pick silently: use the one closer to the original unit, and state the other value in the about text.
- Knob starting positions (`pos`) are your choice unless the source gives a setting; if you claim a named setting from a manual, you must have read the manual.
- Never change a value to make the simulation behave. If the real circuit depends on something the models lack (germanium leakage, slew rate, oscillation that needs noise to start), keep the real values and explain the difference in the about text.

Scope:

- One pedal per change. Do not edit, reorder, rename or "tidy" other entries while you are there, and do not rename an existing example (saved projects and tests refer to the names).
- Do not touch `schem.js`, `presets.js`, `sim.js`, `layout.js`, `app.js` or `test.js` to add an example, apart from the optional `expectGain` line and a model or alias you can justify from a datasheet.
- Do not delete or loosen a check in `test.js` to get a pass. A failing check means the netlist is wrong or the engine has a bug; fix the first, report the second.
- No coordinates, no hand-placed wires.

Checking and reporting:

- Run `node test.js` yourself and read its output; do not report success from having typed the entry.
- Compare the finished netlist with the schematic once more after the test passes: a circuit can pass every check and still be wrong. Do it net by net, not only line by line: for each net name, list the pins on it and confirm on the zoomed drawing that exactly those pins, and no others, are joined by wire and dots.
- In your final report, list separately: what you verified against the source, what you could not verify, every part added or left out, and every substitution. Say "not verified" plainly; do not round it up to "matches".
- If the schematic cannot be read reliably, stop and say so. A missing example is better than a wrong one.

Writing:

- English, in the style of the existing entries: plain sentences, no marketing words, units written as in the file (`4.7 uF`, `10k`).
- Each about text is one line with no line breaks. Apostrophes escaped as `\'`.

## Checklist

1. Schematic rendered large, every value read from it, every crossing checked for a dot or a hop, pedal uses only parts Hibiki has.
2. One `[name, about, netlist]` entry appended to `LIST` in `pedals.js`.
3. Pin order: `D` anode cathode, `Q` C B E, `J` D G S, `U` in+ in- out, `VR` lug1 wiper lug3, electrolytic + first.
4. `GND`, `+9V` or `-9V` for the rails; one `IN`, one `OUT`; every other net name appears at least twice.
5. Switch, indicator LED and protection diode left out; substitutions named in the about text.
6. `node test.js` ends with `all checks passed (including MCP)`; DC voltages look like the original's.
7. Documentation registered: `README.md` example list, "Where the values come from", "References" (and "Not done yet", "Blocks" when they apply).
8. Final report separates verified, not verified, added, left out and substituted.

## Other kinds of example

- Another Big Muff version: one `bigMuff(about, values)` call in `presets.js`, copying an existing one and changing the values.
- A hand-drawn teaching circuit (`RAW` in `presets.js`, grid coordinates and wire polylines): only when a person asks for a specific drawing. For a pedal read from a schematic, always use the netlist.
- A building block for the Blocks menu: see "Adding parts, examples and blocks" in `README.md`.
