/**
 * «MOS-kondensatoren» for TFE4146, MOS-kondensatoren.
 *
 * Én idé: gatespenningen V_G fordeler seg på oksidet og silisiumet, V_G = V_i + φ_s. Negativ
 * gate trekker hull til overflaten (akkumulasjon). Positiv gate skyver hullene bort, så
 * akseptorionene står igjen i en sone (utarming), og båndene bøyer seg ned. Når E_i ved
 * overflaten ligger like langt under E_F som den ligger over i substratet (φ_s = 2φ_F), er
 * overflaten like sterkt n-type som substratet er p-type (sterk inversjon). Etter det tar
 * elektronene ved overflaten nesten all ny ladning: sonen slutter å vokse, φ_s står nesten
 * stille, og spenningen ut over V_T faller over oksidet. Streetman & Banerjee §6.4.2,
 * fig. 6–12 til 6–15.
 *
 * Øverst står kondensatoren sett fra siden, med dybden y inn i silisiumet mot høyre: gaten
 * (metall), oksidet og p-type silisium. Hullene er røde ringer, akseptorionene oransje «−»
 * (sterke der ingen hull dekker dem), elektronene blå prikker. Ladningen på gaten er like mange
 * tegn som den tegnede ladningen i silisiumet. Under, på samme y-akse, står båndskjemaet.
 *
 * Modellen: den ideelle MOS-kondensatoren i Streetman eksempel 6–1, p-type Si med
 * N_a = 5·10¹⁵ cm⁻³ og 10 nm SiO₂, Φ_m = Φ_s og ingen ladning i oksidet. φ_F = 0,329 V,
 * C_i = 345 nF/cm², L_D = 58 nm, W_m = 0,415 µm og V_T = 0,755 V. Båndbøyningen er den eksakte
 * løsningen av Poissons ligning med hull og elektroner etter Boltzmann (likning 6–21 til 6–24),
 * og φ_s finnes fra V_G = φ_s − Q_s/C_i. Lagene der hullene og elektronene samles ved overflaten,
 * er i virkeligheten noen nanometer tykke og mye tettere enn tegnet; antallet tegnede bærere i
 * dem vokser saktere enn ladningen. Oksidet er tegnet mye tykkere enn 10 nm, og båndkantene i
 * oksidet ligger egentlig rundt 3 eV over og 4 eV under silisiumets.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

// ── fysikken (Streetman eksempel 6–1, ideell) ──────────────────────────────
const KT = 0.0259; // V
const Q = 1.602e-19;
const EPS0 = 8.854e-14;
const ES = 11.8 * EPS0; // F/cm
const NA = 5e15;
const NI = 1.5e10;
const P0 = NA;
const N0 = (NI * NI) / NA;
const PHIF = KT * Math.log(NA / NI); // 0,329 V
const CI = (3.9 * EPS0) / 10e-7; // F/cm², 10 nm SiO₂
const LD = Math.sqrt((ES * KT) / (Q * P0)); // cm, 58 nm
const LD_UM = LD * 1e4;
const EV_BULK = -KT * Math.log(1.04e19 / NA); // E_v − E_F i substratet, eV
const EG = 1.11;

/** Feltfunksjonen F(u) i likning 6–24, u = qφ/k_BT. */
const Fu = (u) => Math.sqrt(Math.max(0, Math.exp(-u) + u - 1 + (N0 / P0) * (Math.exp(u) - u - 1)));
/** Ladningen per areal i silisiumet, C/cm². */
const Qs = (phis) => -Math.sign(phis) * ES * Math.SQRT2 * (KT / LD) * Fu(phis / KT);
const vgOf = (phis) => phis - Qs(phis) / CI;
function phisOf(vg) {
  let lo = -1.2;
  let hi = 1.3;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (vgOf(m) > vg) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
/** Elektroner per cm² ved overflaten, ∫ n₀(eᵘ − 1)/ℰ dφ. */
function nSheet(phis) {
  if (phis <= 0.02) return 0;
  const n = 300;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const ph = ((i + 0.5) / n) * phis;
    s += (N0 * (Math.exp(ph / KT) - 1)) / ((Math.SQRT2 * KT * Fu(ph / KT)) / LD);
  }
  return (s * phis) / n;
}
const VT = -(-2 * Math.sqrt(ES * Q * NA * PHIF)) / CI + 2 * PHIF; // 0,755 V

const VG_MIN = -1;
const VG_MAX = 1.5;
const Y_UM = 0.7; // µm silisium som tegnes
const NBULK = 50; // hull (og ioner) i nøytralt silisium
const UNIT = (NA * Y_UM * 1e-4) / NBULK; // ladninger per cm² per tegn
const CAP = 46; // tegn i laget ved overflaten høyst
const DOX = 0.3; // eV, oksidets ledningsbånd over E_c ved grenseflaten (forkortet fra 3,1)
const TAU = 0.35; // s, innstillingstiden for V_G
const E_TOP = 1.6;
const E_BOT = -1.75;
const NG = 280; // celler langs y
const CLIP = `mosclip${Math.random().toString(36).slice(2, 8)}`;

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let vgT = 0;
  let vgC = 0;

  // ── kontroller ──────────────────────────────────────────────────────────
  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",").replace("-", "−");
  const label = document.createElement("label");
  label.append("Gate ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(VG_MIN);
  input.max = String(VG_MAX);
  input.step = "0.05";
  input.value = "0";
  input.setAttribute("aria-label", "Gatespenningen V_G, målt fra substratet");
  label.append(out, input);
  out.textContent = `${NB(0)} V`;
  input.addEventListener(
    "input",
    () => {
      vgT = Math.round(Number(input.value) * 20) / 20;
      out.textContent = `${NB(vgT)} V`;
      if (reduce.matches) {
        vgC = vgT;
        solve();
        place(0, true);
      }
      start();
      render();
    },
    { signal },
  );
  controls.append(label);

  // ── tilstanden ──────────────────────────────────────────────────────────
  const st = {
    phis: 0,
    vi: 0,
    u: new Float64Array(NG + 1), // qφ/k_BT ved y = i/NG · Y_UM
    dens: new Float64Array(NG + 1), // tegnet hulltetthet, i N_a
    cum: new Float64Array(NG + 1), // ∫ fra y til enden av tettheten, i N_a·Y
    nDraw: 0, // tegnede elektroner ved overflaten
    W: 0, // µm, der hulltettheten har falt til halvparten
  };
  const compress = (x) => CAP * (1 - Math.exp(-x / CAP));

  function solve() {
    const phis = phisOf(vgC);
    st.phis = phis;
    st.vi = vgC - phis;
    // u(y) fra overflaten inn: du/dy = −sign(u)·√2·F(u)/L_D.
    const us = phis / KT;
    const dy = Y_UM / NG;
    const sub = 6;
    const h = dy / sub;
    const slope = (v) => (-Math.sign(v) * Math.SQRT2 * Fu(v)) / LD_UM;
    let v = us;
    st.u[0] = v;
    for (let i = 1; i <= NG; i++) {
      for (let k = 0; k < sub; k++) {
        const k1 = slope(v);
        const k2 = slope(v + 0.5 * h * k1);
        const k3 = slope(v + 0.5 * h * k2);
        const k4 = slope(v + h * k3);
        const nv = v + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        v = Math.sign(nv) !== Math.sign(v) && v !== 0 ? 0 : nv;
      }
      st.u[i] = v;
    }
    // Hullene: tettheten p/p₀ = e^(−u); overskuddet i akkumulasjonslaget komprimeres.
    let excess = 0;
    for (let i = 0; i <= NG; i++) if (st.u[i] < 0) excess += (Math.exp(-st.u[i]) - 1) / NG;
    const trueExtra = excess * NBULK;
    const k = trueExtra > 1e-9 ? compress(trueExtra) / trueExtra : 1;
    for (let i = 0; i <= NG; i++) st.dens[i] = st.u[i] < 0 ? 1 + (Math.exp(-st.u[i]) - 1) * k : Math.exp(-st.u[i]);
    st.cum[NG] = 0;
    for (let i = NG - 1; i >= 0; i--) st.cum[i] = st.cum[i + 1] + (0.5 * (st.dens[i] + st.dens[i + 1])) / NG;
    let i = 0;
    while (i < NG && st.dens[i] < 0.5) i++;
    st.W = st.dens[0] < 0.5 ? (i / NG) * Y_UM : 0;
    st.nDraw = Math.round(compress(nSheet(phis) / UNIT));
  }
  /** y (andel av vinduet) der kumulert tetthet fra høyre er c. */
  function yAt(c) {
    if (c <= 0) return 1;
    if (c >= st.cum[0]) return 0;
    let lo = 0;
    let hi = NG;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (st.cum[m] > c) lo = m;
      else hi = m;
    }
    const f = (st.cum[lo] - c) / (st.cum[lo] - st.cum[hi] || 1);
    return (lo + f) / NG;
  }
  const holesPresent = () => Math.round(st.cum[0] * NBULK);

  // ── bærerne ─────────────────────────────────────────────────────────────
  const rnd = Math.random;
  let holes = [];
  let elec = [];
  const mkHole = (i, y) => ({ i, y, py: y, jy: 0, jz: rnd(), vy: 0, vz: 0, state: "in" });
  function initCarriers() {
    holes = [];
    for (let i = 0; i < NBULK; i++) {
      const y = yAt((i + 0.5) / NBULK);
      holes.push(mkHole(i, y));
    }
    elec = [];
  }
  /** Hull nummer i (fra høyre) står der kumulert tetthet er (i + ½)/NBULK. */
  function place(dt, snap) {
    const n = holesPresent();
    while (holes.length < n) {
      const c = mkHole(holes.length, 1);
      c.state = "enter";
      holes.push(c);
    }
    for (const c of holes) {
      if (c.i < n) {
        const ty = yAt((c.i + 0.5) / NBULK);
        if (c.state === "gone" || c.state === "leave") {
          c.state = "enter";
          c.py = 1;
        }
        if (c.state === "enter" && Math.abs(c.py - ty) < 0.01) c.state = "in";
        const k = snap ? 1 : Math.min(1, dt / (c.state === "enter" ? 0.35 : 0.12));
        c.py += (ty - c.py) * k;
        c.y = ty;
      } else if (c.state !== "gone") {
        c.state = "leave";
        c.py += snap ? 2 : dt / 0.6;
        if (c.py >= 1) c.state = "gone";
      }
      if (!snap) {
        c.vy += ((rnd() - 0.5) * 0.05 - c.vy * 0.9) * dt * 6;
        c.vz += ((rnd() - 0.5) * 1.6 - c.vz * 0.9) * dt * 6;
        c.jy = Math.max(-0.01, Math.min(0.01, c.jy + c.vy * dt));
        c.jz += c.vz * dt;
        if (c.jz < 0.04) (c.jz = 0.08 - c.jz), (c.vz = Math.abs(c.vz));
        if (c.jz > 0.96) (c.jz = 1.92 - c.jz), (c.vz = -Math.abs(c.vz));
      }
    }
    // Elektronene: nye dannes inne i sonen og driver til overflaten, overflødige forsvinner.
    while (elec.filter((e) => e.state !== "leave").length < st.nDraw) {
      const slot = elec.length ? Math.max(...elec.map((e) => e.slot)) + 1 : 0;
      const y0 = snap ? 0 : Math.max(0.02, (st.W / Y_UM) * (0.3 + 0.6 * rnd()));
      elec.push({ slot, py: y0, z: rnd(), state: snap ? "in" : "drift", a: 1 });
    }
    let live = elec.filter((e) => e.state !== "leave");
    if (live.length > st.nDraw) {
      live.sort((a, b) => b.slot - a.slot);
      for (let j = 0; j < live.length - st.nDraw; j++) live[j].state = "leave";
    }
    for (const e of elec) {
      if (e.state === "drift") {
        e.py -= snap ? 1 : dt * 0.9;
        if (e.py <= 0) (e.py = 0), (e.state = "in");
      }
      if (e.state === "leave") e.a -= snap ? 1 : dt / 0.4;
    }
    elec = elec.filter((e) => e.a > 0);
    // Plassene i laget fylles i rekkefølge.
    live = elec.filter((e) => e.state !== "leave").sort((a, b) => a.slot - b.slot);
    live.forEach((e, k) => (e.k = k));
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 220 || h < 360) return null;
    const x0 = 8;
    const mw = Math.round(Math.min(64, Math.max(44, w * 0.15))); // metallet
    const ow = Math.round(Math.min(22, Math.max(14, w * 0.045))); // oksidet
    const xm = x0 + mw;
    const xs = xm + ow;
    const x1 = w - 8;
    const by0 = 26;
    const by1 = 112;
    const ey0 = 150;
    const ey1 = h - 8;
    const pe = (ey1 - ey0) / (E_TOP - E_BOT);
    return { w, h, x0, mw, ow, xm, xs, x1, by0, by1, ey0, ey1, pe };
  }
  const Y = (f) => G.xs + f * (G.x1 - G.xs); // f = y/Y_UM
  const yE = (E) => G.ey0 + (E_TOP - E) * G.pe;

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, t) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${t}</tspan>`;
  const it = ";font-style:italic";
  const brk = (x, y0, y1) =>
    `<path d="M ${P(x - 3.5)} ${P(y0)} h 7 M ${P(x - 3.5)} ${P(y1)} h 7 M ${P(x)} ${P(y0)} V ${P(y1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;

  function regime() {
    const p = st.phis;
    if (p < -0.015) return "akkumulasjon";
    if (p <= 0.015) return "flate bånd";
    if (p < PHIF) return "utarming";
    if (p < 2 * PHIF - 0.004) return "svak inversjon";
    return "sterk inversjon";
  }

  function device() {
    const { x0, mw, xm, xs, x1, by0, by1, w } = G;
    let s = "";
    const W = st.W / Y_UM;
    // Sonen.
    if (W > 0.02) {
      const xw = Y(W);
      s +=
        `<rect x="${P(xs)}" y="${P(by0)}" width="${P(xw - xs)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
        `<path d="M ${P(xw)} ${P(by0)} V ${P(G.ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;
      if (xw - xs > 22) {
        const yb = by1 + 12;
        s +=
          `<path d="M ${P(xs)} ${P(yb - 4)} v 8 M ${P(xs)} ${P(yb)} H ${P(xw)} M ${P(xw)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
          tag((xs + xw) / 2, yb + 13, "W", "middle", "var(--fg)", it + halo);
      }
    }
    // Gaten, oksidet og silisiumet.
    s +=
      `<rect x="${P(x0)}" y="${P(by0)}" width="${P(mw)}" height="${P(by1 - by0)}" rx="3" style="fill:var(--muted)" fill-opacity="0.28"/>` +
      `<rect x="${P(xm)}" y="${P(by0)}" width="${P(xs - xm)}" height="${P(by1 - by0)}" style="fill:var(--border)" fill-opacity="0.55" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(xs)}" y="${P(by0)}" width="${P(x1 - xs)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(x0 + 3, by0 - 8, "gate", "start", "var(--fg)") +
      tag((xm + xs) / 2 + 4, by0 - 8, "oksid", "middle", "var(--fg)") +
      tag(x1 - 2, by0 - 8, `p-Si · ${regime()}`, "end", "var(--fg)");

    // Ionene i et fast gitter: sterke der ingen hull dekker dem.
    const rows = 5;
    const cols = NBULK / rows;
    let faint = "";
    let strong = "";
    let nStrong = 0;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const f = (c + 0.25 + 0.5 * (r % 2)) / cols;
        const i = Math.min(NG, Math.round(f * NG));
        const x = Y(f);
        const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
        const g = `M ${P(x - 2.4)} ${P(y)} h 4.8 `;
        if (st.dens[i] < 0.5) (strong += g), nStrong++;
        else faint += g;
      }
    s +=
      `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.4" opacity="0.35"/>` +
      `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.8"/>`;

    // Hullene.
    let dots = "";
    for (const c of holes) {
      if (c.state === "gone") continue;
      const f = Math.max(0, Math.min(1, c.py + (c.state === "in" ? c.jy : 0)));
      const fade = c.state === "leave" ? Math.max(0, Math.min(1, (1 - c.py) / 0.08)) : 1;
      const z = by0 + 4 + c.jz * (by1 - by0 - 8);
      dots += `<circle cx="${P(Y(f))}" cy="${P(z)}" r="2.3"${fade < 1 ? ` opacity="${fade.toFixed(2)}"` : ""}/>`;
    }
    s += `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${dots}</g>`;

    // Elektronene: i laget ved overflaten, eller på vei dit fra sonen.
    const per = Math.max(4, Math.floor((by1 - by0 - 6) / 5));
    let ed = "";
    for (const e of elec) {
      let x;
      let y;
      if (e.state === "drift") {
        x = Y(e.py);
        y = by0 + 6 + e.z * (by1 - by0 - 12);
      } else {
        const k = e.k ?? 0;
        x = xs + 3.5 + Math.floor(k / per) * 4.6;
        y = by0 + 5 + (k % per) * 5 + (Math.floor(k / per) % 2) * 2.5;
      }
      ed += `<circle cx="${P(x)}" cy="${P(y)}" r="2"${e.a < 1 ? ` opacity="${Math.max(0, e.a).toFixed(2)}"` : ""}/>`;
    }
    s += `<g style="fill:var(--indigo)">${ed}</g>`;

    // Ladningen på gaten: like mange tegn som den tegnede ladningen i silisiumet.
    let m = 0;
    let neg = false;
    if (st.phis > 0.015) m = nStrong + elec.filter((e) => e.state !== "leave").length;
    else if (st.phis < -0.015) {
      neg = true;
      m = Math.max(0, holesPresent() - NBULK);
    }
    if (m > 0) {
      let g = "";
      for (let j = 0; j < m; j++) {
        const col = Math.floor(j / per);
        const x = xm - 4 - col * 5;
        const y = by0 + 5 + (j % per) * 5;
        if (x < x0 + 3) break;
        g += neg ? `<circle cx="${P(x)}" cy="${P(y)}" r="2"/>` : `M ${P(x - 2)} ${P(y)} h 4 M ${P(x)} ${P(y - 2)} v 4 `;
      }
      s += neg ? `<g style="fill:var(--indigo)">${g}</g>` : `<path d="${g}" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    }
    void w;
    return s;
  }

  function bands() {
    const { x0, xm, xs, x1, ey0, ey1 } = G;
    let s = "";
    const efm = -vgC; // metallets Fermi-nivå, eV
    const uAt = (f) => st.u[Math.min(NG, Math.max(0, Math.round(f * NG)))];
    const bend = (f) => -uAt(f) * KT; // eV, båndene ved y minus i substratet
    const ecS = EV_BULK + EG - st.phis;
    const evS = EV_BULK - st.phis;
    // Metallet: fylte tilstander under E_Fm.
    s +=
      `<rect x="${P(x0)}" y="${P(yE(efm))}" width="${P(xm - x0)}" height="${P(Math.max(0, ey1 - yE(efm)))}" style="fill:var(--muted)" fill-opacity="0.28"/>` +
      `<path d="M ${P(x0)} ${P(yE(efm))} H ${P(xm)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
    // Oksidet: båndkantene, forkortet, med helningen qV_i.
    const ecoS = ecS + DOX;
    const ecoM = ecoS - st.vi;
    const evoS = evS - DOX;
    const evoM = evoS - st.vi;
    s +=
      `<clipPath id="${CLIP}"><rect x="0" y="${P(ey0 - 6)}" width="${P(G.w)}" height="${P(ey1 - ey0 + 6)}"/></clipPath>` +
      `<path clip-path="url(#${CLIP})" d="M ${P(xm)} ${P(yE(ecoM))} L ${P(xs)} ${P(yE(ecoS))} M ${P(xm)} ${P(yE(evoM))} L ${P(xs)} ${P(yE(evoS))}" fill="none" style="stroke:var(--fg)" stroke-width="1.4"/>` +
      `<path d="M ${P(xm)} ${P(ey0 - 6)} V ${P(ey1)} M ${P(xs)} ${P(ey0 - 6)} V ${P(ey1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    // Silisiumet.
    const M = 140;
    let pc = "";
    let pv = "";
    let pi = "";
    for (let k = 0; k <= M; k++) {
      const f = k / M;
      const b = bend(f);
      const x = Y(f);
      pc += `${k ? "L" : "M"} ${P(x)} ${P(yE(EV_BULK + EG + b))} `;
      pv += `${k ? "L" : "M"} ${P(x)} ${P(yE(EV_BULK + b))} `;
      pi += `${k ? "L" : "M"} ${P(x)} ${P(yE(PHIF + b))} `;
    }
    s +=
      `<path d="${pc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${pv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${pi}" fill="none" style="stroke:var(--muted)" stroke-width="1.2" stroke-dasharray="7 3 1.5 3"/>` +
      `<path d="M ${P(xs)} ${P(yE(0))} H ${P(x1)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
    // Merkene til høyre.
    s +=
      tag(x1 - 2, yE(EV_BULK + EG) - 6, sub("E", "c"), "end", "var(--fg)", halo) +
      tag(x1 - 2, yE(PHIF) - 6, sub("E", "i"), "end", "var(--muted)", halo) +
      tag(x1 - 2, yE(0) - 5, sub("E", "F"), "end", "var(--accent)", halo) +
      tag(x1 - 2, yE(EV_BULK) + 14, sub("E", "v"), "end", "var(--fg)", halo);
    const fmY = yE(efm);
    s += tag(x0 + 3, fmY + (fmY > ey1 - 24 ? -6 : 14), sub("E", "Fm"), "start", "var(--accent)", halo);

    // qφ_F i substratet.
    const xF = x1 - 34;
    s += brk(xF, yE(PHIF), yE(0)) + tag(xF - 6, (yE(PHIF) + yE(0)) / 2 + 4, `q${sub("φ", "F")}`, "end", "var(--fg)", halo);
    // qφ_s ved overflaten: E_i i substratet forlenget, mot E_i ved overflaten.
    const eiS = PHIF - st.phis;
    if (Math.abs(st.phis) > 0.04) {
      const xP = xs + 14;
      s +=
        `<path d="M ${P(xs + 2)} ${P(yE(PHIF))} H ${P(Y(0.55))}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brk(xP, yE(PHIF), yE(eiS));
      const mid = (yE(PHIF) + yE(eiS)) / 2;
      s += Math.abs(yE(PHIF) - yE(eiS)) > 15
        ? tag(xP + 7, mid + 4, `q${sub("φ", "s")}`, "start", "var(--fg)", halo)
        : tag(xP + 7, Math.min(yE(PHIF), yE(eiS)) - 4, `q${sub("φ", "s")}`, "start", "var(--fg)", halo);
    }
    // qV_i over oksidet, på den kanten som holder seg inne i tegningen.
    if (Math.abs(st.vi) > 0.06) {
      const xV = xm + 3;
      const yA = st.vi > 0 ? yE(ecoS) : yE(evoS);
      const yB = st.vi > 0 ? yE(ecoM) : yE(evoM);
      s +=
        `<path d="M ${P(xm)} ${P(yA)} H ${P(xs)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brk(xV, yA, yB) +
        tag(xV - 6, (yA + yB) / 2 + 4, `q${sub("V", "i")}`, "end", "var(--fg)", halo);
    }
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${device()}${bands()}</svg>`;
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
    const k = 1 - Math.exp(-dt / TAU);
    vgC += (vgT - vgC) * k;
    if (Math.abs(vgT - vgC) < 1e-3) vgC = vgT;
    solve();
    place(dt, false);
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || reduce.matches || signal.aborted) return;
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
      vgC = vgT;
      solve();
      place(0, true);
      render();
      start();
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
  void VT;
  solve();
  initCarriers();
  place(0, true);
  onResize(render);
  render();
}
