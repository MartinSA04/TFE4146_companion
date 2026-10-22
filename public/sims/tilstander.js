/**
 * «Tilstander og elektroner» for TFE4146, modul 02.
 *
 * Én idé: elektronene fyller tilstandene etter to regler, og de to reglene
 * alene gir Fermi–Dirac-fordelingen. Regel 1: én elektron per tilstand
 * (Pauli). Regel 2: et hopp som øker energien med ΔE, lykkes med
 * sannsynligheten e^(−ΔE/kT); et hopp nedover lykkes alltid (Metropolis).
 * Det er detaljert balanse med Pauli-blokkering, og likevekten er
 * f(E) = 1/(1 + e^((E − E_F)/kT)) (Streetman & Banerjee §3.3.1, app. V).
 * Hvor E_F står, bestemmes bare av hvor mange elektroner det er.
 *
 * Tegningen er båndbildet som rader av tilstander: én ring per tilstand,
 * radene venstrejustert, så høyrekanten følger N(E) ∝ √(E − E_c)
 * (fig. 3–16 og app. IV). Elektroner er blå prikker, tomme tilstander i
 * valensbåndet (hull) røde ringer. Donorionene ⊕ og akseptorionene ⊖ står i
 * en egen rad under båndbildet: de er faste ladninger, ikke tilstander, og de
 * er alltid ionisert her. (I første utkast sto de på E_d og E_a, der f(E)
 * viste et nesten halvfullt nivå; leketøyet kan ikke vise utfrysning, fordi
 * N_c i tegningen bare er noen titalls tilstander.) Til høyre står
 * n(E) = N(E)f(E) og p(E) = N(E)[1 − f(E)] som lapper, normert til den
 * største (Streetman fig. 3–16), og f(E) sidelengs, alt på den samme
 * energiaksen, med E_F stiplet tvers over.
 *
 * Leketøyet, i energienheter u = kT ved 300 K:
 *  - 12 rader per bånd, 0,5 u fra hverandre, med 5 … 23 tilstander (191 per
 *    bånd). Gapet er 4,5 u, mot 43 kT i silisium; med ekte gap ville
 *    ledningsbåndet vært tomt.
 *  - Symmetriske bånd, så E_i ligger midt i gapet.
 *  - n-type: 6 donorer. p-type: 6 akseptorer. Begge: 6 og 3.
 *  - Analytiske middelverdier (toy.mjs W=24 Eg=4.5 Nd=6 Na=3): ren 300 K
 *    n = p ≈ 1,8; 150 K ≈ 0,1; 600 K ≈ 13. n-type 300 K n ≈ 6,5, p ≈ 0,5,
 *    E_F 0,86 u under E_c; 600 K n ≈ 16, p ≈ 10. Begge 300 K n ≈ 3,8,
 *    p ≈ 0,8, E_F 0,81 u over E_i (n-type: 1,39 u).
 *  - Dopingen er mye tyngre målt mot N_c enn i silisium, så E_F står nær
 *    båndkanten, og under omtrent 200 K går den inn i båndet.
 *
 * Dynamikk (Monte Carlo, kanonisk, så n − p = N_d − N_a til enhver tid):
 *  - Hvert elektron i ledningsbåndet og hvert hull i valensbåndet prøver et
 *    hopp med raten A til en tilfeldig tilstand i samme bånd. Forslaget er
 *    symmetrisk, så detaljert balanse holder.
 *  - Over gapet: RX par (tilfeldig tilstand i VB, tilfeldig i CB) per sekund.
 *    Fylt VB og tom CB: elektronet hopper opp med e^(−ΔE/kT) (generasjon).
 *    Tom VB og fylt CB: elektronet faller ned (rekombinasjon). Raten for
 *    rekombinasjon blir dermed ∝ n·p, og generasjonen avhenger bare av T.
 *    RX skaleres med T så generasjonen holder seg på noen få hopp i sekundet;
 *    likevekten avhenger ikke av RX.
 *  - Ved bytte av doping eller temperatur glødes tilstanden ut med mange
 *    stille steg, så bildet står i likevekt med en gang.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const ROWS = 12;
const DE = 0.5; // u mellom radene
const EG = 4.5; // u
const WMAX = 24;
const EC = EG / 2;
const EV = -EG / 2;
const WIDTHS = Array.from({ length: ROWS }, (_, j) =>
  Math.max(1, Math.round(WMAX * Math.sqrt((j + 0.5) / ROWS))),
);
const NB = WIDTHS.reduce((a, b) => a + b, 0); // tilstander per bånd

const DOPINGS = [
  { key: "ren", label: "Ren", nd: 0, na: 0 },
  { key: "n", label: "n-type", nd: 6, na: 0 },
  { key: "p", label: "p-type", nd: 0, na: 6 },
  { key: "begge", label: "Donorer og akseptorer", nd: 6, na: 3 },
];

const T_MIN = 150;
const T_MAX = 600;
const A_HOP = 1.4; // forsøk per bærer per sekund, før demping ved mange bærere
const G300 = 0.8; // generasjoner per sekund ved 300 K i tegningen
const DUR_IN = 0.24; // s, et hopp inne i et bånd
const DUR_X = 0.5; // s, et hopp over gapet

// Tilstandene: indeks 0 … NB−1 er valensbåndet, NB … 2NB−1 ledningsbåndet.
const S = 2 * NB;
const sE = new Float64Array(S);
const sRow = new Int16Array(S);
const sCol = new Int16Array(S);
{
  let s = 0;
  for (const cb of [false, true])
    for (let j = 0; j < ROWS; j++)
      for (let c = 0; c < WIDTHS[j]; c++, s++) {
        sE[s] = cb ? EC + DE * (j + 0.5) : EV - DE * (j + 0.5);
        sRow[s] = j;
        sCol[s] = c;
      }
}
const isCB = (s) => s >= NB;

const fermi = (E, ef, kT) => 1 / (1 + Math.exp((E - ef) / kT));

/** n og p for et gitt E_F, summert over radene. */
function carriers(ef, kT) {
  let n = 0;
  let p = 0;
  for (let j = 0; j < ROWS; j++) {
    n += WIDTHS[j] * fermi(EC + DE * (j + 0.5), ef, kT);
    p += WIDTHS[j] * (1 - fermi(EV - DE * (j + 0.5), ef, kT));
  }
  return [n, p];
}

/** E_F som gir n − p = net (nøytralitet med ioniserte dopeatomer). */
function solveEF(net, kT) {
  let lo = EV - 8;
  let hi = EC + 8;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    const [n, p] = carriers(m, kT);
    if (n - p > net) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

const rnd = (k) => Math.floor(Math.random() * k);

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let temp = 300;
  let doping = "ren";
  const dop = () => DOPINGS.find((d) => d.key === doping);
  const kT = () => temp / 300;
  let ef = 0;

  const occ = new Uint8Array(S);
  const busy = new Uint8Array(S); // tilstander i et pågående hopp
  const pend = new Uint8Array(S); // målet for et hopp som ikke er framme ennå
  let moves = []; // { from, to, t0, dur }
  let clock = 0;

  // ── kontroller ──────────────────────────────────────────────────────────
  const tLabel = document.createElement("label");
  tLabel.append("Temperatur ");
  const tOut = document.createElement("output");
  const tIn = document.createElement("input");
  tIn.type = "range";
  tIn.min = String(T_MIN);
  tIn.max = String(T_MAX);
  tIn.step = "10";
  tIn.value = String(temp);
  tIn.setAttribute("aria-label", "Temperatur i kelvin");
  tLabel.append(tOut, tIn);
  tIn.addEventListener(
    "input",
    () => {
      temp = Number(tIn.value);
      changed();
    },
    { signal },
  );

  const dopPick = choiceRow({
    ariaLabel: "Doping",
    items: DOPINGS.map((d) => ({ value: d.key, label: d.label })),
    onPick: (k) => {
      doping = k;
      changed();
    },
    signal,
  });

  controls.append(tLabel, dopPick.el);

  function sync() {
    tOut.textContent = `${temp} K`;
    dopPick.sync(doping);
  }

  // ── Monte Carlo ─────────────────────────────────────────────────────────
  const metro = (dE, t) => dE <= 0 || Math.random() < Math.exp(-dE / t);

  /** Stille steg uten animasjon, til tilstanden står i likevekt. */
  function anneal(iters) {
    const t = kT();
    for (let i = 0; i < iters; i++) {
      // inne i ledningsbåndet
      let a = NB + rnd(NB);
      let b = NB + rnd(NB);
      if (occ[a] && !occ[b] && metro(sE[b] - sE[a], t)) {
        occ[a] = 0;
        occ[b] = 1;
      }
      // inne i valensbåndet
      a = rnd(NB);
      b = rnd(NB);
      if (occ[a] && !occ[b] && metro(sE[b] - sE[a], t)) {
        occ[a] = 0;
        occ[b] = 1;
      }
      // over gapet
      const v = rnd(NB);
      const c = NB + rnd(NB);
      if (occ[v] && !occ[c]) {
        if (metro(sE[c] - sE[v], t)) {
          occ[v] = 0;
          occ[c] = 1;
        }
      } else if (!occ[v] && occ[c]) {
        occ[v] = 1;
        occ[c] = 0;
      }
    }
  }

  /** Riktig antall elektroner for dopingen, plassert etter f, og så glødet ut. */
  function equilibrate(iters) {
    moves = [];
    busy.fill(0);
    pend.fill(0);
    const d = dop();
    const t = kT();
    ef = solveEF(d.nd - d.na, t);
    const want = NB + d.nd - d.na;
    let have = 0;
    for (let s = 0; s < S; s++) have += occ[s];
    // Legg til eller ta bort elektroner der f sier de hører hjemme.
    while (have !== want) {
      const s = rnd(S);
      const f = fermi(sE[s], ef, t);
      if (have < want && !occ[s] && Math.random() < f) {
        occ[s] = 1;
        have++;
      } else if (have > want && occ[s] && Math.random() < 1 - f) {
        occ[s] = 0;
        have--;
      }
    }
    anneal(iters);
  }

  /** n_i i leketøyet, for å skalere raten over gapet. */
  const niToy = (t) => carriers(solveEF(0, t), t)[0];
  let rx = 0;
  function setRates() {
    const t = kT();
    const ni2 = niToy(t) ** 2;
    const ni2ref = niToy(1) ** 2;
    const g = G300 * Math.pow(ni2 / ni2ref, 0.35);
    rx = (g * NB * NB) / Math.max(ni2, 1e-9);
  }

  function startMove(from, to) {
    occ[from] = 0;
    occ[to] = 1;
    busy[from] = 1;
    busy[to] = 1;
    pend[to] = 1;
    const cross = isCB(from) !== isCB(to);
    moves.push({ from, to, t0: clock, dur: cross ? DUR_X : DUR_IN });
  }

  function step(dt) {
    const t = kT();
    // Bærerne nå.
    const elec = [];
    const holes = [];
    for (let s = NB; s < S; s++) if (occ[s] && !busy[s]) elec.push(s);
    for (let s = 0; s < NB; s++) if (!occ[s] && !busy[s]) holes.push(s);
    const a = A_HOP * Math.min(1, 12 / (elec.length + holes.length + 1));
    for (const s of elec) {
      if (Math.random() >= a * dt) continue;
      const b = NB + rnd(NB);
      if (!occ[b] && !busy[b] && metro(sE[b] - sE[s], t)) startMove(s, b);
    }
    for (const h of holes) {
      if (Math.random() >= a * dt) continue;
      const b = rnd(NB); // elektronet i b hopper inn i hullet h
      if (occ[b] && !busy[b] && metro(sE[h] - sE[b], t)) startMove(b, h);
    }
    // Over gapet: et Poisson-antall parforslag.
    let k = 0;
    const lam = rx * dt;
    if (lam > 30) k = Math.round(lam + Math.sqrt(lam) * gauss());
    else {
      const L = Math.exp(-lam);
      let p = Math.random();
      while (p > L) {
        k++;
        p *= Math.random();
      }
    }
    for (let i = 0; i < k; i++) {
      const v = rnd(NB);
      const c = NB + rnd(NB);
      if (busy[v] || busy[c]) continue;
      if (occ[v] && !occ[c]) {
        if (metro(sE[c] - sE[v], t)) startMove(v, c);
      } else if (!occ[v] && occ[c]) startMove(c, v);
    }
    // Hopp som er framme.
    const still = [];
    for (const m of moves) {
      if (clock - m.t0 >= m.dur) {
        busy[m.from] = 0;
        busy[m.to] = 0;
        pend[m.to] = 0;
      } else still.push(m);
    }
    moves = still;
  }

  function gauss() {
    return Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  let G = null; // geometri fra siste layout
  let svgEl = null;
  let dynEl = null;

  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 240) return null;
    const top = 22;
    const bot = 44; // f-merkene og raden med ioner
    const pitchY = (h - top - bot) / (2 * ROWS + EG / DE);
    const yOf = (E) => top + (ROWS + EG / DE / 2) * pitchY - (E / DE) * pitchY;
    const labW = 20; // E_c, E_v, E_i til venstre
    const efW = 4; // E_F står inne i f-feltet, over linjen
    const lw = Math.max(30, Math.min(90, w * 0.12)); // n(E) og p(E)
    const fw = Math.max(44, Math.min(100, w * 0.16));
    const gapF = 8;
    const avail = w - labW - efW - lw - fw - 2 * gapF - 4;
    const pitchX = Math.min(14, avail / WMAX);
    const groupW = labW + pitchX * WMAX + 2 * gapF + lw + fw + efW;
    const x0 = Math.max(2, (w - groupW) / 2);
    const rx0 = x0 + labW;
    const lx0 = rx0 + pitchX * WMAX + gapF;
    const lx1 = lx0 + lw;
    const fx0 = lx1 + gapF;
    const fx1 = fx0 + fw;
    const r = Math.max(2, Math.min(3.6, pitchX * 0.36, pitchY * 0.3));
    const pos = (s) => [rx0 + (sCol[s] + 0.5) * pitchX, yOf(sE[s])];
    return { w, h, top, bot, pitchY, pitchX, yOf, x0, rx0, lx0, lx1, fx0, fx1, r, pos };
  }

  function staticLayer(g) {
    const { yOf, rx0, lx0, lx1, fx0, fx1, pitchX, pitchY, r, top, h, bot, x0 } = g;
    const d = dop();
    let s = "";
    // Båndene som svakt tonede flater som følger radene.
    for (const cb of [false, true]) {
      let path = "";
      const edge = cb ? EC : EV;
      const sign = cb ? 1 : -1;
      path += `M ${P(rx0 - 3)} ${P(yOf(edge))}`;
      for (let j = 0; j < ROWS; j++) {
        const xr = rx0 + WIDTHS[j] * pitchX + 1;
        const ya = yOf(edge + sign * DE * j);
        const yb = yOf(edge + sign * DE * (j + 1));
        path += ` H ${P(xr)} V ${P(yb)}`;
        void ya;
      }
      path += ` H ${P(rx0 - 3)} Z`;
      s += `<path d="${path}" style="fill:var(--border)" opacity="0.35"/>`;
    }
    // Båndkantene og E_i.
    const xe = rx0 + WIDTHS[ROWS - 1] * pitchX + 2;
    s +=
      `<path d="M ${P(rx0 - 3)} ${P(yOf(EC))} H ${P(xe)} M ${P(rx0 - 3)} ${P(yOf(EV))} H ${P(xe)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="M ${P(rx0 - 3)} ${P(yOf(0))} H ${P(fx1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="1.5 3"/>` +
      tag(x0 + 2, yOf(EC) + 4, sub("E", "c")) +
      tag(x0 + 2, yOf(EV) + 4, sub("E", "v")) +
      tag(x0 + 2, yOf(0) + 4, sub("E", "i"));
    // Alle tilstandene som tomme ringer.
    let rings = "";
    for (let k = 0; k < S; k++) {
      const [x, y] = g.pos(k);
      rings += `<circle cx="${P(x)}" cy="${P(y)}" r="${P(r)}"/>`;
    }
    s += `<g fill="none" stroke="var(--border-strong)" stroke-width="0.9" opacity="0.8">${rings}</g>`;
    // Ionene står fast i krystallen og er ikke tilstander, så de står i en egen rad
    // under båndbildet, utenfor energiaksen: donorionene først, så akseptorionene.
    const ri = 4.2;
    const step = 2 * ri + 6;
    const yIon = h - 9;
    const ion = (n, start, plus) => {
      let out = "";
      for (let i = 0; i < n; i++) {
        const x = rx0 + ri + 1 + (start + i) * step;
        const y = yIon;
        out +=
          `<circle cx="${P(x)}" cy="${P(y)}" r="${P(ri)}" fill="var(--canvas-bg)" stroke="var(--orange)" stroke-width="1.3"/>` +
          `<path d="M ${P(x - ri + 1.6)} ${P(y)} H ${P(x + ri - 1.6)}${plus ? ` M ${P(x)} ${P(y - ri + 1.6)} V ${P(y + ri - 1.6)}` : ""}" stroke="var(--orange)" stroke-width="1.3"/>`;
      }
      return out;
    };
    if (d.nd) s += ion(d.nd, 0, true);
    if (d.na) s += ion(d.na, d.nd ? d.nd + 0.5 : 0, false);
    const nIon = d.nd + d.na + (d.nd && d.na ? 0.5 : 0);
    if (nIon) {
      const what = d.nd && d.na ? "faste ioner" : d.nd ? "donorioner" : "akseptorioner";
      s += tag(rx0 + nIon * step + 4, yIon + 4, what);
    }
    // f(E) sidelengs: aksen ved f = 0, stiplet ved f = 1, kurven og E_F.
    const yT = top - 6;
    const yB = h - bot + 4;
    const t = kT();
    const fX = (f) => fx0 + f * (fx1 - fx0);
    s +=
      `<path d="M ${P(fx0)} ${P(yT)} V ${P(yB)} H ${P(fx1)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(fX(0.5))} ${P(yT)} V ${P(yB)} M ${P(fx1)} ${P(yT)} V ${P(yB)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"/>` +
      tag(fx0, yB + 13, "0", "middle") +
      tag(fX(0.5), yB + 13, "½", "middle") +
      tag(fx1, yB + 13, "1", "middle") +
      tag((fx0 + fx1) / 2, yT - 4, "f(E)", "middle", "var(--fg)", ";font-style:italic");
    let curve = "";
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const y = yT + ((yB - yT) * i) / n;
      // Energien i y, invers av yOf.
      const E = ((g.yOf(0) - y) / pitchY) * DE;
      curve += `${i ? "L" : "M"} ${P(fX(fermi(E, ef, t)))} ${P(y)} `;
    }
    s += `<path d="${curve}" fill="none" stroke="var(--fg)" stroke-width="1.8"/>`;
    // n(E) = N(E)f(E) og p(E) = N(E)[1 − f(E)], normert til den største lappen.
    // N(E) følger radene: W·√((E − E_c)/(ROWS·DE)).
    const span = ROWS * DE;
    const lobe = (E, cb) => {
      const x = cb ? E - EC : EV - E;
      if (x <= 0 || x > span) return 0;
      const N = Math.sqrt(x / span);
      const fe = fermi(E, ef, t);
      return N * (cb ? fe : 1 - fe);
    };
    let gmax = 1e-12;
    const M = 90;
    for (let i = 1; i <= M; i++) {
      const x = (span * i) / M;
      gmax = Math.max(gmax, lobe(EC + x, true), lobe(EV - x, false));
    }
    const lobePath = (cb) => {
      const edge = cb ? EC : EV;
      const sgn = cb ? 1 : -1;
      let d = `M ${P(lx0)} ${P(yOf(edge))}`;
      for (let i = 1; i <= M; i++) {
        const E = edge + (sgn * span * i) / M;
        d += ` L ${P(lx0 + (lw0 * lobe(E, cb)) / gmax)} ${P(yOf(E))}`;
      }
      return d + ` L ${P(lx0)} ${P(yOf(edge + sgn * span))} Z`;
    };
    const lw0 = lx1 - lx0;
    s +=
      `<path d="M ${P(lx0)} ${P(yT)} V ${P(yB)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="${lobePath(true)}" style="fill:var(--indigo)" fill-opacity="0.3" stroke="var(--indigo)" stroke-width="1.4"/>` +
      `<path d="${lobePath(false)}" style="fill:var(--red)" fill-opacity="0.25" stroke="var(--red)" stroke-width="1.4"/>` +
      tag(lx0 + 2, yT - 4, "n(E)", "start", "var(--indigo)", ";font-style:italic") +
      tag(lx0 + 2, yB + 13, "p(E)", "start", "var(--red)", ";font-style:italic");
    // E_F tvers over, fra båndene til etiketten bak f-panelet.
    const yF = yOf(ef);
    s +=
      `<path d="M ${P(rx0 - 3)} ${P(yF)} H ${P(fx1)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      `<circle cx="${P(fX(0.5))}" cy="${P(yF)}" r="3" style="fill:var(--accent)"/>` +
      tag(fx1 - 2, yF - 5, sub("E", "F"), "end", "var(--accent)", ';paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px');
    return s;
  }

  function dynLayer(g) {
    const { r, pos } = g;
    let dots = "";
    let holes = "";
    for (let s = 0; s < S; s++) {
      const [x, y] = pos(s);
      if (occ[s] && !pend[s]) dots += `<circle cx="${P(x)}" cy="${P(y)}" r="${P(r + 0.5)}"/>`;
      else if (!isCB(s) && (!occ[s] || pend[s]))
        holes += `<circle cx="${P(x)}" cy="${P(y)}" r="${P(r + 0.3)}"/>`;
    }
    let mv = "";
    for (const m of moves) {
      const u = Math.min(1, (clock - m.t0) / m.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      const [x0, y0] = pos(m.from);
      const [x1, y1] = pos(m.to);
      mv += `<circle cx="${P(x0 + (x1 - x0) * e)}" cy="${P(y0 + (y1 - y0) * e)}" r="${P(r + 0.5)}"/>`;
    }
    return (
      `<g fill="var(--canvas-bg)" stroke="var(--red)" stroke-width="1.6">${holes}</g>` +
      `<g style="fill:var(--indigo)">${dots}${mv}</g>`
    );
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      staticLayer(G) +
      `<g data-dyn>${dynLayer(G)}</g></svg>`;
    svgEl = stage.firstElementChild;
    dynEl = svgEl.querySelector("[data-dyn]");
  }

  function renderDyn() {
    if (!G || !dynEl) return render();
    dynEl.innerHTML = dynLayer(G);
  }

  function changed() {
    sync();
    equilibrate(90000);
    setRates();
    render();
    start();
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    clock += dt;
    step(dt);
    renderDyn();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || reduce.matches) return;
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
  io.observe(stage);
  reduce.addEventListener("change", () => (reduce.matches ? null : start()), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );

  // Start: valensbåndet fullt, ledningsbåndet tomt, så glødet ut ved 300 K.
  for (let s = 0; s < NB; s++) occ[s] = 1;
  sync();
  equilibrate(120000);
  setRates();
  onResize(render);
  render();
}
