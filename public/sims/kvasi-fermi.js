/**
 * Kvasi-Fermi-nivåene i belyst n-type Si, for TFE4146 modul 03.
 * Én idé: det samme overskuddet flytter minoritetsnivået langt og
 * majoritetsnivået nesten ikke.
 *
 * Venstre panel er båndskjemaet: E_c, E_v, E_i, likevektens E_F stiplet, og
 * F_n og F_p tegnet der lyset setter dem, med splittingen F_n − F_p som en
 * merket klamme. Høyre panel er n og p som stolper på logaritmisk skala,
 * med likevektsverdiene n₀ og p₀ som merker, så det synes at hullene vokser
 * mange tierpotenser mens elektronene knapt rører seg. Ingen utlesning.
 *
 * Tall for Si ved 300 K: E_g = 1,11 eV, n_i = 1,5·10¹⁰ cm⁻³, k_BT = 0,0259 eV,
 * E_i 13 meV under midten (Streetman & Banerjee §3.3 og §4.3.3). Lyset gis
 * som δn = g_op·τ_n direkte, siden bare produktet betyr noe her.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KT = 0.0259;
const EG = 1.11;
const NI = 1.5e10;
const EI = EG / 2 - 0.013; // over E_v

const LOG_MIN = 2; // log10 cm⁻³, bunnen av stolpene
const LOG_MAX = 18;

export default function init({ stage, controls, getSize, onResize, signal }) {
  let ndExp = 15; // N_d = 10^ndExp cm⁻³
  let light = 0; // 0 = mørkt, ellers δn = 10^(9 + light)

  const slider = ({ text, min, max, value, aria, onInput }) => {
    const label = document.createElement("label");
    label.append(text + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
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

  const ndS = slider({
    text: "Donortetthet",
    min: 14,
    max: 17,
    value: ndExp,
    aria: "Donortetthet som tierpotens per kubikkcentimeter",
    onInput: (v) => (ndExp = v),
  });
  const lightS = slider({
    text: "Lys",
    min: 0,
    max: 7,
    value: light,
    aria: "Lysstyrke, som overskudd av par i tierpotenser",
    onInput: (v) => (light = v),
  });

  controls.append(ndS.el, lightS.el);

  const n0 = () => Math.pow(10, ndExp);
  const p0 = () => (NI * NI) / n0();
  const dn = () => (light === 0 ? 0 : Math.pow(10, 9 + light));
  const n = () => n0() + dn();
  const p = () => p0() + dn();

  // Nivåene relativt til E_v, i eV.
  const ef = () => EI + KT * Math.log(n0() / NI);
  const fn = () => EI + KT * Math.log(n() / NI);
  const fp = () => EI - KT * Math.log(p() / NI);

  const P = (v) => v.toFixed(1);
  const NB = (v, d = 2) => v.toFixed(d).replace(".", ",");
  const sub = (base, s) => `${base}<tspan dy='3' font-size='9'>${s}</tspan><tspan dy='-3'>​</tspan>`;
  const pow10 = (v) => {
    const e = Math.floor(Math.log10(v));
    const m = v / Math.pow(10, e);
    const ms = Math.abs(m - 1) < 0.05 ? "" : `${NB(m, 1)}·`;
    return `${ms}10<tspan dy='-4' font-size='9'>${e}</tspan><tspan dy='4'>​</tspan>`;
  };

  function sync() {
    ndS.out.textContent = `10^${ndExp} cm⁻³`;
    lightS.out.textContent = light === 0 ? "mørkt" : `δn = 10^${9 + light} cm⁻³`;
  }

  function render() {
    const { w, h } = getSize();

    const padT = 14;
    const padB = 30;
    const padL = 30;
    const padR = 8;
    const gapX = 22;
    const ph = h - padT - padB;
    const total = w - padL - padR - gapX;
    const bw = Math.min(total * 0.62, total - 110);
    const rw = total - bw;
    const bX = padL;
    const rX = padL + bw + gapX;

    // Energivindu: litt under E_v og litt over E_c.
    const eMin = -0.25;
    const eMax = EG + 0.25;
    const yOf = (E) => padT + ((eMax - E) / (eMax - eMin)) * ph;
    const yc = yOf(EG);
    const yv = yOf(0);

    const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px">${text}</text>`;

    const yEf = yOf(ef());
    const yFn = yOf(fn());
    const yFp = yOf(fp());
    const yEi = yOf(EI);
    const lit = light > 0;

    // Nivåstrekene ligger i båndskjemaets bredde; navnene til høyre for dem.
    const lineEnd = bX + bw - 34;
    const level = (y, color, dash, width) =>
      `<path d="M ${P(bX)} ${P(y)} H ${P(lineEnd)}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

    let band =
      `<rect x="${P(bX)}" y="${P(yc)}" width="${P(bw)}" height="${P(yv - yc)}" fill="var(--card-nested)"/>` +
      `<path d="M ${P(bX)} ${P(yc)} H ${P(bX + bw)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="M ${P(bX)} ${P(yv)} H ${P(bX + bw)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      tag(bX - 4, yc + 4, sub("E", "c"), "end", "var(--fg)") +
      tag(bX - 4, yv + 4, sub("E", "v"), "end", "var(--fg)") +
      level(yEi, "var(--border-strong)", "2 4", 1) +
      tag(lineEnd + 4, yEi + 4, sub("E", "i")) +
      level(yEf, lit ? "var(--muted)" : "var(--accent)", "5 3", 1.5) +
      tag(lineEnd + 4, yEf + (lit && Math.abs(yFn - yEf) < 12 ? 12 : 4), sub("E", "F"), "start", lit ? "var(--muted)" : "var(--accent)");

    if (lit) {
      band +=
        level(yFn, "var(--accent)", null, 2) +
        tag(lineEnd + 4, yFn - 3, sub("F", "n"), "start", "var(--accent)") +
        level(yFp, "var(--red)", null, 2) +
        tag(lineEnd + 4, yFp + 4, sub("F", "p"), "start", "var(--red)");
      // Klammen for splittingen F_n − F_p, med verdien i eV midt på; navnet
      // står i bildeteksten, så etiketten holder seg unna E_i-merket.
      const xb = bX + 10;
      const split = fn() - fp();
      band +=
        `<path d="M ${P(xb)} ${P(yFn)} V ${P(yFp)}" stroke="var(--fg)" stroke-width="1"/>` +
        `<path d="M ${P(xb - 3)} ${P(yFn)} h 6 M ${P(xb - 3)} ${P(yFp)} h 6" stroke="var(--fg)" stroke-width="1"/>` +
        tag(xb + 5, (yFn + yFp) / 2 - 3, `${NB(split, 2)} eV`, "start", "var(--fg)");
    } else {
      band += tag(bX + 10, yEf - 6, "likevekt", "start", "var(--accent)");
    }

    // Stolpene: n og p på log-skala, likevektsverdien som merke.
    const colW = Math.min(44, (rw - 24) / 2);
    const gap = (rw - 2 * colW) / 3;
    const yLog = (v) => {
      const l = Math.max(LOG_MIN, Math.min(LOG_MAX, Math.log10(v)));
      return padT + ((LOG_MAX - l) / (LOG_MAX - LOG_MIN)) * ph;
    };
    const yB = padT + ph;
    const bar = (x, value, eq, color, name) => {
      const yTop = yLog(value);
      const yEq = yLog(eq);
      let s =
        `<rect x="${P(x)}" y="${P(yTop)}" width="${P(colW)}" height="${P(yB - yTop)}" style="fill:${color}" fill-opacity="0.5"/>`;
      if (lit) {
        // Overskuddet over likevektsmerket i sterkere farge; merket navngis
        // inne i stolpen, rett under streken.
        if (yEq - yTop > 1)
          s += `<rect x="${P(x)}" y="${P(yTop)}" width="${P(colW)}" height="${P(yEq - yTop)}" style="fill:${color}" fill-opacity="0.45"/>`;
        s += `<path d="M ${P(x - 4)} ${P(yEq)} h ${P(colW + 8)}" stroke="var(--fg)" stroke-width="1.5"/>`;
        s += tag(x + colW / 2, yEq + 13, `${name}<tspan dy='3' font-size='9'>0</tspan>`, "middle", "var(--fg)");
      }
      s += tag(x + colW / 2, yTop - 5, pow10(value), "middle", color);
      s += tag(x + colW / 2, yB + 15, name, "middle", "var(--fg)");
      return s;
    };
    const xN = rX + gap;
    const xP = rX + 2 * gap + colW;
    const bars =
      `<path d="M ${P(rX)} ${P(yB)} H ${P(rX + rw)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      bar(xN, n(), n0(), "var(--accent)", "n") +
      bar(xP, p(), p0(), "var(--red)", "p");

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      band +
      bars +
      `</svg>`;
  }

  sync();
  onResize(render);
  render();
}
