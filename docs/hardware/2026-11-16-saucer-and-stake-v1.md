# Saucer & Stake Design v1

(8 Nov 2026, routing updated 12 Nov, sensing updated 16 Nov 2026)

Canvas with the drawings: "Smart Pot — Saucer & Stake Concepts" (Claude Design).
Routing boards: "Routing A" (rejected) and "Routing B" (chosen).

## Decision log

- 8 Nov: Concept A (rear-bay puck) chosen.
- 12 Nov: Hard requirement added: no visible tube or cable on the outside of the pot. Routing B1 chosen: flat spine in the pot's colour up the back, rim clip, plant-label-shaped stake head. Routing A (through the drainage hole) rejected: needs repotting and a suitable hole, waters from the bottom, buries the electronics in the wettest soil. Twig and woven cord remain possible style variants of B.
- 12 Nov: Drainage hole no longer required in principle (pending a no-hole pooling test).
- 16 Nov: Sensing set decided: capacitive soil moisture probe, a water level sensor in the reservoir (hanging float switch), and water volume metered by pump runtime. Reverses the 12 Nov "tank-low by firmware only" change.

## Assumptions

- No test pot yet. Design target: pot base Ø130–170 mm, top Ø200–250 mm, height 150–200 mm, with a rim 4–12 mm thick. Drawn with base Ø160 / top Ø220 / height 200.
- Printer unknown, so every part must fit a 205 × 205 mm bed. Material: opaque PETG (to be bought); TPU for the spine if the printer handles it.
- Parts: the EU peristaltic pump (TinyTronics PYSP310-6A) is 41 × 37 × 29 mm and uses 3 × 5 mm silicone tube. The bay can shrink from 68 to 52 mm deep (see Design Review v2); not yet applied below. LiPo 103450 (50 × 34 × 10 mm, protected), ESP32-C3 SuperMini (standard, not "Plus"), USB-C TP4056-type charger with protection, logic-level MOSFET, capacitive sensor v1.2 (98 × 23 × 1.6 mm), mini vertical float switch (reed type, ~€1–2).

## Design requirements

1. Pot fit: base Ø ≤ 170 mm; saucer outer Ø 200 mm.
2. Printability: each part ≤ 205 × 205 mm; tank printed in one piece.
3. Tank: ≥ 700 ml to the max line; opaque; vented through the fill port; cleanable.
4. Height ≤ 60 mm total.
5. Load: 12 kg static, < 1 mm sag, no creep (PETG, pillars ≤ ~60 mm apart); survives 25 kg pressed briefly.
6. Refill from the front-right without lifting the pot; mouth ≥ 20 mm; overfill exits outside at the max line.
7. Drainage tray ≥ 150 ml; pot stands on 4 mm ribs; drainage can only overflow outward.
8. Electronics bay: no tank penetration below max water + 4 mm; USB-C reachable without lifting the pot.
9. Hidden routing (B1): no bare tube or cable visible. One sealed exit boss in the tray at the rear, just behind the pot base (r ≈ 88 mm), top at least 8 mm above the tray floor. From there a flat spine in the pot's colour (outside ≤ 10 × 5 mm, TPU or 0.8 mm PETG, printed 205 mm long with trim marks every 10 mm for pots 150–200 mm tall) carries the 3 × 5 mm silicone tube and a flat 3-core cable up the back of the pot to a rim clip (rims 4–12 mm thick). Bundle about 50 cm; outlet above tank level.
10. Stake: in-soil blade ≤ 28 × 5 mm, about 70 mm deep. Head shaped as a plant label, ≤ 36 × 8 mm seen from the front and ≤ 60 mm above the soil, electronics potted. Tube and cable leave the head below the soil line and run at least 10 mm under the surface to the rim clip. Drip outlet at the soil surface, 15–25 mm from the blade.
11. Sensing:
    - Soil: capacitive moisture probe in the stake, powered from a GPIO only while reading; calibrated per pot (air reading and reading after the first full watering); thresholds as % of that span.
    - Reservoir level: hanging float switch clipped to the tank rim next to the pickup tube, tripping at ~100 ml left; its wires join the existing pass-through above the waterline (no new hole below max water + 4 mm).
    - Water metering: pumped volume = runtime × calibrated ml/s, corrected for battery voltage. Water left = full volume − pumped since the last refill; reset when the float switch goes from "low" to "not low" after a refill. Per dose ≤ 40 ml, per day ≤ 150 ml; stop and flag after 2 doses with no moisture rise.

## Concepts

- A Rear-bay puck: Ø200 × 58 mm, D-shaped tank in front, sealed bay at the back behind a double wall. Chosen.
- B Stacked plinth: tank / electronics drawer / tray, 86 mm tall. Rejected: too tall, glued tank lid, tube coupling for the drawer.
- C Low saucer + rear pod: 44 mm saucer + 120 × 55 × 64 mm pod. Fallback if A's shared wall can't be made dry.

## Concept A dimensions

- Outer Ø200; body 48 mm + tray 10 mm = 58 mm.
- Walls 2.4 mm (6 × 0.4 mm perimeters), floor 2.0 mm.
- Bay: wall plane 68 mm from the rear edge; double wall 2.4 + 3.0 gap + 2.4 mm; the gap is open underneath (weep gap). Bay floor ≈ 150 × 40 mm, 38 mm clear above a 6 mm sled.
- Max water 38 mm above the floor → ≈ 705 ml.
- 7 pillars Ø12 to the rim height; the tray and bay lid rest on them.
- Fill ear: front-right at 45°, Ø22 mouth centred at r = 106 mm; overflow notch at the max line, venting outward.
- Pickup tube to a 3 mm sump next to the bay wall.
- Float switch: clip on the tank rim beside the pickup tube; float hangs into the tank, trip point ~6 mm above the floor (≈ 100 ml left). Keep it clear of the pickup tube and pillars.
- Every pass-through ≥ 42 mm above the floor; USB-C rear-right.
- Tube/cable exit: sealed boss at the rear of the tray, just behind the pot base (requirement 9).
- Tray: Ø196, 2 mm floor, 10 mm rim, 4 mm ribs, ≈ 190 ml.

## Watertight tank (PETG)

- 0.4 mm nozzle, 0.2 mm layers, walls 100% perimeters (no infill inside walls), 10 bottom layers.
- 240–250 °C, bed 80 °C, part fan ~30% after layer 3, flow +3–5% after a flow test, outer walls 30–40 mm/s, seam aligned to the rear.
- Leak test: 72 h with food colouring, standing on paper towel. Epoxy-coat the inside of every tank.
- Print a small test cup (60 × 60 × 45 mm, one double-wall corner, half coated) with the same settings before the big tank.

## Bay waterproofing

- Geometry first: overflow notch (38 mm water) below all pass-throughs (≥ 42 mm).
- Weep gap drains any seepage out under the saucer.
- Electronics on a 6 mm sled; Ø3 drain hole in the bay floor.
- Bay lid with a 2 mm lip and 4 × M3 screws; the tray above acts as a roof.
- Tube and float-switch wire pass-throughs: tight holes + silicone, or TPU grommets (size for 5 mm OD tube).
- Conformal coat (or nail varnish) on the boards; leak-detect traces in the bay floor (suggestion).

## Stake v2 (B1, replaces Stake v1)

- Plant-label head, ≤ 36 × 8 mm from the front, ≤ 60 mm above the soil; potted electronics inside.
- Blade 28 × ≤ 5 mm, ~70 mm in the soil.
- Tube and cable exit the head below the soil line, run ≥ 10 mm under the surface to the rim clip.
- Drip outlet at the soil surface, 15–25 mm from the blade.
- Sensor lead extended to ~50 cm (flat 3-core cable).

## CAD

Onshape (free Education plan), parametric with Variables. First task: tank body v0 with variables and a water-volume check.
