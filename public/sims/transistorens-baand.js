/**
 * «Båndene og minoritetsbærerne» for TFE4146, bipolartransistoren.
 *
 * Én idé: spenningen over hver overgang setter overskuddet av hull ved sin kant av basen,
 * Δp = p_n(e^{qV/k_BT} − 1), akkurat som i en diode. Hullprofilen i basen er linjen mellom de
 * to kantverdiene (med en liten nedbøyning når basen ikke er mye kortere enn L_p), og
 * stigningen ved hver kant er strømmen der. Fortegnet til de to spenningene gir de fire
 * modusene. Båndskjemaet viser den samme tilstanden: barrieren ved hver overgang er
 * q(V₀ − V), og kvasi-Fermi-nivåene følger bærerkonsentrasjonene. Streetman & Banerjee
 * §7.4–7.5.1, fig. 7–6, 7–7 og 7–9.
 *
 * Øverst står båndskjemaet med E_c, E_v, F_n (blå, stiplet) og F_p (rød, stiplet), i skala
 * for energiene. Under står minoritetsbærerne: elektronene i emitteren, hullene i basen og
 * elektronene i kollektoren, hver med sin egen konsentrasjonsskala, og likevektsverdiene
 * stiplet. I basen er normalkomponenten og inverskomponenten av profilen stiplet når begge
 * kantene har et overskudd. Pilene over basen er hullstrømmen ved emitterkanten og ved
 * kollektorkanten, i forhold til den største av dem.
 *
 * Modellen er transistoren i modulen: p⁺-emitter 10¹⁹, n-base 10¹⁷, p-kollektor 10¹⁵ cm⁻³,
 * n_i = 1,5·10¹⁰ cm⁻³, k_BT = 0,0259 eV, E_g = 1,12 eV med E_i midt i gapet. Profilen er den
 * eksakte løsningen av diffusjonsligningen i basen med W_b/L_p = 0,057 (smal base) eller 1,05
 * (bred base). I emitteren og kollektoren faller overskuddet eksponentielt fra kanten.
 * Bredden av de nøytrale områdene og sonene er ikke i skala.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const KT = 0.0259;
const EG = 1.12;
const NI = 1.5e10;
const NE = 1e19;
const NB = 1e17;
const NC = 1e15;
const PN = (NI * NI) / NB;
const NPE = (NI * NI) / NE;
const NPC = (NI * NI) / NC;
const PHI_E = KT * Math.log(NE / NI); // E_i − F i emitteren
const PHI_B = KT * Math.log(NB / NI); // F − E_i i basen
const PHI_C = KT * Math.log(NC / NI); // E_i − F i kollektoren
const WBL = { narrow: 0.0567, wide: 1.05 };
// Plassene langs staven (ikke i skala).
const XE1 = 0.24; // slutten av den nøytrale emitteren
const XB0BASE = 0.3; // starten av den nøytrale basen ved V_EB = 0
const ZEB0 = XB0BASE - XE1;
const ZBC0 = 0.06;
const LE = 0.32; // diffusjonslengden i emitteren, i andeler av emitteren
const LC = 0.3; // og i kollektoren
const E_TOP = 1.95;
const E_BOT = -1.05;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let veb = 0.6;
  let vcb = -0.5;
  let base = "narrow";
  let XB1 = 0.52; // slutten av den nøytrale basen, 0,66 med bred base

  // ── kontroller ────────────────────────────────────────────────────────────
  const NBf = (x) => (Math.abs(x) < 1e-9 ? "0" : x.toFixed(2).replace(".", ",").replace("-", "−"));
  function slider(html, aria, min, max, step, value, set) {
    const label = document.createElement("label");
    const name = document.createElement("span");
    name.innerHTML = html + " ";
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(name, out, input);
    out.textContent = `${NBf(value)} V`;
    input.addEventListener(
      "input",
      () => {
        const v = Math.round(Number(input.value) * 100) / 100;
        set(v);
        out.textContent = `${NBf(v)} V`;
        render();
      },
      { signal },
    );
    return label;
  }
  const sE = slider("V<sub>EB</sub>", "Spenningen over emitterovergangen, positiv i lederetningen", -0.4, 0.7, 0.01, veb, (v) => (veb = v));
  const sC = slider("V<sub>CB</sub>", "Spenningen over kollektorovergangen, positiv i lederetningen", -0.8, 0.6, 0.01, vcb, (v) => (vcb = v));
  const baseRow = choiceRow({
    ariaLabel: "Basen",
    items: [
      { value: "narrow", label: "Smal base" },
      { value: "wide", label: "Bred base" },
    ],
    onPick: (v) => {
      base = v;
      XB1 = v === "wide" ? 0.66 : 0.52;
      baseRow.sync(base);
      render();
    },
    signal,
  });
  baseRow.sync(base);
  controls.append(sE, sC, baseRow.el);

  // ── fysikken ──────────────────────────────────────────────────────────────
  const ex = (v) => Math.exp(v / KT) - 1;
  function state() {
    const y = WBL[base];
    const dpE = PN * ex(veb);
    const dpC = PN * ex(vcb);
    const sh = Math.sinh(y);
    // δp(u), u = x/W_b, eksakt: [Δp_E sinh(y(1−u)) + Δp_C sinh(yu)]/sinh y
    const dp = (u) => (dpE * Math.sinh(y * (1 - u)) + dpC * Math.sinh(y * u)) / sh;
    const dpN = (u) => (dpE * Math.sinh(y * (1 - u))) / sh;
    const dpI = (u) => (dpC * Math.sinh(y * u)) / sh;
    const ct = 1 / Math.tanh(y);
    const cs = 1 / sh;
    const iE = dpE * ct - dpC * cs; // i enheter av qAD_p/L_p
    const iC = dpE * cs - dpC * ct;
    // Sonene, ikke i skala: bredden går som √(V₀ − V).
    const zEB = ZEB0 * Math.sqrt(Math.max(0.04, 0.933 - veb) / 0.933);
    const zBC = ZBC0 * Math.sqrt(Math.max(0.04, 0.695 - vcb) / 0.695);
    const xB0 = XE1 + zEB;
    const xC0 = XB1 + zBC;
    return { y, dpE, dpC, dp, dpN, dpI, iE, iC, xB0, xC0 };
  }
  function mode() {
    const fE = veb > 0;
    const fC = vcb > 0;
    if (Math.abs(veb) < 1e-9 && Math.abs(vcb) < 1e-9) return "likevekt";
    if (fE && !fC) return "normal modus";
    if (fE && fC) return "metning";
    if (!fE && fC) return "invers modus";
    return "sperring";
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 300) return null;
    const bx0 = 8;
    const bx1 = w - 34;
    const ey0 = 34;
    const ey1 = Math.round(h * 0.56);
    const py0 = ey1 + 46;
    const py1 = h - 22;
    return { w, h, bx0, bx1, len: bx1 - bx0, ey0, ey1, py0, py1 };
  }
  const X = (x) => G.bx0 + x * G.len;
  const yE = (E) => G.ey0 + ((E_TOP - E) / (E_TOP - E_BOT)) * (G.ey1 - G.ey0);
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px;stroke-linejoin:round";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  /** E_i langs staven, med to parabler i hver sone. */
  function eiOf(S) {
    const eiE = -veb + PHI_E;
    const eiB = -PHI_B;
    const eiC = -vcb + PHI_C;
    // Andelen av sonen på den svakest dopede siden.
    const fEB = NE / (NE + NB); // i basen
    const fBC = NB / (NB + NC); // i kollektoren
    const zone = (x, x0, x1, eL, eR, fR) => {
      const w = x1 - x0;
      const xs = x0 + (1 - fR) * w; // overgangen
      const d = eL - eR;
      if (x <= xs) {
        const u = (x - x0) / Math.max(1e-6, xs - x0);
        return eL - d * (1 - fR) * u * u;
      }
      const u = (x1 - x) / Math.max(1e-6, x1 - xs);
      return eR + d * fR * u * u;
    };
    return (x) => {
      if (x <= XE1) return eiE;
      if (x < S.xB0) return zone(x, XE1, S.xB0, eiE, eiB, fEB);
      if (x <= XB1) return eiB;
      if (x < S.xC0) return zone(x, XB1, S.xC0, eiB, eiC, fBC);
      return eiC;
    };
  }

  function bands(S) {
    const ei = eiOf(S);
    let s = "";
    const { bx0, bx1, ey0, ey1 } = G;
    // Sonene tonet.
    s += `<rect x="${P(X(XE1))}" y="${P(ey0 - 14)}" width="${P(X(S.xB0) - X(XE1))}" height="${P(G.py1 - ey0 + 14)}" style="fill:var(--accent)" fill-opacity="0.09"/>`;
    s += `<rect x="${P(X(XB1))}" y="${P(ey0 - 14)}" width="${P(X(S.xC0) - X(XB1))}" height="${P(G.py1 - ey0 + 14)}" style="fill:var(--accent)" fill-opacity="0.09"/>`;
    // Grensen mellom lagene i hver sone, prikket.
    const jEB = XE1 + (NB / (NE + NB)) * (S.xB0 - XE1);
    const jBC = XB1 + (NC / (NB + NC)) * (S.xC0 - XB1);
    s += `<path d="M ${P(X(jEB))} ${P(ey0 - 14)} V ${P(G.py1)} M ${P(X(jBC))} ${P(ey0 - 14)} V ${P(G.py1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="1 3"/>`;
    // Områdenavnene.
    s += tag(X(XE1 / 2), ey0 - 20, "emitter", "middle", "var(--fg)");
    s += tag(X((S.xB0 + XB1) / 2), ey0 - 20, "base", "middle", "var(--fg)");
    s += tag(X((S.xC0 + 1) / 2), ey0 - 20, "kollektor", "middle", "var(--fg)");
    // E_c og E_v.
    const N = 220;
    let pc = "";
    let pv = "";
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      const e = ei(x);
      pc += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(e + EG / 2))} `;
      pv += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(e - EG / 2))} `;
    }
    s += `<path d="${pc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/><path d="${pv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    // Kvasi-Fermi-nivåene fra konsentrasjonene.
    const clampE = (e) => Math.max(E_BOT + 0.02, Math.min(E_TOP - 0.02, e));
    const nE = (x) => NPE * (1 + ex(veb) * Math.exp(-(XE1 - x) / (LE * XE1)));
    const nC = (x) => NPC * (1 + ex(vcb) * Math.exp(-(x - S.xC0) / (LC * (1 - S.xC0))));
    const pB = (x) => PN + S.dp((x - S.xB0) / (XB1 - S.xB0));
    let fn = "";
    let fp = "";
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      let Fn;
      let Fp;
      if (x <= XE1) {
        Fp = -veb;
        Fn = ei(x) + KT * Math.log(nE(x) / NI);
      } else if (x < S.xB0) {
        Fp = -veb;
        Fn = 0;
      } else if (x <= XB1) {
        Fn = 0;
        Fp = ei(x) - KT * Math.log(Math.max(1e-30, pB(x)) / NI);
      } else if (x < S.xC0) {
        Fn = 0;
        Fp = -vcb;
      } else {
        Fp = -vcb;
        Fn = ei(x) + KT * Math.log(Math.max(1e-30, nC(x)) / NI);
      }
      fn += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(clampE(Fn)))} `;
      fp += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(clampE(Fp)))} `;
    }
    const eq = Math.abs(veb) < 1e-9 && Math.abs(vcb) < 1e-9;
    s += `<path d="${fp}" fill="none" style="stroke:var(--red)" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    s += `<path d="${fn}" fill="none" style="stroke:var(--indigo)" stroke-width="1.4" stroke-dasharray="5 3"${eq ? ' stroke-dashoffset="4"' : ""}/>`;
    // Merkene til høyre.
    const xr = bx1 + 4;
    const eiC = ei(1);
    s += tag(xr, yE(eiC + EG / 2) + 4, sub("E", "c"), "start", "var(--fg)") + tag(xr, yE(eiC - EG / 2) + 4, sub("E", "v"), "start", "var(--fg)");
    if (eq) s += tag(X((S.xB0 + XB1) / 2), yE(0) + 13, sub("E", "F"), "middle", "var(--accent)", halo);
    else {
      s += tag(X(S.xB0 + 0.02), yE(0) + 13, sub("F", "n"), "start", "var(--indigo)", halo);
      const fpY = Math.min(yE(clampE(-veb)) + 13, ey1 - 2);
      s += tag(X(0.02), fpY, sub("F", "p"), "start", "var(--red)", halo);
    }
    // Modusen øverst til venstre i båndskjemaet.
    void bx0;
    s += tag(X(0.01), ey0 + 4, mode(), "start", "var(--accent)", ";font-weight:600" + halo);
    return s;
  }

  function profiles(S) {
    const { py0, py1 } = G;
    const H = py1 - py0;
    let s = "";
    // Grunnlinjene og skillene.
    s += `<path d="M ${P(X(0))} ${P(py1)} H ${P(X(1))}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    const area = (pts, color) => {
      let d = `M ${P(pts[0][0])} ${P(py1)} `;
      for (const [x, y] of pts) d += `L ${P(x)} ${P(y)} `;
      d += `L ${P(pts[pts.length - 1][0])} ${P(py1)} Z`;
      let l = "";
      pts.forEach(([x, y], i) => (l += `${i ? "L" : "M"} ${P(x)} ${P(y)} `));
      return `<path d="${d}" style="fill:${color}" fill-opacity="0.16"/><path d="${l}" fill="none" style="stroke:${color}" stroke-width="1.8" stroke-linejoin="round"/>`;
    };
    const N = 80;
    // Emitteren: elektroner.
    {
      const f = (x) => NPE * (1 + ex(veb) * Math.exp(-(XE1 - x) / (LE * XE1)));
      const max = Math.max(NPE, f(XE1)) / 0.86;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = (XE1 * i) / N;
        pts.push([X(x), py1 - (f(x) / max) * H]);
      }
      s += area(pts, "var(--indigo)");
      const yq = py1 - (NPE / max) * H;
      s += `<path d="M ${P(X(0))} ${P(yq)} H ${P(X(XE1))}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      s += tag(X(0.01), Math.min(yq - 4, py1 - 4), sub("n", "p"), "start", "var(--fg)", it + halo);
    }
    // Basen: hull.
    {
      const w = XB1 - S.xB0;
      const p = (u) => PN + S.dp(u);
      let max = PN;
      for (let i = 0; i <= N; i++) max = Math.max(max, p(i / N));
      max /= 0.86;
      const pts = [];
      for (let i = 0; i <= N; i++) pts.push([X(S.xB0 + (w * i) / N), py1 - (Math.max(0, p(i / N)) / max) * H]);
      s += area(pts, "var(--red)");
      const yq = py1 - (PN / max) * H;
      s += `<path d="M ${P(X(S.xB0))} ${P(yq)} H ${P(X(XB1))}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      // Normal- og inverskomponenten når begge kantene har et overskudd som synes (metning).
      const big = (d) => d > 0.06 * max;
      if (big(S.dpE) && big(S.dpC)) {
        let dn = "";
        let di = "";
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const x = X(S.xB0 + w * u);
          dn += `${i ? "L" : "M"} ${P(x)} ${P(yq - (S.dpN(u) / max) * H)} `;
          di += `${i ? "L" : "M"} ${P(x)} ${P(yq - (S.dpI(u) / max) * H)} `;
        }
        s += `<path d="${dn}${di}" fill="none" style="stroke:var(--red)" stroke-width="1.1" stroke-dasharray="2 3" opacity="0.85"/>`;
      }
      const yl = Math.max(py0 + 10, Math.min(yq - 4, py1 - 4));
      s += tag(X((S.xB0 + XB1) / 2), yl, sub("p", "n"), "middle", "var(--fg)", it + halo);
      // Δp_E og Δp_C ved kantene når de er positive og store nok.
      if (S.dpE > 0.12 * max) s += tag(X(S.xB0) + 3, py1 - ((PN + S.dpE) / max) * H - 4, `Δ${sub("p", "E")}`, "start", "var(--fg)", it + halo);
      if (S.dpC > 0.12 * max) s += tag(X(XB1) - 3, py1 - ((PN + S.dpC) / max) * H - 4, `Δ${sub("p", "C")}`, "end", "var(--fg)", it + halo);
    }
    // Kollektoren: elektroner.
    {
      const span = 1 - S.xC0;
      const f = (x) => NPC * (1 + ex(vcb) * Math.exp(-(x - S.xC0) / (LC * span)));
      const max = Math.max(NPC, f(S.xC0)) / 0.86;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = S.xC0 + (span * i) / N;
        pts.push([X(x), py1 - (Math.max(0, f(x)) / max) * H]);
      }
      s += area(pts, "var(--indigo)");
      const yq = py1 - (NPC / max) * H;
      s += `<path d="M ${P(X(S.xC0))} ${P(yq)} H ${P(X(1))}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      s += tag(X(1) - 2, Math.min(yq - 4, py1 - 4), sub("n", "p"), "end", "var(--fg)", it + halo);
    }
    // Hullstrømmen ved kantene av basen.
    // Skalaen er strømmen når bare den ene kanten har overskudd, så metningen synes som kortere piler.
    // Under 0,3 V i lederetning på begge overgangene er skalaen fast, så sperrestrømmene blir null.
    const m = Math.max(Math.abs(S.dpE), Math.abs(S.dpC), PN * Math.exp(0.3 / KT)) / Math.tanh(S.y);
    const ya = py0 - 16;
    // Pilene står en firedel inn fra hver kant av basen, og er aldri lengre enn at de holder avstand.
    const Lmax = Math.min(34, (X(XB1) - X(S.xB0)) / 2 - 12);
    const arrow = (xc, i, name) => {
      const L = Lmax * (Math.abs(i) / m);
      if (L < 3) return tag(xc, ya + 4, "0", "middle", "var(--muted)");
      const dir = i > 0 ? 1 : -1;
      const x0 = xc - (dir * L) / 2;
      const x1 = xc + (dir * L) / 2;
      return (
        `<path d="M ${P(x0)} ${P(ya)} H ${P(x1)} M ${P(x1 - dir * 5)} ${P(ya - 4)} L ${P(x1)} ${P(ya)} L ${P(x1 - dir * 5)} ${P(ya + 4)}" fill="none" style="stroke:var(--red)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        tag(xc, ya - 8, name, "middle", "var(--fg)", it + halo)
      );
    };
    const q4 = (X(XB1) - X(S.xB0)) / 4;
    s += arrow(X(S.xB0) + q4, S.iE, sub("I", "Ep"));
    s += arrow(X(XB1) - q4, S.iC, sub("I", "C"));
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    const S = state();
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${bands(S)}${profiles(S)}</svg>`;
  }
  onResize(() => render());
  render();
}
