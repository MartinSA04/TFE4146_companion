/**
 * Ett elektron, med og uten felt, for TFE4146 modul 03.
 * Én idé: feltet gir hver fri flukt et lite dytt mot feltet, og hver kollisjon gir
 * elektronet en ny, tilfeldig fart, så det feltet ga, er borte. Elektronet driver
 * derfor med en jevn fart, proporsjonal med feltet.
 *
 * Øverst står det samme elektronet tegnet to ganger fra samme start og med de samme
 * kollisjonene: samme flukttider og samme fart etter hver kollisjon. Den grå banen er
 * uten felt, den blå med. Feltet virker bare langs x, så de to banene har alltid samme
 * y, og avstanden mellom prikkene er summen av ½at² over fluktene. Den bare vokser,
 * i snitt med farten a·t̄ = v_d.
 *
 * Nederst står båndskjemaet på den samme x-aksen: E_c stiger mot høyre i et felt mot
 * høyre, og prikken står ved den totale energien til det blå elektronet, E_c(x) pluss
 * den kinetiske energien. Under en flukt er den totale energien konstant, så sporet går
 * vannrett; i kollisjonen trekkes en ny termisk fart, og sporet hopper. I snitt går
 * sporet ned bakken: energien feltet ga, går til gitteret.
 *
 * Tallene er en tegning, ikke silisium: flukttiden er 0,3 s, den midlere farten 60 px/s,
 * og driften ved 2ℰ er 0,4 av den termiske farten. I staven fra modulens start er
 * forholdet 10⁻⁴.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const TBAR = 0.3; // s, midlere tid mellom kollisjoner
const SIGMA = 48; // px/s, Rayleigh-parameteren; midlere fart 1,2533·SIGMA ≈ 60 px/s
const A1 = 40; // px/s², akselerasjonen ved feltet ℰ; drift a·t̄ = 12 px/s
const KE_MEAN = 8; // px, midlere kinetisk energi i båndskjemaet
const C_KE = KE_MEAN / (2 * SIGMA * SIGMA); // px energi per (px/s)²
const NFLIGHTS = 160;
const SAMPLE = 1 / 40; // s, mellom punktene på banene
const T_MAX = 24; // s, lengste løp før en ny bane
const PAUSE_END = 1.2; // s, stopp før en ny bane

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let field = 1; // 0, 1, 2 ganger ℰ
  let playing = !reduced;

  // ── kontroller ────────────────────────────────────────────────────────────
  const fieldRow = choiceRow({
    ariaLabel: "Feltstyrke",
    label: "Felt",
    items: [
      { value: "0", label: "av" },
      { value: "1", label: "ℰ" },
      { value: "2", label: "2ℰ" },
    ],
    onPick: (v) => {
      field = Number(v);
      fieldRow.sync(String(field));
      if (!playing) t = Math.min(t, tEnd());
      draw();
    },
    signal,
  });

  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "sim-btn";
  newBtn.textContent = "Ny bane";
  newBtn.addEventListener("click", () => { reset(); if (!playing) t = tEnd(); draw(); start(); }, { signal });

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "sim-btn";
  const syncPlay = () => { playBtn.textContent = playing ? "Pause" : "Spill av"; };
  playBtn.addEventListener("click", () => { playing = !playing; syncPlay(); start(); }, { signal });
  syncPlay();

  controls.append(fieldRow.el, newBtn, playBtn);
  fieldRow.sync(String(field));

  // ── modellen ──────────────────────────────────────────────────────────────
  // Hver flukt: varighet og fart rett etter kollisjonen, delt av begge kopiene.
  let flights = [];
  let starts = []; // starttiden til hver flukt
  let t = 0; // s, tiden i løpet
  let ended = -1; // tiden løpet tok slutt, −1 mens det går
  const g = {};

  // Farten etter en kollisjon: Rayleigh-fordelt, som en todimensjonal Maxwell-fordeling,
  // kuttet ved 2,2σ så de sjeldne, svært raske elektronene ikke tar over båndskjemaet.
  const rayleigh = () => {
    for (;;) {
      const v = SIGMA * Math.sqrt(-2 * Math.log(1 - Math.random()));
      if (v < 2.2 * SIGMA) return v;
    }
  };
  function reset() {
    flights = [];
    starts = [];
    let s = 0;
    for (let i = 0; i < NFLIGHTS; i++) {
      const v = rayleigh();
      const th = 2 * Math.PI * Math.random();
      const dur = -TBAR * Math.log(1 - Math.random());
      flights.push({ vx: v * Math.cos(th), vy: v * Math.sin(th), dur });
      starts.push(s);
      s += dur;
    }
    t = 0;
    ended = -1;
  }

  const acc = () => -A1 * field; // feltet peker mot høyre, elektronet trekkes mot venstre

  /** Tilstanden ved tiden t: x for begge kopiene, ufoldet y, fart og indeks for flukten. */
  function stateAt(tt) {
    const a = acc();
    let xg = 0, xb = 0, y = 0;
    let i = 0;
    while (i < flights.length - 1 && starts[i + 1] <= tt) {
      const f = flights[i];
      xg += f.vx * f.dur;
      xb += f.vx * f.dur + 0.5 * a * f.dur * f.dur;
      y += f.vy * f.dur;
      i++;
    }
    const f = flights[i];
    const s = tt - starts[i];
    const k = g.k;
    return {
      i, s,
      xg: k * (xg + f.vx * s),
      xb: k * (xb + f.vx * s + 0.5 * a * s * s),
      y: k * (y + f.vy * s),
      // der flukten startet, for energisporet
      xb0: k * xb,
    };
  }

  // Bretter y inn mellom veggene: speiling i veggene, likt for begge kopiene.
  function foldY(y) {
    const span = g.yBot - g.yTop;
    const u = (((y % (2 * span)) + 2 * span) % (2 * span));
    return g.yTop + (u <= span ? u : 2 * span - u);
  }

  /** Når løpet tar slutt: en prikk når kanten, eller tiden er ute. */
  function tEnd() {
    for (let tt = 0; tt <= T_MAX; tt += SAMPLE) {
      const st = stateAt(tt);
      const xg = g.x0 + st.xg;
      const xb = g.x0 + st.xb;
      if (xb < g.xL + 6 || xg < g.xL + 6 || xb > g.xR - 6 || xg > g.xR - 6) return tt;
    }
    return T_MAX;
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  // Fysikken regnes i enheter der krystallen er 340 bred; k skalerer til skjermen,
  // så banene og båndskjemaet ser like ut på telefon og stor skjerm.
  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.xL = 10;
    g.xR = w - 10;
    g.topY0 = 30; // øverste panel: krystallen
    g.topY1 = Math.round(h * 0.58);
    g.yTop = g.topY0 + 8;
    g.yBot = g.topY1 - 8;
    g.botY0 = g.topY1 + 22; // nederste panel: båndskjemaet
    g.botY1 = h - 6;
    g.k = (g.xR - g.xL) / 340;
    g.x0 = g.xL + 0.64 * (g.xR - g.xL);
    g.y0 = (g.yTop + g.yBot) / 2;
    g.xMid = (g.xL + g.xR) / 2;
    // E_c dreier om midten av panelet og står litt under midten, så det er plass til
    // kinetisk energi over.
    g.ePivot = g.botY0 + 0.6 * (g.botY1 - g.botY0);
  }

  const slope = () => (2 * C_KE * A1 * field) / g.k; // px energi per skjerm-px mot høyre
  const ecY = (x) => g.ePivot - slope() * (x - g.xMid);

  // ── tegning ───────────────────────────────────────────────────────────────
  const mono = "font-family:var(--font-mono);font-size:11px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};${mono}" paint-order="stroke" stroke="var(--canvas-bg)" stroke-width="3">${text}</text>`;
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
  const star = (x, y) => `M ${P(x - 3)} ${P(y - 3)} L ${P(x + 3)} ${P(y + 3)} M ${P(x - 3)} ${P(y + 3)} L ${P(x + 3)} ${P(y - 3)} `;

  function draw() {
    if (!g.w) return;
    const { w, h, xL, xR, topY0, topY1, botY0, botY1, x0 } = g;
    const a = acc();
    const cur = stateAt(t);

    // Banene, samplet i tid; y er felles for begge.
    let pg = "", pb = "", ticksG = "", ticksB = "";
    let lastI = 0;
    for (let tt = 0; ; tt += SAMPLE) {
      const done = tt >= t;
      const st = stateAt(done ? t : tt);
      const y = foldY(g.y0 + st.y);
      const xg = x0 + st.xg;
      const xb = x0 + st.xb;
      pg += `${pg ? "L" : "M"} ${P(xg)} ${P(y)} `;
      pb += `${pb ? "L" : "M"} ${P(xb)} ${P(y)} `;
      if (done) break;
      if (st.i !== lastI) lastI = st.i;
    }
    // Kollisjonspunktene, eksakt.
    {
      const k = g.k;
      let xg = 0, xb = 0, y = 0;
      for (let i = 0; i < cur.i; i++) {
        const f = flights[i];
        xg += f.vx * f.dur;
        xb += f.vx * f.dur + 0.5 * a * f.dur * f.dur;
        y += f.vy * f.dur;
        const yy = foldY(g.y0 + k * y);
        ticksG += star(x0 + k * xg, yy);
        ticksB += star(x0 + k * xb, yy);
      }
    }

    const yNow = foldY(g.y0 + cur.y);
    const xgNow = x0 + cur.xg;
    const xbNow = x0 + cur.xb;

    let svg = "";
    // Krystallen.
    svg += `<rect x="${P(xL)}" y="${P(topY0)}" width="${P(xR - xL)}" height="${P(topY1 - topY0)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1"/>`;
    // Forklaringen til venstre over krystallen, feltet til høyre.
    svg +=
      `<path d="M ${P(xL + 2)} ${P(14)} h 14" stroke="var(--indigo)" stroke-width="2"/>` +
      tag(xL + 20, 18, "med felt") +
      `<path d="M ${P(xL + 92)} ${P(14)} h 14" stroke="var(--muted)" stroke-width="2"/>` +
      tag(xL + 110, 18, "uten felt");
    if (field > 0) {
      const len = 30 * field;
      svg += arrow(xR - 4 - len, 14, xR - 4, 14, "var(--fg)", 1.8);
      svg += tag(xR - 10 - len, 18, "ℰ", "end", "var(--fg)");
    } else {
      svg += tag(xR - 4, 18, "ℰ = 0", "end", "var(--fg)");
    }

    svg += `<g fill="none" stroke-linejoin="round" stroke-linecap="round">`;
    svg += `<path d="${pg}" stroke="var(--muted)" stroke-width="1.4" opacity="0.75"/>`;
    svg += `<path d="${ticksG}" stroke="var(--muted)" stroke-width="1.1" opacity="0.75"/>`;
    // Uten felt ligger den blå banen oppå den grå.
    svg += `<path d="${pb}" stroke="var(--indigo)" stroke-width="1.6"/>`;
    svg += `<path d="${ticksB}" stroke="var(--indigo)" stroke-width="1.1"/>`;
    svg += `</g>`;
    // Avstanden mellom prikkene: driften.
    const gap = xgNow - xbNow;
    if (field > 0 && gap > 14) {
      svg += `<path d="M ${P(xgNow - 5)} ${P(yNow)} L ${P(xbNow + 5)} ${P(yNow)}" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3"/>`;
      if (gap > 46) svg += tag((xgNow + xbNow) / 2, yNow - 7, "drift", "middle", "var(--fg)");
    }
    svg += `<circle cx="${P(xgNow)}" cy="${P(yNow)}" r="4.2" fill="var(--canvas-bg)" stroke="var(--muted)" stroke-width="1.6"/>`;
    svg += `<circle cx="${P(xbNow)}" cy="${P(yNow)}" r="4.2" style="fill:var(--indigo)"/>`;

    // Båndskjemaet for det blå elektronet.
    const ecL = ecY(xL), ecR = ecY(xR);
    svg += `<path d="M ${P(xL)} ${P(botY0)} V ${P(botY1)}" stroke="var(--border-strong)" stroke-width="1"/>`;
    svg += arrow(xL, botY1, xL, botY0 - 6, "var(--muted)", 1);
    svg += tag(xL + 6, botY0 + 4, "E");
    svg += `<path d="M ${P(xL)} ${P(ecL)} L ${P(xR)} ${P(ecR)}" stroke="var(--fg)" stroke-width="1.6"/>`;
    svg += tag(xR - 4, ecR + 15, "E<tspan dy='3' font-size='9'>c</tspan>", "end", "var(--fg)");

    // Energisporet: vannrett under hver flukt, hopp i hver kollisjon.
    const k = g.k;
    let ep = "";
    {
      let xb = x0;
      for (let i = 0; i <= cur.i; i++) {
        const f = flights[i];
        const e = ecY(xb) - C_KE * (f.vx * f.vx + f.vy * f.vy); // skjerm-y for totalenergien
        const dur = i < cur.i ? f.dur : cur.s;
        const xEnd = xb + k * (f.vx * dur + 0.5 * a * dur * dur);
        // x er ikke monoton i en flukt, men sporet er vannrett, så ytterpunktene holder.
        let lo = xb, hi = xb;
        for (let j = 1; j <= 8; j++) {
          const s = (dur * j) / 8;
          const xx = xb + k * (f.vx * s + 0.5 * a * s * s);
          lo = Math.min(lo, xx);
          hi = Math.max(hi, xx);
        }
        ep += `${ep ? "L" : "M"} ${P(xb)} ${P(e)} M ${P(lo)} ${P(e)} L ${P(hi)} ${P(e)} M ${P(xEnd)} ${P(e)} `;
        xb = xEnd;
      }
    }
    // Hoppene mellom flukter: loddrette streker.
    let jumps = "";
    {
      let xb = x0;
      let prevE = null;
      for (let i = 0; i <= cur.i; i++) {
        const f = flights[i];
        const e = ecY(xb) - C_KE * (f.vx * f.vx + f.vy * f.vy);
        if (prevE !== null) jumps += `M ${P(xb)} ${P(prevE)} L ${P(xb)} ${P(e)} `;
        prevE = e;
        xb += k * (f.vx * f.dur + 0.5 * a * f.dur * f.dur);
      }
    }
    const eNow = ecY(x0 + cur.xb0) - C_KE * (flights[cur.i].vx ** 2 + flights[cur.i].vy ** 2);
    svg += `<g fill="none" stroke="var(--indigo)" stroke-linecap="round">`;
    svg += `<path d="${ep}" stroke-width="1.4" opacity="0.85"/>`;
    svg += `<path d="${jumps}" stroke-width="1" opacity="0.5"/>`;
    svg += `</g>`;
    // Den kinetiske energien nå: fra E_c opp til prikken.
    const ecNow = ecY(xbNow);
    svg += `<path d="M ${P(xbNow)} ${P(ecNow)} L ${P(xbNow)} ${P(eNow)}" stroke="var(--indigo)" stroke-width="1" stroke-dasharray="2 2"/>`;
    svg += `<circle cx="${P(xbNow)}" cy="${P(eNow)}" r="4.2" style="fill:var(--indigo)"/>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-label="Et elektron i krystallen med og uten felt, og energien til elektronet i båndskjemaet." style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    if (ended < 0) {
      t += dt;
      const te = tEndCached();
      if (t >= te) { t = te; ended = 0; }
    } else {
      ended += dt;
      if (ended > PAUSE_END) { reset(); endCache = null; }
    }
    draw();
    if (playing && visible) raf = requestAnimationFrame(frame);
  }
  // Slutten av løpet avhenger av feltet; regn den på nytt bare når den kan ha endret seg.
  let endCache = null;
  function tEndCached() {
    const key = `${field}|${flights.length}|${g.w}|${g.h}|${flights[0]?.dur}`;
    if (!endCache || endCache.key !== key) endCache = { key, v: tEnd() };
    return endCache.v;
  }
  function start() {
    if (raf || !playing || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }, { threshold: 0 });
  io.observe(stage);
  signal.addEventListener("abort", () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); }, { once: true });

  layout();
  reset();
  if (!playing) t = tEndCached();
  draw();
  onResize(() => { layout(); endCache = null; if (!playing) t = Math.min(t, tEndCached()); draw(); });
  start();
}
