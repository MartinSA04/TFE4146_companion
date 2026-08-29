/**
 * Fermi–Dirac-fordelingen lagt ved siden av båndskjemaet, for TFE4146 modul 02.
 *
 * Venstre panel er f(E) tegnet sidelengs, med energiaksen loddrett som i et
 * båndskjema. Høyre panel er bærerstripene: f·N over E_c (elektroner) og
 * (1−f)·N under E_v (hull), med N(E) ∝ √(avstand fra kanten) og elektron-
 * profilen vektet med N_c/N_v-forholdet. Flatene normeres til den største av
 * de to — n0 og p0 spenner mange tierpotenser, så tegningen bærer formen og
 * utlesningen bærer tallene (jf. Streetman fig. 3–15/3–16, som overdriver
 * halene av samme grunn).
 *
 * Tall for Si: E_g = 1,11 eV, N_c = 2,9·10¹⁹ og N_v = 1,0·10¹⁹ cm⁻³ ved
 * 300 K (Streetman & Banerjee §3.3 + appendiks III), skalert med T^{3/2}.
 * E_i-merket er E_g/2 + (kT/2)·ln(N_v/N_c).
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KB = 8.617e-5; // eV/K
const EG = 1.11;
const NC300 = 2.9e19;
const NV300 = 1.0e19;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let ef = 0.555; // eV over E_v
  let temp = 300;

  const efLabel = document.createElement("label");
  efLabel.append("Fermi-nivå ");
  const efOut = document.createElement("output");
  const efInput = document.createElement("input");
  efInput.type = "range";
  efInput.min = "0.06";
  efInput.max = "1.05";
  efInput.step = "0.005";
  efInput.value = String(ef);
  efInput.setAttribute("aria-label", "Fermi-nivåets avstand fra valensbåndkanten i elektronvolt");
  efLabel.append(efOut, efInput);
  efInput.addEventListener(
    "input",
    () => {
      ef = Number(efInput.value);
      sync();
      render();
    },
    { signal },
  );

  const tLabel = document.createElement("label");
  tLabel.append("Temperatur ");
  const tOut = document.createElement("output");
  const tInput = document.createElement("input");
  tInput.type = "range";
  tInput.min = "100";
  tInput.max = "500";
  tInput.step = "25";
  tInput.value = String(temp);
  tInput.setAttribute("aria-label", "Temperatur i kelvin");
  tLabel.append(tOut, tInput);
  tInput.addEventListener(
    "input",
    () => {
      temp = Number(tInput.value);
      sync();
      render();
    },
    { signal },
  );

  const readout = document.createElement("div");
  readout.className = "sim-readout";

  controls.append(efLabel, tLabel, readout);

  const kT = () => KB * temp;
  const f = (E) => 1 / (1 + Math.exp((E - ef) / kT()));
  const nc = () => NC300 * Math.pow(temp / 300, 1.5);
  const nv = () => NV300 * Math.pow(temp / 300, 1.5);
  /** E_i for gjeldende temperatur: midt i gapet pluss N_c/N_v-forskyvningen. */
  const ei = () => EG / 2 + (kT() / 2) * Math.log(NV300 / NC300);

  const P = (n) => n.toFixed(1);
  const NB = (n, d = 2) => n.toFixed(d).replace(".", ",");

  function sync() {
    efOut.textContent = `Ev + ${NB(ef, 2)} eV`;
    tOut.textContent = `${temp} K`;
  }

  function render() {
    const { w, h } = getSize();

    // Energivindu: litt under E_v og litt over E_c.
    const eMin = -0.4;
    const eMax = EG + 0.4;
    const padT = 8;
    const padB = 30;
    const padL = 40;
    const padR = 10;
    const gapX = 24;
    const ph = h - padT - padB;
    const pw = (w - padL - padR - gapX) / 2;
    const fX = padL;
    const nX = padL + pw + gapX;
    const yOf = (E) => padT + ((eMax - E) / (eMax - eMin)) * ph;

    const yc = yOf(EG);
    const yv = yOf(0);

    // f(E)-kurven, samplet tett nok til at kanten er glatt også ved 100 K.
    let fPath = "";
    const STEPS = 220;
    for (let i = 0; i <= STEPS; i++) {
      const E = eMin + ((eMax - eMin) * i) / STEPS;
      const x = fX + f(E) * pw;
      fPath += `${i === 0 ? "M" : "L"} ${P(x)} ${P(yOf(E))} `;
    }

    // Bærerprofilene. Elektronvekten N_c/N_v gjør at like store flater faktisk
    // betyr like mange bærere; felles normering til den største.
    const wN = NC300 / NV300;
    const eSamp = [];
    const hSamp = [];
    let peak = 0;
    for (let i = 0; i <= STEPS; i++) {
      const E = eMin + ((eMax - eMin) * i) / STEPS;
      if (E > EG) {
        const v = wN * Math.sqrt(E - EG) * f(E);
        eSamp.push([E, v]);
        peak = Math.max(peak, v);
      } else if (E < 0) {
        const v = Math.sqrt(-E) * (1 - f(E));
        hSamp.push([E, v]);
        peak = Math.max(peak, v);
      }
    }
    const profile = (samp) => {
      if (!peak) return "";
      let d = `M ${P(nX)} ${P(yOf(samp[0][0]))} `;
      for (const [E, v] of samp)
        d += `L ${P(nX + (v / peak) * pw)} ${P(yOf(E))} `;
      d += `L ${P(nX)} ${P(yOf(samp[samp.length - 1][0]))} Z`;
      return d;
    };

    // Tilstandstettheten som tynn kontur, så det synes at stripene er
    // produktet av en voksende N og en fallende f.
    const dosPath = (edge, dir) => {
      let d = "";
      for (let i = 0; i <= 40; i++) {
        const dE = ((eMax - EG) * i) / 40;
        const E = edge + dir * dE;
        const v = (dir > 0 ? wN : 1) * Math.sqrt(dE);
        const x = nX + Math.min(1, v / (peak || 1)) * pw;
        d += `${i === 0 ? "M" : "L"} ${P(Math.min(x, nX + pw))} ${P(yOf(E))} `;
      }
      return d;
    };

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;

    const yEf = yOf(ef);
    const yEi = yOf(ei());
    const xHalf = fX + pw / 2;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      // Energiakse med pil, felles for begge panelene.
      `<text x="12" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Elektronenergi</text>` +
      `<path d="M 22 ${P(padT + ph)} V ${P(padT)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M 22 ${P(padT)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>` +
      // Gapet tonet i begge panelene: der finnes ingen tilstander.
      `<rect x="${P(fX)}" y="${P(yc)}" width="${P(pw)}" height="${P(yv - yc)}" fill="var(--card-nested)"/>` +
      `<rect x="${P(nX)}" y="${P(yc)}" width="${P(pw)}" height="${P(yv - yc)}" fill="var(--card-nested)"/>` +
      // Båndkantene tvers over begge panelene.
      `<path d="M ${P(fX)} ${P(yc)} H ${P(nX + pw)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(fX)} ${P(yv)} H ${P(nX + pw)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(fX - 4, yc + 4, "E<tspan dy='3' font-size='9'>c</tspan>", "end", "var(--fg)") +
      tag(fX - 4, yv + 4, "E<tspan dy='3' font-size='9'>v</tspan>", "end", "var(--fg)") +
      // Panel A: gitterlinje for f = 1/2, selve kurven og E_F/E_i-merkene.
      `<path d="M ${P(xHalf)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 4"/>` +
      tag(xHalf, h - 16, "½", "middle") +
      tag(fX, h - 16, "0") +
      tag(fX + pw, h - 16, "1", "end") +
      tag(fX + pw / 2, h - 4, "f(E)", "middle") +
      `<path d="M ${P(fX)} ${P(yEf)} H ${P(fX + pw)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="5 3"/>` +
      tag(fX + pw - 2, yEf - 4, "E<tspan dy='3' font-size='9'>F</tspan>", "end", "var(--accent)") +
      `<path d="M ${P(fX)} ${P(yEi)} h 8 M ${P(fX + pw - 8)} ${P(yEi)} h 8" stroke="var(--muted)" stroke-width="1"/>` +
      tag(fX + 2, yEi + 11, "E<tspan dy='3' font-size='9'>i</tspan>") +
      `<path d="${fPath}" fill="none" stroke="var(--fg)" stroke-width="2"/>` +
      // Panel B: N(E)-konturer og de fylte bærerstripene.
      `<path d="${dosPath(EG, 1)}" fill="none" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3"/>` +
      `<path d="${dosPath(0, -1)}" fill="none" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3"/>` +
      `<path d="${profile(eSamp)}" style="fill:var(--accent)" fill-opacity="0.55" stroke="var(--accent)" stroke-width="1.5"/>` +
      `<path d="${profile(hSamp)}" style="fill:var(--red)" fill-opacity="0.45" stroke="var(--red)" stroke-width="1.5"/>` +
      tag(nX + 6, yc + 14, "ingen tilstander i gapet") +
      tag(nX + pw / 2, h - 4, "f·N og (1−f)·N, normert, ikke i skala", "middle") +
      `</svg>`;

    readout.innerHTML = describe();
  }

  function describe() {
    const dEc = EG - ef;
    const dEi = ef - ei();
    const n0 = nc() * Math.exp(-dEc / kT());
    const p0 = nv() * Math.exp(-ef / kT());
    const pow = (x) => `10<sup>${NB(Math.log10(x), 1)}</sup>`;
    const type =
      Math.abs(dEi) < 0.02
        ? "praktisk talt intrinsisk"
        : dEi > 0
          ? "n-type"
          : "p-type";
    const near =
      Math.min(dEc, ef) < 3 * kT()
        ? " Så nær kanten svikter Boltzmann-tilnærmingen, så tallene er overslag."
        : "";
    return (
      `E<sub>F</sub> ligger ${NB(Math.abs(dEi), 2)} eV ${dEi >= 0 ? "over" : "under"} E<sub>i</sub>: <b>${type}</b>. ` +
      `Ved ${temp} K gir det n<sub>0</sub> ≈ ${pow(n0)} og p<sub>0</sub> ≈ ${pow(p0)} cm<sup>−3</sup>.${near}`
    );
  }

  sync();
  onResize(render);
  render();
}
