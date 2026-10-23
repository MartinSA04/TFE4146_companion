/**
 * «Diffusjon» for TFE4146, modul 04.
 *
 * Én idé: hvert hull tar tilfeldige steg, like ofte mot venstre som mot
 * høyre. Der det står flere hull på den ene siden av et snitt enn på den
 * andre, går det derfor flere over snittet fra den siden, og nettostrømmen
 * er proporsjonal med forskjellen over ett steg, altså gradienten
 * (Streetman & Banerjee §4.4.1, fig. 4–12 og 4–13). Med rekombinasjon og
 * et fast overskudd i enden blir profilen Δp·e^(−x/L) med L = √(Dτ) (§4.4.4).
 *
 * Øverst står en n-type stav med bare overskuddshullene tegnet, som røde
 * ringer. Hvert hull går en gittervandring: ett steg l til venstre eller
 * høyre hvert t̄, med hver sin fase, så D = l²/2t̄ som i bokas utledning.
 * Snittet er en stiplet loddrett linje med de to stripene av bredde l på
 * hver side tonet (bokas segment 1 og 2). Over staven står to piler fra
 * snittet: hvor mange hull som har gått over mot høyre og mot venstre det
 * siste sekundet, glattet, tegnet mot hverandre: den største i full lengde og
 * den andre i forhold, så pilene viser hvilken vei flest går. Står det for
 * få hull ved snittet, står ingen piler.
 *
 * Nederst står profilen δp(x): histogrammet av ringene i søyler på bredde l,
 * glattet litt i tid, og modellkurven stiplet: gaussen med bredden
 * √(σ₀² + 2Dt) etter et glimt, eller Δp·e^(−x/L) ved jevn injeksjon, med L
 * merket under aksen. Snittet står også i profilen.
 *
 * To starter: «Lysglimt» (et punkt midt på staven belyses i et øyeblikk, ingen
 * rekombinasjon, nytt glimt hvert NEW_EVERY s eller på knappen) og «Jevnt
 * lys i enden» (lys på endeflaten holder søylen ved x = 0 på Δp, og et hull som går
 * tilbake forbi endeflaten, er tilbake i det belyste laget; hvert hull
 * rekombinerer med sannsynligheten dt/τ; hull som når den andre enden,
 * forsvinner i kontakten). «Levetid» kort/lang gir τ og 4τ, så L dobles.
 * Avstander og tider er ikke i skala med silisium.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const STEP = 8; // px, steget l
const D = 600; // px²/s
const TBAR = (STEP * STEP) / (2 * D); // s mellom stegene
const N0 = 480; // hull i et glimt
const SIGMA0 = 15; // px, lysflekkens halvbredde
const NEW_EVERY = 7.5; // s mellom glimtene
const TAU_SHORT = 1.5; // s
const TAU_LONG = 6; // s
const DP_BIN = 26; // hull i søylen ved x = 0 ved jevn injeksjon
const WINDOW = 1.0; // s, glatting av tellingen over snittet
const R = 2.4; // px, ringens radius
const FADE = 0.35; // s, et hull som rekombinerer, blekner
const MIN_COUNT = 12; // hull i vinduet før pilene tegnes

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "glimt";
  let life = "lang";
  let planeU = 0.7; // snittets plass langs staven, 0 … 1
  let holes = []; // { x, y, next, dying }
  let tFlash = 0; // tid siden glimtet
  let cR = 0; // glattet telling mot høyre
  let cL = 0; // mot venstre
  let hist = null; // glattet histogram
  let clock = 0;

  const tau = () => (life === "lang" ? TAU_LONG : TAU_SHORT);
  const Lpx = () => Math.sqrt(D * tau());

  // ── kontroller ──────────────────────────────────────────────────────────
  const modePick = choiceRow({
    ariaLabel: "Start",
    label: "Start",
    items: [
      { value: "glimt", label: "Lysglimt" },
      { value: "inj", label: "Jevnt lys i enden" },
    ],
    onPick: (k) => {
      mode = k;
      reset();
    },
    signal,
  });
  const again = document.createElement("button");
  again.type = "button";
  again.className = "sim-btn";
  again.textContent = "Nytt glimt";
  again.addEventListener("click", () => reset(), { signal });
  const lifePick = choiceRow({
    ariaLabel: "Levetid",
    label: "Levetid",
    items: [
      { value: "kort", label: "Kort" },
      { value: "lang", label: "Lang" },
    ],
    onPick: (k) => {
      life = k;
      sync();
      if (reduce.matches) still();
    },
    signal,
  });
  const pLabel = document.createElement("label");
  pLabel.append("Snitt ");
  const pIn = document.createElement("input");
  pIn.type = "range";
  pIn.min = "0.05";
  pIn.max = "0.95";
  pIn.step = "0.01";
  pIn.value = String(planeU);
  pIn.setAttribute("aria-label", "Snittets plass langs staven");
  pLabel.append(pIn);
  pIn.addEventListener(
    "input",
    () => {
      planeU = Number(pIn.value);
      cR = cL = 0;
      if (reduce.matches) still();
      else renderDyn();
    },
    { signal },
  );
  controls.append(modePick.el, again, lifePick.el, pLabel);

  function sync() {
    modePick.sync(mode);
    lifePick.sync(life);
    again.style.display = mode === "glimt" ? "" : "none";
    lifePick.el.style.display = mode === "inj" ? "flex" : "none";
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 220) return null;
    const bx0 = 26;
    const bx1 = w - 10;
    const arrowY = 14;
    const by0 = 30;
    const by1 = by0 + 70;
    const py0 = by1 + 30; // profilens topp
    const py1 = h - 34; // profilens akse
    return { w, h, bx0, bx1, len: bx1 - bx0, arrowY, by0, by1, py0, py1 };
  }
  const planeX = () => G.bx0 + planeU * G.len;

  // ── hullene ─────────────────────────────────────────────────────────────
  const gauss = () =>
    Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random());
  const newHole = (x) => ({
    x,
    y: G.by0 + 6 + Math.random() * (G.by1 - G.by0 - 12),
    next: clock + Math.random() * TBAR,
    dying: 0,
  });

  function reset() {
    sync();
    holes = [];
    cR = cL = 0;
    hist = null;
    tFlash = 0;
    if (!G) G = layout();
    if (!G) return;
    if (mode === "glimt") {
      const xc = G.bx0 + G.len / 2;
      for (let i = 0; i < N0; i++) {
        const x = xc + Math.round((SIGMA0 * gauss()) / STEP) * STEP;
        holes.push(newHole(x));
      }
    }
    if (reduce.matches) still();
    else start();
  }

  /** Bredden på gaussen etter tiden t. */
  const sigma = (t) => Math.sqrt(SIGMA0 * SIGMA0 + 2 * D * t);

  function step(dt) {
    clock += dt;
    tFlash += dt;
    const xp = planeX();
    const xMax = G.bx1;
    let nR = 0;
    let nL = 0;
    const keep = [];
    for (const hl of holes) {
      if (hl.dying) {
        if (clock - hl.dying < FADE) keep.push(hl);
        continue;
      }
      while (hl.next <= clock) {
        const x0 = hl.x;
        let x1 = x0 + (Math.random() < 0.5 ? -STEP : STEP);
        if (x1 < G.bx0) {
          // Glimt: endeflaten speiler. Injeksjon: hullet går tilbake i det belyste laget.
          if (mode === "inj") {
            hl.gone = true;
            break;
          }
          x1 = G.bx0 + (G.bx0 - x1);
        }
        if (mode === "glimt" && x1 > xMax) x1 = xMax - (x1 - xMax);
        if (x0 < xp && x1 >= xp) nR++;
        else if (x0 >= xp && x1 < xp) nL++;
        hl.x = x1;
        hl.next += TBAR;
      }
      if (hl.gone) continue;
      if (mode === "inj") {
        if (hl.x > xMax) continue; // ut i kontakten
        if (Math.random() < dt / tau()) {
          hl.dying = clock;
          keep.push(hl);
          continue;
        }
      }
      keep.push(hl);
    }
    holes = keep;
    const k = Math.exp(-dt / WINDOW);
    cR = cR * k + nR;
    cL = cL * k + nL;
    if (mode === "inj") {
      // Lyset på endeflaten holder søylen ved x = 0 på Δp.
      let first = 0;
      for (const hl of holes) if (!hl.dying && hl.x < G.bx0 + STEP) first++;
      for (let i = first; i < DP_BIN; i++) holes.push(newHole(G.bx0));
    } else if (tFlash > NEW_EVERY) reset();
  }

  /** Uten bevegelse: et øyeblikksbilde fra modellen. */
  function still() {
    G = layout();
    if (!G) return;
    holes = [];
    const xc = G.bx0 + G.len / 2;
    if (mode === "glimt") {
      tFlash = 2.5;
      const s = sigma(tFlash);
      for (let i = 0; i < N0; i++) holes.push(newHole(xc + s * gauss()));
    } else {
      const L = Lpx();
      const n = Math.round((DP_BIN * L) / STEP);
      for (let i = 0; i < n; i++) {
        const x = G.bx0 - L * Math.log(Math.random() || 1e-9);
        if (x < G.bx1) holes.push(newHole(x));
      }
    }
    // Tellingen over snittet fra modellen: halvparten av dem innenfor ett steg på hver side.
    const dens = (x) => modelPerBin(x) / STEP;
    const xp = planeX();
    cR = (0.5 * dens(xp - STEP / 2) * STEP * WINDOW) / TBAR;
    cL = (0.5 * dens(xp + STEP / 2) * STEP * WINDOW) / TBAR;
    hist = null;
    render();
  }

  /** Modellen: forventet antall hull i en søyle på bredde l ved x. */
  function modelPerBin(x) {
    if (mode === "glimt") {
      const s = sigma(tFlash);
      const xc = G.bx0 + G.len / 2;
      return (N0 * STEP) / (Math.sqrt(2 * Math.PI) * s) * Math.exp(-((x - xc) ** 2) / (2 * s * s));
    }
    return DP_BIN * Math.exp(-(x - G.bx0) / Lpx());
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  let dynEl = null;

  function staticLayer() {
    const { bx0, bx1, by0, by1, py0, py1, w } = G;
    let s =
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="4" style="fill:var(--border)" fill-opacity="0.35" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx1, by1 + 13, "n-type", "end");
    // Profilens akser.
    s +=
      `<path d="M ${P(bx0)} ${P(py0 - 6)} V ${P(py1)} H ${P(bx1)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx0 - 4, py0 + 4, "δp", "end", "var(--fg)", ";font-style:italic") +
      tag(bx1, py1 + 13, "x", "end", "var(--fg)", ";font-style:italic");
    // Lyset: på endeflaten ved jevn injeksjon.
    if (mode === "inj") {
      let waves = "";
      for (const yy of [by0 + 16, (by0 + by1) / 2, by1 - 16]) {
        let d = `M ${P(4)} ${P(yy)}`;
        for (let i = 1; i <= 10; i++) {
          const t = i / 10;
          d += ` L ${P(4 + (bx0 - 8) * t)} ${P(yy + Math.sin(t * Math.PI * 4) * 2.5)}`;
        }
        waves += `<path d="${d}" fill="none" style="stroke:var(--yellow)" stroke-width="1.8"/>`;
      }
      s += waves;
    }
    void w;
    return s;
  }

  function dynLayer() {
    const { bx0, bx1, by0, by1, py0, py1, arrowY } = G;
    const xp = planeX();
    let s = "";
    // Glimtet: lys ned på midten av staven det første øyeblikket.
    if (mode === "glimt" && tFlash < 0.5) {
      const xc = bx0 + G.len / 2;
      const op = (1 - tFlash / 0.5).toFixed(2);
      let waves = "";
      for (const dx of [-10, 0, 10]) {
        let d = `M ${P(xc + dx)} ${P(2)}`;
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          d += ` L ${P(xc + dx + Math.sin(t * Math.PI * 4) * 2.5)} ${P(2 + (by0 - 6) * t)}`;
        }
        waves += `<path d="${d}" fill="none" style="stroke:var(--yellow)" stroke-width="1.8"/>`;
      }
      s += `<g opacity="${op}">${waves}</g>`;
    }
    // Stripene på hver side av snittet, og snittet.
    s +=
      `<rect x="${P(xp - STEP)}" y="${P(by0)}" width="${P(2 * STEP)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.13"/>` +
      `<path d="M ${P(xp)} ${P(by0 - 4)} V ${P(by1 + 4)} M ${P(xp)} ${P(py0 - 6)} V ${P(py1)}" style="stroke:var(--accent)" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    // Pilene over snittet.
    // Pilene måles mot hverandre: den største i full lengde, den andre i forhold. Med for få
    // hull ved snittet til at forholdet betyr noe, står ingen piler.
    const maxLen = Math.min(70, (bx1 - bx0) * 0.25);
    const cMax = Math.max(cR, cL);
    const lenR = cMax < MIN_COUNT ? 0 : (maxLen * cR) / cMax;
    const lenL = cMax < MIN_COUNT ? 0 : (maxLen * cL) / cMax;
    const arrow = (x0, dir, len) => {
      if (len < 2) return "";
      const x1 = x0 + dir * len;
      return (
        `<path d="M ${P(x0)} ${P(arrowY)} H ${P(x1)}" style="stroke:var(--red)" stroke-width="2"/>` +
        `<path d="M ${P(x1)} ${P(arrowY)} l ${P(-dir * 6)} -4 v 8 z" style="fill:var(--red)"/>`
      );
    };
    s += arrow(xp + 3, 1, lenR) + arrow(xp - 3, -1, lenL);
    // Hullene.
    let rings = "";
    let fading = "";
    for (const hl of holes) {
      if (hl.x < bx0 - 1 || hl.x > bx1) continue;
      if (hl.dying) {
        const u = (clock - hl.dying) / FADE;
        fading += `<circle cx="${P(hl.x)}" cy="${P(hl.y)}" r="${P(R * (1 + u))}" opacity="${(1 - u).toFixed(2)}"/>`;
      } else rings += `<circle cx="${P(hl.x)}" cy="${P(hl.y)}" r="${P(R)}"/>`;
    }
    s +=
      `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>` +
      `<g fill="none" style="stroke:var(--red)" stroke-width="1">${fading}</g>`;
    // Profilen: søyler fra histogrammet, modellkurven stiplet.
    const nb = Math.ceil(G.len / STEP);
    const counts = new Float64Array(nb);
    for (const hl of holes) {
      if (hl.dying) continue;
      const b = Math.floor((hl.x - bx0 + STEP / 2) / STEP);
      if (b >= 0 && b < nb) counts[b]++;
    }
    if (!hist || hist.length !== nb) hist = Float64Array.from(counts);
    else for (let b = 0; b < nb; b++) hist[b] += (counts[b] - hist[b]) * 0.25;
    const ymax = mode === "glimt" ? (N0 * STEP) / (Math.sqrt(2 * Math.PI) * SIGMA0) : DP_BIN * 1.25;
    const yOf = (c) => py1 - Math.min(1, c / ymax) * (py1 - py0);
    let bars = "";
    for (let b = 0; b < nb; b++) {
      if (hist[b] < 0.05) continue;
      const x = bx0 + b * STEP - STEP / 2;
      const x0 = Math.max(bx0, x);
      const x1 = Math.min(bx1, x + STEP);
      if (x1 <= x0) continue;
      const y = yOf(hist[b]);
      bars += `<rect x="${P(x0)}" y="${P(y)}" width="${P(x1 - x0 - 0.6)}" height="${P(py1 - y)}"/>`;
    }
    s += `<g style="fill:var(--red)" fill-opacity="0.28">${bars}</g>`;
    let curve = "";
    const M = 120;
    for (let i = 0; i <= M; i++) {
      const x = bx0 + (G.len * i) / M;
      curve += `${i ? "L" : "M"} ${P(x)} ${P(yOf(modelPerBin(x)))} `;
    }
    s += `<path d="${curve}" fill="none" style="stroke:var(--fg)" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    if (mode === "inj") {
      const L = Lpx();
      const xL = bx0 + L;
      const yA = py1 + 9;
      s +=
        `<path d="M ${P(bx0)} ${P(yA - 4)} v 8 M ${P(bx0)} ${P(yA)} H ${P(xL)} M ${P(xL)} ${P(yA - 4)} v 8" style="stroke:var(--fg)" stroke-width="1.2"/>` +
        tag(bx0 + L / 2, yA + 12, sub("L", "p"), "middle", "var(--fg)") +
        tag(bx0 + 4, yOf(DP_BIN) - 5, "Δp", "start", "var(--fg)");
    }
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `<g data-st>${staticLayer()}</g><g data-dyn>${dynLayer()}</g></svg>`;
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
    if (G) step(dt);
    renderDyn();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    render();
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
  reduce.addEventListener("change", () => (reduce.matches ? still() : reset()), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );

  onResize(() => {
    const old = G;
    G = layout();
    if (old && G && old.len !== G.len) {
      // Skaler hullene til den nye bredden.
      for (const hl of holes) hl.x = G.bx0 + ((hl.x - old.bx0) / old.len) * G.len;
    }
    if (reduce.matches) still();
    else render();
  });
  G = layout();
  reset();
}
