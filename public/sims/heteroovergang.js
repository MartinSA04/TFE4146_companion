/**
 * Båndene i en heteroovergang, for TFE4146 modul 08.
 * Én idé: når N⁺-AlGaAs og GaAs kommer i kontakt, flyttes elektroner til
 * Fermi-nivåene er like og båndene bøyer seg, men sprangene ΔE_c og ΔE_v
 * ved grenseflaten er de samme hele veien. Mot lett dopet GaAs havner
 * elektronene i en smal brønn i ledningsbåndet.
 *
 * Tilstanden er s fra 0 (hver for seg, vakuumnivåene like, som i Andersons
 * affinitetsregel) til 1 (likevekt). AlGaAs til venstre ligger fast med
 * E_F = 0. GaAs løftes med s·V_0, så Fermi-nivåene møtes ved s = 1, og
 * båndbøyningen på hver side vokser som s·V_01 og s·V_02, med
 * V_01 + V_02 = V_0. Da er vakuumnivået (E_c + χ) kontinuerlig over
 * grenseflaten for alle s, og sprangene i E_c og E_v er alltid 0,28 og
 * 0,14 eV. Mellomrommet mellom materialene lukkes mens s vokser.
 *
 * Profilene er skisser i normerte enheter, ikke løsninger av Poissons
 * ligning: en parabel på hver side. Delingen av V_0 og bredden på hver
 * side er valgt etter dopingen, som i bokas skisser, og brønnen på
 * GaAs-siden går et stykke under E_F mot n-GaAs og lett dopet GaAs, så den
 * synes. Elektronene fra den tømte delen av AlGaAs flyttes over i brønnen
 * mens s vokser; mot p⁺-GaAs møter de hullene fra den tømte delen av GaAs
 * og blir borte.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const EG1 = 1.85; // eV, Al0,3Ga0,7As
const EG2 = 1.43; // eV, GaAs
const DEC = 0.28; // eV
const DV = 0.3; // eV, tegnet avstand fra E_c til vakuumnivået i AlGaAs
const EC1 = 0.04; // eV, E_c − E_F i N⁺-AlGaAs

const CASES = {
  n: { label: "n-GaAs", ecf2: 0.1, v01: 0.12, w1: 0.3, w2: 0.35, acc: true, carrier: "n", nR: 1 },
  p: { label: "p⁺-GaAs", ecf2: EG2 - 0.04, v01: 0.85, w1: 0.45, w2: 0.42, acc: false, carrier: "p", nR: 1 },
  lett: { label: "lett dopet GaAs", ecf2: 0.3, v01: 0.09, w1: 0.25, w2: 0.9, acc: true, carrier: "n", nR: 0.15 },
};

const GAP = 28; // px, mellomrommet før kontakt
const T_JOIN = 1.8; // s, tiden overgangen bruker
const R = 2.8; // px, bærerprikkens radius

export default function init({ stage, controls, getSize, onResize, signal }) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let caseKey = "n";
  let sT = 1;
  let s = still ? 1 : 0;
  let hold = still ? 0 : 0.7;

  const C = () => CASES[caseKey];
  // Før kontakt er E_F1 = 0, E_c1 = EC1, E_c2 = EC1 − DEC og E_F2 = E_c2 − ecf2,
  // så kontaktpotensialet er V_0 = E_F1 − E_F2.
  const contact = () => DEC - EC1 + C().ecf2;

  // ── kontroller ────────────────────────────────────────────────────────────
  const caseRow = choiceRow({
    ariaLabel: "Dopingen i GaAs",
    items: Object.entries(CASES).map(([value, c]) => ({ value, label: c.label })),
    onPick: (v) => {
      caseKey = v;
      sT = 1;
      s = still ? 1 : 0;
      hold = still ? 0 : 0.35;
      changed();
    },
    signal,
  });
  const joinRow = choiceRow({
    ariaLabel: "Før eller etter kontakt",
    items: [
      { value: "0", label: "Før kontakt" },
      { value: "1", label: "I likevekt" },
    ],
    onPick: (v) => {
      sT = Number(v);
      hold = 0;
      if (still) s = sT;
      changed();
    },
    signal,
  });
  controls.append(caseRow.el, joinRow.el);

  function sync() {
    caseRow.sync(caseKey);
    joinRow.sync(String(sT));
  }
  function changed() {
    sync();
    layout();
    render();
    start();
  }

  // ── fysikken ──────────────────────────────────────────────────────────────
  const smooth = (t) => t * t * (3 - 2 * t);
  /** E_c i AlGaAs i avstanden a (0…1, normert) fra grenseflaten. */
  const ec1 = (a, ss) => {
    const c = C();
    return EC1 + (a < c.w1 ? ss * c.v01 * (1 - a / c.w1) ** 2 : 0);
  };
  /** E_c i GaAs i avstanden a (0…1) fra grenseflaten. */
  const ec2 = (a, ss) => {
    const c = C();
    const V = contact();
    const v02 = V - c.v01;
    const t = Math.min(1, a / c.w2);
    const shape = (1 - t) ** 2;
    return EC1 - DEC + ss * V - ss * v02 * shape;
  };
  const ef2 = (ss) => EC1 - DEC + ss * contact() - C().ecf2;

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const g = {};
  let cloudL = [];
  let cloudR = [];
  let moveL = [];
  let moveR = [];

  const lots = (n, spread) =>
    Array.from({ length: n }, () => ({
      a: Math.random(),
      e: Math.min(3 * spread, 0.008 + spread * -Math.log(1 - Math.random())),
    }));

  function layout() {
    const { w, h } = getSize();
    const c = C();
    g.w = w;
    g.h = h;
    g.bx0 = 12;
    g.bx1 = w - 34;
    g.xm = (g.bx0 + g.bx1) / 2;
    g.yTop = 30;
    g.yBot = h - 12;
    const V = contact();
    // Øverst: vakuumnivået før kontakt, ytterst i GaAs etter, eller over spissen i AlGaAs.
    g.emax = Math.max(EC1 + DV, V + EC1 + DV, EC1 + c.v01 + DV) + 0.08;
    // Nederst: valensbåndet i AlGaAs, som ligger fast.
    g.emin = EC1 - EG1 - 0.1;
    g.sPx = (g.yBot - g.yTop) / (g.emax - g.emin);

    const half = (g.bx1 - g.bx0) / 2;
    const nL = clamp(Math.round(half / 5), 18, 70);
    if (cloudL.length !== nL) cloudL = lots(nL, 0.025);
    const nR = clamp(Math.round(half / 8), 10, 44);
    if (cloudR.length !== nR) cloudR = lots(nR, 0.03);
    if (moveL.length !== 12) moveL = lots(12, 0.02);
    if (moveR.length !== 9) moveR = lots(9, 0.02);
  }

  const yE = (E) => g.yTop + (g.emax - E) * g.sPx;
  /** Skjermkoordinaten for avstanden a (0…1) fra grenseflaten, side −1 eller +1. */
  const X = (side, a) => {
    const gap = (1 - smooth(s)) * GAP;
    const inner = g.xm + (side * gap) / 2;
    const outer = side < 0 ? g.bx0 : g.bx1;
    return inner + a * (outer - inner);
  };

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const halo = ";stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round;paint-order:stroke";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = halo) =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}${extra}">${text}</text>`;
  const sub = (base, s0) => `${base}<tspan dy='3' font-size='9'>${s0}</tspan>`;
  const bracket = (x, yA, yB) =>
    `<path d="M ${P(x)} ${P(yA)} V ${P(yB)} M ${P(x - 3)} ${P(yA)} h 6 M ${P(x - 3)} ${P(yB)} h 6" stroke="var(--fg)" stroke-width="1" fill="none"/>`;
  const NB = (x) => x.toFixed(2).replace(".", ",");
  const red = "var(--red)";
  const blue = "var(--indigo)";

  function render() {
    if (g.w < 120 || g.h < 120) return; // ikke lagt ut ennå
    const { bx0, bx1, xm, yTop, yBot } = g;
    const c = C();
    const ss = smooth(s);
    let svg = "";

    // Materialnavnene.
    svg +=
      tag((bx0 + xm) / 2, 16, "N⁺-AlGaAs", "middle", "var(--fg)") +
      tag((xm + bx1) / 2, 16, c.label, "middle", "var(--fg)");

    // Grenseflaten.
    svg += `<path d="M ${P(X(-1, 0))} ${P(yTop - 4)} V ${P(yBot)} M ${P(X(1, 0))} ${P(yTop - 4)} V ${P(yBot)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="2 4"/>`;

    const N = 90;
    const side = (sd, ec, off) => {
      let d = "";
      for (let i = 0; i <= N; i++) {
        const a = i / N;
        d += `${i ? "L" : "M"} ${P(X(sd, a))} ${P(yE(ec(a, s) + off))}`;
      }
      return d;
    };
    const back = (sd, ec, off) => {
      let d = "";
      for (let i = N; i >= 0; i--) {
        const a = i / N;
        d += ` L ${P(X(sd, a))} ${P(yE(ec(a, s) + off))}`;
      }
      return d;
    };
    const ec1s = (a) => ec1(a, ss);
    const ec2s = (a) => ec2(a, ss);
    // Gapet fylt, så båndene leses som bånd.
    svg += `<path d="${side(-1, ec1s, 0)}${back(-1, ec1s, -EG1)} Z" fill="var(--card-nested)"/>`;
    svg += `<path d="${side(1, ec2s, 0)}${back(1, ec2s, -EG2)} Z" fill="var(--card-nested)"/>`;
    // Vakuumnivået, trykket ned.
    svg +=
      `<path d="${side(-1, ec1s, DV)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>` +
      `<path d="${side(1, ec2s, DV + DEC)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`;
    // E_c og E_v.
    for (const [sd, ec, eg] of [
      [-1, ec1s, EG1],
      [1, ec2s, EG2],
    ]) {
      svg +=
        `<path d="${side(sd, ec, 0)}" stroke="var(--fg)" stroke-opacity="0.75" stroke-width="1.5" fill="none"/>` +
        `<path d="${side(sd, ec, -eg)}" stroke="var(--fg)" stroke-opacity="0.75" stroke-width="1.5" fill="none"/>`;
    }
    // Fermi-nivåene.
    const yF1 = yE(0);
    const yF2 = yE(ef2(ss));
    svg +=
      `<path d="M ${P(bx0)} ${P(yF1)} H ${P(X(-1, 0))}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      `<path d="M ${P(X(1, 0))} ${P(yF2)} H ${P(bx1)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;

    // Navnene på nivåene til høyre.
    const ecR = ec2(1, ss);
    svg +=
      tag(bx1 + 4, yE(ecR + DV + DEC) + 4, sub("E", "vac"), "start", "var(--muted)") +
      tag(bx1 + 4, yE(ecR) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(bx1 + 4, yF2 + (Math.abs(yF2 - yE(ecR)) < 12 ? 14 : 4), sub("E", "F"), "start", "var(--accent)") +
      tag(bx1 + 4, yE(ecR - EG2) + (c.carrier === "p" ? 14 : 4), sub("E", "v"), "start", "var(--fg)");

    // Båndgapene ytterst.
    const xg1 = bx0 + 8;
    const yc1 = yE(ec1(1, ss));
    const yv1 = yE(ec1(1, ss) - EG1);
    // Etiketten for AlGaAs flyttes bort fra etikettene for sprangene.
    const yDc = yE(ec2(0, ss)) + 14;
    const yDv = yE(ec2(0, ss) - EG2) - 7;
    const yG1 =
      [0.35, 0.2, 0.5, 0.65, 0.8]
        .map((f) => yc1 + f * (yv1 - yc1) + 4)
        .find((y) => Math.abs(y - yDc) > 16 && Math.abs(y - yDv) > 16) ?? yc1 + 0.35 * (yv1 - yc1) + 4;
    svg += bracket(xg1, yc1, yv1) + tag(xg1 + 6, yG1, "1,85 eV", "start", "var(--fg)");
    const xg2 = bx1 - 8;
    const yc2 = yE(ecR);
    const yv2 = yE(ecR - EG2);
    svg += bracket(xg2, yc2, yv2) + tag(xg2 - 6, yc2 + 0.35 * (yv2 - yc2) + 4, "1,43 eV", "end", "var(--fg)");

    // Sprangene ved grenseflaten.
    const xL = X(-1, 0);
    const xR = X(1, 0);
    const xs = (xL + xR) / 2;
    const ycA = yE(ec1(0, ss));
    const ycB = yE(ec2(0, ss));
    const yvA = yE(ec1(0, ss) - EG1);
    const yvB = yE(ec2(0, ss) - EG2);
    svg +=
      `<path d="M ${P(xL)} ${P(ycA)} H ${P(xR)} M ${P(xL)} ${P(ycB)} H ${P(xR)} M ${P(xL)} ${P(yvA)} H ${P(xR)} M ${P(xL)} ${P(yvB)} H ${P(xR)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>` +
      bracket(xs, ycA, ycB) +
      bracket(xs, yvA, yvB) +
      tag(xL - 6, yDc, `ΔE<tspan dy='3' font-size='9'>c</tspan><tspan dy='-3'> = ${NB(DEC)} eV</tspan>`, "end", "var(--fg)") +
      tag(xL - 6, yDv, `ΔE<tspan dy='3' font-size='9'>v</tspan><tspan dy='-3'> = ${NB(EG1 - EG2 - DEC)} eV</tspan>`, "end", "var(--fg)");

    // Bærerne.
    let el = "";
    let ho = "";
    // AlGaAs: elektroner i den nøytrale delen.
    const a0 = c.w1 * ss;
    for (const d of cloudL) {
      const a = a0 + 0.02 + d.a * (0.98 - a0 - 0.02);
      el += `<circle cx="${P(X(-1, a))}" cy="${P(yE(ec1(a, ss) + d.e) - R)}" r="${R}"/>`;
    }
    // GaAs: elektroner over E_c eller hull under E_v.
    const nR = Math.round(cloudR.length * c.nR);
    for (let i = 0; i < nR; i++) {
      const d = cloudR[i];
      if (c.carrier === "n") {
        const a = 0.25 + d.a * 0.73;
        el += `<circle cx="${P(X(1, a))}" cy="${P(yE(ec2(a, ss) + d.e) - R)}" r="${R}"/>`;
      } else {
        const b0 = c.w2 * ss;
        const a = b0 + 0.02 + d.a * (0.98 - b0 - 0.02);
        ho += `<circle cx="${P(X(1, a))}" cy="${P(yE(ec2(a, ss) - EG2 - d.e) + R)}" r="${R}"/>`;
      }
    }
    // Elektronene som flyttes fra den tømte delen av AlGaAs.
    for (const d of moveL) {
      const start = d.a * c.w1 * 0.95;
      let x;
      let y;
      let alpha = 1;
      if (ss < 0.5) {
        const a = start * (1 - 2 * ss);
        x = X(-1, a);
        y = yE(ec1(a, ss) + d.e) - R;
      } else if (c.carrier === "n") {
        const a = (2 * ss - 1) * (0.01 + d.a * (caseKey === "lett" ? 0.12 : 0.08));
        x = X(1, a);
        y = yE(ec2(a, ss) + d.e) - R;
      } else {
        x = X(-1, 0) - 2;
        y = yE(ec1(0, ss) + d.e) - R;
        alpha = clamp(1 - (ss - 0.5) / 0.25, 0, 1);
      }
      if (alpha > 0.01) el += `<circle cx="${P(x)}" cy="${P(y)}" r="${R}" fill-opacity="${P(alpha)}"/>`;
    }
    // Hullene som blir borte fra den tømte delen av p⁺-GaAs.
    if (c.carrier === "p") {
      for (const d of moveR) {
        const a = d.a * c.w2 * 0.95 * (1 - ss);
        const alpha = clamp(1 - (ss - 0.5) / 0.25, 0, 1);
        if (alpha > 0.01)
          ho += `<circle cx="${P(X(1, a))}" cy="${P(yE(ec2(a, ss) - EG2 - d.e) + R)}" r="${R}" fill-opacity="${P(alpha)}"/>`;
      }
    }
    svg += `<g style="fill:${blue}" fill-opacity="0.9">${el}</g><g style="fill:${red}" fill-opacity="0.9">${ho}</g>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
    last = now;
    if (hold > 0) hold -= dt;
    else s = sT > s ? Math.min(sT, s + dt / T_JOIN) : Math.max(sT, s - dt / T_JOIN);
    render();
    if (visible && (s !== sT || hold > 0)) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || (s === sT && hold <= 0)) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    },
    { threshold: 0.3 },
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
