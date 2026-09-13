/**
 * pn-overgangen i likevekt og med spenning, for TFE4146 modul 05.
 * Én idé: romladningssonen og barrieren styrer strømmen. Sonen er bred og
 * tom for bærere, ligger mest på den lett dopede siden, vokser i
 * sperreretningen og krymper i lederetningen; strømmen er null i likevekt,
 * praktisk talt null i sperreretningen og vokser eksponentielt i
 * lederetningen.
 *
 * Øverst står dioden sett fra siden: p-siden til venstre med hull (røde
 * prikker), n-siden til høyre med elektroner (blå prikker). Romladningssonen
 * er tonet og har stiplede kanter, er tom for prikker og fylt med de faste
 * ionene som ringer, ⊖ på p-siden og ⊕ på n-siden, med feltet fra ⊕ til ⊖
 * som pil. Hver prikk har et fast lodd u og står på kvantilen u + fase i sin
 * nøytrale del, så prikkene glir ut av sonen når den vokser og fyller den
 * igjen når den krymper, og hele skyen strømmer mot sonen når fasen
 * øker. Fasen øker med strømmen: en prikk som når sonekanten, krysser
 * sonen, går videre på den andre siden og blekner (rekombinerer), mens
 * loddet dukker opp igjen ved kontakten. I likevekt og i sperreretningen
 * står skyen stille, og bare de termiske bidragene krysser: diffusjon over
 * barrieren (rate R0·min(1, e^(V/V_T))) og minoritetsbærere som lages nær
 * sonen og feies ned den (rate R0, uavhengig av V), like sjeldne hver vei
 * i likevekt.
 *
 * I midten står båndskjemaet på samme x-akse, med sonen tonet: E_c og E_v
 * bøyer seg over sonen som to parabler, E_F er flat i likevekt og deler seg
 * i E_Fp og E_Fn med qV, og klammen er barrieren q(V_0 − V) i eV. Nederst
 * står et amperemeter med null et stykke inn på skalaen: viseren følger
 * I ∝ e^(V/V_T) − 1, normert så +0,5 V er fullt utslag, så sperrestrømmen
 * −I_0 er et par prosent og knapt synlig, som den skal.
 *
 * V_T er satt til 0,12 V i tegningen, mye slakere enn de virkelige
 * 0,0259 V, så kneet synes langs hele glidebryteren; bildeteksten sier det.
 * Bredden W, andelene x_p0 og x_n0, V_0 og barrieren regnes ordentlig for
 * Si ved 300 K (ε_r = 11,8, n_i = 1,5·10¹⁰ cm⁻³, k_BT = 0,0259 eV) og tegnes
 * i felles skala, satt så W ved 10¹⁶/10¹⁶ i likevekt (0,43 µm) er 24 % av
 * staven; ved 3·10¹⁶ mot 3·10¹⁵ og −1 V rekker sonen nesten til kontakten
 * på den lette siden. Tettheten av prikker og ioner er ikke i skala med
 * dopingen. Sonens kanter, båndene og viseren slakker mot målet, så hvert
 * bryterdrag spiller en overgang.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KT = 0.0259; // eV
const NI = 1.5e10; // cm⁻³
const EG = 1.11; // eV
const EI = EG / 2 - 0.013; // eV over E_v
const EPS = 11.8 * 8.85e-14; // F/cm
const Q = 1.6e-19; // C

const DOP = [3e15, 1e16, 3e16]; // cm⁻³, glidebryterens tre stillinger
const DOP_LABEL = ["3·10^15 cm⁻³", "10^16 cm⁻³", "3·10^16 cm⁻³"];
const ION_SP = [13, 10, 8]; // px mellom ionekolonner, per stilling
const DOT_K = [0.7, 1, 1.4]; // prikktetthet relativt 10¹⁶
const V_MIN = -1;
const V_MAX = 0.5;

const TAU = 0.5; // s, sonens og båndenes innstillingstid
const NEEDLE_TAU = 0.25; // s, viserens treghet
const R = 3.2; // px, bærerprikkens radius
const R0 = 0.4; // per s og bærertype, termiske krysninger i likevekt
const VT_DRAW = 0.12; // V, tegningens termiske spenning
const VFLOW = 70; // px/s, skyens fart ved fullt utslag
const JIT = 60; // px/s², termisk vandring
const FADE_LEN = 1.0; // s, tid før en injisert bærer har rekombinert

export default function init({ stage, controls, getSize, onResize, signal }) {
  let naI = 1;
  let ndI = 1;
  let v = 0; // V, positiv på p-siden
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const na = () => DOP[naI];
  const nd = () => DOP[ndI];
  const v0 = () => KT * Math.log((na() * nd()) / (NI * NI));
  const barrier = () => v0() - v; // V
  const width = (b) => Math.sqrt(((2 * EPS * b) / Q) * (1 / na() + 1 / nd())); // cm
  const fracN = () => na() / (na() + nd()); // andelen av W som ligger på n-siden
  const wRef = (() => {
    const b = KT * Math.log((1e16 * 1e16) / (NI * NI));
    return Math.sqrt(((2 * EPS * b) / Q) * (2 / 1e16));
  })();
  const bMax = KT * Math.log((DOP[2] * DOP[2]) / (NI * NI)) - V_MIN;
  const iNorm = (x) => (Math.exp(x / VT_DRAW) - 1) / (Math.exp(V_MAX / VT_DRAW) - 1);

  // Det som slakker: sonens to halvdeler (cm), barrieren (V) og viseren.
  let xpCur = width(barrier()) * (1 - fracN());
  let xnCur = width(barrier()) * fracN();
  let bCur = barrier();
  let iShown = iNorm(v);
  const phase = { p: 0, n: 0 }; // skyenes strømningsfase, øker med strømmen

  // ── kontroller ────────────────────────────────────────────────────────────
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
        changed();
      },
      { signal },
    );
    return { el: label, out };
  };

  const naS = slider({
    text: "Akseptorer",
    min: 0,
    max: 2,
    step: 1,
    value: naI,
    aria: "Akseptortetthet på p-siden",
    onInput: (x) => (naI = x),
  });
  const ndS = slider({
    text: "Donorer",
    min: 0,
    max: 2,
    step: 1,
    value: ndI,
    aria: "Donortetthet på n-siden",
    onInput: (x) => (ndI = x),
  });
  const vS = slider({
    text: "Spenning",
    min: V_MIN,
    max: V_MAX,
    step: 0.05,
    value: v,
    aria: "Påtrykt spenning i volt, positiv på p-siden",
    onInput: (x) => (v = Math.round(x * 100) / 100),
  });

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  playBtn.textContent = playing ? "Pause" : "Spill av";
  playBtn.addEventListener(
    "click",
    () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Spill av";
      start();
    },
    { signal },
  );

  controls.append(naS.el, ndS.el, vS.el, playBtn);

  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",");
  function sync() {
    naS.out.textContent = DOP_LABEL[naI];
    ndS.out.textContent = DOP_LABEL[ndI];
    vS.out.textContent = v === 0 ? "likevekt" : `${v > 0 ? "+" : "−"}${NB(Math.abs(v))} V`;
  }

  function changed() {
    sync();
    if (!playing) snap();
    render();
    start();
  }

  function snap() {
    const b = barrier();
    bCur = b;
    xpCur = width(b) * (1 - fracN());
    xnCur = width(b) * fracN();
    iShown = iNorm(v);
    transit.length = 0;
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const g = {};
  const homes = { p: [], n: [] };
  const transit = [];

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 30;
    g.bx1 = w - 30;
    g.L = g.bx1 - g.bx0;
    g.xJ = g.bx0 + g.L / 2;
    g.by0 = 14;
    g.barH = 84;
    g.by1 = g.by0 + g.barH;
    g.mid = g.by0 + g.barH / 2;
    g.yTop = g.by1 + 40;
    g.my = h - 20;
    g.yBot = g.my - 34;
    g.zero = g.bx0 + 0.2 * g.L;
    g.pxPerCm = (0.24 * g.L) / wRef;
    g.sPx = (g.yBot - g.yTop) / (EG + bMax + 0.3);

    // Like mange prikker per flate, med rom for den tetteste dopingen.
    const base = clamp(Math.round((g.L * g.barH) / 900), 20, 80);
    const nMax = Math.round(base * DOT_K[2]);
    for (const side of ["p", "n"]) {
      if (homes[side].length !== nMax) {
        homes[side] = Array.from({ length: nMax }, () => ({
          u: Math.random(),
          hy: Math.random(),
          jx: 0,
          jy: 0,
        }));
      }
    }
    g.base = base;
  }

  const edges = () => ({
    xp: g.xJ - xpCur * g.pxPerCm,
    xn: g.xJ + xnCur * g.pxPerCm,
  });
  const yE = (E) => g.yBot - (E + 0.15) * g.sPx;
  const yDot = (hy) => g.by0 + R + 4 + hy * (g.barH - 2 * R - 8);
  /** Den nøytrale delen prikkene får stå i, fra kontakten til sonekanten. */
  const span = (side, xp, xn) =>
    side === "p" ? { from: g.bx0 + R + 1, to: xp - R - 1 } : { from: g.bx1 - R - 1, to: xn + R + 1 };
  const kOf = (side) => Math.round(g.base * DOT_K[side === "p" ? naI : ndI]);

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}${extra}">${text}</text>`;
  const sub = (base, s) => `${base}<tspan dy='3' font-size='9'>${s}</tspan>`;
  const arrow = (x1, y1, x2, y2, color, width = 1.5) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const hx = x2 - 7 * Math.cos(ang);
    const hy = y2 - 7 * Math.sin(ang);
    const px = 3.5 * Math.sin(ang);
    const py = -3.5 * Math.cos(ang);
    return (
      `<path d="M ${P(x1)} ${P(y1)} L ${P(hx)} ${P(hy)}" stroke="${color}" stroke-width="${width}" fill="none"/>` +
      `<path d="M ${P(x2)} ${P(y2)} L ${P(hx + px)} ${P(hy + py)} L ${P(hx - px)} ${P(hy - py)} Z" style="fill:${color}"/>`
    );
  };
  const red = "var(--red)";
  const blue = "var(--indigo)";

  /** Et fast ion: en ring med fortegnet inni. */
  const ion = (x, y, positive, alpha) =>
    `<g opacity="${P(alpha)}" stroke="${positive ? red : blue}" stroke-width="1.2" fill="none">` +
    `<circle cx="${P(x)}" cy="${P(y)}" r="4.2"/>` +
    `<path d="M ${P(x - 2.2)} ${P(y)} h 4.4${positive ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""}"/>` +
    `</g>`;

  function render() {
    const { w, h, bx0, bx1, L, xJ, by0, by1, barH, mid, yTop, yBot, my, zero } = g;
    const { xp, xn } = edges();
    const wpx = xn - xp;
    const b = bCur;
    const vCur = v0() - b;
    const fn = fracN();

    let svg = `<defs><clipPath id="pn-bar-clip"><rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}"/></clipPath></defs>`;

    // Ledningene og polariteten.
    if (iShown > 0.03) {
      const sw = 1.5 + 2.5 * clamp(iShown, 0, 1);
      svg += arrow(4, mid, bx0 - 1, mid, "var(--accent)", sw) + arrow(bx1 + 1, mid, w - 4, mid, "var(--accent)", sw);
    } else {
      svg += `<path d="M 4 ${P(mid)} H ${P(bx0)} M ${P(bx1)} ${P(mid)} H ${P(w - 4)}" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    }
    if (Math.abs(v) > 1e-6) {
      const big = ";font-size:var(--text-sm);font-weight:600";
      svg +=
        tag(15, mid - 7, v > 0 ? "+" : "−", "middle", "var(--fg)", big) +
        tag(w - 15, mid - 7, v > 0 ? "−" : "+", "middle", "var(--fg)", big);
    }

    // Staven, med romladningssonen tonet og avgrenset.
    svg += `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(L)}" height="${P(barH)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    let inBar =
      `<rect x="${P(xp)}" y="${P(by0)}" width="${P(wpx)}" height="${P(barH)}" fill="var(--fg)" fill-opacity="0.07"/>` +
      `<path d="M ${P(xp)} ${P(by0)} V ${P(by1)} M ${P(xn)} ${P(by0)} V ${P(by1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
      `<path d="M ${P(xJ)} ${P(by0)} V ${P(by1)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="2 4"/>`;

    // Ionene som er avdekket i sonen, kolonne for kolonne fra overgangen.
    const rows = [by0 + 16, by1 - 16];
    const cols = (sp, extent, dir, positive) => {
      let s = "";
      for (let i = 0; ; i++) {
        const d = (i + 0.5) * sp;
        const alpha = clamp((extent - d) / 5 + 0.5, 0, 1);
        if (alpha < 0.3) break;
        const x = xJ + dir * d;
        for (const y of rows) s += ion(x, y, positive, alpha);
      }
      return s;
    };
    inBar += cols(ION_SP[naI], xJ - xp, -1, false) + cols(ION_SP[ndI], xn - xJ, +1, true);

    // Feltet fra ⊕ til ⊖.
    if (wpx >= 20) {
      const e0 = (2 * b) / (xpCur + xnCur); // V/cm
      const e0max = (2 * bMax) / width(bMax);
      const sw = 1.5 + 2 * clamp(e0 / e0max, 0, 1);
      inBar += arrow(xn - 3, mid, xp + 3, mid, "var(--accent)", sw);
      inBar += tag(xJ, mid - 8, "ℰ", "middle", "var(--accent)", ";font-size:var(--text-sm)");
    }

    // Majoritetsbærerne: jevnt fordelt i sin nøytrale del, fra kontakten til sonekanten.
    let holes = "";
    let elec = "";
    for (const side of ["p", "n"]) {
      const { from, to } = span(side, xp, xn);
      const k = kOf(side);
      const dots = homes[side];
      let s = "";
      for (let i = 0; i < k; i++) {
        const d = dots[i];
        const f = (d.u + phase[side]) % 1;
        const x = from + f * (to - from);
        s += `<circle cx="${P(x + d.jx)}" cy="${P(yDot(d.hy) + d.jy)}" r="${R}" fill-opacity="0.9"/>`;
      }
      if (side === "p") holes += s;
      else elec += s;
    }
    for (const t of transit) {
      const c = `<circle cx="${P(t.x)}" cy="${P(t.y)}" r="${R}" fill-opacity="${P(0.9 * t.alpha)}"/>`;
      if (t.carrier === "p") holes += c;
      else elec += c;
    }
    inBar += `<g style="fill:${red}">${holes}</g><g style="fill:${blue}">${elec}</g>`;
    svg += `<g clip-path="url(#pn-bar-clip)">${inBar}</g>`;

    // p, n og W under staven.
    const yW = by1 + 9;
    svg +=
      tag(bx0 + 2, by1 + 22, "p", "start", "var(--fg)", ";font-size:var(--text-sm)") +
      tag(bx1 - 2, by1 + 22, "n", "end", "var(--fg)", ";font-size:var(--text-sm)") +
      `<path d="M ${P(xp)} ${P(yW - 4)} v 8 M ${P(xp)} ${P(yW)} H ${P(xn)} M ${P(xn)} ${P(yW - 4)} v 8" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
      tag(xJ, by1 + 24, "W", "middle", "var(--fg)");

    // Båndskjemaet på samme x-akse, med sonen tonet.
    const xpPx = Math.max(xJ - xp, 0.5);
    const xnPx = Math.max(xn - xJ, 0.5);
    const Ev = (x) => {
      if (x <= xp) return b;
      if (x >= xn) return 0;
      if (x <= xJ) {
        const t = (x - xp) / xpPx;
        return b - b * (1 - fn) * t * t;
      }
      const s = (xn - x) / xnPx;
      return b * fn * s * s;
    };
    const pts = [];
    const step = Math.max(2, L / 160);
    for (let x = bx0; x < bx1; x += step) pts.push(x);
    pts.push(bx1);
    const pathOf = (off) => pts.map((x, i) => `${i ? "L" : "M"} ${P(x)} ${P(yE(Ev(x) + off))}`).join(" ");
    const cPath = pathOf(EG);
    const vPath = pathOf(0);
    const vBack = pts
      .slice()
      .reverse()
      .map((x) => `L ${P(x)} ${P(yE(Ev(x)))}`)
      .join(" ");
    svg +=
      `<rect x="${P(xp)}" y="${P(yTop)}" width="${P(wpx)}" height="${P(yBot - yTop)}" fill="var(--fg)" fill-opacity="0.05"/>` +
      `<path d="M ${P(xp)} ${P(yTop)} V ${P(yBot)} M ${P(xn)} ${P(yTop)} V ${P(yBot)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    svg += `<path d="${cPath} ${vBack} Z" fill="var(--card-nested)"/>`;
    svg += `<path d="${cPath}" stroke="var(--border-strong)" stroke-width="1.5" fill="none"/>`;
    svg += `<path d="${vPath}" stroke="var(--border-strong)" stroke-width="1.5" fill="none"/>`;
    svg += `<path d="M ${P(xJ)} ${P(yTop)} V ${P(yBot)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="2 4"/>`;
    svg +=
      tag(bx1 + 4, yE(EG) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(bx1 + 4, yE(0) + 4, sub("E", "v"), "start", "var(--fg)");

    // Fermi-nivåene: ett flatt i likevekt, to med spenning.
    const eFn = EI + KT * Math.log(nd() / NI);
    const eFp = b + EI - KT * Math.log(na() / NI);
    const fermi = (x1, x2, E) =>
      `<path d="M ${P(x1)} ${P(yE(E))} H ${P(x2)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
    if (Math.abs(vCur) < 0.01) {
      svg += fermi(bx0, bx1, eFn) + tag(bx1 + 4, Math.max(yE(eFn) + 4, yE(EG) + 15), sub("E", "F"), "start", "var(--accent)");
    } else {
      svg +=
        fermi(bx0, xp + Math.min(12, wpx / 2), eFp) +
        fermi(xn - Math.min(12, wpx / 2), bx1, eFn) +
        tag(bx0 - 4, yE(eFp) + 4, sub("E", "Fp"), "end", "var(--accent)") +
        tag(bx1 + 4, Math.max(yE(eFn) + 4, yE(EG) + 15), sub("E", "Fn"), "start", "var(--accent)");
    }

    // Barrieren q(V_0 − V) som klamme på n-siden, med E_c fra p-siden forlenget.
    const xb = xn + 14;
    const yLo = yE(EG);
    const yHi = yE(EG + b);
    svg +=
      `<path d="M ${P(xp)} ${P(yHi)} H ${P(xb + 4)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
      `<path d="M ${P(xb)} ${P(yHi)} V ${P(yLo)} M ${P(xb - 3)} ${P(yHi)} h 6 M ${P(xb - 3)} ${P(yLo)} h 6" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
      tag(Math.min(xb, bx1 - 24), yHi - 5, `${NB(b)} eV`, "middle", "var(--fg)");

    // Amperemeteret: null et stykke inn, fullt utslag ved +0,5 V.
    let ticks = "";
    for (let i = 0; i <= 8; i++) {
      const x = zero + (i / 8) * (bx1 - zero);
      ticks += `M ${P(x)} ${P(my)} V ${P(my + (i % 4 === 0 ? 7 : 3))} `;
    }
    const xN = clamp(zero + iShown * (bx1 - zero), bx0, bx1);
    svg +=
      `<path d="M ${P(bx0)} ${P(my)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(zero, my + 18, "0", "middle") +
      tag(bx0 - 7, my + 4, "I", "end", "var(--fg)") +
      `<path d="M ${P(xN)} ${P(my - 16)} V ${P(my + 7)}" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  const vFlow = () => (v > 0 ? VFLOW * iNorm(v) : 0);

  function spawn(carrier, kind, y) {
    const { xp, xn } = edges();
    // Hull hører hjemme på p-siden og krysser mot høyre; elektroner motsatt.
    const dir = carrier === "p" ? 1 : -1;
    if (kind === "gen") {
      // Et minoritetspar lages på feil side, innen en diffusjonslengde fra sonen.
      const off = 10 + 40 * Math.random();
      transit.push({ carrier, dir, phase: "appear", x: dir > 0 ? xn + off : xp - off, y, jx: 0, jy: 0, alpha: 0 });
    } else {
      transit.push({ carrier, dir, phase: "cross", x: dir > 0 ? xp - 1 : xn + 1, y, jx: 0, jy: 0, alpha: 1 });
    }
  }

  function step(dt) {
    const k = 1 - Math.exp(-dt / TAU);
    const b = barrier();
    const wT = width(b);
    xpCur += (wT * (1 - fracN()) - xpCur) * k;
    xnCur += (wT * fracN() - xnCur) * k;
    bCur += (b - bCur) * k;
    iShown += (iNorm(v) - iShown) * (1 - Math.exp(-dt / NEEDLE_TAU));

    const { xp, xn } = edges();
    const wpx = xn - xp;

    // Skyene strømmer mot sonen med strømmen; et lodd som når kanten, sendes over.
    const vf = vFlow();
    for (const side of ["p", "n"]) {
      const { from, to } = span(side, xp, xn);
      const dphi = vf > 0 ? (vf * dt) / Math.max(20, Math.abs(to - from)) : 0;
      const kk = kOf(side);
      for (let i = 0; i < homes[side].length; i++) {
        const d = homes[side][i];
        d.jx += ((Math.random() - 0.5) * JIT - 3 * d.jx) * dt;
        d.jy += ((Math.random() - 0.5) * JIT - 3 * d.jy) * dt;
        if (i < kk && dphi > 0 && ((d.u + phase[side]) % 1) + dphi >= 1) spawn(side, "flow", yDot(d.hy) + d.jy);
      }
      phase[side] = (phase[side] + dphi) % 1;
    }

    // De termiske bidragene: diffusjon over barrieren og generasjon nær sonen.
    const rd = R0 * Math.min(1, Math.exp(v / VT_DRAW)) * dt;
    const rg = R0 * dt;
    if (Math.random() < rd) spawn("p", "diff", yDot(Math.random()));
    if (Math.random() < rd) spawn("n", "diff", yDot(Math.random()));
    if (Math.random() < rg) spawn("p", "gen", yDot(Math.random()));
    if (Math.random() < rg) spawn("n", "gen", yDot(Math.random()));

    const vCross = Math.max(90, wpx / 0.4);
    const vOn = Math.max(vf, 25);
    for (let i = transit.length - 1; i >= 0; i--) {
      const t = transit[i];
      const wobble = () => {
        t.jx += ((Math.random() - 0.5) * 2 * JIT - 3 * t.jx) * dt;
        t.jy += ((Math.random() - 0.5) * 2 * JIT - 3 * t.jy) * dt;
        t.y += t.jy * dt;
      };
      if (t.phase === "cross") {
        t.x += t.dir * vCross * dt;
        if ((t.dir > 0 && t.x >= xn) || (t.dir < 0 && t.x <= xp)) t.phase = "fade";
      } else if (t.phase === "fade") {
        wobble();
        t.x += (t.dir * vOn + t.jx) * dt;
        t.alpha -= dt / FADE_LEN;
      } else if (t.phase === "appear") {
        t.alpha = Math.min(1, t.alpha + dt / 0.3);
        if (t.alpha >= 1) t.phase = "walk";
      } else if (t.phase === "walk") {
        wobble();
        t.x += (-t.dir * 45 + t.jx) * dt;
        if ((t.dir > 0 && t.x <= xn) || (t.dir < 0 && t.x >= xp)) t.phase = "sweep";
      } else if (t.phase === "sweep") {
        t.x += -t.dir * 260 * dt;
        if ((t.dir > 0 && t.x <= xp) || (t.dir < 0 && t.x >= xn)) t.phase = "merge";
      } else {
        t.x += -t.dir * 20 * dt;
        t.alpha -= dt / 0.35;
      }
      t.y = clamp(t.y, g.by0 + R, g.by1 - R);
      if (t.alpha <= 0) transit.splice(i, 1);
    }
    if (transit.length > 60) transit.splice(0, transit.length - 60);
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    render();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !playing || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    },
    { threshold: 0 },
  );
  io.observe(stage);
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );

  sync();
  layout();
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
