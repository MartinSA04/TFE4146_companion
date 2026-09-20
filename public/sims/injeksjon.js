/**
 * Injeksjon og strømkomponentene i en pn-overgang, for TFE4146 modul 06.
 * Én idé: spenningen setter overskuddet av minoritetsbærere ved kantene av
 * romladningssonen, overskuddet diffunderer innover og rekombinerer, og
 * strømmen skifter fra minoritets- til majoritetsbærere på vei bort fra
 * sonen.
 *
 * Øverst står dioden med bare minoritetsbærerne tegnet: hull (røde prikker)
 * på n-siden og elektroner (blå prikker) på p-siden. Hver prikk går en
 * tilfeldig gange (diffusjon) og dør med raten 1/τ (rekombinasjon); nye
 * lages jevnt i rommet med den raten som holder likevektstettheten (termisk
 * generasjon). Randbetingelsen ved sonekanten er spenningen: i lederetningen
 * kommer nye prikker inn over sonen med raten D·Δρ/L, som er akkurat
 * diffusjonsstrømmen fra profilen Δρ·e^(−x/L); i sperreretningen feies en
 * prikk som når kanten, over sonen med sannsynligheten 1 − e^(V/V_T), så
 * tettheten nær kanten tømmes. Profilen i midten er den analytiske
 * stasjonære, ρ_eq + Δρ·e^(−x/L), med ρ_eq ∝ 1/N_d på n-siden og 1/N_a på
 * p-siden, og prikkskyen er partikkelbildet av den. Kurven slakker mot
 * målet på under et sekund, prikkene med sin levetid, så et bryterdrag
 * spiller oppbyggingen. Skalaen på profilen følger den høyeste kurven, så
 * likevektslinjen synker mot aksen når injeksjonen vokser.
 *
 * Nederst står strømmen delt i hullstrøm (rød) og elektronstrøm (blå) som
 * to stablede bånd med konstant samlet høyde: andelen, ikke størrelsen.
 * Ved sonekantene er delingen I_p(0) : I_n(0) = (D_p/L_p)p_n : (D_n/L_n)n_p,
 * inne i sonen er begge konstante (ingen rekombinasjon der), og utover i
 * hver side dør minoritetsstrømmen ut som e^(−x/L) mens majoritetsstrømmen
 * tar over. Pilene i båndene går den veien bærerne beveger seg, med farten
 * proporsjonal med strømmen; elektronene går motsatt vei av strømmen sin.
 *
 * V_T er 0,12 V i tegningen, mye slakere enn 0,0259 V, så hele kneet ligger
 * på glidebryteren, og sonen er ikke i skala med diffusjonslengdene.
 * D_n/D_p = 35/12,5 som i Si, lik levetid på begge sider, så L_n = 1,67 L_p.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const VT_DRAW = 0.12; // V, tegningens termiske spenning
const V_MIN = -0.5;
const V_MAX = 0.4;
const DN_DP = 35 / 12.5; // D_n/D_p i Si
const TAU = 2; // s, levetid i tegningen
const PROFILE_TAU = 0.9; // s, den tegnede profilens innstilling
const N_EQ = 14; // minoritetsprikker i likevekt på den lett dopede siden
const LP_FRAC = 0.22; // L_p som andel av n-sidens lengde
const R = 3; // px, prikkens radius
const RELAX = 0.35; // s, y-skalaens og sonens innstilling
const CAP = 260; // prikker per side, tak
const CHEV = 22; // px mellom pilene i strømbåndene
const DOPING = [
  { value: "p+n", label: "p⁺n", na: 10, nd: 1 },
  { value: "lik", label: "symmetrisk", na: 1, nd: 1 },
  { value: "pn+", label: "pn⁺", na: 1, nd: 10 },
];

export default function init({ stage, controls, getSize, onResize, signal }) {
  let v = 0; // V, positiv på p-siden
  let dop = "p+n";
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const doping = () => DOPING.find((d) => d.value === dop);
  const expV = () => Math.exp(v / VT_DRAW);
  const iNorm = () => (expV() - 1) / (Math.exp(V_MAX / VT_DRAW) - 1);

  // De to sidene: n-siden har hull som minoritet, p-siden elektroner.
  const sides = {
    n: { dir: 1, color: "var(--red)", walkers: [], acc: 0, inj: 0, dp: 0, rhoEq: 0, L: 0, X: 0 },
    p: { dir: -1, color: "var(--indigo)", walkers: [], acc: 0, inj: 0, dp: 0, rhoEq: 0, L: 0, X: 0 },
  };
  const transit = [];
  let yMax = 1;
  let wzCur = 0;
  let chevPhase = 0;

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

  const vS = slider({
    text: "Spenning",
    min: V_MIN,
    max: V_MAX,
    step: 0.05,
    value: v,
    aria: "Påtrykt spenning i volt, positiv på p-siden",
    onInput: (x) => (v = Math.round(x * 100) / 100),
  });
  const dopRow = choiceRow({
    ariaLabel: "Doping",
    label: "Doping",
    items: DOPING.map((d) => ({ value: d.value, label: d.label })),
    onPick: (val) => {
      dop = val;
      changed();
    },
    signal,
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
  controls.append(vS.el, dopRow.el, playBtn);

  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",");
  function sync() {
    vS.out.textContent = v === 0 ? "likevekt" : `${v > 0 ? "+" : "−"}${NB(Math.abs(v))} V`;
    dopRow.sync(dop);
  }

  function changed() {
    sync();
    layout();
    if (!playing) snap();
    render();
    start();
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  const g = {};

  const wzTarget = () => g.L * (0.05 + 0.03 * clamp(-v / 0.5, -1, 1));

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 30;
    g.bx1 = w - 30;
    g.L = g.bx1 - g.bx0;
    g.xJ = g.bx0 + g.L / 2;
    g.by0 = 12;
    g.barH = 60;
    g.by1 = g.by0 + g.barH;
    g.pTop = g.by1 + 30;
    g.pBot = g.pTop + 106;
    g.cTop = g.pBot + 32;
    g.cBot = h - 22;
    if (!wzCur) wzCur = wzTarget();
    const { na, nd } = doping();
    const cN = 1 / nd;
    const cP = 1 / na;
    const cMax = Math.max(cN, cP);
    const half = g.L / 2 - wzTarget();
    sides.n.L = LP_FRAC * half;
    sides.p.L = sides.n.L * Math.sqrt(DN_DP);
    sides.n.rhoEq = (N_EQ * (cN / cMax)) / half;
    sides.p.rhoEq = (N_EQ * (cP / cMax)) / half;
  }

  const edges = () => ({ xp: g.xJ - wzCur, xn: g.xJ + wzCur });
  /** Sidens lengde fra sonekanten til kontakten, i px. */
  const spanOf = (side) => {
    const { xp, xn } = edges();
    return side === "n" ? g.bx1 - xn : xp - g.bx0;
  };
  /** Absolutt x for en prikk på siden, fra avstanden x fra sonekanten. */
  const absX = (side, x) => {
    const { xp, xn } = edges();
    return side === "n" ? xn + x : xp - x;
  };
  const yIn = (t) => g.by0 + R + 3 + t * (g.barH - 2 * R - 6);

  const dpTarget = (s) => sides[s].rhoEq * (expV() - 1);
  const yMaxTarget = () =>
    1.25 * Math.max(sides.n.rhoEq + Math.max(sides.n.dp, 0), sides.p.rhoEq + Math.max(sides.p.dp, 0));

  /** Stasjonær tetthet på siden, i prikker per px. */
  const rho = (s, x) => sides[s].rhoEq + sides[s].dp * Math.exp(-x / sides[s].L);

  function seed(s) {
    const S = sides[s];
    const X = spanOf(s);
    const N = clamp(Math.round(S.rhoEq * X + S.dp * S.L), 0, CAP);
    const env = S.rhoEq + Math.max(S.dp, 0);
    S.walkers = [];
    let guard = 0;
    while (S.walkers.length < N && guard++ < 20000) {
      const x = Math.random() * X;
      if (Math.random() * env < rho(s, x)) S.walkers.push({ x, y: yIn(Math.random()), alpha: 1, dying: false });
    }
  }

  function snap() {
    wzCur = wzTarget();
    for (const s of ["n", "p"]) {
      sides[s].dp = dpTarget(s);
      seed(s);
    }
    yMax = yMaxTarget();
    transit.length = 0;
  }

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
  const zoneTint = (y0, y1) => {
    const { xp, xn } = edges();
    return (
      `<rect x="${P(xp)}" y="${P(y0)}" width="${P(xn - xp)}" height="${P(y1 - y0)}" fill="var(--fg)" fill-opacity="0.06"/>` +
      `<path d="M ${P(xp)} ${P(y0)} V ${P(y1)} M ${P(xn)} ${P(y0)} V ${P(y1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`
    );
  };

  function render() {
    const { w, bx0, bx1, xJ, by0, by1, barH, pTop, pBot, cTop, cBot } = g;
    const { xp, xn } = edges();
    const mid = by0 + barH / 2;
    const iN = iNorm();
    let svg = `<defs><clipPath id="inj-bar-clip"><rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(barH)}"/></clipPath></defs>`;

    // Ledningene, polariteten og strømretningen.
    if (v > 0.01) {
      const sw = 1.5 + 2.5 * clamp(iN, 0, 1);
      svg += arrow(4, mid, bx0 - 1, mid, "var(--accent)", sw) + arrow(bx1 + 1, mid, w - 4, mid, "var(--accent)", sw);
    } else if (v < -0.01) {
      svg += arrow(bx0 - 1, mid, 4, mid, "var(--muted)", 1.2) + arrow(w - 4, mid, bx1 + 1, mid, "var(--muted)", 1.2);
    } else {
      svg += `<path d="M 4 ${P(mid)} H ${P(bx0)} M ${P(bx1)} ${P(mid)} H ${P(w - 4)}" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    }
    if (Math.abs(v) > 1e-6) {
      const big = ";font-size:var(--text-sm);font-weight:600";
      svg +=
        tag(15, mid - 7, v > 0 ? "+" : "−", "middle", "var(--fg)", big) +
        tag(w - 15, mid - 7, v > 0 ? "−" : "+", "middle", "var(--fg)", big);
    }

    // Staven med bare minoritetsbærerne.
    svg += `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(barH)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    let inBar = zoneTint(by0, by1);
    for (const s of ["n", "p"]) {
      const S = sides[s];
      let dots = "";
      for (const d of S.walkers) {
        dots += `<circle cx="${P(absX(s, d.x))}" cy="${P(d.y)}" r="${R}" fill-opacity="${P(0.9 * d.alpha)}"/>`;
      }
      for (const t of transit) {
        if (t.color !== S.color) continue;
        dots += `<circle cx="${P(t.x)}" cy="${P(t.y)}" r="${R}" fill-opacity="${P(0.9 * t.alpha)}"/>`;
      }
      inBar += `<g style="fill:${S.color}">${dots}</g>`;
    }
    svg += `<g clip-path="url(#inj-bar-clip)">${inBar}</g>`;
    svg +=
      tag(bx0 + 2, by1 + 14, "p", "start", "var(--fg)", ";font-size:var(--text-sm)") +
      tag(bx1 - 2, by1 + 14, "n", "end", "var(--fg)", ";font-size:var(--text-sm)") +
      tag(xJ, by1 + 14, "W", "middle", "var(--fg)");

    // Profilene: minoritetskonsentrasjonen på hver side, felles skala.
    const PH = pBot - pTop;
    const yOf = (r) => pBot - clamp(r / yMax, 0, 1.02) * PH;
    svg += zoneTint(pTop, pBot);
    svg += `<path d="M ${P(bx0)} ${P(pBot)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1"/>`;
    for (const s of ["n", "p"]) {
      const S = sides[s];
      const X = spanOf(s);
      const yBase = yOf(S.rhoEq);
      const pts = [];
      for (let x = 0; x <= X; x += 3) pts.push([absX(s, x), yOf(rho(s, x))]);
      pts.push([absX(s, X), yOf(rho(s, X))]);
      const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${P(x)} ${P(y)}`).join(" ");
      const x0 = absX(s, 0);
      const xEnd = absX(s, X);
      // Arealet mellom likevektslinjen og kurven er den lagrede ladningen.
      svg += `<path d="${line} L ${P(xEnd)} ${P(yBase)} L ${P(x0)} ${P(yBase)} Z" style="fill:${S.color}" fill-opacity="0.18"/>`;
      svg += `<path d="M ${P(x0)} ${P(yBase)} H ${P(xEnd)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3"/>`;
      svg += `<path d="${line}" stroke="${S.color}" stroke-width="2" fill="none"/>`;
      const edgeY = yOf(rho(s, 0));
      const isN = s === "n";
      const name = isN ? sub("p", "n") : sub("n", "p");
      const yName = yBase - pTop < 26 ? yBase + 12 : yBase - 4;
      svg += tag(isN ? bx1 - 2 : bx0 + 2, yName, name, isN ? "end" : "start", "var(--muted)");
      svg += tag(isN ? bx1 - 2 : bx0 + 2, pTop + 10, isN ? `p(${sub("x", "n")})` : `n(${sub("x", "p")})`, isN ? "end" : "start", S.color);
      // Overskuddet ved kanten som klamme, når det synes.
      const gap = yBase - edgeY;
      if (Math.abs(gap) >= 8) {
        const xb = isN ? xn + 3 : xp - 3;
        const yA = Math.min(yBase, edgeY);
        const yB = Math.max(yBase, edgeY);
        svg +=
          `<path d="M ${P(xb)} ${P(yA)} V ${P(yB)} M ${P(xb - 2.5)} ${P(yA)} h 5 M ${P(xb - 2.5)} ${P(yB)} h 5" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
          tag(isN ? xb + 5 : xb - 5, yA - 5, isN ? `Δ${sub("p", "n")}` : `Δ${sub("n", "p")}`, isN ? "start" : "end", "var(--fg)");
      }
      // Ladningen som er lagret, navngitt inne i arealet.
      if (gap >= 30) {
        const xq = absX(s, S.L * 0.45);
        const yq = (yOf(rho(s, S.L * 0.45)) + yBase) / 2 + 4;
        svg += tag(xq, yq, isN ? sub("Q", "p") : sub("Q", "n"), "middle", S.color);
      }
    }
    svg +=
      `<path d="M ${P(xp)} ${P(pBot)} v 4 M ${P(xn)} ${P(pBot)} v 4" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(xJ, pBot + 15, "0", "middle") +
      tag(bx0, pBot + 15, `← ${sub("x", "p")}`, "start") +
      tag(bx1, pBot + 15, `${sub("x", "n")} →`, "end");

    // Strømbåndene: hullstrøm nederst, elektronstrøm øverst, samlet høyde fast.
    const CH = cBot - cTop;
    svg += zoneTint(cTop, cBot);
    if (Math.abs(v) < 0.01) {
      svg +=
        `<path d="M ${P(bx0)} ${P(cBot)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1"/>` +
        tag(xn + 8, cTop + CH / 2 + 4, "I = 0", "start", "var(--fg)");
    } else {
      const aP = sides.n.L * sides.n.rhoEq; // ∝ (D_p/L_p) p_n
      const aN = sides.p.L * sides.p.rhoEq; // ∝ (D_n/L_n) n_p
      const fP = aP / (aP + aN);
      const holeFrac = (x) => {
        if (x < xp) return 1 - (1 - fP) * Math.exp(-(xp - x) / sides.p.L);
        if (x > xn) return fP * Math.exp(-(x - xn) / sides.n.L);
        return fP;
      };
      const xs = [];
      for (let x = bx0; x < bx1; x += 3) xs.push(x);
      xs.push(bx1);
      const yH = (x) => cBot - holeFrac(x) * CH;
      const top = xs.map((x, i) => `${i ? "L" : "M"} ${P(x)} ${P(yH(x))}`).join(" ");
      svg +=
        `<path d="${top} L ${P(bx1)} ${P(cBot)} L ${P(bx0)} ${P(cBot)} Z" style="fill:var(--red)" fill-opacity="0.22"/>` +
        `<path d="${top} L ${P(bx1)} ${P(cTop)} L ${P(bx0)} ${P(cTop)} Z" style="fill:var(--indigo)" fill-opacity="0.22"/>` +
        `<path d="${top}" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
        `<path d="M ${P(bx0)} ${P(cTop)} H ${P(bx1)} M ${P(bx0)} ${P(cBot)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1"/>`;
      // Pilene: hull går med strømmen, elektroner mot den.
      const sgn = v > 0 ? 1 : -1;
      const off = ((chevPhase % CHEV) + CHEV) % CHEV;
      const chev = (x, y, dir, color) =>
        `<path d="M ${P(x - 3 * dir)} ${P(y - 3)} L ${P(x)} ${P(y)} L ${P(x - 3 * dir)} ${P(y + 3)}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      const hL = holeFrac(bx0) * CH;
      const hR = holeFrac(bx1) * CH;
      for (let x = bx0 + off; x < bx1 - 4; x += CHEV) {
        if (x < bx0 + 4) continue;
        const hh = holeFrac(x) * CH;
        if (hh > 9 && !(hL > 14 && x < bx0 + 26)) svg += chev(x, cBot - hh / 2, sgn, "var(--red)");
        if (CH - hh > 9 && !(CH - hR > 14 && x > bx1 - 26)) svg += chev(x, cTop + (CH - hh) / 2, -sgn, "var(--indigo)");
      }
      const label = (x, y, text, anchor, color) => tag(x, y, text, anchor, color, ";font-weight:600");
      svg += hL > 14 ? label(bx0 + 4, cBot - hL / 2 + 4, sub("I", "p"), "start", "var(--red)") : "";
      svg += CH - hR > 14 ? label(bx1 - 4, cTop + (CH - hR) / 2 + 4, sub("I", "n"), "end", "var(--indigo)") : "";
      svg +=
        `<path d="M ${P(bx0 - 8)} ${P(cTop)} V ${P(cBot)} M ${P(bx0 - 10)} ${P(cTop)} h 4 M ${P(bx0 - 10)} ${P(cBot)} h 4" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
        tag(bx0 - 12, cTop + CH / 2 + 4, "I", "end", "var(--fg)");
    }

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  /** En majoritetsbærer krysser sonen og blir minoritet på `side`. */
  function spawnCross(side) {
    const { xp, xn } = edges();
    const S = sides[side];
    transit.push({
      color: S.color,
      side,
      kind: "cross",
      x: side === "n" ? xp : xn,
      y: yIn(Math.random()),
      alpha: 1,
    });
  }
  /** En minoritetsbærer ved kanten feies over sonen og forsvinner i mengden. */
  function spawnSweep(side, y) {
    const { xp, xn } = edges();
    const S = sides[side];
    transit.push({ color: S.color, side, kind: "sweep", x: side === "n" ? xn : xp, y, alpha: 1 });
  }

  function step(dt) {
    const k = 1 - Math.exp(-dt / RELAX);
    wzCur += (wzTarget() - wzCur) * k;
    const kProf = 1 - Math.exp(-dt / PROFILE_TAU);
    for (const s of ["n", "p"]) sides[s].dp += (dpTarget(s) - sides[s].dp) * kProf;
    yMax += (yMaxTarget() - yMax) * k;
    chevPhase += 70 * iNorm() * dt;

    const absorb = v < 0 ? 1 - expV() : 0;
    for (const s of ["n", "p"]) {
      const S = sides[s];
      const X = spanOf(s);
      const D = (S.L * S.L) / TAU;
      const sig = Math.sqrt(2 * D * dt);

      // Termisk generasjon, jevnt i rommet.
      S.acc += ((S.rhoEq * X) / TAU) * dt;
      while (S.acc >= 1) {
        S.acc -= 1;
        if (S.walkers.length < CAP) S.walkers.push({ x: Math.random() * X, y: yIn(Math.random()), alpha: 0.05, dying: false });
      }
      // Injeksjon over sonen i lederetningen.
      if (v > 0) {
        S.inj += ((D * S.rhoEq * (expV() - 1)) / S.L) * dt;
        while (S.inj >= 1) {
          S.inj -= 1;
          if (S.walkers.length < CAP) spawnCross(s);
        }
      } else S.inj = 0;

      for (let i = S.walkers.length - 1; i >= 0; i--) {
        const d = S.walkers[i];
        if (d.dying) {
          d.alpha -= dt / 0.35;
          if (d.alpha <= 0) S.walkers.splice(i, 1);
          continue;
        }
        d.alpha = Math.min(1, d.alpha + dt / 0.3);
        if (Math.random() < dt / TAU) {
          d.dying = true;
          continue;
        }
        d.x += sig * gauss();
        d.y = clamp(d.y + 30 * dt * gauss(), yIn(0), yIn(1));
        if (d.x > X) d.x = 2 * X - d.x;
        if (d.x < 0) {
          if (absorb > 0 && Math.random() < absorb) {
            S.walkers.splice(i, 1);
            spawnSweep(s, d.y);
          } else d.x = -d.x;
        }
        d.x = clamp(d.x, 0, X);
      }
    }

    // Prikkene på vei over sonen.
    const { xp, xn } = edges();
    const vCross = Math.max(120, (xn - xp) / 0.25);
    for (let i = transit.length - 1; i >= 0; i--) {
      const t = transit[i];
      const toN = t.side === "n";
      if (t.kind === "cross") {
        // Fra den andre siden inn til `side`.
        t.x += (toN ? 1 : -1) * vCross * dt;
        if ((toN && t.x >= xn) || (!toN && t.x <= xp)) {
          transit.splice(i, 1);
          sides[t.side].walkers.push({ x: 0.5, y: t.y, alpha: 1, dying: false });
        }
      } else {
        // Fra `side` over til den andre, der den er majoritet og blekner.
        const arrived = toN ? t.x <= xp : t.x >= xn;
        t.x += (toN ? -1 : 1) * (arrived ? 30 : vCross) * dt;
        if (arrived) t.alpha -= dt / 0.4;
        if (t.alpha <= 0) transit.splice(i, 1);
      }
    }
    if (transit.length > 80) transit.splice(0, transit.length - 80);
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
  snap();
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
