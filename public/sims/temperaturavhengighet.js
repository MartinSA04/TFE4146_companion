/**
 * n₀ mot temperaturen for donordopet Si — innholdet i Streetman fig. 3–18,
 * for TFE4146 modul 02. Én idé: platået. Donortettheten setter høyden på det
 * ekstrinsiske platået, og krysningen med n_i(T) setter temperaturen der
 * materialet blir intrinsisk.
 *
 * Boka tegner dette mot 1000/T (rette linjer, aksen speilvendt); den
 * konvensjonen underviser prosa og bok. Simmen tegner mot T direkte, med
 * varmere mot høyre, så de tre områdene kan leses uten å tolke en resiprok
 * akse: ytterområdene er tonet, platået er merket n₀ = N_d med sitt
 * temperaturspenn, og 300 K står på aksen. Ingen utlesning.
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

const TMIN = 25;
const TMAX = 800;
const YMIN = 10; // log10 cm⁻³
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

  controls.append(label);

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
    let lo = TMIN;
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

  /** T der n_i passerer 10^logN — brukes til å plassere kurvenavnet. */
  function tNi(logN) {
    let lo = TMIN;
    let hi = 2000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (Math.log10(ni(mid)) >= logN) hi = mid;
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
    const padT = 10;
    const padB = 40;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const xOf = (T) => padL + ((T - TMIN) / (TMAX - TMIN)) * pw;
    const yOf = (logN) => padT + ((YMAX - logN) / (YMAX - YMIN)) * ph;

    // Kurve med penn-løft der verdien faller under vinduet (n_i i kulda).
    const curve = (fn) => {
      let d = "";
      let pen = false;
      for (let i = 0; i <= 260; i++) {
        const T = TMIN + ((TMAX - TMIN) * i) / 260;
        const logN = Math.log10(fn(T));
        if (logN < YMIN || logN > YMAX) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"} ${P(xOf(T))} ${P(yOf(logN))} `;
        pen = true;
      }
      return d;
    };

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;
    const sub = (base, s) =>
      `${base}<tspan dy='3' font-size='9'>${s}</tspan><tspan dy='-3'>​</tspan>`;

    // Akser og gitter.
    let grid = "";
    for (let l = YMIN; l <= YMAX; l += 2) {
      const y = yOf(l);
      grid +=
        `<path d="M ${P(padL)} ${P(y)} H ${P(padL + pw)}" stroke="var(--border)" stroke-width="${l === YMIN ? 1 : 0.5}"/>` +
        tag(padL - 4, y + 4, `10<tspan dy='-4' font-size='9'>${l}</tspan>`, "end");
    }
    // Merkene ved 200/400 mister tallet sitt når 300 K-merket trenger plassen
    // (smale skjermer); streken står igjen.
    const x300 = xOf(300);
    for (const T of [200, 400, 600, 800]) {
      const x = xOf(T);
      grid += `<path d="M ${P(x)} ${P(padT + ph)} v 4" stroke="var(--border-strong)" stroke-width="1"/>`;
      if (Math.abs(x - x300) > 46)
        grid += tag(x, padT + ph + 16, T === 800 ? "800 K" : String(T), T === 800 ? "end" : "middle");
    }

    // Områdene: ytterkantene tones, platået i midten står åpent.
    const tIon = tIonized(Nd);
    const tInt = tIntrinsic(Nd);
    const xIon = xOf(Math.min(tIon, TMAX));
    const xInt = xOf(Math.min(tInt, TMAX));
    const xR = padL + pw;
    let zones = "";
    if (xIon > padL + 4)
      zones +=
        `<rect x="${P(padL)}" y="${P(padT)}" width="${P(xIon - padL)}" height="${P(ph)}" fill="var(--card-nested)"/>` +
        `<path d="M ${P(xIon)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border)" stroke-width="1"/>`;
    if (xInt < xR - 4)
      zones +=
        `<rect x="${P(xInt)}" y="${P(padT)}" width="${P(xR - xInt)}" height="${P(ph)}" fill="var(--card-nested)"/>` +
        `<path d="M ${P(xInt)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border)" stroke-width="1"/>`;
    if (xIon - padL > 74) zones += tag((padL + xIon) / 2, padT + 15, "Ionisering", "middle");
    if (xR - xInt > 74) zones += tag((xInt + xR) / 2, padT + 15, "Intrinsisk", "middle");
    const midX = (xIon + Math.min(xInt, xR)) / 2;
    if (Math.min(xInt, xR) - xIon > 78) {
      zones += tag(midX, padT + 15, "Ekstrinsisk", "middle");
      if (tInt < TMAX)
        zones += tag(
          midX,
          padT + 28,
          `≈${Math.round(tIon / 10) * 10}–${Math.round(tInt / 10) * 10} K`,
          "middle",
        );
    }

    // Platået merkes der det ligger; navnet på selve påstanden.
    let plateau = "";
    if (Math.min(xInt, xR) - xIon > 64)
      plateau = tag(midX, yOf(exp) - 7, `${sub("n", "0")} = ${sub("N", "d")}`, "middle", "var(--accent)");

    // Navn på n_i-kurven, nede til høyre for der den kommer inn i vinduet.
    const tLab = tNi(YMIN + 2);
    const niTag =
      tLab < TMAX - 60
        ? tag(xOf(tLab) + 7, yOf(YMIN + 2) + 11, `${sub("n", "i")}(T)`)
        : "";

    // Mykt fyll under n₀-kurven: mengden frie elektroner som flate.
    let fill = `M ${P(padL)} ${P(padT + ph)} `;
    for (let i = 0; i <= 260; i++) {
      const T = TMIN + ((TMAX - TMIN) * i) / 260;
      const logN = Math.max(YMIN, Math.min(YMAX, Math.log10(n0(T, Nd))));
      fill += `L ${P(xOf(T))} ${P(yOf(logN))} `;
    }
    fill += `L ${P(xR)} ${P(padT + ph)} Z`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      zones +
      grid +
      `<path d="M ${P(padL)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(padL)} ${P(padT + ph)} H ${P(xR)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(padL + pw / 2, h - 6, "Temperatur", "middle") +
      `<text x="12" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 12 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">n₀ (cm⁻³)</text>` +
      `<path d="${fill}" style="fill:var(--accent)" fill-opacity="0.07"/>` +
      `<path d="${curve(ni)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>` +
      niTag +
      `<path d="${curve((T) => n0(T, Nd))}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>` +
      plateau +
      // 300 K-merke på aksen: der tallene i teksten gjelder.
      `<path d="M ${P(xOf(300))} ${P(padT + ph)} v -6" stroke="var(--accent)" stroke-width="2"/>` +
      tag(xOf(300), padT + ph + 16, "300 K", "middle", "var(--accent)") +
      `</svg>`;
  }

  sync();
  onResize(render);
  render();
}
