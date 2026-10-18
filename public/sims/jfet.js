/**
 * Kanalen i en n-kanal-JFET, for TFE4146 modul 09.
 * Én idé: sperrespenningen over gateovergangen er V_x − V_G og størst ved
 * drain, så sonene er bredest og kanalen smalest der. Når sonene møtes ved
 * drain, er kanalen klemt av, og strømmen metter.
 *
 * Øverst står JFET-en sett fra siden: source til venstre, drain til høyre,
 * p⁺-gatene over og under kanalen. Romladningssonene er tonet med de
 * avdekkede donorionene som ⊕-ringer, og bredden i punktet x følger
 * W(x)/a = [(V_0 + V_x − V_G)/V_p]^{1/2}. Elektronene er prikker i
 * den åpne delen. Hver prikk har en fast lodd u langs kanalen og en fast
 * andel t av halvhøyden; x er stedet der det åpne arealet fra source har nådd
 * andelen u + fase, så tettheten er den samme overalt (N_d), og prikkene går
 * fortere der kanalen er smal. Fasen går med strømmen. Er kanalen klemt av,
 * feies elektronene langs midtlinjen gjennom den avklemte delen til drain.
 *
 * Nederst står I_D mot V_D for V_G = 0, −1, −2 og −3 V, kurven for den valgte
 * gatespenningen, den stiplede kurven gjennom knekkene ved
 * V_D(sat.) = V_G + V_p − V_0 og punktet for spenningene som er valgt. Kurvene
 * er den gradvise kanalen, F(v) = v − ⅔[(V_0 + v − V_G)^{3/2} − (V_0 − V_G)^{3/2}]/V_p^{1/2},
 * holdt konstant over V_D(sat.), pluss et skredledd som vokser bratt når
 * V_D − V_G når V_BR. Strømmen er i enheter av strømmen i metning ved V_G = 0.
 *
 * V_x(x) i den åpne kanalen finnes fra F(V_x) = F(V_D,eff)·x/x_e, der x_e er
 * avklemmingspunktet. Det flytter seg litt inn fra drain når V_D øker forbi
 * V_D(sat.), og spenningen over den avklemte delen er V_D − V_D(sat.).
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const V0 = 0.9; // V, kontaktpotensialet i gateovergangen
const VP = 4.9; // V, avklemmingsspenningen qN_d a²/2ε
const VG_OFF = V0 - VP; // V, gatespenningen som stenger kanalen
const VBR = 10; // V, skredgjennombrudd i gateovergangen
const VD_MAX = 12;
const VG_MIN = -5;
const FAMILY = [0, -1, -2, -3];
const I_TOP = 1.18; // toppen av strømaksen, i enheter av I_DSS

const TAU = 0.35; // s, innstillingstiden for spenningene
const R = 2.6; // px, elektronprikkens radius
const NDOT_MAX = 320; // tak på antallet prikker
const DOT_AREA = 280; // px² per prikk, så tettheten er den samme på alle skjermer
let NDOT = 110; // prikker i en helt åpen kanal, settes av layout()
const TRANSIT = 3.2; // s, tiden en prikk bruker gjennom kanalen i metning ved V_G = 0

const F = (v, vg) => v - (2 / 3) * (Math.max(0, V0 + v - vg) ** 1.5 - Math.max(0, V0 - vg) ** 1.5) / Math.sqrt(VP);
const F_SAT0 = F(-VG_OFF, 0);
const vsatOf = (vg) => vg - VG_OFF;
/** Strømmen gjennom kanalen, i enheter av I_DSS. */
const ich = (vd, vg) => {
  const vs = vsatOf(vg);
  if (vs <= 0) return 0;
  return Math.max(0, F(Math.min(vd, vs), vg) / F_SAT0);
};
/** Skredstrømmen fra drain til gaten. */
const ibr = (vd, vg) => Math.min(4, 0.02 * Math.exp((vd - vg - VBR) / 0.25));
/** Sonebredden som andel av halvhøyden a. */
const wFrac = (vx, vg) => Math.min(1, Math.sqrt(Math.max(0, V0 + vx - vg) / VP));

export default function init({ stage, controls, getSize, onResize, signal }) {
  let vdT = 5;
  let vgT = 0;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let vdC = vdT;
  let vgC = vgT;
  let phase = 0;

  // ── kontroller ────────────────────────────────────────────────────────────
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
    input.addEventListener(
      "input",
      () => {
        onInput(Number(input.value));
        changed();
      },
      { signal },
    );
    return { el: label, out };
  };

  const vdS = slider({
    text: "Drain",
    min: 0,
    max: VD_MAX,
    step: 0.1,
    value: vdT,
    aria: "Spenningen på drain i volt, målt fra source",
    onInput: (x) => (vdT = Math.round(x * 10) / 10),
  });
  const vgS = slider({
    text: "Gate",
    min: VG_MIN,
    max: 0,
    step: 0.5,
    value: vgT,
    aria: "Spenningen på gaten i volt, målt fra source",
    onInput: (x) => (vgT = Math.round(x * 2) / 2),
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

  controls.append(vdS.el, vgS.el, playBtn);

  const NB = (x, k = 1) => x.toFixed(k).replace(".", ",").replace("-", "−");
  function sync() {
    vdS.out.textContent = `${NB(vdT)} V`;
    vgS.out.textContent = `${NB(vgT)} V`;
  }

  function changed() {
    sync();
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

  // ── tilstand i kanalen ───────────────────────────────────────────────────
  const NS = 140; // punkter langs kanalen
  const st = {
    wf: new Float64Array(NS + 1), // W/a
    cum: new Float64Array(NS + 1), // åpent areal fra source, i enheter av a·L
    xe: 1, // avklemmingspunktet, andel av L
    open: 1, // åpent areal, andel av hele kanalen
    off: false,
    pinched: false,
    I: 0,
    Ib: 0,
  };

  function update() {
    const vd = vdC;
    const vg = vgC;
    const vs = vsatOf(vg);
    st.off = vs <= 0;
    st.pinched = !st.off && vd >= vs;
    st.I = ich(vd, vg);
    st.Ib = ibr(vd, vg);
    st.xe = st.off ? 0 : st.pinched ? 1 - Math.min(0.06, 0.05 * Math.sqrt((vd - vs) / 8)) : 1;
    const veff = st.off ? 0 : Math.min(vd, vs);
    const fe = F(veff, vg);
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      if (st.off || s > st.xe) {
        st.wf[i] = 1;
        continue;
      }
      // V_x fra F(V_x) = F(V_eff)·s, F stiger monotont på [0, V_eff].
      const target = fe * (s / st.xe);
      let lo = 0;
      let hi = veff;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (F(mid, vg) > target) hi = mid;
        else lo = mid;
      }
      st.wf[i] = wFrac((lo + hi) / 2, vg);
    }
    st.cum[0] = 0;
    for (let i = 1; i <= NS; i++) {
      const h = 2 - st.wf[i - 1] - st.wf[i]; // 2·snittet av (1 − W/a)
      st.cum[i] = st.cum[i - 1] + h / (2 * NS);
    }
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
    const k = span > 1e-12 ? (target - st.cum[lo]) / span : 0;
    return (lo + k) / NS;
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
  const g = {};
  let dots = [];
  const neck = [];
  const pairs = [];

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 24; // venstre kant av source-kontakten
    g.bx1 = w - 24; // høyre kant av drain-kontakten
    g.cw = 12; // kontaktbredden
    g.x0 = g.bx0 + g.cw; // kanalen starter
    g.x1 = g.bx1 - g.cw; // kanalen slutter
    g.L = g.x1 - g.x0;
    g.gt = 18; // gatetykkelsen
    g.cy0 = 30; // øvre gatekant mot kanalen
    g.A = 62; // halvhøyden a i px
    g.yc = g.cy0 + g.A;
    g.cy1 = g.cy0 + 2 * g.A;
    NDOT = clamp(Math.round((g.L * 2 * g.A) / DOT_AREA), 60, NDOT_MAX);
    if (dots.length !== NDOT) dots = Array.from({ length: NDOT }, () => ({ u: Math.random(), t: 2 * Math.random() - 1 }));
    // Diagrammet.
    g.px0 = 34;
    g.px1 = w - 14;
    g.py0 = g.cy1 + g.gt + 34;
    g.py1 = h - 22;
  }

  const X = (s) => g.x0 + s * g.L;
  const xV = (v) => g.px0 + (v / VD_MAX) * (g.px1 - g.px0);
  const yI = (i) => g.py1 - (i / I_TOP) * (g.py1 - g.py0);

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const halo = ";stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round;paint-order:stroke";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = halo) =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}${extra}">${text}</text>`;
  const sub = (base, s) => `${base}<tspan dy='3' font-size='9'>${s}</tspan>`;
  const red = "var(--red)";
  const blue = "var(--indigo)";

  function deviceSvg() {
    const { w, bx0, bx1, cw, x0, x1, L, gt, cy0, cy1, yc, A } = g;
    let s = "";

    // Ledningene: source og drain på midtlinjen, gaten opp og ned.
    const xg = x0 + 0.5 * L;
    s +=
      `<path d="M 2 ${P(yc)} H ${P(bx0)} M ${P(bx1)} ${P(yc)} H ${P(w - 2)} M ${P(xg)} ${P(cy0 - gt)} V 2 M ${P(xg)} ${P(cy1 + gt)} V ${P(cy1 + gt + 14)}" stroke="var(--border-strong)" stroke-width="1.5" fill="none"/>` +
      tag(4, yc - 7, "S", "start", "var(--fg)") +
      tag(w - 4, yc - 7, "D", "end", "var(--fg)") +
      tag(xg + 7, 11, "G", "start", "var(--fg)") +
      tag(xg + 7, cy1 + gt + 13, "G", "start", "var(--fg)");

    // Kanalen, gatene og kontaktene.
    s +=
      `<rect x="${P(x0)}" y="${P(cy0)}" width="${P(L)}" height="${P(2 * A)}" fill="var(--card-nested)"/>` +
      `<rect x="${P(x0 + 4)}" y="${P(cy0 - gt)}" width="${P(L - 8)}" height="${P(gt)}" fill="${red}" fill-opacity="0.16" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(x0 + 4)}" y="${P(cy1)}" width="${P(L - 8)}" height="${P(gt)}" fill="${red}" fill-opacity="0.16" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(bx0)}" y="${P(cy0)}" width="${P(cw)}" height="${P(2 * A)}" fill="var(--muted)" fill-opacity="0.35" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(x1)}" y="${P(cy0)}" width="${P(cw)}" height="${P(2 * A)}" fill="var(--muted)" fill-opacity="0.35" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(x0 + 9, cy0 - gt / 2 + 4, "p⁺", "start", "var(--fg)", "") +
      tag(x0 + 9, cy1 + gt / 2 + 4, "p⁺", "start", "var(--fg)", "");

    // Romladningssonene: tonet område med stiplet kant, øverst og nederst.
    const pts = [];
    for (let i = 0; i <= NS; i += 2) pts.push(i / NS);
    if (pts[pts.length - 1] !== 1) pts.push(1);
    const edge = (sign) =>
      pts.map((p, i) => `${i ? "L" : "M"} ${P(X(p))} ${P(yc + sign * A * (1 - wAt(p)))}`).join(" ");
    const topEdge = edge(-1);
    const botEdge = edge(1);
    s +=
      `<path d="M ${P(x0)} ${P(cy0)} ${topEdge.replace(/^M/, "L")} L ${P(x1)} ${P(cy0)} Z" fill="var(--fg)" fill-opacity="0.08"/>` +
      `<path d="M ${P(x0)} ${P(cy1)} ${botEdge.replace(/^M/, "L")} L ${P(x1)} ${P(cy1)} Z" fill="var(--fg)" fill-opacity="0.08"/>` +
      `<path d="${topEdge} M ${botEdge.slice(2)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" fill="none"/>`;

    // Donorionene i sonene: ringer med pluss, samlet i to stier.
    const dx = 17;
    const dy = 14;
    const r = 3.6;
    let rings = "";
    let plus = "";
    for (let col = 0; ; col++) {
      const x = x0 + 9 + col * dx + (col % 2) * 0;
      if (x > x1 - 6) break;
      const wpx = wAt((x - x0) / L) * A;
      for (let row = 0; ; row++) {
        const d = 8 + row * dy + (col % 2) * 5;
        if (d + r + 1 > wpx) break;
        for (const y of [cy0 + d, cy1 - d]) {
          rings += `M ${P(x - r)} ${P(y)} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 `;
          plus += `M ${P(x - 1.9)} ${P(y)} h 3.8 M ${P(x)} ${P(y - 1.9)} v 3.8 `;
        }
      }
    }
    if (rings) s += `<path d="${rings}${plus}" stroke="${red}" stroke-width="1.1" fill="none" opacity="0.8"/>`;

    // Brakettene W og h ved en fjerdedel av kanalen, øverst.
    const sb = 0.2;
    const xb = X(sb);
    const wpx = wAt(sb) * A;
    const hpx = A - wpx;
    const brk = (yA, yB) =>
      `<path d="M ${P(xb)} ${P(yA)} V ${P(yB)} M ${P(xb - 3)} ${P(yA)} h 6 M ${P(xb - 3)} ${P(yB)} h 6" stroke="var(--fg)" stroke-width="1" fill="none"/>`;
    if (!st.off) {
      s += `<path d="M ${P(x0)} ${P(yc)} H ${P(x1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/>`;
      if (wpx >= 13) s += brk(cy0, cy0 + wpx) + tag(xb + 6, cy0 + wpx / 2 + 4, "W", "start", "var(--fg)");
      if (hpx >= 13) s += brk(cy0 + wpx, yc) + tag(xb + 6, cy0 + wpx + hpx / 2 + 4, "h", "start", "var(--fg)");
    }

    // Elektronene i den åpne kanalen. Antallet følger det åpne arealet.
    let dd = "";
    const shown = Math.round(NDOT * clamp(st.open, 0, 1));
    for (let k = 0; k < shown; k++) {
      const d = dots[k];
      const f = (((d.u + phase) % 1) + 1) % 1;
      const sx = xAtArea(f);
      const hh = (1 - wAt(sx)) * A;
      if (hh < R + 1) continue;
      const x = X(sx);
      const y = yc + d.t * (hh - R - 0.5);
      const fade = clamp(Math.min(f, 1 - f) / 0.04, 0, 1);
      dd += `<circle cx="${P(x)}" cy="${P(y)}" r="${R}" fill-opacity="${P(0.9 * fade)}"/>`;
    }
    for (const n of neck) {
      dd += `<circle cx="${P(X(n.s))}" cy="${P(yc + n.dy)}" r="${R}" fill-opacity="${P(0.9 * n.alpha)}"/>`;
    }
    for (const p of pairs) {
      if (p.kind === "e") dd += `<circle cx="${P(p.x)}" cy="${P(p.y)}" r="${R}" fill-opacity="${P(0.9 * p.alpha)}"/>`;
    }
    s += `<g style="fill:${blue}">${dd}</g>`;
    let hh = "";
    for (const p of pairs) {
      if (p.kind === "h") hh += `<circle cx="${P(p.x)}" cy="${P(p.y)}" r="${R}" fill-opacity="${P(0.9 * p.alpha)}"/>`;
    }
    if (hh) s += `<g style="fill:${red}">${hh}</g>`;

    // Merkelapper for tilstanden.
    if (st.off) s += tag(x0 + L / 2, yc + 4, "stengt", "middle", "var(--fg)");
    else if (st.pinched && st.Ib < 0.05) s += tag(X(st.xe) - 4, yc - 10, "avklemt", "end", "var(--fg)");
    if (st.Ib >= 0.05) s += tag(x1, 11, "skred", "end", "var(--fg)");
    return s;
  }

  function curvePath(vg) {
    const n = 120;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const v = (i / n) * VD_MAX;
      const I = Math.min(I_TOP + 0.2, ich(v, vg) + ibr(v, vg));
      d += `${i ? "L" : "M"} ${P(xV(v))} ${P(yI(I))} `;
    }
    return d;
  }

  function plotSvg() {
    const { px0, px1, py0, py1 } = g;
    let s = `<defs><clipPath id="jfet-plot"><rect x="${P(px0)}" y="${P(py0 - 2)}" width="${P(px1 - px0 + 2)}" height="${P(py1 - py0 + 2)}"/></clipPath></defs>`;

    // Aksene.
    let ticks = "";
    for (let v = 0; v <= VD_MAX; v += 2) ticks += `M ${P(xV(v))} ${P(py1)} v ${v % 4 === 0 ? 5 : 3} `;
    s +=
      `<path d="M ${P(px0)} ${P(py0 - 6)} V ${P(py1)} H ${P(px1)}" stroke="var(--border-strong)" stroke-width="1.5" fill="none"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(xV(0), py1 + 16, "0", "middle") +
      tag(xV(4), py1 + 16, "4", "middle") +
      tag(xV(8), py1 + 16, "8", "middle") +
      tag(xV(12), py1 + 16, "12 V", "end") +
      tag(px0 - 6, py0 + 4, sub("I", "D"), "end", "var(--fg)") +
      tag(xV(10.6), py1 - 8, sub("V", "D"), "middle", "var(--fg)");

    // Kurveskaren, kurven for den valgte gatespenningen og knekkene.
    let fam = "";
    for (const vg of FAMILY) fam += curvePath(vg);
    let locus = "";
    for (let i = 0; i <= 40; i++) {
      const vg = VG_OFF * (1 - i / 40);
      locus += `${i ? "L" : "M"} ${P(xV(vsatOf(vg)))} ${P(yI(ich(vsatOf(vg), vg)))} `;
    }
    s +=
      `<g clip-path="url(#jfet-plot)">` +
      `<path d="${fam}" stroke="var(--muted)" stroke-width="1" fill="none" opacity="0.7"/>` +
      `<path d="${locus}" stroke="var(--fg)" stroke-width="1" stroke-dasharray="4 3" fill="none" opacity="0.7"/>` +
      `<path d="${curvePath(vgC)}" stroke="var(--accent)" stroke-width="2" fill="none"/>` +
      `</g>`;

    // Gatespenningene ved platåene.
    const xl = xV(5.6);
    for (const vg of FAMILY) {
      const y = yI(ich(5.6, vg)) - 5;
      s += tag(xl, y, vg === 0 ? "0 V" : `${NB(vg, 0)} V`, "start");
    }

    // Arbeidspunktet.
    const I = ich(vdC, vgC) + ibr(vdC, vgC);
    const yp = yI(Math.min(I, I_TOP));
    s += `<circle cx="${P(xV(vdC))}" cy="${P(yp)}" r="4.5" style="fill:var(--accent)" stroke="var(--canvas-bg)" stroke-width="1.5"/>`;
    return s;
  }

  function render() {
    if (g.w < 160 || g.h < 200) return; // ikke lagt ut ennå
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      deviceSvg() +
      plotSvg() +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    vdC += (vdT - vdC) * k;
    vgC += (vgT - vgC) * k;
    if (Math.abs(vdT - vdC) < 1e-3) vdC = vdT;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    update();

    // Fasen: åpent areal delt på strømmen gir tiden gjennom kanalen.
    const open0 = 0.62; // åpent areal i metning ved V_G = 0, omtrent
    if (st.open > 1e-3 && st.I > 1e-4) {
      phase += (dt * st.I * open0) / (TRANSIT * st.open);
      phase %= 1;
    }

    // Elektroner gjennom den avklemte delen, med samme fluks som kanalen fører.
    if (st.pinched && st.I > 0.01) {
      const rate = (NDOT * st.I * open0) / TRANSIT;
      if (Math.random() < rate * dt) neck.push({ s: st.xe, dy: (Math.random() - 0.5) * 3, alpha: 1 });
    }
    for (let i = neck.length - 1; i >= 0; i--) {
      const n = neck[i];
      n.s += dt * 1.6;
      if (n.s > 1) n.alpha -= dt / 0.12;
      if (n.alpha <= 0 || n.s > 1.06) neck.splice(i, 1);
    }

    // Skred ved drain-enden av gateovergangene: hull til gaten, elektroner til drain.
    if (st.Ib > 0.01 && Math.random() < Math.min(30, 14 * st.Ib) * dt) {
      const top = Math.random() < 0.5;
      const x = g.x1 - 4 - 10 * Math.random();
      const y0 = top ? g.cy0 + 4 : g.cy1 - 4;
      pairs.push({ kind: "h", x, y: y0, vx: 0, vy: top ? -40 : 40, alpha: 1 });
      pairs.push({ kind: "e", x, y: y0 + (top ? 4 : -4), vx: 60, vy: 0, alpha: 1 });
    }
    for (let i = pairs.length - 1; i >= 0; i--) {
      const p = pairs[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const out = p.kind === "h" ? p.y < g.cy0 - g.gt + 4 || p.y > g.cy1 + g.gt - 4 : p.x > g.x1 + 2;
      if (out) p.alpha -= dt / 0.15;
      if (p.alpha <= 0) pairs.splice(i, 1);
    }
    if (pairs.length > 60) pairs.splice(0, pairs.length - 60);
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
    last = now;
    step(dt);
    render();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible) return;
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

  sync();
  layout();
  update();
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
