/**
 * «Samme kraft, ulik krumning» for TFE4146, modul 01.
 *
 * Én idé: effektiv masse uten utledningen. En konstant kraft F flytter
 * bølgevektoren like fort i alle bånd, ħ dk/dt = F. Farten gjennom krystallen
 * er helningen av båndet, v = (1/ħ) dE/dk. Hvor fort farten bygger seg opp
 * under samme kraft, avhenger da av hvor fort helningen endrer seg med k, altså
 * av krumningen: m* = ħ²/(d²E/dk²).
 *
 * «To daler»: to parabler E = ħ²k²/2m* på samme akser, m* = 0,067 m₀
 * (elektronet i GaAs, Streetman & Banerjee app. III) og 0,5 m₀. Begge
 * elektronene har samme k(t) = Ft/ħ hele tiden, så de står på samme loddrette
 * linje. Posisjonen følger av arbeidet kraften gjør: F·x = E(k) − E(0), så
 * stripa er energien lagt ned, og den lette kommer 0,5/0,067 = 7,5 ganger så
 * langt. Pila v er helningen dE/dk i samme skala for begge. Merkene legges
 * med like mellomrom i tid (et stroboskopbilde): de står like tett i k og
 * loddrett over hverandre, mens avstanden i x vokser.
 *
 * «Helt bånd»: E = E₀ − 2t cos(ka) over sonen −π/a < k < π/a. k vokser jevnt
 * og hopper fra π/a til −π/a, som er samme tilstand. v ∝ sin(ka) er størst i
 * vendepunktet ka = π/2 og null på toppen. x = (E − E_bunn)/F svinger mellom
 * 0 og 4t/F: en Bloch-svingning. Der |ka| > π/2 er d²E/dk² < 0 (tonet).
 *
 * Ikke i skala: tiden og atomene. Ved et felt på 10 kV/cm går k 0,15 Å⁻¹ per
 * ps, så dyttet her (k fra 0 til 0,065 Å⁻¹, den lette ender 0,24 eV over
 * bunnen, under L-dalen i GaAs) varer omkring 0,4 ps og flytter den lette
 * ≈ 240 nm, flere hundre gitterkonstanter. Spredning er utelatt: i en ekte
 * krystall spres elektronet etter noen tidels pikosekunder, lenge før en
 * Bloch-svingning rekker å gå rundt.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const M_LIGHT = 0.067; // m₀, elektronet i GaAs
const M_HEAVY = 0.5; // m₀
const K_END = 1; // k ved slutten av dyttet, alt annet er relativt til den
const K_RANGE = 1.6; // halve k-vinduet i «To daler», i enheter av K_END
const T_PUSH = 4; // s, hele dyttet i «To daler»
const T_BLOCH = 6; // s, én runde gjennom sonen i «Helt bånd»
const DT_MARK = 0.5; // s, tiden mellom stroboskopmerkene
const VMAX = 64; // px, pila for den største farten
const FLEN = 26; // px, kraftpila (lik for alle)
const R_DOT = 5.5; // px

// Elektroner er indigo i hele emnet; den tunge dalen får cyan så de to kan
// skilles. Kraftpila er amber (--accent), som felt- og kraftpiler ellers.
const LIGHT = "var(--indigo)";
const HEAVY = "var(--cyan)";
const FORCE = "var(--accent)";

const MODES = [
  { value: "daler", label: "To daler" },
  { value: "baand", label: "Helt bånd" },
];

export default function init({ stage, controls, getSize, onResize, signal }) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = still ? 0.5 : 1; // redusert bevegelse: langsommere, ikke av

  let mode = "daler";
  let t = 0; // s, tid med kraft på
  let running = false;
  let done = false;
  let marks = []; // tidspunktene for stroboskopmerkene

  // ── kontroller ────────────────────────────────────────────────────────────
  const modePick = choiceRow({
    ariaLabel: "Velg bånd",
    items: MODES,
    onPick: (v) => {
      mode = v;
      reset();
    },
    signal,
  });

  const pushBtn = document.createElement("button");
  pushBtn.type = "button";
  pushBtn.className = "sim-btn";
  pushBtn.addEventListener(
    "click",
    () => {
      if (done) return;
      running = !running;
      if (running && t === 0) marks = [0];
      sync();
      render();
      start();
    },
    { signal },
  );

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "sim-btn";
  resetBtn.textContent = "Nullstill";
  resetBtn.addEventListener("click", () => reset(), { signal });

  controls.append(modePick.el, pushBtn, resetBtn);

  function sync() {
    modePick.sync(mode);
    pushBtn.textContent = running ? "Pause" : "Dytt";
    pushBtn.disabled = done;
  }

  function reset() {
    t = 0;
    running = false;
    done = false;
    marks = [];
    sync();
    render();
  }

  // ── fysikken ──────────────────────────────────────────────────────────────
  // «To daler»: k i enheter av K_END, E i enheter av den lettes energi ved K_END.
  const kAt = (tt) => (K_END * tt) / T_PUSH;
  const eValley = (k, m) => (M_LIGHT / m) * k * k;
  const slopeValley = (k, m) => (2 * M_LIGHT * k) / m; // dE/dk, 2 ved slutten for den lette
  // «Helt bånd»: θ = ka i (−π, π], E normert til −1 … 1.
  const thAt = (tt) => {
    const th = (2 * Math.PI * tt) / T_BLOCH;
    return th - 2 * Math.PI * Math.floor((th + Math.PI) / (2 * Math.PI));
  };
  const eBand = (th) => -Math.cos(th);

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const g = {};

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.padL = 24;
    g.padR = 18;
    g.padT = 12;
    g.block = 64; // en stripe: etikett + krystall
    const nStrips = mode === "daler" ? 2 : 1;
    g.yA = h - nStrips * g.block - 22; // k-aksen
    g.x0 = g.padL;
    g.x1 = w - g.padR;
    g.cx = (g.x0 + g.x1) / 2;
    // Stripene: elektronet går fra sx0 til sx1. I «To daler» har den lette
    // størst fart helt ytterst, så v-pila trenger plass foran; i «Helt bånd»
    // er farten null ytterst, og bare kraftpila må få plass.
    g.sx0 = 16;
    g.sx1 = mode === "daler" ? w - 14 - VMAX - 12 : w - 14 - FLEN - 16;
    g.stripTop = g.yA + 32;
  }

  // «To daler»-akser.
  const E_MIN = -0.07;
  const E_MAX = 1.1;
  const Xk = (k) => g.cx + (k / (K_RANGE * K_END)) * (g.x1 - g.cx);
  const Ye = (e) => g.yA - ((e - E_MIN) / (E_MAX - E_MIN)) * (g.yA - g.padT);
  // «Helt bånd»-akser.
  const Xth = (th) => g.cx + (th / Math.PI) * (g.x1 - g.cx);
  const Yb = (e) => g.yA - ((e + 1.12) / 2.3) * (g.yA - g.padT);

  const mono = "font-family:var(--font-mono);font-size:11px";
  const halo = ";stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round;paint-order:stroke";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = halo) =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}${extra}">${text}</text>`;

  /** Vannrett pil fra x0 med lengde len (fortegn = retning). */
  function arrowH(x0, y, len, color, label) {
    const L = Math.abs(len);
    if (L < 0.8) return "";
    const s = Math.sign(len);
    const head = Math.min(7, L);
    const tip = x0 + len;
    let out = "";
    if (L > head)
      out += `<path d="M ${P(x0)} ${P(y)} H ${P(tip - s * head)}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
    out += `<path d="M ${P(tip)} ${P(y)} l ${P(-s * head)} ${P(-head * 0.55)} v ${P(head * 1.1)} z" style="fill:${color}"/>`;
    // Pilene står i krystallstripa, så glorien rundt etiketten har stripas farge.
    if (label) out += tag(tip + s * 4, y + 4, label, s > 0 ? "start" : "end", color, halo.replace("--canvas-bg", "--card-nested"));
    return out;
  }

  const dot = (x, y, color, ground = "var(--canvas-bg)") =>
    `<circle cx="${P(x)}" cy="${P(y)}" r="${R_DOT}" style="fill:${color}" stroke="${ground}" stroke-width="1.5"/>`;
  /** Venstre halvdel av en prikk. */
  const halfDot = (x, y, color, r = R_DOT) =>
    `<path d="M ${P(x)} ${P(y - r)} A ${r} ${r} 0 0 0 ${P(x)} ${P(y + r)} Z" style="fill:${color}"/>`;
  /** Stroboskopmerke i krystallen: en kort loddrett strek gjennom atomraden. */
  const ghostTick = (x, y, color, alpha = 0.7) =>
    `<path d="M ${P(x)} ${P(y - 6)} V ${P(y + 6)}" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity="${alpha.toFixed(2)}"/>`;
  const ghost = (x, y, color, alpha = 0.45) =>
    `<circle cx="${P(x)}" cy="${P(y)}" r="2.6" style="fill:${color}" opacity="${alpha.toFixed(2)}"/>`;

  /** Krystallen: en tonet stripe med en rad atomer. */
  function crystal(yMid) {
    const top = yMid - 19;
    let s = `<rect x="4" y="${P(top)}" width="${P(g.w - 8)}" height="38" rx="5" fill="var(--card-nested)"/>`;
    let atoms = "";
    for (let x = 11; x < g.w - 6; x += 14) atoms += `M ${P(x + 2)} ${P(yMid)} a 2 2 0 1 0 -4 0 a 2 2 0 1 0 4 0 `;
    s += `<path d="${atoms}" style="fill:var(--border-strong)"/>`;
    return s;
  }
  const Xs = (f) => g.sx0 + f * (g.sx1 - g.sx0);

  function axes(zeroLabel) {
    const { x0, x1, yA, padT, cx } = g;
    return (
      `<path d="M ${P(x0)} ${P(yA)} V ${P(padT)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(x0)} ${P(padT - 2)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>` +
      `<path d="M ${P(x0)} ${P(yA)} H ${P(x1)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(x1 + 2)} ${P(yA)} l -6 -3 v 6 z" style="fill:var(--border-strong)"/>` +
      tag(x0 - 6, padT + 10, "E", "end") +
      tag(x1 + 7, yA + 4, "k", "start") +
      (zeroLabel ? tag(cx, yA + 20, "0", "middle") : "")
    );
  }

  /** Markøren for nåværende k: loddrett linje og en trekant på aksen. */
  function kGuide(x) {
    return (
      `<path d="M ${P(x)} ${P(g.yA)} V ${P(g.padT)}" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>` +
      `<path d="M ${P(x)} ${P(g.yA + 1)} l -4.5 7 h 9 z" style="fill:var(--fg)"/>`
    );
  }
  const kTick = (x, alpha = 1) =>
    `<path d="M ${P(x)} ${P(g.yA - 5)} V ${P(g.yA + 5)}" stroke="var(--fg)" stroke-width="1.5" opacity="${(0.7 * alpha).toFixed(2)}"/>`;

  // ── «To daler» ────────────────────────────────────────────────────────────
  function svgValleys() {
    const { x0, x1, yA, padT } = g;
    const k = kAt(t);
    let s = `<defs><clipPath id="em-plot"><rect x="${P(x0)}" y="${P(padT)}" width="${P(x1 - x0)}" height="${P(yA - padT)}"/></clipPath></defs>`;
    s += axes(true);

    const curve = (m) => {
      let d = "";
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const kk = -K_RANGE + (2 * K_RANGE * i) / n;
        d += `${i ? "L" : "M"} ${P(Xk(kk))} ${P(Ye(eValley(kk, m)))} `;
      }
      return d;
    };
    s +=
      `<g clip-path="url(#em-plot)">` +
      `<path d="${curve(M_HEAVY)}" fill="none" stroke="${HEAVY}" stroke-width="2"/>` +
      `<path d="${curve(M_LIGHT)}" fill="none" stroke="${LIGHT}" stroke-width="2"/>` +
      `</g>`;

    // Navnene på dalene, ved venstre gren der det er tomt.
    const eL = 0.72;
    const kL = -Math.sqrt(eL);
    s += tag(Xk(kL) - 8, Ye(eL) + 4, "lett", "end", LIGHT);
    const kH = -K_RANGE;
    s += tag(x0 + 6, Ye(eValley(kH, M_HEAVY)) - 10, "tung", "start", HEAVY);

    // Stroboskopmerkene: like tidssteg.
    for (const tm of marks) {
      const km = kAt(tm);
      s += kTick(Xk(km));
      if (tm === 0) continue;
      s += ghost(Xk(km), Ye(eValley(km, M_HEAVY)), HEAVY);
      s += ghost(Xk(km), Ye(eValley(km, M_LIGHT)), LIGHT);
    }

    // Nåværende k og elektronene.
    const xk = Xk(k);
    s += kGuide(xk);
    const yH = Ye(eValley(k, M_HEAVY));
    const yL = Ye(eValley(k, M_LIGHT));
    if (Math.abs(yH - yL) < 0.5) {
      // Samme punkt: halvt av hver, så begge elektronene synes på bunnen.
      s += dot(xk, yH, HEAVY) + halfDot(xk, yL, LIGHT);
    } else {
      s += dot(xk, yH, HEAVY) + dot(xk, yL, LIGHT);
    }

    // Krystallene.
    const strip = (i, m, name) => {
      const col = m === M_LIGHT ? LIGHT : HEAVY;
      const top = g.stripTop + i * g.block;
      const yMid = top + 27;
      let out = tag(6, top + 1, name, "start", col);
      out += crystal(yMid);
      for (const tm of marks) {
        if (tm === 0) continue;
        out += ghostTick(Xs(eValley(kAt(tm), m)), yMid, col);
      }
      const x = Xs(eValley(k, m));
      const v = (slopeValley(k, m) / 2) * VMAX;
      if (t > 0) {
        out += arrowH(x, yMid - 11, v, col, "v");
        out += arrowH(x, yMid + 11, FLEN, FORCE, "F");
      }
      out += dot(x, yMid, col, "var(--card-nested)");
      return out;
    };
    s += strip(0, M_LIGHT, "lett, m* = 0,067 m₀");
    s += strip(1, M_HEAVY, "tung, m* = 0,5 m₀");
    return s;
  }

  // ── «Helt bånd» ───────────────────────────────────────────────────────────
  function svgBand() {
    const { x0, x1, yA, padT, cx } = g;
    const th = thAt(t);
    let s = "";

    // Negativ krumning der |ka| > π/2.
    const xa = Xth(Math.PI / 2);
    const xb = Xth(-Math.PI / 2);
    s +=
      `<rect x="${P(xa)}" y="${P(padT)}" width="${P(x1 - xa)}" height="${P(yA - padT)}" style="fill:var(--red)" fill-opacity="0.08"/>` +
      `<rect x="${P(x0)}" y="${P(padT)}" width="${P(xb - x0)}" height="${P(yA - padT)}" style="fill:var(--red)" fill-opacity="0.08"/>`;
    const yLab = Yb(-0.5);
    for (const xm of [(xa + x1) / 2, (x0 + xb) / 2]) {
      s += tag(xm, yLab, "negativ", "middle", "var(--red)");
      s += tag(xm, yLab + 14, "krumning", "middle", "var(--red)");
    }

    s += axes(true);
    s += tag(x0 + 2, yA + 20, "−π/a", "start");
    s += tag(x1, yA + 20, "π/a", "end");

    let d = "";
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const tt = -Math.PI + (2 * Math.PI * i) / n;
      d += `${i ? "L" : "M"} ${P(Xth(tt))} ${P(Yb(eBand(tt)))} `;
    }
    s += `<path d="${d}" fill="none" stroke="var(--fg)" stroke-width="2"/>`;

    // Stroboskopmerkene den siste runden, svakere jo eldre.
    const live = marks.filter((tm) => t - tm < T_BLOCH - 1e-6);
    for (const tm of live) {
      const a = 1 - (t - tm) / T_BLOCH;
      const thm = thAt(tm);
      s += kTick(Xth(thm), a);
      if (tm === t) continue;
      s += ghost(Xth(thm), Yb(eBand(thm)), LIGHT, 0.5 * a);
    }

    const xk = Xth(th);
    const y = Yb(eBand(th));
    s += kGuide(xk);
    s += dot(xk, y, LIGHT);

    // Krystallen.
    const top = g.stripTop;
    const yMid = top + 27;
    s += crystal(yMid);
    for (const tm of live) {
      if (tm === t) continue;
      const a = 1 - (t - tm) / T_BLOCH;
      s += ghostTick(Xs((1 - Math.cos(thAt(tm))) / 2), yMid, LIGHT, 0.7 * a);
    }
    const x = Xs((1 - Math.cos(th)) / 2);
    if (t > 0) {
      s += arrowH(x, yMid - 11, Math.sin(th) * VMAX, LIGHT, "v");
      s += arrowH(x, yMid + 11, FLEN, FORCE, "F");
    }
    s += dot(x, yMid, LIGHT, "var(--card-nested)");
    return s;
  }

  function render() {
    layout();
    if (g.w < 200 || g.h < 260) return; // ikke lagt ut ennå
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      (mode === "daler" ? svgValleys() : svgBand()) +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  function step(dt) {
    let tn = t + dt * SPEED;
    if (mode === "daler" && tn >= T_PUSH) {
      tn = T_PUSH;
      running = false;
      done = true;
    }
    // Merkene legges på hele tidssteg, så avstanden i k er nøyaktig lik.
    let next = (Math.floor(t / DT_MARK + 1e-9) + 1) * DT_MARK;
    while (next <= tn + 1e-9) {
      marks.push(next);
      next += DT_MARK;
    }
    if (mode === "baand") marks = marks.filter((tm) => tn - tm < T_BLOCH);
    t = tn;
    if (done) sync();
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    if (running) step(dt);
    render();
    if (running && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !running || !visible) return;
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
  onResize(render);
  render();
}
