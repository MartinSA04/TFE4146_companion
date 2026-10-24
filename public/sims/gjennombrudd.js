/**
 * «Gjennombrudd» for TFE4146, diodeligningen og gjennombrudd.
 *
 * Én idé: i sperreretningen vokser feltet i sonen, og ved et kritisk felt
 * lager sonen selv bærere, på én av to måter.
 *
 * Sterk doping (Zener): sonen er tynn, og båndene heller så bratt at
 * valensbåndet på p-siden ligger rett overfor tomme tilstander i
 * ledningsbåndet på n-siden. Elektroner tunnelerer vannrett gjennom gapet med
 * bredde d. Raten følger e^{−B/ℰ} med B = 36·10⁶ V/cm (Si), så den vokser bratt
 * når d krymper. Streetman & Banerjee §5.4.1, fig. 5–20.
 *
 * Svak doping (skred): en n⁺p-overgang, så sonen er bred og ligger på p-siden,
 * og minoritetsbærerne som kommer inn, er elektroner fra p-siden. Et elektron
 * får kinetisk energi når det faller ned ledningsbåndet, og slår løs et nytt
 * elektron-hull-par når det har fått nok. I læreboka sin enkle modell har et
 * elektron som går gjennom sonen, sannsynligheten P = (V/V_br)^4 for det, og et
 * nytt par, der elektronet og hullet til sammen går én sonebredde, har også P.
 * Da blir hver bærer som kommer inn, M = 1 + P + P² + … = 1/(1 − P).
 * §5.4.2, fig. 5–21, likning (5–43)–(5–44).
 *
 * Spenningen er gitt i enheter av gjennombruddsspenningen V_br: rundt 0,6 V for
 * N_a = N_d = 4·10¹⁸ cm⁻³ (feltet når 10⁶ V/cm) og rundt 60 V for en n⁺p-overgang
 * med N_a = 10¹⁶ cm⁻³. Ved svak doping er båndene ikke tegnet i skala: ved 60 V
 * faller de 60 eV over sonen.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const U_MAX = 1.1; // høyeste sperrespenning, i V_br
const ZV0 = 1.005; // V₀ i volt for N_a = N_d = 4·10¹⁸ cm⁻³
const ZVBR = 0.627; // V_r der feltet når 10⁶ V/cm
const ZB = 36; // B/ℰ_B i e^{−B/ℰ}
const EGV = 1.12; // båndgapet i Si, eV
const NEXP = 4; // eksponenten i M = 1/(1 − (V/V_br)^n)
const I0_FRAC = 1 / 30; // sperrestrømmen uten multiplikasjon, som andel av full skala
const SPEED = 0.55; // staver per sekund gjennom sonen
const MAX_LIVE = 140;
const FADE = 0.4;

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "zener";
  let u = 0.5; // sperrespenningen i V_br
  let paused = false;
  let parts = []; // { s, x, E, dir, ionAt, phase, age, dead }
  let flashes = [];
  let clock = 0;
  let debt = 0;
  let iShown = 0;

  // ── modellen ────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const expo = () => -Math.log(rnd() || 1e-12);
  // Fall i båndene over sonen og sonens plass, i E_g og stavlengder.
  function geo() {
    if (mode === "zener") {
      const drop = (ZV0 + u * ZVBR) / EGV;
      const W = 0.22 * Math.sqrt((ZV0 + u * ZVBR) / ZV0);
      return { drop, ep: 0.5 - W / 2, en: 0.5 + W / 2, W, sym: true };
    }
    const drop = 0.72 + 3.3 * Math.min(u, 1.05);
    const W = 0.24 + 0.5 * Math.sqrt(Math.min(u, 1.05));
    return { drop, ep: 0.88 - W, en: 0.88, W, sym: false };
  }
  // E_c(x) i E_g, med E_c = 0 på p-siden.
  function Ec(x) {
    const g = geo();
    if (x <= g.ep) return 0;
    if (x >= g.en) return -g.drop;
    const t = (x - g.ep) / g.W;
    if (g.sym) return t < 0.5 ? -g.drop * 2 * t * t : -g.drop * (1 - 2 * (1 - t) * (1 - t));
    // n⁺p: hele fallet på p-siden, feltet størst ved skillet mot n⁺.
    return -g.drop * t * t;
  }
  const Ev = (x) => Ec(x) - 1;
  // x der E_c eller E_v har verdien E i sonen (båndene faller mot høyre).
  function xAt(f, E) {
    const g = geo();
    let lo = g.ep;
    let hi = g.en;
    if (f(lo) < E) return lo;
    if (f(hi) > E) return hi;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (f(m) > E) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }

  const P = () => Math.min(1, u ** NEXP);
  const M = () => (u >= 1 ? 1e9 : 1 / (1 - P()));
  function zenerRel() {
    const f = (v) => Math.sqrt((ZV0 + v * ZVBR) / (ZV0 + ZVBR));
    return Math.exp(-ZB * (1 / f(u) - 1 / f(U_MAX)));
  }
  // Strømmen som andel av full skala.
  function current() {
    if (mode === "zener") return Math.min(1.05, zenerRel());
    return Math.min(1.05, I0_FRAC * M());
  }

  // Tunnelvinduet: energiene der valensbåndet på p-siden ligger over ledningsbåndet på n-siden.
  function windowE() {
    const g = geo();
    const top = Ev(g.ep); // = −1
    const bot = -g.drop; // E_c på n-siden
    return top > bot ? { top, bot } : null;
  }
  function tunnel() {
    const w = windowE();
    if (!w) return;
    // Velg energi med vekt e^{−d/d₀}: kortest gap midt i vinduet.
    let best = null;
    for (let k = 0; k < 8; k++) {
      const E = w.bot + (w.top - w.bot) * (0.08 + 0.84 * rnd());
      const d = xAt(Ec, E) - xAt(Ev, E);
      const wgt = Math.exp(-d / 0.02);
      if (!best || rnd() < wgt / (wgt + best.wgt)) best = { E, wgt };
    }
    const E = best.E;
    const xl = xAt(Ev, E);
    const xr = xAt(Ec, E);
    parts.push({ s: -1, x: xl, E, dir: 1, phase: "tunnel", x0: xl, x1: xr, age: 0 });
    parts.push({ s: 1, x: xl, E, dir: -1, phase: "fly", age: 0 });
  }
  // Hvor en bærer i skredet slår løs et nytt par, eller null om den ikke rekker å få nok energi.
  function ionPoint(c) {
    if (mode !== "aval") return null;
    const g = geo();
    const TH = 1.05; // terskel for kinetisk energi, i E_g
    // Kinetisk energi: elektron E − E_c(x), hull E_v(x) − E.
    const ke = (x) => (c.s < 0 ? c.E - Ec(x) : Ev(x) - c.E);
    const N = 40;
    const start = c.x;
    const end = c.dir > 0 ? g.en : g.ep;
    let xt = null;
    for (let i = 1; i <= N; i++) {
      const x = start + ((end - start) * i) / N;
      if (ke(x) >= TH) {
        xt = x;
        break;
      }
    }
    if (xt === null) return null;
    return xt + (end - xt) * rnd() * 0.9;
  }
  function primary() {
    const g = geo();
    const c = { s: -1, x: g.ep, E: Ec(g.ep) + 0.05 + 0.1 * rnd(), dir: 1, phase: "fly", age: 0 };
    c.ionAt = rnd() < P() ? ionPoint(c) : null;
    parts.push(c);
  }
  // Et nytt par har én sjanse P til sammen; den går til elektronet eller hullet.
  function planPair(e, h) {
    e.ionAt = null;
    h.ionAt = null;
    if (rnd() >= P()) return;
    const [a, b] = rnd() < 0.5 ? [e, h] : [h, e];
    a.ionAt = ionPoint(a);
    if (a.ionAt == null) b.ionAt = ionPoint(b);
  }

  function physics(dt) {
    const g = geo();
    const live = parts.length;
    if (mode === "zener") {
      debt += 14 * zenerRel() * dt + 0.25 * dt;
      while (debt >= 1) {
        debt -= 1;
        if (live < MAX_LIVE) rnd() < 0.25 / (0.25 + 14 * zenerRel()) ? primary() : tunnel();
      }
    } else {
      debt += 2.2 * dt;
      while (debt >= 1) {
        debt -= 1;
        if (live < MAX_LIVE) primary();
      }
    }
    const born = [];
    for (const c of parts) {
      c.age += dt;
      if (c.phase === "tunnel") {
        c.x += (c.x1 - c.x0) * (dt / 0.3);
        if (c.x >= c.x1) {
          c.x = c.x1;
          c.phase = "fly";
        }
        continue;
      }
      const inZone = c.x > g.ep - 1e-6 && c.x < g.en + 1e-6;
      const v = inZone ? SPEED : SPEED * 0.6;
      const nx = c.x + c.dir * v * dt;
      if (c.ionAt != null && ((c.dir > 0 && nx >= c.ionAt) || (c.dir < 0 && nx <= c.ionAt))) {
        const x = c.ionAt;
        c.x = x;
        c.ionAt = null;
        flashes.push({ x, E: c.s < 0 ? Ec(x) + 0.3 : Ev(x) - 0.3, t: clock });
        // Bæreren mister energien til paret og går videre fra båndkanten uten ny sjanse.
        c.E = c.s < 0 ? Ec(x) + 0.03 : Ev(x) - 0.03;
        if (live + born.length < MAX_LIVE) {
          const e = { s: -1, x, E: Ec(x) + 0.03, dir: 1, phase: "fly", age: 0 };
          const h = { s: 1, x, E: Ev(x) - 0.03, dir: -1, phase: "fly", age: 0 };
          planPair(e, h);
          born.push(e, h);
        }
        continue;
      }
      c.x = nx;
      // Utenfor sonen kjøles bæreren ned mot båndkanten.
      if (c.x > g.en && c.s < 0) c.E += (Ec(c.x) + 0.12 - c.E) * Math.min(1, dt / 0.25);
      if (c.x < g.ep && c.s > 0) c.E += (Ev(c.x) - 0.12 - c.E) * Math.min(1, dt / 0.25);
      if (c.x > 1.02 || c.x < -0.02) c.dead = true;
    }
    parts = parts.filter((c) => !c.dead).concat(born);
  }

  function advance(dt) {
    clock += dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(1 / 60, left);
      physics(h);
      left -= h;
    }
    iShown += (current() - iShown) * Math.min(1, dt / 0.35);
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }
  function still() {
    parts = [];
    for (let t = 0; t < 3; t += 1 / 30) advance(1 / 30);
    flashes = [];
    iShown = current();
    render();
  }

  // ── kontroller ──────────────────────────────────────────────────────────
  const label = document.createElement("label");
  label.append("Sperrespenning ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = String(U_MAX);
  input.step = "0.05";
  input.value = String(u);
  input.setAttribute("aria-label", "Sperrespenningen i enheter av gjennombruddsspenningen");
  label.append(out, input);
  const showU = () => (out.innerHTML = `${u.toFixed(2).replace(".", ",")} V<sub>br</sub>`);
  input.addEventListener(
    "input",
    () => {
      u = Number(input.value);
      showU();
      if (reduce.matches || paused) still();
    },
    { signal },
  );
  const pick = choiceRow({
    ariaLabel: "Doping",
    label: "Doping",
    items: [
      { value: "zener", label: "Sterk doping" },
      { value: "aval", label: "Svak doping" },
    ],
    onPick: (k) => {
      mode = k;
      pick.sync(mode);
      parts = [];
      flashes = [];
      if (reduce.matches || paused) still();
    },
    signal,
  });
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
  controls.append(label, pauseBtn, pick.el);
  pick.sync(mode);
  showU();

  // ── tegning ─────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 260) return null;
    const bx0 = 10;
    const bx1 = w - 30;
    const wireY = 22;
    const by0 = 50;
    const by1 = 74;
    const ey0 = 112;
    const ey1 = h - 10;
    const eg = (ey1 - ey0) / (mode === "zener" ? 3.2 : 6.2); // px per E_g
    return { w, h, bx0, bx1, len: bx1 - bx0, wireY, by0, by1, ey0, ey1, eg };
  }
  const X = (x) => G.bx0 + x * G.len;
  const yE = (E) => G.ey0 + ((mode === "zener" ? 0.6 : 0.9) - E) * G.eg;
  const Pf = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${Pf(x)}" y="${Pf(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function circuit() {
    const { bx0, bx1, by0, by1, wireY } = G;
    const ym = (by0 + by1) / 2;
    const xb = bx0 + G.len * 0.22;
    const xr = bx0 + G.len * 0.48;
    const xa = bx0 + G.len * 0.76;
    const r = 15;
    let s = `<path d="M ${Pf(bx0)} ${Pf(ym)} H ${Pf(bx0 - 6)} V ${Pf(wireY)} H ${Pf(xb - 5)} M ${Pf(xb + 5)} ${Pf(wireY)} H ${Pf(xr - 14)} M ${Pf(xr + 14)} ${Pf(wireY)} H ${Pf(xa - r)} M ${Pf(xa + r)} ${Pf(wireY)} H ${Pf(bx1 + 6)} V ${Pf(ym)} H ${Pf(bx1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    // Batteriet i sperreretning: pluss mot n-siden (høyre plate lang).
    s += `<path d="M ${Pf(xb - 5)} ${Pf(wireY - 5)} V ${Pf(wireY + 5)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += `<path d="M ${Pf(xb + 5)} ${Pf(wireY - 9)} V ${Pf(wireY + 9)}" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    s += tag(xb - 9, wireY - 6, "−", "end", "var(--fg)") + tag(xb + 9, wireY - 6, "+", "start", "var(--fg)");
    // Motstanden.
    let z = `M ${Pf(xr - 14)} ${Pf(wireY)}`;
    for (let i = 0; i < 6; i++) z += ` L ${Pf(xr - 14 + (i + 0.5) * (28 / 6))} ${Pf(wireY + (i % 2 ? 5 : -5))}`;
    z += ` L ${Pf(xr + 14)} ${Pf(wireY)}`;
    s += `<path d="${z}" fill="none" style="stroke:var(--fg)" stroke-width="1.2" stroke-linejoin="round"/>` + tag(xr, wireY - 9, "R", "middle", "var(--fg)", ";font-style:italic");
    // Amperemeteret med nullpunkt i midten; sperrestrømmen slår mot venstre.
    const ang = ((-Math.min(1.05, iShown) * 70) * Math.PI) / 180;
    s += `<circle cx="${Pf(xa)}" cy="${Pf(wireY)}" r="${r}" style="fill:var(--canvas-bg);stroke:var(--fg)" stroke-width="1.2"/>`;
    for (const t of [-1, -0.5, 0, 0.5, 1]) {
      const a = (t * 70 * Math.PI) / 180;
      s += `<path d="M ${Pf(xa + Math.sin(a) * (r - 4))} ${Pf(wireY + 4 - Math.cos(a) * (r - 4))} L ${Pf(xa + Math.sin(a) * (r - 1.5))} ${Pf(wireY + 4 - Math.cos(a) * (r - 1.5))}" style="stroke:var(--muted)" stroke-width="${t === 0 ? 1.4 : 1}"/>`;
    }
    s += `<path d="M ${Pf(xa)} ${Pf(wireY + 4)} L ${Pf(xa + Math.sin(ang) * (r - 3))} ${Pf(wireY + 4 - Math.cos(ang) * (r - 3))}" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round"/>`;
    s += tag(xa + r + 4, wireY - 8, "I", "start", "var(--fg)", ";font-style:italic");
    return s;
  }

  function bar() {
    const { bx0, bx1, by0, by1 } = G;
    const g = geo();
    const x0 = X(g.ep);
    const x1 = X(g.en);
    let s =
      `<rect x="${Pf(x0)}" y="${Pf(by0)}" width="${Pf(x1 - x0)}" height="${Pf(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
      `<rect x="${Pf(bx0)}" y="${Pf(by0)}" width="${Pf(bx1 - bx0)}" height="${Pf(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${Pf(bx0)} ${Pf(by0 + 2)} V ${Pf(by1 - 2)} M ${Pf(bx1)} ${Pf(by0 + 2)} V ${Pf(by1 - 2)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    // Ionene: tett i den sterkt dopede sonen, glissent i den svakt dopede.
    const rows = 3;
    let d = "";
    const put = (from, to, cols, sign) => {
      for (let i = 0; i < cols; i++)
        for (let r = 0; r < rows; r++) {
          const x = X(from + ((i + 0.5) / cols) * (to - from));
          const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
          d += `M ${Pf(x - 2.2)} ${Pf(y)} h 4.4${sign > 0 ? ` M ${Pf(x)} ${Pf(y - 2.2)} v 4.4` : ""} `;
        }
    };
    if (g.sym) {
      const cols = Math.max(2, Math.round((((g.en - g.ep) / 2) * G.len) / 7));
      put(g.ep, 0.5, cols, -1);
      put(0.5, g.en, cols, 1);
    } else {
      const cols = Math.max(2, Math.round(((g.en - g.ep) * G.len) / 26));
      put(g.ep, g.en - 0.01, cols, -1);
      put(g.en, g.en + 0.012, 1, 1);
    }
    s += `<path d="${d}" style="stroke:var(--orange)" stroke-width="1.6"/>`;
    s += tag(bx0 + 6, by1 - 7, g.sym ? "p⁺" : "p", "start", "var(--fg)") + tag(bx1 - 6, by1 - 7, "n⁺", "end", "var(--fg)");
    const yb = by1 + 11;
    if (x1 - x0 > 18)
      s +=
        `<path d="M ${Pf(x0)} ${Pf(yb - 4)} v 8 M ${Pf(x0)} ${Pf(yb)} H ${Pf(x1)} M ${Pf(x1)} ${Pf(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
        tag((x0 + x1) / 2, yb + 13, "W", "middle", "var(--fg)", ";font-style:italic" + halo);
    return s;
  }

  function bands() {
    const { bx0, bx1, ey0, ey1 } = G;
    const g = geo();
    let s =
      `<rect x="${Pf(X(g.ep))}" y="${Pf(ey0 - 14)}" width="${Pf(X(g.en) - X(g.ep))}" height="${Pf(ey1 - ey0 + 14)}" style="fill:var(--accent)" fill-opacity="0.07"/>` +
      `<path d="M ${Pf(X(g.ep))} ${Pf(G.by0)} V ${Pf(ey1)} M ${Pf(X(g.en))} ${Pf(G.by0)} V ${Pf(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;
    // De fylte tilstandene i valensbåndet, tonet.
    const N = 80;
    let c = "";
    let v = "";
    let fill = "";
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      c += `${i ? "L" : "M"} ${Pf(X(x))} ${Pf(yE(Ec(x)))} `;
      v += `${i ? "L" : "M"} ${Pf(X(x))} ${Pf(yE(Ev(x)))} `;
    }
    fill = `${v} L ${Pf(bx1)} ${Pf(ey1)} L ${Pf(bx0)} ${Pf(ey1)} Z`;
    s +=
      `<path d="${fill}" style="fill:var(--fg)" fill-opacity="0.07"/>` +
      `<path d="${c}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${v}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    s += tag(bx1 + 4, yE(-g.drop) + 4, sub("E", "c"), "start", "var(--fg)") + tag(bx1 + 4, yE(-g.drop - 1) + 4, sub("E", "v"), "start", "var(--fg)");
    // Zener: gapet d i midten av tunnelvinduet.
    if (mode === "zener") {
      const w = windowE();
      if (w) {
        const E = (w.top + w.bot) / 2;
        const xl = X(xAt(Ev, E));
        const xr = X(xAt(Ec, E));
        const y = yE(E);
        s += `<path d="M ${Pf(bx0)} ${Pf(yE(w.top))} H ${Pf(X(g.en))}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
        s += `<path d="M ${Pf(X(g.ep))} ${Pf(yE(w.bot))} H ${Pf(bx1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
        if (xr - xl > 3) {
          const yb = y + 16;
          s +=
            `<path d="M ${Pf(xl)} ${Pf(yb - 4)} v 8 M ${Pf(xl)} ${Pf(yb)} H ${Pf(xr)} M ${Pf(xr)} ${Pf(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
            tag((xl + xr) / 2, yb + 14, "d", "middle", "var(--fg)", ";font-style:italic" + halo);
        }
      }
    }
    // Bærerne og stiene deres.
    let dots = "";
    let rings = "";
    let paths = "";
    for (const p of parts) {
      const x = X(p.x);
      const y = yE(p.E);
      if (p.phase === "tunnel") paths += `<path d="M ${Pf(X(p.x0))} ${Pf(y)} H ${Pf(x)}" style="stroke:var(--indigo)" stroke-width="1.2" stroke-dasharray="2 2"/>`;
      if (p.s < 0) dots += `<circle cx="${Pf(x)}" cy="${Pf(y)}" r="2.3"/>`;
      else rings += `<circle cx="${Pf(x)}" cy="${Pf(y)}" r="2.4"/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const k = (clock - f.t) / FADE;
      fl += `<circle cx="${Pf(X(f.x))}" cy="${Pf(yE(f.E))}" r="${Pf(3 + 7 * k)}" fill="none" style="stroke:var(--orange)" stroke-width="1.5" opacity="${(1 - k).toFixed(2)}"/>`;
    }
    s += paths + fl + `<g style="fill:var(--indigo)">${dots}</g><g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${circuit()}${bar()}${bands()}</svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
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
  reduce.addEventListener("change", () => (reduce.matches ? still() : start()), { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  onResize(() => render());
  if (reduce.matches) still();
  else start();
}
