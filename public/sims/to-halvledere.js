/**
 * «AlGaAs mot GaAs» for TFE4146, heterooverganger.
 *
 * Én idé: når to halvledere med ulikt båndgap møtes, gjør båndkantene et sprang ved
 * grenseflaten, ΔE_c og ΔE_v. Sprangene er satt av materialene, fordi vakuumnivået er
 * sammenhengende, og de er de samme uansett doping. Dopingen avgjør bare hvordan båndene
 * bøyer seg på hver side. Mot n-type GaAs går elektronene fra N⁺-AlGaAs over i en smal
 * brønn i GaAs, mens donorene de kom fra, står igjen i AlGaAs. Streetman & Banerjee §5.8,
 * fig. 5–45, eksempel 5–7 og fig. 5–46.
 *
 * Modellen: N⁺-Al₀,₃Ga₀,₇As med 2·10¹⁸ donorer per cm³ (E_g = 1,85 eV, qχ = 3,79 eV,
 * E_F 0,03 eV under E_c) mot GaAs (E_g = 1,43 eV, qχ = 4,07 eV) med 10¹⁵ donorer
 * (E_c − E_F = 0,16 eV) eller 10¹⁸ akseptorer (E_F − E_v = 0,05 eV). Så ΔE_c = 0,28 eV og
 * ΔE_v = 0,14 eV. Båndbøyningen på hver side er den eksakte løsningen av Poissons ligning i
 * én dimensjon med majoritetsbærerne etter Boltzmann, og kontaktpotensialet deles slik at
 * εℰ er lik på begge sider av grenseflaten (ε = 12,2 ε₀ og 13,2 ε₀). Tegningen viser 45 nm
 * av AlGaAs og 115 nm av GaAs. Avstanden opp til vakuumnivået er forkortet med 3,4 eV.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const KT = 0.0259;
const E0 = 8.85e-14;
const Q = 1.602e-19;
const C = 3.4; // eV, forkortelsen av avstanden til vakuumnivået
const XL = 45; // nm AlGaAs i bildet
const XR = 115; // nm GaAs i bildet
const A = { chi: 3.79, eg: 1.85, N: 2e18, eps: 12.2 * E0, delta: 0.03 };
const GAAS = {
  n: { chi: 4.07, eg: 1.43, N: 1e15, eps: 13.2 * E0, delta: KT * Math.log(4.7e17 / 1e15), maj: "e", n0: 4, label: "n-GaAs" },
  p: { chi: 4.07, eg: 1.43, N: 1e18, eps: 13.2 * E0, delta: 1.43 - KT * Math.log(7e18 / 1e18), maj: "h", n0: 48, label: "p⁺-GaAs" },
};
const N1 = 36; // tegnede elektroner i AlGaAs
const NG = 240; // celler på hver side
const WINDOW = { n: [-5.86, -2.88], p: [-5.86, -1.7] };
const JOIN_T = 0.45;
const FLOW_T = 2.6;
const FADE = 0.4;

const g = (u) => Math.exp(u) - 1 - u;
const ld = (m) => Math.sqrt((m.eps * KT) / (Q * m.N)) * 1e7; // Debye-lengden, nm

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let kind = "n";
  let phase = "apart";
  let joinU = 0;
  let s = 0;
  let clock = 0;
  let c1 = []; // elektroner i AlGaAs: { i, px, jy, vy, state }
  let c2 = []; // bærere som hører til GaAs (elektroner eller hull)
  let well = []; // elektroner som har gått fra AlGaAs til brønnen i GaAs
  let flashes = [];

  const B = () => GAAS[kind];
  const V0 = () => B().chi - A.chi + B().delta - A.delta;

  // ── kontroller ──────────────────────────────────────────────────────────
  const join = document.createElement("button");
  join.type = "button";
  join.className = "sim-btn";
  join.addEventListener("click", () => (phase === "apart" ? startJoin() : reset()), { signal });
  const pick = choiceRow({
    ariaLabel: "GaAs",
    label: "GaAs",
    items: [
      { value: "n", label: "n-type" },
      { value: "p", label: "p⁺-type" },
    ],
    onPick: (k) => {
      kind = k;
      reset();
    },
    signal,
  });
  controls.append(join, pick.el);
  function sync() {
    join.textContent = phase === "apart" ? "Sett sammen" : "Skill dem";
    pick.sync(kind);
  }

  // ── fysikken ────────────────────────────────────────────────────────────
  /** Deler V₀ i V₀₁ (AlGaAs) og V₀₂ (GaAs) slik at ε₁N₁g(u₁) = ε₂N₂g(u₂). */
  let split = { v1: 0, v2: 0 };
  function solveSplit() {
    const b = B();
    const v0 = V0();
    let lo = 0;
    let hi = v0;
    for (let i = 0; i < 80; i++) {
      const v1 = (lo + hi) / 2;
      const v2 = v0 - v1;
      const L = A.eps * A.N * g(-v1 / KT);
      const R = b.eps * b.N * g(((b.maj === "e" ? 1 : -1) * v2) / KT);
      if (L > R) hi = v1;
      else lo = v1;
    }
    split = { v1: (lo + hi) / 2, v2: v0 - (lo + hi) / 2 };
  }
  const u1 = new Float64Array(NG + 1); // ved avstand i/NG·XL fra grenseflaten, inn i AlGaAs
  const u2 = new Float64Array(NG + 1); // ved avstand i/NG·XR, inn i GaAs
  function pb(arr, us, L, len) {
    const dx = len / NG;
    const sub = 10;
    const h = dx / sub;
    const slope = (v) => (-Math.sign(v) * Math.sqrt(Math.max(0, 2 * g(v)))) / L;
    let v = us;
    arr[0] = v;
    for (let i = 1; i <= NG; i++) {
      for (let k = 0; k < sub; k++) {
        const k1 = slope(v);
        const k2 = slope(v + 0.5 * h * k1);
        const k3 = slope(v + 0.5 * h * k2);
        const k4 = slope(v + h * k3);
        const nv = v + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        v = v !== 0 && Math.sign(nv) !== Math.sign(v) ? 0 : nv;
      }
      arr[i] = v;
    }
  }
  function profiles() {
    pb(u1, (-s * split.v1) / KT, ld(A), XL);
    pb(u2, ((B().maj === "e" ? 1 : -1) * s * split.v2) / KT, ld(B()), XR);
  }
  // Energier i eV, vakuumnivået før kontakt i 0. AlGaAs ligger fast; GaAs stiger med s·V₀.
  const ec1B = () => -A.chi;
  const ec2B = () => -B().chi + s * V0();
  const bend1 = (d) => -u1[Math.min(NG, Math.max(0, Math.round((d / XL) * NG)))] * KT; // E_c − E_c,bulk
  const bend2 = (d) => (B().maj === "e" ? -1 : 1) * u2[Math.min(NG, Math.max(0, Math.round((d / XR) * NG)))] * KT;
  const ec1 = (d) => ec1B() + bend1(d);
  const ec2 = (d) => ec2B() + bend2(d);

  // Tettheten av majoritetsbærere i forhold til dopingen, kumulert fra den ytre enden.
  const cum1 = new Float64Array(NG + 1);
  const cum2 = new Float64Array(NG + 1);
  function cumulate() {
    // AlGaAs: elektroner, tetthet e^{u1}; kumulert fra d = XL (ytterst) mot grenseflaten.
    cum1[NG] = 0;
    for (let i = NG - 1; i >= 0; i--) cum1[i] = cum1[i + 1] + (0.5 * (Math.exp(u1[i]) + Math.exp(u1[i + 1]))) / NG;
    // GaAs: majoritetsbærerne, høyst like tett som dopingen (overskuddet i brønnen telles for seg).
    cum2[NG] = 0;
    for (let i = NG - 1; i >= 0; i--) cum2[i] = cum2[i + 1] + (0.5 * (Math.min(1, Math.exp(u2[i])) + Math.min(1, Math.exp(u2[i + 1])))) / NG;
  }
  const dAt = (cum, c) => {
    if (c <= 0) return 1;
    if (c >= cum[0]) return 0;
    let lo = 0;
    let hi = NG;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] > c) lo = m;
      else hi = m;
    }
    return (lo + (cum[lo] - c) / (cum[lo] - cum[hi] || 1)) / NG;
  };
  /** Plassene i brønnen: kvantilene av overskuddet e^{u2} − 1 nær grenseflaten. */
  function wellSpots(n) {
    const ex = new Float64Array(NG + 1);
    let tot = 0;
    for (let i = 0; i <= NG; i++) {
      ex[i] = Math.max(0, Math.exp(Math.min(40, u2[i])) - 1);
      tot += ex[i];
    }
    const spots = [];
    if (tot <= 0) return spots;
    for (let k = 0; k < n; k++) {
      const target = ((k + 0.5) / n) * tot;
      let acc = 0;
      let i = 0;
      while (i < NG && acc + ex[i] < target) acc += ex[i++];
      spots.push((i + 0.5) / NG);
    }
    return spots;
  }

  // ── bærerne ─────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const mk = (i, d) => ({ i, d, pd: d, jy: rnd(), vy: 0, state: "in", t: 0 });
  function reset() {
    phase = "apart";
    joinU = 0;
    s = 0;
    solveSplit();
    profiles();
    cumulate();
    c1 = [];
    c2 = [];
    well = [];
    flashes = [];
    for (let i = 0; i < N1; i++) c1.push(mk(i, dAt(cum1, (i + 0.5) / N1)));
    for (let i = 0; i < B().n0; i++) c2.push(mk(i, dAt(cum2, (i + 0.5) / B().n0)));
    sync();
    render();
    if (!reduce.matches) start();
  }
  function startJoin() {
    phase = "joining";
    joinU = 0;
    sync();
    if (reduce.matches) {
      phase = "joined";
      s = 1;
      settle();
      render();
    } else start();
  }

  function place(dt, snap) {
    cumulate();
    const n1 = Math.round(cum1[0] * N1);
    const n2 = Math.round(cum2[0] * B().n0);
    for (const c of c1) {
      if (c.i < n1) {
        const t = dAt(cum1, (c.i + 0.5) / N1);
        c.pd += (t - c.pd) * (snap ? 1 : Math.min(1, dt / 0.12));
        c.d = t;
        c.state = "in";
      } else if (c.state === "in") {
        c.state = "leave";
      }
      if (c.state === "leave") {
        c.pd -= snap ? 10 : dt / 0.45; // mot grenseflaten (d = 0)
        if (c.pd <= 0) {
          c.pd = 0;
          c.state = "gone";
          if (B().maj === "e") well.push({ ...mk(well.length, 0), state: "enter" });
          else flashes.push({ side: 2, d: 0.02 + 0.1 * rnd(), jy: c.jy, t: clock, e: true });
        }
      }
    }
    for (const c of c2) {
      if (c.i < n2) {
        const t = dAt(cum2, (c.i + 0.5) / B().n0);
        c.pd += (t - c.pd) * (snap ? 1 : Math.min(1, dt / 0.12));
        c.d = t;
        c.state = "in";
      } else if (c.state === "in") c.state = "leave";
      if (c.state === "leave") {
        c.pd -= snap ? 10 : dt / 0.45;
        if (c.pd <= 0.01) {
          c.pd = 0;
          c.state = "gone";
          flashes.push({ side: 2, d: 0.01, jy: c.jy, t: clock, e: false });
        }
      }
    }
    // Elektronene i brønnen fordeler seg etter overskuddet nær grenseflaten.
    const spots = wellSpots(well.length);
    well.forEach((c, k) => {
      const t = spots[k] ?? 0;
      c.pd += (t - c.pd) * (snap ? 1 : Math.min(1, dt / 0.3));
      if (c.state === "enter" && Math.abs(c.pd - t) < 0.01) c.state = "in";
    });
    if (!snap)
      for (const c of [...c1, ...c2, ...well]) {
        c.vy += ((rnd() - 0.5) * 1.6 - c.vy * 0.9) * dt * 6;
        c.jy += c.vy * dt;
        if (c.jy < 0.05) (c.jy = 0.1 - c.jy), (c.vy = Math.abs(c.vy));
        if (c.jy > 0.95) (c.jy = 1.9 - c.jy), (c.vy = -Math.abs(c.vy));
      }
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }
  function settle() {
    profiles();
    // Til likevekt uten bevegelse: flytt alle bærerne rett på plass.
    for (let k = 0; k < 3; k++) place(0, true);
    flashes = [];
  }
  function advance(dt) {
    clock += dt;
    if (phase === "joining") {
      joinU = Math.min(1, joinU + dt / JOIN_T);
      if (joinU >= 1) {
        phase = "joined";
        s = 0;
        sync();
      }
    } else if (phase === "joined" && s < 1) s = Math.min(1, s + dt / FLOW_T);
    profiles();
    place(dt, false);
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 300) return null;
    const bx0 = 10;
    const bx1 = w - 10;
    const by0 = 30;
    const by1 = 94;
    const ey0 = 118;
    const ey1 = h - 8;
    const [elo, ehi] = WINDOW[kind];
    const pe = (ey1 - ey0) / (ehi - elo);
    const xi = bx0 + ((bx1 - bx0) * XL) / (XL + XR); // grenseflaten
    return { w, h, bx0, bx1, by0, by1, ey0, ey1, elo, ehi, pe, xi };
  }
  const gapPx = () => (phase === "apart" ? 16 : phase === "joining" ? 16 * (1 - joinU) : 0);
  // d1 i [0, 1] fra grenseflaten inn i AlGaAs, d2 i [0, 1] inn i GaAs.
  const X1 = (d) => G.xi - gapPx() / 2 - d * (G.xi - gapPx() / 2 - G.bx0);
  const X2 = (d) => G.xi + gapPx() / 2 + d * (G.bx1 - G.xi - gapPx() / 2);
  const yE = (E) => G.ey0 + (G.ehi - E) * G.pe;

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, t) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${t}</tspan>`;
  function bracket(x, y0, y1, brk) {
    const top = Math.min(y0, y1);
    const bot = Math.max(y0, y1);
    let d = `M ${P(x - 4)} ${P(top)} h 8 M ${P(x - 4)} ${P(bot)} h 8 `;
    if (brk && bot - top > 18) {
      const m = (top + bot) / 2;
      d += `M ${P(x)} ${P(top)} V ${P(m - 5)} M ${P(x)} ${P(m + 5)} V ${P(bot)} M ${P(x - 5)} ${P(m - 2)} l 10 -4 M ${P(x - 5)} ${P(m + 4)} l 10 -4`;
    } else d += `M ${P(x)} ${P(top)} V ${P(bot)}`;
    return `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;
  }

  function draw() {
    const { bx0, bx1, by0, by1, ey0, ey1 } = G;
    const b = B();
    let out = "";
    const xa = X1(0); // AlGaAs-flaten
    const xb = X2(0); // GaAs-flaten

    // Bitene.
    out +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(xa - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(xb)}" y="${P(by0)}" width="${P(bx1 - xb)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx0 + 2, by0 - 8, "N⁺-AlGaAs", "start", "var(--fg)") +
      tag(bx1 - 2, by0 - 8, b.label, "end", "var(--fg)");

    // Ionene: donorer i AlGaAs, donorer eller akseptorer i GaAs; sterke der ingen bærer dekker dem.
    const ionRow = (n, side, sign) => {
      const rows = 4;
      const cols = Math.max(1, Math.round(n / rows));
      let faint = "";
      let strong = "";
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          const d = (c + 0.25 + 0.5 * (r % 2)) / cols;
          const i = Math.min(NG, Math.round(d * NG));
          const cov = side === 1 ? Math.exp(u1[i]) : Math.min(1, Math.exp(u2[i]));
          const x = side === 1 ? X1(d) : X2(d);
          const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
          const gl = `M ${P(x - 2.2)} ${P(y)} h 4.4${sign > 0 ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""} `;
          if (phase === "joined" && cov < 0.5) strong += gl;
          else faint += gl;
        }
      return `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.35"/><path d="${strong}" style="stroke:var(--orange)" stroke-width="1.7"/>`;
    };
    out += ionRow(N1, 1, 1) + ionRow(b.maj === "e" ? 8 : b.n0, 2, b.maj === "e" ? 1 : -1);

    // Bærerne.
    const yb = (c) => by0 + 4 + c.jy * (by1 - by0 - 8);
    let dots = "";
    let rings = "";
    for (const c of c1) {
      if (c.state === "gone") continue;
      dots += `<circle cx="${P(X1(Math.max(0, c.pd)))}" cy="${P(yb(c))}" r="2.1"/>`;
    }
    for (const c of well) dots += `<circle cx="${P(X2(Math.max(0, c.pd)))}" cy="${P(yb(c))}" r="2.1"/>`;
    for (const c of c2) {
      if (c.state === "gone") continue;
      const x = X2(Math.max(0, c.pd));
      if (b.maj === "e") dots += `<circle cx="${P(x)}" cy="${P(yb(c))}" r="2.1"/>`;
      else rings += `<circle cx="${P(x)}" cy="${P(yb(c))}" r="2.3"/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const u = (clock - f.t) / FADE;
      const x = X2(f.d);
      const y = by0 + 4 + f.jy * (by1 - by0 - 8);
      fl += f.e
        ? `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.1 + 2 * u)}" style="fill:var(--indigo)" opacity="${(0.6 * (1 - u)).toFixed(2)}"/>`
        : `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.3 + 2 * u)}" fill="none" style="stroke:var(--red)" opacity="${(0.7 * (1 - u)).toFixed(2)}"/>`;
    }
    out += `<g style="fill:var(--indigo)">${dots}</g><g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>${fl}`;

    // ── båndskjemaet ──
    const M = 120;
    const curve = (fn, X, len, shift) => {
      let d = "";
      for (let k = 0; k <= M; k++) {
        const dd = k / M;
        d += `${k ? "L" : "M"} ${P(X(dd))} ${P(yE(fn(dd * len) + shift))} `;
      }
      return d;
    };
    const vac1 = curve(ec1, X1, XL, A.chi - C);
    const vac2 = curve(ec2, X2, XR, b.chi - C);
    const c1d = curve(ec1, X1, XL, 0);
    const c2d = curve(ec2, X2, XR, 0);
    const v1d = curve(ec1, X1, XL, -A.eg);
    const v2d = curve(ec2, X2, XR, -b.eg);
    out +=
      `<path d="${vac1}${vac2}" fill="none" style="stroke:var(--muted)" stroke-width="1.2"/>` +
      `<path d="${c1d}${c2d}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${v1d}${v2d}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    if (phase === "joined") {
      // Sprangene ved grenseflaten.
      out += `<path d="M ${P(xa)} ${P(yE(ec1(0)))} V ${P(yE(ec2(0)))} M ${P(xa)} ${P(yE(ec1(0) - A.eg))} V ${P(yE(ec2(0) - b.eg))} M ${P(xa)} ${P(yE(ec1(0) + A.chi - C))} V ${P(yE(ec2(0) + b.chi - C))}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    }
    // Fermi-nivåene.
    const ef1 = ec1B() - A.delta;
    const ef2 = ec2B() - b.delta;
    out +=
      `<path d="M ${P(bx0)} ${P(yE(ef1))} H ${P(xa)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      `<path d="M ${P(xb)} ${P(yE(ef2))} H ${P(bx1)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
    // Elektronene i brønnen, ved bunnen av ledningsbåndet.
    if (b.maj === "e" && well.length) {
      let wd = "";
      for (const c of well) {
        const d = Math.max(0, c.pd);
        const e = ec2(d * XR);
        const top = Math.max(e + 0.004, ef2);
        const y = yE(e) - (yE(e) - yE(top)) * (0.25 + 0.6 * c.jy);
        wd += `<circle cx="${P(X2(d))}" cy="${P(y)}" r="2.1"/>`;
      }
      out += `<g style="fill:var(--indigo)">${wd}</g>`;
    }

    // Merkene.
    out +=
      tag(bx1 - 2, yE(ec2(XR)) - 6, sub("E", "c"), "end", "var(--fg)", halo) +
      tag(bx1 - 2, yE(ec2(XR) - b.eg) + (b.maj === "e" ? -6 : 14), sub("E", "v"), "end", "var(--fg)", halo) +
      tag(bx1 - 2, yE(ef2) + (b.maj === "e" ? 14 : -10), sub("E", "F"), "end", "var(--accent)", halo) +
      tag(bx0 + 2, yE(ec1(XL)) - 6, sub("E", "c"), "start", "var(--fg)", halo) +
      tag(bx0 + 2, yE(ec1(XL) - A.eg) - 6, sub("E", "v"), "start", "var(--fg)", halo) +
      tag(bx0 + 2, yE(-C) - 5, sub("E", "vac"), "start", "var(--muted)", halo);
    // qχ på hver side.
    const xc1 = bx0 + (xa - bx0) * 0.62;
    const xc2 = xb + (bx1 - xb) * 0.55;
    out +=
      bracket(xc1, yE(ec1(XL * 0.62)), yE(ec1(XL * 0.62) + A.chi - C), true) +
      tag(xc1 - 7, (yE(ec1(XL * 0.62)) + yE(ec1(XL * 0.62) + A.chi - C)) / 2 + 4, `q${sub("χ", "1")}`, "end", "var(--fg)", halo) +
      bracket(xc2, yE(ec2(XR * 0.55)), yE(ec2(XR * 0.55) + b.chi - C), true) +
      tag(xc2 + 7, (yE(ec2(XR * 0.55)) + yE(ec2(XR * 0.55) + b.chi - C)) / 2 + 4, `q${sub("χ", "2")}`, "start", "var(--fg)", halo);
    // ΔE_c og ΔE_v ved grenseflaten (før kontakt: mellom bitene).
    const xd = phase === "joined" ? xa + 9 : (xa + xb) / 2;
    const c1y = yE(ec1(0));
    const c2y = yE(ec2(0));
    const v1y = yE(ec1(0) - A.eg);
    const v2y = yE(ec2(0) - b.eg);
    if (phase !== "joined") {
      out += `<path d="M ${P(xa)} ${P(c1y)} H ${P(xb)} M ${P(xb)} ${P(v2y)} H ${P(xa)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>`;
    }
    if (phase !== "joining" && (phase === "apart" || s > 0.98)) {
      out +=
        bracket(xd, c1y, c2y, false) +
        tag(xd + 7, Math.max(c1y, c2y) + 13, `Δ${sub("E", "c")}`, "start", "var(--fg)", halo) +
        bracket(xd, v1y, v2y, false) +
        tag(xd + 7, Math.max(v1y, v2y) + 13, `Δ${sub("E", "v")}`, "start", "var(--fg)", halo);
    }
    return out;
  }

  function render() {
    G = layout();
    if (!G) return;
    if (phase === "apart" || reduce.matches) profiles();
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${draw()}</svg>`;
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
    advance(dt);
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
  reduce.addEventListener(
    "change",
    () => {
      if (reduce.matches) {
        if (phase !== "apart") {
          phase = "joined";
          s = 1;
        }
        settle();
        render();
      } else start();
    },
    { signal },
  );
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
