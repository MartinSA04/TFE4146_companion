/**
 * Båndsplitting mot gitteravstand for TFE4146, modul 01 (Streetman Fig. 3–3).
 *
 * Én idé: BREDDEN på båndene styres av gitteravstanden, mens ANTALLET
 * tilstander er fast. Ved Si sin faktiske avstand har ytterskallets 8N
 * tilstander omorganisert seg i 4N nede og 4N oppe, med et gap imellom, og de
 * 4N valenselektronene fyller nøyaktig den nedre gruppen.
 *
 * Vannrett akse er RELATIV GITTERAVSTAND, ikke tid og ikke temperatur. Hvert
 * loddrett snitt er en annen, komplett, statisk krystall. Derfor tegnes hele
 * figuren fra første frame, og slideren flytter bare et snitt gjennom den.
 * Si-markøren ved 5,43 Å står fast på samme grunn.
 *
 * Tall og kilder:
 *  - Si sin gitterkonstant 5,43 Å og gapet 1,12 eV: Streetman & Banerjee §3.1.
 *  - Tellingen 8N tilstander / 4N elektroner per N atomer: Streetman §3.1.2
 *    (fritt Si-atom: 3s² 3p², altså 2 + 6 = 8 tilstander og 4 elektroner).
 *  - I den atomære enden er 3s full (2N tilstander, 2N elektroner) og 3p
 *    bare en tredjedel full (6N tilstander, 2N elektroner). Summen er 8N og 4N
 *    i hele sveipet, og det er nettopp det tellerne under figuren viser.
 *
 * Energiaksen har med vilje ingen tallskala. Formen på figuren er kvalitativ,
 * så all annen tallfesting enn E_g ≈ 1,1 eV ved Si-markøren ville vært
 * oppdiktet. Kurvene er derfor definert av fem ankerpunkter (ANCHORS) med myk
 * interpolasjon imellom: et skjema, tegnet som et skjema.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const A_SI = 5.431; // Å, Streetman §3.1
const EG_SI = 1.12; // eV, gapet ved markøren

const RMIN = 0.75; // relativ gitteravstand, venstre kant
const RMAX = 3.0; // relativ gitteravstand, høyre kant (nær frie atomer)

// Vilkårlig energiskala. Bare rekkefølgen og forholdene betyr noe.
const EMIN = -3.25;
const EMAX = 2.15;

/**
 * Ytterskallets to grupper, som fire kantkurver. Ved stor avstand er de to
 * skarpe streker (3s nede, 3p oppe). Rundt r ≈ 1,7 overlapper de og danner én
 * 8N-manifold. Videre innover splitter manifolden seg i 4N + 4N med et gap.
 * Ankerne er valgt slik at rekkefølgen blir: to streker, vifte, smelting,
 * ny splitting.
 */
const ANCHORS = [
  { r: 3.0, lowBot: -0.95, lowTop: -0.85, upBot: 0.25, upTop: 0.35 },
  { r: 2.4, lowBot: -0.98, lowTop: -0.82, upBot: 0.22, upTop: 0.38 },
  { r: 1.6, lowBot: -1.15, lowTop: 0.15, upBot: -0.15, upTop: 0.75 },
  { r: 1.0, lowBot: -1.45, lowTop: -0.25, upBot: 0.25, upTop: 1.35 },
  { r: 0.75, lowBot: -1.95, lowTop: -0.55, upBot: 0.55, upTop: 1.95 },
];

// De indre skallene. De er små og når ikke naboene, så de splittes knapt.
const CORE = [
  { e: -2.05, name: "2p" },
  { e: -2.45, name: "2s" },
  { e: -2.95, name: "1s" },
];

const smoothstep = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Kantene til de to ytre gruppene ved relativ avstand r. */
function edges(r) {
  const rr = Math.max(RMIN, Math.min(RMAX, r));
  let i = 0;
  while (i < ANCHORS.length - 2 && rr < ANCHORS[i + 1].r) i++;
  const a = ANCHORS[i];
  const b = ANCHORS[i + 1];
  const t = smoothstep((a.r - rr) / (a.r - b.r));
  const mix = (k) => a[k] + t * (b[k] - a[k]);
  return {
    lowBot: mix("lowBot"),
    lowTop: mix("lowTop"),
    upBot: mix("upBot"),
    upTop: mix("upTop"),
  };
}

/** Halv tykkelse på en indre skallstrek. Vokser så vidt merkbart innerst. */
const coreHalf = (r) => 0.006 + 0.05 * smoothstep((1.6 - r) / 0.85);

/**
 * Hvor langt omorganiseringen til sp³ er kommet: 0 i den atomære enden, 1 ved
 * Si. Den styrer bare bokføringen (hvor mange tilstander hver gruppe har og
 * hvor mange elektroner som sitter i dem), ikke formen på kurvene.
 */
const hyb = (r) => smoothstep((2.4 - r) / 1.4);

export default function init({ stage, controls, getSize, onResize, signal }) {
  let r = 2.4; // start i den atomære enden, der historien begynner

  const label = document.createElement("label");
  label.append("Gitteravstand ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(RMIN);
  input.max = String(RMAX);
  input.step = "0.01";
  input.value = String(r);
  input.setAttribute("aria-label", "Relativ gitteravstand, i enheter av silisiums egen");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      r = Number(input.value);
      sync();
      render();
    },
    { signal },
  );

  const jump = document.createElement("button");
  jump.type = "button";
  jump.className = "sim-btn";
  jump.textContent = "Hopp til Si";
  jump.addEventListener(
    "click",
    () => {
      r = 1;
      input.value = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { signal },
  );

  // Én utlesning, slik de andre simene i emnet gjør det. Tellingen er hele
  // poenget, så den står først i teksten. Rammeverkets .sim-readout eier
  // utseendet: fyll, ramme, radius, mono-typen og aksentfargen på <b>.
  const readout = document.createElement("div");
  readout.className = "sim-readout";

  controls.append(label, jump, readout);

  const num = (n, d) => n.toFixed(d).replace(".", ",");
  const P = (n) => n.toFixed(1);

  function sync() {
    const nm = `${num(r * A_SI, 2)} Å`;
    out.textContent = r === 1 ? `${nm} (Si)` : `${nm} = ${num(r, 2)} × Si`;
  }

  function render() {
    const { w, h } = getSize();

    const padL = 34;
    const padR = 12;
    const padT = 16;
    const padB = 30;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    const X = (rr) => padL + ((rr - RMIN) / (RMAX - RMIN)) * pw;
    const Y = (e) => padT + ph - ((e - EMIN) / (EMAX - EMIN)) * ph;

    /** Et bånd som lukket polygon: fram langs toppen, tilbake langs bunnen. */
    function band(top, bot) {
      const n = 110;
      const up = [];
      const down = [];
      for (let i = 0; i <= n; i++) {
        const rr = RMIN + ((RMAX - RMIN) * i) / n;
        up.push(`${P(X(rr))},${P(Y(top(rr)))}`);
        down.push(`${P(X(rr))},${P(Y(bot(rr)))}`);
      }
      return up.concat(down.reverse()).join(" ");
    }

    const lower = band(
      (rr) => edges(rr).lowTop,
      (rr) => edges(rr).lowBot,
    );
    const upper = band(
      (rr) => edges(rr).upTop,
      (rr) => edges(rr).upBot,
    );

    const cores = CORE.map(
      (c) =>
        `<polygon points="${band(
          (rr) => c.e + coreHalf(rr),
          (rr) => c.e - coreHalf(rr),
        )}" style="fill:var(--fg)" opacity="0.5"/>` +
        `<text x="${P(padL + pw - 6)}" y="${P(Y(c.e) - 5)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">${c.name}</text>`,
    ).join("");

    const axes =
      `<path d="M ${P(padL)} ${P(padT + ph)} H ${P(padL + pw)}" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<text x="22" y="${P(padT + ph / 2)}" text-anchor="middle" transform="rotate(-90 22 ${P(padT + ph / 2)})" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">Elektronenergi</text>` +
      `<path d="M 30 ${P(padT + ph)} V ${P(padT + 2)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M 30 ${P(padT)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>` +
      `<text x="${P(padL + 2)}" y="${P(padT + ph + 15)}" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">← presset sammen</text>` +
      `<text x="${P(padL + pw)}" y="${P(padT + ph + 15)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">frie atomer →</text>`;

    // Ytterskallets to streker navngis der de fortsatt er atomnivåer.
    const shellLabels =
      `<text x="${P(padL + pw - 6)}" y="${P(Y(ANCHORS[0].upTop) - 5)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">3p</text>` +
      `<text x="${P(padL + pw - 6)}" y="${P(Y(ANCHORS[0].lowTop) - 5)}" text-anchor="end" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">3s</text>`;

    // Si-markøren, med det eneste tallet på energiaksen.
    const siX = X(1);
    const siE = edges(1);
    const marker =
      `<path d="M ${P(siX)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 4" opacity="0.8"/>` +
      `<path d="M ${P(siX)} ${P(Y(siE.lowTop))} V ${P(Y(siE.upBot))}" stroke="var(--accent)" stroke-width="1.5"/>` +
      // Etiketten står til venstre for markøren: der er gruppene lengst fra
      // hverandre, så teksten kan ikke havne oppå en båndkant. På en smal
      // skjerm er det ikke plass, og da står bare E_g igjen; tallet står
      // uansett i utlesningen.
      (siX - padL > 95
        ? `<text x="${P(siX - 7)}" y="${P(Y((siE.lowTop + siE.upBot) / 2) + 4)}" text-anchor="end" style="fill:var(--accent);font-family:var(--font-mono);font-size:11px">E<tspan dy="3" font-size="9">g</tspan><tspan dy="-3"> ≈ 1,1 eV</tspan></text>`
        : `<text x="${P(siX + 6)}" y="${P(Y((siE.lowTop + siE.upBot) / 2) + 4)}" style="fill:var(--accent);font-family:var(--font-mono);font-size:11px">E<tspan dy="3" font-size="9">g</tspan></text>`) +
      `<text x="${P(siX)}" y="${P(padT - 4)}" text-anchor="middle" style="fill:var(--accent);font-family:var(--font-mono);font-size:11px">Si · 5,43 Å</text>`;

    // Snittet brukeren står i: to loddrette søyler som viser hvilke tilstander
    // som finnes der, og hvor mange av dem som er fylt. Fylte tilstander er
    // massive, tomme er bare omriss.
    const e = edges(r);
    const x = X(r);
    const bw = 9;
    const fUp = (2 - 2 * hyb(r)) / (6 - 2 * hyb(r));

    const filled = (bot, top, frac, color) => {
      const yb = Y(bot);
      const yt = Y(top);
      const hh = yb - yt;
      return (
        `<rect x="${P(x - bw / 2)}" y="${P(yt)}" width="${bw}" height="${P(Math.max(1.5, hh))}" rx="2" fill="none" stroke="${color}" stroke-width="1.2"/>` +
        (frac > 0.01
          ? `<rect x="${P(x - bw / 2)}" y="${P(yb - hh * frac)}" width="${bw}" height="${P(Math.max(1.5, hh * frac))}" rx="2" style="fill:var(--fg)"/>`
          : "")
      );
    };

    const cursor =
      `<path d="M ${P(x)} ${P(padT)} V ${P(padT + ph)}" stroke="var(--fg)" stroke-width="1" opacity="0.35"/>` +
      filled(e.lowBot, e.lowTop, 1, "var(--fg)") +
      filled(e.upBot, e.upTop, fUp, "var(--accent)");

    const merged = e.lowTop >= e.upBot;
    // E_c og E_v er navn på båndkanter, så de settes bare på når gruppene
    // faktisk er bånd med et gap imellom.
    const gapMark =
      merged || hyb(r) < 0.5 || Math.abs(r - 1) < 0.1
        ? ""
        : `<text x="${P(x + 8)}" y="${P(Y(e.upBot) - 4)}" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">E<tspan dy="3" font-size="9">c</tspan></text>` +
          `<text x="${P(x + 8)}" y="${P(Y(e.lowTop) + 12)}" style="fill:var(--muted);font-family:var(--font-mono);font-size:11px">E<tspan dy="3" font-size="9">v</tspan></text>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      axes +
      cores +
      shellLabels +
      `<polygon points="${lower}" style="fill:var(--fg)" opacity="0.16"/>` +
      `<polygon points="${lower}" fill="none" stroke="var(--fg)" stroke-width="1.5" opacity="0.75"/>` +
      `<polygon points="${upper}" style="fill:var(--accent)" opacity="0.16"/>` +
      `<polygon points="${upper}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>` +
      marker +
      cursor +
      gapMark +
      `</svg>`;

    readout.innerHTML = describe(merged);
  }

  /** Tellingen, med de tre tallene i <b> slik rammeverket farger dem. */
  function count(merged) {
    const sp3 = hyb(r) >= 0.5;
    const over = merged ? "ingen gap" : sp3 ? "4N" : "6N";
    const under = merged ? "ingen gap" : sp3 ? "4N" : "2N";
    return `Over gapet <b>${over}</b>, under gapet <b>${under}</b>, elektroner <b>4N</b>. `;
  }

  function describe(merged) {
    const sp3 = hyb(r) >= 0.5;
    const site = `Snittet står ved <b>${num(r * A_SI, 2)} Å</b>, altså ${num(r, 2)} ganger silisiums egen avstand. `;

    const state = merged
      ? "De to gruppene overlapper her, så det finnes ikke noe gap å snakke om."
      : sp3
        ? "Manifolden har delt seg i to, elektronene fyller den nedre gruppen nøyaktig, og den øvre står tom: valensbånd og ledningsbånd."
        : "3s og 3p ligger som to nesten skarpe streker, og atomene merker knapt hverandre.";

    const rule =
      " Bredden settes av overlappen mellom naboene, altså av avstanden. Antallet settes av N. Ved Si-markøren er gapet <b>1,12 eV</b>.";

    return site + count(merged) + state + rule;
  }

  sync();
  onResize(render);
  render();
}
