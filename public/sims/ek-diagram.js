/**
 * E–k-diagrammet for TFE4146, modul 01.
 *
 * To parabler i ekte enheter: E i eV, k i Å⁻¹. Den ene slideren flytter
 * ledningsbåndminimet i k (direkte ↔ indirekte), den andre endrer krumningen.
 *
 * Krumningen er ikke pynt. Skriver vi E = E_c + A(k − k_c)² med A i eV·Å², er
 *   m* = ħ²/(d²E/dk²) = ħ²/(2A),  altså  m* i enheter av m₀ = 3,81 / A[eV·Å²],
 * så utlesningen regner effektiv masse rett ut av det du faktisk ser tegnet.
 * Parabelen er en tilnærming nær ekstremalpunktet; lenger ute klippes den mot
 * plottkanten, som er omtrent like ærlig som å tegne den videre.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

// ħ²/(2 m₀) uttrykt i eV·Å²: effektiv masse i enheter av m₀ blir MSCALE / A.
const MSCALE = 3.81;

const EG = 1.1; // eV — Si-aktig gap, bare for å ha en skala å tegne i
const AV = 4.0; // eV·Å² — fast krumning på valensbåndet (tunge hull)
const KMAX = 0.6; // Å⁻¹ — omtrent til sonegrensen i Si (π/a = 0,58 Å⁻¹)
const EMIN = -1.1;
const EMAX = 2.9;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let kc = 0; // Å⁻¹ — hvor ledningsbåndminimet ligger
  let an = 14.6; // eV·Å² — krumning i ledningsbåndet (≈ 0,26 m₀)

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
        sync();
        render();
      },
      { signal },
    );
    return { el: label, out };
  };

  const kcS = slider({
    text: "Minimets posisjon",
    min: 0,
    max: 0.5,
    step: 0.01,
    value: kc,
    aria: "Ledningsbåndminimets bølgevektor i invers ångstrøm",
    onInput: (v) => (kc = v),
  });

  const anS = slider({
    text: "Krumning",
    min: 2,
    max: 30,
    step: 0.2,
    value: an,
    aria: "Krumning i ledningsbåndet i elektronvolt ganger kvadratångstrøm",
    onInput: (v) => (an = v),
  });

  const readout = document.createElement("div");
  readout.className = "sim-readout";

  controls.append(kcS.el, anS.el, readout);

  const num = (n, d) => n.toFixed(d).replace(".", ",");

  function sync() {
    kcS.out.textContent = `k = ${num(kc, 2)} Å⁻¹`;
    anS.out.innerHTML = `m<sub>n</sub><sup>*</sup> = ${num(MSCALE / an, 2)} m₀`;
  }

  const P = (n) => n.toFixed(1);

  function render() {
    const { w, h } = getSize();

    const padL = 40;
    const padR = 12;
    const padT = 12;
    const padB = 34;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const X = (k) => padL + ((k + KMAX) / (2 * KMAX)) * pw;
    const Y = (e) => padT + ph - ((e - EMIN) / (EMAX - EMIN)) * ph;

    /** Parabel som polyline, klippet av plottrammen via clipPath. */
    function curve(f) {
      const pts = [];
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const k = -KMAX + (2 * KMAX * i) / n;
        pts.push(`${P(X(k))},${P(Y(f(k)))}`);
      }
      return pts.join(" ");
    }

    // Ledningsbåndet tegnes som den nedre innhyllingen av to daler: satellitten
    // ved ±k_c (Si har seks ekvivalente X-daler) og Γ-dalen ved k = 0, som
    // løftes etter hvert som satellitten skyves ut. Ved k_c = 0 faller de
    // sammen, og bildet blir det direkte. Uten Γ-dalen ville venstre gren
    // skutt rett til værs og antydet at Γ er et maksimum — det er det ikke.
    const lift = (kc / 0.5) * 1.2; // eV
    // Myk min: en hard Math.min gir en spiss knekk der dalene krysser, og en
    // spiss i et båndskjema leser som fysikk. β styrer avrundingen.
    const softMin = (a, b, beta = 8) =>
      -Math.log(Math.exp(-beta * a) + Math.exp(-beta * b)) / beta;
    const ec = (k) => {
      const sat = EG + an * (Math.abs(k) - kc) * (Math.abs(k) - kc);
      const gamma = EG + lift + 25 * k * k;
      return softMin(sat, gamma);
    };

    const cb = curve(ec);
    const vb = curve((k) => -AV * k * k);

    const direct = kc < 0.02;
    const ecY = Y(EG);
    const evY = Y(0);
    const kcX = X(kc);

    // Overgangen: rett ned når minimet står ved k = 0, ellers et knekk som
    // gjør momentumendringen synlig som et vannrett steg.
    const arrow = direct
      ? `<path d="M ${P(X(0))} ${P(ecY)} V ${P(evY - 6)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M ${P(X(0))} ${P(evY)} l -4 -7 h 8 z" style="fill:var(--accent)"/>` +
        `<text x="${P(X(0) + 10)}" y="${P((ecY + evY) / 2)}" style="fill:var(--accent);font-family:var(--font-mono);font-size:11px">foton, hν = E<tspan dy="3" font-size="9">g</tspan></text>`
      : `<path d="M ${P(kcX)} ${P(ecY)} L ${P(X(0))} ${P(ecY)} L ${P(X(0))} ${P(evY - 6)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 4"/>` +
        `<path d="M ${P(X(0))} ${P(evY)} l -4 -7 h 8 z" style="fill:var(--accent)"/>` +
        `<text x="${P((kcX + X(0)) / 2)}" y="${P(ecY - 9)}" text-anchor="middle" style="fill:var(--accent);font-family:var(--font-mono);font-size:11px">Δk ≠ 0</text>`;

    // E_c og E_v som vannrette hjelpelinjer med etiketten inne i plottet —
    // ute i margen kolliderer de med aksetittelen.
    const level = (y, text, color) =>
      `<path d="M ${P(padL)} ${P(y)} H ${P(padL + pw)}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 5" opacity="0.55"/>` +
      `<text x="${P(padL + pw - 6)}" y="${P(y - 6)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">E<tspan dy="3" font-size="9">${text}</tspan></text>`;

    const axes =
      `<path d="M ${P(padL)} ${P(padT)} V ${P(padT + ph)} H ${P(padL + pw)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      // k = 0 som stiplet midtlinje, så «samme k» er avlesbart.
      `<path d="M ${P(X(0))} ${P(padT)} V ${P(padT + ph)}" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>` +
      level(ecY, "c", "var(--accent)") +
      level(evY, "v", "var(--fg)") +
      `<text x="${P(X(0))}" y="${P(padT + ph + 15)}" text-anchor="middle" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">k = 0</text>` +
      `<text x="${P(padL + pw)}" y="${P(padT + ph + 15)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">k (Å⁻¹)</text>` +
      `<text x="14" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 14 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">E (eV)</text>`;

    const bandLabels =
      `<text x="${P(padL + 6)}" y="${P(Y(EMAX) + 14)}" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Ledningsbånd</text>` +
      `<text x="${P(padL + 6)}" y="${P(evY + 18)}" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Valensbånd</text>`;

    // Markør på selve minimet — det er posisjonen dette diagrammet handler om.
    // Den speilvendte dalen tegnes svakere: det finnes flere ekvivalente daler,
    // men overgangen tegnes bare fra én av dem.
    const minDot =
      `<circle cx="${P(kcX)}" cy="${P(ecY)}" r="4" style="fill:var(--accent)"/>` +
      (direct
        ? ""
        : `<circle cx="${P(X(-kc))}" cy="${P(ecY)}" r="4" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.6"/>`);
    const maxDot = `<circle cx="${P(X(0))}" cy="${P(evY)}" r="4" style="fill:var(--fg)"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `<defs><clipPath id="ek-clip"><rect x="${P(padL)}" y="${P(padT)}" width="${P(pw)}" height="${P(ph)}"/></clipPath></defs>` +
      axes +
      `<g clip-path="url(#ek-clip)">` +
      `<polyline points="${vb}" fill="none" stroke="var(--fg)" stroke-width="2"/>` +
      `<polyline points="${cb}" fill="none" stroke="var(--accent)" stroke-width="2"/>` +
      arrow +
      minDot +
      maxDot +
      `</g>` +
      bandLabels +
      `</svg>`;

    readout.innerHTML = describe();
  }

  function describe() {
    const mn = MSCALE / an;
    const mp = MSCALE / AV;
    const direct = kc < 0.02;

    const mass = `Krumningen gir <i>m</i><sub>n</sub><sup>*</sup> = ħ²/(d²E/dk²) = <b>${num(mn, 2)} m₀</b> i ledningsbåndet og ${num(mp, 2)} m₀ i valensbåndet. Skarpere krumning gir lettere bærer.`;

    const kind = direct
      ? "Minimet ligger ved <b>samme k</b> som valensbåndmaksimet: halvlederen er <b>direkte</b>. Elektronet kan falle rett ned og gi fra seg E_g som et foton — slik lysdioder virker."
      : `Minimet ligger ved k = ${num(kc, 2)} Å⁻¹, altså <b>ikke</b> ved valensbåndmaksimet: halvlederen er <b>indirekte</b>. Overgangen krever en momentumendring i tillegg til energiendringen, går gjerne via en defekttilstand, og energien havner som varme. Dette er Si.`;

    return `${mass} ${kind}`;
  }

  sync();
  onResize(render);
  render();
}
