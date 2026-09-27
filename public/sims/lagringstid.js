/**
 * Lagringstiden i en p⁺n-diode, for TFE4146 modul 07.
 * Én idé: når kilden slås om fra lederetning til sperreretning, må hullene
 * som er lagret på n-siden, ut før overgangen kan sperre. Så lenge det er
 * et overskudd ved sonekanten, er spenningen over overgangen positiv og
 * liten, og sperrestrømmen settes av kretsen, −I_r. Først når overskuddet
 * ved kanten er null (etter lagringstiden t_sd), tar overgangen opp
 * spenningen, og strømmen dør ut mens resten av ladningen hentes ut.
 *
 * Profilen er den eksakte løsningen av diffusjonsligningen på n-siden,
 * u_t = u_xx − u med x i L_p og t i τ_p, regnet ut på forhånd med
 * eksplisitte differanser. Lederetning: fast strøm inn, u_x(0) = −1.
 * Sperreretning: fast strøm ut, u_x(0) = +r med r = I_r/I_f, så lenge
 * u(0) > 0; deretter u(0) = 0 (kanten er tømt). Kontakten i x = X er ohmsk,
 * u(X) = 0. Tiden der u(0) når null, er t_sd, og den stemmer med
 * τ_p[erf⁻¹(I_f/(I_f + I_r))]² til tre desimaler.
 *
 * Øverst er dioden med bare hullene på n-siden tegnet (røde prikker). Hver
 * prikk går en tilfeldig gange og dør med raten 1/τ_p. I lederetningen
 * kommer det nye inn over sonen med raten til I_f. I sperreretningen
 * trekkes prikker som når kanten, tilbake over sonen med raten til I_r,
 * og etter t_sd trekkes alle som når kanten, ut. Prikkene som går tilbake
 * over sonen, er sperrestrømmen.
 *
 * I midten er profilen δp(x_n) med den lagrede ladningen skravert og
 * profilen fra lederetningen stiplet. Nederst er et oscilloskop som
 * trigges i omslaget: strømmen i(t) og spenningen v(t) over overgangen,
 * med klammen t_sd under tidsaksen. Spenningen er ln(1 + K·u(0)) i
 * lederetning med K = e^(V_f/V_T), V_f/V_T = 27 som for en Si-diode ved
 * 0,7 V, og −(I_r − |i|)R etter t_sd. Den positive delen av spenningsaksen
 * er forstørret, ellers ville V_f vært et par piksler over null.
 *
 * Syklusen: lederetning (forhåndstrigger) → omslag → sperreretning til
 * ladningen er borte → pause → kilden tilbake til lederetning, og
 * ladningen bygges opp igjen mens skopet blekner. Står simuleringen stille
 * (pause eller prefers-reduced-motion), fryses den ved tStill, litt etter
 * t_sd, når klammen og platået står der og det fortsatt er ladning igjen.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const X_LEN = 5; // n-sidens lengde i L_p
const NX = 100; // gitterpunkter i profilen
const DX = X_LEN / NX;
const DT = 0.4 * DX * DX; // stabilt eksplisitt steg, i τ_p
const T_PRE = 0.25; // τ_p med lederetning før omslaget, på skopet
const T_REV = 1.8; // τ_p etter omslaget, hele sveipet
const T_ON = 3; // τ_p med oppbygging før neste sveip
const SNAP = 0.005; // τ_p mellom lagrede øyeblikksbilder
const LOG_K = 27; // V_f/V_T
const R_MIN = 0.25;
const R_MAX = 1.5;

const SPEED_REV = 1 / 3.2; // τ_p per sekund under sveipet
const SPEED_ON = 1 / 1.0; // τ_p per sekund under oppbyggingen
const HOLD_SECS = 1.6;

const N_F = 110; // prikker i lederetning
const CAP = 220;
const R = 3; // px, prikkens radius

/** Stasjonær profil med fast strøm inn og u(X) = 0. */
function steady() {
  const u = new Float64Array(NX + 1);
  for (let i = 0; i <= NX; i++) u[i] = Math.sinh(X_LEN - i * DX) / Math.cosh(X_LEN);
  return u;
}
const U_F = steady();
const Q_F = integ(U_F);

function integ(u) {
  let s = 0;
  for (let i = 0; i < NX; i++) s += (u[i] + u[i + 1]) / 2;
  return s * DX;
}

/**
 * Ett eksplisitt steg. `slope` er u_x(0) når kanten er strømstyrt; `clampEdge`
 * gir u(0) = 0. Returnerer om kanten ble klemt.
 */
function stepPDE(u, tmp, slope, clampEdge) {
  const k = DT / (DX * DX);
  for (let i = 1; i < NX; i++) tmp[i] = u[i] + k * (u[i + 1] - 2 * u[i] + u[i - 1]) - DT * u[i];
  let u0 = u[0] + k * (2 * u[1] - 2 * u[0] - 2 * DX * slope) - DT * u[0];
  let clamped = clampEdge;
  if (clampEdge || u0 <= 0) {
    u0 = 0;
    clamped = true;
  }
  tmp[0] = u0;
  tmp[NX] = 0;
  u.set(tmp);
  return clamped;
}

/** Sveipet og oppbyggingen for et gitt r = I_r/I_f, som øyeblikksbilder. */
function build(r) {
  const u = Float64Array.from(U_F);
  const tmp = new Float64Array(NX + 1);
  const rev = [];
  const on = [];
  let t = 0;
  let tsd = T_REV;
  let clamped = false;
  const every = Math.round(SNAP / DT);
  let n = 0;
  const snapRev = () => {
    const i = clamped ? -Math.min(r, (u[1] - u[0]) / DX) : -r;
    rev.push({ t, u: Float64Array.from(u), i, q: integ(u) / Q_F });
  };
  snapRev();
  while (t < T_REV - 1e-9) {
    const was = clamped;
    clamped = stepPDE(u, tmp, r, clamped);
    t += DT;
    if (clamped && !was) tsd = t;
    if (++n % every === 0) snapRev();
  }
  // Oppbyggingen fra det som er igjen, med fast strøm inn igjen.
  t = 0;
  n = 0;
  on.push({ t, u: Float64Array.from(u), q: integ(u) / Q_F });
  while (t < T_ON - 1e-9) {
    stepPDE(u, tmp, -1, false);
    t += DT;
    if (++n % every === 0) on.push({ t, u: Float64Array.from(u), q: integ(u) / Q_F });
  }
  return { r, tsd, rev, on };
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  let r = 1;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let run = build(r);

  // Klokka: fasene pre (t < 0), rev (0 ≤ t ≤ T_REV), hold, on.
  let phase = "pre";
  let t = -T_PRE; // τ_p, sveipets tid
  let tOn = 0; // τ_p, oppbyggingens tid
  let hold = 0;
  const tStill = () => Math.min(T_REV, run.tsd + 0.25);

  // ── kontroller ────────────────────────────────────────────────────────────
  const label = document.createElement("label");
  label.append("Sperrestrøm ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(R_MIN);
  input.max = String(R_MAX);
  input.step = "0.25";
  input.value = String(r);
  input.setAttribute("aria-label", "Sperrestrømmen etter omslaget, som andel av strømmen i lederetningen");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      r = Number(input.value);
      run = build(r);
      sync();
      if (playing) restart();
      else still();
      render();
      start();
    },
    { signal },
  );

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
  controls.append(label, playBtn);

  const NB = (x, k = 2) => x.toFixed(k).replace(".", ",");
  function sync() {
    out.innerHTML = `${NB(r)}·I<sub>f</sub>`;
  }

  // ── tilstanden på et gitt tidspunkt ─────────────────────────────────────────
  const at = (list, tt) => list[Math.max(0, Math.min(list.length - 1, Math.round(tt / SNAP)))];
  /** Profilen, strømmen (i I_f) og ladningen (andel av Q_F) akkurat nå. */
  function now() {
    if (phase === "on") {
      const s = at(run.on, tOn);
      return { u: s.u, i: 1, q: s.q, fwd: true };
    }
    if (t < 0) return { u: U_F, i: 1, q: 1, fwd: true };
    const s = at(run.rev, t);
    return { u: s.u, i: s.i, q: s.q, fwd: false };
  }
  /** Spenningen over overgangen: 1 = V_f, negativ i enheter av I_f·R. */
  function vAt(tt) {
    if (tt < 0) return 1;
    const s = at(run.rev, tt);
    if (tt < run.tsd) return Math.log1p(Math.max(0, s.u[0]) * Math.expm1(LOG_K)) / LOG_K;
    return -(r + s.i);
  }

  // ── prikkene ───────────────────────────────────────────────────────────────
  const walkers = [];
  const transit = [];
  let injAcc = 0;
  let extAcc = 0;

  function seedFrom(u, q) {
    walkers.length = 0;
    transit.length = 0;
    const n = Math.round(N_F * q);
    let umax = 0;
    for (const v of u) umax = Math.max(umax, v);
    let guard = 0;
    while (walkers.length < n && guard++ < 40000) {
      const x = Math.random() * X_LEN;
      const v = u[Math.min(NX, Math.round(x / DX))];
      if (Math.random() * umax < v) walkers.push({ x, y: Math.random(), alpha: 1, dying: false });
    }
  }

  function restart() {
    phase = "pre";
    t = -T_PRE;
    tOn = 0;
    hold = 0;
    seedFrom(U_F, 1);
  }
  function still() {
    phase = "rev";
    t = tStill();
    const s = at(run.rev, t);
    seedFrom(s.u, s.q);
  }

  // ── geometri ──────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  const g = {};

  function layout() {
    const { w, h } = getSize();
    g.w = w;
    g.h = h;
    g.bx0 = 30;
    g.bx1 = w - 30;
    g.xp = g.bx0 + Math.max(34, 0.12 * (g.bx1 - g.bx0));
    g.xn = g.xp + 16;
    g.span = g.bx1 - g.xn;
    g.by0 = 14;
    g.barH = 54;
    g.by1 = g.by0 + g.barH;
    g.pTop = g.by1 + 30;
    g.pBot = g.pTop + 78;
    g.s0 = g.pBot + 30;
    g.s1 = h - 6;
    g.iTop = g.s0 + 8;
    g.iBot = g.iTop + 84;
    g.vTop = g.iBot + 8;
    g.vBot = g.vTop + 62;
    g.ty = g.vBot + 6; // tidsaksen
  }

  const xOf = (xl) => g.xn + (xl / X_LEN) * g.span; // x i L_p → px
  const yIn = (f) => g.by0 + R + 3 + f * (g.barH - 2 * R - 6);
  const tX = (tt) => g.bx0 + ((tt + T_PRE) / (T_PRE + T_REV)) * (g.bx1 - g.bx0);
  const iAmp = () => (g.iBot - g.iTop - 6) / (1 + R_MAX);
  const iY0 = () => g.iTop + 3 + iAmp();
  const iY = (i) => iY0() - i * iAmp();
  const VF_PX = 10; // den forstørrede V_f
  const vY0 = () => g.vTop + VF_PX + 4;
  const vY = (v) => (v >= 0 ? vY0() - v * VF_PX : vY0() - v * ((g.vBot - vY0() - 2) / R_MAX));

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
  const brace = (x1, x2, y, text) => {
    const narrow = x2 - x1 < 34;
    return (
      `<path d="M ${P(x1)} ${P(y - 4)} V ${P(y + 4)} M ${P(x1)} ${P(y)} H ${P(x2)} M ${P(x2)} ${P(y - 4)} V ${P(y + 4)}" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
      (narrow ? tag(x2 + 6, y + 4, text, "start", "var(--fg)") : tag((x1 + x2) / 2, y + 15, text, "middle", "var(--fg)"))
    );
  };
  const red = "var(--red)";
  const acc = "var(--accent)";

  function render() {
    const { w, bx0, bx1, xp, xn, by0, by1, barH, pTop, pBot, s0, s1 } = g;
    const st = now();
    const mid = by0 + barH / 2;
    let svg = `<defs><clipPath id="ls-bar"><rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(barH)}"/></clipPath></defs>`;

    // Ledningene: kildens polaritet og strømmen, tykk når den er stor.
    const big = ";font-size:var(--text-sm);font-weight:600";
    const mag = Math.abs(st.i);
    const sw = 1.3 + 2.4 * clamp(mag / R_MAX, 0, 1);
    if (mag > 0.02) {
      svg += st.i > 0
        ? arrow(4, mid, bx0 - 1, mid, acc, sw) + arrow(bx1 + 1, mid, w - 4, mid, acc, sw)
        : arrow(bx0 - 1, mid, 4, mid, acc, sw) + arrow(w - 4, mid, bx1 + 1, mid, acc, sw);
    } else {
      svg += `<path d="M 4 ${P(mid)} H ${P(bx0)} M ${P(bx1)} ${P(mid)} H ${P(w - 4)}" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    }
    svg +=
      tag(15, mid - 8, st.fwd ? "+" : "−", "middle", "var(--fg)", big) +
      tag(w - 15, mid - 8, st.fwd ? "−" : "+", "middle", "var(--fg)", big);

    // Dioden: p⁺-siden, sonen og n-siden med hullene.
    svg +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(barH)}" rx="2" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<rect x="${P(xp)}" y="${P(by0)}" width="${P(xn - xp)}" height="${P(barH)}" fill="var(--fg)" fill-opacity="0.06"/>` +
      `<path d="M ${P(xp)} ${P(by0)} V ${P(by1)} M ${P(xn)} ${P(by0)} V ${P(by1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    let dots = "";
    for (const d of walkers) dots += `<circle cx="${P(xOf(d.x))}" cy="${P(yIn(d.y))}" r="${R}" fill-opacity="${P(0.9 * d.alpha)}"/>`;
    for (const d of transit) dots += `<circle cx="${P(d.x)}" cy="${P(yIn(d.y))}" r="${R}" fill-opacity="${P(0.9 * d.alpha)}"/>`;
    svg += `<g clip-path="url(#ls-bar)"><g style="fill:${red}">${dots}</g></g>`;
    svg +=
      tag((bx0 + xp) / 2, by1 + 14, "p⁺", "middle", "var(--fg)", ";font-size:var(--text-sm)") +
      tag((xp + xn) / 2, by1 + 14, "W", "middle", "var(--fg)") +
      tag(bx1 - 2, by1 + 14, "n", "end", "var(--fg)", ";font-size:var(--text-sm)");

    // Profilen: lagret ladning skravert, lederetningens profil stiplet.
    const PH = pBot - pTop;
    const yP = (u) => pBot - clamp(u / 1.12, -0.02, 1.02) * PH;
    const path = (u) => {
      let d = "";
      for (let i = 0; i <= NX; i++) d += `${i ? " L" : "M"} ${P(xOf(i * DX))} ${P(yP(u[i]))}`;
      return d;
    };
    const line = path(st.u);
    svg +=
      `<path d="${line} L ${P(xOf(X_LEN))} ${P(pBot)} L ${P(xn)} ${P(pBot)} Z" style="fill:${red}" fill-opacity="0.18"/>` +
      `<path d="${path(U_F)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>` +
      `<path d="${line}" stroke="${red}" stroke-width="2" fill="none"/>` +
      `<path d="M ${P(xn)} ${P(pBot)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(xn)} ${P(pTop - 4)} V ${P(pBot)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx1 - 2, pTop + 4, `δp(${sub("x", "n")})`, "end", red) +
      tag(bx1, pBot + 14, `${sub("x", "n")} →`, "end");
    // Overskuddet ved kanten som klamme, og ladningen navngitt i arealet.
    const eY = yP(st.u[0]);
    if (pBot - eY >= 8) {
      const xb = xn - 5;
      svg +=
        `<path d="M ${P(xb)} ${P(eY)} V ${P(pBot)} M ${P(xb - 2.5)} ${P(eY)} h 5 M ${P(xb - 2.5)} ${P(pBot)} h 5" stroke="var(--fg)" stroke-width="1" fill="none"/>` +
        tag(xb - 5, (eY + pBot) / 2 + 4, `Δ${sub("p", "n")}`, "end", "var(--fg)");
    }
    {
      let im = 0;
      for (let i = 1; i <= NX; i++) if (st.u[i] > st.u[im]) im = i;
      const xq = Math.max(im * DX, 0.55);
      const yq = yP(st.u[Math.round(xq / DX)]);
      if (pBot - yq >= 22) svg += tag(xOf(xq) + 4, (yq + pBot) / 2 + 5, sub("Q", "p"), "start", red);
    }

    // ── oscilloskopet ───────────────────────────────────────────────────────
    const fade = phase === "on" ? clamp(1 - tOn / 1.2, 0.25, 1) : 1;
    svg += `<rect x="${P(bx0 - 8)}" y="${P(s0)}" width="${P(bx1 - bx0 + 16)}" height="${P(s1 - s0)}" rx="3" fill="var(--card-nested)" stroke="var(--border-strong)" stroke-width="1.5"/>`;
    const xs0 = tX(0);
    let scope = "";
    // Nullinjer, nivåene og navnene på strimlene.
    scope +=
      `<path d="M ${P(bx0)} ${P(iY0())} H ${P(bx1)} M ${P(bx0)} ${P(vY0())} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(bx0)} ${P(iY(1))} H ${P(bx1)} M ${P(bx0)} ${P(iY(-r))} H ${P(bx1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 4"/>` +
      tag(bx1 - 2, iY(1) + 13, sub("I", "f"), "end") +
      tag(bx1 - 2, r >= 1 ? iY(-r) - 5 : iY(-r) + 13, `−${sub("I", "r")}`, "end") +
      tag(bx0 - 18, iY0() + 4, "i", "middle", acc, ";font-weight:600") +
      tag(bx0 - 18, vY0() + 4, "v", "middle", "var(--fg)", ";font-weight:600");
    // Tidsaksen, med omslaget ved 0.
    let ticks = "";
    for (const tt of [0, 1]) ticks += `M ${P(tX(tt))} ${P(g.ty)} V ${P(g.ty + 5)} `;
    scope +=
      `<path d="M ${P(bx0)} ${P(g.ty)} H ${P(bx1)}" stroke="var(--border-strong)" stroke-width="1.5"/>` +
      `<path d="${ticks}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(xs0, g.ty + 16, "0", "middle") +
      tag(tX(1), g.ty + 16, sub("τ", "p"), "middle") +
      `<path d="M ${P(xs0)} ${P(g.iTop)} V ${P(g.ty)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="1 3"/>`;

    // Kurvene, så langt strålen har kommet.
    const tB = phase === "pre" ? t : phase === "rev" ? t : T_REV;
    let di = `M ${P(bx0)} ${P(iY(1))} L ${P(xs0)} ${P(iY(1))}`;
    let dv = `M ${P(bx0)} ${P(vY(1))} L ${P(xs0)} ${P(vY(1))}`;
    if (tB < 0) {
      di = `M ${P(bx0)} ${P(iY(1))} L ${P(tX(tB))} ${P(iY(1))}`;
      dv = `M ${P(bx0)} ${P(vY(1))} L ${P(tX(tB))} ${P(vY(1))}`;
    } else {
      const nB = Math.min(run.rev.length - 1, Math.round(tB / SNAP));
      for (let k = 0; k <= nB; k += 2) {
        const s = run.rev[k];
        di += ` L ${P(tX(s.t))} ${P(iY(s.i))}`;
        dv += ` L ${P(tX(s.t))} ${P(vY(vAt(s.t)))}`;
      }
      const s = run.rev[nB];
      di += ` L ${P(tX(s.t))} ${P(iY(s.i))}`;
      dv += ` L ${P(tX(s.t))} ${P(vY(vAt(s.t)))}`;
    }
    scope +=
      `<path d="${di}" stroke="${acc}" stroke-width="2" fill="none" stroke-linejoin="round"/>` +
      `<path d="${dv}" stroke="var(--fg)" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`;

    // t_sd: der overskuddet ved kanten er borte og spenningen krysser null.
    if (tB >= run.tsd) {
      const xsd = tX(run.tsd);
      scope +=
        `<path d="M ${P(xsd)} ${P(g.iTop)} V ${P(g.ty)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>` +
        brace(xs0, xsd, g.ty + 26, sub("t", "sd"));
    }
    // Strålen.
    if (phase === "pre" || phase === "rev") {
      const iNow = tB < 0 ? 1 : at(run.rev, tB).i;
      scope +=
        `<circle cx="${P(tX(tB))}" cy="${P(iY(iNow))}" r="3" style="fill:${acc}"/>` +
        `<circle cx="${P(tX(tB))}" cy="${P(vY(vAt(tB)))}" r="2.5" style="fill:var(--fg)"/>`;
    }
    svg += `<g opacity="${P(fade)}">${scope}</g>`;

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${g.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      svg +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  function stepDots(dts, dtw, fwd, absorbing) {
    const sig = Math.sqrt(2 * dts); // i L_p, siden D = L_p²/τ_p
    if (fwd) {
      injAcc += N_F * dts;
      while (injAcc >= 1) {
        injAcc -= 1;
        if (walkers.length + transit.length < CAP) transit.push({ x: g.xp, y: Math.random(), alpha: 1, kind: "in" });
      }
      extAcc = 0;
    } else {
      injAcc = 0;
      extAcc = Math.min(extAcc + r * N_F * dts, 3);
    }
    for (let k = walkers.length - 1; k >= 0; k--) {
      const d = walkers[k];
      if (d.dying) {
        d.alpha -= dtw / 0.35;
        if (d.alpha <= 0) walkers.splice(k, 1);
        continue;
      }
      d.alpha = Math.min(1, d.alpha + 0.1);
      if (Math.random() < dts) {
        d.dying = true;
        continue;
      }
      d.x += sig * gauss();
      d.y = clamp(d.y + 0.25 * Math.sqrt(dts) * gauss(), 0, 1);
      if (d.x >= X_LEN) {
        walkers.splice(k, 1);
        continue;
      }
      if (d.x < 0) {
        if (!fwd && (absorbing || extAcc >= 1)) {
          if (!absorbing) extAcc -= 1;
          walkers.splice(k, 1);
          transit.push({ x: g.xn, y: d.y, alpha: 1, kind: "out" });
        } else d.x = -d.x;
      }
    }
  }

  function stepTransit(dtw) {
    const v = Math.max(90, (g.xn - g.xp) / 0.12);
    for (let k = transit.length - 1; k >= 0; k--) {
      const d = transit[k];
      if (d.kind === "in") {
        d.x += v * dtw;
        if (d.x >= g.xn) {
          transit.splice(k, 1);
          walkers.push({ x: 0.02, y: d.y, alpha: 1, dying: false });
        }
      } else {
        const inP = d.x <= g.xp;
        d.x -= (inP ? 40 : v) * dtw;
        if (inP) d.alpha -= dtw / 0.4;
        if (d.alpha <= 0) transit.splice(k, 1);
      }
    }
  }

  function step(dtw) {
    if (phase === "hold") {
      stepDots(dtw * SPEED_REV, dtw, false, true);
      stepTransit(dtw);
      hold -= dtw;
      if (hold <= 0) {
        phase = "on";
        tOn = 0;
      }
      return;
    }
    if (phase === "on") {
      const dts = dtw * SPEED_ON;
      tOn += dts;
      stepDots(dts, dtw, true, false);
      stepTransit(dtw);
      if (tOn >= T_ON) {
        phase = "pre";
        t = -T_PRE;
      }
      return;
    }
    const dts = dtw * SPEED_REV;
    const was = t;
    t += dts;
    if (was < 0 && t >= 0) extAcc = 0;
    stepDots(dts, dtw, t < 0, t >= run.tsd);
    stepTransit(dtw);
    if (t >= 0) phase = "rev";
    if (t >= T_REV) {
      t = T_REV;
      phase = "hold";
      hold = HOLD_SECS;
    }
  }

  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(nowMs) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.max(0, Math.min(0.05, (nowMs - last) / 1000 || 0));
    last = nowMs;
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
  if (playing) restart();
  else still();
  render();
  onResize(() => {
    layout();
    render();
  });
  start();
}
