/**
 * «Silisiumkrystallen» for TFE4146, modul 01.
 *
 * Én idé: ledning i en halvleder sett i atomene. Ved 0 K sitter hvert
 * elektron i en binding, og ingenting kan flytte seg. Varme bryter av og til
 * en binding: elektronet blir fritt, og den tomme plassen det etterlater
 * (hullet) vandrer fordi et elektron fra en nabobinding hopper inn i den. I et
 * felt går de frie elektronene mot venstre og hullene mot høyre, så begge
 * fører strøm samme vei. Møter et fritt elektron et hull, faller det inn, og
 * begge er borte. Et fosforatom har ett elektron for mye til de fire
 * bindingene; det femte er løst bundet og blir fritt nesten uansett
 * temperatur, og P⁺ blir stående igjen. Et boratom har ett for lite; et
 * naboelektron hopper inn i den ufullstendige bindingen, hullet vandrer av
 * gårde, og B⁻ blir stående igjen.
 *
 * Tegningen er den flate gittertegningen i Streetman & Banerjee fig. 3–11 og
 * 3–12 (§3.2.3–3.2.4): hvert atom er bundet til fire naboer med et
 * elektronpar (to streker, to prikker). Gitteret er periodisk: det som går ut
 * på én kant, kommer inn på den motsatte. Gitteret tegnes med en smal marg, så
 * kantbindingene står hele på begge sider; bærerne klippes til én periode, så
 * en bærer på kanten er halvt på hver side og aldri telles to ganger.
 * Donorer og akseptorer står i hver tredje kolonne, så tettheten er den samme
 * på alle skjermer: to på telefon, fire på en bred skjerm.
 *
 * Ingen rate er i skala. I Si ved 300 K er ett av omtrent 3·10¹² atomer
 * ionisert termisk (n_i = 1,5·10¹⁰ cm⁻³ mot 5·10²² atomer/cm³), mens
 * donorene er nesten helt ionisert ned mot 100 K (E_c − E_d = 44 meV for P,
 * E_a − E_v = 45 meV for B, fig. 4–9). Simmen beholder bare rekkefølgen og
 * retningen. Tallene under gjelder telefonbredden (6 × 5 atomer):
 *  - Bindingsbrudd per binding: G0·e^(−T_G/T) med G0 = 11,5 s⁻¹ og
 *    T_G = 2400 K. Ved 300 K gir det et brudd omtrent hvert femte sekund i
 *    bildet, og i snitt 0,6 par (halve tiden ingen bærere i det hele tatt);
 *    ved 450 K rundt seks par, ved 600 K er taket nådd; under 200 K praktisk
 *    talt ingen. (Ekte aktivering, E_g/2k ≈ 6500 K, ville gjort 300 K og
 *    600 K umulige å vise i samme bilde.)
 *  - Doneren slipper elektronet, og akseptoren hullet, med raten
 *    K0·e^(−T_D/T), K0 = 3 s⁻¹ og T_D = 50 K: om lag ett sekund ved 40 K,
 *    under et halvt ved romtemperatur, minutter ved 10 K. Etter et bytte av
 *    doping venter den 1,5 s, så leseren ser den bundne bæreren først.
 *  - Gjenfangst ved P⁺ (fritt elektron innenfor banen) har raten
 *    2,5·e^(−T/30 K) s⁻¹; et hull som hopper inn i en binding ved B⁻, blir
 *    fanget med sannsynligheten e^(−T/30 K). Ved 30 K er derfor omtrent én
 *    av fem donorer bundet til enhver tid; over ~100 K skjer det ikke.
 *  - Elektron og hull trekker på hverandre innenfor 2 gitteravstander (et
 *    fritt elektron styrer mot hullet, et hull hopper helst mot elektronet),
 *    og elektronet faller inn når det er nærmere enn 0,3. Uten dette ville et
 *    par levd et halvt minutt i bildet, og termiske par ville ved 300 K ha
 *    druknet de dopede bærerne. Med fosfor ved 300 K: 2,3 frie elektroner og
 *    0,2 hull i snitt; med bor det speilvendte.
 *  - Feltet gir de frie elektronene en drift på ~0,7 gitteravstander/s mot
 *    venstre og hullene ~0,4 mot høyre (elektronene er raskere, som i Si).
 * Antall frie bærere har et tak (atomer/3,5), så 600 K forblir lesbart.
 *
 * Kontrakt: default-eksporter init(api), api = { canvas, ctx, controls, getSize, onResize, signal }.
 * `make({ doping, dopingControl })` gir en init med en annen startdoping ("ingen" | "fosfor" | "bor"),
 * og `dopingControl: false` skjuler dopingvalget (modulen viser krystallen før den har forklart doping).
 */

import { choiceRow } from "./_controls.js";

// ── rater (per sekund), ikke i skala: se filhodet ──────────────────────────
const G0 = 11.5; // bindingsbrudd per binding
const T_G = 2400; // K
const K0 = 3; // donor/akseptor slipper bæreren
const T_D = 50; // K
const KC0 = 2.5; // gjenfangst ved P⁺
const T_C = 30; // K

const gen = (T) => (T > 0 ? G0 * Math.exp(-T_G / T) : 0);
const release = (T) => (T > 0 ? K0 * Math.exp(-T_D / T) : 0);
const capture = (T) => KC0 * Math.exp(-T / T_C);
const holeCapture = (T) => Math.exp(-T / T_C);
/** Hvor fort bærerne beveger seg. Null ved 0 K, 1 ved 300 K. */
const speedOf = (T) => (T > 0 ? 0.35 + 0.65 * Math.sqrt(Math.min(T, 600) / 300) : 0);

// ── bevegelse, i gitteravstander a ──────────────────────────────────────────
const V0 = 1.0; // a/s, termisk fart for et fritt elektron ved 300 K
const TAU = 0.5; // s, hvor lenge et fritt elektron holder retningen
const VD = 1.4; // a/s, drivet mot venstre i feltet; støtene mot atomene gir ~0,7 a/s i snitt
const HOP_WAIT = 0.35; // s, midlere ventetid mellom hullhopp ved 300 K
const HOP_DUR = 0.3; // s, et hopp tar så lang tid
const BIAS = 1.0; // hopp mot høyre i feltet vektes med e^BIAS, mot venstre e^−BIAS (~0,4 a/s)
const ATTR_R = 2; // a, rekkevidden for tiltrekningen mot et hull
const ATTR_F = 5; // a/s², styrken
const HOLE_ATTR = 1.0; // hopp mot et elektron innenfor ATTR_R vektes med e^(HOLE_ATTR·tilnærming/(a/2))
const CAPT_R = 0.3; // a, et fritt elektron faller inn i hullet herfra
const ORBIT = 1.4; // a, banen til donorens femte elektron; holder seg innenfor én periode
const OMEGA = 1.6; // rad/s ved 300 K
const BOUND_ALPHA = 0.65; // donorens bundne elektron tegnes blekere
const FLASH = 0.45; // s, blinket ved et bindingsbrudd eller et elektron som faller inn
const STEP = 1 / 60; // s, fast tidssteg så forløpet er det samme hver gang

export function make(opts = {}) {
  const startDoping = opts.doping ?? "ingen";

  return function init({ canvas, ctx, controls, getSize, onResize, signal }) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeScale = reduced ? 0.4 : 1;

    let temp = 300;
    let doping = startDoping;
    let field = false;

    // Sådd tilfeldighet (mulberry32), så en omlasting ser lik ut.
    let seed = 20261020;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gauss = () => {
      let u = 0;
      while (u === 0) u = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
    };
    const expo = (mean) => -Math.log(1 - rnd()) * mean;

    // ── kontroller ──────────────────────────────────────────────────────────
    const tLabel = document.createElement("label");
    tLabel.append("Temperatur ");
    const tOut = document.createElement("output");
    const tInput = document.createElement("input");
    tInput.type = "range";
    tInput.min = "0";
    tInput.max = "600";
    tInput.step = "10";
    tInput.value = String(temp);
    tInput.setAttribute("aria-label", "Temperatur i kelvin");
    tLabel.append(tOut, tInput);
    tInput.addEventListener(
      "input",
      () => {
        const was = temp;
        temp = Number(tInput.value);
        sync();
        if (temp === 0) groundState();
        else if (was === 0) scripted = 0.6;
        render();
        start();
      },
      { signal },
    );

    const dopPick = choiceRow({
      ariaLabel: "Doping",
      label: "Doping",
      items: [
        { value: "ingen", label: "Ingen" },
        { value: "fosfor", label: "Fosfor" },
        { value: "bor", label: "Bor" },
      ],
      onPick: (v) => {
        if (v === doping) return;
        doping = v;
        sync();
        placeDopants();
        groundState();
        render();
        start();
      },
      signal,
    });

    const fieldBtn = document.createElement("button");
    fieldBtn.type = "button";
    fieldBtn.className = "sim-btn";
    fieldBtn.textContent = "Elektrisk felt";
    fieldBtn.addEventListener(
      "click",
      () => {
        field = !field;
        sync();
        render();
      },
      { signal },
    );

    // Slideren tar bare sin egen bredde, så feltknappen står ved siden av den.
    tLabel.style.flex = "0 1 auto";
    controls.append(tLabel, fieldBtn);
    if (opts.dopingControl !== false) controls.append(dopPick.el);

    function sync() {
      tOut.textContent = `${temp} K`;
      dopPick.sync(doping);
      fieldBtn.setAttribute("aria-pressed", String(field));
    }

    // ── farger og skrift, lest fra tokenene (på nytt etter temabytte) ────────
    const C = {};
    function readTokens() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      C.fg = v("--fg");
      C.muted = v("--muted");
      C.strong = v("--border-strong");
      C.nested = v("--card-nested");
      C.bg = v("--canvas-bg") || v("--bg-elevated");
      C.accent = v("--accent"); // feltpilen
      C.electron = v("--indigo"); // frie elektroner, som i emnets andre simmer
      C.red = v("--red");
      C.mono = v("--font-mono") || "monospace";
    }

    // ── geometri ────────────────────────────────────────────────────────────
    const M = 6; // px, kantmarg så kantbindingene vises hele på begge sider
    const TOP = 26; // px, stripen for feltpilen
    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let ax = 0;
    let ay = 0;
    let a = 0;
    let Px = 0;
    let Py = 0;
    let R = 12;
    let gap = 3.5;
    let legendRows = 1;
    let legendY = 0;

    const LEGEND = [
      { kind: "bond", text: "elektron i binding" },
      { kind: "free", text: "fritt elektron" },
      { kind: "hole", text: "hull" },
    ];
    const LEG_ICON = 12;
    const LEG_GAP = 16;

    /** Atomene ligger i (i + ½)·ax, (j + ½)·ay i gitterkoordinater. */
    const atomX = (i) => (i + 0.5) * ax;
    const atomY = (j) => (j + 0.5) * ay;
    const wrapX = (x) => ((x % Px) + Px) % Px;
    const wrapY = (y) => ((y % Py) + Py) % Py;
    const dX = (d) => d - Px * Math.round(d / Px);
    const dY = (d) => d - Py * Math.round(d / Py);

    // Bindinger: 0..N−1 vannrette (i,j)–(i+1,j), N..2N−1 loddrette (i,j)–(i,j+1).
    let N = 0;
    let slots = new Uint8Array(0); // 0 elektron, 1 hull, 2 elektron på vei inn
    let perp = []; // bindingene vinkelrett på hver binding, med felles atom
    let isDopantBond = new Int8Array(0); // −1, ellers indeksen til dopanten
    let genBonds = [];

    const bondI = (b) => (b < N ? b % cols : (b - N) % cols);
    const bondJ = (b) => (b < N ? Math.floor(b / cols) : Math.floor((b - N) / cols));
    const hB = (i, j) => ((j + rows) % rows) * cols + ((i + cols) % cols);
    const vB = (i, j) => N + hB(i, j);
    const atomIdx = (i, j) => ((j + rows) % rows) * cols + ((i + cols) % cols);

    /** Midtpunktet av bindingen, uten omslag (kan ligge på Px eller Py). */
    function bondMid(b) {
      const i = bondI(b);
      const j = bondJ(b);
      return b < N ? { x: (i + 1) * ax, y: atomY(j) } : { x: atomX(i), y: (j + 1) * ay };
    }
    /** Plassen til elektron k (0 eller 1) i bindingen: én prikk på hver strek. */
    function slotPos(s) {
      const b = s >> 1;
      const o = s & 1 ? gap : -gap;
      const m = bondMid(b);
      return b < N ? { x: m.x, y: m.y + o } : { x: m.x + o, y: m.y };
    }

    function layout() {
      const size = getSize();
      W = size.w;
      H = size.h;
      const oldCols = cols;
      const oldRows = rows;
      const oldAx = ax;
      const oldAy = ay;

      cols = Math.max(6, Math.round((W - 2 * M) / 52));
      ax = (W - 2 * M) / cols;

      // Tegnforklaringen brytes over to linjer når den ikke får plass på én.
      ctx.font = `11px ${C.mono}`;
      const widths = LEGEND.map((l) => LEG_ICON + 6 + ctx.measureText(l.text).width);
      const total = widths.reduce((s, x) => s + x, 0) + LEG_GAP * (LEGEND.length - 1);
      legendRows = total > W - 16 ? 2 : 1;
      const legendH = legendRows * 17 + 10;

      const latH = H - TOP - legendH - 2 * M;
      rows = Math.max(4, Math.round(latH / ax));
      ay = latH / rows;
      a = (ax + ay) / 2;
      Px = cols * ax;
      Py = rows * ay;
      R = Math.max(12, Math.min(15, 0.27 * a));
      gap = Math.max(3, Math.min(4, 0.075 * a));
      legendY = TOP + 2 * M + Py + 4;

      if (cols !== oldCols || rows !== oldRows) {
        buildLattice();
        placeDopants();
        groundState();
      } else if (oldAx && (oldAx !== ax || oldAy !== ay)) {
        const kx = ax / oldAx;
        const ky = ay / oldAy;
        for (const e of elec) {
          e.x *= kx;
          e.y *= ky;
          e.x0 *= kx;
          e.y0 *= ky;
          e.x1 *= kx;
          e.y1 *= ky;
          e.vx *= kx;
          e.vy *= ky;
        }
        for (const f of flashes) {
          f.x *= kx;
          f.y *= ky;
        }
      }
    }

    function buildLattice() {
      N = cols * rows;
      slots = new Uint8Array(4 * N);
      perp = [];
      const at = (i, j) => [(i + cols) % cols, (j + rows) % rows];
      for (let b = 0; b < 2 * N; b++) {
        const i = bondI(b);
        const j = bondJ(b);
        if (b < N) {
          // Vannrett: atomene (i,j) og (i+1,j); vinkelrett er de loddrette i begge.
          perp.push([
            { nb: vB(i, j), pivot: at(i, j) },
            { nb: vB(i, j - 1), pivot: at(i, j) },
            { nb: vB(i + 1, j), pivot: at(i + 1, j) },
            { nb: vB(i + 1, j - 1), pivot: at(i + 1, j) },
          ]);
        } else {
          perp.push([
            { nb: hB(i, j), pivot: at(i, j) },
            { nb: hB(i - 1, j), pivot: at(i, j) },
            { nb: hB(i, j + 1), pivot: at(i, j + 1) },
            { nb: hB(i - 1, j + 1), pivot: at(i, j + 1) },
          ]);
        }
      }
    }

    // ── dopanter ────────────────────────────────────────────────────────────
    let dopants = []; // { i, j, kind: "P"|"B", ion, delay, bonds, orbitA }
    const dopantAt = new Map();

    function placeDopants() {
      dopants = [];
      dopantAt.clear();
      isDopantBond = new Int8Array(2 * N).fill(-1);
      if (doping !== "ingen") {
        // Godt fra hverandre: hver tredje kolonne, annenhver på rad 1 og nest nederst,
        // så donorbanen ikke krysser kanten og elektronet på den aldri deles i to.
        const n = Math.floor(cols / 3);
        for (let k = 0; k < n; k++) {
          const i = 1 + 3 * k;
          const j = k % 2 ? rows - 2 : 1;
          const bonds = [hB(i, j), hB(i - 1, j), vB(i, j), vB(i, j - 1)];
          const d = { i, j, kind: doping === "fosfor" ? "P" : "B", ion: false, delay: 0, bonds, orbitA: 1 };
          dopantAt.set(atomIdx(i, j), dopants.length);
          for (const b of bonds) isDopantBond[b] = dopants.length;
          dopants.push(d);
        }
      }
      genBonds = [];
      for (let b = 0; b < 2 * N; b++) if (isDopantBond[b] < 0) genBonds.push(b);
    }

    // ── bærere ──────────────────────────────────────────────────────────────
    let elec = []; // { mode: "leave"|"free"|"fall"|"bound", x, y, vx, vy, t, dur, x0, y0, x1, y1, immune, partner, donor, phi, r, slot }
    let holes = []; // { s, wait, busy, age, acc }
    let hops = []; // { from, to, px, py (atomet det hoppes rundt), t, th0, r0, th1, r1, hole }
    let flashes = []; // { x, y, age }
    let scripted = 1.0; // s til det første bindingsbruddet ved oppstart

    function newElectron(o) {
      return { mode: "free", x: 0, y: 0, vx: 0, vy: 0, t: 0, dur: 1, x0: 0, y0: 0, x1: 0, y1: 0, immune: 0, partner: null, alpha: 1, donor: -1, phi: 0, r: 0, slot: -1, ...o };
    }

    /** Grunntilstanden ved 0 K: alle bindinger fulle, donor- og akseptorbæreren bundet. */
    function groundState() {
      slots.fill(0);
      elec = [];
      holes = [];
      hops = [];
      flashes = [];
      dopants.forEach((d, k) => {
        d.ion = false;
        d.delay = 1.5; // la leseren se den bundne bæreren før den slipper
        d.orbitA = 1;
        if (d.kind === "P") {
          const phi = 2 * Math.PI * rnd();
          const e = newElectron({ mode: "bound", donor: k, phi, r: ORBIT * a, alpha: BOUND_ALPHA });
          e.x = wrapX(atomX(d.i) + e.r * Math.cos(phi));
          e.y = wrapY(atomY(d.j) + e.r * Math.sin(phi));
          elec.push(e);
        } else {
          // Den ufullstendige bindingen: bindingen til høyre for B mangler ett elektron.
          const s = 2 * d.bonds[0];
          slots[s] = 1;
          holes.push({ s, wait: expo(HOP_WAIT), busy: false, age: 1, acc: k });
        }
      });
    }

    const bondFull = (b) => slots[2 * b] === 0 && slots[2 * b + 1] === 0;

    /** Et bindingsbrudd: elektronet glir ut i ruta ved siden av, og plassen blir et hull. */
    function breakBond() {
      for (let tries = 0; tries < 6; tries++) {
        const b = genBonds[Math.floor(rnd() * genBonds.length)];
        if (!bondFull(b)) continue;
        const k = rnd() < 0.5 ? 0 : 1;
        const s = 2 * b + k;
        const p = slotPos(s);
        const dir = k ? 1 : -1;
        const out = b < N ? { x: 0, y: dir * 0.5 * ay } : { x: dir * 0.5 * ax, y: 0 };
        slots[s] = 1;
        const partner = { s, wait: 0.5 + expo(HOP_WAIT), busy: false, age: 0, acc: -1 };
        holes.push(partner);
        // Elektronet kan ikke falle rett tilbake i sitt eget hull det første sekundet.
        elec.push(
          newElectron({ mode: "leave", x: p.x, y: p.y, x0: p.x, y0: p.y, x1: p.x + out.x, y1: p.y + out.y, t: 0, dur: 0.45, partner }),
        );
        flashes.push({ x: p.x, y: p.y, age: 0 });
        return;
      }
    }

    /** Et elektron fra bindingen `nb` hopper rundt atomet `pivot` og inn i hullet h. */
    function startHop(h, nb, pivot) {
      // Prikken på den siden av nabobindingen som vender mot hullet.
      const hp = slotPos(h.s);
      let from = 2 * nb;
      const p0 = slotPos(from);
      const p1 = slotPos(from + 1);
      const d0 = Math.hypot(dX(p0.x - hp.x), dY(p0.y - hp.y));
      const d1 = Math.hypot(dX(p1.x - hp.x), dY(p1.y - hp.y));
      if (d1 < d0) from += 1;
      const fp = slotPos(from);
      const px = atomX(pivot[0]);
      const py = atomY(pivot[1]);
      const rx0 = dX(fp.x - px);
      const ry0 = dY(fp.y - py);
      const rx1 = dX(hp.x - px);
      const ry1 = dY(hp.y - py);
      const th0 = Math.atan2(ry0, rx0);
      let th1 = Math.atan2(ry1, rx1);
      while (th1 - th0 > Math.PI) th1 -= 2 * Math.PI;
      while (th1 - th0 < -Math.PI) th1 += 2 * Math.PI;
      hops.push({ from, to: h.s, px, py, t: 0, th0, r0: Math.hypot(rx0, ry0), th1, r1: Math.hypot(rx1, ry1), hole: h });
      slots[from] = 1;
      slots[h.s] = 2;
      h.s = from;
      h.busy = true;
      h.age = 0;
    }

    /** Kandidatene for et hullhopp: fulle naboer, med vekt og eventuell fangst. */
    function hopTargets(h, filter) {
      const b = h.s >> 1;
      const hp = slotPos(h.s);
      const list = [];
      let near = null;
      let nd = ATTR_R * a;
      for (const e of elec) {
        if (e.mode !== "free") continue;
        const d = Math.hypot(dX(e.x - hp.x), dY(e.y - hp.y));
        if (d < nd) {
          nd = d;
          near = e;
        }
      }
      for (const c of perp[b]) {
        if (!bondFull(c.nb)) continue;
        if (filter && !filter(c)) continue;
        const dk = isDopantBond[c.nb];
        if (dk >= 0 && dopants[dk].kind === "B" && h.acc !== dk) {
          // Et nøytralt B har allerede sitt hull; B⁻ fanger av og til et nytt.
          if (!dopants[dk].ion) continue;
          if (rnd() > holeCapture(temp)) continue;
        }
        let w = 1;
        if (h.acc < 0) {
          const m = bondMid(c.nb);
          if (field) w *= Math.exp(Math.sign(dX(m.x - hp.x)) * BIAS);
          // Tiltrekningen virker begge veier: hullet går helst mot et fritt elektron i nærheten.
          if (near) {
            const before = Math.hypot(dX(near.x - hp.x), dY(near.y - hp.y));
            const after = Math.hypot(dX(near.x - m.x), dY(near.y - m.y));
            w *= Math.exp((HOLE_ATTR * (before - after)) / (0.5 * a));
          }
        }
        list.push({ ...c, w });
      }
      return list;
    }
    function pick(list) {
      let sum = 0;
      for (const c of list) sum += c.w;
      let r = rnd() * sum;
      for (const c of list) if ((r -= c.w) <= 0) return c;
      return list[list.length - 1];
    }

    function hopHole(h, list) {
      if (!list.length) return;
      const c = pick(list);
      const dk = isDopantBond[c.nb];
      if (h.acc >= 0 && dk !== h.acc) {
        dopants[h.acc].ion = true; // hullet forlater boratomet: B⁻
        h.acc = -1;
      } else if (h.acc < 0 && dk >= 0 && dopants[dk].kind === "B") {
        h.acc = dk; // fanget: B er nøytralt igjen
        dopants[dk].ion = false;
        dopants[dk].delay = 0.3;
      }
      startHop(h, c.nb, c.pivot);
    }

    // ── ett tidssteg ────────────────────────────────────────────────────────
    function step(dt) {
      const T = temp;
      const sf = speedOf(T);
      const cap = Math.round((cols * rows) / 3.5);
      const nFree = elec.reduce((s, e) => s + (e.mode === "bound" ? 0 : 1), 0);

      // Bindingsbrudd.
      if (nFree < cap && holes.length < cap) {
        if (scripted > 0 && doping === "ingen" && T >= 250) {
          scripted -= dt;
          if (scripted <= 0) breakBond();
        } else if (rnd() < gen(T) * genBonds.length * dt) breakBond();
      }

      // Donorer og akseptorer.
      for (const d of dopants) {
        if (d.delay > 0) d.delay -= dt;
        d.orbitA += ((d.kind === "P" && !d.ion ? 1 : 0) - d.orbitA) * Math.min(1, dt / 0.25);
      }

      // Hull.
      for (const h of holes) {
        h.age += dt;
        if (h.busy) continue;
        if (h.acc >= 0) {
          const d = dopants[h.acc];
          const B = [d.i, d.j];
          const atB = (c) => c.pivot[0] === ((B[0] + cols) % cols) && c.pivot[1] === ((B[1] + rows) % rows);
          if (d.delay <= 0 && rnd() < release(T) * dt) {
            hopHole(h, hopTargets(h, (c) => !atB(c)));
            continue;
          }
          h.wait -= dt * sf;
          if (h.wait <= 0) {
            h.wait = 0.15 + expo(HOP_WAIT);
            hopHole(h, hopTargets(h, atB));
          }
          continue;
        }
        h.wait -= dt * sf;
        if (h.wait <= 0) {
          h.wait = 0.15 + expo(HOP_WAIT);
          hopHole(h, hopTargets(h));
        }
      }

      // Hopp som er på vei.
      for (const p of hops) {
        p.t += dt / HOP_DUR;
        if (p.t >= 1) {
          slots[p.to] = 0;
          p.hole.busy = false;
        }
      }
      hops = hops.filter((p) => p.t < 1);

      // Elektroner.
      const vth = V0 * a * sf;
      const sig = vth * Math.sqrt(2 / TAU) * Math.sqrt(dt);
      for (const e of elec) {
        if (e.mode === "leave" || e.mode === "fall") {
          e.t += dt / e.dur;
          const k = ease(Math.min(1, e.t));
          e.x = e.x0 + (e.x1 - e.x0) * k;
          e.y = e.y0 + (e.y1 - e.y0) * k;
          if (e.t >= 1 && e.mode === "leave") {
            e.mode = "free";
            const ux = e.x1 - e.x0;
            const uy = e.y1 - e.y0;
            const u = Math.hypot(ux, uy) || 1;
            e.vx = (ux / u) * vth;
            e.vy = (uy / u) * vth;
            e.immune = 0.6;
            e.x = wrapX(e.x);
            e.y = wrapY(e.y);
          }
          continue;
        }
        e.alpha += ((e.mode === "bound" ? BOUND_ALPHA : 1) - e.alpha) * Math.min(1, dt / 0.3);
        if (e.mode === "bound") {
          const d = dopants[e.donor];
          e.phi += OMEGA * sf * dt;
          e.r += (ORBIT * a - e.r) * Math.min(1, dt / 0.35);
          e.x = wrapX(atomX(d.i) + e.r * Math.cos(e.phi));
          e.y = wrapY(atomY(d.j) + e.r * Math.sin(e.phi));
          if (d.delay <= 0 && rnd() < release(T) * dt) {
            // Fritt: fortsetter langs banen og vandrer videre som de andre.
            d.ion = true;
            e.mode = "free";
            e.vx = -Math.sin(e.phi) * vth;
            e.vy = Math.cos(e.phi) * vth;
            e.immune = 0.6;
          }
          continue;
        }

        // Fritt elektron: tilfeldig gange med litt hukommelse, drift i feltet.
        let fx = field ? -(VD * a) / TAU : 0;
        let fy = 0;
        if (e.immune > 0) e.immune -= dt;
        {
          let best = null;
          let bd = ATTR_R * a;
          let bx = 0;
          let by = 0;
          for (const h of holes) {
            if (h.busy || (e.immune > 0 && h === e.partner)) continue;
            const p = slotPos(h.s);
            const rx = dX(p.x - e.x);
            const ry = dY(p.y - e.y);
            const d = Math.hypot(rx, ry);
            if (d < bd) {
              bd = d;
              best = h;
              bx = rx;
              by = ry;
            }
          }
          if (best && bd < CAPT_R * a) {
            fall(e, best, bx, by);
            continue;
          }
          if (best) {
            const f = ATTR_F * a * (1 + 2 * (1 - bd / (ATTR_R * a)));
            fx += (f * bx) / bd;
            fy += (f * by) / bd;
          }
          // Gjenfangst ved P⁺, bare ved lav temperatur.
          for (let k = 0; k < dopants.length && e.immune <= 0; k++) {
            const d = dopants[k];
            if (d.kind !== "P" || !d.ion) continue;
            const rx = dX(e.x - atomX(d.i));
            const ry = dY(e.y - atomY(d.j));
            const r = Math.hypot(rx, ry);
            if (r < ORBIT * a && rnd() < capture(T) * dt) {
              d.ion = false;
              d.delay = 0.4;
              e.mode = "bound";
              e.donor = k;
              e.phi = Math.atan2(ry, rx);
              e.r = r;
              break;
            }
          }
          if (e.mode === "bound") continue;
        }
        e.vx += (-e.vx / TAU + fx) * dt + sig * gauss();
        e.vy += (-e.vy / TAU + fy) * dt + sig * gauss();
        const sp = Math.hypot(e.vx, e.vy);
        const vmax = 3 * V0 * a;
        if (sp > vmax) {
          e.vx *= vmax / sp;
          e.vy *= vmax / sp;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        avoidAtoms(e);
        e.x = wrapX(e.x);
        e.y = wrapY(e.y);
      }
      elec = elec.filter((e) => !(e.mode === "fall" && e.t >= 1 && finishFall(e)));

      for (const f of flashes) f.age += dt;
      flashes = flashes.filter((f) => f.age < FLASH);
    }

    /** Elektronet faller inn i hullet. */
    function fall(e, h, rx, ry) {
      holes = holes.filter((x) => x !== h);
      if (h.acc >= 0) dopants[h.acc].ion = true;
      slots[h.s] = 2;
      e.mode = "fall";
      e.slot = h.s;
      e.t = 0;
      e.dur = 0.22;
      e.x0 = e.x;
      e.y0 = e.y;
      e.x1 = e.x + rx;
      e.y1 = e.y + ry;
    }
    function finishFall(e) {
      slots[e.slot] = 0;
      flashes.push({ x: wrapX(e.x1), y: wrapY(e.y1), age: 0 });
      return true;
    }

    /** Frie elektroner går mellom atomene, ikke gjennom dem. */
    function avoidAtoms(e) {
      const i0 = Math.floor(e.x / ax - 0.5);
      const j0 = Math.floor(e.y / ay - 0.5);
      const rMin = R + 4;
      for (let di = 0; di <= 1; di++)
        for (let dj = 0; dj <= 1; dj++) {
          const cx = atomX(i0 + di);
          const cy = atomY(j0 + dj);
          const rx = e.x - cx;
          const ry = e.y - cy;
          const r = Math.hypot(rx, ry) || 1e-6;
          if (r < rMin) {
            const ux = rx / r;
            const uy = ry / r;
            e.x = cx + ux * rMin;
            e.y = cy + uy * rMin;
            const vr = e.vx * ux + e.vy * uy;
            if (vr < 0) {
              e.vx -= 1.6 * vr * ux;
              e.vy -= 1.6 * vr * uy;
            }
          }
        }
    }

    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

    // ── tegning ─────────────────────────────────────────────────────────────
    const SX = (x) => M + x;
    const SY = (y) => TOP + M + y;

    /**
     * Kalle f(x, y) for hver kopi av punktet som synes i vinduet (periodisk gitter).
     * Gitteret tegnes med marg m = M, så kantbindingene står hele på begge sider.
     * Bærerne tegnes med m = 0 og klippes til én periode: en bærer som krysser
     * kanten, er halvt på hver side, aldri hel på begge, så de kan telles.
     */
    function copies(x, y, r, f, m = M) {
      for (const ox of [0, -Px, Px]) {
        const xx = x + ox;
        if (xx < -m - r || xx > Px + m + r) continue;
        for (const oy of [0, -Py, Py]) {
          const yy = y + oy;
          if (yy < -m - r || yy > Py + m + r) continue;
          f(SX(xx), SY(yy));
        }
      }
    }

    function dot(x, y, r, color, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    function ring(x, y, r, color, lw, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const DOT = 2.6; // bindingselektron
    const FREE = 4.8; // fritt elektron
    const HOLE = 4;

    function freeDot(x, y, r, alpha = 1) {
      // En tynn bakgrunnskant skiller det frie elektronet fra strekene under.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = C.bg;
      ctx.beginPath();
      ctx.arc(x, y, r + 1.6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      dot(x, y, r, C.electron, alpha);
    }
    const holeRing = (x, y, alpha = 1) => ring(x, y, HOLE, C.red, 2.1, alpha);

    function render() {
      ctx.clearRect(0, 0, W, H);

      // Gittervinduet.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, TOP, W, Py + 2 * M);
      ctx.clip();

      // Banen til donorens femte elektron, svak og stiplet.
      for (const d of dopants) {
        if (d.kind !== "P" || d.orbitA < 0.02) continue;
        // Banen ligger innenfor én periode, så den tegnes uten kopier i margen.
        copies(
          atomX(d.i),
          atomY(d.j),
          ORBIT * a,
          (x, y) => {
            ctx.save();
            ctx.setLineDash([3, 4]);
            ring(x, y, ORBIT * a, C.electron, 1.2, 0.55 * d.orbitA);
            ctx.restore();
          },
          0,
        );
      }

      // Bindingene: to streker mellom hvert nabopar.
      ctx.strokeStyle = C.strong;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let b = 0; b < 2 * N; b++) {
        const m = bondMid(b);
        const half = (b < N ? ax : ay) / 2 - R;
        copies(m.x, m.y, b < N ? ax / 2 : ay / 2, (x, y) => {
          if (b < N) {
            ctx.moveTo(x - half, y - gap);
            ctx.lineTo(x + half, y - gap);
            ctx.moveTo(x - half, y + gap);
            ctx.lineTo(x + half, y + gap);
          } else {
            ctx.moveTo(x - gap, y - half);
            ctx.lineTo(x - gap, y + half);
            ctx.moveTo(x + gap, y - half);
            ctx.lineTo(x + gap, y + half);
          }
        });
      }
      ctx.stroke();

      // Atomene.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = SX(atomX(i));
          const y = SY(atomY(j));
          const dk = dopantAt.get(atomIdx(i, j));
          const d = dk === undefined ? null : dopants[dk];
          ctx.fillStyle = C.nested;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = d ? C.fg : C.strong;
          ctx.lineWidth = d ? 1.8 : 1.1;
          ctx.stroke();
          ctx.fillStyle = d ? C.fg : C.muted;
          ctx.font = `${d ? "600 " : ""}11px ${C.mono}`;
          ctx.fillText(d ? d.kind : "Si", x, y + 0.5);
          if (d && d.ion) badge(x + 0.78 * R, y - 0.78 * R, d.kind === "P");
        }

      // Bindingselektronene.
      ctx.fillStyle = C.fg;
      ctx.beginPath();
      for (let s = 0; s < 4 * N; s++) {
        if (slots[s] !== 0) continue;
        const p = slotPos(s);
        copies(p.x, p.y, DOT, (x, y) => {
          ctx.moveTo(x + DOT, y);
          ctx.arc(x, y, DOT, 0, 2 * Math.PI);
        });
      }
      ctx.fill();

      ctx.restore();

      // Bærerne, klippet til én periode.
      ctx.save();
      ctx.beginPath();
      ctx.rect(SX(0), SY(0), Px, Py);
      ctx.clip();

      // Hullene: den tomme plassen der et elektron mangler.
      for (const h of holes) {
        const p = slotPos(h.s);
        const al = Math.min(1, h.age / HOP_DUR);
        copies(p.x, p.y, HOLE, (x, y) => holeRing(x, y, al), 0);
      }

      // Elektroner som hopper fra en binding til hullet ved siden av.
      for (const p of hops) {
        const k = ease(Math.min(1, p.t));
        const tp = slotPos(p.to);
        copies(tp.x, tp.y, HOLE, (x, y) => holeRing(x, y, 1 - k), 0);
        const th = p.th0 + (p.th1 - p.th0) * k;
        const r = p.r0 + (p.r1 - p.r0) * k;
        copies(p.px + r * Math.cos(th), p.py + r * Math.sin(th), DOT, (x, y) => dot(x, y, DOT, C.fg), 0);
      }

      // Frie elektroner, og de som er på vei ut av eller inn i en binding.
      for (const e of elec) {
        if (e.mode === "leave" || e.mode === "fall") {
          const k = ease(Math.min(1, e.t));
          const f = e.mode === "leave" ? k : 1 - k; // 0 = i bindingen, 1 = fritt
          if (e.mode === "fall") {
            const sp = slotPos(e.slot);
            copies(sp.x, sp.y, HOLE, (x, y) => holeRing(x, y, 1 - k), 0);
          }
          const r = DOT + (FREE - DOT) * f;
          copies(
            e.x,
            e.y,
            FREE + 2,
            (x, y) => {
              dot(x, y, r, C.fg, 1 - f);
              freeDot(x, y, r, f);
            },
            0,
          );
          continue;
        }
        // Donorens femte elektron er blekere mens det er bundet, og lysner når det slipper.
        copies(e.x, e.y, FREE + 2, (x, y) => freeDot(x, y, FREE, e.alpha), 0);
      }

      // Et kort blink der en binding brytes eller et elektron faller inn.
      for (const f of flashes) {
        const k = f.age / FLASH;
        copies(f.x, f.y, 16, (x, y) => ring(x, y, 5 + 10 * k, C.fg, 1.4, 0.5 * (1 - k)), 0);
      }
      ctx.restore();

      drawField();
      drawLegend();
    }

    function badge(x, y, plus) {
      ctx.fillStyle = C.fg;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(x - 3.5, y);
      ctx.lineTo(x + 3.5, y);
      if (plus) {
        ctx.moveTo(x, y - 3.5);
        ctx.lineTo(x, y + 3.5);
      }
      ctx.stroke();
    }

    function drawField() {
      if (!field) return;
      const y = TOP / 2 + 1;
      const x0 = W * 0.5 - Math.min(110, W * 0.3);
      const x1 = W * 0.5 + Math.min(110, W * 0.3);
      ctx.strokeStyle = C.accent;
      ctx.fillStyle = C.accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1 - 8, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 - 10, y - 5);
      ctx.lineTo(x1 - 10, y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.font = `16px ${C.mono}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("ℰ", x0 - 8, y);
    }

    function drawLegend() {
      ctx.font = `11px ${C.mono}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const items = LEGEND.map((l) => ({ ...l, w: LEG_ICON + 6 + ctx.measureText(l.text).width }));
      const lines = legendRows === 1 ? [items] : [items.slice(0, 1), items.slice(1)];
      lines.forEach((line, n) => {
        const tw = line.reduce((s, it) => s + it.w, 0) + LEG_GAP * (line.length - 1);
        let x = (W - tw) / 2;
        const y = legendY + 8 + n * 17;
        for (const it of line) {
          const cx = x + LEG_ICON / 2;
          if (it.kind === "bond") dot(cx, y, DOT, C.fg);
          else if (it.kind === "free") freeDot(cx, y, FREE);
          else holeRing(cx, y);
          ctx.fillStyle = C.muted;
          ctx.fillText(it.text, x + LEG_ICON + 6, y + 0.5);
          x += it.w + LEG_GAP;
        }
      });
    }

    // ── løkka ───────────────────────────────────────────────────────────────
    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    function frame(now) {
      raf = 0;
      if (signal.aborted) return;
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000 || 0));
      last = now;
      acc += dt * timeScale;
      let n = 0;
      while (acc >= STEP && n < 8) {
        step(STEP);
        acc -= STEP;
        n++;
      }
      if (n === 8) acc = 0;
      render();
      if (temp > 0 && visible) raf = requestAnimationFrame(frame);
    }
    function start() {
      if (raf || temp === 0 || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
      },
      { threshold: 0 },
    );
    io.observe(canvas);
    signal.addEventListener(
      "abort",
      () => {
        io.disconnect();
        if (raf) cancelAnimationFrame(raf);
      },
      { once: true },
    );

    readTokens();
    sync();
    layout();
    render();
    onResize(() => {
      readTokens();
      layout();
      render();
    });
    start();
  };
}

export default make({ dopingControl: false });
