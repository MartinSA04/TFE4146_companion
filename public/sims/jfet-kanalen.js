/**
 * «Kanalen i JFET-en» for TFE4146, JFET-en.
 *
 * Én idé: spenningen V_x langs kanalen bestemmer sperrespenningen V_x − V_G over gateovergangen i
 * hvert punkt, så romladningssonen er bredest ved drain. Når sonene møtes der, er kanalen klemt av,
 * den åpne delen slutter å endre seg, og strømmen metter. Gatespenningen bestemmer hvor brede sonene
 * er fra før, og drain-enden bryter gjennom først. Streetman & Banerjee §6.2, fig. 6–3 til 6–5.
 *
 * Øverst står kanalen sett fra siden: source til venstre, drain til høyre, p⁺-gatene over og under.
 * Sonene er tonet, med donorionene som «+» (sterke i sonen, svake der elektronene dekker dem, som i
 * pn-overgangen), og elektronene er blå prikker i den åpne delen. Under, på samme x-akse, står
 * spenningen V_x langs kanalen og den stiplede linjen V_D(sat.), spenningen der kanalen klemmes av.
 * Nederst står I_D mot V_D for fire gatespenninger, kurven for gatespenningen nå, den stiplede kurven
 * gjennom knekkene og punktet for spenningene som er valgt.
 *
 * Modellen: n-kanal med N_d = 10¹⁶ cm⁻³, halvhøyde a = 0,8 µm, lengde L = 10 µm, Z/L = 10,
 * μ_n = 1200 cm²/V·s og p⁺-gater med 10¹⁹ cm⁻³. Det gir V_p = qN_da²/2ε = 4,91 V, V_0 = 0,874 V og
 * G_0 = (Z/L)·2aqμ_nN_d = 3,08 mS. Med gradvis kanal er I_D = G_0·F(V_D), der
 * F(v) = ∫₀^v h/a dv' = v − ⅔V_p[s(v)^{3/2} − s(0)^{3/2}] og s(v) = (V_0 + v − V_G)/V_p, holdt
 * konstant over V_D(sat.) = V_G + V_p − V_0 (den ideelle modellen). V_x(x) i den åpne delen finnes fra
 * F(V_x) = F(V_eff)·x/x_p. Over avklemming er den avklemte delen ΔL = [2ε(V_D − V_D(sat.))/qN_d]^{1/2}
 * lang, og spenningen stiger kvadratisk over den, som i en romladningssone. Skredet er lagt ved
 * V_D − V_G = 10 V, lavere enn de omtrent 60 V en virkelig overgang med denne dopingen tåler.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const V0 = 0.874; // V, kontaktpotensialet i gateovergangen
const VP = 4.91; // V, avklemmingsspenningen qN_da²/2ε
const G0 = 3.076; // mS
const VBR = 10; // V, sperrespenningen der skredet kommer (lagt lavt, se over)
const L_UM = 10; // µm, kanallengden
const DL_K = 0.361; // µm/√V, ΔL = DL_K·√(V_D − V_D(sat.))
const VD_MAX = 12;
const VG_MIN = -5;
const FAMILY = [0, -1, -2, -3];
const I_TOP = 3.6; // mA, toppen av strømaksen
const VG_OFF = V0 - VP; // −4,04 V, gatespenningen som stenger kanalen

const TAU = 0.35; // s, innstillingstiden for spenningene
const R = 2.4; // px, prikkens radius
const DOT_AREA = 105; // px² åpen kanal per prikk
const TRANSIT = 3.4; // s gjennom kanalen i metning ved V_G = 0

const sOf = (v, vg) => Math.max(0, V0 + v - vg) / VP;
/** ∫₀^v h/a dv', i volt. */
const F = (v, vg) => v - (2 / 3) * VP * (Math.min(1, sOf(v, vg)) ** 1.5 - Math.min(1, sOf(0, vg)) ** 1.5);
const vsatOf = (vg) => vg + VP - V0;
/** Strømmen gjennom kanalen i mA (den ideelle modellen). */
const ich = (vd, vg) => {
  const vs = vsatOf(vg);
  if (vs <= 0) return 0;
  return G0 * Math.max(0, F(Math.min(vd, vs), vg));
};
/** Skredstrømmen fra drain til gaten, i mA. */
const ibr = (vd, vg) => Math.min(6, 0.02 * Math.exp((vd - vg - VBR) / 0.22));
/** Sonebredden som andel av halvhøyden a. */
const wFrac = (vx, vg) => Math.min(1, Math.sqrt(sOf(vx, vg)));
const I_DSS = ich(10, 0);

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduce.matches;
  let vdT = 2;
  let vgT = 0;
  let vdC = vdT;
  let vgC = vgT;
  let phase = 0;

  // ── kontroller ────────────────────────────────────────────────────────────
  const NB = (x, k = 1) => x.toFixed(k).replace(".", ",").replace("-", "−");
  function slider(name, aria, min, max, step, value, set) {
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
    out.textContent = `${NB(value)} V`;
    input.addEventListener(
      "input",
      () => {
        const v = Math.round(Number(input.value) * 10) / 10;
        set(v);
        out.textContent = `${NB(v)} V`;
        changed();
      },
      { signal },
    );
    return label;
  }
  const sD = slider("Drain", "Spenningen V_D på drain, målt fra source", 0, VD_MAX, 0.1, vdT, (v) => (vdT = v));
  const sG = slider("Gate", "Spenningen V_G på gaten, målt fra source", VG_MIN, 0, 0.1, vgT, (v) => (vgT = v));
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
  controls.append(sD, sG, playBtn);

  function changed() {
    if (!playing) {
      vdC = vdT;
      vgC = vgT;
      neck.length = 0;
      pairs.length = 0;
    }
    update();
    render();
    start();
  }

  // ── tilstanden i kanalen ──────────────────────────────────────────────────
  const NS = 160; // punkter langs kanalen
  const st = {
    vx: new Float64Array(NS + 1), // V_x i hvert punkt
    wf: new Float64Array(NS + 1), // W/a i hvert punkt
    cum: new Float64Array(NS + 1), // åpent areal fra source, i enheter av a·L
    xp: 1, // avklemmingspunktet, andel av L
    open: 1, // åpent areal, andel av hele kanalen
    off: false,
    pinched: false,
    vs: 0,
    I: 0,
    Ib: 0,
  };

  function update() {
    const vd = vdC;
    const vg = vgC;
    const vs = vsatOf(vg);
    st.vs = vs;
    st.off = vs <= 0;
    st.pinched = !st.off && vd > vs;
    st.I = ich(vd, vg);
    st.Ib = ibr(vd, vg);
    st.xp = st.pinched ? 1 - (DL_K * Math.sqrt(vd - vs)) / L_UM : 1;
    const veff = st.off ? 0 : Math.min(vd, vs);
    const fe = F(veff, vg);
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      let vx;
      if (st.off) vx = 0;
      else if (s <= st.xp) {
        // F(V_x) = F(V_eff)·s/x_p, og F stiger monotont på [0, V_eff].
        const target = fe * (s / st.xp);
        let lo = 0;
        let hi = veff;
        for (let k = 0; k < 32; k++) {
          const mid = (lo + hi) / 2;
          if (F(mid, vg) > target) hi = mid;
          else lo = mid;
        }
        vx = (lo + hi) / 2;
      } else {
        const u = (s - st.xp) / (1 - st.xp);
        vx = vs + (vd - vs) * u * u;
      }
      st.vx[i] = vx;
      st.wf[i] = st.off || s > st.xp ? 1 : wFrac(vx, vg);
    }
    st.cum[0] = 0;
    for (let i = 1; i <= NS; i++) st.cum[i] = st.cum[i - 1] + (2 - st.wf[i - 1] - st.wf[i]) / (2 * NS);
    st.open = st.cum[NS];
  }

  /** x (andel av L) der det åpne arealet fra source er andelen f av alt åpent areal. */
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
  /** W/a i punktet s (andel av L), interpolert. */
  function wAt(s) {
    const p = Math.max(0, Math.min(NS, s * NS));
    const i = Math.min(NS - 1, Math.floor(p));
    const k = p - i;
    return st.wf[i] * (1 - k) + st.wf[i + 1] * k;
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let G = null;
  let dots = [];
  const neck = [];
  const pairs = [];

  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 380) return null;
    const x0 = 34; // kanalen begynner (source-kontakten står rett til venstre)
    const x1 = w - 30; // kanalen slutter
    const gt = 13; // gatetykkelsen
    const A = Math.round(clamp(w * 0.11, 32, 46)); // halvhøyden a i px
    const cy0 = 18 + gt; // øvre gatekant mot kanalen
    const yc = cy0 + A;
    const cy1 = cy0 + 2 * A;
    const devB = cy1 + gt + 14; // bunnen av tverrsnittet
    const vy0 = devB + 14; // V_x-stripen
    const vy1 = vy0 + 72;
    // Diagrammet, høyst 600 px bredt og midtstilt.
    const pw = Math.min(w, 600);
    const off = (w - pw) / 2;
    const px0 = off + 34;
    const px1 = off + pw - 18;
    const py0 = vy1 + 34;
    const py1 = h - 22;
    const n = clamp(Math.round(((x1 - x0) * 2 * A * 0.6) / DOT_AREA), 40, 260);
    if (dots.length !== n) dots = Array.from({ length: n }, () => ({ u: Math.random(), t: 2 * Math.random() - 1, k: Math.random() }));
    return { w, h, x0, x1, L: x1 - x0, gt, A, cy0, yc, cy1, devB, vy0, vy1, px0, px1, py0, py1 };
  }
  const X = (s) => G.x0 + s * G.L;
  const yV = (v) => G.vy1 - (Math.min(v, VD_MAX) / VD_MAX) * (G.vy1 - G.vy0);
  const xI = (v) => G.px0 + (v / VD_MAX) * (G.px1 - G.px0);
  const yI = (i) => G.py1 - (Math.min(i, I_TOP + 0.3) / I_TOP) * (G.py1 - G.py0);

  // ── tegning ───────────────────────────────────────────────────────────────
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  function device() {
    const { w, x0, x1, L, gt, A, cy0, yc, cy1 } = G;
    let s = "";
    // Ledningene: source og drain på midtlinjen, gaten opp og ned fra midten.
    const xg = x0 + 0.5 * L;
    s +=
      `<path d="M 2 ${P(yc)} H ${P(x0 - 3)} M ${P(x1 + 3)} ${P(yc)} H ${P(w - 2)} M ${P(xg)} ${P(cy0 - gt)} V 4 M ${P(xg)} ${P(cy1 + gt)} V ${P(cy1 + gt + 12)}" style="stroke:var(--border-strong)" stroke-width="1.4" fill="none"/>` +
      tag(4, yc - 7, "S", "start", "var(--fg)") +
      tag(w - 4, yc - 7, "D", "end", "var(--fg)") +
      tag(xg + 7, 12, "G", "start", "var(--fg)") +
      tag(xg + 7, cy1 + gt + 12, "G", "start", "var(--fg)");
    // Gatene og kontaktene.
    s +=
      `<rect x="${P(x0)}" y="${P(cy0 - gt)}" width="${P(L)}" height="${gt}" style="fill:var(--red)" fill-opacity="0.16" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(x0)}" y="${P(cy1)}" width="${P(L)}" height="${gt}" style="fill:var(--red)" fill-opacity="0.16" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(x0 + 6, cy0 - gt / 2 + 4, "p⁺", "start", "var(--fg)") +
      tag(x0 + 6, cy1 + gt / 2 + 4, "p⁺", "start", "var(--fg)") +
      `<rect x="${P(x0)}" y="${P(cy0)}" width="${P(L)}" height="${P(2 * A)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(x0 - 1.5)} ${P(cy0)} V ${P(cy1)} M ${P(x1 + 1.5)} ${P(cy0)} V ${P(cy1)}" style="stroke:var(--fg)" stroke-width="3"/>`;

    // Sonene: tonet, med stiplet kant.
    const pts = [];
    for (let i = 0; i <= NS; i += 2) pts.push(i / NS);
    const edge = (sign) => pts.map((p, i) => `${i ? "L" : "M"} ${P(X(p))} ${P(yc + sign * A * (1 - wAt(p)))}`).join(" ");
    const top = edge(-1);
    const bot = edge(1);
    s +=
      `<path d="M ${P(x0)} ${P(cy0)} ${top.replace(/^M/, "L")} L ${P(x1)} ${P(cy0)} Z" style="fill:var(--accent)" fill-opacity="0.12"/>` +
      `<path d="M ${P(x0)} ${P(cy1)} ${bot.replace(/^M/, "L")} L ${P(x1)} ${P(cy1)} Z" style="fill:var(--accent)" fill-opacity="0.12"/>`;
    if (!st.off) s += `<path d="${top} ${bot}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" fill="none" opacity="0.75"/>`;

    // Donorionene i et fast gitter: sterke i sonen, svake i den åpne kanalen.
    const dx = 13;
    const dy = 11;
    let strong = "";
    let faint = "";
    for (let col = 0; ; col++) {
      const x = x0 + 7 + col * dx;
      if (x > x1 - 5) break;
      const wpx = wAt((x - x0) / L) * A;
      for (let row = 0; ; row++) {
        const d = 6 + row * dy + (col % 2) * 5;
        if (d > A - 2) break;
        const p = `M ${P(x - 2)} ${P(cy0 + d)} h 4 M ${P(x)} ${P(cy0 + d - 2)} v 4 M ${P(x - 2)} ${P(cy1 - d)} h 4 M ${P(x)} ${P(cy1 - d - 2)} v 4 `;
        if (d < wpx - 1) strong += p;
        else faint += p;
      }
    }
    s += `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.28"/>`;
    s += `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.4"/>`;

    // Brakettene W og h, en femtedel inn i kanalen, øverst.
    if (!st.off) {
      const sb = 0.2;
      const xb = X(sb);
      const wpx = wAt(sb) * A;
      const hpx = A - wpx;
      const brk = (yA, yB) =>
        `<path d="M ${P(xb)} ${P(yA)} V ${P(yB)} M ${P(xb - 3)} ${P(yA)} h 6 M ${P(xb - 3)} ${P(yB)} h 6" style="stroke:var(--fg)" stroke-width="1" fill="none"/>`;
      s += `<path d="M ${P(x0)} ${P(yc)} H ${P(X(st.xp))}" style="stroke:var(--border-strong)" stroke-width="1" stroke-dasharray="2 4"/>`;
      if (wpx >= 12) s += brk(cy0, cy0 + wpx) + tag(xb + 6, cy0 + wpx / 2 + 4, "W", "start", "var(--fg)", it + halo);
      if (hpx >= 12) s += brk(cy0 + wpx, yc) + tag(xb + 6, cy0 + wpx + hpx / 2 + 4, "h", "start", "var(--fg)", it + halo);
    }

    // Elektronene i den åpne kanalen; antallet følger det åpne arealet, så tettheten er N_d overalt.
    let dd = "";
    const frac = clamp(st.open, 0, 1);
    for (const d of dots) {
      if (d.k >= frac) continue;
      const f = (((d.u + phase) % 1) + 1) % 1;
      const sx = xAtArea(f);
      const hh = (1 - wAt(sx)) * A;
      if (hh < R + 0.5) continue;
      const fade = clamp(Math.min(f, 1 - f) / 0.03, 0, 1);
      dd += `<circle cx="${P(X(sx))}" cy="${P(yc + d.t * (hh - R - 0.5))}" r="${R}" fill-opacity="${P(0.9 * fade)}"/>`;
    }
    for (const n of neck) dd += `<circle cx="${P(X(n.s))}" cy="${P(yc + n.dy)}" r="${R}" fill-opacity="${P(0.9 * n.alpha)}"/>`;
    for (const p of pairs) if (p.kind === "e") dd += `<circle cx="${P(p.x)}" cy="${P(p.y)}" r="${R}" fill-opacity="${P(0.9 * p.alpha)}"/>`;
    s += `<g style="fill:var(--indigo)">${dd}</g>`;
    let hh = "";
    for (const p of pairs) if (p.kind === "h") hh += `<circle cx="${P(p.x)}" cy="${P(p.y)}" r="${R}" fill="none" stroke-width="1.4" stroke-opacity="${P(p.alpha)}"/>`;
    if (hh) s += `<g style="stroke:var(--red)">${hh}</g>`;

    // Strømmen inn i drain, motsatt vei av elektronene.
    const I = st.I + st.Ib;
    if (I > 0.02) {
      const len = 6 + 16 * Math.min(1, I / I_DSS);
      const xa1 = x1 + 6;
      const ya = yc + 9;
      s += `<path d="M ${P(xa1 + len)} ${P(ya)} H ${P(xa1)} M ${P(xa1 + 5)} ${P(ya - 3.5)} L ${P(xa1)} ${P(ya)} L ${P(xa1 + 5)} ${P(ya + 3.5)}" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += tag(w - 4, ya + 15, sub("I", "D"), "end", "var(--accent)", it + halo);
    }

    // Merkelapper for tilstanden.
    if (st.off) s += tag(x0 + L / 2, yc + 4, "stengt", "middle", "var(--fg)", halo);
    else if (st.Ib >= 0.05) s += tag(X(st.xp) - 6, yc - 8, "skred", "end", "var(--fg)", halo);
    else if (st.pinched) s += tag(X(st.xp) - 6, yc - 8, "avklemt", "end", "var(--fg)", halo);
    return s;
  }

  function strip() {
    const { x0, x1, vy0, vy1 } = G;
    let s = "";
    s += `<path d="M ${P(x0)} ${P(vy0 - 4)} V ${P(vy1)} H ${P(x1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [4, 8, 12]) s += `<path d="M ${P(x0)} ${P(yV(v))} h -3" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(x0 - 6, yV(0) + 4, "0", "end") + tag(x0 - 6, yV(4) + 4, "4", "end") + tag(x0 - 6, yV(8) + 4, "8", "end") + tag(x0 - 6, yV(12) + 6, "12", "end");
    s += tag(x0 + 6, vy0 + 6, sub("V", "x"), "start", "var(--fg)", it + halo);
    s += tag(x1 + 2, vy1 + 14, "x", "end", "var(--fg)", it);
    if (st.off) return s + tag((x0 + x1) / 2, (vy0 + vy1) / 2 + 4, "kanalen er stengt", "middle", "var(--muted)", halo);
    // Spenningen der kanalen klemmes av.
    if (st.vs < VD_MAX) {
      s += `<path d="M ${P(x0)} ${P(yV(st.vs))} H ${P(x1)}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
      // Merket står over linjen når kurven er under den, og under linjen ellers.
      const above = st.vx[Math.round(NS * 0.5)] < st.vs - 1.2 || yV(st.vs) - vy0 > 14;
      s += tag(x0 + 8, yV(st.vs) + (above ? -5 : 13), `${sub("V", "D")}(sat.)`, "start", "var(--fg)", halo);
    }
    // V_x langs kanalen.
    let d = "";
    for (let i = 0; i <= NS; i += 2) d += `${i ? "L" : "M"} ${P(X(i / NS))} ${P(yV(st.vx[i]))} `;
    s += `<path d="${d}" fill="none" style="stroke:var(--indigo)" stroke-width="1.9" stroke-linejoin="round"/>`;
    return s;
  }

  function curvePath(vg) {
    const n = 140;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const v = (i / n) * VD_MAX;
      const I = ich(v, vg) + ibr(v, vg);
      d += `${i ? "L" : "M"} ${P(xI(v))} ${P(yI(I))} `;
      if (I > I_TOP + 0.3) break;
    }
    return d;
  }

  function plot() {
    const { px0, px1, py0, py1 } = G;
    let s = "";
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [4, 8, 12]) s += `<path d="M ${P(xI(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const i of [1, 2, 3]) s += `<path d="M ${P(px0)} ${P(yI(i))} h -4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(px0, py1 + 14, "0", "middle") + tag(xI(4), py1 + 14, "4", "middle") + tag(xI(8), py1 + 14, "8", "middle") + tag(xI(12), py1 + 14, "12 V", "end");
    for (const i of [1, 2, 3]) s += tag(px0 - 7, yI(i) + 4, String(i), "end");
    s += tag(px0 - 7, py0 + 4, "mA", "end");
    s += tag(xI(10.4), py1 - 7, sub("V", "D"), "middle", "var(--fg)", it + halo) + tag(px0 + 6, py0 + 6, sub("I", "D"), "start", "var(--fg)", it + halo);
    // Kurvene for faste gatespenninger, merket over platået.
    let fam = "";
    for (const vg of FAMILY) fam += curvePath(vg);
    s += `<path d="${fam}" fill="none" style="stroke:var(--muted)" stroke-width="1.1"/>`;
    for (const vg of FAMILY) s += tag(xI(5.6), yI(ich(5.6, vg)) - 5, vg === 0 ? "0 V" : `${NB(vg, 0)} V`, "start", "var(--muted)", halo);
    // Knekkene.
    let locus = "";
    for (let k = 0; k <= 50; k++) {
      const vg = VG_OFF * (1 - k / 50);
      locus += `${k ? "L" : "M"} ${P(xI(vsatOf(vg)))} ${P(yI(ich(vsatOf(vg), vg)))} `;
    }
    s += `<path d="${locus}" fill="none" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    s += tag(xI(vsatOf(0)) - 5, yI(I_DSS) - 9, `${sub("V", "D")}(sat.)`, "end", "var(--fg)", halo);
    // Kurven for gatespenningen nå, og punktet.
    s += `<path d="${curvePath(vgC)}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
    // Punktet; går strømmen over toppen av diagrammet, står det der kurven forlater det, med en pil opp.
    const I = st.I + st.Ib;
    const cap = I_TOP + 0.3;
    let vDot = vdC;
    if (I > cap) {
      let lo = 0;
      let hi = vdC;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (ich(m, vgC) + ibr(m, vgC) > cap) hi = m;
        else lo = m;
      }
      vDot = (lo + hi) / 2;
      s += `<path d="M ${P(xI(vDot) - 4)} ${P(yI(cap) - 8)} l 4 -5 l 4 5" fill="none" style="stroke:var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    s += `<circle cx="${P(xI(vDot))}" cy="${P(yI(Math.min(I, cap)))}" r="4.2" style="fill:var(--accent);stroke:var(--canvas-bg)" stroke-width="1.5"/>`;
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
  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    vdC += (vdT - vdC) * k;
    vgC += (vgT - vgC) * k;
    if (Math.abs(vdT - vdC) < 1e-3) vdC = vdT;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    update();
    // Fasen går med strømmen delt på det åpne arealet: smal kanal, raske elektroner.
    const open0 = 0.6;
    if (st.open > 1e-3 && st.I > 1e-4) phase = (phase + (dt * (st.I / I_DSS) * open0) / (TRANSIT * st.open)) % 1;
    // Elektroner gjennom den avklemte delen, med samme fluks som kanalen fører.
    if (G && st.pinched && st.I > 0.01) {
      const rate = (dots.length * (st.I / I_DSS) * open0) / TRANSIT;
      if (Math.random() < rate * dt) neck.push({ s: st.xp, dy: (Math.random() - 0.5) * 3, alpha: 1 });
    }
    for (let i = neck.length - 1; i >= 0; i--) {
      const n = neck[i];
      n.s += dt * 1.4;
      if (n.s > 1) n.alpha -= dt / 0.1;
      if (n.alpha <= 0) neck.splice(i, 1);
    }
    // Skred ved drain-enden av gateovergangene: hull til gaten, elektroner til drain.
    if (G && st.Ib > 0.02 && Math.random() < Math.min(30, 10 * st.Ib) * dt) {
      const top = Math.random() < 0.5;
      const x = G.x1 - 3 - 8 * Math.random();
      const y0 = top ? G.cy0 + 4 : G.cy1 - 4;
      pairs.push({ kind: "h", x, y: y0, vx: 0, vy: top ? -36 : 36, alpha: 1 });
      pairs.push({ kind: "e", x, y: y0 + (top ? 5 : -5), vx: 50, vy: 0, alpha: 1 });
    }
    for (let i = pairs.length - 1; i >= 0; i--) {
      const p = pairs[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const out = p.kind === "h" ? p.y < G.cy0 - G.gt + 3 || p.y > G.cy1 + G.gt - 3 : p.x > G.x1 + 1;
      if (out) p.alpha -= dt / 0.12;
      if (p.alpha <= 0) pairs.splice(i, 1);
    }
    if (pairs.length > 60) pairs.splice(0, pairs.length - 60);
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
