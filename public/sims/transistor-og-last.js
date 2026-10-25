/**
 * «Transistoren og lastmotstanden» for TFE4146, transistoren i en krets.
 *
 * Én idé: kretsen, en transistor i serie med lastmotstanden R_L til kilden V_DD, gir lastlinjen
 * V_DD = I_D·R_L + V_D, og arbeidspunktet er der den krysser kurven for gatespenningen. Gaten
 * flytter kurven, og punktet glir langs linjen. I metning gir et lite signal v_g på gaten et stort
 * signal v_d = −g_m·R_L·v_g på drain, motsatt vei. Utenfor metning, eller med et stort signal, er
 * signalet på drain ikke lenger en kopi. Streetman & Banerjee §6.1, fig. 6–1 og 6–2.
 *
 * Modellen: en n-kanal-transistor med terskelspenning V_T = 1 V. I metning er
 * I_D(sat.) = K·(V_G − V_T)² med K = 2 mA/V², og metningen begynner ved V_D(sat.) = V_G − V_T.
 * Før metning er I_D = K·[2(V_G − V_T)V_D − V_D²]. Under V_T går det ingen strøm. V_DD = 10 V.
 * Kretsen har ingen hukommelse, så arbeidspunktet regnes ut på nytt for hver gatespenning, og
 * sporene på skopet regnes ut for hele vinduet hver gang.
 *
 * Øverst til venstre står kretsen, med gaten drevet av et batteri V_G og en signalkilde v_g i
 * serie. Øverst til høyre viser et skop signalene v_g og v_d, bare vekselspenningsdelene, på
 * samme skala. Under står I_D mot V_D med en kurve for fire gatespenninger, den stiplede kurven
 * der metningen begynner, lastlinjen (oransje), kurven for gatespenningen akkurat nå (uthevet),
 * punktet der transistoren står nå, og arbeidspunktet uten signal (ring).
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const K = 2; // mA/V²
const VT = 1; // V
const VDD = 10; // V
const I_MAX = 10.6; // mA, toppen av diagrammet
const PER = 2.4; // s per periode av signalet
const WIN = 2 * PER; // vinduet på skopet
const CURVES = [1.5, 2, 2.5, 3];
const SCALES = [0.5, 1, 2, 5];

/** Drain-strømmen i mA. */
function iD(vg, vd) {
  const ov = vg - VT;
  if (ov <= 0) return 0;
  return vd >= ov ? K * ov * ov : K * (2 * ov * vd - vd * vd);
}
/** Arbeidspunktet: V_DD = I_D·R_L + V_D, løst ved halvering. R_L i kΩ. */
function operating(vg, rl) {
  let lo = 0;
  let hi = VDD;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (VDD - iD(vg, m) * rl - m > 0) lo = m;
    else hi = m;
  }
  const vd = (lo + hi) / 2;
  return { vd, i: iD(vg, vd) };
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let VG = 2;
  let amp = 0.1;
  const RL = 2; // kΩ
  let t = 0;
  let paused = false;

  // ── kontroller ──────────────────────────────────────────────────────────
  const fmt = (x, d) => x.toFixed(d).replace(".", ",");
  function slider(name, aria, min, max, step, value, show, set) {
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
    out.textContent = show(value);
    input.addEventListener(
      "input",
      () => {
        const v = Number(input.value);
        set(v);
        out.textContent = show(v);
        render();
      },
      { signal },
    );
    return label;
  }
  const sG = slider("Gatespenning", "Likespenningen V_G på gaten", 0, 4, 0.1, VG, (v) => `${fmt(v, 1)} V`, (v) => (VG = v));
  const sA = slider("Signal", "Amplituden til signalet v_g på gaten", 0, 0.5, 0.05, amp, (v) => `${fmt(v, 2)} V`, (v) => (amp = v));
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "sim-btn";
  pauseBtn.textContent = "Pause";
  pauseBtn.addEventListener(
    "click",
    () => {
      paused = !paused;
      pauseBtn.textContent = paused ? "Spill av" : "Pause";
      if (!paused) start();
    },
    { signal },
  );
  controls.append(sG, sA, pauseBtn);

  // ── modellen ────────────────────────────────────────────────────────────
  const vgAt = (tt) => amp * Math.sin((2 * Math.PI * tt) / PER);
  /** Ytterpunktene for én periode: V_D og I_D, og den største |v_d|. */
  function swing() {
    const q = operating(VG, RL);
    let vMin = q.vd;
    let vMax = q.vd;
    let iMin = q.i;
    let iMax = q.i;
    for (let k = 0; k < 64; k++) {
      const o = operating(VG + amp * Math.sin((2 * Math.PI * k) / 64), RL);
      vMin = Math.min(vMin, o.vd);
      vMax = Math.max(vMax, o.vd);
      iMin = Math.min(iMin, o.i);
      iMax = Math.max(iMax, o.i);
    }
    return { q, vMin, vMax, iMin, iMax, big: Math.max(q.vd - vMin, vMax - q.vd, amp) };
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 360) return null;
    const cw = Math.min(170, Math.max(140, w * 0.44)); // kretsen
    const topH = 156;
    const sx0 = cw + 10;
    const sx1 = w - 6;
    const sy0 = 10;
    const sy1 = topH - 8;
    // Diagrammet, høyst 600 px bredt og midtstilt.
    const pw = Math.min(w, 600);
    const off = (w - pw) / 2;
    const px0 = off + 52;
    const px1 = off + pw - 42;
    const py0 = topH + 16;
    const py1 = h - 22;
    return { w, h, cw, topH, sx0, sx1, sy0, sy1, px0, px1, py0, py1 };
  }
  const X = (v) => G.px0 + (v / VDD) * (G.px1 - G.px0);
  const Y = (i) => G.py1 - (Math.min(i, I_MAX) / I_MAX) * (G.py1 - G.py0);

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";
  const wire = (d, w = 1.2) => `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="${w}" stroke-linejoin="round"/>`;

  function circuit(iNow) {
    const { cw } = G;
    const xc = Math.round(cw * 0.6); // kanalen
    const xd = xc + 13; // drain og source
    const xg = 22; // kildene på gaten
    const yRail = 14;
    const yR0 = 22;
    const yR1 = 56;
    const yNode = 66;
    const yDc = 84; // drain mot kanalen
    const ySc = 112; // source mot kanalen
    const yGate = 98;
    const yGnd = 140;
    let s = "";
    // Skinnen V_DD.
    s += wire(`M ${P(xd - 16)} ${yRail} H ${P(xd + 16)}`, 1.6);
    s += tag(xd - 22, yRail + 4, `${sub("V", "DD")} = 10 V`, "end", "var(--fg)");
    // Lastmotstanden.
    let z = `M ${P(xd)} ${yRail} V ${yR0}`;
    for (let k = 1; k <= 6; k++) z += ` L ${P(xd + (k % 2 ? -5 : 5))} ${P(yR0 + (k - 0.5) * ((yR1 - yR0) / 6))}`;
    z += ` L ${P(xd)} ${yR1} V ${yDc} H ${P(xc)}`;
    s += wire(z);
    s += tag(xd - 9, (yR0 + yR1) / 2 + 4, sub("R", "L"), "end", "var(--fg)", it);
    // Drain-noden.
    s += `<circle cx="${P(xd)}" cy="${yNode}" r="2.4" style="fill:var(--fg)"/>`;
    s += tag(xd + 6, yNode + 4, "D", "start", "var(--fg)");
    // Transistoren: kanalen, gaten og source med pilen ut (n-kanal).
    s += wire(`M ${P(xc)} ${yDc - 6} V ${ySc + 6}`, 2.4);
    s += wire(`M ${P(xc - 6)} ${yDc} V ${ySc}`, 2);
    s += wire(`M ${P(xc)} ${ySc} H ${P(xd)} V ${yGnd}`);
    s += `<path d="M ${P(xd - 6)} ${ySc - 3.5} L ${P(xd - 1)} ${ySc} L ${P(xd - 6)} ${ySc + 3.5}" fill="none" style="stroke:var(--fg)" stroke-width="1.3"/>`;
    s += tag(xd + 6, ySc + 4, "S", "start", "var(--fg)");
    // Gaten, signalkilden og batteriet.
    const yS = 116; // sentrum av signalkilden
    const yB = 132; // batteriet
    s += wire(`M ${P(xc - 6)} ${yGate} H ${xg} V ${yS - 8} M ${xg} ${yS + 8} V ${yB - 3} M ${xg} ${yB + 3} V ${yGnd} H ${P(xd)}`);
    s += tag(xc - 10, yGate - 5, "G", "end", "var(--fg)");
    s += `<circle cx="${xg}" cy="${yS}" r="8" style="fill:var(--canvas-bg);stroke:var(--fg)" stroke-width="1.2"/>`;
    s += `<path d="M ${xg - 5} ${yS} q 2.5 -5 5 0 t 5 0" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    s += tag(xg + 12, yS + 4, sub("v", "g"), "start", "var(--fg)", it);
    s += wire(`M ${xg - 8} ${yB - 3} H ${xg + 8}`, 1.6) + wire(`M ${xg - 4.5} ${yB + 3} H ${xg + 4.5}`, 3);
    s += tag(xg + 12, yB + 7, sub("V", "G"), "start", "var(--fg)", it);
    // Jord.
    const xj = (xg + xd) / 2;
    s += wire(`M ${P(xj)} ${yGnd} V ${yGnd + 5} M ${P(xj - 8)} ${yGnd + 5} H ${P(xj + 8)} M ${P(xj - 5)} ${yGnd + 8} H ${P(xj + 5)} M ${P(xj - 2)} ${yGnd + 11} H ${P(xj + 2)}`);
    // Strømmen gjennom lastmotstanden.
    if (iNow > 0.02) {
      const len = 6 + 24 * Math.min(1, iNow / 5);
      const xa = xd + 13;
      const ym = (yR0 + yR1) / 2;
      const y0 = ym - len / 2;
      const y1 = ym + len / 2;
      s += `<path d="M ${P(xa)} ${P(y0)} V ${P(y1)} M ${P(xa - 4)} ${P(y1 - 6)} L ${P(xa)} ${P(y1)} L ${P(xa + 4)} ${P(y1 - 6)}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += tag(xa + 7, ym + 4, sub("I", "D"), "start", "var(--accent)", it + halo);
    }
    return s;
  }

  function scope(sw) {
    const { sx0, sx1, sy0, sy1 } = G;
    let s = "";
    const scale = SCALES.find((v) => sw.big <= 0.92 * v) ?? SCALES[SCALES.length - 1];
    const ym = (sy0 + sy1) / 2;
    const half = (sy1 - sy0) / 2 - 6;
    const yv = (v) => ym - (Math.max(-1.05 * scale, Math.min(1.05 * scale, v)) / scale) * half;
    s += `<rect x="${P(sx0)}" y="${P(sy0)}" width="${P(sx1 - sx0)}" height="${P(sy1 - sy0)}" rx="3" fill="none" stroke="var(--border)" stroke-width="1"/>`;
    s += `<path d="M ${P(sx0)} ${P(ym)} H ${P(sx1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<path d="M ${P(sx0)} ${P(yv(scale))} H ${P(sx1)} M ${P(sx0)} ${P(yv(-scale))} H ${P(sx1)}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="2 3"/>`;
    const sv = String(scale).replace(".", ",");
    s += tag(sx0 + 4, yv(scale) + 12, `+${sv} V`) + tag(sx0 + 4, yv(-scale) - 4, `−${sv} V`);
    // Sporene for hele vinduet, med nå helt til høyre.
    const vd0 = operating(VG, RL).vd;
    const N = Math.max(60, Math.round((sx1 - sx0) / 2));
    let pg = "";
    let pd = "";
    for (let k = 0; k <= N; k++) {
      const tt = t - WIN + (k / N) * WIN;
      const x = sx0 + (k / N) * (sx1 - sx0);
      const g = vgAt(tt);
      const d = operating(VG + g, RL).vd - vd0;
      pg += `${k ? "L" : "M"} ${P(x)} ${P(yv(g))} `;
      pd += `${k ? "L" : "M"} ${P(x)} ${P(yv(d))} `;
    }
    s += `<path d="${pg}" fill="none" style="stroke:var(--indigo)" stroke-width="1.6" stroke-linejoin="round"/>`;
    s += `<path d="${pd}" fill="none" style="stroke:var(--accent)" stroke-width="1.9" stroke-linejoin="round"/>`;
    s += tag(sx1 - 30, sy0 + 14, sub("v", "g"), "end", "var(--indigo)", it + halo) + tag(sx1 - 6, sy0 + 14, sub("v", "d"), "end", "var(--accent)", it + halo);
    return s;
  }

  function iv(sw, gNow, now) {
    const { px0, px1, py0, py1 } = G;
    let s = "";
    // Aksene.
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1 + 4)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const v of [5, 10]) s += `<path d="M ${P(X(v))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (const i of [5, 10]) s += `<path d="M ${P(px0)} ${P(Y(i))} h -4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(px0, py1 + 14, "0", "middle") + tag(X(5), py1 + 14, "5 V", "middle") + tag(X(10), py1 + 14, sub("V", "DD"), "middle", "var(--orange)", it);
    // Merket for V_DD/R_L står til venstre for aksen; tallmerker for nær det droppes.
    const iTop = VDD / RL;
    const near = (i) => iTop <= I_MAX && Math.abs(Y(i) - Y(iTop)) < 13;
    for (const i of [5, 10]) if (!near(i)) s += tag(px0 - 6, Y(i) + 4, String(i), "end");
    s += tag(px0 - 6, py0 + 4, "mA", "end");
    s += tag(px1 + 30, py1 + 14, sub("V", "D"), "end", "var(--fg)", it) + tag(px0 + 6, py0 + 6, sub("I", "D"), "start", "var(--fg)", it);
    // Kurvene for faste gatespenninger.
    const curve = (vg) => {
      let d = "";
      const M = 80;
      for (let k = 0; k <= M; k++) {
        const v = (k / M) * VDD;
        const i = iD(vg, v);
        if (i > I_MAX) break;
        d += `${k ? "L" : "M"} ${P(X(v))} ${P(Y(i))} `;
      }
      return d;
    };
    let dc = "";
    for (const vg of CURVES) dc += curve(vg);
    s += `<path d="${dc}" fill="none" style="stroke:var(--muted)" stroke-width="1.1"/>`;
    for (const vg of CURVES) {
      const i = iD(vg, VDD);
      s += tag(px1 + 6, Y(i) + 4, `${fmt(vg, vg % 1 ? 1 : 0)} V`, "start");
    }
    s += tag(px1 + 6, Y(iD(CURVES[CURVES.length - 1], VDD)) - 12, sub("V", "G"), "start", "var(--muted)", it);
    // Der metningen begynner.
    let ds = "";
    const vEnd = Math.sqrt(I_MAX / K);
    for (let k = 0; k <= 40; k++) {
      const v = (k / 40) * vEnd;
      ds += `${k ? "L" : "M"} ${P(X(v))} ${P(Y(K * v * v))} `;
    }
    s += `<path d="${ds}" fill="none" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    s += tag(X(vEnd) + 5, py0 + 10, `${sub("V", "D")}(sat.)`, "start", "var(--fg)", halo);
    // Lastlinjen.
    const vTop = iTop > I_MAX ? VDD - I_MAX * RL : 0;
    s += `<path d="M ${P(X(VDD))} ${P(Y(0))} L ${P(X(vTop))} ${P(Y(Math.min(iTop, I_MAX)))}" style="stroke:var(--orange)" stroke-width="2"/>`;
    if (iTop <= I_MAX) s += tag(px0 - 5, Y(iTop) + 4, `${sub("V", "DD")}/${sub("R", "L")}`, "end", "var(--orange)", it);
    // Utslaget langs aksene.
    if (amp > 0 && sw.vMax - sw.vMin > 0.02) {
      s += `<path d="M ${P(X(sw.vMin))} ${P(py1 - 2)} H ${P(X(sw.vMax))}" style="stroke:var(--accent)" stroke-width="4" opacity="0.55" stroke-linecap="round"/>`;
      s += `<path d="M ${P(px0 + 2)} ${P(Y(sw.iMin))} V ${P(Y(sw.iMax))}" style="stroke:var(--accent)" stroke-width="4" opacity="0.55" stroke-linecap="round"/>`;
    }
    // Kurven for gatespenningen nå.
    if (gNow > VT) s += `<path d="${curve(gNow)}" fill="none" style="stroke:var(--indigo)" stroke-width="1.8"/>`;
    // Arbeidspunktet og punktet nå.
    s += `<circle cx="${P(X(sw.q.vd))}" cy="${P(Y(sw.q.i))}" r="5.5" fill="none" style="stroke:var(--fg)" stroke-width="1.3"/>`;
    s += `<circle cx="${P(X(now.vd))}" cy="${P(Y(now.i))}" r="3.6" style="fill:var(--accent)"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    const sw = swing();
    const gNow = VG + vgAt(t);
    const now = operating(gNow, RL);
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${circuit(now.i)}${scope(sw)}${iv(sw, gNow, now)}</svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(nowMs) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches || paused) return;
    const dt = Math.min(0.05, Math.max(0, (nowMs - last) / 1000 || 0));
    last = nowMs;
    t += dt;
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    render();
    if (raf || !visible || reduce.matches || paused) return;
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
  reduce.addEventListener("change", () => start(), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  onResize(() => render());
  render();
}
