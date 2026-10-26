/**
 * «Kanalen i en MESFET» for TFE4146, MESFET-en.
 *
 * Én idé: strømmen er ladningen per lengde ganger farten, og farten har et tak, v_s. I en
 * lang kanal er feltet svakt, elektronene går med μℰ, og strømmen metter først når kanalen
 * nesten er klemt av ved drain. I en kort kanal er feltet sterkt nok til at elektronene ved
 * drain når v_s mens kanalen der fortsatt er åpen, og strømmen metter tidligere. Kurvene for
 * ulike gatespenninger ligger da jevnere. Streetman & Banerjee §6.3.1 og §6.3.3, fig. 6–7 og 6–9.
 *
 * Øverst står kanalen sett fra siden: source og drain er ohmske kontakter oppå et tynt lag n-type
 * GaAs, gaten er en Schottky-kontakt mellom dem, og under laget ligger halvisolerende GaAs.
 * Romladningssonen under gaten er tonet, med donorionene som «+», og elektronene er blå prikker.
 * Under, på samme x-akse, står farten til elektronene langs kanalen med taket v_s. Nederst står
 * I_D mot V_D for fire gatespenninger, kurven for gatespenningen nå og punktet.
 *
 * Modellen: n-GaAs med N_d = 10¹⁷ cm⁻³, lagtykkelse a = 0,2 µm, ε = 13,2ε₀, V_0 = 0,76 V for
 * Schottky-gaten, μ_n = 4000 cm²/V·s, v_s = 10⁷ cm/s og Z = 200 µm. Det gir V_p = qN_da²/2ε = 2,74 V
 * og gatespenningen som stenger kanalen V_0 − V_p = −1,98 V. Med gradvis kanal og farten
 * v = μℰ/(1 + μℰ/v_s) er I_D = qN_dZμ∫₀^{V_D} h dV / (L + μV_D/v_s), og strømmen metter der
 * elektronene ved drain når v_s, qN_dZh(L)v_s = I_D. Over metning holdes strømmen fast (den ideelle
 * modellen), og resten av spenningen faller over et kort stykke ved drain. Kanalen er tegnet like
 * lang for L = 20 µm og L = 0,5 µm, og høyden er forstørret; farten til prikkene på skjermen følger
 * v/v_s i begge.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const Q = 1.602e-19;
const EPS = 13.2 * 8.854e-14;
const ND = 1e17;
const A = 0.2e-4; // cm
const MU = 4000;
const VS = 1e7;
const V0 = 0.76;
const Z = 200e-4; // cm
const VP = (Q * ND * A * A) / (2 * EPS); // 1,54 V
const VG_OFF = V0 - VP; // −0,78 V
const LEN = { lang: 20e-4, kort: 0.5e-4 };
const VD_MAX = 3;
const FAMILY = [0, -0.5, -1, -1.5];

const sOf = (v, vg) => Math.max(0, V0 + v - vg) / VP;
const hOf = (v, vg) => Math.max(0, 1 - Math.sqrt(Math.min(1, sOf(v, vg)))); // h/a
/** ∫₀^v h/a dv', i volt. */
const Fint = (v, vg) => v - (2 / 3) * VP * (Math.min(1, sOf(v, vg)) ** 1.5 - Math.min(1, sOf(0, vg)) ** 1.5);
const G0 = Q * ND * MU * Z * A; // A·cm/V, slik at I = G0·F/(L + μV/v_s)
/** Strømmen før metning, i A. */
const iRaw = (v, vg, L) => (G0 * Math.max(0, Fint(Math.min(v, vg + VP - V0), vg))) / (L + (MU * v) / VS);
/** Metningspunktet: der elektronene ved drain når v_s. */
function satOf(vg, L) {
  const vpinch = vg + VP - V0;
  if (vpinch <= 0) return { v: 0, i: 0 };
  let lo = 0;
  let hi = vpinch;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    const f = Q * ND * Z * A * hOf(m, vg) * VS - iRaw(m, vg, L);
    if (f > 0) lo = m;
    else hi = m;
  }
  const v = (lo + hi) / 2;
  return { v, i: iRaw(v, vg, L) };
}
const ID = (v, vg, L, sat) => (v >= sat.v ? sat.i : iRaw(v, vg, L));
const OPEN0 = 1 - Math.sqrt(V0 / VP); // åpen andel ved V_G = V_D = 0

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduce.matches;
  let len = "lang";
  let vdT = 2;
  let vgT = 0;
  let vdC = vdT;
  let vgC = vgT;
  let phase = 0;

  // ── kontroller ────────────────────────────────────────────────────────────
  const NB = (x, k = 1) => x.toFixed(k).replace(".", ",").replace("-", "−");
  function slider(name, aria, min, max, step, value, digits, set) {
    const label = document.createElement("label");
    label.append(name + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    out.textContent = `${NB(value, digits)} V`;
    input.addEventListener(
      "input",
      () => {
        const v = Math.round(Number(input.value) / step) * step;
        set(v);
        out.textContent = `${NB(v, digits)} V`;
        changed();
      },
      { signal },
    );
    return label;
  }
  const sD = slider("Drain", "Spenningen V_D på drain, målt fra source", 0, VD_MAX, 0.05, vdT, 2, (v) => (vdT = v));
  const sG = slider("Gate", "Spenningen V_G på gaten, målt fra source", -2, 0, 0.05, vgT, 2, (v) => (vgT = v));
  const lenPick = choiceRow({
    ariaLabel: "Kanallengde",
    label: "Kanal",
    items: [
      { value: "lang", label: "Lang" },
      { value: "kort", label: "Kort" },
    ],
    onPick: (v) => {
      len = v;
      lenPick.sync(len);
      neck.length = 0;
      update();
      render();
    },
    signal,
  });
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  playBtn.textContent = playing ? "Pause" : "Spill av";
  playBtn.addEventListener(
    "click",
    () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Spill av";
      start();
    },
    { signal },
  );
  controls.append(sD, sG, playBtn, lenPick.el);
  lenPick.sync(len);

  function changed() {
    if (!playing) {
      vdC = vdT;
      vgC = vgT;
      neck.length = 0;
    }
    update();
    render();
    start();
  }

  // ── tilstanden i kanalen ──────────────────────────────────────────────────
  const NS = 160;
  const st = {
    vx: new Float64Array(NS + 1),
    hf: new Float64Array(NS + 1), // h/a
    vel: new Float64Array(NS + 1), // v/v_s
    cum: new Float64Array(NS + 1),
    open: 1,
    xs: 1, // der metningsstykket begynner, andel av L
    sat: { v: 0, i: 0 },
    I: 0,
    off: false,
    saturated: false,
    imax: 1,
  };
  // Toppen av strømaksen for hver kanallengde.
  const IMAX = { lang: satOf(0, LEN.lang).i * 1.12, kort: satOf(0, LEN.kort).i * 1.12 };

  function update() {
    const L = LEN[len];
    const vg = vgC;
    const vd = vdC;
    const sat = satOf(vg, L);
    st.sat = sat;
    st.off = vg <= VG_OFF + 1e-6;
    st.saturated = !st.off && vd > sat.v;
    st.I = st.off ? 0 : ID(vd, vg, L, sat);
    const veff = st.off ? 0 : Math.min(vd, sat.v);
    // Stykket ved drain der spenningen ut over metningen faller.
    const dl = st.saturated ? Math.min(0.45, Math.sqrt((2 * EPS * (vd - sat.v)) / (Q * ND)) / L) : 0;
    st.xs = 1 - dl;
    // x(V) = (μ/I)[G0' F(V) − I·V/v_s], der G0' = qN_dZa; normert med L.
    const I = st.I;
    const xOfV = (v) => (I > 0 ? ((MU / I) * (Q * ND * Z * A * Fint(v, vg) - (I * v) / VS)) / L : 0);
    const xEnd = xOfV(veff) || 1;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      let vx;
      if (st.off) vx = 0;
      else if (s <= st.xs) {
        const target = (s / st.xs) * xEnd;
        let lo = 0;
        let hi = veff;
        for (let k = 0; k < 32; k++) {
          const m = (lo + hi) / 2;
          if (xOfV(m) > target) hi = m;
          else lo = m;
        }
        vx = (lo + hi) / 2;
      } else {
        const u = (s - st.xs) / (1 - st.xs);
        vx = veff + (vd - veff) * u * u;
      }
      st.vx[i] = vx;
      // Ut over metningspunktet går elektronene med v_s, og kanalen holder høyden den hadde der.
      const hh = s > st.xs ? hOf(veff, vg) : hOf(vx, vg);
      st.hf[i] = st.off ? 0 : hh;
      st.vel[i] = st.off || I <= 0 ? 0 : Math.min(1, I / (Q * ND * Z * A * Math.max(hh, 1e-3) * VS));
    }
    st.cum[0] = 0;
    for (let i = 1; i <= NS; i++) st.cum[i] = st.cum[i - 1] + (st.hf[i - 1] + st.hf[i]) / (2 * NS);
    st.open = st.cum[NS];
    st.imax = IMAX[len];
  }
  function xAtArea(f) {
    const target = f * st.open;
    let lo = 0;
    let hi = NS;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (st.cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const span = st.cum[hi] - st.cum[lo];
    return (lo + (span > 1e-12 ? (target - st.cum[lo]) / span : 0)) / NS;
  }
  function hAt(s) {
    const p = Math.max(0, Math.min(NS, s * NS));
    const i = Math.min(NS - 1, Math.floor(p));
    const k = p - i;
    return st.hf[i] * (1 - k) + st.hf[i + 1] * k;
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let G = null;
  let dots = [];
  const neck = [];
  const R = 2.3;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 400) return null;
    const x0 = 30;
    const x1 = w - 30;
    const top = 28; // overkanten av n-laget
    const H = Math.round(clamp(w * 0.18, 52, 76)); // a i px
    const bot = top + H;
    const sub0 = bot; // halvisolerende GaAs
    const sub1 = bot + 18;
    const vy0 = sub1 + 26;
    const vy1 = vy0 + 52;
    const pw = Math.min(w, 600);
    const off = (w - pw) / 2;
    const px0 = off + 40;
    const px1 = off + pw - 18;
    const py0 = vy1 + 34;
    const py1 = h - 22;
    const n = clamp(Math.round(((x1 - x0) * H * 0.55) / 60), 40, 200);
    if (dots.length !== n) dots = Array.from({ length: n }, () => ({ u: Math.random(), t: Math.random(), k: Math.random() }));
    return { w, h, x0, x1, L: x1 - x0, top, H, bot, sub0, sub1, vy0, vy1, px0, px1, py0, py1 };
  }
  const X = (s) => G.x0 + s * G.L;
  const yv = (v) => G.vy1 - v * (G.vy1 - G.vy0);
  const xI = (v) => G.px0 + (v / VD_MAX) * (G.px1 - G.px0);
  const yI = (i) => G.py1 - (Math.min(i, st.imax) / st.imax) * (G.py1 - G.py0);

  // ── tegning ───────────────────────────────────────────────────────────────
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  function device() {
    const { w, x0, x1, L, top, H, bot, sub1 } = G;
    let s = "";
    // Halvisolerende GaAs under laget.
    s +=
      `<rect x="2" y="${P(bot)}" width="${P(w - 4)}" height="${P(sub1 - bot)}" style="fill:var(--muted)" fill-opacity="0.12"/>` +
      tag(w / 2, sub1 - 5, "halvisolerende GaAs", "middle", "var(--muted)");
    // n-laget.
    s += `<rect x="2" y="${P(top)}" width="${P(w - 4)}" height="${P(H)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
    // Kontaktene oppå: source og drain ved endene, gaten over kanalen.
    s +=
      `<rect x="2" y="${P(top - 10)}" width="${P(x0 - 6)}" height="10" style="fill:var(--fg)" fill-opacity="0.75"/>` +
      `<rect x="${P(x1 + 4)}" y="${P(top - 10)}" width="${P(w - x1 - 6)}" height="10" style="fill:var(--fg)" fill-opacity="0.75"/>` +
      `<rect x="${P(x0)}" y="${P(top - 10)}" width="${P(L)}" height="10" style="fill:var(--muted)" fill-opacity="0.55"/>` +
      tag(4, top - 15, "S", "start", "var(--fg)") +
      tag(w - 4, top - 15, "D", "end", "var(--fg)") +
      tag(x0 + L / 2, top - 15, "G", "middle", "var(--fg)");
    // Sonen under gaten.
    const pts = [];
    for (let i = 0; i <= NS; i += 2) pts.push(i / NS);
    const edge = pts.map((p, i) => `${i ? "L" : "M"} ${P(X(p))} ${P(bot - H * hAt(p))}`).join(" ");
    s += `<path d="M ${P(x0)} ${P(top)} ${edge.replace(/^M/, "L")} L ${P(x1)} ${P(top)} Z" style="fill:var(--accent)" fill-opacity="0.12"/>`;
    if (!st.off) s += `<path d="${edge}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" fill="none" opacity="0.75"/>`;
    // Donorionene: sterke i sonen, svake i den åpne kanalen.
    let strong = "";
    let faint = "";
    for (let col = 0; ; col++) {
      const x = x0 + 6 + col * 12;
      if (x > x1 - 4) break;
      const wpx = H * (1 - hAt((x - x0) / L));
      for (let row = 0; ; row++) {
        const d = 6 + row * 11 + (col % 2) * 5;
        if (d > H - 3) break;
        const p = `M ${P(x - 2)} ${P(top + d)} h 4 M ${P(x)} ${P(top + d - 2)} v 4 `;
        if (d < wpx - 1) strong += p;
        else faint += p;
      }
    }
    s += `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.28"/><path d="${strong}" style="stroke:var(--orange)" stroke-width="1.4"/>`;
    // Elektronene i den åpne kanalen, med samme tetthet overalt.
    let dd = "";
    const frac = clamp(st.open / OPEN0, 0, 1);
    for (const d of dots) {
      if (d.k >= frac) continue;
      const f = (((d.u + phase) % 1) + 1) % 1;
      const sx = xAtArea(f);
      const hh = hAt(sx) * H;
      if (hh < R + 0.5) continue;
      const fade = clamp(Math.min(f, 1 - f) / 0.03, 0, 1);
      dd += `<circle cx="${P(X(sx))}" cy="${P(bot - (R + 0.5) - d.t * (hh - 2 * R - 1))}" r="${R}" fill-opacity="${P(0.9 * fade)}"/>`;
    }
    for (const n of neck) dd += `<circle cx="${P(X(n.s))}" cy="${P(bot - n.dy)}" r="${R}" fill-opacity="${P(0.9 * n.alpha)}"/>`;
    s += `<g style="fill:var(--indigo)">${dd}</g>`;
    // Merkelapper.
    if (st.off) s += tag(x0 + L / 2, bot - 8, "stengt", "middle", "var(--fg)", halo);
    s += tag(x0 + L / 2, sub1 + 14, len === "lang" ? "L = 20 µm" : "L = 0,5 µm", "middle", "var(--fg)", halo);
    return s;
  }

  function strip() {
    const { x0, x1, vy0, vy1 } = G;
    let s = "";
    s += `<path d="M ${P(x0)} ${P(vy0 - 4)} V ${P(vy1)} H ${P(x1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<path d="M ${P(x0)} ${P(yv(1))} H ${P(x1)}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    s += tag(x0 - 5, yv(1) + 4, sub("v", "s"), "end", "var(--fg)", it) + tag(x0 - 5, yv(0) + 4, "0", "end");
    s += tag(x0 - 5, (vy0 + vy1) / 2 + 4, "v", "end", "var(--fg)", it) + tag(x1 + 2, vy1 + 14, "x", "end", "var(--fg)", it);
    if (st.off) return s;
    let d = "";
    for (let i = 0; i <= NS; i += 2) d += `${i ? "L" : "M"} ${P(X(i / NS))} ${P(yv(st.vel[i]))} `;
    s += `<path d="${d}" fill="none" style="stroke:var(--indigo)" stroke-width="1.9" stroke-linejoin="round"/>`;
    return s;
  }

  function curvePath(vg) {
    const L = LEN[len];
    const sat = satOf(vg, L);
    const n = 120;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const v = (i / n) * VD_MAX;
      d += `${i ? "L" : "M"} ${P(xI(v))} ${P(yI(ID(v, vg, L, sat)))} `;
    }
    return d;
  }

  function plot() {
    const { px0, px1, py0, py1 } = G;
    const L = LEN[len];
    let s = "";
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [1, 2, 3]) s += `<path d="M ${P(xI(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(px0, py1 + 14, "0", "middle") + tag(xI(1), py1 + 14, "1", "middle") + tag(xI(2), py1 + 14, "2", "middle") + tag(xI(3), py1 + 14, "3 V", "end");
    // Strømaksen i mA: steg som passer kanallengden.
    const stepI = len === "lang" ? 1 : 5;
    for (let k = stepI; k <= st.imax * 1e3 + 1e-9; k += stepI) {
      s += `<path d="M ${P(px0)} ${P(yI(k * 1e-3))} h -4" style="stroke:var(--border-strong)" stroke-width="1"/>` + tag(px0 - 7, yI(k * 1e-3) + 4, String(k), "end");
    }
    s += tag(px0 - 7, py0 - 6, "mA", "end");
    s += tag(xI(2.5), py1 + 14, sub("V", "D"), "middle", "var(--fg)", it) + tag(px0 + 6, py0 + 6, sub("I", "D"), "start", "var(--fg)", it + halo);
    let fam = "";
    for (const vg of FAMILY) fam += curvePath(vg);
    s += `<path d="${fam}" fill="none" style="stroke:var(--muted)" stroke-width="1.1"/>`;
    for (const vg of FAMILY) {
      const i = satOf(vg, L).i;
      if (yI(i) < py1 - 8) s += tag(px1, yI(i) - 4, vg === 0 ? "0 V" : `${NB(vg, 1)} V`, "end", "var(--muted)", halo);
    }
    // Knekkene.
    let locus = "";
    for (let k = 0; k <= 40; k++) {
      const vg = VG_OFF * (1 - k / 40) + 1e-4;
      const sat = satOf(vg, L);
      locus += `${k ? "L" : "M"} ${P(xI(sat.v))} ${P(yI(sat.i))} `;
    }
    s += `<path d="${locus}" fill="none" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    s += `<path d="${curvePath(vgC)}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
    s += `<circle cx="${P(xI(vdC))}" cy="${P(yI(st.I))}" r="4.2" style="fill:var(--accent);stroke:var(--canvas-bg)" stroke-width="1.5"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${device()}${strip()}${plot()}</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  const SPEED = 0.55; // kanallengder per sekund for et elektron med v_s
  function step(dt) {
    const k = 1 - Math.exp(-dt / 0.3);
    vdC += (vdT - vdC) * k;
    vgC += (vgT - vgC) * k;
    if (Math.abs(vdT - vdC) < 1e-3) vdC = vdT;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    update();
    // Fasen: fluksen delt på det åpne arealet. Et elektron med v_s ved høyden h går SPEED·(h/a)…
    // Fluksen per sekund i enheter av «hele kanalen»: I/(qN_dZa·v_s) · SPEED / open.
    if (st.open > 1e-3 && st.I > 0) {
      const flux = st.I / (Q * ND * Z * A * VS);
      phase = (phase + (dt * flux * SPEED) / st.open) % 1;
    }
    if (G && st.saturated && st.I > 0 && hOf(st.sat.v, vgC) * G.H < 2 * R + 1) {
      const rate = (dots.length * (st.I / (Q * ND * Z * A * VS)) * SPEED) / Math.max(st.open, 0.02);
      if (Math.random() < Math.min(40, rate) * dt * 0.5) neck.push({ s: st.xs, dy: R + 1 + Math.random() * 4, alpha: 1 });
    }
    for (let i = neck.length - 1; i >= 0; i--) {
      const n = neck[i];
      n.s += dt * SPEED;
      if (n.s > 1) n.alpha -= dt / 0.1;
      if (n.alpha <= 0) neck.splice(i, 1);
    }
  }

  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || !playing) return;
    const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
    last = now;
    step(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible || signal.aborted) return;
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
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  update();
  render();
  onResize(render);
  start();
}
