# Hibiki MCP: designing pedals with Claude

`mcp.js` is a Model Context Protocol server that gives Claude the same engine the Hibiki web app uses: it can write a circuit, simulate it, read the bias voltages and gain, sweep the frequency response, run a guitar recording through it, get the breadboard or stripboard layout, and open the result in the browser for you. This file is also what the `hibiki_guide` tool returns, so it is written for Claude as much as for you.

## Setup

Needs Node.js (any recent version) and nothing else. Register it once for every Claude Code session on this PC:

`claude mcp add --scope user hibiki -- node "<path to this folder>/mcp.js"`

Check with `claude mcp list` (it should say connected). New sessions then have tools named `mcp__hibiki__...`. To remove it: `claude mcp remove hibiki --scope user`.

Then just ask, for example: "Design a one-knob LED fuzz with a 2N3904 and two blue LEDs, check the bias, and open it so I can hear it", or "In my project red-army, make the tone control brighter and show me the frequency response before and after".

## How it works

Projects are the app's own `.json` files in `Hibiki\projects\`. Claude never draws: it describes a circuit as a netlist (parts and the name of the net on each pin), and the server draws the schematic: signal path left to right, parts wired, grounds and supplies as symbols, one label per net so the names survive. You can rearrange and rewire that drawing in the app afterwards; it stays the same circuit.

`open_app` serves the web app from the MCP server at a local address like `http://127.0.0.1:53124/?project=name`. In that mode the browser and Claude share the project file: what you change in the browser is saved to the file, and what Claude changes appears in the browser within about 2 seconds (as one undo step). The link works only while the Claude session that opened it is running; the file stays in `projects\` and can be opened in the normal app with Open.

## Tools

- `hibiki_guide`: this text plus the list of part models.
- `list_projects`: saved projects, built-in examples, building blocks.
- `load_example`: copy an example into a project.
- `get_circuit`: the project as a netlist, with wiring warnings.
- `set_circuit`: create or replace a project from a netlist.
- `edit_circuit`: `set` properties (value, model, knob position...), `add` a component, `remove` a component. Does not redraw.
- `simulate`: DC operating point and a sine test (gain, peaks, harmonics, distortion). Optional temporary knob positions.
- `frequency_response`: gain in dB against frequency.
- `render_audio`: run a WAV through the pedal, write the result as a WAV, report levels and crest factor.
- `board_layout`: breadboard or stripboard layout as text, checked against the schematic. If you hand-edited the layout in the app it reports your version.
- `open_app`: open the project in the browser, live-linked.

## Netlist format

A circuit is `{ about, components: [...] }`. Each component is `{ type, ref?, <properties>, nets: [...] }` with one net name per pin, in this order:

| type | pins (order of `nets`) | properties |
|---|---|---|
| `R` | 1, 2 | `value` ("10k", "4k7", "1M", "470") |
| `C` | 1 (+ if electrolytic), 2 | `value` ("100p", "47n", "2.2u"); 1u and above is treated as electrolytic, so put the more positive net first |
| `L` | 1, 2 | `value` in henries ("500m") |
| `POT` | lug1, wiper, lug3 | `value`, `taper` (lin, log, rev), `pos` 0..1, `label` (knob name, e.g. "GAIN") |
| `D` | anode, cathode | `model` (also the LEDs: "LED blue", and zeners: "1N4733A" is 5.1 V; a zener regulates with its cathode on the positive side) |
| `NPN`, `PNP` | C, B, E | `model`, optional `hfe` to override the gain |
| `JFET` | D, G, S | `model` (N-channel) |
| `NMOS` | D, G, S | `model` (N-channel MOSFET: 2N7000, BS170, IRFZ44N) |
| `LDR` | 1, 2 | `dark`, `lit` (resistance with no light and in full light), `light` 0..1, or `led`: the ref of an LED (`D`) in the circuit that shines on it; it reaches `lit` at 20 mA and reacts slowly like a real cell |
| `NE555` | trig, thr, dis, out, ctrl | none; power pins are implicit (highest supply and ground), reset is tied high. `ctrl` may be a net used nowhere else. Astable: supply - RA - dis - RB - thr and trig together - C - GND, f = 1.44 / ((RA + 2 RB) C) |
| `OPA` | in+, in-, out | `model`; power pins are implicit (highest supply and ground) |
| `IN` | tip | `rs`, `ls`: source resistance / inductance (0 = ideal; a passive pickup is about 7k and 2.5 H) |
| `OUT` | tip | `rload`: load resistance, default 1M |

Net names: `GND` is ground. A name like `+9V` (sign, number, V) is a DC supply of that voltage: just use it, no battery component is needed. Any other name is a signal net; pins with the same name are connected. Every circuit needs one `IN`, one `OUT` and at least one `GND`.

Pot convention: `pos` 0 puts the wiper at lug1, 1 at lug3. For a volume control use lug3 = signal, lug1 = GND, wiper = output. For a variable resistor tie the wiper to one lug.

Example, a one-transistor booster:

```json
{
  "about": "LPB-1 style booster",
  "components": [
    { "type": "IN", "nets": ["in"] },
    { "type": "C", "ref": "C1", "value": "100n", "nets": ["in", "base"] },
    { "type": "R", "ref": "R1", "value": "430k", "nets": ["+9V", "base"] },
    { "type": "R", "ref": "R2", "value": "43k", "nets": ["base", "GND"] },
    { "type": "NPN", "ref": "Q1", "model": "2N3904", "nets": ["coll", "base", "emit"] },
    { "type": "R", "ref": "R3", "value": "10k", "nets": ["+9V", "coll"] },
    { "type": "R", "ref": "R4", "value": "390", "nets": ["emit", "GND"] },
    { "type": "C", "ref": "C2", "value": "100n", "nets": ["coll", "vol_top"] },
    { "type": "POT", "ref": "VR1", "label": "BOOST", "value": "100k", "taper": "log", "pos": 0.8, "nets": ["GND", "out", "vol_top"] },
    { "type": "OUT", "nets": ["out"] }
  ]
}
```

## Working method (for Claude)

1. `set_circuit`, then read the warnings it returns: "pin is not connected" means a net name is used only once (usually a typo).
2. `simulate` and check the bias before anything else. Rules of thumb on a 9 V supply: a BJT gain stage wants its collector somewhere around 3 to 6 V; an op-amp wants both inputs and its output near half the supply (build a Vref with two equal resistors and a capacitor, and bias the + input to it through a large resistor); a JFET drain near half the supply. An output stuck at a rail or at 0 V means the stage is not biased.
3. Change one thing at a time with `edit_circuit` and `simulate` again. Use `knobs` to try a pot position without saving it.
4. `frequency_response` for tone controls. Run it at two or three knob positions to see the range.
5. When the numbers look right, `open_app` so the user can look and listen. `render_audio` gives you numbers (crest factor falls as clipping increases) and gives the user a file, but you cannot hear it: say so rather than describing the sound as fact.
6. `board_layout` when the user wants to build it.

Prefer parts the user has. The part models were chosen around this inventory: linear B-taper pots (5k, 10k, 220k, 250k), 2N3904 / 2N2222 / 2N3906 / BC557, op-amps LM741, LM358, NE5532, TL082, TL084, diodes 1N4007 and 1N5819, 1N4733A zener, IRFZ44N MOSFET, NE555, an LDR, blue / red / orange / green LEDs, ceramic capacitors up to 100n and electrolytics of 10u, 100u and 470u. Read it before choosing values if the design is meant to be built.

## Limits to keep in mind

- Models are typical DC parameters: no junction capacitance, no op-amp bandwidth or slew rate, no noise. Real transistor gain varies; set `hfe` to a measured value when the bias is sensitive to it.
- Op-amps clip at fixed distances from the rails and draw no supply current.
- A 555 is the only oscillator (use it as the LFO, for example 555 -> LED -> LDR for a tremolo). `simulate` and `frequency_response` use short sine bursts, so judge a slow LFO effect with `render_audio`. MOSFET thresholds, the zener knee and the LED-to-LDR coupling are typical figures, not measured ones. No P-channel MOSFETs, no switches.
- The simulator is not cross-checked against LTspice. Treat results as good design guidance, and confirm a final design in LTspice or on the breadboard.
- The automatic drawing is wired and checked against the netlist, but it is not a hand drawing: connections that would need a long wire get a net label on each end, and a part added later with `edit_circuit` lands under the drawing with labels. Send the whole circuit again with `set_circuit` to redraw it.
