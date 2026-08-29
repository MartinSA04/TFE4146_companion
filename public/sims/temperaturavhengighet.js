/**
 * n₀ mot 1000/T for donordopet Si — Streetman fig. 3–18 gjort interaktiv,
 * for TFE4146 modul 02. Én idé: platået. Donortettheten setter høyden på det
 * ekstrinsiske platået, og krysningen med n_i(T) setter temperaturen der
 * materialet blir intrinsisk.
 *
 * Modell (kvalitativ, detaljene er ikke pensum):
 *  - n_i(T) forankret i 1,5·10¹⁰ cm⁻³ ved 300 K, med T^{3/2}-faktor og
 *    E_g = 1,11 eV i eksponenten (Streetman lign. 3–26/fig. 3–17).
 *  - Utfrysning fra standard donorstatistikk med degenerasjon 2:
 *    n²/(N_d − n) = (N_c/2)·e^(−ΔE_d/kT), ΔE_d = 45 meV (fosfor).
 *  - Totalen syr områdene sammen via nøytralitet + massevirkningsloven:
 *    n₀ = n_eff/2 + √((n_eff/2)² + n_i²).
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KB = 8.617e-5; // eV/K
const EG = 1.11;
const ED = 0.045;
const NI300 = 1.5e10;
const NC300 = 2.9e19;

const XMIN = 0.8; // 1000/T — 1250 K
const XMAX = 20; // 50 K
const YMIN = 8; // log10 cm⁻³
const YMAX = 18;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let exp = 15; // N_d = 10^exp cm⁻³

  const label = document.createElement("label");
  label.append("Donortetthet ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "13";
  input.max = "17";
  input.step = "1";
  input.value = String(exp);
  input.setAttribute("aria-label", "Donortetthet som tierpotens per kubikkcentimeter");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      exp = Number(input.value);
      sync();
      render();
    },
    { signal },
  );

  const readout = document.createElement("div");
  readout.className = "sim-readout";

  controls.append(label, readout);

  const ni = (T) =>
    NI300 *
    Math.pow(T / 300, 1.5) *
    Math.exp((-EG / (2 * KB)) * (1 / T - 1 / 300));
  const nc = (T) => NC300 * Math.pow(T / 300, 1.5);

  /** Ionisert donortetthet fra andregradslikningen i filhodet. */
  function nDon(T, Nd) {
    const A = (nc(T) / 2) * Math.exp(-ED / (KB * T));
    return (-A + Math.sqrt(A * A + 4 * A * Nd)) / 2;
  }

  const n0 = (T, Nd) => {
    const half = Math.min(nDon(T, Nd), Nd) / 2;
    return half + Math.sqrt(half * half + ni(T) * ni(T));
  };

  /** Laveste T der 90 % av donorene er ionisert (grensen mot ioniseringsområdet). */
  function tIonized(Nd) {
    let lo = 20;
    let hi = 1000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (nDon(mid, Nd) / Nd >= 0.9) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /** T der n_i når N_d (grensen mot det intrinsiske området). */
  function tIntrinsic(Nd) {
    let lo = 200;
    let hi = 2000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (ni(mid) >= Nd) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  const P = (n) => n.toFixed(1);

  function sync() {
    out.textContent = `10^${exp} cm⁻³`;
  }

  function render() {
    const { w, h } = getSize();
    const Nd = Math.pow(10, exp);

    const padL = 46;
    const padR = 12;
    const padT = 24; // plass til T-merkene øverst
    const padB = 34;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const xOf = (invT) => padL + ((invT - XMIN) / (XMAX - XMIN)) * pw;
    const yOf = (logN) =>
      padT + ((YMAX - logN) / (YMAX - YMIN)) * ph;

    // clamp=true holder kurven på rammen når den går utenfor (n₀ i toppen);
    // clamp=false løfter pennen i stedet, så n_i ikke blir en strek langs aksen.
    const curve = (fn, clamp = true) => {
      let d = "";
      let pen = false;
      for (let i = 0; i <= 260; i++) {
        const invT = XMIN + ((XMAX - XMIN) * i) / 260;
        const logN = Math.log10(fn(1000 / invT));
        if (!clamp && (logN < YMIN || logN > YMAX)) {
          pen = false;
          continue;
        }
        const y = yOf(Math.max(YMIN, Math.min(YMAX, logN)));
        d += `${pen ? "L" : "M"} ${P(xOf(invT))} ${P(y)} `;
        pen = true;
      }
      return d;
    };

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;

    // Akser og gitter.
    let grid = "";
    for (let l = YMIN; l <= YMAX; l += 2) {
      const y = yOf(l);
      grid +=
        `<path d="M ${P(padL)} ${P(y)} H ${P(padL + pw)}" stroke="var(--border)" stroke-width="${l === YMIN ? 1 : 0.5}"/>` +
        tag(padL - 4, y + 4, `10<tspan dy='-4' font-size='9'>${l}</tspan>`, "end");
    }
    // Temperatur øverst: eksponentene lever på 1/T-aksen, tallene vi tenker i er T.
    for (const T of [500, 300, 200, 100, 50]) {
      const invT = 1000 / T;
      if (invT < XMIN || invT > XMAX) continue;
      grid +=
        `<path d="M ${P(xOf(invT))} ${P(padT)} v 4" stroke="var(--border-strong)" stroke-width="1"/>` +
        tag(xOf(invT), padT - 6, `${T} K`, "middle");
    }

    // Områdegrensene.
    const tIon = tIonized(Nd);
    const tInt = tIntrinsic(Nd);
    const xIon = xOf(1000 / tIon);
    const xInt = xOf(1000 / tInt);
    const sep = (x) =>
      x > padL && x < padL + pw
        ? `<path d="M ${P(x)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="4 4"/>`
        : "";
    const zone = (x1, x2, text) => {
      const a = Math.max(padL, Math.min(x1, x2));
      const b = Math.min(padL + pw, Math.max(x1, x2));
      return b - a > 58 ? tag((a + b) / 2, padT + 14, text, "middle") : "";
    };

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      grid +
      `<path d="M ${P(padL)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(padL)} ${P(padT + ph)} H ${P(padL + pw)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(padL + pw / 2, h - 6, "1000/T (K⁻¹), temperaturen øker mot venstre", "middle") +
      `<text x="12" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">n₀ (cm⁻³)</text>` +
      sep(xIon) +
      sep(xInt) +
      zone(xInt, padL, "Intrinsisk") +
      zone(xIon, xInt, "Ekstrinsisk") +
      zone(padL + pw, xIon, "Ionisering") +
      // n_i(T) stiplet, n₀ i aksentfargen.
      `<path d="${curve(ni, false)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>` +
      `<path d="${curve((T) => n0(T, Nd))}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` +
      tag(xOf(2.6), yOf(Math.log10(ni(1000 / 2.6))) - 6, "n<tspan dy='3' font-size='9'>i</tspan><tspan dy='-3'>(T)</tspan>") +
      // 300 K-merke nederst.
      `<path d="M ${P(xOf(1000 / 300))} ${P(padT + ph)} v -6" stroke="var(--accent)" stroke-width="2"/>` +
      `</svg>`;

    readout.innerHTML =
      `Med N<sub>d</sub> = 10<sup>${exp}</sup> cm<sup>−3</sup> er donorene ionisert fra omtrent <b>${Math.round(tIon / 5) * 5} K</b>, ` +
      `og n<sub>i</sub> når dopingnivået ved omtrent <b>${Math.round(tInt / 5) * 5} K</b>. ` +
      `Mellom de to er n₀ = N<sub>d</sub>, uavhengig av temperatur. Komponenter dopes slik at hele driftsområdet ligger her.`;
  }

  sync();
  onResize(render);
  render();
}
