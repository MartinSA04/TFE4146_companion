/**
 * Metall mot n-type Si, for TFE4146 modul 08.
 * Én idé: hvilken vei båndene bøyer seg, avgjør om kontakten likeretter.
 * Med Φ_m > Φ_s tømmes halvlederen nær grenseflaten, og det blir to
 * barrierer: q(V_0 − V) fra halvledersiden, som spenningen flytter, og
 * qΦ_B fra metallet, som ligger fast. Med Φ_m < Φ_s samles elektronene ved
 * grenseflaten, det er ingen barriere, og strømmen følger spenningen.
 *
 * Øverst står kontakten sett fra siden: metallet til venstre, n-Si til
 * høyre, romladningssonen tonet med de avdekkede donorene som ⊕-ringer og
 * motladningen som en ring på metalloverflaten. I midten står båndskjemaet
 * på samme x-akse, med E_Fm = 0 som referanse: metallet er fylt opp til
 * Fermi-nivået, E_c og E_v bøyer seg som en parabel over sonen, og
 * vakuumnivået ligger qχ over E_c i halvlederen og qΦ_m over E_Fm i
 * metallet, kontinuerlig over grenseflaten. Avstanden opp til vakuumnivået
 * er trykket sammen (DV i stedet for χ), og klammene for qΦ_m og qχ har
 * bruddmerker; differansen qΦ_B er i skala. Nederst står et amperemeter med
 * null i midten.
 *
 * Elektronene i ledningsbåndet er prikker like over E_c i den nøytrale
 * delen. Strømmen deles i to fluksstrømmer: fra metallet over Φ_B,
 * f_ms = I_0, og fra halvlederen over V_0 − V, f_sm = I_0 + I, så
 * nettostrømmen er I. Hver fluks gir prikker som klatrer opp og går over
 * toppen (raten metter mot RMAX), og skyen driver mot grenseflaten med en
 * fart proporsjonal med I.
 *
 * Kretsen er en ideell Schottky-diode i serie med motstanden RS i den
 * nøytrale halvlederen: V = V_j + I·RS, I = I_0(e^(V_j/VT) − 1), og
 * I_0 = I0_REF·e^(−(Φ_B − 0,75)/VTB). En liten barriere gir stor I_0, så
 * strømmen settes av RS og kontakten blir ohmsk lenge før Φ_m når Φ_s;
 * med Φ_m < Φ_s er V_j = 0 og I = V/RS. Spenningen I·RS tegnes som en
 * helling i båndene i den nøytrale delen. VT og VTB er tegningens termiske
 * spenninger, større enn de virkelige 0,0259 V så kneet synes; strømmen er
 * i enheter av fullt utslag.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KT = 0.0259; // eV
const CHI = 4.05; // eV, elektronaffiniteten til Si
const EG = 1.11; // eV
const ECF = KT * Math.log(2.9e19 / 1e16); // E_c − E_F i n-Si med N_d = 10¹⁶, 0,21 eV
const PHI_S = CHI + ECF; // 4,26 eV
const EPS = 11.8 * 8.85e-14; // F/cm
const Q = 1.6e-19; // C
const ND = 1e16; // cm⁻³

const PHI_MIN = 4.0;
const PHI_MAX = 5.0;
const V_MIN = -0.4;
const V_MAX = 0.4;

const VT = 0.05; // V, tegningens termiske spenning i e^(V/VT)
const VTB = 0.07; // V, tegningens termiske spenning i I_0(Φ_B)
const PHIB_REF = 0.75; // V, Φ_B for Au, Φ_m = 4,8 V
const I0_REF = 0.0019; // I_0 ved PHIB_REF, i enheter av fullt utslag
const RS = 0.4; // V per fullt utslag, motstanden i den nøytrale delen
const G_OHM = 3; // fluks hver vei i en ohmsk kontakt
const DV = 0.42; // eV, tegnet avstand fra E_c til vakuumnivået

const EMAX = 1.45; // eV, toppen av båndskjemaet
const EMIN = -1.36; // eV, bunnen av båndskjemaet

const TAU = 0.45; // s, båndenes innstillingstid
const NEEDLE_TAU = 0.2; // s, viserens treghet
const R = 2.8; // px, elektronprikkens radius
const R0 = 0.8; // per s, krysninger hver vei i likevekt for Au
const RMAX = 14; // per s, tak på krysningsraten hver vei
const VFLOW = 90; // px/s, skyens drift ved fullt utslag
const JIT = 40; // px/s², termisk vandring

export default function init({ stage, controls, getSize, onResize, signal }) {
  let phiT = 4.8;
  let vT = 0;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let phiC = phiT;
  let vC = vT;

  /** Likevektsbildet og strømmen for en gitt Φ_m og spenning. */
  function state(phi, va) {
    const v0 = phi - PHI_S;
    const phiB = phi - CHI;
    if (v0 <= 0) {
      const I = va / RS;
      return { v0, phiB, vj: 0, I, b: 0, fms: G_OHM, fsm: Math.max(0, G_OHM + I) };
    }
    const i0 = I0_REF * Math.exp(-(phiB - PHIB_REF) / VTB);
    const f = (vj) => i0 * (Math.exp(vj / VT) - 1) - (va - vj) / RS;
    let lo = Math.min(0, va);
    let hi = Math.max(0, va);
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    const vj = (lo + hi) / 2;
    const I = (va - vj) / RS;
    return { v0, phiB, vj, I, b: Math.max(v0 - vj, 0), fms: i0, fsm: Math.max(0, i0 + I) };
  }

  let st = state(phiC, vC);
  let iShown = st.I;
  let phase = 0;

  // ── kontroller ────────────────────────────────────────────────────────────
  const slider = ({ text, min, max, step, value, aria, onInput }) => {
    const label = document.createElement("label");
    label.append(text + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    input.addEventListener(
      "input",
      () => {
        onInput(Number(input.value));
        changed();
      },
      { signal },
    );
    return { el: label, out };
  };

  const phiS = slider({
    text: "Arbeidsfunksjon",
    min: PHI_MIN,
    max: PHI_MAX,
    step: 0.1,
    value: phiT,
    aria: "Arbeidsfunksjonen til metallet i eV",
    onInput: (x) => (phiT = Math.round(x * 10) / 10),
  });
  const vS = slider({
    text: "Spenning",
    min: V_MIN,
    max: V_MAX,
    step: 0.05,
    value: vT,
    aria: "Spenningen over kontakten i volt, positiv på metallet",
    onInput: (x) => (vT = Math.round(x * 100) / 100),
  });

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

  controls.append(phiS.el, vS.el, playBtn);

  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",").replace("-", "−");
  function sync() {
    phiS.out.textContent = `${NB(phiT, 1)} eV`;
    vS.out.textContent = vT === 0 ? "likevekt" : `${vT > 0 ? "+" : "−"}${NB(Math.abs(vT))} V`;
  }

  function changed() {
    sync();
    if (!playing) snap();
    render();
    start();
  }

  function snap() {
    phiC = phiT;
    vC = vT;
    st = state(phiC, vC);
    iShown = st.I;
    transit.length = 0;
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const g = {};
  let cloud = [];
  let acc = [];
  const transit = [];

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 14;
    g.bx1 = w - 36;
    const span = g.bx1 - g.bx0;
    g.mw = clamp(0.22 * span, 78, 150);
    g.xi = g.bx0 + g.mw;
    g.Ls = g.bx1 - g.xi;
    g.sy0 = 8;
    g.sy1 = 38;
    g.yTop = 58;
    g.yBot = h - 56;
    g.sPx = (g.yBot - g.yTop) / (EMAX - EMIN);
    g.my = h - 24;
    g.pxPerCm = (0.3 * g.Ls) / Math.sqrt((2 * EPS * (4.8 - PHI_S)) / (Q * ND));
    g.lam = Math.max(8, 0.035e-4 * g.pxPerCm);

    const n = clamp(Math.round(g.Ls / 6), 24, 100);
    if (cloud.length !== n) {
      cloud = Array.from({ length: n }, () => ({
        u: Math.random(),
        e: Math.min(0.16, 0.012 + 0.045 * -Math.log(1 - Math.random())),
        jx: 0,
        jy: 0,
      }));
    }
    if (acc.length !== 14) {
      acc = Array.from({ length: 14 }, () => ({
        a: Math.random(),
        e: Math.min(0.1, 0.01 + 0.03 * -Math.log(1 - Math.random())),
        jy: 0,
      }));
    }
  }

  /** Sonebredden i px for barrieren b (V). */
  const wPx = (b) => Math.sqrt((2 * EPS * b) / (Q * ND)) * g.pxPerCm;

  /** Båndkanten E_c (eV over E_Fm) i avstanden x (px) fra grenseflaten. */
  function ecAt(x) {
    const IR = st.I * RS;
    if (st.v0 <= 0) return ECF + st.v0 * Math.exp(-x / g.lam) + (IR * x) / g.Ls;
    const wp = wPx(st.b);
    const edge = st.vj + ECF;
    if (x < wp) return edge + st.b * (1 - x / wp) ** 2;
    return edge + (IR * (x - wp)) / Math.max(1, g.Ls - wp);
  }
  /** Fermi-nivået i den nøytrale delen. */
  function efAt(x) {
    const IR = st.I * RS;
    if (st.v0 <= 0) return (IR * x) / g.Ls;
    const wp = wPx(st.b);
    return st.vj + (IR * Math.max(0, x - wp)) / Math.max(1, g.Ls - wp);
  }

  const yE = (E) => g.yTop + (EMAX - E) * g.sPx;
  const X = (x) => g.xi + x; // px fra grenseflaten → skjermkoordinat

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const halo = ";stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round;paint-order:stroke";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = halo) =>
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
  /** Loddrett klamme fra yA til yB, med bruddmerke midt på når den er trykket sammen. */
  const bracket = (x, yA, yB, broken = false) => {
    let s = `<path d="M ${P(x)} ${P(yA)} V ${P(yB)} M ${P(x - 3)} ${P(yA)} h 6 M ${P(x - 3)} ${P(yB)} h 6" stroke="var(--fg)" stroke-width="1" fill="none"/>`;
    if (broken) {
      const ym = (yA + yB) / 2;
      s +=
        `<rect x="${P(x - 4)}" y="${P(ym - 3)}" width="8" height="6" fill="var(--canvas-bg)"/>` +
        `<path d="M ${P(x - 4)} ${P(ym - 1)} l 8 -3 M ${P(x - 4)} ${P(ym + 3)} l 8 -3" stroke="var(--fg)" stroke-width="1"/>`;
    }
    return s;
  };
  const red = "var(--red)";
  const blue = "var(--indigo)";

  /** Et fast ion: en ring med fortegnet inni. */
  const ion = (x, y, positive, alpha) =>
    `<g opacity="${P(alpha)}" stroke="${positive ? red : blue}" stroke-width="1.2" fill="none">` +
    `<circle cx="${P(x)}" cy="${P(y)}" r="4.2"/>` +
    `<path d="M ${P(x - 2.2)} ${P(y)} h 4.4${positive ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""}"/>` +
    `</g>`;

  function render() {
    if (g.w < 120 || g.h < 120) return; // ikke lagt ut ennå
    const { w, bx0, bx1, xi, Ls, sy0, sy1, yTop, yBot, my } = g;
    const dep = st.v0 > 0;
    const wp = dep ? wPx(st.b) : 0;
    const xe = X(wp); // sonekanten på skjermen
    const smid = (sy0 + sy1) / 2;

    let svg = "";

    // Ledningene og polariteten.
    const ai = clamp(Math.abs(iShown), 0, 1);
    if (ai > 0.04) {
      const sw = 1.5 + 2.5 * ai;
      svg +=
        iShown > 0
          ? arrow(1, smid, bx0 - 1, smid, "var(--accent)", sw) + arrow(bx1 + 1, smid, w - 4, smid, "var(--accent)", sw)
          : arrow(bx0 - 1, smid, 1, smid, "var(--accent)", sw) + arrow(w - 4, smid, bx1 + 1, smid, "var(--accent)", sw);
    } else {
      svg += `<path d="M 1 ${P(smid)} H ${P(bx0)} M ${P(bx1)} ${P(smid)} H ${P(w - 4)}" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    }
    if (Math.abs(vT) > 1e-6) {
      const big = ";font-size:var(--text-sm);font-weight:600";
      svg +=
        tag(bx0 - 6, sy0 + 2, vT > 0 ? "+" : "−", "middle", "var(--fg)", big) +
        tag(bx1 + 12, sy0 + 2, vT > 0 ? "−" : "+", "middle", "var(--fg)", big);
    }

    // Kontakten sett fra siden.
    svg +=
      `<rect x="${P(bx0)}" y="${P(sy0)}" width="${P(xi - bx0)}" height="${P(sy1 - sy0)}" fill="var(--muted)" fill-opacity="0.3" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<rect x="${P(xi)}" y="${P(sy0)}" width="${P(Ls)}" height="${P(sy1 - sy0)}" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    if (dep && wp > 1) {
      svg += `<rect x="${P(xi)}" y="${P(sy0)}" width="${P(wp)}" height="${P(sy1 - sy0)}" fill="var(--fg)" fill-opacity="0.07"/>`;
      for (let i = 0; ; i++) {
        const d = 8 + i * 13;
        const alpha = clamp((wp - d) / 5 + 0.5, 0, 1);
        if (alpha < 0.3) break;
        svg += ion(X(d), smid, true, alpha);
      }
      svg += ion(xi - 7, smid, false, clamp(st.b / 0.12, 0, 1));
    } else if (st.v0 < 0) {
      const k = clamp(-st.v0 / 0.12, 0, 1);
      svg += ion(xi - 7, smid, true, k);
      svg += `<g style="fill:${blue}" opacity="${P(k)}"><circle cx="${P(xi + 5)}" cy="${P(smid - 6)}" r="${R}"/><circle cx="${P(xi + 5)}" cy="${P(smid + 6)}" r="${R}"/><circle cx="${P(xi + 11)}" cy="${P(smid)}" r="${R}"/></g>`;
    }
    svg += tag((bx0 + xi) / 2, smid + 4, "Metall", "middle", "var(--fg)", "");
    svg += tag(bx1 - 6, smid + 4, "n-Si", "end", "var(--fg)", "");
    if (dep && wp >= 14) {
      const yW = sy1 + 7;
      svg +=
        `<path d="M ${P(xi)} ${P(yW - 3)} v 6 M ${P(xi)} ${P(yW)} H ${P(xe)} M ${P(xe)} ${P(yW - 3)} v 6" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
        tag((xi + xe) / 2, yW + 12, "W", "middle", "var(--fg)");
    }

    // Romladningssonen tonet i båndskjemaet, med stiplet kant gjennom begge.
    if (dep && wp > 1) {
      svg +=
        `<path d="M ${P(xe)} ${P(sy0)} V ${P(sy1)} M ${P(xe)} ${P(yTop)} V ${P(yBot)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    }

    // Metallet: fylt opp til Fermi-nivået.
    svg += `<rect x="${P(bx0)}" y="${P(yE(0))}" width="${P(xi - bx0)}" height="${P(yBot - yE(0))}" fill="var(--muted)" fill-opacity="0.3"/>`;
    svg += `<path d="M ${P(xi)} ${P(yTop)} V ${P(yBot)}" stroke="var(--border-strong)" stroke-width="1.5"/>`;

    // Båndene i halvlederen.
    const pts = [];
    const step = Math.max(1.5, Ls / 180);
    for (let x = 0; x < Ls; x += step) pts.push(x);
    pts.push(Ls);
    const pathOf = (off) => pts.map((x, i) => `${i ? "L" : "M"} ${P(X(x))} ${P(yE(ecAt(x) + off))}`).join(" ");
    svg += `<path d="${pathOf(DV)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`;
    svg += `<path d="M ${P(bx0)} ${P(yE(st.phiB + DV))} H ${P(xi)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3"/>`;
    const cPath = pathOf(0);
    const vPath = pathOf(-EG);
    const vBack = pts
      .slice()
      .reverse()
      .map((x) => `L ${P(X(x))} ${P(yE(ecAt(x) - EG))}`)
      .join(" ");
    svg += `<path d="${cPath} ${vBack} Z" fill="var(--card-nested)"/>`;
    svg += `<path d="${cPath}" stroke="var(--fg)" stroke-opacity="0.75" stroke-width="1.5" fill="none"/>`;
    svg += `<path d="${vPath}" stroke="var(--fg)" stroke-opacity="0.75" stroke-width="1.5" fill="none"/>`;

    // Fermi-nivåene: metallets er toppen av det fylte, halvlederens i den nøytrale delen.
    const efPts = pts.filter((x) => x >= wp);
    svg +=
      `<path d="M ${P(bx0)} ${P(yE(0))} H ${P(xi)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      `<path d="${efPts.map((x, i) => `${i ? "L" : "M"} ${P(X(x))} ${P(yE(efAt(x)))}`).join(" ")}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3" fill="none"/>`;

    // Navnene på nivåene ytterst til høyre.
    const ecR = ecAt(Ls);
    svg +=
      tag(bx1 + 4, yE(ecR + DV) + 4, sub("E", "vac"), "start", "var(--muted)") +
      tag(bx1 + 4, yE(ecR) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(bx1 + 4, yE(efAt(Ls)) + 4, sub("E", "F"), "start", "var(--accent)") +
      tag(bx1 + 4, yE(ecR - EG) + 4, sub("E", "v"), "start", "var(--fg)");

    // qΦ_m i metallet og qχ ytterst i halvlederen, begge trykket sammen.
    const xm = bx0 + 9;
    svg += bracket(xm, yE(0), yE(st.phiB + DV), true) + tag(xm + 6, yE(st.phiB + DV) + 12, sub("qΦ", "m"), "start", "var(--fg)");
    const ec0 = ecAt(0);
    const xc = xi + 7;
    svg += bracket(xc, yE(ec0), yE(ec0 + DV), true) + tag(xc + 7, yE(ec0 + DV / 2) - 5, "qχ", "start", "var(--fg)");

    // qΦ_B ved grenseflaten og q(V_0 − V) ved sonekanten.
    if (dep && st.phiB > 0.04) {
      const xb = xi - 13;
      const yMid = yE(st.phiB / 2);
      svg +=
        bracket(xb, yE(0), yE(st.phiB)) +
        tag(xb - 5, yMid - 1, sub("qΦ", "B"), "end", "var(--fg)") +
        tag(xb - 5, yMid + 12, `${NB(st.phiB)} eV`, "end", "var(--fg)");
    }
    if (dep && st.b > 0.02) {
      const top = ecAt(0);
      const xb = xe + 10;
      const sym =
        Math.abs(vC) < 0.005
          ? `qV<tspan dy='3' font-size='9'>0</tspan>`
          : `q(V<tspan dy='3' font-size='9'>0</tspan><tspan dy='-3'>−V)</tspan>`;
      // To linjer ved siden av klammen når den er høy nok, ellers over toppen.
      const yLo = yE(st.vj + ECF);
      const yHi = yE(top);
      const y1 = yLo - yHi >= 34 ? (yLo + yHi) / 2 - 9 : yHi - 19;
      svg +=
        `<path d="M ${P(xi)} ${P(yHi)} H ${P(xb + 4)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        bracket(xb, yLo, yHi) +
        tag(xb + 6, y1, sym, "start", "var(--fg)") +
        tag(xb + 6, y1 + 13, `${NB(st.b)} eV`, "start", "var(--fg)");
    }

    // Elektronene i ledningsbåndet.
    let dots = "";
    const xs0 = (dep ? wp : 0) + R + 2;
    const xs1 = Ls - R - 1;
    const spanS = Math.max(10, xs1 - xs0);
    for (const d of cloud) {
      const f = (((d.u + phase) % 1) + 1) % 1;
      const x = xs0 + f * spanS;
      const edgeFade = clamp(Math.min(x - xs0, xs1 - x) / 10, 0, 1);
      dots += `<circle cx="${P(X(x + d.jx))}" cy="${P(yE(ecAt(x) + d.e) + d.jy)}" r="${R}" fill-opacity="${P(0.9 * edgeFade)}"/>`;
    }
    if (st.v0 < 0) {
      const k = Math.round(acc.length * clamp(-st.v0 / 0.2, 0, 1));
      for (let i = 0; i < k; i++) {
        const a = acc[i];
        const x = R + 1 - g.lam * Math.log(1 - 0.92 * a.a);
        dots += `<circle cx="${P(X(x))}" cy="${P(yE(ecAt(x) + a.e) + a.jy)}" r="${R}" fill-opacity="0.9"/>`;
      }
    }
    for (const t of transit) {
      dots += `<circle cx="${P(X(t.x))}" cy="${P(yE(t.E))}" r="${R}" fill-opacity="${P(0.9 * t.alpha)}"/>`;
    }
    svg += `<g style="fill:${blue}">${dots}</g>`;

    // Amperemeteret, med null i midten.
    const xz = (bx0 + bx1) / 2;
    const half = (bx1 - bx0) / 2;
    let ticks = "";
    for (let i = -4; i <= 4; i++) {
      const x = xz + (i / 4) * half;
      ticks += `M ${P(x)} ${P(my)} V ${P(my + (i % 2 === 0 ? 7 : 3))} `;
    }
    const xN = xz + clamp(iShown, -1.04, 1.04) * half;
    svg +=
      `<path d="M ${P(bx0)} ${P(my)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(xz, my + 18, "0", "middle") +
      tag(bx0 - 4, my + 4, "I", "end", "var(--fg)") +
      `<path d="M ${P(xN)} ${P(my - 16)} V ${P(my + 7)}" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  /** Krysningsrate per s for en fluks, mettet mot RMAX. */
  const rate = (f) => RMAX * (1 - Math.exp((-R0 * f) / (I0_REF * RMAX)));

  function spawn(kind) {
    const dep = st.v0 > 0;
    const wp = dep ? wPx(st.b) : 0;
    if (kind === "sm") {
      // Fra toppen av skyen ved sonekanten: klatre over barrieren, gå inn i metallet.
      const x0 = dep ? wp + 8 + 40 * Math.random() : (0.05 + 0.3 * Math.random()) * g.Ls;
      const x1 = dep ? wp + 1 : x0;
      const E0 = ecAt(x0) + 0.02 + 0.04 * Math.random();
      let top = E0;
      for (let s = 0; s <= x0; s += 2) top = Math.max(top, ecAt(s) + 0.025);
      transit.push({ kind, phase: "approach", k: 0, x0, x1, E0, x: x0, E: E0, top, alpha: 1 });
    } else {
      // Fra overflaten av det fylte i metallet: klatre over Φ_B, gå ut i halvlederen.
      const x = -(2 + Math.random() * 4);
      const top = Math.max(ecAt(0), 0) + 0.025;
      const stop = wp + 12 + Math.random() * 40;
      transit.push({ kind, phase: "appear", x, E: -0.02, top, stop, alpha: 0 });
    }
  }

  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    phiC += (phiT - phiC) * k;
    vC += (vT - vC) * k;
    if (Math.abs(phiT - phiC) < 1e-4) phiC = phiT;
    if (Math.abs(vT - vC) < 1e-4) vC = vT;
    st = state(phiC, vC);
    iShown += (st.I - iShown) * (1 - Math.exp(-dt / NEEDLE_TAU));

    // Skyen driver mot grenseflaten med strømmen.
    const dep = st.v0 > 0;
    const wp = dep ? wPx(st.b) : 0;
    const spanS = Math.max(10, g.Ls - R - 1 - (wp + R + 2));
    phase -= (VFLOW * clamp(st.I, -1.2, 1.2) * dt) / spanS;
    phase = ((phase % 1) + 1) % 1;
    for (const d of cloud) {
      d.jx += ((Math.random() - 0.5) * JIT - 3 * d.jx) * dt;
      d.jy += ((Math.random() - 0.5) * JIT * 0.3 - 3 * d.jy) * dt;
    }
    for (const a of acc) a.jy += ((Math.random() - 0.5) * JIT * 0.3 - 3 * a.jy) * dt;

    // De to fluksene over barrierene.
    if (Math.random() < rate(st.fsm) * dt) spawn("sm");
    if (Math.random() < rate(st.fms) * dt) spawn("ms");

    for (let i = transit.length - 1; i >= 0; i--) {
      const t = transit[i];
      if (t.phase === "approach") {
        t.k = Math.min(1, t.k + dt / 0.3);
        t.x = t.x0 + (t.x1 - t.x0) * t.k;
        t.E = t.E0 + (t.top - t.E0) * t.k;
        if (t.k >= 1) t.phase = "cross";
      } else if (t.phase === "appear") {
        t.alpha = Math.min(1, t.alpha + dt / 0.15);
        if (t.alpha >= 1) t.phase = "climb";
      } else if (t.phase === "climb") {
        t.E = Math.min(t.top, t.E + 3 * dt);
        if (t.E >= t.top) t.phase = "cross";
      } else if (t.phase === "cross") {
        if (t.kind === "sm") {
          t.x -= 320 * dt;
          if (t.x < 0) t.phase = "sink";
        } else {
          t.x += 320 * dt;
          if (t.x > t.stop) t.phase = "drop";
        }
      } else if (t.phase === "sink") {
        t.x -= 20 * dt;
        t.E = Math.max(-0.12, t.E - 2.5 * dt);
        t.alpha -= dt / 0.35;
      } else {
        t.x += 40 * dt;
        const floor = ecAt(clamp(t.x, 0, g.Ls)) + 0.04;
        t.E = Math.max(floor, t.E - 2 * dt);
        if (t.E <= floor + 1e-3) t.alpha -= dt / 0.35;
      }
      if (t.alpha <= 0 || t.x > g.Ls || t.x < -g.mw) transit.splice(i, 1);
    }
    if (transit.length > 50) transit.splice(0, transit.length - 50);
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
    last = now;
    step(dt);
    render();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible) return;
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
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
