/**
 * «Kapasitansen til MOS-kondensatoren» for TFE4146, MOS-kondensatoren.
 *
 * Én idé: kapasitansen måles med et lite vekselsignal på gaten, og den er stor når ladningen
 * som følger signalet, sitter rett ved oksidet, og liten når den sitter langt inne. I
 * akkumulasjon er det hullene ved overflaten som kommer og går (C ≈ C_i). I utarming flytter
 * kanten av sonen seg (C_i i serie med ε_s/W). I sterk inversjon er det elektronene ved
 * overflaten, så C går tilbake til C_i, men bare når signalet er så langsomt at elektroner
 * rekker å dannes og forsvinne. Ved høy frekvens følger de ikke med, kanten av sonen flytter
 * seg i stedet, og C blir liggende på C_min. Streetman & Banerjee §6.4.2, fig. 6–16.
 *
 * Øverst står kondensatoren som i simuleringen «MOS-kondensatoren»: gaten, oksidet og p-type
 * silisium med dybden mot høyre, hull som røde ringer, akseptorioner som oransje «−» og
 * elektroner som blå prikker. Ladningen som følger signalet, blinker i takt med det. Under står
 * C/C_i mot V_G ved lav og høy frekvens, og punktet for gatespenningen.
 *
 * Modellen er den samme ideelle kondensatoren (N_a = 5·10¹⁵ cm⁻³, 10 nm SiO₂). C ved lav
 * frekvens er C_i i serie med dQ_s/dφ_s fra den eksakte Q_s(φ_s). Ved høy frekvens svarer bare
 * hullene og ionene: halvlederens kapasitans er dQ/dφ_s uten elektronleddet, regnet i likevekts-
 * punktet. Vekselsignalet er tegnet mye større og langsommere enn det virkelige.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const KT = 0.0259;
const Q = 1.602e-19;
const EPS0 = 8.854e-14;
const ES = 11.8 * EPS0;
const NA = 5e15;
const NI = 1.5e10;
const P0 = NA;
const N0 = (NI * NI) / NA;
const PHIF = KT * Math.log(NA / NI);
const CI = (3.9 * EPS0) / 10e-7;
const LD = Math.sqrt((ES * KT) / (Q * P0));
const LD_UM = LD * 1e4;

const A_ = (u) => Math.exp(-u) + u - 1; // hull og ioner
const B_ = (u) => (N0 / P0) * (Math.exp(u) - u - 1); // elektroner
const Fu = (u) => Math.sqrt(Math.max(0, A_(u) + B_(u)));
const Fm = (u) => Math.sqrt(Math.max(0, A_(u)));
const K = ES * Math.SQRT2 * (KT / LD);
const Qs = (phis) => -Math.sign(phis) * K * Fu(phis / KT);
const Qmaj = (phis) => -Math.sign(phis) * K * Fm(phis / KT);
const vgOf = (phis) => phis - Qs(phis) / CI;
function phisOf(vg) {
  let lo = -1.2;
  let hi = 1.3;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (vgOf(m) > vg) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
const deriv = (f, x, h = 2e-5) => Math.abs(f(x + h) - f(x - h)) / (2 * h);
const ser = (a, b) => (a * b) / (a + b);
const cLF = (vg) => ser(CI, deriv(Qs, phisOf(vg))) / CI;
const cHF = (vg) => ser(CI, deriv(Qmaj, phisOf(vg))) / CI;
const VT = (2 * Math.sqrt(ES * Q * NA * PHIF)) / CI + 2 * PHIF; // 0,755 V

const VG_MIN = -1;
const VG_MAX = 1.5;
const AMP = 0.08; // V, vekselsignalet slik det er tegnet
const PERIOD = 1.6; // s
const Y_UM = 0.7;
const NBULK = 50;
const UNIT = (NA * Y_UM * 1e-4) / NBULK;
const CAP = 46;
const NG = 240;
const KP = 7; // tegn i gruppen som følger signalet

// C–V-kurvene, regnet én gang.
const NCV = 150;
const CV = Array.from({ length: NCV + 1 }, (_, i) => {
  const vg = VG_MIN + ((VG_MAX - VG_MIN) * i) / NCV;
  return { vg, lf: cLF(vg), hf: cHF(vg) };
});
// C_min fra sonens største bredde W_m, som i teksten.
const WM = Math.sqrt((2 * ES * 2 * PHIF) / (Q * NA));
const CMIN = ES / WM / (CI + ES / WM);

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduce.matches;
  let vg = -0.6;
  let freq = "lav";
  let t = 0.4 * PERIOD; // stillbildet: signalet nær toppen

  // ── kontroller ──────────────────────────────────────────────────────────
  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",").replace("-", "−");
  const label = document.createElement("label");
  label.append("Gate ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(VG_MIN);
  input.max = String(VG_MAX);
  input.step = "0.05";
  input.value = String(vg);
  input.setAttribute("aria-label", "Gatespenningen V_G, målt fra substratet");
  label.append(out, input);
  out.textContent = `${NB(vg)} V`;
  input.addEventListener(
    "input",
    () => {
      vg = Math.round(Number(input.value) * 20) / 20;
      out.textContent = `${NB(vg)} V`;
      solve();
      render();
    },
    { signal },
  );
  const fPick = choiceRow({
    ariaLabel: "Frekvensen til vekselsignalet",
    label: "Frekvens",
    items: [
      { value: "lav", label: "Lav" },
      { value: "hoy", label: "Høy" },
    ],
    onPick: (v) => {
      freq = v;
      fPick.sync(freq);
      solve();
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
  controls.append(label, playBtn, fPick.el);
  fPick.sync(freq);

  // ── tilstanden ved V_G (uten signal) ─────────────────────────────────────
  const st = {
    phis: 0,
    u: new Float64Array(NG + 1),
    dens: new Float64Array(NG + 1),
    cum: new Float64Array(NG + 1),
    W: 0,
    nDraw: 0,
    c: 1,
    kind: "hull", // hull | sone | elektron
    dW: 0, // µm per volt for kanten av sonen
  };
  const compress = (x) => CAP * (1 - Math.exp(-x / CAP));
  function nSheet(phis) {
    if (phis <= 0.02) return 0;
    const n = 240;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const ph = ((i + 0.5) / n) * phis;
      s += (N0 * (Math.exp(ph / KT) - 1)) / ((Math.SQRT2 * KT * Fu(ph / KT)) / LD);
    }
    return (s * phis) / n;
  }
  function solve() {
    const phis = phisOf(vg);
    st.phis = phis;
    const dy = Y_UM / NG;
    const sub = 6;
    const h = dy / sub;
    const slope = (v) => (-Math.sign(v) * Math.SQRT2 * Fu(v)) / LD_UM;
    let v = phis / KT;
    st.u[0] = v;
    for (let i = 1; i <= NG; i++) {
      for (let k = 0; k < sub; k++) {
        const k1 = slope(v);
        const k2 = slope(v + 0.5 * h * k1);
        const k3 = slope(v + 0.5 * h * k2);
        const k4 = slope(v + h * k3);
        const nv = v + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        v = Math.sign(nv) !== Math.sign(v) && v !== 0 ? 0 : nv;
      }
      st.u[i] = v;
    }
    let excess = 0;
    for (let i = 0; i <= NG; i++) if (st.u[i] < 0) excess += (Math.exp(-st.u[i]) - 1) / NG;
    const trueExtra = excess * NBULK;
    const kk = trueExtra > 1e-9 ? compress(trueExtra) / trueExtra : 1;
    for (let i = 0; i <= NG; i++) st.dens[i] = st.u[i] < 0 ? 1 + (Math.exp(-st.u[i]) - 1) * kk : Math.exp(-st.u[i]);
    st.cum[NG] = 0;
    for (let i = NG - 1; i >= 0; i--) st.cum[i] = st.cum[i + 1] + (0.5 * (st.dens[i] + st.dens[i + 1])) / NG;
    let i = 0;
    while (i < NG && st.dens[i] < 0.5) i++;
    st.W = st.dens[0] < 0.5 ? (i / NG) * Y_UM : 0;
    st.nDraw = Math.round(compress(nSheet(phis) / UNIT));
    // Hvem som følger signalet: delene av dF/du for hull/ioner og for elektroner.
    const u = phis / KT;
    const aP = 1 - Math.exp(-u);
    const bP = (N0 / P0) * (Math.exp(u) - 1);
    const lf = cLF(vg);
    const hf = cHF(vg);
    st.c = freq === "lav" ? lf : hf;
    if (u < 0.6) st.kind = "hull";
    else if (freq === "lav" && bP > Math.abs(aP)) st.kind = "elektron";
    else st.kind = "sone";
    // Kanten flytter seg ΔW = ΔQ/qN_a, der ΔQ er ladningen per volt som sonen tar.
    const share = freq === "lav" ? Math.max(0, aP) / (Math.abs(aP) + bP || 1) : 1;
    st.dW = ((st.c * CI * share) / (Q * NA)) * 1e4; // µm per V
  }

  // Hullene står fast der tettheten sier.
  function yAt(c) {
    if (c <= 0) return 1;
    if (c >= st.cum[0]) return 0;
    let lo = 0;
    let hi = NG;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (st.cum[m] > c) lo = m;
      else hi = m;
    }
    const f = (st.cum[lo] - c) / (st.cum[lo] - st.cum[hi] || 1);
    return (lo + f) / NG;
  }
  const holeZ = Array.from({ length: 120 }, (_, i) => ((i * 0.618034) % 1) * 0.86 + 0.07);

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 330) return null;
    const x0 = 8;
    const mw = Math.round(Math.min(64, Math.max(44, w * 0.15)));
    const ow = Math.round(Math.min(22, Math.max(14, w * 0.045)));
    const xm = x0 + mw;
    const xs = xm + ow;
    const x1 = w - 8;
    const by0 = 26;
    const by1 = 112;
    const pw = Math.min(w, 560);
    const off = (w - pw) / 2;
    const px0 = off + 40;
    const px1 = off + pw - 14;
    const py0 = 160;
    const py1 = h - 26;
    return { w, h, x0, mw, ow, xm, xs, x1, by0, by1, px0, px1, py0, py1 };
  }
  const Y = (f) => G.xs + f * (G.x1 - G.xs);
  const xV = (v) => G.px0 + ((v - VG_MIN) / (VG_MAX - VG_MIN)) * (G.px1 - G.px0);
  const yC = (c) => G.py1 - c * (G.py1 - G.py0);

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  function device(sig) {
    const { x0, mw, xm, xs, x1, by0, by1 } = G;
    let s = "";
    const per = Math.max(4, Math.floor((by1 - by0 - 6) / 5));
    const zoneMoves = st.kind === "sone";
    const W = Math.max(0, st.W + (zoneMoves ? st.dW * AMP * sig : 0)) / Y_UM;
    // Hvor sterkt gruppen som følger signalet, vises: 0 … 1.
    const up = 0.5 + 0.5 * sig; // gaten over V_G
    const dn = 0.5 - 0.5 * sig; // gaten under V_G
    if (W > 0.01) {
      const xw = Y(W);
      s +=
        `<rect x="${P(xs)}" y="${P(by0)}" width="${P(xw - xs)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
        `<path d="M ${P(xw)} ${P(by0)} V ${P(by1)}" style="stroke:var(--accent)" stroke-width="${zoneMoves ? 2.2 : 1}" stroke-dasharray="3 3" opacity="${zoneMoves ? 1 : 0.6}"/>`;
      if (xw - xs > 22) {
        const yb = by1 + 12;
        s +=
          `<path d="M ${P(xs)} ${P(yb - 4)} v 8 M ${P(xs)} ${P(yb)} H ${P(xw)} M ${P(xw)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
          tag((xs + xw) / 2, yb + 13, "W", "middle", "var(--fg)", it + halo);
      }
    }
    s +=
      `<rect x="${P(x0)}" y="${P(by0)}" width="${P(mw)}" height="${P(by1 - by0)}" rx="3" style="fill:var(--muted)" fill-opacity="0.28"/>` +
      `<rect x="${P(xm)}" y="${P(by0)}" width="${P(xs - xm)}" height="${P(by1 - by0)}" style="fill:var(--border)" fill-opacity="0.55" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(xs)}" y="${P(by0)}" width="${P(x1 - xs)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(x0 + 3, by0 - 8, "gate", "start", "var(--fg)") +
      tag((xm + xs) / 2 + 4, by0 - 8, "oksid", "middle", "var(--fg)") +
      tag(x1 - 2, by0 - 8, "p-Si", "end", "var(--fg)");

    // Ionene: sterke inne i sonen.
    const rows = 5;
    const cols = NBULK / rows;
    let faint = "";
    let strong = "";
    let nStrong = 0;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const f = (c + 0.25 + 0.5 * (r % 2)) / cols;
        const x = Y(f);
        const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
        const g = `M ${P(x - 2.4)} ${P(y)} h 4.8 `;
        if (f < W) (strong += g), nStrong++;
        else faint += g;
      }
    s +=
      `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.4" opacity="0.35"/>` +
      `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.8"/>`;

    // Hullene, der tettheten ved V_G sier.
    const n = Math.round(st.cum[0] * NBULK);
    let dots = "";
    for (let i = 0; i < n; i++) {
      const f = yAt((i + 0.5) / NBULK);
      if (zoneMoves && f < W) continue;
      dots += `<circle cx="${P(Y(f))}" cy="${P(by0 + 4 + holeZ[i % holeZ.length] * (by1 - by0 - 8))}" r="2.3"/>`;
    }
    s += `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${dots}</g>`;
    // Hull som følger signalet: flere når gaten går ned.
    if (st.kind === "hull") {
      const acc = st.phis < -0.03;
      const f0 = acc ? 0.035 : 0.012;
      const spread = acc ? 0.035 : 0.17;
      let g = "";
      for (let j = 0; j < KP; j++) {
        const f = f0 + spread * ((j * 0.618034) % 1);
        g += `<circle cx="${P(Y(f))}" cy="${P(by0 + 8 + ((j * 0.37 + 0.1) % 1) * (by1 - by0 - 16))}" r="2.3"/>`;
      }
      s += `<g fill="none" style="stroke:var(--red)" stroke-width="2" opacity="${dn.toFixed(2)}">${g}</g>`;
    }

    // Elektronene ved overflaten; ved lav frekvens følger en gruppe av dem signalet.
    let ed = "";
    for (let k = 0; k < st.nDraw; k++) {
      const x = xs + 3.5 + Math.floor(k / per) * 4.6;
      const y = by0 + 5 + (k % per) * 5 + (Math.floor(k / per) % 2) * 2.5;
      ed += `<circle cx="${P(x)}" cy="${P(y)}" r="2"/>`;
    }
    s += `<g style="fill:var(--indigo)">${ed}</g>`;
    if (st.kind === "elektron") {
      let g = "";
      const col = Math.ceil(st.nDraw / per);
      for (let j = 0; j < KP; j++) {
        const x = xs + 3.5 + col * 4.6;
        const y = by0 + 8 + ((j * 0.37 + 0.1) % 1) * (by1 - by0 - 16);
        g += `<circle cx="${P(x)}" cy="${P(y)}" r="2"/>`;
      }
      s += `<g style="fill:var(--indigo)" opacity="${up.toFixed(2)}">${g}</g>`;
    }

    // Ladningen på gaten ved V_G: + mot sonen og elektronene, elektroner mot hullene.
    const neg = st.phis < -0.015;
    const m = neg ? Math.max(0, n - NBULK) : st.phis > 0.015 ? nStrong + st.nDraw : 0;
    let g = "";
    let slot = 0;
    const at = (j) => [xm - 4 - Math.floor(j / per) * 5, by0 + 5 + (j % per) * 5];
    for (; slot < m; slot++) {
      const [x, y] = at(slot);
      if (x < x0 + 3) break;
      g += neg ? `<circle cx="${P(x)}" cy="${P(y)}" r="2"/>` : `M ${P(x - 2)} ${P(y)} h 4 M ${P(x)} ${P(y - 2)} v 4 `;
    }
    s += neg ? `<g style="fill:var(--indigo)">${g}</g>` : `<path d="${g}" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    // Gruppen på gaten som følger signalet: elektroner i akkumulasjon, + ellers.
    let pg = "";
    for (let j = 0; j < KP; j++) {
      const [x, y] = at(slot + j);
      if (x < x0 + 3) break;
      pg += `M ${P(x - 2)} ${P(y)} h 4 M ${P(x)} ${P(y - 2)} v 4 `;
    }
    const holeLike = st.kind === "hull";
    s += holeLike
      ? `<g style="fill:var(--indigo)" opacity="${dn.toFixed(2)}">${pg.replace(/M (\S+) (\S+) h 4 M \S+ \S+ v 4 /g, (_, x, y) => `<circle cx="${(Number(x) + 2).toFixed(1)}" cy="${y}" r="2"/>`)}</g>`
      : `<path d="${pg}" style="stroke:var(--fg)" stroke-width="1.5" opacity="${up.toFixed(2)}"/>`;
    void mw;
    return s;
  }

  function plot(sig) {
    const { px0, px1, py0, py1 } = G;
    let s = "";
    s += `<path d="M ${P(px0)} ${P(py0 - 6)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [-1, 0, 1]) s += `<path d="M ${P(xV(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>` + tag(xV(v), py1 + 15, v === 0 ? "0" : `${NB(v, 0)} V`, "middle");
    // C_i og C_min.
    s +=
      `<path d="M ${P(px0)} ${P(yC(1))} H ${P(px1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
      tag(px0 - 6, yC(1) + 4, sub("C", "i"), "end", "var(--fg)", it) +
      `<path d="M ${P(px0)} ${P(yC(CMIN))} H ${P(px1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
      tag(px0 - 6, yC(CMIN) + 4, sub("C", "min"), "end", "var(--fg)", it) +
      tag(px0 + 6, py0 - 8, "C", "start", "var(--fg)", it + halo) +
      tag(px1, py1 + 15, sub("V", "G"), "end", "var(--fg)", it);
    // V_T.
    s += `<path d="M ${P(xV(VT))} ${P(py1)} V ${P(py0)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>` + tag(xV(VT) + 4, py0 + 8, sub("V", "T"), "start", "var(--fg)", it + halo);
    const path = (key) => CV.map((p, i) => `${i ? "L" : "M"} ${P(xV(p.vg))} ${P(yC(p[key]))}`).join(" ");
    const other = freq === "lav" ? "hf" : "lf";
    const cur = freq === "lav" ? "lf" : "hf";
    s += `<path d="${path(other)}" fill="none" style="stroke:var(--muted)" stroke-width="1.1" stroke-dasharray="4 3"/>`;
    s += `<path d="${path(cur)}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
    const last = CV[NCV];
    s +=
      tag(xV(last.vg) - 2, yC(last.lf) + 14, "lav", "end", freq === "lav" ? "var(--accent)" : "var(--muted)", halo) +
      tag(xV(last.vg) - 2, yC(last.hf) - 6, "høy", "end", freq === "hoy" ? "var(--accent)" : "var(--muted)", halo);
    // Punktet, som svinger med signalet langs kurven.
    const v = Math.max(VG_MIN, Math.min(VG_MAX, vg + AMP * sig));
    const c = freq === "lav" ? cLF(v) : cHF(v);
    s +=
      `<path d="M ${P(xV(vg - AMP))} ${P(py1 - 3)} H ${P(xV(vg + AMP))}" style="stroke:var(--accent)" stroke-width="2"/>` +
      `<circle cx="${P(xV(v))}" cy="${P(yC(c))}" r="4.2" style="fill:var(--accent);stroke:var(--canvas-bg)" stroke-width="1.5"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    const sig = Math.sin((2 * Math.PI * t) / PERIOD);
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${device(sig)}${plot(sig)}</svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || !playing) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    t = (t + dt) % PERIOD;
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || !playing || signal.aborted) return;
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
  solve();
  onResize(render);
  render();
  start();
}
