/**
 * «Metall mot halvleder» for TFE4146, metall–halvleder-overganger.
 *
 * Én idé: arbeidsfunksjonene sier hvilken vei elektronene går når et metall og en
 * halvleder settes sammen. Gir halvlederen fra seg majoritetsbærere nær grenseflaten,
 * står ionene igjen i en sone, og båndene bøyer seg til en barriere (Schottky-kontakt).
 * Får den majoritetsbærere, samles de ved grenseflaten, og ingen barriere holder dem
 * tilbake (ohmsk kontakt). Streetman & Banerjee §5.7.1 og §5.7.3, fig. 5–40, 5–41 og 5–43.
 *
 * Modellen: silisium med 10¹⁵ donorer eller akseptorer per cm³ (E_c − E_F = 0,27 eV på
 * n-type, 0,87 eV på p-type, qχ = 4,05 eV, E_g = 1,11 eV), metallet med arbeidsfunksjonen
 * fra glidebryteren. Før kontakt ligger vakuumnivåene i samme høyde. I kontakt er
 * vakuumnivået sammenhengende ved grenseflaten, så E_c der ligger fast qχ under metallets
 * vakuumnivå, mens halvlederen langt inne synker eller stiger til Fermi-nivåene ligger på
 * linje. Båndbøyningen er den eksakte løsningen av Poissons ligning i én dimensjon med
 * majoritetsbærere etter Boltzmann, d²u/dx² = (eᵘ − 1)/L_D², så sonen og laget der bærerne
 * samles, kommer begge ut av den samme ligningen. Tettheten av tegnede bærere følger
 * N·eᵘ. Laget der bærerne samles, er i virkeligheten mye tettere enn tegnet.
 *
 * Avstanden opp til vakuumnivået er forkortet med C = 3,5 eV og merket med brudd i
 * klammene; alle andre avstander er i skala.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const KT = 0.0259; // eV
const CHI = 4.05; // eV
const EG = 1.11; // eV
const DELTA = { n: 0.266, p: EG - 0.239 }; // E_c − E_F i bulk, eV
const LBAR = 1.6; // µm, lengden av halvlederen som tegnes
const LD = 0.13; // µm, Debye-lengden ved 10¹⁵ cm⁻³
const C = 3.5; // eV, forkortelsen av avstanden til vakuumnivået
const RANGE = { n: [3.9, 4.9], p: [4.3, 5.3] };
const WINDOW = { n: [-5.85, -3.0], p: [-5.65, -2.8] }; // eV, med C trukket fra vakuumnivået
const N0 = 64; // tegnede bærere i nøytral halvleder
const NG = 400; // celler langs staven
const ACC_CAP = 0.75; // høyst så mange ekstra bærere (i N0) tegnes i laget ved grenseflaten
const JOIN_T = 0.45; // s, gapet lukkes
const FLOW_T = 2.6; // s, ladningen flyttes
const NAMES = { "4.3": "Al", "4.8": "Au" };

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let type = "n";
  let phim = 4.8;
  let phase = "apart"; // apart | joining | joined
  let joinU = 0;
  let s = 0; // 0 … 1, hvor mye av ladningen som er flyttet
  let carriers = [];
  let clock = 0;

  // ── kontroller ──────────────────────────────────────────────────────────
  const join = document.createElement("button");
  join.type = "button";
  join.className = "sim-btn";
  join.addEventListener("click", () => (phase === "apart" ? startJoin() : reset()), { signal });

  const label = document.createElement("label");
  const nameEl = document.createElement("span");
  nameEl.innerHTML = "Φ<sub>m</sub> ";
  label.append(nameEl);
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.step = "0.05";
  input.setAttribute("aria-label", "Arbeidsfunksjonen til metallet, i volt");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      phim = Number(input.value);
      showPhi();
      if (reduce.matches && phase !== "apart") settle();
      if (phase === "apart" || reduce.matches) render();
    },
    { signal },
  );

  const typePick = choiceRow({
    ariaLabel: "Halvleder",
    label: "Halvleder",
    items: [
      { value: "n", label: "n-type Si" },
      { value: "p", label: "p-type Si" },
    ],
    onPick: (k) => {
      type = k;
      const [lo, hi] = RANGE[type];
      phim = Math.min(hi, Math.max(lo, phim));
      setRange();
      reset();
    },
    signal,
  });
  controls.append(join, label, typePick.el);

  function setRange() {
    const [lo, hi] = RANGE[type];
    input.min = String(lo);
    input.max = String(hi);
    input.value = String(phim);
    showPhi();
  }
  function name() {
    return NAMES[phim.toFixed(1)] && Math.abs(phim - Number(phim.toFixed(1))) < 1e-6 ? NAMES[phim.toFixed(1)] : "";
  }
  function showPhi() {
    out.textContent = `${phim.toFixed(2).replace(".", ",")} V`;
  }
  function sync() {
    join.textContent = phase === "apart" ? "Sett sammen" : "Skill dem";
    typePick.sync(type);
  }

  // ── fysikken ────────────────────────────────────────────────────────────
  const phis = () => CHI + DELTA[type]; // arbeidsfunksjonen til halvlederen
  const bs = () => phim - phis(); // båndbøyningen ved grenseflaten i likevekt, E_c(0) − E_c(bulk), eV
  // u = ln(majoritetstettheten/N): −b/kT på n-type, +b/kT på p-type.
  const uSurface = () => ((type === "n" ? -1 : 1) * s * bs()) / KT;
  const u = new Float64Array(NG + 1); // u ved x = i/NG · LBAR
  const dens = new Float64Array(NG + 1); // tegnet tetthet, i N
  const cum = new Float64Array(NG + 1); // ∫ fra x til LBAR av tettheten, i N·LBAR

  /** Løser d²u/dx² = (eᵘ − 1)/L_D² fra grenseflaten, med u → 0 langt inne. */
  function profile() {
    const us = uSurface();
    const dx = LBAR / NG;
    const sub = 8;
    const h = dx / sub;
    const slope = (v) => {
      const g = Math.exp(v) - 1 - v;
      return (-Math.sign(v) * Math.sqrt(Math.max(0, 2 * g))) / LD;
    };
    let v = us;
    u[0] = v;
    for (let i = 1; i <= NG; i++) {
      for (let k = 0; k < sub; k++) {
        // RK4 på du/dx = slope(u)
        const k1 = slope(v);
        const k2 = slope(v + 0.5 * h * k1);
        const k3 = slope(v + 0.5 * h * k2);
        const k4 = slope(v + h * k3);
        const nv = v + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        v = Math.sign(nv) !== Math.sign(v) && v !== 0 ? 0 : nv;
      }
      u[i] = v;
    }
    // Overskuddet i laget der bærerne samles, skaleres ned så det får plass i tegningen.
    let excess = 0;
    for (let i = 0; i <= NG; i++) if (u[i] > 0) excess += (Math.min(Math.exp(u[i]), 1e12) - 1) / NG;
    const k = excess > ACC_CAP ? ACC_CAP / excess : 1;
    for (let i = 0; i <= NG; i++) dens[i] = u[i] > 0 ? 1 + (Math.min(Math.exp(u[i]), 1e12) - 1) * k : Math.exp(u[i]);
    cum[NG] = 0;
    for (let i = NG - 1; i >= 0; i--) cum[i] = cum[i + 1] + (0.5 * (dens[i] + dens[i + 1])) / NG;
  }
  /** x (i staver) der kumulert tetthet fra høyre er c. */
  function xAt(c) {
    if (c <= 0) return 1;
    if (c >= cum[0]) return 0;
    let lo = 0;
    let hi = NG;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] > c) lo = m;
      else hi = m;
    }
    const f = (cum[lo] - c) / (cum[lo] - cum[hi] || 1);
    return (lo + f) / NG;
  }
  const present = () => Math.round(cum[0] * N0);
  /** Sonebredden, der tettheten har falt til halvparten. */
  function zoneW() {
    if (dens[0] >= 0.5) return 0;
    let i = 0;
    while (i < NG && dens[i] < 0.5) i++;
    return i / NG;
  }

  // ── bærerne ─────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const mk = (i, x) => ({ i, x, px: x, jx: 0, jy: rnd(), vx: 0, vy: 0, state: "in", t: 0 });
  function reset() {
    phase = "apart";
    joinU = 0;
    s = 0;
    profile();
    carriers = [];
    for (let i = 0; i < N0; i++) {
      const x = xAt((i + 0.5) / N0);
      carriers.push(mk(i, x));
    }
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

  /** Bærerne følger tettheten: bærer nummer i (fra høyre) står der kumulert tetthet er (i + ½)/N0. */
  function place(dt, snap) {
    const n = present();
    // Sørg for at det finnes objekter for alle som er til stede.
    while (carriers.length < n) {
      const c = mk(carriers.length, 0);
      c.state = "enter";
      carriers.push(c);
    }
    for (const c of carriers) {
      const here = c.i < n;
      if (here) {
        const tx = xAt((c.i + 0.5) / N0);
        if (c.state === "gone" || c.state === "leave") {
          c.state = "enter";
          c.px = 0;
        }
        if (c.state === "enter" && Math.abs(c.px - tx) < 0.01) c.state = "in";
        const k = snap ? 1 : Math.min(1, dt / (c.state === "enter" ? 0.35 : 0.12));
        c.px += (tx - c.px) * k;
        c.x = tx;
      } else if (c.state !== "gone") {
        if (c.state !== "leave") {
          c.state = "leave";
          c.t = 0;
        }
        c.px -= (snap ? 10 : dt / 0.5);
        if (c.px <= 0) {
          c.px = 0;
          c.state = "gone";
        }
      }
      // Små tilfeldige bevegelser rundt plassen.
      if (!snap) {
        c.vx += ((rnd() - 0.5) * 0.06 - c.vx * 0.9) * dt * 6;
        c.vy += ((rnd() - 0.5) * 1.6 - c.vy * 0.9) * dt * 6;
        c.jx = Math.max(-0.012, Math.min(0.012, c.jx + c.vx * dt));
        c.jy += c.vy * dt;
        if (c.jy < 0.04) (c.jy = 0.08 - c.jy), (c.vy = Math.abs(c.vy));
        if (c.jy > 0.96) (c.jy = 1.92 - c.jy), (c.vy = -Math.abs(c.vy));
      }
    }
  }
  function settle() {
    profile();
    place(0, true);
    for (const c of carriers) if (c.state === "enter") c.state = "in";
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
    } else if (phase === "joined" && s < 1) {
      s = Math.min(1, s + dt / FLOW_T);
    }
    profile();
    place(dt, false);
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 300) return null;
    const bx0 = 10;
    const bx1 = w - 10;
    const mw = Math.round((bx1 - bx0) * 0.24); // metallets bredde
    const by0 = 30;
    const by1 = 96;
    const ey0 = 120;
    const ey1 = h - 8;
    const [elo, ehi] = WINDOW[type];
    const pe = (ey1 - ey0) / (ehi - elo); // px per eV
    return { w, h, bx0, bx1, mw, by0, by1, ey0, ey1, elo, ehi, pe };
  }
  const gapPx = () => (phase === "apart" ? 16 : phase === "joining" ? 16 * (1 - joinU) : 0);
  const xm = () => G.bx0 + G.mw; // metallets overflate
  const xs0 = () => xm() + gapPx(); // halvlederens overflate
  const X = (x) => xs0() + x * (G.bx1 - xs0());
  const yE = (E) => G.ey0 + (G.ehi - E) * G.pe;

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, t) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${t}</tspan>`;

  /** Klamme fra y0 til y1 ved x, med bruddmerke midt på når brk er satt. */
  function bracket(x, y0, y1, brk) {
    const top = Math.min(y0, y1);
    const bot = Math.max(y0, y1);
    let d = `M ${P(x - 4)} ${P(top)} h 8 M ${P(x - 4)} ${P(bot)} h 8 `;
    if (brk && bot - top > 18) {
      const m = (top + bot) / 2;
      d += `M ${P(x)} ${P(top)} V ${P(m - 5)} M ${P(x)} ${P(m + 5)} V ${P(bot)} `;
      d += `M ${P(x - 5)} ${P(m - 2)} l 10 -4 M ${P(x - 5)} ${P(m + 4)} l 10 -4`;
    } else d += `M ${P(x)} ${P(top)} V ${P(bot)}`;
    return `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;
  }

  // Energiene i halvlederen, i eV med vakuumnivået før kontakt i 0.
  const ecBulk = () => -CHI - s * bs();
  const ecAt = (x) => {
    const i = Math.min(NG, Math.max(0, Math.round(x * NG)));
    const b = ((type === "n" ? -1 : 1) * u[i] * KT); // E_c(x) − E_c(bulk)
    return ecBulk() + b;
  };

  function draw() {
    const { bx0, bx1, mw, by0, by1, ey0, ey1, w } = G;
    let out = "";
    const joined = phase === "joined";
    const W = joined ? zoneW() : 0;
    const depl = joined && W > 0.02;
    const xS = xs0();

    // Sonen tonet i staven og i båndskjemaet.
    if (depl) {
      const x1 = X(W);
      out +=
        `<rect x="${P(xS)}" y="${P(by0)}" width="${P(x1 - xS)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
        `<rect x="${P(xS)}" y="${P(ey0 - 4)}" width="${P(x1 - xS)}" height="${P(ey1 - ey0 + 4)}" style="fill:var(--accent)" fill-opacity="0.06"/>` +
        `<path d="M ${P(x1)} ${P(by0)} V ${P(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      if (x1 - xS > 22) {
        const yb = by1 + 12;
        out +=
          `<path d="M ${P(xS)} ${P(yb - 4)} v 8 M ${P(xS)} ${P(yb)} H ${P(x1)} M ${P(x1)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
          tag((xS + x1) / 2, yb + 13, "W", "middle", "var(--fg)", ";font-style:italic" + halo);
      }
    }

    // Metallet og halvlederen.
    out +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(mw)}" height="${P(by1 - by0)}" rx="3" style="fill:var(--muted)" fill-opacity="0.28"/>` +
      `<rect x="${P(xS)}" y="${P(by0)}" width="${P(bx1 - xS)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx0 + 6, by0 - 8, name() || "metall", "start", "var(--fg)") +
      tag(bx1 - 2, by0 - 8, type === "n" ? "n-Si" : "p-Si", "end", "var(--fg)");

    // Ionene i et fast gitter: svake der en bærer dekker dem, sterke der ingen gjør det.
    const rows = 5;
    const cols = Math.round(N0 / rows);
    let faint = "";
    let strong = "";
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const xx = (c + 0.25 + 0.5 * (r % 2)) / cols;
        const i = Math.min(NG, Math.round(xx * NG));
        const x = X(xx);
        const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
        const g = `M ${P(x - 2.2)} ${P(y)} h 4.4${type === "n" ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""} `;
        if (dens[i] < 0.5) strong += g;
        else faint += g;
      }
    out +=
      `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.35"/>` +
      `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.7"/>`;

    // Ladningen på metallets overflate: elektroner som har kommet inn (blå prikker),
    // eller elektroner som mangler (+).
    const n = present();
    const dm = n - N0; // > 0: halvlederen har fått bærere
    const metalGotElectrons = (type === "n" && dm < 0) || (type === "p" && dm > 0);
    const m = Math.abs(dm);
    if (m > 0) {
      const per = Math.max(1, Math.floor((by1 - by0 - 6) / 5.2));
      let g = "";
      for (let j = 0; j < m; j++) {
        const col = Math.floor(j / per);
        const x = xm() - 4 - col * 5.2;
        const y = by0 + 5 + (j % per) * 5.2;
        g += metalGotElectrons ? `<circle cx="${P(x)}" cy="${P(y)}" r="2"/>` : `M ${P(x - 2)} ${P(y)} h 4 M ${P(x)} ${P(y - 2)} v 4 `;
      }
      out += metalGotElectrons ? `<g style="fill:var(--indigo)">${g}</g>` : `<path d="${g}" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    }

    // Bærerne.
    let dots = "";
    for (const c of carriers) {
      if (c.state === "gone") continue;
      const xx = Math.max(0, Math.min(1, c.px + (c.state === "in" ? c.jx : 0)));
      const x = c.state === "leave" || c.state === "enter" ? X(Math.max(0, c.px)) : X(xx);
      const y = by0 + 4 + c.jy * (by1 - by0 - 8);
      const fade = type === "p" && c.state === "leave" ? Math.min(1, c.px / 0.06) : 1;
      const op = fade < 1 ? ` opacity="${fade.toFixed(2)}"` : "";
      dots += type === "n" ? `<circle cx="${P(x)}" cy="${P(y)}" r="2.1"${op}/>` : `<circle cx="${P(x)}" cy="${P(y)}" r="2.3"${op}/>`;
    }
    out += type === "n" ? `<g style="fill:var(--indigo)">${dots}</g>` : `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${dots}</g>`;

    // ── båndskjemaet ──
    const efm = -phim;
    const xM = xm();
    // Metallets fylte tilstander.
    out +=
      `<rect x="${P(bx0)}" y="${P(yE(efm))}" width="${P(mw)}" height="${P(ey1 - yE(efm))}" style="fill:var(--muted)" fill-opacity="0.28"/>` +
      `<path d="M ${P(bx0)} ${P(yE(efm))} H ${P(xM)} V ${P(ey1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.4"/>`;
    // Vakuumnivået (forkortet): flatt over metallet, qχ over E_c i halvlederen.
    const M = 160;
    let vac = `M ${P(bx0)} ${P(yE(-C))} H ${P(xM)} `;
    let pc = "";
    let pv = "";
    for (let k = 0; k <= M; k++) {
      const x = k / M;
      const ec = ecAt(x);
      const cmd = k ? "L" : (joined ? "L" : "M");
      vac += `${cmd} ${P(X(x))} ${P(yE(ec + CHI - C))} `;
      pc += `${k ? "L" : "M"} ${P(X(x))} ${P(yE(ec))} `;
      pv += `${k ? "L" : "M"} ${P(X(x))} ${P(yE(ec - EG))} `;
    }
    out +=
      `<path d="${vac}" fill="none" style="stroke:var(--muted)" stroke-width="1.2"/>` +
      `<path d="${pc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${pv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    // Fermi-nivåene.
    const efs = ecBulk() - DELTA[type];
    out +=
      `<path d="M ${P(bx0)} ${P(yE(efm))} H ${P(xM)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      `<path d="M ${P(xS)} ${P(yE(efs))} H ${P(bx1)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;

    // Merkene til høyre.
    const ecb = ecBulk();
    out +=
      tag(bx1 - 2, yE(ecb) - 6, sub("E", "c"), "end", "var(--fg)", halo) +
      tag(bx1 - 2, yE(ecb - EG) - 6, sub("E", "v"), "end", "var(--fg)", halo) +
      tag(bx1 - 2, yE(efs) + (type === "n" ? 14 : -6), sub("E", "F"), "end", "var(--accent)", halo) +
      tag(bx0 + 2, yE(efm) + 13, sub("E", "Fm"), "start", "var(--accent)", halo) +
      tag(bx0 + 2, yE(-C) - 5, sub("E", "vac"), "start", "var(--muted)", halo);

    // Klammene.
    const xb = bx0 + mw * 0.72;
    out += bracket(xb, yE(efm), yE(-C), true) + tag(xb - 7, (yE(efm) + yE(-C)) / 2 + 4, `q${sub("Φ", "m")}`, "end", "var(--fg)", halo);
    if (!joined) {
      // Før kontakt: qχ og qΦ_s.
      const xc = xS + 16;
      const xf = bx1 - 52;
      out +=
        bracket(xc, yE(ecb), yE(ecb + CHI - C), true) +
        tag(xc + 7, (yE(ecb) + yE(ecb + CHI - C)) / 2 + 4, "qχ", "start", "var(--fg)", halo) +
        bracket(xf, yE(efs), yE(ecb + CHI - C), true) +
        tag(xf - 7, (yE(efs) + yE(ecb + CHI - C)) / 2 + 4, `q${sub("Φ", "s")}`, "end", "var(--fg)", halo);
    } else if (s > 0.98) {
      const ec0 = ecAt(0);
      const b = bs();
      const xc = xS + 9;
      // qχ ved grenseflaten.
      out += bracket(xc, yE(ec0), yE(ec0 + CHI - C), true) + tag(xc + 7, (yE(ec0) + yE(ec0 + CHI - C)) / 2 + 4, "qχ", "start", "var(--fg)", halo);
      const nDepl = type === "n" && b > 0.015;
      const pDepl = type === "p" && b < -0.015;
      if (nDepl && ec0 > efm + 0.02) {
        // qΦ_B fra E_F til E_c ved grenseflaten.
        out += bracket(xc, yE(efm), yE(ec0), false);
        if (yE(efm) - yE(ec0) > 13) out += tag(xc + 7, (yE(efm) + yE(ec0)) / 2 + 4, `q${sub("Φ", "B")}`, "start", "var(--fg)", halo);
      }
      // Bøyningen langt inne: fra båndkanten i bulk til båndkanten ved grenseflaten forlenget.
      const xk = bx1 - 30;
      const edge0 = type === "n" ? ec0 : ec0 - EG;
      const edgeB = type === "n" ? ecb : ecb - EG;
      if (Math.abs(yE(edge0) - yE(edgeB)) > 10) {
        const lbl = nDepl || pDepl ? `q${sub("V", "0")}` : type === "n" ? `q(${sub("Φ", "s")} − ${sub("Φ", "m")})` : `q(${sub("Φ", "m")} − ${sub("Φ", "s")})`;
        out +=
          `<path d="M ${P(xS + 22)} ${P(yE(edge0))} H ${P(xk + 4)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
          bracket(xk, yE(edge0), yE(edgeB), false) +
          (!(nDepl || pDepl)
            ? tag(xk - 7, Math.min(yE(edge0), yE(edgeB)) - 12, lbl, "end", "var(--fg)", halo)
            : Math.abs(yE(edge0) - yE(edgeB)) > 24
              ? tag(xk - 7, (yE(edge0) + yE(edgeB)) / 2 + 4, lbl, "end", "var(--fg)", halo)
              : tag(xk - 7, Math.max(yE(edge0), yE(edgeB)) + 14, lbl, "end", "var(--fg)", halo));
      }
    }
    void w;
    return out;
  }

  function render() {
    G = layout();
    if (!G) return;
    if (phase === "apart" || reduce.matches) profile();
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
  setRange();
  reset();
}
