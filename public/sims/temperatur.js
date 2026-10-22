/**
 * «Bærerne og temperaturen» for TFE4146, modul 02.
 *
 * Én idé: i et donordopet materiale har n₀(T) tre områder. Ved lav
 * temperatur sitter donorelektronene fast (ionisering), så kommer et platå der
 * n₀ = N_d, og når n_i(T) når opp mot N_d, tar de termiske parene over
 * (intrinsisk). Dopingen bestemmer høyden på platået, og gapet bestemmer hvor
 * det slutter. Innholdet er Streetman & Banerjee fig. 3–17 og 3–18 (§3.3.3).
 *
 * Tegnet mot T, ikke mot 1000/T: varmere mot høyre, og områdene kan leses
 * uten å tolke en resiprok akse. Konsentrasjonsaksen er logaritmisk.
 * Kurvene: n₀ (elektronene, blå), p₀ (hullene, rød) og n_i (stiplet).
 *
 * Modell (kvalitativ utenfor 300 K):
 *  - n_i(T) = n_i(300)·(T/300)^{3/2}·e^{−(E_g/2k)(1/T − 1/300)}, forankret i
 *    bokas verdier ved 300 K (fig. 3–17) og med fast gap.
 *  - Donorene: n_d+²/(N_d − n_d+) = (N_c/2)·e^{−ΔE_d/kT}, degenerasjon 2,
 *    N_c ∝ T^{3/2}.
 *  - Nøytralitet og massevirkningsloven syr områdene sammen:
 *    n₀ = N⁺/2 + √((N⁺/2)² + n_i²), p₀ = n_i²/n₀.
 *  Materialene: Si (1,11 eV, n_i 1,5·10¹⁰, N_c 2,9·10¹⁹, P 45 meV),
 *  Ge (0,67 eV, 2,5·10¹³, 1,04·10¹⁹, P 12 meV), GaAs (1,43 eV, 2·10⁶,
 *  4,7·10¹⁷, Si 5,8 meV).
 *  Overgangene (90 % ionisert, 10 % over N_d), fra temp.mjs: Si 10¹⁵ 92 K
 *  og 524 K; Si 10¹⁶ 133 og 628 K; Si 10¹⁴ 69 og 449 K; Ge 10¹⁵ 41 og 365 K;
 *  GaAs 10¹⁵ 65 K og 812 K (utenfor aksen).
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const KB = 8.617e-5; // eV/K
const MATS = {
  Si: { label: "Si", Eg: 1.11, ni300: 1.5e10, Nc300: 2.9e19, Ed: 0.045 },
  Ge: { label: "Ge", Eg: 0.67, ni300: 2.5e13, Nc300: 1.04e19, Ed: 0.012 },
  GaAs: { label: "GaAs", Eg: 1.43, ni300: 2e6, Nc300: 4.7e17, Ed: 0.0058 },
};
const DOPS = [14, 15, 16];
const TMAX = 700;
const YMIN = 11; // log10 cm⁻³
const YMAX = 18;

const ni = (m, T) => m.ni300 * (T / 300) ** 1.5 * Math.exp(-(m.Eg / (2 * KB)) * (1 / T - 1 / 300));
function conc(m, Nd, T) {
  const a = ((m.Nc300 * (T / 300) ** 1.5) / 2) * Math.exp(-m.Ed / (KB * T));
  const nd = (-a + Math.sqrt(a * a + 4 * a * Nd)) / 2; // ioniserte donorer uten egenledning
  const i = ni(m, T);
  const n = nd / 2 + Math.sqrt((nd / 2) ** 2 + i * i);
  return { n, p: (i * i) / n, i };
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  let mat = "Si";
  let dexp = 15;

  const matPick = choiceRow({
    ariaLabel: "Materiale",
    label: "Materiale",
    items: Object.keys(MATS).map((k) => ({ value: k, label: MATS[k].label })),
    onPick: (k) => {
      mat = k;
      changed();
    },
    signal,
  });
  const dopPick = choiceRow({
    ariaLabel: "Donortetthet",
    label: "Donorer per cm³",
    items: DOPS.map((e) => ({ value: String(e), label: `10${sup(e)}` })),
    onPick: (k) => {
      dexp = Number(k);
      changed();
    },
    signal,
  });
  controls.append(matPick.el, dopPick.el);

  function sync() {
    matPick.sync(mat);
    dopPick.sync(String(dexp));
  }
  function changed() {
    sync();
    render();
  }

  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}" paint-order="stroke" stroke="var(--canvas-bg)" stroke-width="3">${text}</text>`;

  function render() {
    const { w, h } = getSize();
    if (w < 200 || h < 200) return;
    const m = MATS[mat];
    const Nd = 10 ** dexp;

    const x0 = 46;
    const x1 = w - 14;
    const y0 = 22; // toppen av plottet
    const y1 = h - 34; // aksen
    const X = (T) => x0 + ((x1 - x0) * T) / TMAX;
    const Y = (lg) => y1 - ((y1 - y0) * (lg - YMIN)) / (YMAX - YMIN);
    const Yc = (c) => Y(Math.max(YMIN - 1, Math.min(YMAX + 1, Math.log10(c))));

    // Kurvene og overgangene.
    const pts = [];
    let tIon = null;
    let tInt = null;
    for (let T = 6; T <= TMAX; T += 2) {
      const c = conc(m, Nd, T);
      pts.push([T, c]);
      if (tIon === null && c.n > 0.9 * Nd) tIon = T;
      if (tInt === null && c.n > 1.1 * Nd) tInt = T;
    }
    const line = (get) =>
      pts
        .map(([T, c], i) => `${i ? "L" : "M"} ${P(X(T))} ${P(Yc(get(c)))}`)
        .join(" ");

    let s = "";
    // Områdene.
    const band = (ta, tb, label) => {
      const xa = X(ta);
      const xb = X(tb);
      if (xb - xa < 2) return "";
      let out = `<rect x="${P(xa)}" y="${P(y0)}" width="${P(xb - xa)}" height="${P(y1 - y0)}" style="fill:var(--border)" opacity="0.35"/>`;
      if (xb - xa > 76) out += tag((xa + xb) / 2, y0 + 14, label, "middle", "var(--fg)");
      else if (xb - xa > 14)
        out += `<text transform="translate(${P((xa + xb) / 2 + 4)} ${P(y0 + 8)}) rotate(90)" text-anchor="start" style="fill:var(--fg);font-family:var(--font-mono);font-size:11px">${label}</text>`;
      return out;
    };
    if (tIon) s += band(0, tIon, "ionisering");
    if (tInt) s += band(tInt, TMAX, "intrinsisk");
    // Akser og rutenett.
    let grid = "";
    for (let lg = YMIN; lg <= YMAX; lg++) {
      grid += `M ${P(x0)} ${P(Y(lg))} H ${P(x1)} `;
      if (lg % 2 === 0) s += tag(x0 - 6, Y(lg) + 4, `10${sup(lg)}`, "end");
    }
    s += `<path d="${grid}" stroke="var(--border)" stroke-width="1"/>`;
    s += `<path d="M ${P(x0)} ${P(y0)} V ${P(y1)} H ${P(x1)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
    for (let T = 0; T <= TMAX; T += 100) {
      s += `<path d="M ${P(X(T))} ${P(y1)} v 4" stroke="var(--border-strong)"/>`;
      if (T % 200 === 0 || w > 520) s += tag(X(T), y1 + 16, String(T), "middle");
    }
    s += tag(x1, y1 + 29, "T (K)", "end");
    s += tag(x0 - 6, y0 - 8, "cm⁻³", "end");
    // Romtemperatur.
    s +=
      `<path d="M ${P(X(300))} ${P(y0)} V ${P(y1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>`;
    // N_d som en tynn referanselinje.
    s += `<path d="M ${P(x0)} ${P(Y(dexp))} H ${P(x1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="6 4" opacity="0.6"/>`;
    // Kurvene: n_i stiplet, p₀ og n₀ heltrukne, klippet til plottet.
    s += `<clipPath id="tp-clip"><rect x="${P(x0)}" y="${P(y0)}" width="${P(x1 - x0)}" height="${P(y1 - y0)}"/></clipPath><g clip-path="url(#tp-clip)">`;
    s += `<path d="${line((c) => c.i)}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    s += `<path d="${line((c) => c.p)}" fill="none" stroke="var(--red)" stroke-width="2"/>`;
    s += `<path d="${line((c) => c.n)}" fill="none" stroke="var(--indigo)" stroke-width="2.6"/>`;
    s += "</g>";
    // Etiketter på kurvene.
    const mid = tIon && tInt ? (tIon + Math.min(tInt, TMAX)) / 2 : 300;
    s += tag(X(Math.min(mid, 480)), Y(dexp) - 11, "n₀ = N<tspan baseline-shift=\"sub\" style=\"font-size:8px\">d</tspan>", "middle", "var(--indigo)");
    // n_i og p₀ merket der de krysser 10¹³: n_i til venstre for sin kurve, p₀ til høyre.
    const crossAt = (get, lg) => {
      for (const [T, c] of pts) if (Math.log10(get(c)) >= lg) return T;
      return null;
    };
    const Ti = crossAt((c) => c.i, 13);
    const Tp = crossAt((c) => c.p, 13);
    if (Ti) s += tag(X(Ti) - 7, Y(13) + 4, "n<tspan baseline-shift=\"sub\" style=\"font-size:8px\">i</tspan>", "end");
    if (Tp) s += tag(X(Tp) + 7, Y(13) + 4, "p₀", "start", "var(--red)");
    else {
      // p₀ når ikke 10¹³ innenfor aksen: merk den der den kommer inn nedenfra.
      const inside = pts.filter(([, c]) => Math.log10(c.p) > YMIN + 0.4);
      if (inside.length) {
        const [T, c] = inside[Math.floor(inside.length / 2)];
        s += tag(X(T) - 7, Y(Math.log10(c.p)) + 4, "p₀", "end", "var(--red)");
      }
    }
    s += tag(X(300) + 4, y0 + 32, "300 K", "start");

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      s +
      `</svg>`;
  }

  sync();
  onResize(render);
  render();
}

function sup(n) {
  const d = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(n)
    .split("")
    .map((c) => d[Number(c)])
    .join("");
}
