/**
 * «Bånd under lys» for TFE4146, modul 04.
 *
 * Én idé: inne i et bånd bytter elektronene energi med gitteret i hver
 * kollisjon, så de fordeler seg raskt, mens et elektron og et hull møtes
 * sjelden over gapet. Under lys får derfor hvert bånd sin egen Fermi–Dirac-
 * fordeling, med sitt eget nivå: F_n i ledningsbåndet og F_p i valensbåndet
 * (Streetman & Banerjee §4.3.3). Minoritetsnivået flytter seg langt,
 * majoritetsnivået nesten ikke.
 *
 * Tegningen er det samme båndbildet som i modul 02: én ring per tilstand,
 * radene venstrejustert så høyrekanten følger N(E) ∝ √(E − E_c), elektroner
 * som blå prikker, hull som røde ringer, de faste ionene i en rad under
 * båndene og f(E) sidelengs til høyre på den samme energiaksen. Nytt her:
 * fotoner som gule bølgepiler. Et foton løfter et elektron fra toppen av
 * valensbåndet til en tilstand høyt i ledningsbåndet (hν > E_g), og derfra
 * hopper elektronet ned mot bunnen av båndet, mens hullet det etterlot,
 * flyter opp mot toppen av valensbåndet.
 *
 * Leketøyet, i energienheter u = k_BT ved 300 K:
 *  - 12 rader per bånd, 0,5 u fra hverandre, 5 … 23 tilstander (191 per bånd),
 *    gapet 4,5 u og E_i midt i gapet, som i modul 02.
 *  - n-type: 10 donorer, n₀ ≈ 10,3 og p₀ ≈ 0,27, E_F 0,32 u under E_c.
 *    p-type: speilvendt.
 *  - Bærerpar som lages av varme, er ikke med i dynamikken: i likevekt er
 *    valensbåndet fullt (n-type), og p₀ står bare i nivåberegningen. Det er
 *    riktig i størrelsesorden for silisium, der p₀ er ti milliarder ganger
 *    mindre enn n₀.
 *  - Inne i et bånd: hver bærer prøver A_HOP hopp per sekund til en tilfeldig
 *    tilstand i samme bånd, med Metropolis-regelen (et hopp opp med ΔE lykkes
 *    med e^(−ΔE/k_BT)). Over gapet: rekombinasjon med raten a_r·n·p, så hvert
 *    hull i n-type lever τ_p = 1/(a_r n₀) ≈ 5 s. Fordelingen i båndet blir
 *    altså ferdig mange ganger raskere enn overskuddet dør ut, som i ekte
 *    silisium (pikosekunder mot mikrosekunder), men forholdet er ikke i skala.
 *  - Lys: et foton hvert 1/G sekund (jevnt lys) eller 5 på en gang (glimt).
 *    Jevnt lys gir δp ≈ G·τ_p ≈ 2, altså p omtrent 8 ganger p₀ og n bare 20 %
 *    over n₀.
 *  - Nivåene: n = n₀ + δ̄ og p = p₀ + δ̄, der δ̄ er overskuddet glattet over
 *    EMA_T sekunder, og F_n og F_p er løst slik at radenes tilstander med
 *    f(E) gir n og p. Uten overskudd står én linje, E_F.
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
const ND = 10; // dopeatomer

const A_HOP = 6; // hoppforsøk per bærer per sekund inne i et bånd
const A_R = 1 / 50; // rekombinasjon: raten er A_R·n·p per sekund
const G_STEADY = 0.4; // fotoner per sekund i jevnt lys
const N_FLASH = 5; // fotoner i et glimt
const PH_ROWS = 10; // radene i valensbåndet + ledningsbåndet fotonet spenner over
const DUR_IN = 0.16; // s, et hopp inne i et bånd
const DUR_X = 0.45; // s, et hopp over gapet
const EMA_T = 1.5; // s, glatting av overskuddet for nivåene

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

const fermi = (E, ef) => 1 / (1 + Math.exp(E - ef)); // k_BT = 1 u

function nOf(ef) {
  let n = 0;
  for (let j = 0; j < ROWS; j++) n += WIDTHS[j] * fermi(EC + DE * (j + 0.5), ef);
  return n;
}
function pOf(ef) {
  let p = 0;
  for (let j = 0; j < ROWS; j++) p += WIDTHS[j] * (1 - fermi(EV - DE * (j + 0.5), ef));
  return p;
}
/** Nivået som gir n elektroner i ledningsbåndet (nOf vokser med nivået). */
function levelForN(n) {
  let lo = EV - 12;
  let hi = EC + 12;
  for (let i = 0; i < 70; i++) {
    const m = (lo + hi) / 2;
    if (nOf(m) > n) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
/** Nivået som gir p hull i valensbåndet (pOf minker med nivået). */
function levelForP(p) {
  let lo = EV - 12;
  let hi = EC + 12;
  for (let i = 0; i < 70; i++) {
    const m = (lo + hi) / 2;
    if (pOf(m) > p) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/** E_F i likevekt med ND ioniserte dopeatomer, fortegn etter typen. */
function solveEF(net) {
  let lo = EV - 12;
  let hi = EC + 12;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (nOf(m) - pOf(m) > net) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

const rnd = (k) => Math.floor(Math.random() * k);

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let doping = "n";
  let light = "av";
  let ef = 0;
  let n0 = 0;
  let p0 = 0;

  const occ = new Uint8Array(S);
  const busy = new Uint8Array(S); // tilstander i et pågående hopp
  const pend = new Uint8Array(S); // målet for et hopp som ikke er framme ennå
  let moves = []; // { from, to, t0, dur }
  let photons = []; // { s, t0 } der s er tilstanden fotonet treffer
  let queue = 0; // fotoner fra et glimt som ikke er tegnet ennå
  let nextFlashPhoton = 0;
  let clock = 0;
  let nextPhoton = 0;
  let excess = 0; // glattet overskudd δ̄

  // ── kontroller ──────────────────────────────────────────────────────────
  const lightPick = choiceRow({
    ariaLabel: "Lys",
    label: "Lys",
    items: [
      { value: "av", label: "Av" },
      { value: "jevnt", label: "Jevnt lys" },
    ],
    onPick: (k) => {
      light = k;
      if (k === "jevnt") nextPhoton = clock + 0.2;
      sync();
      if (reduce.matches) fastForward(14);
      start();
    },
    signal,
  });
  const flashBtn = document.createElement("button");
  flashBtn.type = "button";
  flashBtn.className = "sim-btn";
  flashBtn.textContent = "Lysglimt";
  flashBtn.addEventListener(
    "click",
    () => {
      queue += N_FLASH;
      nextFlashPhoton = clock;
      if (reduce.matches) fastForward(1.2);
      start();
    },
    { signal },
  );
  const dopPick = choiceRow({
    ariaLabel: "Doping",
    label: "Doping",
    items: [
      { value: "n", label: "n-type" },
      { value: "p", label: "p-type" },
    ],
    onPick: (k) => {
      doping = k;
      equilibrate();
      sync();
      render();
      start();
    },
    signal,
  });
  controls.append(lightPick.el, flashBtn, dopPick.el);

  function sync() {
    lightPick.sync(light);
    dopPick.sync(doping);
  }

  // ── tilstanden ──────────────────────────────────────────────────────────
  const metro = (dE) => dE <= 0 || Math.random() < Math.exp(-dE);

  /** Likevekt uten lys: majoriteten fordelt etter f, minoriteten tom. */
  function equilibrate() {
    moves = [];
    photons = [];
    queue = 0;
    excess = 0;
    busy.fill(0);
    pend.fill(0);
    ef = solveEF(doping === "n" ? ND : -ND);
    n0 = nOf(ef);
    p0 = pOf(ef);
    occ.fill(0);
    for (let s = 0; s < NB; s++) occ[s] = 1; // valensbåndet fullt
    // n-type: ND elektroner i ledningsbåndet; p-type: ND hull i valensbåndet.
    const place = (cb, count) => {
      let k = 0;
      while (k < count) {
        const s = cb ? NB + rnd(NB) : rnd(NB);
        const want = cb ? !occ[s] : occ[s];
        const f = fermi(sE[s], ef);
        if (want && Math.random() < (cb ? f : 1 - f) * 4) {
          occ[s] = cb ? 1 : 0;
          k++;
        }
      }
    };
    place(doping === "n", ND);
    // Stille hopp inne i båndene til fordelingen har satt seg.
    for (let i = 0; i < 40000; i++) {
      const cb = i % 2 === 0;
      const a = cb ? NB + rnd(NB) : rnd(NB);
      const b = cb ? NB + rnd(NB) : rnd(NB);
      if (occ[a] && !occ[b] && metro(sE[b] - sE[a])) {
        occ[a] = 0;
        occ[b] = 1;
      }
    }
  }

  function startMove(from, to, animate) {
    occ[from] = 0;
    occ[to] = 1;
    if (!animate) return;
    busy[from] = 1;
    busy[to] = 1;
    pend[to] = 1;
    const cross = isCB(from) !== isCB(to);
    moves.push({ from, to, t0: clock, dur: cross ? DUR_X : DUR_IN });
  }

  /** Et foton løfter et elektron fra toppen av valensbåndet høyt opp i ledningsbåndet. */
  function absorb(animate) {
    for (let tries = 0; tries < 60; tries++) {
      const jv = rnd(3);
      const jc = PH_ROWS - jv;
      const v = startOfRow(false, jv) + rnd(WIDTHS[jv]);
      const c = startOfRow(true, jc) + rnd(WIDTHS[jc]);
      if (!occ[v] || occ[c] || busy[v] || busy[c]) continue;
      if (animate) photons.push({ s: v, t0: clock });
      startMove(v, c, animate);
      return true;
    }
    return false;
  }

  function startOfRow(cb, j) {
    let s = cb ? NB : 0;
    for (let k = 0; k < j; k++) s += WIDTHS[k];
    return s;
  }

  function step(dt, animate) {
    // Bærerne nå.
    const elec = [];
    const holes = [];
    for (let s = NB; s < S; s++) if (occ[s] && !busy[s]) elec.push(s);
    for (let s = 0; s < NB; s++) if (!occ[s] && !busy[s]) holes.push(s);
    // Inne i båndene.
    for (const s of elec) {
      if (Math.random() >= A_HOP * dt) continue;
      const b = NB + rnd(NB);
      if (!occ[b] && !busy[b] && metro(sE[b] - sE[s])) startMove(s, b, animate);
    }
    for (const h of holes) {
      if (Math.random() >= A_HOP * dt) continue;
      const b = rnd(NB); // elektronet i b hopper inn i hullet h
      if (occ[b] && !busy[b] && metro(sE[h] - sE[b])) startMove(b, h, animate);
    }
    // Over gapet: rekombinasjon med raten A_R·n·p.
    let nC = 0;
    let pV = 0;
    for (let s = NB; s < S; s++) nC += occ[s];
    for (let s = 0; s < NB; s++) pV += 1 - occ[s];
    const lam = A_R * nC * pV * dt;
    let k = Math.random() < lam - Math.floor(lam) ? Math.ceil(lam) : Math.floor(lam);
    while (k-- > 0) {
      const e = [];
      const h = [];
      for (let s = NB; s < S; s++) if (occ[s] && !busy[s]) e.push(s);
      for (let s = 0; s < NB; s++) if (!occ[s] && !busy[s]) h.push(s);
      if (!e.length || !h.length) break;
      startMove(e[rnd(e.length)], h[rnd(h.length)], animate);
    }
    // Lys.
    if (light === "jevnt" && clock >= nextPhoton) {
      if (absorb(animate)) nextPhoton = clock + (-Math.log(Math.random() || 1e-9)) / G_STEADY;
      else nextPhoton = clock + 0.1;
    }
    if (queue > 0 && clock >= nextFlashPhoton) {
      if (absorb(animate)) queue--;
      nextFlashPhoton = clock + 0.05;
    }
    // Overskuddet: minoriteten (som er null i likevekt i leketøyet).
    let nNow = 0;
    let pNow = 0;
    for (let s = NB; s < S; s++) nNow += occ[s];
    for (let s = 0; s < NB; s++) pNow += 1 - occ[s];
    const d = doping === "n" ? pNow : nNow;
    excess += (d - excess) * (1 - Math.exp(-dt / EMA_T));
    // Hopp og fotoner som er ferdige.
    const still = [];
    for (const m of moves) {
      if (clock - m.t0 >= m.dur) {
        busy[m.from] = 0;
        busy[m.to] = 0;
        pend[m.to] = 0;
      } else still.push(m);
    }
    moves = still;
    photons = photons.filter((p) => clock - p.t0 < 0.7);
  }

  /** Uten animasjon: kjør tiden fram så bildet står i det stasjonære bildet. */
  function fastForward(secs) {
    const dt = 0.02;
    for (let t = 0; t < secs; t += dt) {
      clock += dt;
      step(dt, false);
    }
    moves = [];
    photons = [];
    busy.fill(0);
    pend.fill(0);
    render();
  }

  function levels() {
    if (excess < 0.03) return { split: false, fn: ef, fp: ef };
    return { split: true, fn: levelForN(n0 + excess), fp: levelForP(p0 + excess) };
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const HALO = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";

  let G = null;
  let dynEl = null;
  let lvEl = null;

  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 240) return null;
    const top = 26;
    const bot = 40; // f-merkene og raden med ioner
    const pitchY = (h - top - bot) / (2 * ROWS + EG / DE);
    const yOf = (E) => top + (ROWS + EG / DE / 2) * pitchY - (E / DE) * pitchY;
    const labW = 22;
    const fw = Math.max(48, Math.min(110, w * 0.2));
    const gapF = 12;
    const lblW = 22; // F_n, F_p, E_F til høyre for f-feltet
    const avail = w - labW - fw - gapF - lblW - 6;
    const pitchX = Math.min(15, avail / WMAX);
    const groupW = labW + pitchX * WMAX + gapF + fw + lblW;
    const x0 = Math.max(2, (w - groupW) / 2);
    const rx0 = x0 + labW;
    const fx0 = rx0 + pitchX * WMAX + gapF;
    const fx1 = fx0 + fw;
    const r = Math.max(2, Math.min(3.6, pitchX * 0.36, pitchY * 0.3));
    const pos = (s) => [rx0 + (sCol[s] + 0.5) * pitchX, yOf(sE[s])];
    return { w, h, top, bot, pitchY, pitchX, yOf, x0, rx0, fx0, fx1, r, pos };
  }

  function staticLayer(g) {
    const { yOf, rx0, fx0, fx1, pitchX, r, top, h, bot, x0 } = g;
    let s = "";
    for (const cb of [false, true]) {
      let path = "";
      const edge = cb ? EC : EV;
      const sign = cb ? 1 : -1;
      path += `M ${P(rx0 - 3)} ${P(yOf(edge))}`;
      for (let j = 0; j < ROWS; j++) {
        const xr = rx0 + WIDTHS[j] * pitchX + 1;
        const yb = yOf(edge + sign * DE * (j + 1));
        path += ` H ${P(xr)} V ${P(yb)}`;
      }
      path += ` H ${P(rx0 - 3)} Z`;
      s += `<path d="${path}" style="fill:var(--border)" opacity="0.35"/>`;
    }
    const xe = rx0 + WIDTHS[ROWS - 1] * pitchX + 2;
    s +=
      `<path d="M ${P(rx0 - 3)} ${P(yOf(EC))} H ${P(xe)} M ${P(rx0 - 3)} ${P(yOf(EV))} H ${P(xe)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="M ${P(rx0 - 3)} ${P(yOf(0))} H ${P(fx1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="1.5 3"/>` +
      tag(x0 + 2, yOf(EC) + 4, sub("E", "c")) +
      tag(x0 + 2, yOf(EV) + 4, sub("E", "v")) +
      tag(x0 + 2, yOf(0) + 4, sub("E", "i"));
    let rings = "";
    for (let k = 0; k < S; k++) {
      const [x, y] = g.pos(k);
      rings += `<circle cx="${P(x)}" cy="${P(y)}" r="${P(r)}"/>`;
    }
    s += `<g fill="none" stroke="var(--border-strong)" stroke-width="0.9" opacity="0.8">${rings}</g>`;
    // De faste ionene i en egen rad under båndbildet.
    const ri = 4.2;
    const stepX = Math.min(2 * ri + 6, (fx0 - rx0 - 70) / ND);
    const yIon = h - 9;
    let ions = "";
    for (let i = 0; i < ND; i++) {
      const x = rx0 + ri + 1 + i * stepX;
      const plus = doping === "n";
      ions +=
        `<circle cx="${P(x)}" cy="${P(yIon)}" r="${P(ri)}" fill="var(--canvas-bg)" stroke="var(--orange)" stroke-width="1.3"/>` +
        `<path d="M ${P(x - ri + 1.6)} ${P(yIon)} H ${P(x + ri - 1.6)}${plus ? ` M ${P(x)} ${P(yIon - ri + 1.6)} V ${P(yIon + ri - 1.6)}` : ""}" stroke="var(--orange)" stroke-width="1.3"/>`;
    }
    s += ions + tag(rx0 + ND * stepX + 4, yIon + 4, doping === "n" ? "donorioner" : "akseptorioner");
    // f(E)-feltet: aksen ved f = 0, stiplet ved ½ og 1.
    const yT = top - 6;
    const yB = h - bot + 2;
    const fX = (f) => fx0 + f * (fx1 - fx0);
    s +=
      `<path d="M ${P(fx0)} ${P(yT)} V ${P(yB)} H ${P(fx1)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(fX(0.5))} ${P(yT)} V ${P(yB)} M ${P(fx1)} ${P(yT)} V ${P(yB)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"/>` +
      tag(fx0, yB + 13, "0", "middle") +
      tag(fX(0.5), yB + 13, "½", "middle") +
      tag(fx1, yB + 13, "1", "middle") +
      tag((fx0 + fx1) / 2, yT - 6, "f(E)", "middle", "var(--fg)", ";font-style:italic");
    return s;
  }

  /** Nivålinjene og f(E), som følger det glattede overskuddet. */
  function levelLayer(g) {
    const { yOf, rx0, fx0, fx1, pitchY, top, h, bot } = g;
    const lv = levels();
    const fX = (f) => fx0 + f * (fx1 - fx0);
    const yT = top - 6;
    const yB = h - bot + 2;
    let s = "";
    // f(E): med F_n over ledningsbåndets energier og F_p over valensbåndets.
    const seg = (Elo, Ehi, lvl) => {
      let d = "";
      const n = 60;
      for (let i = 0; i <= n; i++) {
        const E = Elo + ((Ehi - Elo) * i) / n;
        d += `${i ? "L" : "M"} ${P(fX(fermi(E, lvl)))} ${P(yOf(E))} `;
      }
      return d;
    };
    const Etop = (yOf(0) - yT) / pitchY * DE;
    const Ebot = -(yB - yOf(0)) / pitchY * DE;
    s +=
      `<path d="${seg(EC, Etop, lv.fn)}" fill="none" stroke="var(--fg)" stroke-width="1.8"/>` +
      `<path d="${seg(Ebot, EV, lv.fp)}" fill="none" stroke="var(--fg)" stroke-width="1.8"/>`;
    const xr = fx1 + 2;
    const line = (y, color, dash, width) =>
      `<path d="M ${P(rx0 - 3)} ${P(y)} H ${P(fx1)}" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dash}"/>`;
    if (!lv.split) {
      const y = yOf(ef);
      s +=
        line(y, "var(--accent)", "5 3", 1.5) +
        `<circle cx="${P(fX(0.5))}" cy="${P(y)}" r="3" style="fill:var(--accent)"/>` +
        tag(xr, y + 4, sub("E", "F"), "start", "var(--accent)", HALO);
      return s;
    }
    const yN = yOf(lv.fn);
    const yP = yOf(lv.fp);
    const yE = yOf(ef);
    // Likevektens E_F som et svakt spor, merket på motsatt side av majoritetsnivået.
    s += line(yE, "var(--muted)", "1.5 3", 1);
    s +=
      line(yN, "var(--indigo)", "5 3", 1.6) +
      line(yP, "var(--red)", "5 3", 1.6) +
      `<circle cx="${P(fX(0.5))}" cy="${P(yN)}" r="2.6" style="fill:var(--indigo)"/>` +
      `<circle cx="${P(fX(0.5))}" cy="${P(yP)}" r="2.6" style="fill:var(--red)"/>`;
    // Etikettene: majoritetsnivået og E_F ligger tett, så de går på hver sin side.
    const nType = doping === "n";
    const yNl = nType ? yN - 3 : yN + 4;
    const yPl = nType ? yP + 4 : yP + 11;
    const yEl = nType ? yE + 11 : yE - 3;
    s +=
      tag(xr, yNl, sub("F", "n"), "start", "var(--indigo)", HALO) +
      tag(xr, yPl, sub("F", "p"), "start", "var(--red)", HALO) +
      tag(xr, yEl, sub("E", "F"), "start", "var(--muted)", HALO);
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
    // Fotonene: en bølgepil inn mot elektronet de løfter, som blekner.
    let ph = "";
    for (const p of photons) {
      const [x, y] = pos(p.s);
      const u = (clock - p.t0) / 0.7;
      const op = u < 0.45 ? 1 : Math.max(0, (1 - u) / 0.55);
      const len = 46;
      const ax = x + len * 0.8;
      const ay = y - len * 0.6;
      let d = `M ${P(ax)} ${P(ay)}`;
      const n = 16;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const bx = ax + (x + 5 - ax) * t;
        const by = ay + (y - 4 - ay) * t;
        const wob = Math.sin(t * Math.PI * 5) * 3;
        d += ` L ${P(bx + wob * 0.6)} ${P(by - wob * 0.8)}`;
      }
      ph +=
        `<g opacity="${op.toFixed(2)}"><path d="${d}" fill="none" style="stroke:var(--yellow)" stroke-width="2"/>` +
        `<path d="M ${P(x + 5)} ${P(y - 4)} l 1.5 -6 M ${P(x + 5)} ${P(y - 4)} l 6 0.5" style="stroke:var(--yellow)" stroke-width="1.8"/></g>`;
    }
    return (
      `<g fill="var(--canvas-bg)" stroke="var(--red)" stroke-width="1.6">${holes}</g>` +
      `<g style="fill:var(--indigo)">${dots}${mv}</g>` +
      ph
    );
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      staticLayer(G) +
      `<g data-lv>${levelLayer(G)}</g>` +
      `<g data-dyn>${dynLayer(G)}</g></svg>`;
    const svgEl = stage.firstElementChild;
    dynEl = svgEl.querySelector("[data-dyn]");
    lvEl = svgEl.querySelector("[data-lv]");
  }

  function renderDyn() {
    if (!G || !dynEl) return render();
    dynEl.innerHTML = dynLayer(G);
    lvEl.innerHTML = levelLayer(G);
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
    step(dt, true);
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

  equilibrate();
  sync();
  onResize(render);
  render();
}
