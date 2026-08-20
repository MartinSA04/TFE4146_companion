/**
 * «Fulle bånd leder ikke» for TFE4146, modul 01.
 *
 * Ett båndskjema med valgbart materiale og temperatur. Poenget er ikke å telle
 * bærere presist, men å gjøre to ting synlige på én gang: at ledning krever
 * LEDIGE tilstander (metallet leder ved 0 K, halvlederen gjør det ikke), og at
 * forskjellen mellom halvleder og isolator bare er størrelsen på gapet.
 *
 * Gaphøyden i tegningen skalerer med E_g, så diamant ser ut som det den er.
 * Antall tegnede par følger log10 av Boltzmann-faktoren e^(-Eg/2kT) — bildet
 * kan umulig være i skala (Si ved 300 K har ett par per 5×10^12 atomer:
 * 5×10^22 atomer/cm³ mot n_i = 10^10 cm⁻³), så
 * utlesningen bærer de faktiske tallene og tegningen bærer retningen.
 *
 * Alle båndgap er hentet fra Streetman & Banerjee §3.1: Si ≈ 1,1 eV,
 * GaAs = 1,43 eV, diamant ≈ 5 eV.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const KB = 8.617e-5; // eV/K

const MATERIALS = [
  { key: "metall", label: "Metall", eg: null },
  { key: "si", label: "Si (1,1 eV)", eg: 1.1 },
  { key: "gaas", label: "GaAs (1,43 eV)", eg: 1.43 },
  { key: "diamant", label: "Diamant (5 eV)", eg: 5.0 },
];

const COLS = 12; // tilstander per rad
const ROWS = 3; // rader per bånd

export default function init({ stage, controls, getSize, onResize, signal }) {
  let mat = "si";
  let temp = 300;

  const matPick = choiceRow({
    ariaLabel: "Velg materiale",
    items: MATERIALS.map((m) => ({ value: m.key, label: m.label })),
    onPick: (k) => {
      mat = k;
      sync();
      render();
    },
    signal,
  });

  const label = document.createElement("label");
  label.append("Temperatur ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "600";
  input.step = "10";
  input.value = String(temp);
  input.setAttribute("aria-label", "Temperatur i kelvin");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      temp = Number(input.value);
      sync();
      render();
    },
    { signal },
  );

  const readout = document.createElement("div");
  readout.className = "sim-readout";

  controls.append(matPick.el, label, readout);

  const current = () => MATERIALS.find((m) => m.key === mat);

  function sync() {
    const m = current();
    // Temperaturen gjør ingenting i metallet: båndet er delvis fylt uansett.
    input.disabled = m.eg === null;
    label.style.opacity = m.eg === null ? "0.45" : "1";
    out.textContent = `${temp} K`;
    matPick.sync(mat);
  }

  /** Boltzmann-faktoren som styrer hvor mange par som finnes. 0 ved T = 0. */
  function factor(eg) {
    if (temp <= 0) return 0;
    return Math.exp(-eg / (2 * KB * temp));
  }

  /** Tegnede par: log10(faktor) mappet til 0–6 prikker. Ikke i skala — se filhodet. */
  function pairs(eg) {
    const f = factor(eg);
    if (f === 0) return 0;
    const decades = Math.log10(f);
    return Math.max(0, Math.min(6, Math.round(((decades + 12) / 12) * 6)));
  }

  const P = (n) => n.toFixed(1);

  function render() {
    const { w, h } = getSize();
    const m = current();

    const padL = 34;
    const padR = 10;
    const padT = 10;
    const padB = 30; // plass til bunnteksten
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    // Gaphøyden skalerer med E_g, så isolatoren ser ut som en isolator.
    const gapFrac = m.eg === null ? 0 : Math.min(0.62, m.eg / 8);
    const bandH = m.eg === null ? ph * 0.62 : (ph * (1 - gapFrac)) / 2;
    const gapH = ph - (m.eg === null ? bandH : 2 * bandH);

    const cbY = padT + (m.eg === null ? (ph - bandH) / 2 : 0);
    const vbY = padT + bandH + gapH;

    const bandBox = (y, hh) =>
      `<rect x="${P(padL)}" y="${P(y)}" width="${P(pw)}" height="${P(hh)}" rx="5" fill="var(--card-nested)" stroke="var(--border)" stroke-width="1"/>`;

    /**
     * Tilstander som prikker. `state(i, row)` gir "full" | "tom" | "hull";
     * tomme tilstander tegnes som blek ring, så «ledig plass» er synlig og
     * ikke bare fravær, mens hullet får sin egen farge — det er en bærer.
     */
    function states(y, hh, state, color) {
      let s = "";
      const dx = pw / (COLS + 1);
      const dy = hh / (ROWS + 1);
      const r = Math.max(3, Math.min(5.5, dx / 3.2));
      for (let row = 0; row < ROWS; row++) {
        for (let i = 0; i < COLS; i++) {
          const cx = padL + (i + 1) * dx;
          const cy = y + (row + 1) * dy;
          const k = state(i, row);
          s +=
            k === "full"
              ? `<circle cx="${P(cx)}" cy="${P(cy)}" r="${r}" style="fill:${color}"/>`
              : k === "hull"
                ? `<circle cx="${P(cx)}" cy="${P(cy)}" r="${r}" fill="none" stroke="var(--red)" stroke-width="2"/>`
                : `<circle cx="${P(cx)}" cy="${P(cy)}" r="${r - 0.5}" fill="none" stroke="var(--border-strong)" stroke-width="1.2"/>`;
        }
      }
      return s;
    }

    const axis =
      `<text x="12" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Elektronenergi</text>` +
      `<path d="M 22 ${P(padT + ph)} V ${P(padT)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M 22 ${P(padT)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>`;

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;

    let body;
    let caption;

    if (m.eg === null) {
      // Metall: ett delvis fylt bånd. Elektroner og ledige tilstander ligger
      // blandet, så feltet har alltid et sted å akselerere dem til.
      const half = Math.floor((COLS * ROWS) / 2);
      body =
        bandBox(cbY, bandH) +
        states(
          cbY,
          bandH,
          (i, row) => (row * COLS + i >= COLS * ROWS - half ? "full" : "tom"),
          "var(--accent)",
        ) +
        tag(padL + 8, cbY + 15, "Delvis fylt bånd — båndene overlapper");
      caption =
        "Elektroner og ledige tilstander i samme bånd — leder ved enhver temperatur.";
    } else {
      const np = pairs(m.eg);
      // Elektronene fyller fra bunnen av ledningsbåndet, hullene lages på
      // toppen av valensbåndet: begge bærere søker sin laveste energi.
      const inCB = (i, row) =>
        row === ROWS - 1 && i < np ? "full" : "tom";
      const inVB = (i, row) => (row === 0 && i < np ? "hull" : "full");

      body =
        bandBox(cbY, bandH) +
        states(cbY, bandH, inCB, "var(--accent)") +
        bandBox(vbY, bandH) +
        states(vbY, bandH, inVB, "var(--fg)") +
        // Gap-pilen mellom Ev og Ec.
        `<path d="M ${P(padL + pw / 2)} ${P(cbY + bandH + 3)} V ${P(vbY - 3)}" stroke="var(--border-strong)" stroke-width="1"/>` +
        `<path d="M ${P(padL + pw / 2)} ${P(cbY + bandH + 3)} l -3.5 6 h 7 z" style="fill:var(--border-strong)"/>` +
        `<path d="M ${P(padL + pw / 2)} ${P(vbY - 3)} l -3.5 -6 h 7 z" style="fill:var(--border-strong)"/>` +
        `<text x="${P(padL + pw / 2 + 10)}" y="${P((cbY + bandH + vbY) / 2 + 4)}" style="fill:var(--fg);font-family:var(--font-mono);font-size:12px">E<tspan dy="3" font-size="9">g</tspan><tspan dy="-3"> = ${String(m.eg).replace(".", ",")} eV</tspan></text>` +
        tag(padL + 8, cbY + 15, "Ledningsbånd") +
        tag(padL + 8, vbY + bandH - 8, "Valensbånd");

      caption =
        np === 0
          ? "Ingen par: begge bånd er «rene», og materialet leder ikke."
          : `${np} elektron–hull-par tegnet — ikke i skala`;
    }

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      axis +
      body +
      `<text x="${P(padL + pw / 2)}" y="${P(h - 8)}" text-anchor="middle" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">${caption}</text>` +
      `</svg>`;

    readout.innerHTML = describe();
  }

  function describe() {
    const m = current();
    if (m.eg === null)
      return "Båndene <b>overlapper</b>, så elektroner og ledige tilstander ligger blandet. Et elektron har alltid en ny tilstand å akselereres inn i — metallet leder også ved 0 K, uten et eneste eksitert par.";

    if (temp <= 0)
      return "Ved <b>0 K</b> er valensbåndet nøyaktig fullt og ledningsbåndet nøyaktig tomt. Ingen av dem fører strøm: det ene mangler ledige tilstander, det andre mangler elektroner. Halvleder og isolator er umulige å skille her.";

    const f = factor(m.eg);
    const dec = Math.log10(f);
    const kT = (KB * temp * 1000).toFixed(1).replace(".", ",");
    const exp = dec.toFixed(1).replace(".", ",");
    const tail =
      dec < -20
        ? "Det er null i praksis — dette er en <b>isolator</b>, av samme grunn som halvlederen ikke er det: gapet står i eksponenten."
        : dec < -8
          ? "Få, men ikke null — og antallet dobles for hver lille økning i temperatur. Det er denne følsomheten som gjør halvledere styrbare."
          : "Mange par: den termiske energien begynner å bli sammenlignbar med gapet.";

    return `Ved <b>${temp} K</b> er <i>kT</i> = ${kT} meV, og <i>e</i><sup>−E<sub>g</sub>/2kT</sup> ≈ 10<sup>${exp}</sup>. ${tail}`;
  }

  sync();
  onResize(render);
  render();
}
