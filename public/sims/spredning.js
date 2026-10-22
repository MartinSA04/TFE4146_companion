/**
 * Det som sprer elektronene, for TFE4146 modul 03.
 * Én idé: et perfekt gitter sprer ikke; det som sprer, er atomer som svinger ut av
 * plassen sin og ioner som sitter der et silisiumatom skulle vært. Svingningene vokser
 * med temperaturen, mens et ion bøyer av et langsomt elektron mye mer enn et raskt.
 * Mobiliteten begrenses av den mekanismen som sprer mest, og får en topp.
 *
 * Øverst står krystallen sett ovenfra, tegnet i to dimensjoner: silisiumatomene på et
 * kvadratisk gitter rister med et utslag ∝ √T, donorionene ⊕ sitter på noen av plassene,
 * og elektronene (blå prikker med et kort spor) farer rundt med en fart ∝ √T.
 * - Ionene trekker på elektronene med et skjermet Coulomb-potensial, og banene regnes ut
 *   (Verlet), så de langsomme svinger rundt ionet og de raske går nesten rett forbi.
 * - Spredning mot gittersvingningene skjer tilfeldig med raten Γ ∝ T^{3/2}; den vises som
 *   en ring der elektronet er, og atomet nærmest lyser opp. Etter en slik spredning får
 *   elektronet en ny, termisk fart i en tilfeldig retning (energien langt fra ionene
 *   trekkes, så et elektron aldri fanges).
 *
 * Nederst står mobiliteten til elektronene i Si mot temperaturen, med logaritmisk
 * μ-akse: μ_gitter = 1350 (T/300)^{-3/2}, μ_ioner = 1454 (10¹⁷/N)(T/300)^{3/2} og
 * 1/μ = 1/μ_gitter + 1/μ_ioner (bokas forenklede modell, kalibrert til 1350 og 700 cm²/V·s
 * ved 300 K). De to grenene er stiplet, kurven for valgt doping er heltrukket, de andre
 * dopingene er svake, og prikken står ved valgt temperatur.
 *
 * Ionene står mye tettere enn i virkeligheten, og utslagene er overdrevet.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const SPACING = 26; // px mellom atomene
const V300 = 55; // px/s, midlere fart ved 300 K
const GAMMA300 = 1.1; // 1/s, gitterspredning ved 300 K
const KC = 21000; // px³/s², styrken til ionets tiltrekning (massen er 1)
const SOFT = 6; // px, utglatting nær ionet
const SCREEN = 55; // px, skjermingslengden
const SUB = 1 / 240; // s, tidssteg i integrasjonen
const TRAIL_PX = 75; // px, lengden av sporet ved midlere fart
const DOPINGS = [
  { value: "0", label: "ren", n: 0, ions: 0 },
  { value: "16", label: "10¹⁶ cm⁻³", n: 1e16, ions: 1 },
  { value: "17", label: "10¹⁷ cm⁻³", n: 1e17, ions: 10 },
];

const muL = (T) => 1350 * Math.pow(T / 300, -1.5);
const muI = (T, n) => (n > 0 ? 1454 * (1e17 / n) * Math.pow(T / 300, 1.5) : Infinity);
const muTot = (T, n) => 1 / (1 / muL(T) + 1 / muI(T, n));

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let T = 300;
  let doping = "17";
  let playing = !reduced;

  // ── kontroller ────────────────────────────────────────────────────────────
  const tLabel = document.createElement("label");
  tLabel.append("Temperatur ");
  const tOut = document.createElement("output");
  const tInput = document.createElement("input");
  tInput.type = "range";
  tInput.min = "50";
  tInput.max = "600";
  tInput.step = "10";
  tInput.value = String(T);
  tInput.setAttribute("aria-label", "Temperatur i kelvin");
  tLabel.append(tOut, tInput);
  tInput.addEventListener("input", () => { T = Number(tInput.value); retemper(); sync(); draw(); }, { signal });

  const dopRow = choiceRow({
    ariaLabel: "Doping",
    label: "Doping",
    items: DOPINGS.map((d) => ({ value: d.value, label: d.label })),
    onPick: (v) => { doping = v; placeIons(); sync(); draw(); },
    signal,
  });

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  playBtn.addEventListener("click", () => { playing = !playing; sync(); start(); }, { signal });

  controls.append(tLabel, dopRow.el, playBtn);
  function sync() {
    tOut.textContent = `${T} K`;
    dopRow.sync(doping);
    playBtn.textContent = playing ? "Pause" : "Spill av";
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const g = {};
  let atoms = []; // { x, y, ph1, ph2, f1, f2, flash }
  let ions = []; // { x, y }
  let elec = []; // { x, y, vx, vy, trail: [{x,y,t,brk}] }
  let rings = []; // { x, y, age }
  let time = 0;

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.cx0 = 10;
    g.cx1 = w - 10;
    g.cy0 = 8;
    g.cy1 = Math.round(h * 0.56);
    g.W = g.cx1 - g.cx0;
    g.H = g.cy1 - g.cy0;
    g.px0 = 48; // grafen
    g.px1 = w - 14;
    g.py0 = g.cy1 + 36;
    g.py1 = h - 30;
    g.area = (g.W * g.H) / (340 * 240);

    const cols = Math.max(4, Math.floor(g.W / SPACING));
    const rows = Math.max(3, Math.floor(g.H / SPACING));
    g.ox = g.cx0 + (g.W - (cols - 1) * SPACING) / 2;
    g.oy = g.cy0 + (g.H - (rows - 1) * SPACING) / 2;
    g.cols = cols;
    g.rows = rows;
    atoms = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        atoms.push({
          i, j,
          x: g.ox + i * SPACING,
          y: g.oy + j * SPACING,
          ph1: Math.random() * 6.283, ph2: Math.random() * 6.283,
          f1: 2.2 + 1.6 * Math.random(), f2: 2.2 + 1.6 * Math.random(),
          flash: 0,
        });
      }
    }
    placeIons();
    const ne = Math.round(Math.min(18, Math.max(7, 8 * g.area)));
    if (elec.length !== ne) {
      elec = [];
      for (let k = 0; k < ne; k++) elec.push(newElectron());
    }
    for (const e of elec) { e.x = g.cx0 + Math.random() * g.W; e.y = g.cy0 + Math.random() * g.H; e.trail = []; }
  }

  function placeIons() {
    const d = DOPINGS.find((x) => x.value === doping);
    const n = Math.round(d.ions * Math.max(1, g.area));
    ions = [];
    const free = atoms.filter((a) => a.i > 0 && a.j > 0 && a.i < g.cols - 1 && a.j < g.rows - 1);
    let guard = 0;
    while (ions.length < n && guard++ < 2000) {
      const a = free[Math.floor(Math.random() * free.length)];
      if (ions.some((o) => Math.hypot(o.x - a.x, o.y - a.y) < 2.2 * SPACING)) continue;
      ions.push({ x: a.x, y: a.y, atom: a });
    }
    for (const a of atoms) a.ion = false;
    for (const o of ions) o.atom.ion = true;
    // Ny fart til alle, så ingen står igjen bundet til et ion som nettopp kom.
    for (const e of elec) { e.trail = []; if (g.W) kick(e); }
  }

  // ── fysikken ──────────────────────────────────────────────────────────────
  const sigma = () => (V300 * Math.sqrt(T / 300)) / 1.2533;
  const rayleigh = () => {
    for (;;) {
      const v = sigma() * Math.sqrt(-2 * Math.log(1 - Math.random()));
      if (v < 2.4 * sigma()) return v;
    }
  };
  const gamma = () => GAMMA300 * Math.pow(T / 300, 1.5);

  /** Potensialet fra alle ionene og kraften det gir, med periodiske kanter. */
  function wrapD(d, L) { return d - L * Math.round(d / L); }
  function potential(x, y) {
    let u = 0;
    for (const o of ions) {
      const dx = wrapD(x - o.x, g.W), dy = wrapD(y - o.y, g.H);
      const r = Math.hypot(dx, dy);
      u -= (KC * Math.exp(-r / SCREEN)) / Math.sqrt(r * r + SOFT * SOFT);
    }
    return u;
  }
  function force(x, y) {
    let fx = 0, fy = 0;
    for (const o of ions) {
      const dx = wrapD(x - o.x, g.W), dy = wrapD(y - o.y, g.H);
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r > 4 * SCREEN) continue;
      const s = Math.sqrt(r2 + SOFT * SOFT);
      const e = Math.exp(-r / SCREEN);
      // U = −K e^{−r/λ}/s; dU/dr = K e^{−r/λ} (1/(λ s) + r/s³); kraften peker mot ionet.
      const dUdr = KC * e * (1 / (SCREEN * s) + r / (s * s * s));
      if (r > 1e-6) { fx -= (dUdr * dx) / r; fy -= (dUdr * dy) / r; }
    }
    return [fx, fy];
  }

  /** Ny termisk fart langt fra ionene, så energien alltid er positiv. */
  function kick(e) {
    const v = rayleigh();
    const u = potential(e.x, e.y);
    const vLoc = Math.sqrt(v * v - 2 * u);
    const th = Math.random() * 6.283;
    e.vx = vLoc * Math.cos(th);
    e.vy = vLoc * Math.sin(th);
  }
  function newElectron() {
    const e = { x: 0, y: 0, vx: 0, vy: 0, trail: [] };
    return e;
  }

  /** Temperaturen endret: skaler farten så energien langt fra ionene følger T. */
  let lastT = T;
  function retemper() {
    const f = Math.sqrt(T / lastT);
    for (const e of elec) {
      const u = potential(e.x, e.y);
      const far = 0.5 * (e.vx * e.vx + e.vy * e.vy) + u;
      const farNew = Math.max(0.5 * 4, far * f * f);
      const vLoc = Math.sqrt(Math.max(1, 2 * (farNew - u)));
      const v = Math.hypot(e.vx, e.vy) || 1;
      e.vx *= vLoc / v;
      e.vy *= vLoc / v;
    }
    lastT = T;
  }

  function step(dt) {
    time += dt;
    const p = 1 - Math.exp(-gamma() * dt);
    for (const e of elec) {
      // Spredning mot gittersvingningene.
      if (Math.random() < p) {
        kick(e);
        rings.push({ x: e.x, y: e.y, age: 0 });
        let best = null, bd = Infinity;
        for (const a of atoms) {
          const d = Math.hypot(a.x - e.x, a.y - e.y);
          if (d < bd) { bd = d; best = a; }
        }
        if (best) best.flash = 0.35;
      }
      // Banen i ionenes felt, velocity Verlet.
      let left = dt;
      while (left > 1e-9) {
        const h = Math.min(SUB, left);
        left -= h;
        const [ax, ay] = force(e.x, e.y);
        e.vx += 0.5 * h * ax;
        e.vy += 0.5 * h * ay;
        e.x += h * e.vx;
        e.y += h * e.vy;
        const [bx, by] = force(e.x, e.y);
        e.vx += 0.5 * h * bx;
        e.vy += 0.5 * h * by;
      }
      let brk = false;
      if (e.x < g.cx0) { e.x += g.W; brk = true; }
      if (e.x > g.cx1) { e.x -= g.W; brk = true; }
      if (e.y < g.cy0) { e.y += g.H; brk = true; }
      if (e.y > g.cy1) { e.y -= g.H; brk = true; }
      e.trail.push({ x: e.x, y: e.y, t: time, brk });
      const trail = TRAIL_PX / (V300 * Math.sqrt(T / 300));
      while (e.trail.length && e.trail[0].t < time - trail) e.trail.shift();
    }
    for (const r of rings) r.age += dt;
    rings = rings.filter((r) => r.age < 0.45);
    for (const a of atoms) a.flash = Math.max(0, a.flash - dt);
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const mono = "font-family:var(--font-mono);font-size:11px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}" paint-order="stroke" stroke="var(--canvas-bg)" stroke-width="3">${text}</text>`;

  function draw() {
    if (!g.w) return;
    const { w, h, cx0, cy0, W, H, px0, px1, py0, py1 } = g;
    let s = "";
    s += `<defs><clipPath id="spr-clip"><rect x="${P(cx0)}" y="${P(cy0)}" width="${P(W)}" height="${P(H)}"/></clipPath></defs>`;
    s += `<rect x="${P(cx0)}" y="${P(cy0)}" width="${P(W)}" height="${P(H)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1"/>`;
    s += `<g clip-path="url(#spr-clip)">`;

    // Atomene rister med et utslag ∝ √T.
    const amp = 1.5 * Math.sqrt(T / 100);
    let at = "", flash = "";
    for (const a of atoms) {
      if (a.ion) continue;
      const dx = amp * Math.sin(6.283 * a.f1 * time + a.ph1);
      const dy = amp * Math.sin(6.283 * a.f2 * time + a.ph2);
      at += `<circle cx="${P(a.x + dx)}" cy="${P(a.y + dy)}" r="4"/>`;
      if (a.flash > 0) flash += `<circle cx="${P(a.x + dx)}" cy="${P(a.y + dy)}" r="5.5" stroke-opacity="${P(a.flash / 0.35)}"/>`;
    }
    s += `<g style="fill:var(--border-strong)" fill-opacity="0.75">${at}</g>`;
    s += `<g fill="none" stroke="var(--fg)" stroke-width="1.6">${flash}</g>`;

    // Ionene sitter fast der et silisiumatom skulle vært.
    const ri = 5.2;
    for (const o of ions) {
      s +=
        `<circle cx="${P(o.x)}" cy="${P(o.y)}" r="${ri}" fill="var(--canvas-bg)" stroke="var(--orange)" stroke-width="1.4"/>` +
        `<path d="M ${P(o.x - 3)} ${P(o.y)} H ${P(o.x + 3)} M ${P(o.x)} ${P(o.y - 3)} V ${P(o.y + 3)}" stroke="var(--orange)" stroke-width="1.4"/>`;
    }

    // Ringene der et elektron ble spredt mot gitteret.
    for (const r of rings) {
      const f = r.age / 0.45;
      s += `<circle cx="${P(r.x)}" cy="${P(r.y)}" r="${P(3 + 9 * f)}" fill="none" stroke="var(--indigo)" stroke-width="1.2" stroke-opacity="${P(1 - f)}"/>`;
    }

    // Elektronene med sporet.
    let trails = "", dots = "";
    for (const e of elec) {
      let d = "";
      for (let k = 0; k < e.trail.length; k++) {
        const pt = e.trail[k];
        d += `${k === 0 || pt.brk ? "M" : "L"} ${P(pt.x)} ${P(pt.y)} `;
      }
      trails += `<path d="${d}"/>`;
      dots += `<circle cx="${P(e.x)}" cy="${P(e.y)}" r="3.6"/>`;
    }
    s += `<g fill="none" stroke="var(--indigo)" stroke-width="1.3" stroke-opacity="0.5" stroke-linejoin="round">${trails}</g>`;
    s += `<g style="fill:var(--indigo)">${dots}</g>`;
    s += `</g>`;

    // Grafen: μ_n mot T, logaritmisk μ-akse.
    const T0 = 0, T1 = 600, M0 = Math.log10(50), M1 = Math.log10(30000);
    const X = (t) => px0 + ((t - T0) / (T1 - T0)) * (px1 - px0);
    const Y = (mu) => py1 - ((Math.log10(mu) - M0) / (M1 - M0)) * (py1 - py0);
    const clampY = (y) => Math.max(py0 - 2, Math.min(py1, y));
    const curve = (fn) => {
      let d = "";
      for (let t = 30; t <= 600; t += 5) {
        const mu = fn(t);
        if (!isFinite(mu)) continue;
        const y = Y(mu);
        if (y < py0 - 2) { d += ""; continue; }
        d += `${d ? "L" : "M"} ${P(X(t))} ${P(clampY(y))} `;
      }
      return d;
    };
    // Aksene.
    s += `<path d="M ${P(px0)} ${P(py0 - 4)} V ${P(py1)} H ${P(px1)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
    for (const t of [0, 200, 400, 600]) {
      s += `<path d="M ${P(X(t))} ${P(py1)} v 4" stroke="var(--border-strong)"/>`;
      s += tag(X(t), py1 + 15, t === 600 ? "600 K" : String(t), t === 600 ? "end" : "middle");
    }
    for (const [mu, lab] of [[100, "10²"], [1000, "10³"], [10000, "10⁴"]]) {
      s += `<path d="M ${P(px0 - 4)} ${P(Y(mu))} H ${P(px0)}" stroke="var(--border-strong)"/>`;
      s += tag(px0 - 7, Y(mu) + 4, lab, "end");
    }
    s += tag(px0 - 38, py0 - 14, "μ<tspan dy='3' font-size='9'>n</tspan><tspan dy='-3'> (cm²/V·s)</tspan>", "start", "var(--fg)");

    const d = DOPINGS.find((x) => x.value === doping);
    // De andre dopingene, svakt.
    for (const o of DOPINGS) {
      if (o.value === doping) continue;
      s += `<path d="${curve((t) => muTot(t, o.n))}" fill="none" stroke="var(--muted)" stroke-width="1.2" opacity="0.35"/>`;
    }
    // Grenene.
    s += `<path d="${curve(muL)}" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    s += tag(X(560), clampY(Y(muL(560))) - 8, "gitter", "end");
    if (d.n > 0) {
      s += `<path d="${curve((t) => muI(t, d.n))}" fill="none" stroke="var(--orange)" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      // Etiketten står under grenen ved høyre kant, eller der grenen går ut av grafen.
      let tl = 590;
      while (tl > 200 && Y(muI(tl, d.n)) < py0 + 14) tl -= 10;
      s += tag(X(tl) - 4, Y(muI(tl, d.n)) + 15, "ioner", "end", "var(--orange)");
    }
    // Kurven og prikken.
    s += `<path d="${curve((t) => muTot(t, d.n))}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
    const muNow = muTot(T, d.n);
    s += `<path d="M ${P(X(T))} ${P(py1)} V ${P(Y(muNow))}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 3"/>`;
    s += `<circle cx="${P(X(T))}" cy="${P(Y(muNow))}" r="4.5" style="fill:var(--accent)"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-label="Elektroner i en krystall med svingende atomer og ioner, og mobiliteten mot temperaturen." style="display:block">` +
      s +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    step(dt);
    draw();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }, { threshold: 0 });
  io.observe(stage);
  signal.addEventListener("abort", () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); }, { once: true });

  sync();
  layout();
  for (const e of elec) kick(e);
  // Med redusert bevegelse står bildet stille, men med spor å se på.
  if (!playing) for (let k = 0; k < 80; k++) step(1 / 60);
  draw();
  onResize(() => { layout(); for (const e of elec) kick(e); draw(); });
  start();
}
