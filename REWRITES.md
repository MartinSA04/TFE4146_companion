# Module rewrites

Every module in this guide is to be rewritten from a blank page, the way TFE4146 module 01
«Energibånd og ladningsbærere» was rewritten in October 2026. The old modules read like
encyclopedia articles: they went straight through the topic and stated things instead of
explaining them. Editing them sentence by sentence did not fix that. This file tracks which
modules have been rewritten and which remain.

## How a rewrite is done

Follow `WRITING.md` §9 in the framework repo (with §2, how a module teaches): start from a blank
page, build intuition before the math with sims and figures designed alongside the text, have an
independent agent review the draft, and show the maintainer the new module side by side with the
current one. Nothing is committed until the maintainer approves it.

Every rewrite quotes the past-exam tasks the module can solve (`WRITING.md` §3). The course's
papers are on Blackboard under «Previous exams» (in `exports/`, from the 22 October 2026 export on):
2018 (TFE4164), spring and fall 2020, 2021, 2022, 2023, 2024 and 2025. They are not public, so all
of them are hosted in `public/exams/` and listed in `course.yaml` `exams[]`.

Statuses: **to rewrite**, **in review** (a draft exists outside this repo and is with the
maintainer), **rewritten** (approved and committed).

## Status

| Module | Status | Notes |
|---|---|---|
| 01 Energibånd og ladningsbærere | **rewritten** | Rewritten from scratch with five new sims and four figures; approved and committed 2026-10-20. The reference module for `WRITING.md` §2. Three exam tasks added 2026-10-22. |
| 02 Bærerkonsentrasjoner ved likevekt | **rewritten** | Rewritten from scratch with two new sims (band states with Monte Carlo electrons, n₀ against temperature for Si, Ge and GaAs), two figures and four exam tasks; approved and committed 2026-10-22. |
| 03 Drift og Hall-effekten | **rewritten** | Rewritten from scratch with two new sims (one electron with and without a field, with its band diagram; what scatters electrons, with μ(T)), the Hall sim extended with a concentration control, four figures and three exam tasks; cut from about 6500 to about 5400 words in round 2; approved and committed 2026-10-22. |
| 04 Overskuddsbærere og diffusjon | **rewritten** | Rewritten from scratch with three new sims (band states under light with two quasi-Fermi levels; holes taking random steps across a plane, then steady injection; Haynes–Shockley rebuilt with the book's germanium numbers), three figures and two exam tasks; approved and committed 2026-10-23. |
| 05 pn-overgangen i likevekt | **rewritten** | Rewritten from scratch as «pn-overgangen i likevekt» (§5.1–5.2), with a new sim (a p-bit and an n-bit joined, the zone forming, bands and Fermi levels), two figures and four exam tasks; approved and committed 2026-10-24. The approved restructure is done: the old «Forspenning» section and its sim moved unchanged to the top of 06 until 06 is rewritten. |
| 06 Diodeligningen og gjennombrudd | **rewritten** | Rewritten from scratch over §5.3–5.4, with two new sims (the biased junction with carriers at their energies; Zener and avalanche breakdown), one figure and four exam tasks; approved and committed 2026-10-24. Replaces the old «Forspenning» section parked from 05 and the sims pn-overgang.js and injeksjon.js. |
| 07 Transienter, kapasitans og avvik fra den enkle teorien | **rewritten** | Rewritten from scratch over §5.5–5.6, with a new sim (the diode switched forward, open and reverse in a circuit, with the stored holes, their profile and a scope trace), three figures (the junction capacitance's charge, the real diode curve, centres in the zone) and four exam tasks; approved and committed 2026-10-25. Replaces the sim lagringstid.js. |
| 08 Metall–halvleder-overganger og heterooverganger | **rewritten** | Rewritten from scratch over §5.7–5.8, with three new sims (a metal joined to n- or p-type silicon, with the zone or the accumulated carriers and the band diagram; the gold contact in a circuit with electrons crossing the barrier, which tunnel through a thin zone when the silicon is heavily doped; N⁺-AlGaAs joined to n-type or p⁺-type GaAs), two figures (Fermi-level pinning, the AlGaAs–GaAs example) and three exam tasks; approved and committed 2026-10-25. Replaces the sims schottky.js and heteroovergang.js. |
| 09 Transistoren i en krets | **rewritten** | Rewritten from scratch as a short module over §6.1 (the transistor and its curves, the load line, amplification and switching), with a new sim (a transistor with a load resistor, the load line and a scope) and a figure (the three symbols over the curves); approved and committed 2026-10-25. Round 1 took in the lecture's CMOS inverter, switching time and off current and was rejected as circuit material, off pensum. The restructure is done: the old JFET sections, their sim and two quizzes moved unchanged to the top of 10 until 10 is rewritten. |
| 10 JFET-en | **rewritten** | Rewritten from scratch as «JFET-en» over §6.2 and both JFET lectures, opening on the 2SK117 from the lecturer's datasheet, with a new sim (the channel with its zones and electrons, the voltage along it on the same axis, and the I–V curves with pinch-off and breakdown), two figures (how a JFET is built, one slice of the channel) and two exam tasks; approved and committed 2026-10-25. The restructure is done: the old 09's JFET sections parked here are replaced, the file and URL are now /jfet-en, and the sim jfet.js is removed. |
| 11 MESFET-en | **rewritten** | New module over §6.3.1 and §6.3.3 (no lecture; §6.3.2 HEMT is struck), with a new sim (the channel with a long/short switch, the drift velocity along it and the I–V family) and a figure of the device; no exam task exists. Round 1 was cut in round 2 to the book's content at the book's depth, since the topic was neither lectured nor examined; approved and committed 2026-10-26. |
| 12 MOS-kondensatoren | **rewritten** | New module over §6.4.2–6.4.4 and the lecture of 22 October, with two new sims (the capacitor with its charges and band diagram; the capacitance with a small AC signal at low and high frequency), two figures and four exam tasks; approved and committed 2026-10-26. §6.4.1, the MOSFET principle, goes in the MOSFET module. |

Still to write as new modules: the MOSFET (§6.4.1, §6.5) and the bipolar transistor.
