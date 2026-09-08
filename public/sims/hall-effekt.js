/**
 * Hall-effekten i en halvlederstav, for TFE4146 modul 03.
 * Én idé: Hall-spenningen bytter fortegn med bærertypen og med magnetfeltet,
 * mens et resistivt spenningsfall fra forskjøvne kontakter står fast.
 *
 * Øverst står staven sett ovenfra med bærerne som prikker i drift: hull med
 * strømmen, elektroner mot. Magnetfeltet er tegnet som boka gjør det, prikker
 * for ut av planet og kryss for inn i planet. Én kantladning q (fra −1 til +1,
 * ladningen på nederste kant i enheter av likevektsverdien) bærer hele
 * bildet: den slakker mot likevekt med tidskonstant TAU, prikkene bøyes med
 * farten VY·(b − c·q) på tvers, kantene lyser opp med |q|, og Hall-delen av
 * V_AB er q·V_H. Bytt felt eller bærertype, og overgangen spiller seg av.
 * Prikker som når kanten går inn i kantladningen og dukker opp igjen inne i
 * staven, så tettheten står fast.
 *
 * Nederst står voltmeteret som en skala med null i midten. Viseren glir til
 * V_AB; en blek viser står der avlesningen havner med feltet snudd, og
 * prikken midt mellom dem er spenningsfallet over forskyvningen. Halve
 * avstanden er Hall-spenningen: det er regnestykket fra øvingssettet, tegnet.
 *
 * Tallene er en tenkt prøve, ikke et regnestykke fra boka: 500 µm bred, 20 µm
 * tykk, 2·10¹⁷ bærere per cm³, 3 mA og 1 T. Det gir V_H = I B/(q N t) = 4,7 mV
 * og et lengdefelt E_x = I ρ/(w t) med ρ = 1/(q N μ), μ = 480 (hull) eller
 * 1350 (elektroner) cm²/V·s. Forskyvningen er overdrevet i tegningen.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const Q = 1.602e-19;
const I = 3e-3; // A
const B = 1; // T
const W = 500e-6; // m
const T = 20e-6; // m
const N = 2e23; // m⁻³
const MU = { p: 0.048, n: 0.135 }; // m²/V·s
const VH = (I * B) / (Q * N * T); // V
const EX = (c) => I / (Q * N * MU[c]) / (W * T); // V/m

const D_MAX = 20; // µm
const RANGE = 10e-3; // V, halve skalabredden
const TAU = 1.0; // s, kantladningens oppbyggingstid
const NEEDLE_TAU = 0.2; // s, viserens treghet
const VX = 70; // px/s, driftfart i tegningen
const VY = 55; // px/s, avbøyning før Hall-feltet er bygd opp
const R = 3.2; // px, bærerprikkens radius
const GRID = 36; // px, mellom feltsymbolene

export default function init({ stage, controls, getSize, onResize, signal }) {
  let carrier = "p";
  let bz = 1; // +1 ut av planet, 0 ingen, −1 inn i planet
  let d = 0; // µm, forskyvning av kontakt B langs strømmen
  // Redusert bevegelse: start i pause og la brukeren spille av selv.
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const csign = () => (carrier === "p" ? 1 : -1);
  const qInf = () => csign() * bz; // kantladningen i likevekt
  const vOff = () => EX(carrier) * d * 1e-6; // V, fallet over forskyvningen
  const vTarget = () => qInf() * VH + vOff();
  const vFlipped = () => -qInf() * VH + vOff();

  let q = qInf(); // ladningen på nederste kant, −1…+1
  let vShown = vTarget(); // V, der viseren står
  let gShown = vFlipped(); // V, der den bleke viseren står

  // ── kontroller ────────────────────────────────────────────────────────────
  const carrierRow = choiceRow({
    ariaLabel: "Bærertype",
    label: "Bærere",
    items: [
      { value: "p", label: "hull (p-type)" },
      { value: "n", label: "elektroner (n-type)" },
    ],
    onPick: (v) => {
      carrier = v;
      changed();
    },
    signal,
  });

  const fieldRow = choiceRow({
    ariaLabel: "Magnetfeltets retning",
    label: "Magnetfelt",
    items: [
      { value: "1", label: "ut av planet" },
      { value: "0", label: "ingen" },
      { value: "-1", label: "inn i planet" },
    ],
    onPick: (v) => {
      bz = Number(v);
      changed();
    },
    signal,
  });

  const dLabel = document.createElement("label");
  dLabel.append("Kontakt B forskjøvet ");
  const dOut = document.createElement("output");
  const dInput = document.createElement("input");
  dInput.type = "range";
  dInput.min = String(-D_MAX);
  dInput.max = String(D_MAX);
  dInput.step = "5";
  dInput.value = String(d);
  dInput.setAttribute("aria-label", "Forskyvning av kontakt B langs strømmen i mikrometer");
  dLabel.append(dOut, dInput);
  dInput.addEventListener(
    "input",
    () => {
      d = Number(dInput.value);
      changed();
    },
    { signal },
  );

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

  controls.append(carrierRow.el, fieldRow.el, dLabel, playBtn);

  function sync() {
    carrierRow.sync(carrier);
    fieldRow.sync(String(bz));
    dOut.textContent = d === 0 ? "ingen" : `${d > 0 ? "+" : "−"}${Math.abs(d)} µm`;
  }

  /** Etter et valg: tegn rammen på nytt og la overgangen spille, eller hopp rett til likevekt. */
  function changed() {
    sync();
    buildStatic();
    if (!playing) snap();
    drawDyn();
    start();
  }

  function snap() {
    q = qInf();
    vShown = vTarget();
    gShown = vFlipped();
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const NB = (n, k = 1) => n.toFixed(k).replace(".", ",");
  const signed = (mv) => `${mv >= 0 ? "+" : "−"}${NB(Math.abs(mv))} mV`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const g = {}; // layoutet, fylles av layout()
  let particles = [];

  const spawnY = () => R + 6 + Math.random() * (g.barH - 2 * R - 12);
  const xB = () => g.xA + (d / D_MAX) * 0.16 * g.L;

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 36;
    g.bx1 = w - 36;
    g.L = g.bx1 - g.bx0;
    g.by0 = 26;
    g.barH = clamp(h - 146, 88, 124);
    g.by1 = g.by0 + g.barH;
    g.mid = g.by0 + g.barH / 2;
    g.xA = g.bx0 + 0.55 * g.L;
    g.my = h - 36;
    g.zero = (g.bx0 + g.bx1) / 2;
    g.scale = (g.bx1 - g.zero) / RANGE;

    // Like mange prikker per flate, så telefonen ikke ser tom ut og bredskjermen ikke full.
    const n = clamp(Math.round((g.L * g.barH) / 1500), 24, 60);
    if (particles.length !== n) {
      particles = Array.from({ length: n }, () => ({ x: Math.random() * g.L, y: spawnY() }));
    } else {
      for (const p of particles) {
        p.x = clamp(p.x, 0, g.L);
        p.y = clamp(p.y, R, g.barH - R);
      }
    }
  }

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

  let dynBar = null;
  let dynMeter = null;

  /** Rammen: staven, feltsymbolene, strømmen, kontaktene og skalaen. */
  function buildStatic() {
    const { w, h, bx0, bx1, L, by0, by1, barH, mid, xA, my, zero, scale } = g;
    const xb = xB();

    let svg = `<defs><clipPath id="hall-bar-clip"><rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}"/></clipPath></defs>`;
    svg += `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;

    // Magnetfeltet som prikker (ut av planet) eller kryss (inn i planet).
    if (bz !== 0) {
      let f = "";
      const cols = Math.floor(L / GRID);
      const rows = Math.floor(barH / GRID);
      const ox = (L - (cols - 1) * GRID) / 2;
      const oy = (barH - (rows - 1) * GRID) / 2;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = bx0 + ox + i * GRID;
          const y = by0 + oy + j * GRID;
          f += `<circle cx="${P(x)}" cy="${P(y)}" r="4"/>`;
          f +=
            bz > 0
              ? `<circle cx="${P(x)}" cy="${P(y)}" r="1.2" style="fill:var(--border-strong)"/>`
              : `<path d="M ${P(x - 2.6)} ${P(y - 2.6)} L ${P(x + 2.6)} ${P(y + 2.6)} M ${P(x - 2.6)} ${P(y + 2.6)} L ${P(x + 2.6)} ${P(y - 2.6)}"/>`;
        }
      }
      svg += `<g fill="none" stroke="var(--border-strong)" stroke-width="1" opacity="0.8">${f}</g>`;
    }

    svg += `<g id="hall-dyn-bar" clip-path="url(#hall-bar-clip)"></g>`;

    // Strømmen inn fra venstre og ut til høyre.
    svg +=
      arrow(6, mid, bx0 - 3, mid, "var(--fg)", 2) +
      tag((6 + bx0) / 2, mid - 7, "I", "middle", "var(--fg)") +
      arrow(bx1 + 3, mid, w - 6, mid, "var(--fg)", 2);

    // Kontaktene: A nederst, B øverst og forskjøvet langs strømmen.
    svg +=
      `<rect x="${P(xA - 3.5)}" y="${P(by1 - 3.5)}" width="7" height="7" style="fill:var(--fg)"/>` +
      tag(xA, by1 + 16, "A", "middle", "var(--fg)") +
      `<rect x="${P(xb - 3.5)}" y="${P(by0 - 3.5)}" width="7" height="7" style="fill:var(--fg)"/>` +
      tag(xb, by0 - 9, "B", "middle", "var(--fg)");

    // Aksekors nede til venstre, siden teksten snakker om y-komponenten.
    const ax = 9;
    const ay = by1 + 2;
    svg +=
      arrow(ax, ay, ax + 16, ay, "var(--muted)", 1) +
      arrow(ax, ay, ax, ay - 16, "var(--muted)", 1) +
      tag(ax + 19, ay + 4, "x") +
      tag(ax + 4, ay - 17, "y");

    // Skalaen med null i midten.
    let ticks = "";
    let labels = "";
    for (let mv = -10; mv <= 10; mv++) {
      const x = zero + mv * 1e-3 * scale;
      const major = mv % 5 === 0;
      ticks += `M ${P(x)} ${P(my)} V ${P(my + (major ? 7 : 3))} `;
      if (major) {
        // Enheten står bare på bred skjerm; på telefon ville den kollidert med +5.
        const text = mv === 10 && L >= 400 ? "+10 mV" : mv > 0 ? `+${mv}` : mv < 0 ? `−${-mv}` : "0";
        const anchor = mv === -10 ? "start" : mv === 10 ? "end" : "middle";
        labels += tag(x, my + 19, text, anchor);
      }
    }
    svg +=
      `<path d="M ${P(bx0)} ${P(my)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>` +
      labels +
      tag(bx0 - 7, my + 4, sub("V", "AB"), "end", "var(--fg)");

    svg += `<g id="hall-dyn-meter"></g>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
    dynBar = stage.querySelector("#hall-dyn-bar");
    dynMeter = stage.querySelector("#hall-dyn-meter");
  }

  /** Det som beveger seg: bærerne, kantladningen og viserne. */
  function drawDyn() {
    if (!dynBar) return;
    const { bx0, by0, by1, L, xA, my, zero, scale } = g;
    const red = "var(--red)";
    const blue = "var(--indigo)";
    const xb = xB();

    // Kantladningen: fortegnet på nederste kant følger q, øverste kant er motsatt.
    let bar = "";
    const a = Math.abs(q);
    if (a > 0.03) {
      const edges = [
        { sign: Math.sign(q), yStrip: by1 - 6, yText: by1 - 5, skipX: xA },
        { sign: -Math.sign(q), yStrip: by0, yText: by0 + 14, skipX: xb },
      ];
      for (const e of edges) {
        const color = e.sign > 0 ? red : blue;
        bar += `<rect x="${P(bx0)}" y="${P(e.yStrip)}" width="${P(L)}" height="6" style="fill:${color}" fill-opacity="${P(0.16 * a)}"/>`;
        for (let i = 0; i < 7; i++) {
          const x = bx0 + 14 + ((L - 28) * i) / 6;
          if (Math.abs(x - e.skipX) < 14) continue;
          bar += tag(x, e.yText, e.sign > 0 ? "+" : "−", "middle", color, `;font-size:var(--text-sm);font-weight:600;fill-opacity:${P(a)}`);
        }
      }
    }

    // Bærerne.
    const color = carrier === "p" ? red : blue;
    let dots = "";
    for (const p of particles) dots += `<circle cx="${P(bx0 + p.x)}" cy="${P(by0 + p.y)}" r="${R}"/>`;
    bar += `<g style="fill:${color}" fill-opacity="0.9">${dots}</g>`;
    dynBar.innerHTML = bar;

    // Viserne.
    const xN = zero + vShown * scale;
    let meter = "";
    if (bz !== 0) {
      const xG = zero + gShown * scale;
      const xM = (xN + xG) / 2;
      const yb = my - 16;
      meter +=
        `<path d="M ${P(xG)} ${P(my - 24)} V ${P(my + 7)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>` +
        `<path d="M ${P(xN)} ${P(yb)} H ${P(xG)} M ${P(xM)} ${P(yb)} V ${P(my)}" stroke="var(--muted)" stroke-width="1" opacity="0.6"/>` +
        `<circle cx="${P(xM)}" cy="${P(my)}" r="3.2" style="fill:var(--fg)"/>`;
    }
    const lx = clamp(xN, bx0 + 24, g.bx1 - 24);
    meter +=
      `<path d="M ${P(xN)} ${P(my - 32)} V ${P(my + 7)}" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>` +
      tag(lx, my - 38, signed(vShown * 1e3), "middle", "var(--fg)");
    dynMeter.innerHTML = meter;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  function step(dt) {
    const c = csign();
    q += (qInf() - q) * (1 - Math.exp(-dt / TAU));
    // Magnetkraften bøyer mot nederste kant når feltet peker ut; kantladningen dytter tilbake.
    const vy = VY * (bz - c * q);
    const vx = VX * c;
    const { L, barH } = g;
    for (const p of particles) {
      p.x += vx * dt;
      p.y += vy * dt;
      if (p.x > L) p.x -= L;
      else if (p.x < 0) p.x += L;
      if (p.y < R || p.y > barH - R) {
        // Går inn i kantladningen; en ny prikk tar plassen inne i staven.
        p.x = Math.random() * L;
        p.y = spawnY();
      }
    }
    const k = 1 - Math.exp(-dt / NEEDLE_TAU);
    vShown += (q * VH + vOff() - vShown) * k;
    gShown += (vFlipped() - gShown) * k;
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
    drawDyn();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // Ingen grunn til å tegne 60 bilder i sekundet mens figuren er utenfor skjermen.
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
  buildStatic();
  drawDyn();
  onResize(() => {
    layout();
    buildStatic();
    drawDyn();
  });
  start();
}
