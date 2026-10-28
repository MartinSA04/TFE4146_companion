/**
 * «Hull gjennom basen» for TFE4146, bipolartransistoren.
 *
 * Én idé: emitterovergangen står i lederetningen og sender hull inn i basen. Basen er smal, så
 * nesten alle hullene vandrer over til kollektorovergangen før de rekombinerer, og der feies de
 * over til kollektoren uansett hvor stor sperrespenningen er. Basestrømmen er elektronene som
 * basekontakten må levere: ett for hvert hull som rekombinerer i basen, og ett for hvert elektron
 * som går fra basen over i emitteren. Streetman & Banerjee §7.1–7.2, fig. 7–2 og 7–3.
 *
 * Øverst står kretsen i felles-base-kobling: batteriet V_EB mellom emitter og base og batteriet
 * V_CB mellom kollektor og base. Ledningene er tegnet tykkere jo mer strøm de fører, med I_E, I_B
 * og I_C. Under står transistoren: emitteren (p⁺), basen (n) og kollektoren (p), med ionene i de
 * to romladningssonene (oransje). Hull er røde ringer og elektroner blå prikker. Bare bærerne som
 * fører strømmen, er tegnet: hullene fra emitterkontakten til kollektorkontakten, og elektronene
 * fra basekontakten. En ring som vokser og blir borte, er en rekombinasjon.
 *
 * Modellen: hullene driver gjennom emitteren, går over sonen og vandrer tilfeldig i basen
 * (diffusjonskonstant D) med levetiden τ. Kanten mot emitteren speiler dem, og ved kollektorsonen
 * feies de over. Injeksjonsraten følger e^{qV_EB/k_BT} og diffusjonsstrømmen ved kanten,
 * (1/L)·ctnh(W_b/L), og andelen som kommer fram, er B = sech(W_b/L). Elektronene til emitteren
 * går med raten (1 − γ)/γ ganger hullraten. W_b/L er 0,4 i den smale basen og 1,05 i den brede,
 * og γ er 0,95 med sterkt dopet emitter og 0,6 med svakt dopet, så tapene er mye større enn i en
 * ekte transistor, der under én prosent av hullene går tapt. Sonen mot kollektoren vokser som
 * √(V₀ − V_CB), nesten bare inn i kollektoren.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const KT = 0.0259;
const V_TOP = 0.7; // V, injeksjonsraten er RMAX ved denne spenningen
const RMAX = 15; // hull per sekund inn i den smale basen ved 0,70 V
const X_EMIT = 0.235; // slutten av den nøytrale emitteren
const W_EB = 0.04; // sonen mellom emitter og base
const X_B0 = X_EMIT + W_EB;
const WB = { narrow: 0.16, wide: 0.42 };
const D = (WB.narrow * WB.narrow) / 2; // stav²/s, transittid 1 s i den smale basen
const LDIFF = WB.narrow / 0.4; // diffusjonslengden
const TAU = (LDIFF * LDIFF) / D; // s
const GAMMA = { strong: 0.95, weak: 0.6 };
const V0_BC = 0.69; // V
const ZBC0 = 0.035; // sonen mot kollektoren ved V_CB = 0
const V_EMIT = 0.32; // stav/s, hullene på vei gjennom emitteren
const V_COLL = 0.3; // stav/s, hullene på vei gjennom kollektoren
const CROSS = 0.18; // s over emittersonen
const LN_E = 0.6; // s, levetiden til elektronene i emitteren
const DE = 0.004; // stav²/s, elektronene i emitteren
const FADE = 0.5; // s, rekombinasjonen
const SUPPLY = 0.55; // s, elektronet fra basekontakten
const sech = (x) => 1 / Math.cosh(x);
const ctnh = (x) => 1 / Math.tanh(x);

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let veb = 0.7;
  let vcb = -5;
  let kind = "good"; // good | wide | weak
  let paused = reduce.matches;
  let holes = []; // { x, y, px, py, state: emit|crossE|base|crossC|coll, t, x0 }
  let elecs = []; // { x, y, px, py, state: toEdge|crossE|emit|supply, t, x0, y0, x1, y1 }
  let flashes = []; // { x, y, s, t }
  let clock = 0;
  let debtH = 0;
  let debtE = 0;
  const shown = { iE: 0, iB: 0, iC: 0 };

  const wb = () => (kind === "wide" ? WB.wide : WB.narrow);
  const gamma = () => (kind === "weak" ? GAMMA.weak : GAMMA.strong);
  const xB1 = () => X_B0 + wb();
  const zbc = () => ZBC0 * Math.sqrt((V0_BC - vcb) / V0_BC);
  const xC0 = () => xB1() + zbc();
  const Bt = () => sech(wb() / LDIFF);
  /** Hull per sekund fra emitteren inn i basen. */
  const rateH = () => {
    const f = Math.exp((veb - V_TOP) / KT);
    const shape = ctnh(wb() / LDIFF) / ctnh(WB.narrow / LDIFF);
    return RMAX * f * shape;
  };
  const rateE = () => (rateH() * (1 - gamma())) / gamma();
  const currents = () => {
    const h = rateH();
    const e = rateE();
    return { iE: h + e, iC: Bt() * h, iB: (1 - Bt()) * h + e };
  };
  const IREF = RMAX * (1 + (1 - GAMMA.weak) / GAMMA.weak); // den største emitterstrømmen

  // ── kontroller ────────────────────────────────────────────────────────────
  const NB = (x, k) => x.toFixed(k).replace(".", ",").replace("-", "−");
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
        const v = Number(input.value);
        set(v);
        out.textContent = `${NB(v, digits)} V`;
        changed();
      },
      { signal },
    );
    return label;
  }
  const sE = slider("V_EB", "Spenningen over emitterovergangen, positiv med emitteren positiv", 0.6, 0.7, 0.01, veb, 2, (v) => (veb = v));
  const sC = slider("V_CB", "Spenningen over kollektorovergangen, negativ med kollektoren negativ", -10, 0, 1, vcb, 0, (v) => (vcb = v));
  sE.firstChild.textContent = "";
  sE.prepend(Object.assign(document.createElement("span"), { innerHTML: "V<sub>EB</sub> " }));
  sC.firstChild.textContent = "";
  sC.prepend(Object.assign(document.createElement("span"), { innerHTML: "V<sub>CB</sub> " }));
  const kindRow = choiceRow({
    ariaLabel: "Transistoren",
    items: [
      { value: "good", label: "Smal base" },
      { value: "wide", label: "Bred base" },
      { value: "weak", label: "Svakt dopet emitter" },
    ],
    onPick: (v) => {
      kind = v;
      kindRow.sync(kind);
      reset();
    },
    signal,
  });
  kindRow.sync(kind);
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "sim-btn";
  pauseBtn.textContent = paused ? "Spill av" : "Pause";
  pauseBtn.addEventListener(
    "click",
    () => {
      paused = !paused;
      pauseBtn.textContent = paused ? "Spill av" : "Pause";
      if (paused) render();
      else start();
    },
    { signal },
  );
  controls.append(sE, sC, kindRow.el, pauseBtn);

  function changed() {
    // Hull som ligger i sonen etter at den har vokst, flyttes til kollektoren.
    for (const h of holes) if (h.state === "coll" && h.x < xC0()) h.x = xC0() + 0.002;
    if (paused || reduce.matches) settle();
    else render();
  }

  // ── modellen ──────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const yr = () => 0.08 + 0.84 * rnd(); // høyde i staven, 0 øverst
  const leadX = () => (X_B0 + xB1()) / 2;

  function reset() {
    holes = [];
    elecs = [];
    flashes = [];
    debtH = 0;
    debtE = 0;
    settle();
  }

  function spawnHole() {
    holes.push({ x: 0, y: yr(), px: 0, py: 0, state: "emit", t: 0, x0: 0 });
    const h = holes[holes.length - 1];
    h.px = h.x;
    h.py = h.y;
  }
  function spawnElectron(toX, toY, kindE) {
    const x0 = leadX();
    const e = { x: x0, y: -0.02, px: x0, py: -0.02, state: kindE, t: 0, x0, y0: -0.02, x1: toX, y1: toY };
    elecs.push(e);
  }

  function physics(dt) {
    const sd = Math.sqrt(2 * D * dt);
    const sy = Math.sqrt(2 * 0.01 * dt);
    const b1 = xB1();
    const c0 = xC0();
    const keep = [];
    for (const h of holes) {
      h.t += dt;
      if (h.state === "emit") {
        h.x += V_EMIT * dt;
        h.y = Math.min(0.92, Math.max(0.08, h.y + 0.6 * sy * gauss()));
        if (h.x >= X_EMIT) (h.state = "crossE"), (h.t = 0), (h.x0 = X_EMIT);
      } else if (h.state === "crossE") {
        h.x = X_EMIT + (W_EB * h.t) / CROSS;
        if (h.t >= CROSS) (h.state = "base"), (h.x = X_B0 + 0.002);
      } else if (h.state === "base") {
        let x = h.x + sd * gauss();
        if (x < X_B0) x = 2 * X_B0 - x;
        h.y += sy * gauss();
        if (h.y < 0.06) h.y = 0.12 - h.y;
        if (h.y > 0.94) h.y = 1.88 - h.y;
        h.x = x;
        if (x >= b1) (h.state = "crossC"), (h.t = 0), (h.x = b1), (h.x0 = b1);
        else if (rnd() < dt / TAU) {
          flashes.push({ x: h.x, y: h.y, s: 1, t: clock });
          spawnElectron(h.x, h.y, "supply");
          continue;
        }
      } else if (h.state === "crossC") {
        const dur = 0.08 + 0.9 * (c0 - h.x0);
        h.x = h.x0 + ((c0 - h.x0) * h.t) / dur;
        if (h.t >= dur) (h.state = "coll"), (h.x = c0 + 0.002);
      } else {
        h.x += V_COLL * dt;
        h.y = Math.min(0.92, Math.max(0.08, h.y + 0.6 * sy * gauss()));
        if (h.x >= 1) continue;
      }
      keep.push(h);
    }
    holes = keep;

    const keepE = [];
    const se = Math.sqrt(2 * DE * dt);
    for (const e of elecs) {
      e.t += dt;
      if (e.state === "supply" || e.state === "toEdge") {
        const u = Math.min(1, e.t / SUPPLY);
        e.x = e.x0 + (e.x1 - e.x0) * u;
        e.y = e.y0 + (e.y1 - e.y0) * u;
        if (u >= 1) {
          if (e.state === "supply") continue; // har erstattet elektronet som rekombinerte
          (e.state = "crossE"), (e.t = 0);
        }
      } else if (e.state === "crossE") {
        e.x = X_B0 - (W_EB * e.t) / CROSS;
        if (e.t >= CROSS) (e.state = "emit"), (e.x = X_EMIT - 0.002), (e.t = 0);
      } else {
        let x = e.x + se * gauss() - 0.02 * dt;
        if (x > X_EMIT) x = 2 * X_EMIT - x;
        if (x < 0.01) x = 0.02 - x;
        e.x = x;
        e.y = Math.min(0.92, Math.max(0.08, e.y + sy * gauss()));
        if (rnd() < dt / LN_E) {
          flashes.push({ x: e.x, y: e.y, s: -1, t: clock });
          continue;
        }
      }
      keepE.push(e);
    }
    elecs = keepE;

    debtH += rateH() * dt;
    debtE += rateE() * dt;
    while (debtH >= 1) (debtH -= 1), spawnHole();
    while (debtE >= 1) {
      debtE -= 1;
      spawnElectron(X_B0, yr(), "toEdge");
    }
  }

  function advance(dt) {
    clock += dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(1 / 60, left);
      physics(h);
      left -= h;
    }
    const k = Math.min(1, dt / 0.08);
    for (const c of holes) (c.px += (c.x - c.px) * k), (c.py += (c.y - c.py) * k);
    for (const c of elecs) (c.px += (c.x - c.px) * k), (c.py += (c.y - c.py) * k);
    const cur = currents();
    const ks = Math.min(1, dt / 0.3);
    for (const n of ["iE", "iB", "iC"]) shown[n] += (cur[n] - shown[n]) * ks;
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }

  /** Kjør modellen fram til stasjonær tilstand og tegn ett bilde. */
  function settle() {
    for (let t = 0; t < 14; t += 1 / 30) advance(1 / 30);
    flashes = [];
    for (const c of holes) (c.px = c.x), (c.py = c.y);
    for (const c of elecs) (c.px = c.x), (c.py = c.y);
    Object.assign(shown, currents());
    render();
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 150) return null;
    const bx0 = 14;
    const bx1 = w - 14;
    const wireY = 30;
    const by0 = 62;
    const by1 = 134;
    return { w, h, bx0, bx1, len: bx1 - bx0, wireY, by0, by1 };
  }
  const X = (x) => G.bx0 + x * G.len;
  const Y = (y) => G.by0 + y * (G.by1 - G.by0);
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const width = (i) => 0.8 + (9 * Math.max(0, i)) / IREF;

  function battery(x, y, plusLeft, name) {
    const g = 5;
    const long = (xx) => `M ${P(xx)} ${P(y - 9)} V ${P(y + 9)}`;
    const short = (xx) => `M ${P(xx)} ${P(y - 5)} V ${P(y + 5)}`;
    const xl = x - g;
    const xr = x + g;
    let s = `<rect x="${P(xl - 1)}" y="${P(y - 10)}" width="${P(2 * g + 2)}" height="20" style="fill:var(--canvas-bg)"/>`;
    s += `<path d="${plusLeft ? long(xl) : long(xr)}" style="stroke:var(--fg)" stroke-width="1.4"/>`;
    s += `<path d="${plusLeft ? short(xr) : short(xl)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += tag(xl - 3, y - 7, plusLeft ? "+" : "−", "end", "var(--fg)") + tag(xr + 3, y - 7, plusLeft ? "−" : "+", "start", "var(--fg)");
    s += tag(x, y + 21, name, "middle", "var(--fg)", ";font-style:italic" + halo);
    return s;
  }
  function arrowHead(x, y, dir, wdt) {
    // dir: "left" | "up"
    const a = 4 + wdt * 0.6;
    if (dir === "left") return `<path d="M ${P(x + a)} ${P(y - a)} L ${P(x)} ${P(y)} L ${P(x + a)} ${P(y + a)}" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    return `<path d="M ${P(x - a)} ${P(y + a)} L ${P(x)} ${P(y)} L ${P(x + a)} ${P(y + a)}" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  function circuit() {
    const { bx0, bx1, by0, by1, wireY, w } = G;
    const ym = (by0 + by1) / 2;
    const xl = 5;
    const xr = w - 5;
    const xb = X(leadX());
    const wE = width(shown.iE);
    const wB = width(shown.iB);
    const wC = width(shown.iC);
    let s = "";
    const wire = (d, wd) => `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="${wd.toFixed(2)}" stroke-linejoin="round"/>`;
    s += wire(`M ${P(bx0)} ${P(ym)} H ${P(xl)} V ${P(wireY)} H ${P(xb)}`, wE);
    s += wire(`M ${P(xb)} ${P(by0)} V ${P(wireY)}`, wB);
    s += wire(`M ${P(xb)} ${P(wireY)} H ${P(xr)} V ${P(ym)} H ${P(bx1)}`, wC);
    // Batteriene: V_EB med plussiden mot emitteren, V_CB med minussiden mot kollektoren.
    const xbe = (xl + xb) / 2 + 6;
    const xbc = xb + Math.min(70, (xr - xb) * 0.45);
    s += battery(xbe, wireY, true, `${sub("V", "EB")}`);
    s += battery(xbc, wireY, true, `${sub("V", "CB")}`);
    // Strømpilene: I_E mot emitteren, I_B ut av basen, I_C ut av kollektoren.
    const xaE = xl + Math.max(14, (xbe - 12 - xl) * 0.45);
    const xaC = xbc + 14 + Math.max(10, (xr - xbc - 14) * 0.45);
    s += arrowHead(xaE, wireY, "left", wE) + tag(xaE + 4, wireY - 9 - 0.6 * wE, sub("I", "E"), "middle", "var(--fg)", ";font-style:italic" + halo);
    s += arrowHead(xaC, wireY, "left", wC) + tag(xaC + 4, wireY - 9 - 0.6 * wC, sub("I", "C"), "middle", "var(--fg)", ";font-style:italic" + halo);
    const yaB = (wireY + by0) / 2 + 2;
    s += arrowHead(xb, yaB - 4, "up", wB) + tag(xb + 7, yaB + 4, sub("I", "B"), "start", "var(--fg)", ";font-style:italic" + halo);
    return s;
  }

  function bar() {
    const { bx0, bx1, by0, by1 } = G;
    const b1 = xB1();
    const c0 = xC0();
    let s = "";
    // Sonene tonet.
    s += `<rect x="${P(X(X_EMIT))}" y="${P(by0)}" width="${P(X(X_B0) - X(X_EMIT))}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>`;
    s += `<rect x="${P(X(b1))}" y="${P(by0)}" width="${P(X(c0) - X(b1))}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>`;
    s += `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
    // Kontaktene: emitter og kollektor i endene, basen på oversiden.
    const xb = X(leadX());
    s += `<path d="M ${P(bx0)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(bx1)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(xb - 9)} ${P(by0)} H ${P(xb + 9)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    // Ionene: «−» for akseptorer på p-siden, «+» for donorer på n-siden.
    const rows = 4;
    const ions = (from, to, sign, cols) => {
      let d = "";
      for (let i = 0; i < cols; i++)
        for (let r = 0; r < rows; r++) {
          const x = X(from + ((i + 0.5) / cols) * (to - from));
          const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
          d += `M ${P(x - 2.2)} ${P(y)} h 4.4${sign > 0 ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""} `;
        }
      return d;
    };
    const zw = (a, b) => Math.max(1, Math.round(((X(b) - X(a)) / 9)));
    // Emittersiden av sonen er tynn når emitteren er mye sterkere dopet enn basen.
    const ebSplit = kind === "weak" ? X_EMIT + 0.45 * W_EB : X_EMIT + 0.006;
    const bcSplit = b1 + 0.004;
    s += `<path d="${ions(X_EMIT, ebSplit, -1, 1)}${ions(ebSplit, X_B0, 1, Math.max(1, zw(ebSplit, X_B0)))}${ions(b1, bcSplit, 1, 1)}${ions(bcSplit, c0, -1, zw(bcSplit, c0))}" style="stroke:var(--orange)" stroke-width="1.5" opacity="0.85"/>`;
    s += tag(bx0 + 9, by1 - 6, kind === "weak" ? "p" : "p⁺", "start", "var(--fg)") + tag((X(X_B0) + X(b1)) / 2, by1 - 6, "n", "middle", "var(--fg)") + tag(bx1 - 5, by1 - 6, "p", "end", "var(--fg)");
    // Navnene og W_b under staven.
    const yl = by1 + 15;
    s += tag((bx0 + X(X_EMIT)) / 2, yl, "emitter", "middle", "var(--fg)");
    s += tag((X(X_B0) + X(b1)) / 2, yl, "base", "middle", "var(--fg)");
    const xcM = (X(c0) + bx1) / 2;
    const cw = bx1 - X(c0);
    s += cw > 66 ? tag(xcM, yl, "kollektor", "middle", "var(--fg)") : tag(bx1, yl, "kollektor", "end", "var(--fg)");
    const yb = yl + 9;
    s += `<path d="M ${P(X(X_B0))} ${P(yb - 3)} v 6 M ${P(X(X_B0))} ${P(yb)} H ${P(X(b1))} M ${P(X(b1))} ${P(yb - 3)} v 6" style="stroke:var(--fg)" stroke-width="1"/>`;
    s += tag((X(X_B0) + X(b1)) / 2, yb + 14, sub("W", "b"), "middle", "var(--fg)", ";font-style:italic");
    return s;
  }

  function carriers() {
    let rings = "";
    let dots = "";
    let trails = "";
    for (const h of holes) {
      const x = X(h.px);
      const y = Y(h.py);
      if (h.state === "crossE" || h.state === "crossC") trails += `<path d="M ${P(X(h.x0 ?? h.px))} ${P(y)} H ${P(x)}" style="stroke:var(--red)" stroke-width="1.1" opacity="0.4"/>`;
      rings += `<circle cx="${P(x)}" cy="${P(y)}" r="2.4"/>`;
    }
    for (const e of elecs) {
      const x = X(e.px);
      const y = e.py < 0 ? G.by0 + e.py * 200 : Y(e.py);
      const op = e.state === "supply" ? Math.max(0.25, 1 - Math.max(0, e.t / SUPPLY - 0.7) / 0.3) : 1;
      dots += `<circle cx="${P(x)}" cy="${P(y)}" r="2.2"${op < 1 ? ` opacity="${op.toFixed(2)}"` : ""}/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const u = (clock - f.t) / FADE;
      const x = X(f.x);
      const y = Y(f.y);
      fl +=
        f.s > 0
          ? `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.4 + 3 * u)}" fill="none" style="stroke:var(--red)" stroke-width="1.2" opacity="${(0.8 * (1 - u)).toFixed(2)}"/>`
          : `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.2 + 3 * u)}" style="fill:var(--indigo)" opacity="${(0.6 * (1 - u)).toFixed(2)}"/>`;
    }
    return `${trails}<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g><g style="fill:var(--indigo)">${dots}</g>${fl}`;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${bar()}${carriers()}${circuit()}</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches || paused) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    advance(dt);
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
  reduce.addEventListener("change", () => (reduce.matches ? settle() : start()), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  onResize(() => render());
  reset();
}
