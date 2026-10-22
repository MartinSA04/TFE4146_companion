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
| 01 Energibånd og ladningsbærere | **rewritten** | Rewritten from scratch with five new sims and four figures; approved and committed 2026-10-20. The reference module for `WRITING.md` §2. |
| 02 Bærerkonsentrasjoner ved likevekt | **rewritten** | Rewritten from scratch with two new sims (band states with Monte Carlo electrons, n₀ against temperature for Si, Ge and GaAs), two figures and four exam tasks; approved and committed 2026-10-22. |
| 03 Drift og Hall-effekten | to rewrite |  |
| 04 Overskuddsbærere og diffusjon | to rewrite |  |
| 05 pn-overgangen i likevekt og med forspenning | to rewrite | Approved restructure, on hold until the writing review is finished: «Forspenning» moves into 06, so the diode equation is derived once; 05 becomes «pn-overgangen i likevekt» (§5.1–5.2). |
| 06 Diodeligningen og gjennombrudd | to rewrite | Takes «Forspenning» from 05 (on hold, see 05) and covers §5.3–5.4. |
| 07 Transienter, kapasitans og avvik fra den enkle teorien | to rewrite |  |
| 08 Metall–halvleder-overganger og heterooverganger | to rewrite |  |
| 09 Transistorer og JFET-en | to rewrite | Approved new structure: 09 «Transistoren i en krets» (§6.1) and 10 «JFET-en» (§6.2). An incremental rewrite from round 3 (not committed) is superseded; rewrite from scratch. |
| 10 Strømmen i JFET-en | to rewrite | Becomes «JFET-en» (see 09). |

When they are written: the MESFET and the MOS capacitor get their own modules.
