/**
 * «Kanalen» for TFE4146, MOSFET-en.
 *
 * Én idé: hvert stykke av kanalen er en MOS-kondensator. Spenningen mellom gaten og kanalen er
 * V_G − V_x, der V_x stiger fra 0 ved source til V_D ved drain, så elektronlaget er tykkest ved source,
 * |Q_n| = C_i(V_G − V_T − V_x). Når V_D når V_G − V_T, er laget borte ved drain, kanalen er klemt av,
 * og strømmen metter. I en kort kanal når elektronene ved drain metningshastigheten før det skjer.
 * Streetman & Banerjee §6.4.1, §6.5.1 og §6.5.4, fig. 6–11, 6–26 og 6–32.
 *
 * Øverst står transistoren sett fra siden: gaten over et tynt oksid, n⁺-områdene for source og drain,
 * elektronlaget under oksidet med tykkelse proporsjonal med |Q_n| og blå prikker som går mot drain,
 * og romladningssonen tonet med akseptorionene som «−». Under, på samme x-akse, står spenningen V_x
 * langs kanalen og den stiplede linjen V_G − V_T; avstanden mellom dem er |Q_n|/C_i, tonet. Nederst
 * står I_D mot V_D for fem gatespenninger, kurven for gatespenningen nå, den stiplede kurven gjennom
 * punktene der strømmen metter, og punktet for spenningene som er valgt.
 *
 * Modellen: n-kanal på p-Si med N_a = 5·10¹⁵ cm⁻³, 10 nm SiO₂ (C_i = 345 nF/cm²), V_T = 0,5 V,
 * μ̄_n = 200 cm²/V·s og Z = 20 µm. Lang kanal (L = 2 µm): k_N = (Z/L)μ̄_nC_i = 0,69 mA/V²,
 * I_D = k_N[(V_G − V_T)V_D − V_D²/2] opp til V_D(sat.) = V_G − V_T, konstant over. Kort kanal
 * (L = 0,1 µm): farten er μ̄_nℰ opp til ℰ_c = v_s/μ̄_n = 5·10⁴ V/cm og v_s = 10⁷ cm/s over (Streetman
 * likning 6–57 og 6–58). Feltet er størst ved drain, så strømmen er den samme formelen til feltet der
 * når ℰ_c. Da er I_D = ZC_iv_s(V_G − V_T − V_D(sat.)), og V_D(sat.) løser
 * (V_G − V_T)V − V²/2 = ℰ_cL(V_G − V_T − V). Over V_D(sat.) holdes strømmen konstant. Sonen under
 * kanalen er W(x) = [2ε_s(2φ_F + V_x)/qN_a]^{1/2}, 0,41 µm ved source; den og elektronlaget er ikke
 * tegnet i skala, og kanalen er tegnet like lang for begge lengdene.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const VT = 0.5; // V
const KN_LONG = 0.6906; // mA/V², Z/L = 10
const KN_SHORT = 13.81; // mA/V², Z/L = 200
const ECL = 0.5; // V, ℰ_c·L i den korte kanalen
const ZCV = 6.906; // mA/V, Z·C_i·v_s
const VD_MAX = 3;
const VG_MAX = 3;
const FAMILY = [1, 1.5, 2, 2.5, 3];
const PHI2F = 0.659; // V, 2φ_F
const OV_MAX = VG_MAX - VT; // største V_G − V_T
const VFB = -0.255; // V, flatbåndspenningen som gir V_T = 0,5 V
const GAMMA = 0.1185; // V^½, √(2ε_s qN_a)/C_i
/** φ_s under terskelen, fra V_G − V_FB = φ_s + γ√φ_s (utarming). */
function phisDepl(vg) {
  const a = vg - VFB;
  if (a <= 0) return 0;
  const r = (-GAMMA + Math.sqrt(GAMMA * GAMMA + 4 * a)) / 2;
  return Math.min(PHI2F, r * r);
}

const TAU = 0.35; // s, innstillingstiden for spenningene
const R = 2; // px, prikkens radius

const MODES = {
  long: { kn: KN_LONG, top: 2.4, ticks: [1, 2], unitTick: 2, label: "L = 2 µm" },
  short: { kn: KN_SHORT, top: 15, ticks: [5, 10, 15], unitTick: 15, label: "L = 0,1 µm" },
};

/** V_D(sat.) for overspenningen ov = V_G − V_T. */
function vsatOf(ov, mode) {
  if (ov <= 0) return 0;
  if (mode === "long") return ov;
  const b = ov + ECL;
  return b - Math.sqrt(b * b - 2 * ECL * ov);
}
/** Strømmen i mA. */
function idOf(vd, vg, mode) {
  const ov = vg - VT;
  if (ov <= 0) return 0;
  const v = Math.min(vd, vsatOf(ov, mode));
  return MODES[mode].kn * (ov * v - 0.5 * v * v);
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduce.matches;
  let mode = "long";
  let vdT = 0.5;
  let vgT = 1.5;
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
  const sG = slider("Gate", "Spenningen V_G på gaten, målt fra source", 0, VG_MAX, 0.1, vgT, (v) => (vgT = v));
  const sD = slider("Drain", "Spenningen V_D på drain, målt fra source", 0, VD_MAX, 0.1, vdT, (v) => (vdT = v));
  const lenRow = choiceRow({
    ariaLabel: "Kanallengden",
    items: [
      { value: "long", label: MODES.long.label },
      { value: "short", label: MODES.short.label },
    ],
    onPick: (v) => {
      mode = v;
      lenRow.sync(mode);
      neck.length = 0;
      changed();
    },
    signal,
  });
  lenRow.sync(mode);
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
  controls.append(sG, sD, lenRow.el, playBtn);

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
    vx: new Float64Array(NS + 1), // V_x i hvert punkt
    q: new Float64Array(NS + 1), // |Q_n|/C_i i hvert punkt, i volt
    cum: new Float64Array(NS + 1), // ladning fra source, i enheter av OV_MAX·L
    xp: 1, // der laget slutter eller farten når v_s, andel av L
    tot: 0,
    off: true,
    phisOff: 0,
    sat: false,
    vs: 0,
    ov: 0,
    I: 0,
  };

  function update() {
    const vd = vdC;
    const vg = vgC;
    const ov = vg - VT;
    st.ov = ov;
    st.off = ov <= 0.005;
    st.phisOff = phisDepl(vg);
    st.vs = vsatOf(Math.max(0, ov), mode);
    st.sat = !st.off && vd > st.vs + 1e-6;
    st.I = idOf(vd, vg, mode);
    const over = st.sat ? vd - st.vs : 0;
    st.xp = st.sat ? 1 - (mode === "long" ? Math.min(0.12, 0.05 * Math.sqrt(over)) : Math.min(0.5, 0.3 * Math.sqrt(over))) : 1;
    const ve = st.off ? 0 : Math.min(vd, st.vs);
    const Fe = ov * ve - 0.5 * ve * ve; // ∫₀^{V} (ov − V') dV' ved enden av den gradvise delen
    // Laget der elektronene går med v_s (kort kanal i metning): |Q_n|/C_i = ov − V_D(sat.).
    const qsat = mode === "short" && st.sat ? ov - st.vs : 0;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      let vx;
      let q;
      if (st.off) {
        vx = 0; // ingen kanal: drain-spenningen ligger over drain-overgangen
        q = 0;
      } else if (s <= st.xp) {
        // (ov·V − V²/2) = Fe·s/x_p, løst for V.
        const target = Fe * (s / st.xp);
        vx = ov - Math.sqrt(Math.max(0, ov * ov - 2 * target));
        q = Math.max(0, ov - vx);
      } else {
        const u = (s - st.xp) / (1 - st.xp);
        vx = st.vs + (vd - st.vs) * u * u;
        q = qsat;
      }
      st.vx[i] = vx;
      st.q[i] = q;
    }
    st.cum[0] = 0;
    for (let i = 1; i <= NS; i++) st.cum[i] = st.cum[i - 1] + (st.q[i - 1] + st.q[i]) / (2 * NS * OV_MAX);
    st.tot = st.cum[NS];
  }
  /** x (andel av L) der ladningen fra source er andelen f av all ladningen i laget. */
  function xAtCharge(f) {
    const target = f * st.tot;
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
  const at = (arr, s) => {
    const p = Math.max(0, Math.min(NS, s * NS));
    const i = Math.min(NS - 1, Math.floor(p));
    const k = p - i;
    return arr[i] * (1 - k) + arr[i + 1] * k;
  };

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  let G = null;
  let dots = [];
  const neck = [];

  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 400) return null;
    const well = Math.round(clamp(w * 0.1, 30, 52)); // bredden av n⁺-områdene
    const x0 = 8 + well; // kanalen begynner ved kanten av source
    const x1 = w - 8 - well;
    const gy0 = 24; // gaten
    const gy1 = gy0 + 14;
    const oy = gy1 + 5; // overflaten av silisiumet
    const thk = 22; // px, tykkelsen av elektronlaget ved V_G − V_T = 2,5 V
    const wpx0 = 26; // px, sonen ved source
    const devB = oy + 92; // bunnen av tverrsnittet
    const vy0 = devB + 22;
    const vy1 = vy0 + 72;
    const pw = Math.min(w, 600);
    const off = (w - pw) / 2;
    const px0 = off + 34;
    const px1 = off + pw - 18;
    const py0 = vy1 + 40;
    const py1 = h - 26;
    const n = clamp(Math.round(((x1 - x0) * thk * 0.5) / 22), 30, 160);
    if (dots.length !== n) dots = Array.from({ length: n }, () => ({ u: Math.random(), t: Math.random() }));
    return { w, h, well, x0, x1, L: x1 - x0, gy0, gy1, oy, thk, wpx0, devB, vy0, vy1, px0, px1, py0, py1 };
  }
  const X = (s) => G.x0 + s * G.L;
  const yV = (v) => G.vy1 - (Math.min(v, VD_MAX) / VD_MAX) * (G.vy1 - G.vy0);
  const xI = (v) => G.px0 + (v / VD_MAX) * (G.px1 - G.px0);
  const yI = (i) => G.py1 - (Math.min(i, MODES[mode].top * 1.08) / MODES[mode].top) * (G.py1 - G.py0);
  const thkAt = (s) => (at(st.q, s) / OV_MAX) * G.thk;
  /** V_x jevnet ut over et kort stykke, så kanten av sonen ikke får en spiss ved drain. */
  const vxSmooth = (s) => {
    let a = 0;
    for (let k = -4; k <= 4; k++) a += at(st.vx, Math.max(0, Math.min(1, s + k * 0.012)));
    return a / 9;
  };
  const zoneAt = (s) => G.wpx0 * Math.sqrt((st.off ? st.phisOff : PHI2F + vxSmooth(s)) / PHI2F);
  const zoneWell = (v) => G.wpx0 * Math.sqrt((PHI2F + v) / PHI2F);

  // ── tegning ───────────────────────────────────────────────────────────────
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  function device() {
    const { w, well, x0, x1, L, gy0, gy1, oy, devB } = G;
    let s = "";
    const wd = Math.round(well * 0.62); // dybden av n⁺-områdene
    // Romladningssonen: under kanalen og rundt n⁺-områdene, dypest ved drain.
    const zs = zoneWell(0);
    const zd = zoneWell(vdC);
    let zp = `M 4 ${P(oy)} L 4 ${P(oy + wd + zs * 0.7)} Q ${P(x0 - 2)} ${P(oy + wd + zs * 0.7)} ${P(x0)} ${P(oy + zoneAt(0))} `;
    for (let i = 0; i <= NS; i += 4) zp += `L ${P(X(i / NS))} ${P(oy + zoneAt(i / NS))} `;
    zp += `Q ${P(x1 + 2)} ${P(oy + wd + zd * 0.7)} ${P(w - 4)} ${P(oy + wd + zd * 0.7)} L ${P(w - 4)} ${P(oy)} Z`;
    s += `<path d="${zp}" style="fill:var(--accent)" fill-opacity="0.10"/>`;
    // Akseptorionene i et fast gitter: sterke i sonen, svake utenfor.
    let strong = "";
    let faint = "";
    for (let col = 0; ; col++) {
      const x = 10 + col * 13;
      if (x > w - 8) break;
      for (let row = 0; ; row++) {
        const y = oy + 8 + row * 11 + (col % 2) * 5;
        if (y > devB - 3) break;
        const inWell = (x < x0 + 2 || x > x1 - 2) && y < oy + wd + 3;
        if (inWell) continue;
        const s0 = clamp((x - x0) / L, 0, 1);
        const depth = x < x0 ? wd + zs * 0.7 : x > x1 ? wd + zd * 0.7 : zoneAt(s0);
        const g = `M ${P(x - 2.2)} ${P(y)} h 4.4 `;
        if (x > x0 && x < x1 && y - oy < thkAt(s0) + 3) continue;
        if (y - oy < depth) strong += g;
        else faint += g;
      }
    }
    s += `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.28"/>`;
    s += `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.4"/>`;
    s += `<path d="${zp}" fill="none" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
    // n⁺-områdene for source og drain.
    s +=
      `<rect x="4" y="${P(oy)}" width="${P(x0 - 4 + 3)}" height="${wd}" rx="5" style="fill:var(--indigo)" fill-opacity="0.22" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(x1 - 3)}" y="${P(oy)}" width="${P(w - 4 - x1 + 3)}" height="${wd}" rx="5" style="fill:var(--indigo)" fill-opacity="0.22" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag((4 + x0) / 2, oy + wd / 2 + 4, "n⁺", "middle", "var(--fg)", halo) +
      tag((x1 + w - 4) / 2, oy + wd / 2 + 4, "n⁺", "middle", "var(--fg)", halo);
    // Overflaten, oksidet og gaten.
    s +=
      `<path d="M 2 ${P(oy)} H ${P(w - 2)}" style="stroke:var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(x0 - 3)}" y="${P(gy1)}" width="${P(L + 6)}" height="${P(oy - gy1)}" style="fill:var(--border)" fill-opacity="0.8"/>` +
      `<rect x="${P(x0 - 3)}" y="${P(gy0)}" width="${P(L + 6)}" height="${P(gy1 - gy0)}" rx="2" style="fill:var(--muted)" fill-opacity="0.32" stroke="var(--border-strong)" stroke-width="1"/>`;
    // Ledningene og kontaktene.
    const xg = x0 + L / 2;
    const xs = (4 + x0) / 2 - 4;
    const xd = (x1 + w - 4) / 2 + 4;
    s +=
      `<path d="M ${P(xg)} ${P(gy0)} V 6 M ${P(xs)} ${P(oy)} V 6 M ${P(xd)} ${P(oy)} V 6" style="stroke:var(--border-strong)" stroke-width="1.4" fill="none"/>` +
      `<path d="M ${P(xs - 6)} ${P(oy - 1.5)} h 12 M ${P(xd - 6)} ${P(oy - 1.5)} h 12" style="stroke:var(--fg)" stroke-width="3"/>` +
      tag(xs + 6, 12, "S", "start", "var(--fg)") +
      tag(xg + 6, 12, "G", "start", "var(--fg)") +
      tag(xd + 6, 12, "D", "start", "var(--fg)");

    // Elektronlaget: tykkelsen er proporsjonal med |Q_n|.
    if (!st.off) {
      let top = "";
      let bot = "";
      for (let i = 0; i <= NS; i += 2) {
        const sx = i / NS;
        top += `${i ? "L" : "M"} ${P(X(sx))} ${P(oy)} `;
        bot = `L ${P(X(sx))} ${P(oy + thkAt(sx))} ` + bot;
      }
      s += `<path d="${top} ${bot} Z" style="fill:var(--indigo)" fill-opacity="0.4"/>`;
    }

    // Elektronene i laget; tettheten per tegnet areal er den samme overalt, så de går fortest der laget er tynt.
    let dd = "";
    if (!st.off && st.tot > 1e-5) {
      const nShow = Math.round(dots.length * clamp(st.tot, 0, 1));
      for (let k = 0; k < nShow; k++) {
        const d = dots[k];
        const f = (((d.u + phase) % 1) + 1) % 1;
        const sx = xAtCharge(f);
        const t = thkAt(sx);
        const fade = clamp(Math.min(f, 1 - f) / 0.03, 0, 1);
        const y = oy + R * 0.6 + d.t * Math.max(0, t - R * 1.2);
        dd += `<circle cx="${P(X(sx))}" cy="${P(y)}" r="${R}" fill-opacity="${P(0.9 * fade)}"/>`;
      }
    }
    for (const n of neck) dd += `<circle cx="${P(X(n.s))}" cy="${P(oy + n.dy)}" r="${R}" fill-opacity="${P(0.9 * n.alpha)}"/>`;
    s += `<g style="fill:var(--indigo)">${dd}</g>`;

    // Strømmen inn i drain, motsatt vei av elektronene.
    if (st.I > MODES[mode].top * 0.004) {
      const len = 6 + 16 * Math.min(1, st.I / (MODES[mode].top * 0.9));
      const xa = xd - 10;
      const ya = 4;
      s += `<path d="M ${P(xa)} ${P(ya)} V ${P(ya + len)} M ${P(xa - 3.5)} ${P(ya + len - 5)} L ${P(xa)} ${P(ya + len)} L ${P(xa + 3.5)} ${P(ya + len - 5)}" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += tag(xa - 5, ya + 12, sub("I", "D"), "end", "var(--accent)", it + halo);
    }

    // Merkelapper for tilstanden.
    if (st.off) s += tag(x0 + L / 2, oy + 14, "ingen kanal", "middle", "var(--fg)", halo);
    else if (st.sat && mode === "long") s += tag(X(st.xp) - 5, oy + 15, "avklemt", "end", "var(--fg)", halo);
    else if (st.sat) s += tag(Math.min(X(st.xp) + 5, x1 - 52), oy + 15 + G.thk * 0.4, `v = ${sub("v", "s")}`, "start", "var(--fg)", halo);
    void devB;
    return s;
  }

  function strip() {
    const { x0, x1, vy0, vy1 } = G;
    let s = "";
    s += `<path d="M ${P(x0)} ${P(vy0 - 4)} V ${P(vy1)} H ${P(x1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [1, 2, 3]) s += `<path d="M ${P(x0)} ${P(yV(v))} h -3" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(x0 - 6, yV(0) + 4, "0", "end") + tag(x0 - 6, yV(1) + 4, "1", "end") + tag(x0 - 6, yV(2) + 4, "2", "end") + tag(x0 - 6, yV(3) + 6, "3 V", "end");
    s += tag(x1 + 2, vy1 + 14, "x", "end", "var(--fg)", it);
    // V_G − V_T og avstanden ned til V_x, som er |Q_n|/C_i.
    if (!st.off) {
      const yT = yV(st.ov);
      if (st.ov <= VD_MAX + 0.05) {
        let gap = "";
        let back = "";
        for (let i = 0; i <= NS; i += 2) {
          const sx = i / NS;
          if (sx > st.xp + 1e-9) break;
          gap += `${i ? "L" : "M"} ${P(X(sx))} ${P(yT)} `;
          back = `L ${P(X(sx))} ${P(yV(Math.min(st.vx[i], st.ov)))} ` + back;
        }
        s += `<path d="${gap} ${back} Z" style="fill:var(--indigo)" fill-opacity="0.16"/>`;
        s += `<path d="M ${P(x0)} ${P(yT)} H ${P(x1)}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>`;
        const above = yT - vy0 > 14;
        s += tag(x0 + 0.3 * G.L, yT + (above ? -5 : 13), `${sub("V", "G")} − ${sub("V", "T")}`, "start", "var(--fg)", halo);
      } else {
        s += tag(x1 - 2, vy0 + 6, `${sub("V", "G")} − ${sub("V", "T")} over 3 V`, "end", "var(--muted)", halo);
      }
    }
    s += tag(x0 + 6, vy0 + 6, sub("V", "x"), "start", "var(--indigo)", it + halo);
    if (st.off) return s + tag((x0 + x1) / 2, (vy0 + vy1) / 2 + 4, "ingen kanal", "middle", "var(--muted)", halo);
    let d = "";
    for (let i = 0; i <= NS; i += 2) d += `${i ? "L" : "M"} ${P(X(i / NS))} ${P(yV(st.vx[i]))} `;
    s += `<path d="${d}" fill="none" style="stroke:var(--indigo)" stroke-width="1.9" stroke-linejoin="round"/>`;
    return s;
  }

  function curvePath(vg) {
    const n = 120;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const v = (i / n) * VD_MAX;
      d += `${i ? "L" : "M"} ${P(xI(v))} ${P(yI(idOf(v, vg, mode)))} `;
    }
    return d;
  }

  function plot() {
    const { px0, px1, py0, py1 } = G;
    const M = MODES[mode];
    let s = "";
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [1, 2, 3]) s += `<path d="M ${P(xI(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const i of M.ticks) s += `<path d="M ${P(px0)} ${P(yI(i))} h -4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(px0, py1 + 14, "0", "middle") + tag(xI(1), py1 + 14, "1", "middle") + tag(xI(2), py1 + 14, "2", "middle") + tag(xI(3), py1 + 14, "3 V", "end");
    for (const i of M.ticks) s += tag(px0 - 7, yI(i) + 4, String(i), "end");
    s += tag(px0 - 7, py0 - 6, "mA", "end");
    s += tag(xI(2.5), py1 + 14, sub("V", "D"), "middle", "var(--fg)", it) + tag(px0 + 6, py0 + 4, sub("I", "D"), "start", "var(--fg)", it + halo);
    // Kurvene for faste gatespenninger, merket ved høyre kant når det er plass.
    let fam = "";
    for (const vg of FAMILY) fam += curvePath(vg);
    s += `<path d="${fam}" fill="none" style="stroke:var(--muted)" stroke-width="1.1"/>`;
    let lastY = -Infinity;
    for (let k = FAMILY.length - 1; k >= 0; k--) {
      const vg = FAMILY[k];
      const y = yI(idOf(VD_MAX, vg, mode)) - 4;
      if (y > py1 - 6 || y - lastY < 12) continue;
      s += tag(px1 - 2, y, `${NB(vg).replace(",0", "")} V`, "end", "var(--muted)", halo);
      lastY = y;
    }
    // Punktene der strømmen metter.
    let locus = "";
    for (let k = 0; k <= 60; k++) {
      const vg = VT + (k / 60) * OV_MAX;
      const vs = vsatOf(vg - VT, mode);
      locus += `${k ? "L" : "M"} ${P(xI(vs))} ${P(yI(idOf(vs, vg, mode)))} `;
    }
    s += `<path d="${locus}" fill="none" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    {
      // Midt mellom platåene for 2 V og 2,5 V, til høyre for den stiplede kurven.
      const iMid = 0.5 * (idOf(VD_MAX, 2, mode) + idOf(VD_MAX, 2.5, mode));
      let lo = 0;
      let hi = OV_MAX;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (idOf(vsatOf(m, mode), VT + m, mode) < iMid) lo = m;
        else hi = m;
      }
      const vsx = vsatOf(lo, mode);
      s += tag(xI(vsx) + 7, yI(iMid) + 4, `${sub("V", "D")}(sat.)`, "start", "var(--fg)", halo);
    }
    // Kurven for gatespenningen nå, og punktet.
    if (vgC > VT) s += `<path d="${curvePath(vgC)}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
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
  const TRANSIT = 1.2; // s, tid gjennom kanalen er TRANSIT·(ladningen i laget)·(I_D ved 3 V, 3 V)/I_D
  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    vdC += (vdT - vdC) * k;
    vgC += (vgT - vgC) * k;
    if (Math.abs(vdT - vdC) < 1e-3) vdC = vdT;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    update();
    // Fasen går med strømmen delt på ladningen i laget: tynt lag, raske elektroner.
    const iMax = idOf(VD_MAX, VG_MAX, mode);
    if (st.tot > 1e-5 && st.I > 1e-6) phase = (phase + (dt * (st.I / iMax)) / (TRANSIT * Math.max(st.tot, 0.02))) % 1;
    // Elektroner gjennom stykket ved drain, med samme fluks som laget fører.
    if (G && st.sat && st.I > 1e-4) {
      const nShow = Math.round(dots.length * clamp(st.tot, 0, 1));
      const rate = Math.min(40, (nShow * (st.I / iMax)) / (TRANSIT * Math.max(st.tot, 0.02)));
      if (Math.random() < rate * dt) neck.push({ s: st.xp, dy: R * 0.6 + Math.random() * Math.max(0.5, at(st.q, st.xp) / OV_MAX * G.thk - R), alpha: 1 });
    }
    for (let i = neck.length - 1; i >= 0; i--) {
      const n = neck[i];
      n.s += dt * (mode === "long" ? 1.2 : 0.55);
      if (n.s > 1) n.alpha -= dt / 0.1;
      if (n.alpha <= 0) neck.splice(i, 1);
    }
    if (neck.length > 60) neck.splice(0, neck.length - 60);
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
