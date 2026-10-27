/**
 * «Barrieren langs kanalen» for TFE4146, MOSFET-en.
 *
 * Én idé: source og drain er n⁺, og mellom dem ligger p-type silisium, så et elektron fra source møter
 * en barriere. Gaten bøyer båndene ned ved overflaten og senker barrieren. Under V_T er det bare de få
 * elektronene med nok energi som kommer over, og strømmen vokser med en faktor e for hver k_BT som
 * barrieren senkes: en rett linje mot V_G på en logaritmisk akse. Over V_T er overflaten full av
 * elektroner, og strømmen bøyer av. Med V_D = 0 går like mange elektroner hver vei. Streetman &
 * Banerjee §6.4.1 og §6.5.7, fig. 6–10a og 6–38.
 *
 * Øverst står transistoren sett fra siden, med gaten over p-området mellom n⁺-områdene for source og
 * drain. I midten står ledningsbåndkanten E_c langs overflaten fra source til drain, med Fermi-nivået
 * i source og drain stiplet og kvasi-Fermi-nivået F_n for elektronene i kanalen mellom dem. Elektronene
 * er blå prikker, de samme i begge tegningene. Nederst står I_D mot V_G på en logaritmisk akse for
 * V_D = 0,1 V og 1 V, med punktet for spenningene som er valgt.
 *
 * Modellen: n-kanal på p-Si med N_a = 5·10¹⁵ cm⁻³, 10 nm SiO₂, μ̄_n = 200 cm²/V·s og Z/L = 10, med
 * V_FB = −0,255 V slik at V_T = V_FB − Q_d/C_i + 2φ_F = 0,50 V. Overflatepotensialet φ_s er den eksakte
 * løsningen av Poissons ligning med hull og elektroner etter Boltzmann, der elektronene i kanalen har
 * kvasi-Fermi-nivået −qV under substratets (likning 6–24 med V), og V_G = V_FB + φ_s − Q_s/C_i.
 * Strømmen er I_D = μ̄_n(Z/L)∫₀^{V_D}|Q_n(V)|dV, drift og diffusjon sammen (ladningsark-modellen), og
 * V(x) langs kanalen følger av at strømmen er den samme i hvert snitt. Over V_T ligger den litt under
 * formelen for den lange kanalen, fordi φ_s fortsetter å stige over 2φ_F. Lekkasjen i overgangene er
 * ikke med. n⁺-områdene har E_c 0,05 eV under E_F. Antallet tegnede elektroner i kanalen vokser mye
 * saktere enn ladningen.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

// ── fysikken ────────────────────────────────────────────────────────────────
const KT = 0.0259; // V
const Q = 1.602e-19;
const EPS0 = 8.854e-14;
const ES = 11.8 * EPS0;
const NA = 5e15;
const NI = 1.5e10;
const P0 = NA;
const N0 = (NI * NI) / NA;
const PHIF = KT * Math.log(NA / NI); // 0,329 V
const CI = (3.9 * EPS0) / 10e-7; // F/cm²
const A = Math.sqrt(2 * ES * KT * P0 * Q); // C/cm², √(2ε_s k_BT p₀)
const QD = -2 * Math.sqrt(ES * Q * NA * PHIF);
const VT = 0.5;
const VFB = VT + QD / CI - 2 * PHIF; // −0,255 V
const MU = 200;
const ZL = 10;
const EC_BULK = 1.11 - KT * Math.log(1.04e19 / NA); // E_c − E_F i substratet, 0,912 eV
const EC_NP = -0.05; // E_c − E_F i n⁺

const F2 = (u, v) => Math.exp(-u) + u - 1 + (N0 / P0) * (Math.exp(-v) * (Math.exp(u) - 1) - u);
const Fd2 = (u) => Math.exp(-u) + u - 1;
const vgOf = (ps, V) => VFB + ps + (Math.sign(ps) * A * Math.sqrt(Math.max(0, F2(ps / KT, V / KT)))) / CI;
function phisOf(vg, V) {
  let lo = -0.6;
  let hi = 1.6 + V;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (vgOf(m, V) > vg) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
/** |Q_n| i C/cm² ved kvasi-Fermi-spenningen V. */
function qnOf(vg, V) {
  const ps = phisOf(vg, V);
  if (ps <= 0) return 0;
  return Math.max(0, A * (Math.sqrt(Math.max(0, F2(ps / KT, V / KT))) - Math.sqrt(Fd2(ps / KT))));
}
function idOf(vg, vd) {
  if (vd <= 0) return 0;
  const n = 80;
  let s = 0;
  for (let i = 0; i < n; i++) s += qnOf(vg, ((i + 0.5) / n) * vd);
  return MU * ZL * s * (vd / n);
}

const VG_MAX = 1.5;
const LOG_LO = -16;
const LOG_HI = -3;
const DRAINS = [0, 0.1, 1];
const TAU = 0.3; // s, innstillingstiden for V_G
const CAP = 40; // elektroner i kanalen høyst
const QREF = 3e11 * Q; // C/cm², ladningen som gir 63 % av CAP
const XS = 0.2; // kanalen begynner, andel av bredden
const XD = 0.8; // kanalen slutter
const NV = 48; // punkter i V langs kanalen

// Kurvene for de to drain-spenningene, regnet én gang.
const CURVE_N = 61;
const curves = {};
for (const vd of [0.1, 1]) {
  const pts = [];
  for (let i = 0; i < CURVE_N; i++) {
    const vg = (i / (CURVE_N - 1)) * VG_MAX;
    pts.push([vg, idOf(vg, vd)]);
  }
  curves[vd] = pts;
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let vgT = 0;
  let vgC = 0;
  let vd = 0.1;

  // ── kontroller ────────────────────────────────────────────────────────────
  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",").replace("-", "−");
  const label = document.createElement("label");
  label.append("Gate ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = String(VG_MAX);
  input.step = "0.05";
  input.value = "0";
  input.setAttribute("aria-label", "Gatespenningen V_G, målt fra source");
  label.append(out, input);
  out.textContent = `${NB(0)} V`;
  input.addEventListener(
    "input",
    () => {
      vgT = Math.round(Number(input.value) * 20) / 20;
      out.textContent = `${NB(vgT)} V`;
      if (reduce.matches) vgC = vgT;
      solve();
      render();
      start();
    },
    { signal },
  );
  const dRow = choiceRow({
    ariaLabel: "Drain-spenningen V_D",
    label: "Drain",
    items: DRAINS.map((v) => ({ value: String(v), label: `${NB(v, v === 0.1 ? 1 : 0)} V` })),
    onPick: (v) => {
      vd = Number(v);
      dRow.sync(String(vd));
      solve();
      render();
      start();
    },
    signal,
  });
  dRow.sync(String(vd));
  controls.append(label, dRow.el);

  // ── tilstanden langs kanalen ──────────────────────────────────────────────
  const NX = 80;
  const st = {
    ec: new Float64Array(NX + 1), // E_c − E_F,source langs kanalen, eV
    fn: new Float64Array(NX + 1), // F_n langs kanalen, eV
    qcum: new Float64Array(NX + 1), // ladning fra source, normalisert
    qmean: 0, // midlere |Q_n|, C/cm²
    I: 0,
  };
  function solve() {
    const vg = vgC;
    st.I = idOf(vg, vd);
    // Ladningen og overflatepotensialet som funksjon av V, og V(x) fra at strømmen er lik i hvert snitt.
    const Vs = new Float64Array(NV + 1);
    const qs = new Float64Array(NV + 1);
    const ps = new Float64Array(NV + 1);
    const cum = new Float64Array(NV + 1);
    for (let j = 0; j <= NV; j++) {
      const V = (j / NV) * vd;
      Vs[j] = V;
      ps[j] = phisOf(vg, V);
      qs[j] = qnOf(vg, V);
      if (j) cum[j] = cum[j - 1] + 0.5 * (qs[j] + qs[j - 1]) * (V - Vs[j - 1]);
    }
    const total = cum[NV];
    for (let i = 0; i <= NX; i++) {
      const s = i / NX;
      let V = 0;
      let p = ps[0];
      if (vd > 0 && total > 0) {
        const target = s * total;
        let j = 0;
        while (j < NV && cum[j + 1] < target) j++;
        const span = cum[Math.min(NV, j + 1)] - cum[j];
        const f = span > 0 ? Math.min(1, (target - cum[j]) / span) : 0;
        V = Vs[j] + f * (Vs[Math.min(NV, j + 1)] - Vs[j]);
        p = ps[j] + f * (ps[Math.min(NV, j + 1)] - ps[j]);
      }
      st.ec[i] = EC_BULK - p;
      st.fn[i] = -V;
    }
    // Ladningen langs kanalen: |Q_n| i hvert punkt, kumulert for å plassere elektronene.
    let acc = 0;
    let sum = 0;
    st.qcum[0] = 0;
    let prev = 0;
    for (let i = 0; i <= NX; i++) {
      const q = qnOf(vg, -st.fn[i]);
      if (i) acc += 0.5 * (q + prev);
      st.qcum[i] = acc;
      sum += q;
      prev = q;
    }
    for (let i = 0; i <= NX; i++) st.qcum[i] = acc > 0 ? st.qcum[i] / acc : i / NX;
    st.qmean = sum / (NX + 1);
  }
  function xAtCharge(f) {
    let lo = 0;
    let hi = NX;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (st.qcum[m] < f) lo = m;
      else hi = m;
    }
    const span = st.qcum[hi] - st.qcum[lo];
    return (lo + (span > 1e-12 ? (f - st.qcum[lo]) / span : 0)) / NX;
  }
  const ecAt = (s) => {
    const p = Math.max(0, Math.min(NX, s * NX));
    const i = Math.min(NX - 1, Math.floor(p));
    const k = p - i;
    return st.ec[i] * (1 - k) + st.ec[i + 1] * k;
  };

  // ── elektronene ───────────────────────────────────────────────────────────
  const rnd = Math.random;
  const chan = Array.from({ length: CAP }, () => ({ u: rnd(), e: rnd(), a: 0 }));
  const pools = [0, 1].map(() => Array.from({ length: 14 }, () => ({ x: rnd(), e: rnd() })));
  let phase = 0;

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 380) return null;
    const x0 = 30;
    const x1 = w - 8;
    const gy0 = 16; // gaten
    const gy1 = gy0 + 10;
    const sy = gy1 + 4; // overflaten
    const sy1 = sy + 26; // bunnen av stripen
    const ey0 = sy1 + 18; // båndskjemaet
    const ey1 = ey0 + 150;
    const pw = Math.min(w, 600);
    const off = (w - pw) / 2;
    const px0 = off + 44;
    const px1 = off + pw - 14;
    const py0 = ey1 + 34;
    const py1 = h - 22;
    return { w, h, x0, x1, gy0, gy1, sy, sy1, ey0, ey1, px0, px1, py0, py1 };
  }
  const E_TOP = 0.95;
  const E_BOT = -1.2;
  const X = (s) => G.x0 + s * (G.x1 - G.x0);
  const yE = (E) => G.ey0 + ((E_TOP - E) / (E_TOP - E_BOT)) * (G.ey1 - G.ey0);
  const xG = (v) => G.px0 + (v / VG_MAX) * (G.px1 - G.px0);
  const yL = (l) => G.py1 - ((clamp(l, LOG_LO, LOG_HI) - LOG_LO) / (LOG_HI - LOG_LO)) * (G.py1 - G.py0);

  /** E_c langs hele tegningen, med overgangene til n⁺ glattet. */
  function ecFull(f) {
    const w = 0.08; // overgangen mellom n⁺ og kanalen
    const sd = EC_NP - vd;
    const smooth = (t) => t * t * (3 - 2 * t);
    if (f <= XS - w) return EC_NP;
    if (f >= XD + w) return sd;
    if (f < XS) return EC_NP + (st.ec[0] - EC_NP) * smooth((f - (XS - w)) / w);
    if (f > XD) return st.ec[NX] + (sd - st.ec[NX]) * smooth((f - XD) / w);
    return ecAt((f - XS) / (XD - XS));
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, t) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${t}</tspan>`;
  const sup = (main, t) => `${main}<tspan baseline-shift="super" style="font-size:8px">${t}</tspan>`;
  const it = ";font-style:italic";
  const brk = (x, y0, y1) =>
    `<path d="M ${P(x - 3.5)} ${P(y0)} h 7 M ${P(x - 3.5)} ${P(y1)} h 7 M ${P(x)} ${P(y0)} V ${P(y1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;

  const nShown = () => Math.round(CAP * (1 - Math.exp(-st.qmean / QREF)));

  function device() {
    const { w, x0, x1, gy0, gy1, sy, sy1 } = G;
    let s = "";
    const xa = X(XS);
    const xb = X(XD);
    s +=
      `<rect x="${P(x0)}" y="${P(sy)}" width="${P(xa - x0)}" height="${P(sy1 - sy)}" rx="4" style="fill:var(--indigo)" fill-opacity="0.22" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(xb)}" y="${P(sy)}" width="${P(x1 - xb)}" height="${P(sy1 - sy)}" rx="4" style="fill:var(--indigo)" fill-opacity="0.22" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(x0)} ${P(sy)} H ${P(x1)}" style="stroke:var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(xa - 2)}" y="${P(gy1)}" width="${P(xb - xa + 4)}" height="${P(sy - gy1)}" style="fill:var(--border)" fill-opacity="0.8"/>` +
      `<rect x="${P(xa - 2)}" y="${P(gy0)}" width="${P(xb - xa + 4)}" height="${P(gy1 - gy0)}" rx="2" style="fill:var(--muted)" fill-opacity="0.32" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag((x0 + xa) / 2, sy1 - 6, "n⁺", "middle", "var(--fg)", halo) +
      tag((xb + x1) / 2, sy1 - 6, "n⁺", "middle", "var(--fg)", halo) +
      tag((xa + xb) / 2, sy1 - 4, "p", "middle", "var(--muted)", halo) +
      tag((x0 + xa) / 2, gy1, "S", "middle", "var(--fg)") +
      tag((xa + xb) / 2, gy0 - 4, "G", "middle", "var(--fg)") +
      tag((xb + x1) / 2, gy1, "D", "middle", "var(--fg)");
    // Elektronene i kanalen, rett under oksidet.
    let dd = "";
    const n = nShown();
    for (let k = 0; k < CAP; k++) {
      const c = chan[k];
      if (k >= n && c.a <= 0) continue;
      const f = (((c.u + phase) % 1) + 1) % 1;
      const sx = xAtCharge(f);
      const x = X(XS + sx * (XD - XS));
      dd += `<circle cx="${P(x)}" cy="${P(sy + 3 + c.e * 4)}" r="2" fill-opacity="${P(0.9 * c.a)}"/>`;
    }
    s += `<g style="fill:var(--indigo)">${dd}</g>`;
    void w;
    return s;
  }

  function bands() {
    const { x0, x1, ey0, ey1 } = G;
    let s = "";
    // E_c langs overflaten.
    const M = 160;
    let d = "";
    // Jevnet ut over et kort stykke, så overgangen mellom kanalen og drain ikke får en krok.
    const ecS = (f) => {
      let a = 0;
      for (let j = -3; j <= 3; j++) a += ecFull(Math.max(0, Math.min(1, f + j * 0.006)));
      return a / 7;
    };
    for (let k = 0; k <= M; k++) d += `${k ? "L" : "M"} ${P(X(k / M))} ${P(yE(ecS(k / M)))} `;
    s += `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="1.7"/>`;
    // Fermi-nivåene: E_F i source og drain, F_n i kanalen mellom dem.
    let fd = `M ${P(x0)} ${P(yE(0))} H ${P(X(XS))} `;
    for (let i = 0; i <= NX; i += 2) fd += `L ${P(X(XS + (i / NX) * (XD - XS)))} ${P(yE(st.fn[i]))} `;
    fd += `L ${P(X(XD))} ${P(yE(-vd))} H ${P(x1)}`;
    s += `<path d="${fd}" fill="none" style="stroke:var(--accent)" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    s +=
      tag(x0 - 4, yE(EC_NP) + 4, sub("E", "c"), "end", "var(--fg)") +
      tag(x0 - 4, yE(0) - 6, sub("E", "F"), "end", "var(--accent)");
    const yDF = yE(-vd);
    s += tag(x1 - 2, yDF + 14, sub("E", "F"), "end", "var(--accent)", halo);
    if (vd > 0.05) s += tag(X(0.5), yE(st.fn[NX >> 1]) + 14, sub("F", "n"), "middle", "var(--accent)", halo);
    // Elektronene i source og drain, rett over E_c.
    let pd = "";
    for (const [side, pool] of pools.entries()) {
      const xa = side ? XD + 0.09 : 0.01;
      const xb = side ? 0.99 : XS - 0.09;
      const ec = side ? EC_NP - vd : EC_NP;
      for (const p of pool) pd += `<circle cx="${P(X(xa + p.x * (xb - xa)))}" cy="${P(yE(ec) - 3 - p.e * 7)}" r="2"/>`;
    }
    // Elektronene i kanalen, på E_c.
    const n = nShown();
    for (let k = 0; k < CAP; k++) {
      const c = chan[k];
      if (k >= n && c.a <= 0) continue;
      const f = (((c.u + phase) % 1) + 1) % 1;
      const sx = xAtCharge(f);
      pd += `<circle cx="${P(X(XS + sx * (XD - XS)))}" cy="${P(yE(ecAt(sx)) - 3 - c.e * 7)}" r="2" fill-opacity="${P(0.9 * c.a)}"/>`;
    }
    s += `<g style="fill:var(--indigo)">${pd}</g>`;
    // Barrieren sett fra source: fra E_F opp til E_c der kanalen begynner.
    const top = st.ec[2];
    if (top > 0.12) {
      const xb = X(XS) + 16;
      s +=
        `<path d="M ${P(x0)} ${P(yE(top))} H ${P(xb + 6)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brk(xb, yE(top), yE(0)) +
        tag(xb + 7, (yE(top) + yE(0)) / 2 + 4, "ΔE", "start", "var(--fg)", it + halo);
    }
    // qV_D ved drain.
    if (vd >= 0.5) {
      const xq = x1 - 30;
      s +=
        `<path d="M ${P(X(XD) + 4)} ${P(yE(0))} H ${P(x1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brk(xq, yE(0), yE(-vd)) +
        tag(xq - 6, (yE(0) + yE(-vd)) / 2 + 4, `q${sub("V", "D")}`, "end", "var(--fg)", halo);
    }
    void ey0;
    void ey1;
    return s;
  }

  function plot() {
    const { px0, px1, py0, py1 } = G;
    let s = "";
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const l of [-15, -12, -9, -6, -3]) {
      s += `<path d="M ${P(px0)} ${P(yL(l))} h -4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
      s += tag(px0 - 6, yL(l) + 4, sup("10", `${l}`.replace("-", "−")), "end");
    }
    for (const v of [0.5, 1, 1.5]) s += `<path d="M ${P(xG(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(px0, py1 + 14, "0", "middle") + tag(xG(1), py1 + 14, "1", "middle") + tag(xG(1.5), py1 + 14, "1,5 V", "end");
    s += tag(xG(1.25), py1 + 14, sub("V", "G"), "middle", "var(--fg)", it);
    s += tag(px0 - 6, py0 - 8, "A", "end") + tag(px0 + 6, py0 + 4, sub("I", "D"), "start", "var(--fg)", it + halo);
    // V_T.
    s += `<path d="M ${P(xG(VT))} ${P(py0)} V ${P(py1)}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>`;
    s += tag(xG(VT), py1 + 14, sub("V", "T"), "middle", "var(--fg)", it);
    // Kurvene.
    for (const v of [0.1, 1]) {
      let d = "";
      curves[v].forEach(([vg, i], k) => (d += `${k ? "L" : "M"} ${P(xG(vg))} ${P(yL(Math.log10(Math.max(i, 1e-30))))} `));
      const on = v === vd;
      s += `<path d="${d}" fill="none" style="stroke:${on ? "var(--accent)" : "var(--muted)"}" stroke-width="${on ? 2 : 1.1}"/>`;
    }
    const lab = (v, dy) => {
      const [vg, i] = curves[v][CURVE_N - 1];
      return tag(xG(vg) - 2, yL(Math.log10(i)) + dy, `${NB(v, v === 0.1 ? 1 : 0)} V`, "end", v === vd ? "var(--accent)" : "var(--muted)", halo);
    };
    s += lab(1, -6) + lab(0.1, 14);
    // Punktet.
    if (vd > 0) {
      s += `<circle cx="${P(xG(vgC))}" cy="${P(yL(Math.log10(Math.max(st.I, 1e-30))))}" r="4.2" style="fill:var(--accent);stroke:var(--canvas-bg)" stroke-width="1.5"/>`;
    } else {
      s += `<circle cx="${P(xG(vgC))}" cy="${P(py1)}" r="4" fill="none" style="stroke:var(--accent)" stroke-width="1.6"/>`;
      s += tag(xG(vgC) + (vgC > 1.1 ? -8 : 8), py1 - 8, `${sub("I", "D")} = 0`, vgC > 1.1 ? "end" : "start", "var(--accent)", it + halo);
    }
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${device()}${bands()}${plot()}</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    const before = vgC;
    vgC += (vgT - vgC) * k;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    if (vgC !== before) solve();
    // Elektronene i kanalen: fasen går med strømmen delt på ladningen, pluss litt tilfeldig bevegelse.
    const qTot = st.qmean;
    if (qTot > 1e-14 && st.I > 0) {
      const iRef = idOf(VG_MAX, 1);
      const qRef = qnOf(VG_MAX, 0);
      phase = (phase + (dt * 0.35 * (st.I / iRef) * (qRef / qTot))) % 1;
    }
    const n = nShown();
    for (let j = 0; j < CAP; j++) {
      const c = chan[j];
      c.u = (((c.u + (rnd() - 0.5) * 0.06 * dt * 6) % 1) + 1) % 1;
      c.a = j < n ? Math.min(1, c.a + dt / 0.4) : Math.max(0, c.a - dt / 0.4);
    }
    for (const pool of pools)
      for (const p of pool) {
        p.x = clamp(p.x + (rnd() - 0.5) * dt * 0.6, 0, 1);
        p.e = clamp(p.e + (rnd() - 0.5) * dt * 1.2, 0, 1);
      }
  }
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches) return;
    const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
    last = now;
    step(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || reduce.matches || signal.aborted) return;
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
  reduce.addEventListener(
    "change",
    () => {
      vgC = vgT;
      solve();
      render();
      start();
    },
    { signal },
  );
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  solve();
  for (let j = 0; j < CAP; j++) chan[j].a = j < nShown() ? 1 : 0;
  onResize(render);
  render();
}
