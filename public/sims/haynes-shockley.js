/**
 * «Haynes–Shockley» for TFE4146, modul 04.
 *
 * Én idé: pulsen av hull fra et lysglimt driver i feltet, sprer seg ved
 * diffusjon og mister hull ved rekombinasjon. Tiden fram til detektoren gir
 * mobiliteten, bredden gir diffusjonskoeffisienten (Streetman & Banerjee
 * §4.4.5, fig. 4–18 og 4–20, eksempel 4–5).
 *
 * Øverst står riggen som i fig. 4–20a: en stav av n-type germanium, 1 cm
 * lang, med batteriet E₀ over endene, så feltet ℰ = E₀/1 cm peker mot høyre.
 * Lyset treffer staven ved (1), og detektoren står ved (2), avstanden L
 * lenger ned. Bare overskuddshullene er tegnet, som røde ringer. Hver ring
 * har et fast normalfordelt lodd g og står i x = x₁ + v_d·t + s(t)·g/√2,
 * der s² = 4D_p·t + w₀² er 1/e-halvbredden, så skyen flytter seg med v_d og
 * vokser. Hver ring har også et fast lodd u og blekner når e^(−t/τ_p) faller
 * under det. Klammen Δx over skyen spenner 1/e-bredden 2s.
 *
 * Nederst står det oscilloskopet viser: δp ved (2) mot tiden, på samme tid
 * som staven. Strålen sveiper mens pulsen går, og kurven blir stående til
 * neste glimt. t_d er tiden fram til toppen, Δt bredden mellom 1/e-punktene,
 * merket i 1/e-høyden.
 *
 * Tallene er bokas eksempel 4–5: µ_p = 1900 cm²/V·s, D_p = 49,4 cm²/s,
 * L = 0,95 cm og E₀ = 2 V gir t_d = 0,25 ms og Δt = 117 µs. Levetiden er satt
 * til 0,5 ms (ikke fra boka). w₀ = 0,02 cm er lysflekken.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const MU = 1900; // cm²/V·s
const DP = 49.4; // cm²/s
const TAU = 500e-6; // s
const W0 = 0.02; // cm
const BAR = 1.0; // cm
const X1 = 0.03; // cm, lysflekken
const T_AXIS = 1.0e-3; // s, hele tidsaksen
const SWEEP = 4.2; // s veggklokke for hele aksen
const HOLD = 1.4; // s med ferdig kurve
const N_DOTS = 90;
const R = 2.6;

const E0S = [
  { value: "1", label: "1 V" },
  { value: "2", label: "2 V" },
  { value: "4", label: "4 V" },
];

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let e0 = 2; // V
  const L = 0.95; // cm
  let t = 0; // simulert tid
  let hold = 0;

  const vd = () => MU * (e0 / BAR); // cm/s
  const s2 = (tt) => 4 * DP * tt + W0 * W0;
  const sig = (tt) =>
    (W0 / Math.sqrt(s2(tt))) * Math.exp(-((X1 + L - (X1 + vd() * tt)) ** 2) / s2(tt) - tt / TAU);

  // Den sterkeste toppen bryterne kan gi, så den loddrette skalaen står fast.
  const REF = (() => {
    let m = 0;
    const v = MU * 4;
    for (let i = 1; i <= 800; i++) {
      const tt = (i / 800) * T_AXIS;
      const ss = 4 * DP * tt + W0 * W0;
      m = Math.max(m, (W0 / Math.sqrt(ss)) * Math.exp(-((L - v * tt) ** 2) / ss - tt / TAU));
    }
    return m;
  })();

  const lots = Array.from({ length: N_DOTS }, () => ({
    g: Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random()),
    u: Math.random(),
    y: Math.random(),
  }));

  // Kurven og det som leses av den.
  const NS = 400;
  const trace = new Float64Array(NS + 1);
  let tPeak = 0;
  let tLo = 0;
  let tHi = 0;
  function buildTrace() {
    let iP = 0;
    for (let i = 0; i <= NS; i++) {
      trace[i] = sig((i / NS) * T_AXIS);
      if (trace[i] > trace[iP]) iP = i;
    }
    tPeak = (iP / NS) * T_AXIS;
    const thr = trace[iP] / Math.E;
    const cross = (dir) => {
      let i = iP;
      while (i + dir >= 0 && i + dir <= NS && trace[i + dir] > thr) i += dir;
      const j = i + dir;
      if (j < 0 || j > NS) return (i / NS) * T_AXIS;
      const f = (trace[i] - thr) / (trace[i] - trace[j] || 1);
      return ((i + dir * f) / NS) * T_AXIS;
    };
    tLo = cross(-1);
    tHi = cross(1);
  }
  /** Når sveipet er ferdig: pulsen har passert og skyen er ute av staven, eller aksen er slutt. */
  const tEnd = () => Math.min(T_AXIS, Math.max(tHi + 1.5 * (tHi - tLo), (BAR - X1) / vd() + 0.05e-3));

  // ── kontroller ──────────────────────────────────────────────────────────
  const ePick = choiceRow({
    ariaLabel: "Batterispenningen E₀",
    label: "E₀",
    items: E0S,
    onPick: (k) => {
      e0 = Number(k);
      changed();
    },
    signal,
  });
  controls.append(ePick.el);
  function sync() {
    ePick.sync(String(e0));
  }
  function changed() {
    sync();
    buildTrace();
    t = 0;
    hold = 0;
    if (reduce.matches) t = Math.min(tEnd(), tHi + 0.6 * (tHi - tLo));
    render();
    start();
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const HALO = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";

  let G = null;
  let dynEl = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 300) return null;
    const bx0 = 22;
    const bx1 = w - 22;
    const by0 = 34;
    const by1 = 84;
    const xOf = (x) => bx0 + (x / BAR) * (bx1 - bx0);
    const battY = by1 + 26;
    const sx0 = bx0;
    const sx1 = bx1;
    const sy1 = h - 38; // skopets tidsakse
    const sy0 = battY + 44; // skopets topp
    const tX = (tt) => sx0 + (tt / T_AXIS) * (sx1 - sx0);
    const vY = (v) => sy1 - (v / REF) * (sy1 - sy0) * 0.95;
    return { w, h, bx0, bx1, by0, by1, xOf, battY, sx0, sx1, sy0, sy1, tX, vY };
  }

  function staticLayer() {
    const { bx0, bx1, by0, by1, xOf, battY, sx0, sx1, sy1, tX } = G;
    const x1 = xOf(X1);
    const x2 = xOf(X1 + L);
    let s = "";
    // Staven.
    s +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" style="fill:var(--border)" fill-opacity="0.35" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx1 - 4, by1 - 6, "n-type Ge", "end");
    // Batteriet under staven, koblet til endene: + til venstre, så feltet peker mot høyre.
    const bm = bx0 + 0.2 * (bx1 - bx0);
    s +=
      `<path d="M ${P(bx0)} ${P((by0 + by1) / 2)} H ${P(bx0 - 12)} V ${P(battY)} H ${P(bm - 6)} M ${P(bm + 6)} ${P(battY)} H ${P(bx1 + 12)} V ${P((by0 + by1) / 2)} H ${P(bx1)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1.2"/>` +
      `<path d="M ${P(bm - 6)} ${P(battY - 9)} V ${P(battY + 9)}" style="stroke:var(--fg)" stroke-width="1.4"/>` +
      `<path d="M ${P(bm + 6)} ${P(battY - 5)} V ${P(battY + 5)}" style="stroke:var(--fg)" stroke-width="2.6"/>` +
      tag(bm - 12, battY - 5, "+", "end", "var(--fg)") +
      tag(bm, battY + 22, sub("E", "0"), "middle", "var(--fg)");
    // Feltet inne i staven.
    const fy = by1 - 8;
    s +=
      `<path d="M ${P(bx0 + 10)} ${P(fy)} H ${P(bx0 + 70)}" style="stroke:var(--muted)" stroke-width="1.3"/>` +
      `<path d="M ${P(bx0 + 70)} ${P(fy)} l -6 -3.5 v 7 z" style="fill:var(--muted)"/>` +
      tag(bx0 + 76, fy + 4, "ℰ", "start", "var(--muted)", ";font-style:italic");
    // Lyset ved (1), detektoren ved (2), og L mellom dem.
    s +=
      tag(x1, by0 - 22, "(1)", "middle") +
      `<rect x="${P(x2 - 4)}" y="${P(by0 - 7)}" width="8" height="7" style="fill:var(--fg)"/>` +
      tag(x2, by0 - 12, "(2)", "middle") +
      `<path d="M ${P(x1)} ${P(by1 + 8)} v 8 M ${P(x1)} ${P(by1 + 12)} H ${P(x2)} M ${P(x2)} ${P(by1 + 8)} v 8" style="stroke:var(--fg)" stroke-width="1.1"/>` +
      tag((x1 + x2) / 2, by1 + 24, "L", "middle", "var(--fg)", ";font-style:italic" + HALO);
    // Skopet: tidsakse med merker hvert 0,2 ms.
    s += `<path d="M ${P(sx0)} ${P(G.sy0 - 4)} V ${P(sy1)} H ${P(sx1)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    for (let k = 0; k <= 5; k++) {
      const x = tX(k * 0.2e-3);
      s += `<path d="M ${P(x)} ${P(sy1)} v 4" style="stroke:var(--border-strong)"/>`;
      if (k % 1 === 0 && (k === 0 || k === 5 || G.w > 360 || k % 2 === 0))
        s += tag(x, sy1 + 27, k === 5 ? "1 ms" : (k * 0.2).toFixed(1).replace(".", ","), "middle");
    }
    s += tag(sx0 + 4, G.sy0 + 6, "δp ved (2)", "start");
    return s;
  }

  function dynLayer() {
    const { by0, by1, xOf, tX, vY, sy1 } = G;
    let s = "";
    // Glimtet ved (1) i begynnelsen av sveipet.
    const x1 = xOf(X1);
    if (t < 0.1e-3 && hold === 0) {
      let waves = "";
      for (const dx of [-6, 3]) {
        let d = `M ${P(x1 + dx + 8)} ${P(by0 - 18)}`;
        for (let i = 1; i <= 8; i++) {
          const u = i / 8;
          d += ` L ${P(x1 + dx + 8 - 8 * u + Math.sin(u * Math.PI * 3) * 2)} ${P(by0 - 18 + 16 * u)}`;
        }
        waves += `<path d="${d}" fill="none" style="stroke:var(--yellow)" stroke-width="1.8"/>`;
      }
      s += waves;
    }
    // Skyen av hull.
    const v = vd();
    const ss = Math.sqrt(s2(t));
    const xc = X1 + v * t;
    const surv = Math.exp(-t / TAU);
    let rings = "";
    for (const lot of lots) {
      if (lot.u > surv) continue;
      const x = xc + (ss * lot.g) / Math.SQRT2;
      if (x < 0 || x > BAR) continue;
      const y = by0 + 6 + lot.y * (by1 - by0 - 22);
      rings += `<circle cx="${P(xOf(x))}" cy="${P(y)}" r="${R}"/>`;
    }
    s += `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>`;
    // Δx over skyen: 1/e-bredden 2s.
    const xa = xOf(xc - ss);
    const xb = xOf(xc + ss);
    if (t > 0.03e-3 && xa < G.bx1 && surv > 0.05) {
      const xbC = Math.min(xb, G.bx1);
      const y = by0 - 4;
      s +=
        `<path d="M ${P(xa)} ${P(y - 4)} v 8 M ${P(xa)} ${P(y)} H ${P(xbC)}${xb <= G.bx1 ? ` M ${P(xb)} ${P(y - 4)} v 8` : ""}" style="stroke:var(--red)" stroke-width="1.1"/>`;
      if (xb <= G.bx1) s += tag((xa + xb) / 2, y - 6, "Δx", "middle", "var(--red)", HALO);
    }
    // Kurven fram til nå.
    const iNow = Math.min(NS, Math.floor((t / T_AXIS) * NS));
    let d = "";
    for (let i = 0; i <= iNow; i++) d += `${i ? "L" : "M"} ${P(tX((i / NS) * T_AXIS))} ${P(vY(trace[i]))} `;
    s += `<path d="${d}" fill="none" style="stroke:var(--red)" stroke-width="1.8"/>`;
    // t_d og Δt når strålen har passert dem.
    const peak = trace[Math.round((tPeak / T_AXIS) * NS)];
    if (t >= tHi) {
      const yE = vY(peak / Math.E);
      s +=
        `<path d="M ${P(G.sx0)} ${P(yE)} H ${P(G.sx1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        tag(G.sx1, yE - 4, "1/e", "end") +
        `<path d="M ${P(tX(tLo))} ${P(yE - 4)} v 8 M ${P(tX(tLo))} ${P(yE)} H ${P(tX(tHi))} M ${P(tX(tHi))} ${P(yE - 4)} v 8" style="stroke:var(--fg)" stroke-width="1.2"/>` +
        tag(tX(tHi) + 5, yE + 4, "Δt", "start", "var(--fg)", HALO);
    }
    if (t >= tPeak) {
      const xP = tX(tPeak);
      const yB = sy1 + 10;
      s +=
        `<path d="M ${P(xP)} ${P(vY(peak))} V ${P(sy1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        `<path d="M ${P(tX(0))} ${P(yB - 4)} v 8 M ${P(tX(0))} ${P(yB)} H ${P(xP)} M ${P(xP)} ${P(yB - 4)} v 8" style="stroke:var(--fg)" stroke-width="1.2"/>` +
        tag(xP + 5, yB + 4, sub("t", "d"), "start", "var(--fg)", HALO);
    }
    // Strålen.
    if (hold === 0 && iNow < NS) s += `<circle cx="${P(tX(t))}" cy="${P(vY(trace[iNow]))}" r="2.6" style="fill:var(--red)"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      staticLayer() +
      `<g data-dyn>${dynLayer()}</g></svg>`;
    dynEl = stage.firstElementChild.querySelector("[data-dyn]");
  }
  function renderDyn() {
    if (!G || !dynEl) return render();
    dynEl.innerHTML = dynLayer();
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
    if (hold > 0) {
      hold += dt;
      if (hold > HOLD) {
        hold = 0;
        t = 0;
      }
    } else {
      t += (dt / SWEEP) * T_AXIS;
      if (t >= tEnd()) {
        t = tEnd();
        hold = 1e-6;
      }
    }
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
  reduce.addEventListener("change", () => changed(), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );

  sync();
  buildTrace();
  if (reduce.matches) t = Math.min(tEnd(), tHi + 0.6 * (tHi - tLo));
  onResize(render);
  render();
}
