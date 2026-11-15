/**
 * «Injeksjon langs emitteren» for TFE4146, bipolartransistoren.
 *
 * Én idé: basestrømmen går sidelengs gjennom den tynne basen under emitteren og ut til
 * basekontaktene, og spenningsfallet på veien trekkes fra spenningen over emitterovergangen. Midt
 * under emitteren er spenningen lavest, og injeksjonen, som følger e^{qV/k_BT}, samler seg ved
 * kantene. Jo større strømmen er, jo verre. Smale striper med kontakter imellom gir kortere vei og
 * mindre strøm per stripe. Streetman & Banerjee §7.7.5, fig. 7–20.
 *
 * Tegningen er en pnp-transistor i snitt: en p⁺-emitter i overflaten av n-basen, basekontakter på
 * begge sider og p-kollektoren under. Røde ringer er hull som emitteren injiserer; de går rett ned,
 * så hvor tett de kommer langs emitteren, er injeksjonen der. Blå prikker er elektronene som
 * basestrømmen fører inn fra kontaktene; hvert elektron går sidelengs inn under emitteren og
 * stopper der et hull blir injisert, så elektronene viser veien basestrømmen tar. Begge kommer
 * oftere jo større strømmen er.
 *
 * Modellen: for en halv emitter, x fra midten (0) til kanten (1), er injeksjonen j(x) ∝ e^{−φ(x)},
 * der φ er spenningsfallet fra kanten inn til x i enheter av k_BT/q. Basestrømmen er en fast andel
 * av injeksjonen, så den sidelengse strømmen er I(x) = ∫₀ˣ j og dφ/dx = −Λ·I(x)/I(1), med φ(1) = 0.
 * Ligningene løses ved dempet iterasjon. Λ = 20 per mA basestrøm i den brede emitteren: ved
 * 0,02 mA er injeksjonen nesten jevn (midten 82 % av kanten), ved 2 mA injiserer midten 0,6 % av
 * kanten. To striper med halve bredden og halve strømmen hver har Λ/4, så ved 2 mA er midten av
 * en stripe 6 % av kanten. Spaken går i trinn som omtrent dobler strømmen. Tallene er valgt så
 * effekten synes, og hvor ofte ringer og prikker kommer, er ikke i skala.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const N = 120;
const LAM_PER_MA = 20;
const STEPS = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2]; // mA
const HOLE_SPEED = 42; // px per sekund
const E_SPEED = 70; // px per sekund

/** Injeksjonen langs en halv emitter, normert så middelverdien er 1. */
function solve(lam) {
  let j = new Array(N).fill(1);
  for (let it = 0; it < 500; it++) {
    const I = [];
    let acc = 0;
    for (let k = 0; k < N; k++) {
      acc += j[k] / N;
      I.push(acc);
    }
    const phi = new Array(N);
    let p = 0;
    for (let k = N - 1; k >= 0; k--) {
      phi[k] = p;
      p += (lam * I[k]) / acc / N;
    }
    const nj = phi.map((f) => Math.exp(-f));
    const s = nj.reduce((a, b) => a + b) / N;
    for (let k = 0; k < N; k++) j[k] = 0.5 * j[k] + (0.5 * nj[k]) / s;
  }
  return j;
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "wide";
  let step = 1;
  let cdf = null;
  const ib = () => STEPS[step];
  // Hull og elektroner per sekund: flere jo større strømmen er, men ikke i skala.
  const holeRate = () => 8 + 44 * (step / (STEPS.length - 1));
  const eRate = () => 0.45 * holeRate();

  function compute() {
    const prof = solve((mode === "wide" ? LAM_PER_MA : LAM_PER_MA / 4) * ib());
    cdf = [];
    let a = 0;
    for (const v of prof) cdf.push((a += v));
    for (let k = 0; k < N; k++) cdf[k] /= a;
  }
  /** Avstanden fra midten (0) til kanten (1) for et tilfeldig hull. */
  function sample() {
    const r = Math.random();
    let k = 0;
    while (k < N - 1 && cdf[k] < r) k++;
    return (k + Math.random()) / N;
  }

  // ── bærerne ─────────────────────────────────────────────────────────────
  const holes = [];
  const electrons = [];
  let G = null;

  // ── kontroller ──────────────────────────────────────────────────────────
  const restart = () => {
    compute();
    holes.length = 0;
    electrons.length = 0;
    seed();
    render();
  };
  const pick = choiceRow({
    ariaLabel: "Emitteren",
    label: "Emitteren",
    items: [
      { value: "wide", label: "Én bred" },
      { value: "stripes", label: "To smale" },
    ],
    onPick: (k) => {
      mode = k;
      pick.sync(mode);
      restart();
    },
    signal,
  });
  const label = document.createElement("label");
  const lt = document.createElement("span");
  lt.innerHTML = "I<sub>B</sub> ";
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = String(STEPS.length - 1);
  input.step = "1";
  input.value = String(step);
  input.setAttribute("aria-label", "Basestrømmen");
  label.append(lt, out, input);
  const show = () => {
    const t = `${String(ib()).replace(".", ",")} mA`;
    out.textContent = t;
    input.setAttribute("aria-valuetext", t);
  };
  input.addEventListener(
    "input",
    () => {
      step = Number(input.value);
      show();
      restart();
    },
    { signal },
  );
  controls.append(pick.el, label);
  show();
  pick.sync(mode);

  // ── geometri ────────────────────────────────────────────────────────────
  function layout() {
    const { w: full, h } = getSize();
    if (full < 240 || h < 200) return null;
    const w = Math.min(full, 560);
    const ox = (full - w) / 2;
    const x0 = 8;
    const x1 = w - 8;
    const cw = 22; // basekontaktene
    // Stripene har akkurat halve bredden av den brede emitteren, som står midt mellom de ytre
    // kontaktene; stripene har en kontakt på hver side, med gap fra kanten til kontakten.
    const gap = 14;
    const xm = (x0 + x1) / 2;
    const outer = [x0 + 4 + cw / 2, x1 - 4 - cw / 2];
    const ws = (x1 - x0 - 8 - 3 * cw - 4 * gap) / 2;
    let contacts;
    let emitters;
    if (mode === "wide") {
      contacts = outer;
      emitters = [[xm - ws, xm + ws]];
    } else {
      contacts = [outer[0], xm, outer[1]];
      const a = outer[0] + cw / 2 + gap;
      const b = xm + cw / 2 + gap;
      emitters = [
        [a, a + ws],
        [b, b + ws],
      ];
    }
    return { w, full, ox, h, x0, x1, cw, contacts, emitters, sy: 34, ey: 54, iy: 80, cy: 124, by: 178 };
  }

  /** Et hull og et elektron hører til samme halvdel av en emitter: stedet x og kontakten xc. */
  function place() {
    const e = Math.floor(Math.random() * G.emitters.length);
    const side = Math.random() < 0.5 ? -1 : 1;
    const [a, b] = G.emitters[e];
    const xm = (a + b) / 2;
    const x = xm + side * sample() * ((b - a) / 2 - 3);
    const xc = side < 0 ? Math.max(...G.contacts.filter((c) => c < a)) : Math.min(...G.contacts.filter((c) => c > b));
    return { x, xc };
  }
  function spawnHole(age = 0) {
    const { x } = place();
    holes.push({ x: x + (Math.random() - 0.5) * 2, y: G.ey + 4 + age * HOLE_SPEED });
  }
  /** Elektronet går ned fra kontakten til basen og sidelengs inn til der det skal. */
  function spawnElectron(age = 0) {
    const { x, xc } = place();
    const yl = G.iy + (Math.random() - 0.5) * 12;
    const down = yl - (G.sy + 4);
    const len = down + Math.abs(x - xc);
    electrons.push({ x, xc, yl, down, len, s: Math.min(len - 1, age * E_SPEED) });
  }
  function seed() {
    G = layout();
    if (!G) return;
    const span = (G.by - G.ey) / HOLE_SPEED;
    for (let k = 0; k < holeRate() * span; k++) spawnHole(Math.random() * span);
    const eSpan = 2.5;
    for (let k = 0; k < eRate() * eSpan; k++) spawnElectron(Math.random() * eSpan);
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";

  function scene() {
    const { x0, x1, cw, contacts, emitters, sy, ey, iy, cy, by } = G;
    let s = "";
    // Lagene: base over kollektor, emitterne i overflaten.
    s += `<rect x="${P(x0)}" y="${P(sy)}" width="${P(x1 - x0)}" height="${P(by - sy)}" rx="3" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<path d="M ${P(x0)} ${P(cy)} H ${P(x1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<rect x="${P(x0)}" y="${P(cy - 3)}" width="${P(x1 - x0)}" height="6" style="fill:var(--orange)" fill-opacity="0.18"/>`;
    s += tag(x1 - 6, cy - 8, "n", "end", "var(--fg)") + tag(x1 - 6, by - 8, "p", "end", "var(--fg)");
    s += `<path d="M ${P(x0 + 2)} ${P(by)} H ${P(x1 - 2)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += tag((x0 + x1) / 2, by + 15, "C", "middle", "var(--muted)");
    for (const [a, b] of emitters) {
      s += `<rect x="${P(a)}" y="${P(sy)}" width="${P(b - a)}" height="${P(ey - sy)}" style="fill:var(--bg-elevated)" stroke="var(--border-strong)" stroke-width="1"/>`;
      s += `<rect x="${P(a)}" y="${P(ey)}" width="${P(b - a)}" height="4" style="fill:var(--orange)" fill-opacity="0.18"/>`;
      s += `<path d="M ${P(a + 4)} ${P(sy)} H ${P(b - 4)}" style="stroke:var(--fg)" stroke-width="3"/>`;
      s += tag((a + b) / 2, ey - 6, "p⁺", "middle", "var(--fg)");
      s += tag((a + b) / 2, sy - 6, "E", "middle", "var(--muted)");
    }
    for (const xc of contacts) {
      s += `<path d="M ${P(xc - cw / 2)} ${P(sy)} H ${P(xc + cw / 2)}" style="stroke:var(--fg)" stroke-width="3"/>`;
      s += tag(xc, sy - 6, "B", "middle", "var(--muted)");
    }
    // Hullene går rett ned fra emitteren.
    let r = "";
    for (const g of holes) {
      const fade = Math.min(1, (by - 4 - g.y) / 14);
      if (fade > 0) r += `<circle cx="${P(g.x)}" cy="${P(g.y)}" r="2.4" opacity="${fade.toFixed(2)}"/>`;
    }
    s += `<g fill="none" style="stroke:var(--red)" stroke-width="1.2">${r}</g>`;
    // Elektronene går ned fra kontakten og sidelengs inn, og blir borte der de skal.
    let d = "";
    for (const e of electrons) {
      let x;
      let y;
      if (e.s < e.down) {
        x = e.xc;
        y = sy + 4 + e.s;
      } else {
        x = e.xc + Math.sign(e.x - e.xc) * (e.s - e.down);
        y = e.yl;
      }
      const left = e.len - e.s;
      const op = left < 10 ? Math.max(0, left / 10) : 1;
      d += `<circle cx="${P(x)}" cy="${P(y)}" r="2.2" opacity="${op.toFixed(2)}"/>`;
    }
    s += `<g style="fill:var(--indigo)">${d}</g>`;
    // Punktene A og D og motstandene i den brede emitteren.
    if (mode === "wide") {
      const [a, b] = emitters[0];
      const xm = (a + b) / 2;
      s += `<circle cx="${P(xm)}" cy="${P(iy)}" r="2.6" style="fill:var(--fg)"/>` + tag(xm, iy - 9, "A", "middle", "var(--fg)", halo);
      s += `<circle cx="${P(a)}" cy="${P(iy)}" r="2.6" style="fill:var(--fg)"/>` + tag(a, iy - 9, "D", "middle", "var(--fg)", halo);
      s += tag((a + xm) / 2, iy + 22, sub("r", "b") + "′", "middle", "var(--fg)", it + halo);
      s += tag((a + contacts[0]) / 2 + 4, iy + 22, sub("r", "b"), "middle", "var(--fg)", it + halo);
    }
    return s;
  }

  function render() {
    G = layout();
    if (!G || !cdf) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.full.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `<g transform="translate(${G.ox.toFixed(1)} 0)">${scene()}</g></svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  let owedH = 0;
  let owedE = 0;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    for (const g of holes) g.y += dt * HOLE_SPEED;
    for (let k = holes.length - 1; k >= 0; k--) if (holes[k].y > G.by) holes.splice(k, 1);
    for (const e of electrons) e.s += dt * E_SPEED;
    for (let k = electrons.length - 1; k >= 0; k--) if (electrons[k].s >= electrons[k].len) electrons.splice(k, 1);
    owedH += dt * holeRate();
    owedE += dt * eRate();
    while (owedH >= 1) {
      spawnHole();
      owedH -= 1;
    }
    while (owedE >= 1) {
      spawnElectron();
      owedE -= 1;
    }
    render();
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
  reduce.addEventListener("change", start, { signal });
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  onResize(() => {
    holes.length = 0;
    electrons.length = 0;
    seed();
    render();
  });
  compute();
  seed();
  render();
}
