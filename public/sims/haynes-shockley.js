/**
 * Haynes–Shockley-eksperimentet, for TFE4146 modul 04.
 * Én idé: drifttiden gir minoritetens mobilitet, og pulsbredden gir
 * diffusjonskoeffisienten. De to målingene står under hverandre, og de to
 * panelene speiler hverandre: det som er en avstand i staven, er en tid på
 * skopet. Δx i staven måles som Δt på kurven, og L under staven måles som
 * t_d under tidsaksen.
 *
 * Øverst står riggen. En n-type stav med felt langs, ⊕ til venstre og ⊖ til
 * høyre, så feltet og hullene går mot høyre. Lampen over x = 0 blinker og
 * lager en puls av hull, tegnet som røde prikker mot den blasse blå sjøen av
 * elektroner som alltid er der — hullene er minoriteten, og det er dem
 * eksperimentet måler. Prikkene drifter med v_d = µ_p·ℰ og brer seg ut ved
 * diffusjon: hver prikk har et fast normalfordelt lodd g og står i
 * x = v_d·t + (s/√2)·g, der s² = 4D_p·t + w₀² er pulsens 1/e-halvbredde med
 * startbredden w₀ = 0,025 cm fra lysflekken. Klammen over prikkene spenner
 * ±s og er Δx, så den både flytter seg og vokser. Hver prikk har også et fast
 * lodd u og forsvinner når e^(−t/τ_p) faller under det, så skyen tynnes ut
 * eksponentielt. Detektoren står ved x = L, med klammen L under staven og en
 * ledning ned i skopet. Staven er lengre enn den største L, så pulsen fortsatt
 * er å se i staven når sveipet er ferdig og bildet blir stående.
 *
 * Nederst står oscilloskopet på samme klokke som staven: strålen sveiper fra
 * venstre mot høyre mens pulsen drifter, og bulen dukker opp i det øyeblikket
 * prikkene passerer detektoren. Kurven er δp(L, t) regnet ut av det samme
 * uttrykket som prikkene følger, og den ferdige kurven blir stående til neste
 * blink. To klammer er selve målingen: t_d fra blinket til toppen, tegnet
 * under tidsaksen der L står under staven, og Δt mellom de to punktene der
 * kurven har falt til 1/e av toppen, tegnet på kurven i den høyden. Den
 * stiplede linjen viser 1/e-høyden. Klammene tegnes først når strålen har
 * passert dem, så bildet bygges opp som en måling.
 *
 * Tidsaksen og den loddrette skalaen står fast, så alle tre bryterne leses av
 * som bevegelse mot en stillestående ramme: feltet flytter bulen til venstre
 * og gjør den smalere, avstanden flytter den til høyre og gjør den bredere,
 * og levetiden senker toppen uten å flytte eller bre den ut.
 *
 * Tallene er ekte silisium: µ_p = 480 cm²/Vs og D_p = µ_p·k_BT/q = 12,4 cm²/s.
 * Bryternes områder er valgt så begge klammene er lesbare på en telefon i hele
 * dragets lengde. Tettheten av prikker er ikke i skala med noen konsentrasjon.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KT = 0.0259; // V
const MU_P = 480; // cm²/Vs, hull i Si
const D_P = MU_P * KT; // cm²/s ≈ 12,4
const W0 = 0.025; // cm, lysflekkens bredde = pulsens startbredde
const BAR_CM = 1.9; // cm, staven fra lysflekken til enden
const T_MAX = 700e-6; // s, hele tidsaksen på skopet

const E_MIN = 5;
const E_MAX = 10; // V/cm
const L_MIN = 0.8;
const L_MAX = 1.3; // cm
const TAUS = [400e-6, 1200e-6, 4000e-6]; // s
const TAU_LABEL = ["400 µs", "1,2 ms", "4 ms"];

const SWEEP_SECS = 3.6; // s veggklokke for hele tidsaksen
const HOLD_SECS = 1.2; // s med ferdig kurve før neste blink
const FLASH_SECS = 0.35; // s lampen lyser
const N_DOTS = 80;
const R = 3; // px, hullprikkens radius
const NS = 320; // punkter i kurven

/** Den sterkeste toppen bryterne kan gi, så den loddrette skalaen står fast. */
const TRACE_REF = (() => {
  const v = MU_P * E_MAX;
  const tau = TAUS[TAUS.length - 1];
  let m = 0;
  for (let i = 0; i <= 600; i++) {
    const t = (i / 600) * T_MAX;
    const s2 = 4 * D_P * t + W0 * W0;
    m = Math.max(m, (W0 / Math.sqrt(s2)) * Math.exp(-((L_MIN - v * t) ** 2) / s2 - t / tau));
  }
  return m;
})();

export default function init({ stage, controls, getSize, onResize, signal }) {
  let ef = 7.5; // V/cm
  let len = 1.0; // cm
  let tauI = 1;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const vd = () => MU_P * ef; // cm/s
  const tau = () => TAUS[tauI];
  const sigma = (t) => Math.sqrt(4 * D_P * t + W0 * W0); // cm, 1/e-halvbredde
  const amp = (t) => (W0 / sigma(t)) * Math.exp(-t / tau());
  const sig = (t) => amp(t) * Math.exp(-((len - vd() * t) ** 2) / (4 * D_P * t + W0 * W0));

  // Klokka: t er simulert tid, med fasene sveip og opphold.
  let t = 0;
  let hold = 0;
  let flash = 0;

  // Kurven og det som leses av den.
  const trace = new Float64Array(NS + 1);
  let iPeak = 0;
  let tPeak = 0;
  let tLo = 0;
  let tHi = 0;
  let tEnd = T_MAX;

  function buildTrace() {
    for (let i = 0; i <= NS; i++) trace[i] = sig((i / NS) * T_MAX);
    iPeak = 0;
    for (let i = 1; i <= NS; i++) if (trace[i] > trace[iPeak]) iPeak = i;
    tPeak = (iPeak / NS) * T_MAX;
    const thr = trace[iPeak] / Math.E;
    const cross = (dir) => {
      let i = iPeak;
      while (i + dir >= 0 && i + dir <= NS && trace[i + dir] > thr) i += dir;
      const j = i + dir;
      if (j < 0 || j > NS) return (i / NS) * T_MAX;
      const f = (trace[i] - thr) / (trace[i] - trace[j] || 1);
      return ((i + dir * f) / NS) * T_MAX;
    };
    tLo = cross(-1);
    tHi = cross(+1);
    tEnd = Math.min(T_MAX, tHi + 2.2 * (tHi - tLo));
  }

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

  const eS = slider({
    text: "Felt",
    min: E_MIN,
    max: E_MAX,
    step: 0.5,
    value: ef,
    aria: "Elektrisk felt langs staven, i volt per centimeter",
    onInput: (x) => (ef = x),
  });
  const lS = slider({
    text: "Avstand",
    min: L_MIN,
    max: L_MAX,
    step: 0.05,
    value: len,
    aria: "Avstand fra lysflekken til detektoren, i centimeter",
    onInput: (x) => (len = Math.round(x * 100) / 100),
  });
  const tS = slider({
    text: "Levetid",
    min: 0,
    max: 2,
    step: 1,
    value: tauI,
    aria: "Hullenes levetid i staven",
    onInput: (x) => (tauI = x),
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
      if (playing && t >= tEnd) restart();
      start();
    },
    { signal },
  );

  controls.append(eS.el, lS.el, tS.el, playBtn);

  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",");
  function sync() {
    eS.out.textContent = `${NB(ef, 1)} V/cm`;
    lS.out.textContent = `${NB(len)} cm`;
    tS.out.textContent = TAU_LABEL[tauI];
  }

  function restart() {
    t = 0;
    hold = 0;
    flash = FLASH_SECS;
  }

  function changed() {
    sync();
    buildTrace();
    if (playing) restart();
    else {
      t = tEnd;
      hold = HOLD_SECS;
      flash = 0;
    }
    render();
    start();
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const g = {};
  const dots = [];

  function makeDots() {
    dots.length = 0;
    for (let i = 0; i < N_DOTS; i++) {
      let u1 = 0;
      while (u1 === 0) u1 = Math.random();
      dots.push({
        g: Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random()),
        hy: Math.random(),
        u: Math.random(),
        ex: Math.random(),
        ey: Math.random(),
      });
    }
  }

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 34;
    g.bx1 = w - 34;
    g.L = g.bx1 - g.bx0;

    // Staven, med en egen bane øverst til Δx-klammen og en nederst til feltet.
    g.by0 = 32;
    g.barH = 88;
    g.by1 = g.by0 + g.barH;
    g.mid = g.by0 + 44;
    g.wy = g.by0 + 18;
    g.dy0 = g.by0 + 26;
    g.dy1 = g.by1 - 16;
    g.fy = g.by1 - 8;
    g.ly = g.by1 + 11;

    // Skopet: en skjerm med nullinje, tidsakse og t_d-klammen under den.
    g.sfy1 = h - 8;
    g.sby = g.sfy1 - 50;
    g.sfy0 = g.ly + 30;
    g.sty = g.sfy0 + 12;
    g.sigH = g.sby - g.sty;
    if (dots.length !== N_DOTS) makeDots();
  }

  const xOf = (cm) => g.bx0 + (cm / BAR_CM) * g.L;
  const tX = (s) => g.bx0 + (s / T_MAX) * g.L;
  const tY = (y) => g.sby - (y / TRACE_REF) * 0.88 * g.sigH;

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}${extra}">${text}</text>`;
  const sub = (base, s) => `${base}<tspan dy='3' font-size='9'>${s}</tspan>`;
  const arrow = (x1, y1, x2, y2, color, width = 1.5) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const hx = x2 - 7 * Math.cos(ang);
    const hy = y2 - 7 * Math.sin(ang);
    const px = 3.5 * Math.sin(ang);
    const py = -3.5 * Math.cos(ang);
    return (
      `<path d="M ${P(x1)} ${P(y1)} L ${P(hx)} ${P(hy)}" stroke="${color}" stroke-width="${width}" fill="none"/>` +
      `<path d="M ${P(x2)} ${P(y2)} L ${P(hx + px)} ${P(hy + py)} L ${P(hx - px)} ${P(hy - py)} Z" style="fill:${color}"/>`
    );
  };
  /**
   * En klamme med tagger i hver ende og navnet sitt over eller under. Er den
   * for smal til at navnet står trygt midt over, settes navnet ved siden av.
   */
  const brace = (x1, x2, y, text, above = true) => {
    const narrow = x2 - x1 < 30;
    return (
      `<path d="M ${P(x1)} ${P(y - 4)} V ${P(y + 4)} M ${P(x1)} ${P(y)} H ${P(x2)} M ${P(x2)} ${P(y - 4)} V ${P(y + 4)}" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
      (narrow
        ? tag(x2 + 6, y + 4, text, "start", "var(--fg)")
        : tag((x1 + x2) / 2, above ? y - 7 : y + 15, text, "middle", "var(--fg)"))
    );
  };
  const red = "var(--red)";
  const blue = "var(--indigo)";

  function render() {
    const { w, bx0, bx1, L, by0, by1, barH, mid, dy0, dy1, wy, ly, fy } = g;
    const { sty, sby, sfy0, sfy1 } = g;
    const tB = Math.min(t, tEnd); // strålens tid
    const s = sigma(t);
    const alive = Math.exp(-t / tau());
    const xc = vd() * t; // pulsens midtpunkt, cm
    const xL = xOf(len);

    let svg =
      `<defs><clipPath id="hs-bar"><rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}"/></clipPath>` +
      `<clipPath id="hs-scope"><rect x="${P(bx0 - 7)}" y="${P(sfy0 + 1)}" width="${P(L + 14)}" height="${P(sfy1 - sfy0 - 2)}"/></clipPath></defs>`;

    // Ledningene og polariteten: feltet peker mot høyre, og det gjør hullene også.
    const big = ";font-size:var(--text-sm);font-weight:600";
    svg +=
      `<path d="M 6 ${P(mid)} H ${P(bx0)} M ${P(bx1)} ${P(mid)} H ${P(w - 6)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      tag(16, mid - 8, "+", "middle", "var(--fg)", big) +
      tag(w - 16, mid - 8, "−", "middle", "var(--fg)", big);

    // Staven.
    svg +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      tag(bx1 - 3, by0 - 7, "n-type Si", "end");

    let inBar = "";

    // Elektronsjøen: alltid der, aldri i veien.
    let sea = "";
    for (const d of dots) sea += `<circle cx="${P(bx0 + d.ex * L)}" cy="${P(dy0 + d.ey * (dy1 - dy0))}" r="2.2"/>`;
    inBar += `<g style="fill:${blue}" fill-opacity="0.2">${sea}</g>`;

    // Feltet, likt overalt i staven.
    inBar +=
      arrow(bx0 + 18, fy, bx1 - 5, fy, "var(--accent)", 1.5) +
      tag(bx0 + 5, fy + 4, "ℰ", "start", "var(--accent)", ";font-size:var(--text-sm)");

    // Hullpulsen: drifter med feltet, brer seg ut, tynnes ut.
    let holes = "";
    for (const d of dots) {
      const a = clamp((alive - d.u) / 0.05, 0, 1);
      if (a <= 0) continue;
      const x = xOf(xc + (s / Math.SQRT2) * d.g);
      holes += `<circle cx="${P(x)}" cy="${P(dy0 + d.hy * (dy1 - dy0))}" r="${R}" fill-opacity="${P(0.9 * a)}"/>`;
    }
    inBar += `<g style="fill:${red}">${holes}</g>`;

    // Δx: pulsens 1/e-bredde, den flytter seg og vokser.
    if (xc < BAR_CM && alive > 0.02) {
      const a = xOf(Math.max(xc - s, 0));
      const b = xOf(Math.min(xc + s, BAR_CM));
      if (b - a > 16) inBar += brace(a, b, wy, "Δx");
    }
    svg += `<g clip-path="url(#hs-bar)">${inBar}</g>`;

    // Lampen over x = 0.
    const lit = flash > 0;
    const lc = lit ? "var(--accent)" : "var(--muted)";
    const ly0 = by0 - 17;
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r1 = lit ? 13 : 10;
      rays += `M ${P(bx0 + 8 * Math.cos(a))} ${P(ly0 + 8 * Math.sin(a))} L ${P(bx0 + r1 * Math.cos(a))} ${P(ly0 + r1 * Math.sin(a))} `;
    }
    svg +=
      `<circle cx="${P(bx0)}" cy="${P(ly0)}" r="5" fill="${lc}" fill-opacity="${lit ? 1 : 0.45}"/>` +
      `<path d="${rays}" stroke="${lc}" stroke-width="1.2" stroke-opacity="${lit ? 1 : 0.45}" fill="none"/>`;

    // Detektoren ved x = L, med ledningen ned i skopet.
    svg +=
      `<rect x="${P(xL - 6)}" y="${P(by1 - 3)}" width="12" height="8" rx="1.5" fill="var(--border-strong)"/>` +
      `<path d="M ${P(xL)} ${P(by1 + 5)} V ${P(sfy0)}" stroke="var(--border-strong)" stroke-width="1.5" fill="none"/>`;

    // L fra lysflekken til detektoren, slik t_d står under tidsaksen.
    svg += brace(bx0, xL, ly, "L", false);

    // ── oscilloskopet ───────────────────────────────────────────────────────
    svg += `<rect x="${P(bx0 - 8)}" y="${P(sfy0)}" width="${P(L + 16)}" height="${P(sfy1 - sfy0)}" rx="3" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;

    let ticks = "";
    for (let i = 0; i <= 7; i++) {
      const x = bx0 + (i / 7) * L;
      ticks += `M ${P(x)} ${P(sby)} V ${P(sby + (i % 2 === 0 ? 6 : 3))} `;
    }
    svg +=
      `<path d="M ${P(bx0)} ${P(sby)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>`;
    for (let i = 0; i <= 3; i++) svg += tag(bx0 + (i / 3.5) * L, sby + 17, String(i * 200), "middle");
    svg += tag(bx1, sby + 17, "µs", "end") + tag(bx0 + 2, sty + 2, "δp", "start");

    // Kurven, tegnet så langt strålen har kommet.
    const iB = Math.min(NS, Math.floor((tB / T_MAX) * NS));
    let d = `M ${P(bx0)} ${P(tY(trace[0]))}`;
    for (let i = 1; i <= iB; i++) d += ` L ${P(tX((i / NS) * T_MAX))} ${P(tY(trace[i]))}`;
    const yB = tY(sig(tB));
    d += ` L ${P(tX(tB))} ${P(yB)}`;
    let scope = `<path d="${d}" stroke="${red}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;

    // Klammene dukker opp i det strålen har passert dem.
    if (tB >= tPeak) {
      const xp = tX(tPeak);
      scope +=
        `<path d="M ${P(xp)} ${P(tY(trace[iPeak]))} V ${P(sby + 28)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brace(bx0, xp, sby + 28, sub("t", "d"), false);
    }
    if (tB >= tHi) {
      const ye = tY(trace[iPeak] / Math.E);
      const xlo = tX(tLo);
      scope +=
        `<path d="M ${P(bx0)} ${P(ye)} H ${P(xlo)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
        tag(bx0 + 2, ye - 5, "1/e", "start") +
        brace(xlo, tX(tHi), ye, "Δt");
    }

    // Strålen.
    if (tB < tEnd) {
      scope +=
        `<path d="M ${P(tX(tB))} ${P(sby)} V ${P(yB)}" stroke="${red}" stroke-width="1" stroke-opacity="0.35"/>` +
        `<circle cx="${P(tX(tB))}" cy="${P(yB)}" r="3" fill="${red}"/>`;
    }
    svg += `<g clip-path="url(#hs-scope)">${scope}</g>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── klokka ────────────────────────────────────────────────────────────────
  function step(dt) {
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (hold > 0) {
      hold -= dt;
      if (hold <= 0) restart();
      return;
    }
    t += dt * (T_MAX / SWEEP_SECS);
    if (t >= tEnd) {
      t = tEnd;
      hold = HOLD_SECS;
    }
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
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
  buildTrace();
  if (playing) restart();
  else t = tEnd;
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
