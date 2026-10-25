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
| 08 Metall–halvleder-overganger og heterooverganger | to rewrite |  |
| 09 Transistorer og JFET-en | to rewrite | Approved new structure: 09 «Transistoren i en krets» (§6.1) and 10 «JFET-en» (§6.2). An incremental rewrite from round 3 (not committed) is superseded; rewrite from scratch. |
| 10 Strømmen i JFET-en | to rewrite | Becomes «JFET-en» (see 09). |

When they are written: the MESFET and the MOS capacitor get their own modules.
