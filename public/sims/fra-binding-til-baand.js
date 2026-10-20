/**
 * «Fra bindinger til bånd» for TFE4146, modul 01.
 *
 * Én idé: båndene og båndgapet kommer fra bindingene. To atomer som deler et
 * elektronpar gir to nivåer: i fase (bindende, lavere, der bindingselektronene
 * sitter) og i motfase (antibindende, høyere, tomt). Kobles N bindinger etter
 * hverandre, sprer hvert av de to nivåene seg til N tette nivåer. De bindende
 * blir valensbåndet, fullt med nøyaktig de 2N bindingselektronene; de
 * antibindende blir ledningsbåndet, tomt. Tettere atomer binder sterkere, så
 * splittingen og dermed gapet vokser.
 *
 * Øverst står kjeden: 2N atomer, gruppert i N bindinger (to atomer tett med
 * en bindingsstrek og elektronparet på den, så et mellomrom og en tynn strek
 * til neste binding). Over kjeden står bølgefunksjonen til den valgte
 * tilstanden som en kurve, med kjeden som nullinje: ψ(x) = Σ c_j·φ(x − x_j),
 * der φ er en gaussisk orbital på hvert atom, så bølgen er sammenhengende og
 * knutepunktene synes der den krysser linja. Over linja (positiv) er den
 * fylt i aksentfargen, under (negativ) i fiolett. Bredden σ = 0,75·b, der b er
 * avstanden inne i en binding: to orbitaler i fase smelter da sammen til én
 * pukkel over bindingen, og i motfase krysser kurven null midt mellom
 * atomene. (Stilker per atom ble prøvd og forkastet: fortegnet var der, men
 * leseren så ikke en bølge.) Under står nivåene
 * på en energiakse uten tallskala, hvert med plass til to elektroner (to
 * prikker: indigo i valensbåndet, tomme ringer i ledningsbåndet). Elektroner
 * er indigo som i emnets andre simuleringer; aksentfargen er det valgte
 * nivået og den positive delen av bølgen på kjeden. Når nivåene ligger for tett til prikker,
 * bærer streken selv fyllingen: indigo er fullt, blek er tomt. Den stiplede
 * linja er nivået i et fritt atom.
 *
 * Modell: den dimeriserte tettbindingskjeden (åpen kjede, 2N atomer), med
 * kobling t₁ inne i en binding og t₂ mellom nabobindinger, begge negative
 * overlappintegraler, H = −t₁ Σ(A_k B_k) − t₂ Σ(B_k A_{k+1}) + h.c.
 * Løsningen er analytisk: med f(q) = t₁ + t₂e^{iq} = |f|e^{iφ} er
 * E = ∓|f(q)|, a_k = sin(kq − φ), b_k = ±sin(kq), og randkravet
 * (N + 1)q − φ(q) = mπ, m = 1 … N, gir én q per nivå i hvert bånd. Det er
 * kontrollert mot direkte diagonalisering av 2N×2N-matrisen. Båndene ligger
 * rundt ±t₁, er 2t₂ brede og har gapet 2(t₁ − t₂) imellom: splittingen i
 * én binding minus det koblingen mellom bindingene sprer nivåene.
 *
 * Avstanden: t₁ = T·e^{−(a − a_C)/λ₁} og t₂ = 0,4·T·e^{−(a − a_C)/λ₂}, der a
 * er gitterkonstanten. t₁ faller raskere enn t₂ (λ₁ = 1,88 Å, λ₂ = 4,23 Å),
 * slik at gapet lukker seg mot grått tinn mens båndene beholder bredden. Med
 * fast forhold t₂/t₁ ville hele mønsteret bare skalert, og gapet i diamant og
 * grått tinn kunne ikke stått i samme tegning. λ-ene er valgt slik at det
 * tegnede gapet ved de fire merkene står i omtrent riktig forhold til de
 * virkelige gapene (5,5 : 1,0 : 0,78 : 0,10 mot 5,5 : 1,1 : 0,67 : 0,1). Det
 * er en lekemodell: rekkefølgen og trenden er poenget, båndbreddene og
 * energiskalaen svarer ikke til de virkelige krystallene.
 *
 * Tall og kilder:
 *  - Si: a = 5,43 Å, E_g = 1,11 eV; Ge: a = 5,65 Å, E_g = 0,67 eV
 *    (Streetman & Banerjee, appendiks III). Ge brukes med 5,658 Å.
 *  - Diamant: a = 3,567 Å, E_g ≈ 5,5 eV; grått tinn (α-Sn): a = 6,489 Å,
 *    E_g ≈ 0,1 eV (standard tabellverdier, slik modulteksten oppgir dem).
 *  - Streetman §3.1.2, fig. 3–2: det frie atomnivået splittes i et lavere
 *    bindende og et høyere antibindende nivå, og N atomer gir N nivåer.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const N_CHOICES = [1, 2, 3, 4, 8, 16, 32];

// Gruppe IV, i rekkefølge etter avstand. Merkene på avstandsslideren.
const ELEMENTS = [
  { name: "Diamant", inText: "diamant", a: 3.567 },
  { name: "Si", inText: "Si", a: 5.431 },
  { name: "Ge", inText: "Ge", a: 5.658 },
  { name: "Grått tinn", inText: "grått tinn", a: 6.489 },
];
const A_MIN = ELEMENTS[0].a;
const A_MAX = ELEMENTS[ELEMENTS.length - 1].a;
const SNAP = 0.06; // Å: innenfor dette står slideren «på» et grunnstoff

const R_C = 0.4; // t₂/t₁ i diamant
const T_C = 2.75 / (1 - R_C); // gir gapet 5,5 (vilkårlige enheter) i diamant
const LAMBDA1 = 1.88; // Å, koblingen inne i en binding
const LAMBDA2 = 4.23; // Å, koblingen mellom bindinger

function couplings(a) {
  return {
    t1: T_C * Math.exp(-(a - A_MIN) / LAMBDA1),
    t2: R_C * T_C * Math.exp(-(a - A_MIN) / LAMBDA2),
  };
}

// Energiaksen er fast over hele slideren: toppen er t₁ + t₂ i diamant.
const E_MAX = (() => {
  const { t1, t2 } = couplings(A_MIN);
  return t1 + t2;
})();

/**
 * Alle 2N nivåer i den åpne kjeden, fra lavest til høyest. Hvert nivå har
 * energien E og amplitudene psi på atomene 0 … 2N−1, normert slik at største
 * |psi| er 1. Første atom har alltid positiv amplitude (sin(q − φ) > 0).
 */
function solve(N, t1, t2) {
  const phi = (q) => Math.atan2(t2 * Math.sin(q), t1 + t2 * Math.cos(q));
  const roots = [];
  for (let m = 1; m <= N; m++) {
    // (N + 1)q − φ(q) stiger monotont på (0, π) når t₂ < t₁: én rot per m.
    let lo = 0;
    let hi = Math.PI;
    for (let it = 0; it < 48; it++) {
      const q = (lo + hi) / 2;
      if ((N + 1) * q - phi(q) - m * Math.PI > 0) hi = q;
      else lo = q;
    }
    const q = (lo + hi) / 2;
    const p = phi(q);
    const amp = [];
    for (let k = 1; k <= N; k++) amp.push(Math.sin(k * q - p), Math.sin(k * q));
    roots.push({ e: Math.sqrt(t1 * t1 + t2 * t2 + 2 * t1 * t2 * Math.cos(q)), amp });
  }
  const norm = (v) => {
    const mx = Math.max(...v.map(Math.abs)) || 1;
    return v.map((x) => x / mx);
  };
  const out = [];
  // Bindende bånd: E = −|f|, m = 1 er nederst (alt i fase).
  for (let m = 0; m < N; m++) out.push({ E: -roots[m].e, psi: norm(roots[m].amp) });
  // Antibindende bånd: E = +|f|, B-atomene skifter fortegn. m = N er nederst.
  for (let m = N - 1; m >= 0; m--)
    out.push({ E: roots[m].e, psi: norm(roots[m].amp.map((x, j) => (j % 2 ? -x : x))) });
  return out;
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  let N = 4;
  let a = ELEMENTS[1].a; // Si
  let sel = 0; // valgt nivå, 0 = lavest

  // ── kontroller ────────────────────────────────────────────────────────────
  const nPick = choiceRow({
    ariaLabel: "Antall bindinger i kjeden",
    label: "Antall bindinger",
    items: N_CHOICES.map((n) => ({ value: String(n), label: String(n) })),
    onPick: (v) => setN(Number(v)),
    signal,
  });

  const slider = ({ text, min, max, step, value, aria, onInput }) => {
    const label = document.createElement("label");
    label.append(text + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    input.addEventListener("input", () => onInput(Number(input.value)), { signal });
    return { el: label, out, input };
  };

  const dS = slider({
    text: "Avstand mellom atomene",
    min: A_MIN,
    max: A_MAX,
    step: 0.01,
    value: a,
    aria: "Avstand mellom atomene, fra diamant (tettest) til grått tinn (lengst fra hverandre)",
    onInput: (v) => {
      a = v;
      sync();
      render();
    },
  });

  const lS = slider({
    text: "Valgt nivå",
    min: 0,
    max: 2 * N - 1,
    step: 1,
    value: sel,
    aria: "Valgt nivå, fra det laveste til det høyeste",
    onInput: (v) => {
      sel = v;
      sync();
      render();
    },
  });

  controls.append(nPick.el, dS.el, lS.el);

  /** Modellavstanden: i en sone rundt et merke står den nøyaktig på merket. */
  function aModel() {
    const hit = ELEMENTS.find((el) => Math.abs(a - el.a) <= SNAP);
    return hit ? hit.a : a;
  }

  function placeName() {
    const hit = ELEMENTS.find((el) => Math.abs(a - el.a) <= SNAP);
    if (hit) return hit.name;
    for (let i = 0; i < ELEMENTS.length - 1; i++)
      if (a < ELEMENTS[i + 1].a)
        return `Mellom ${ELEMENTS[i].inText} og ${ELEMENTS[i + 1].inText}`;
    return ELEMENTS[ELEMENTS.length - 1].name;
  }

  function levelName(i) {
    const bonding = i < N;
    const word = bonding ? "Bindende" : "Antibindende";
    if (N === 1) return word;
    const k = bonding ? i + 1 : i - N + 1;
    return `${word} ${k} av ${N}`;
  }

  function setN(n) {
    if (n === N) return;
    // Behold båndet og den relative plassen i båndet.
    const band = sel < N ? 0 : 1;
    const pos = N > 1 ? (sel - band * N) / (N - 1) : 0;
    N = n;
    sel = band * N + Math.round(pos * (N - 1));
    lS.input.max = String(2 * N - 1);
    lS.input.value = String(sel);
    lS.input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function sync() {
    nPick.sync(String(N));
    dS.out.textContent = placeName();
    lS.out.textContent = levelName(sel);
    dS.input.setAttribute("aria-valuetext", placeName());
    lS.input.setAttribute("aria-valuetext", levelName(sel));
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const MONO = "font-family:var(--font-mono)";
  const HALO = "stroke:var(--canvas-bg);stroke-width:4px;stroke-linejoin:round;paint-order:stroke";
  const text = (x, y, s, { anchor = "start", color = "var(--muted)", size = 11, halo = false } = {}) =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${MONO};font-size:${size}px${halo ? ";" + HALO : ""}">${s}</text>`;

  const CHAIN_H = 104; // kjedens felt øverst
  const uid = `fbb${Math.random().toString(36).slice(2, 8)}`; // unike id-er for klippene
  let geom = null; // for treff på nivåene

  function render() {
    const { w, h } = getSize();
    const { t1, t2 } = couplings(aModel());
    const lev = solve(N, t1, t2);
    if (sel > 2 * N - 1) sel = 2 * N - 1;
    const cur = lev[sel];

    // ── kjeden ──────────────────────────────────────────────────────────────
    // Avstanden mellom bindingene (P) og inne i en binding (b) skalerer med
    // gitterkonstanten. Skalaen per N settes slik at kjeden ved grått tinn
    // fyller bredden; ved diamant er den 55 % så lang.
    const BETA = 0.42;
    // Kjeden med halene på bølgen (3σ = 2,25·b i hver ende) skal få plass i bredden.
    const p0 = Math.min(150, (w - 8) / (N - 1 + BETA + 2 * 2.25 * BETA));
    const Pp = p0 * (aModel() / A_MAX);
    const b = BETA * Pp;
    const len = (N - 1) * Pp + b;
    const x0 = (w - len) / 2;
    const yc = CHAIN_H / 2 + 2;
    const reach = CHAIN_H / 2 - (N <= 2 ? 20 : 8); // fra kjedeaksen til toppen av bølgen, med plass til fortegnet
    const xs = [];
    for (let k = 0; k < N; k++) xs.push(x0 + k * Pp, x0 + k * Pp + b);

    const rAtom = Math.max(1.3, Math.min(8, Math.min(b, Pp - b) * 0.27));

    let chain = "";
    // Et svakt felt bak hver binding, så leseren ser om en pukkel står over en
    // binding eller over mellomrommet mellom to (det skiller toppen av
    // valensbåndet fra bunnen av ledningsbåndet). Utelatt når feltene ville
    // blitt striper (under 4 px mellom to felt).
    const pad = Math.max(rAtom + 2, 0.12 * Pp);
    if (Pp - b - 2 * pad >= 4)
      for (let k = 0; k < N; k++) {
        chain += `<rect x="${P(xs[2 * k] - pad)}" y="${P(yc - reach - 4)}" width="${P(b + 2 * pad)}" height="${P(2 * reach + 8)}" rx="4" style="fill:var(--border)" fill-opacity="0.45"/>`;
      }
    // Bølgefunksjonen: en gaussisk orbital på hvert atom, vektet med
    // amplituden, summert til én sammenhengende kurve.
    const sig = 0.75 * b;
    const xA = Math.max(4, xs[0] - 3 * sig);
    const xB = Math.min(w - 4, xs[2 * N - 1] + 3 * sig);
    const nS = Math.ceil((xB - xA) / 0.75);
    const px = [];
    const pv = [];
    let vMax = 0;
    for (let i = 0; i <= nS; i++) {
      const x = xA + ((xB - xA) * i) / nS;
      let v = 0;
      for (let j = 0; j < 2 * N; j++) {
        const u = (x - xs[j]) / sig;
        if (u * u < 16) v += cur.psi[j] * Math.exp(-u * u);
      }
      px.push(x);
      pv.push(v);
      vMax = Math.max(vMax, Math.abs(v));
    }
    const yOf = (v) => yc - (v / (vMax || 1)) * reach;
    let curve = "";
    for (let i = 0; i <= nS; i++) curve += `${i ? "L" : "M"} ${P(px[i])} ${P(yOf(pv[i]))} `;
    const area = `${curve}L ${P(xB)} ${P(yc)} L ${P(xA)} ${P(yc)} Z`;
    // Over linja aksent, under fiolett: samme kurve, klippet i to.
    chain +=
      `<defs><clipPath id="${uid}-pos"><rect x="0" y="0" width="${w}" height="${P(yc)}"/></clipPath>` +
      `<clipPath id="${uid}-neg"><rect x="0" y="${P(yc)}" width="${w}" height="${P(CHAIN_H)}"/></clipPath></defs>`;
    for (const [part, col] of [
      ["pos", "var(--accent)"],
      ["neg", "var(--violet)"],
    ])
      chain +=
        `<g clip-path="url(#${uid}-${part})">` +
        `<path d="${area}" style="fill:${col}" fill-opacity="0.22"/>` +
        `<path d="${curve}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/></g>`;
    // Nullinja langs hele kjeden.
    chain += `<path d="M ${P(xA)} ${P(yc)} H ${P(xB)}" stroke="var(--border)" stroke-width="1"/>`;
    // Bindingene: kraftig strek.
    for (let k = 0; k < N; k++)
      chain += `<path d="M ${P(xs[2 * k])} ${P(yc)} H ${P(xs[2 * k + 1])}" stroke="var(--border-strong)" stroke-width="${P(Math.max(1.5, Math.min(3, rAtom * 0.5)))}" stroke-linecap="round"/>`;
    for (let j = 0; j < 2 * N; j++)
      chain += `<circle cx="${P(xs[j])}" cy="${P(yc)}" r="${P(rAtom)}" style="fill:var(--card-nested)" stroke="var(--border-strong)" stroke-width="${rAtom > 3 ? 1.5 : 1}"/>`;
    // Fortegnet skrevet ut på hver del av bølgen så lenge det er plass (én eller to bindinger).
    if (N <= 2) {
      let i0 = 0;
      for (let i = 1; i <= nS + 1; i++) {
        if (i <= nS && Math.sign(pv[i]) === Math.sign(pv[i0])) continue;
        let im = i0;
        for (let j = i0; j < i; j++) if (Math.abs(pv[j]) > Math.abs(pv[im])) im = j;
        if (Math.abs(pv[im]) > 0.3 * vMax) {
          const pos = pv[im] > 0;
          chain += text(px[im], pos ? yOf(pv[im]) - 6 : yOf(pv[im]) + 15, pos ? "+" : "−", {
            anchor: "middle",
            color: pos ? "var(--accent)" : "var(--violet)",
            size: 14,
          });
        }
        i0 = i;
      }
    }
    // Elektronparet i hver binding, når det er plass mellom atomene.
    if (b - 2 * rAtom >= 11) {
      for (let k = 0; k < N; k++) {
        const xm = (xs[2 * k] + xs[2 * k + 1]) / 2;
        chain +=
          `<circle cx="${P(xm - 3.2)}" cy="${P(yc)}" r="2.2" style="fill:var(--indigo)"/>` +
          `<circle cx="${P(xm + 3.2)}" cy="${P(yc)}" r="2.2" style="fill:var(--indigo)"/>`;
      }
    }

    // ── nivåene ─────────────────────────────────────────────────────────────
    const top = CHAIN_H + 12;
    const bot = h - 10;
    const yMid = (top + bot) / 2;
    const s = ((bot - top) / 2 - 4) / E_MAX;
    const Y = (E) => yMid - E * s;

    const left = 46; // akse + markør
    const avail = w - left - 6;
    const RC = 100; // etikettkolonnen
    const LW = Math.max(90, Math.min(240, avail - RC - 12));
    const L0 = left + Math.max(0, (avail - (LW + 12 + RC)) / 2);
    const L1 = L0 + LW;
    const xLab = L1 + 12;

    const ys = lev.map((l) => Y(l.E));
    const vbTop = ys[N - 1];
    const cbBot = ys[N];

    /** Prikkradius og antall kolonner for et bånd: én kolonne, sikksakk, eller ingen prikker. */
    function dotPlan(i0) {
      if (N === 1) return { r: 3.6, cols: 1 };
      let d1 = Infinity;
      let d2 = Infinity;
      for (let i = i0; i < i0 + N - 1; i++) d1 = Math.min(d1, Math.abs(ys[i] - ys[i + 1]));
      for (let i = i0; i < i0 + N - 2; i++) d2 = Math.min(d2, Math.abs(ys[i] - ys[i + 2]));
      if (d1 >= 9) return { r: 3.6, cols: 1 };
      const r = Math.min(3.4, (d2 - 1.5) / 2);
      return r >= 1.9 ? { r, cols: 2 } : { r: 0, cols: 0 };
    }

    const xe = L0 + 0.3 * LW;
    const xg = L0 + 0.72 * LW;
    let levels = "";
    let dots = "";
    for (const [i0, filled] of [
      [0, true],
      [N, false],
    ]) {
      const plan = dotPlan(i0);
      const dense = plan.cols === 0;
      for (let i = i0; i < i0 + N; i++) {
        const y = ys[i];
        levels += `<path d="M ${P(L0)} ${P(y)} H ${P(L1)}" stroke="${filled ? "var(--indigo)" : "var(--border-strong)"}" stroke-width="${dense ? 1 : 1.5}"/>`;
        if (dense) continue;
        const col = plan.cols === 2 ? (i - i0) % 2 : 0;
        const cx = xe + col * 4.4 * (plan.r + 1);
        for (const dx of [-(plan.r + 1.2), plan.r + 1.2]) {
          dots += filled
            ? `<circle cx="${P(cx + dx)}" cy="${P(y)}" r="${P(plan.r)}" style="fill:var(--indigo)"/>`
            : `<circle cx="${P(cx + dx)}" cy="${P(y)}" r="${P(plan.r - 0.5)}" style="fill:var(--canvas-bg)" stroke="var(--border-strong)" stroke-width="1.2"/>`;
        }
      }
    }

    // Det valgte nivået: aksentstrek litt bredere enn de andre, og en pil inn.
    const ySel = ys[sel];
    const selMark =
      `<path d="M ${P(L0 - 3)} ${P(ySel)} H ${P(L1 + 3)}" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M ${P(L0 - 13)} ${P(ySel - 5)} l 7 5 l -7 5 z" style="fill:var(--accent)"/>`;

    // Frie atomers nivå, midt i gapet.
    const y0 = Y(0);
    const atomLine = `<path d="M ${P(L0)} ${P(y0)} H ${P(L1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4" opacity="0.8"/>`;

    // E_g: dobbeltpil mellom toppen av det fylte og bunnen av det tomme.
    const gap = vbTop - cbBot;
    let gapMark = "";
    if (gap >= 16) {
      gapMark =
        `<path d="M ${P(xg)} ${P(cbBot + 3)} V ${P(vbTop - 3)}" stroke="var(--fg)" stroke-width="1.2"/>` +
        `<path d="M ${P(xg)} ${P(cbBot + 2)} l -3.5 6 h 7 z" style="fill:var(--fg)"/>` +
        `<path d="M ${P(xg)} ${P(vbTop - 2)} l -3.5 -6 h 7 z" style="fill:var(--fg)"/>`;
    }
    // Er gapet for smalt til pil, står bare navnet i det, med kant mot strekene.
    gapMark += text(xg + 7, y0 + 4.5, `E<tspan dy="3" font-size="10">g</tspan>`, {
      color: "var(--fg)",
      size: 13,
      halo: true,
    });

    // Etikettene til høyre, midt på hvert bånd, men aldri oppå «fritt atom».
    const banded = N >= 4;
    const blockHalf = banded ? 13 : 6;
    const clear = 7 + 5 + blockHalf;
    const cbMid = Math.min((ys[N] + ys[2 * N - 1]) / 2, y0 - clear);
    const vbMid = Math.max((ys[0] + ys[N - 1]) / 2, y0 + clear);
    const label2 = (yC, first, second) =>
      second
        ? text(xLab, yC - 2, first, { color: "var(--fg)" }) + text(xLab, yC + 12, second)
        : text(xLab, yC + 4, first, { color: "var(--fg)" });
    const labels =
      (banded
        ? label2(cbMid, "ledningsbånd", "antibindende") + label2(vbMid, "valensbånd", "bindende")
        : label2(cbMid, "antibindende") + label2(vbMid, "bindende")) +
      text(xLab, y0 + 4, "fritt atom");

    const axis =
      `<text x="12" y="${P(yMid)}" text-anchor="middle" transform="rotate(-90 12 ${P(yMid)})" style="fill:var(--muted);${MONO};font-size:11px">Elektronenergi</text>` +
      `<path d="M 22 ${P(bot)} V ${P(top + 2)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M 22 ${P(top)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>`;

    // Treffflaten for nivåene: hele energifeltet.
    const hit = `<rect x="0" y="${P(top - 6)}" width="${w}" height="${P(h - top + 6)}" fill="transparent" style="cursor:pointer"/>`;

    geom = { ys, top: top - 6 };

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block;user-select:none;-webkit-user-select:none">` +
      chain +
      axis +
      atomLine +
      levels +
      selMark +
      dots +
      gapMark +
      labels +
      hit +
      `</svg>`;
  }

  // ── valg av nivå med klikk/trykk ──────────────────────────────────────────
  function pick(e) {
    if (!geom) return;
    const rect = stage.getBoundingClientRect();
    const { h } = getSize();
    const y = ((e.clientY - rect.top) * h) / rect.height;
    if (y < geom.top) return;
    let best = 0;
    for (let i = 1; i < geom.ys.length; i++)
      if (Math.abs(geom.ys[i] - y) < Math.abs(geom.ys[best] - y)) best = i;
    if (best === sel) return;
    sel = best;
    lS.input.value = String(sel);
    lS.input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // Et trykk velger (click kommer ikke etter en rulling). Med mus kan man også dra.
  stage.addEventListener("click", pick, { signal });
  stage.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse" && e.buttons & 1) pick(e);
    },
    { signal },
  );

  sync();
  onResize(render);
  render();
}
