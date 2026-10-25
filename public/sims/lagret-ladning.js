/**
 * «Lagret ladning når dioden slås om» for TFE4146, transienter og kapasitans.
 *
 * Én idé: hullene som er lagret på n-siden av en p⁺n-diode, kan bare forsvinne
 * ved å rekombinere (levetiden τ_p) eller ved å gå tilbake over overgangen, og
 * spenningen over overgangen følger overskuddet ved kanten av sonen. Brytes
 * strømmen, står spenningen igjen mens ladningen dør ut. Snus kilden, kan
 * spenningen ikke hoppe, så hele kildespenningen ligger over motstanden, og en
 * sperrestrøm −E/R går til kanten er tom etter lagringstiden t_sd. Streetman &
 * Banerjee §5.5.1–5.5.2, fig. 5–27 og 5–28.
 *
 * Modellen er diffusjonsligningen med rekombinasjon for overskuddet av hull,
 * u_t = u_xx − u, med x i L_p og t i τ_p, og u = δp/Δp_f, der Δp_f er overskuddet
 * ved kanten i lederetningen. Kretsen setter strømmen inn ved kanten:
 * lederetning i = I_f, brutt i = 0, sperreretning i = −I_r så lenge kanten har
 * hull å gi (E er mye større enn spenningen over overgangen). Så lenge kanten
 * har et overskudd, er spenningen v = (k_BT/q)ln(1 + Δp_n/p_n). Når kanten er
 * tom, holdes den på null, hullene som diffunderer fram, feies over, og
 * spenningen er ladningen i sonen: C_j(v) dv/dt = i − i_hull med i = (e − v)/R og
 * C_j = 41,9 pF·√(4,754 V/(V_0 − v)). Med I_r = I_f gir løsningen
 * t_sd = 0,2275 τ_p, som den eksakte τ_p[erf⁻¹(I_f/(I_f + I_r))]² (bench/fd.mjs).
 * Tallene er dioden i teksten: I_f = 0,5 mA ved v = 0,515 V, τ_p = 1 µs, E = 5 V,
 * R = 10 kΩ, så RC_j er rundt 0,4 µs. Ladningen i sonen er bare med når kanten er
 * tom og spenningen negativ, som i læreboka: mellom 0 og 0,5 V er den rundt 70 pC,
 * mot 500 pC lagret ladning, og med den hele veien ville platået i sperreretning
 * vart 0,45 µs i stedet for 0,23 µs (bench/fdcj.mjs).
 *
 * Ringene er hull som vandrer tilfeldig, rekombinerer med raten 1/τ_p og går
 * inn og ut ved kanten med strømmen fra modellen, så tettheten følger kurven.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const XL = 5; // lengden av n-siden, i L_p; kontakten holder overskuddet null
const M = 160; // celler
const DX = XL / M;
const DT_FD = 3e-4; // τ_p
const VT = 0.0259; // V
const V_F = 0.515; // spenningen over overgangen i lederetningen, V
const IG = Math.exp(V_F / VT) - 1; // Δp_f/p_n
const E_SRC = 5; // V, kildespenningen i lederetningen
const Q_F = 0.5e-9; // C, I_fτ_p
const V0J = 0.754; // V, kontaktpotensialet
const CJ4 = 41.9e-12; // F, C_j ved −4 V
// Hvor mye spenningen endrer seg per τ_p for en strøm I_f inn i sonen, V.
const kC = (vv) => Q_F / (CJ4 * Math.sqrt((V0J + 4) / (V0J - Math.min(vv, 0.5))));
const TAU_S = 5; // sekunder på skjermen per τ_p
const N_F = 140; // ringer i lederetningen
const PRE = 0.3; // τ_p før omslaget på skopet
const POST = 2.2; // τ_p etter omslaget
const FADE = 0.45; // s
const CROSS = 0.35; // s for en tur over sonen

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "f"; // f = +E, o = brutt, r = −E
  let r = 1; // I_r/I_f
  let paused = false;

  // ── modellen ────────────────────────────────────────────────────────────
  const u = new Float64Array(M);
  const F = new Float64Array(M + 1);
  let F0 = 1; // hullstrømmen inn ved kanten, i I_f
  let iExt = 1; // strømmen i kretsen, i I_f
  let empty = false; // kanten er tom, og ladningen i sonen bærer spenningen
  let tau = 0; // tid i τ_p
  let tTrig = 0;
  let tsd = null;
  let trig = "f";
  let pre = []; // [t, i, v] før omslaget
  let sweep = []; // [t − tTrig, i, v]
  let v = V_F;

  function steadyForward() {
    for (let k = 0; k < M; k++) {
      const x = (k + 0.5) * DX;
      u[k] = Math.sinh(XL - x) / Math.cosh(XL);
    }
  }
  const source = () => (mode === "f" ? E_SRC : mode === "r" ? -r * E_SRC : null);
  function fdStep(h) {
    if (!empty) {
      // Kanten har hull: kretsen setter strømmen, så lenge kanten klarer å gi den.
      iExt = mode === "f" ? 1 : mode === "o" ? 0 : -r;
      F0 = iExt;
      if (F0 < (-2 * u[0]) / DX) {
        empty = true;
        v = 0;
      }
    }
    if (empty) {
      // Kanten er tom: hullene som når den, feies over, og resten av strømmen lader sonen.
      F0 = (-2 * u[0]) / DX;
      const e = source();
      iExt = e === null ? 0 : (e - v) / E_SRC;
      v += h * kC(v) * (iExt - F0);
      if (v >= 0) {
        empty = false;
        v = 0;
      }
    }
    F[0] = F0;
    for (let k = 1; k < M; k++) F[k] = -(u[k] - u[k - 1]) / DX;
    F[M] = u[M - 1] / (DX / 2);
    for (let k = 0; k < M; k++) u[k] += h * ((F[k] - F[k + 1]) / DX - u[k]);
  }
  function voltage() {
    if (empty) return v;
    const ue = Math.max(0, u[0] + (DX / 2) * F0);
    return VT * Math.log(1 + ue * IG);
  }
  const charge = () => {
    let s = 0;
    for (let k = 0; k < M; k++) s += u[k];
    return s * DX;
  };
  const edgeValue = () => Math.max(0, u[0] + (DX / 2) * F0);

  // ── hullene ─────────────────────────────────────────────────────────────
  // x i L_p fra kanten; cross = tur over sonen (+1 inn fra p, −1 ut til p).
  let holes = [];
  let flashes = [];
  let born = 0;
  let quota = 0;
  let clock = 0;
  const rnd = Math.random;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  function sampleSteady() {
    // Fordelt som sinh(XL − x): trekk fra e^{−x} og forkast nær kontakten.
    for (;;) {
      const x = -Math.log(rnd() || 1e-12);
      if (x < XL && rnd() < (Math.sinh(XL - x) / Math.cosh(XL)) / Math.exp(-x)) return x;
    }
  }
  const mkHole = (x, cross = 0) => ({ x, px: x, y: 0.12 + 0.76 * rnd(), cross, ct: 0, age: cross ? 0 : 1 });

  function particles(h) {
    // h i τ_p. Diffusjon med D = 1 L_p²/τ_p og rekombinasjon med raten 1.
    const sd = Math.sqrt(2 * h);
    const keep = [];
    for (const c of holes) {
      if (c.cross) {
        c.ct += (h * TAU_S) / CROSS;
        if (c.cross > 0 && c.ct >= 1) {
          c.cross = 0;
          c.x = 0.02;
          c.px = c.x;
        }
        if (c.cross < 0 && c.ct >= 1) continue; // har gått over til p-siden
        keep.push(c);
        continue;
      }
      if (rnd() < h) {
        flashes.push({ x: c.px, y: c.y, t: clock });
        continue;
      }
      let x = c.x + sd * gauss();
      if (x < 0) x = -x;
      if (x >= XL) continue; // gikk ut gjennom kontakten
      c.x = x;
      c.age += h * TAU_S;
      keep.push(c);
    }
    holes = keep;
    if (F0 > 0) {
      born += N_F * F0 * h;
      while (born >= 1) {
        holes.push(mkHole(0, 1));
        born -= 1;
      }
    } else born = 0;
    if (F0 < 0) {
      quota = Math.min(2, quota + N_F * -F0 * h);
      while (quota >= 1) {
        let best = null;
        for (const c of holes) if (!c.cross && c.x < 0.3 && (!best || c.x < best.x)) best = c;
        if (!best) break;
        best.cross = -1;
        best.ct = 0;
        quota -= 1;
      }
    } else quota = 0;
  }

  function advance(dtReal) {
    clock += dtReal;
    let left = dtReal / TAU_S;
    while (left > 1e-12) {
      const h = Math.min(DT_FD, left);
      fdStep(h);
      left -= h;
      tau += h;
    }
    let pl = dtReal / TAU_S;
    while (pl > 1e-12) {
      const h = Math.min(1 / 60 / TAU_S, pl);
      particles(h);
      pl -= h;
    }
    v = voltage();
    if (trig === "r" && tsd === null && empty) tsd = tau - tTrig;
    const ts = tau - tTrig;
    if (ts <= POST + 0.02) sweep.push([ts, iExt, v]);
    pre.push([tau, iExt, v]);
    while (pre.length && pre[0][0] < tau - PRE - 0.05) pre.shift();
    const kp = Math.min(1, dtReal / 0.07);
    for (const c of holes) c.px += (c.x - c.px) * kp;
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }

  function trigger() {
    tTrig = tau;
    trig = mode;
    tsd = null;
    sweep = pre.map(([t, i, vv]) => [t - tTrig, i, vv]).filter((p) => p[0] >= -PRE);
    if (mode === "r" && empty) tsd = 0;
  }

  function reset() {
    steadyForward();
    mode = "f";
    F0 = 1;
    iExt = 1;
    empty = false;
    tau = 0;
    v = V_F;
    holes = [];
    for (let k = 0; k < N_F; k++) holes.push(mkHole(sampleSteady()));
    flashes = [];
    pre = [];
    for (let t = -PRE; t <= 0; t += 0.01) pre.push([t, 1, V_F]);
    tTrig = 0;
    trig = "f";
    sweep = pre.map((p) => p.slice());
    for (let t = 0.01; t <= POST; t += 0.01) sweep.push([t, 1, V_F]);
    tsd = null;
  }

  // ── kontroller ──────────────────────────────────────────────────────────
  const src = choiceRow({
    ariaLabel: "Kilden",
    label: "Kilde",
    items: [
      { value: "f", label: "+E" },
      { value: "o", label: "Brutt" },
      { value: "r", label: "−E" },
    ],
    onPick: (k) => {
      if (k === mode) return;
      mode = k;
      src.sync(mode);
      trigger();
      if (reduce.matches || paused) jump();
      else start();
    },
    signal,
  });
  const label = document.createElement("label");
  label.append("Sperrestrøm ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0.5";
  input.max = "2";
  input.step = "0.25";
  input.value = "1";
  input.setAttribute("aria-label", "Sperrestrømmen I_r som brøk av I_f");
  label.append(out, input);
  const showR = () => {
    out.innerHTML = r === 1 ? "I<sub>r</sub> = I<sub>f</sub>" : `I<sub>r</sub> = ${String(r).replace(".", ",")} I<sub>f</sub>`;
  };
  input.addEventListener(
    "input",
    () => {
      r = Number(input.value);
      showR();
      render();
    },
    { signal },
  );
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
  controls.append(src.el, label, pauseBtn);
  src.sync(mode);
  showR();

  /** Uten bevegelse: kjør hele sveipet med en gang og tegn sluttbildet. */
  function jump() {
    const target = tTrig + POST;
    while (tau < target - 1e-9) advance(Math.min(1 / 30, (target - tau) * TAU_S));
    flashes = [];
    for (const c of holes) c.px = c.x;
    render();
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 400) return null;
    const bx0 = 12;
    const bx1 = w - 10;
    const pw = Math.max(34, (bx1 - bx0) * 0.12); // p⁺-siden
    const zw = 8; // sonen, ikke i skala
    const xe = bx0 + pw + zw; // kanten av sonen på n-siden
    const wireY = 14;
    const by0 = 34;
    const by1 = 80;
    const py0 = 108;
    const py1 = 182;
    const sx0 = 44;
    const sx1 = w - 10;
    const iy0 = 210;
    const iy1 = 304;
    const vy0 = 322;
    const vy1 = 402;
    const ty = 416;
    return { w, h, bx0, bx1, pw, zw, xe, wireY, by0, by1, py0, py1, sx0, sx1, iy0, iy1, vy0, vy1, ty };
  }
  const X = (x) => G.xe + (x / XL) * (G.bx1 - G.xe);
  const T = (t) => G.sx0 + ((t + PRE) / (PRE + POST)) * (G.sx1 - G.sx0);
  const I_TOP = 3.1;
  const I_BOT = -2.15;
  const yI = (i) => G.iy0 + ((I_TOP - i) / (I_TOP - I_BOT)) * (G.iy1 - G.iy0);
  // Spenningen: 0 til 0,6 V strukket ut øverst, 0 til −10,5 V under.
  const V_TOP = 0.62;
  const V_BOT = -10.6;
  const vSplit = () => G.vy0 + 0.42 * (G.vy1 - G.vy0);
  const yV = (vv) =>
    vv >= 0
      ? vSplit() - (vv / V_TOP) * (vSplit() - G.vy0)
      : vSplit() + (vv / V_BOT) * (G.vy1 - vSplit());

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function circuit() {
    const { bx0, bx1, by0, by1, wireY } = G;
    const ym = (by0 + by1) / 2;
    const len = bx1 - bx0;
    const xb = bx0 + len * 0.3; // kilden
    const xr0 = bx0 + len * 0.56;
    const xr1 = xr0 + 34; // motstanden
    let s = "";
    const gap = mode === "o" ? 12 : 6;
    s += `<path d="M ${P(bx0)} ${P(ym)} H ${P(bx0 - 6)} V ${P(wireY)} H ${P(xb - gap)} M ${P(xb + gap)} ${P(wireY)} H ${P(xr0)} M ${P(xr1)} ${P(wireY)} H ${P(bx1 + 6)} V ${P(ym)} H ${P(bx1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    // Motstanden som sagtann.
    let z = `M ${P(xr0)} ${P(wireY)}`;
    for (let k = 1; k <= 6; k++) z += ` L ${P(xr0 + (k - 0.5) * ((xr1 - xr0) / 6))} ${P(wireY + (k % 2 ? -5 : 5))}`;
    z += ` L ${P(xr1)} ${P(wireY)}`;
    s += `<path d="${z}" fill="none" style="stroke:var(--fg)" stroke-width="1.2" stroke-linejoin="round"/>`;
    s += tag((xr0 + xr1) / 2, wireY + 19, "R", "middle", "var(--fg)", ";font-style:italic");
    if (mode === "o") {
      // En åpen bryter.
      s += `<circle cx="${P(xb - gap)}" cy="${P(wireY)}" r="2" style="fill:var(--fg)"/><circle cx="${P(xb + gap)}" cy="${P(wireY)}" r="2" style="fill:var(--fg)"/>`;
      s += `<path d="M ${P(xb - gap)} ${P(wireY)} L ${P(xb + gap - 2)} ${P(wireY - 9)}" style="stroke:var(--fg)" stroke-width="1.4" stroke-linecap="round"/>`;
    } else {
      // Batteriet: den lange platen er pluss. Pluss mot venstre driver strømmen inn i p⁺-siden.
      const plusLeft = mode === "f";
      const long = (x) => `M ${P(x)} ${P(wireY - 9)} V ${P(wireY + 9)}`;
      const short = (x) => `M ${P(x)} ${P(wireY - 5)} V ${P(wireY + 5)}`;
      const xl = xb - gap;
      const xrr = xb + gap;
      s += `<path d="${plusLeft ? long(xl) : long(xrr)}" style="stroke:var(--fg)" stroke-width="1.6"/>`;
      s += `<path d="${plusLeft ? short(xrr) : short(xl)}" style="stroke:var(--fg)" stroke-width="3"/>`;
      s += tag(xl - 4, wireY - 3, plusLeft ? "+" : "−", "end", "var(--fg)") + tag(xrr + 4, wireY - 3, plusLeft ? "−" : "+", "start", "var(--fg)");
    }
    // Strømpilen på ledningen over: positiv strøm går fra høyre mot venstre der.
    const ia = Math.abs(iExt);
    if (ia > 0.02) {
      const xm = (xr1 + bx1) / 2;
      const lenA = 6 + 16 * Math.min(1, ia / 2);
      const dir = iExt > 0 ? -1 : 1;
      const x0 = xm - (dir * lenA) / 2;
      const x1 = xm + (dir * lenA) / 2;
      s += `<path d="M ${P(x0)} ${P(wireY)} L ${P(x1)} ${P(wireY)} M ${P(x1 - dir * 6)} ${P(wireY - 4)} L ${P(x1)} ${P(wireY)} L ${P(x1 - dir * 6)} ${P(wireY + 4)}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += tag(xm, wireY - 7, "i", "middle", "var(--accent)", ";font-style:italic" + halo);
    }
    return s;
  }

  function bar() {
    const { bx0, bx1, by0, by1, pw, zw, xe } = G;
    let s = "";
    const xz0 = bx0 + pw;
    s +=
      `<rect x="${P(xz0)}" y="${P(by0)}" width="${P(zw)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.14"/>` +
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(xz0)} ${P(by0)} V ${P(by1)} M ${P(xe)} ${P(by0)} V ${P(by1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>` +
      `<path d="M ${P(bx0)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(bx1)} ${P(by0 + 2)} V ${P(by1 - 2)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += tag(bx0 + pw / 2, by1 - 6, "p⁺", "middle", "var(--fg)") + tag(bx1 - 6, by1 - 6, "n", "end", "var(--fg)");
    // Spenningen over dioden.
    s +=
      tag(bx0 + 2, by1 + 13, "+", "start", "var(--fg)") +
      tag(bx1 - 2, by1 + 13, "−", "end", "var(--fg)") +
      tag((bx0 + bx1) / 2, by1 + 13, "v", "middle", "var(--fg)", ";font-style:italic");
    // Hullene.
    const yOf = (c) => by0 + 3 + c.y * (by1 - by0 - 6);
    let rings = "";
    for (const c of holes) {
      let x;
      let op = c.age < 0.25 ? c.age / 0.25 : 1;
      if (c.cross > 0) {
        x = xz0 - 10 + c.ct * (xe - xz0 + 10);
        op = Math.min(1, c.ct * 3);
      } else if (c.cross < 0) {
        x = xe - c.ct * (xe - xz0 + 14);
        op = 1 - c.ct;
      } else x = X(c.px);
      rings += `<circle cx="${P(x)}" cy="${P(yOf(c))}" r="2.4"${op < 1 ? ` opacity="${Math.max(0, op).toFixed(2)}"` : ""}/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const k = (clock - f.t) / FADE;
      fl += `<circle cx="${P(X(f.x))}" cy="${P(yOf(f))}" r="${P(2.4 + 3 * k)}" fill="none" style="stroke:var(--red)" stroke-width="1" opacity="${(0.7 * (1 - k)).toFixed(2)}"/>`;
    }
    s += `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>${fl}`;
    return s;
  }

  function profile() {
    const { py0, py1, xe, bx1 } = G;
    const yU = (uu) => py1 - Math.max(-0.02, uu) * (py1 - py0 - 8);
    let s = "";
    // Aksen.
    s += `<path d="M ${P(xe)} ${P(py0 - 2)} V ${P(py1)} H ${P(bx1)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += tag(xe - 4, py0 + 6, "δp", "end", "var(--fg)", ";font-style:italic");
    s += tag(bx1, py1 + 13, sub("x", "n"), "end", "var(--fg)", ";font-style:italic");
    for (let k = 1; k < XL; k++) {
      const x = X(k);
      s += `<path d="M ${P(x)} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    }
    s += tag(X(1), py1 + 13, sub("L", "p"), "middle", "var(--muted)", ";font-style:italic");
    // Lederetningen som stiplet spøkelse.
    let g = "";
    for (let k = 0; k <= 80; k++) {
      const x = (k / 80) * XL;
      g += `${k ? "L" : "M"} ${P(X(x))} ${P(yU(Math.sinh(XL - x) / Math.cosh(XL)))} `;
    }
    s += `<path d="${g}" fill="none" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    // Profilen nå, med arealet tonet.
    const ue = edgeValue();
    let c = `M ${P(X(0))} ${P(yU(ue))}`;
    for (let k = 0; k < M; k++) c += ` L ${P(X((k + 0.5) * DX))} ${P(yU(u[k]))}`;
    c += ` L ${P(X(XL))} ${P(yU(0))}`;
    s += `<path d="${c} L ${P(X(0))} ${P(py1)} Z" style="fill:var(--red)" fill-opacity="0.12"/>`;
    s += `<path d="${c}" fill="none" style="stroke:var(--red)" stroke-width="1.8"/>`;
    const kq = Math.round(1.1 / DX);
    if (u[kq] > 0.2) s += tag(X(1.1), yU(u[kq] * 0.35) + 4, sub("Q", "p"), "middle", "var(--red)", ";font-style:italic" + halo);
    // Overskuddet ved kanten.
    s += `<circle cx="${P(X(0))}" cy="${P(yU(ue))}" r="3" style="fill:var(--red)"/>`;
    s += tag(X(0) + 7, Math.max(py0 + 4, yU(ue) - 4), sub("Δp", "n"), "start", "var(--red)", ";font-style:italic" + halo);
    return s;
  }

  function scope() {
    const { sx0, sx1, iy0, iy1, vy0, vy1, ty } = G;
    let s = "";
    const box = (y0, y1) => `<rect x="${P(sx0)}" y="${P(y0)}" width="${P(sx1 - sx0)}" height="${P(y1 - y0)}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
    s += box(iy0, iy1) + box(vy0, vy1);
    // Nullinjene.
    s += `<path d="M ${P(sx0)} ${P(yI(0))} H ${P(sx1)} M ${P(sx0)} ${P(yV(0))} H ${P(sx1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    // Skalabrudd ved null på spenningsaksen.
    const yz = yV(0);
    s += `<path d="M ${P(sx0 - 4)} ${P(yz + 3)} l 4 -3 l 4 3 M ${P(sx0 - 4)} ${P(yz + 7)} l 4 -3 l 4 3" fill="none" style="stroke:var(--muted)" stroke-width="1"/>`;
    // Merkene til venstre.
    const lab = (y, t, col = "var(--muted)") => tag(sx0 - 5, y + 4, t, "end", col);
    // Merkene for −I_r og −I_rR flyttes ned når de ligger tett inntil null.
    const di = yI(-r) - yI(0) < 13 ? 6 : 0;
    s += lab(yI(1), sub("I", "f")) + lab(yI(0) - di / 2, "0") + lab(yI(-r) + di, "−" + sub("I", "r"));
    s += `<path d="M ${P(sx0)} ${P(yI(1))} H ${P(sx1)} M ${P(sx0)} ${P(yI(-r))} H ${P(sx1)}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="2 3"/>`;
    const dv = yV(-r * E_SRC) - yV(0) < 16 ? 16 - (yV(-r * E_SRC) - yV(0)) : 0;
    s += lab(yV(0.5), "0,5 V") + lab(yV(0), "0") + lab(yV(-r * E_SRC) + dv, "−" + sub("I", "r") + "R");
    s += `<path d="M ${P(sx0)} ${P(yV(0.5))} H ${P(sx1)} M ${P(sx0)} ${P(yV(-r * E_SRC))} H ${P(sx1)}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="2 3"/>`;
    s += tag(sx1 - 3, iy0 + 12, "i", "end", "var(--accent)", ";font-style:italic") + tag(sx1 - 3, vy0 + 12, "v", "end", "var(--fg)", ";font-style:italic");
    // Omslaget.
    s += `<path d="M ${P(T(0))} ${P(iy0)} V ${P(vy1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    // Tidsaksen i µs, der τ_p = 1 µs.
    for (let k = 0; k <= 2; k++) {
      const x = T(k);
      s += `<path d="M ${P(x)} ${P(vy1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
      s += tag(x, ty + 4, k === 0 ? "0" : `${k} µs`, "middle", "var(--muted)");
    }
    // Kurvene.
    const pts = sweep.filter((p) => p[0] <= POST);
    if (pts.length > 1) {
      let pi = "";
      let pv = "";
      pts.forEach(([t, i, vv], k) => {
        pi += `${k ? "L" : "M"} ${P(T(t))} ${P(yI(Math.max(I_BOT, Math.min(I_TOP, i))))} `;
        pv += `${k ? "L" : "M"} ${P(T(t))} ${P(yV(Math.max(V_BOT, Math.min(V_TOP, vv))))} `;
      });
      s += `<path d="${pi}" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linejoin="round"/>`;
      s += `<path d="${pv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    // Lagringstiden.
    if (trig === "r" && tsd !== null && tsd > 0.02) {
      const x0 = T(0);
      const x1 = T(tsd);
      s += `<path d="M ${P(x1)} ${P(iy0)} V ${P(vy1)}" style="stroke:var(--red)" stroke-width="1" stroke-dasharray="3 3"/>`;
      const yb = G.iy1 + 5;
      s += `<path d="M ${P(x0)} ${P(yb - 3)} V ${P(yb)} H ${P(x1)} V ${P(yb - 3)}" fill="none" style="stroke:var(--red)" stroke-width="1.2"/>`;
      s += tag(x1 + 4, yb + 4, sub("t", "sd"), "start", "var(--red)", ";font-style:italic" + halo);
    }
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${circuit()}${bar()}${profile()}${scope()}</svg>`;
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
  reduce.addEventListener("change", () => (reduce.matches ? render() : start()), { signal });
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
  render();
}
