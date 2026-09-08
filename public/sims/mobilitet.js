/**
 * Mobiliteten mot temperaturen for elektroner i Si, for TFE4146 modul 03.
 * Én idé: to spredningsmekanismer, og den svakeste mobiliteten vinner.
 *
 * Gitterspredning gir μ_L ∝ T^{-3/2}, urenhetsspredning μ_I ∝ T^{3/2}/N,
 * og de legges sammen invers (Streetman lign. 3–45, fig. 3–22). Boka tegner
 * dette log–log, der hver mekanisme er en rett linje; simmen tegner mot T
 * direkte, med toppen som det synlige. Sonene på hver side av toppen er
 * tonet og navngitt, og verdien ved 300 K står på kurven. Ingen utlesning.
 *
 * Modellen er bokas potenslover, forankret i to tall fra boka:
 *  - μ_L(300 K) = 1350 cm²/V·s (rent Si, appendiks III).
 *  - μ_n(300 K, N = 10¹⁷ cm⁻³) = 700 cm²/V·s (§3.4.3), som fastsetter
 *    urenhetsleddet. Utenfor 300 K og over 10¹⁷ cm⁻³ er kurven kvalitativ,
 *    derfor stopper slideren der og y-aksen bærer ingen tall.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const MU_L300 = 1350;
// 1/700 = 1/1350 + 1/μ_I → μ_I(300 K, 10¹⁷) = 1454 cm²/V·s.
const MU_I300_1E17 = 1 / (1 / 700 - 1 / MU_L300);

const TMIN = 50;
const TMAX = 500;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let exp = 15; // N = 10^exp cm⁻³; 13 tegnes som «rent»

  const label = document.createElement("label");
  label.append("Doping ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "13";
  input.max = "17";
  input.step = "1";
  input.value = String(exp);
  input.setAttribute("aria-label", "Dopingtetthet som tierpotens per kubikkcentimeter");
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

  controls.append(label);

  const pure = () => exp <= 13;
  const muL = (T) => MU_L300 * Math.pow(T / 300, -1.5);
  const muI = (T) => MU_I300_1E17 * Math.pow(T / 300, 1.5) * (1e17 / Math.pow(10, exp));
  const mu = (T) => (pure() ? muL(T) : 1 / (1 / muL(T) + 1 / muI(T)));

  /** Temperaturen der de to mekanismene er like sterke (toppen). */
  const tPeak = () => 300 * Math.pow(muL(300) / muI(300), 1 / 3);

  const P = (n) => n.toFixed(1);

  function sync() {
    out.textContent = pure() ? "rent" : `10^${exp} cm⁻³`;
  }

  function render() {
    const { w, h } = getSize();

    const padL = 30;
    const padR = 12;
    const padT = 12;
    const padB = 40;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const xOf = (T) => padL + ((T - TMIN) / (TMAX - TMIN)) * pw;

    // Vinduet på y følger kurven, så formen fyller tegningen uansett doping;
    // tallet ved 300 K bærer sammenligningen på tvers av slideren.
    let peak = 0;
    for (let i = 0; i <= 200; i++) peak = Math.max(peak, mu(TMIN + ((TMAX - TMIN) * i) / 200));
    const yMax = peak * 1.08;
    const yOf = (m) => padT + (1 - m / yMax) * ph;

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;

    // Kurve med penn-løft der verdien går over vinduet (delmekanismene).
    const curve = (fn) => {
      let d = "";
      let pen = false;
      for (let i = 0; i <= 200; i++) {
        const T = TMIN + ((TMAX - TMIN) * i) / 200;
        const m = fn(T);
        if (m > yMax) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"} ${P(xOf(T))} ${P(yOf(m))} `;
        pen = true;
      }
      return d;
    };

    const xR = padL + pw;
    const yB = padT + ph;
    const x300 = xOf(300);

    // Sonene: venstre for toppen begrenser ionene, høyre for toppen gitteret.
    let zones = "";
    const Tp = pure() ? TMIN : Math.max(TMIN, Math.min(tPeak(), TMAX));
    const xP = xOf(Tp);
    if (!pure() && xP > padL + 4) {
      zones +=
        `<rect x="${P(padL)}" y="${P(padT)}" width="${P(xP - padL)}" height="${P(ph)}" fill="var(--card-nested)"/>` +
        `<path d="M ${P(xP)} ${P(padT)} V ${P(yB)}" stroke="var(--border)" stroke-width="1"/>`;
      if (xP - padL > 96) zones += tag((padL + xP) / 2, yB - 8, "Urenhetsspredning", "middle");
      else if (xP - padL > 50) zones += tag((padL + xP) / 2, yB - 8, "Urenheter", "middle");
    }
    if (xR - xP > 96) zones += tag((xP + xR) / 2, yB - 8, "Gitterspredning", "middle");
    else if (xR - xP > 50) zones += tag((xP + xR) / 2, yB - 8, "Gitter", "middle");

    // Akser: T-merker, y bare som retning.
    let grid = "";
    for (const T of [100, 200, 300, 400, 500]) {
      const x = xOf(T);
      grid += `<path d="M ${P(x)} ${P(yB)} v 4" stroke="var(--border-strong)" stroke-width="1"/>`;
      if (T !== 300) grid += tag(x, yB + 16, T === 500 ? "500 K" : String(T), T === 500 ? "end" : "middle");
    }

    // Verdien ved 300 K står på kurven, der tallene i teksten gjelder.
    const m300 = mu(300);
    const y300 = yOf(m300);
    const valueTag =
      `<circle cx="${P(x300)}" cy="${P(y300)}" r="3.5" style="fill:var(--accent)"/>` +
      tag(x300 + 7, y300 + (y300 < padT + 24 ? 16 : -7), `${Math.round(m300)} cm²/V·s`, "start", "var(--accent)");

    // De to delmekanismene som tynne, stiplede kurver, så det synes hvilken
    // som ligger lavest der.
    const parts = pure()
      ? ""
      : `<path d="${curve(muI)}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>`;
    const lattice = `<path d="${curve(muL)}" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      zones +
      grid +
      `<path d="M ${P(padL)} ${P(padT)} V ${P(yB)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(padL)} ${P(padT)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>` +
      `<path d="M ${P(padL)} ${P(yB)} H ${P(xR)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(padL + pw / 2, h - 6, "Temperatur", "middle") +
      `<text x="12" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Mobilitet</text>` +
      lattice +
      parts +
      `<path d="${curve(mu)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` +
      valueTag +
      `<path d="M ${P(x300)} ${P(yB)} v -6" stroke="var(--accent)" stroke-width="2"/>` +
      tag(x300, yB + 16, "300 K", "middle", "var(--accent)") +
      `</svg>`;
  }

  sync();
  onResize(render);
  render();
}
