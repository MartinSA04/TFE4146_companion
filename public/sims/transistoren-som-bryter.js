/**
 * «Transistoren slås på og av» for TFE4146, bipolartransistoren som bryter.
 *
 * Én idé: kollektorstrømmen følger hulladningen Q_p i basen, ikke basestrømmen. En pulsgenerator
 * slår en pnp-transistor i felles emitter på og av gjennom R_B, om og om igjen. Ved «På» må
 * ladningen bygges opp før i_C kommer, og når den har nådd Q_s = I_Cτ_t, er transistoren i metning
 * og i_C står fast på |V_CC|/R_L mens basen fylles videre. Ved «Av» snur basestrømmen med en gang,
 * men i_C står fast til ladningen er tømt ned til Q_s (lagringstiden t_sd). Streetman & Banerjee
 * §7.6, fig. 7–12, 7–14 og 7–15, og forelesningen om svitsjing (kilden ±1 V gjennom
 * R_B = 10 kΩ, R_L = 1 kΩ, V_CC = −4 V).
 *
 * Øverst står transistoren som en stav med kilden og R_B på basen. Basen er selve profilen:
 * høyden av den røde flaten er overskuddet av hull, og den stiplede trekanten er profilen der
 * metningen begynner. Under står én periode: ladningen Q_p som rød flate og i_C som linje, i
 * samme skala, så Q_s og 4 mA er samme høyde. Under Q_s ligger i_C oppå flaten; over Q_s går
 * linjen rett fram mens flaten vokser. Tidsaksen etter «Av» er strukket ut fire ganger. Streken
 * er nå; den kan dras, og staven viser tilstanden der.
 *
 * Modellen er ladningskontroll med γ = 1: i_B = Q_p/τ_p + dQ_p/dt, og i normal modus
 * i_C = Q_p/τ_t. τ_p = 100 ns og β = τ_p/τ_t = 200. Profilen er rett. I normal modus er den en
 * trekant med Δp_E = h·Q_p/Q_s og Δp_C = 0, der h er høyden ved Q_s. I metning holder kretsen i_C
 * og dermed stigningen fast, så Δp_E = h(u + 1)/2 og Δp_C = h(u − 1)/2 med u = Q_p/Q_s.
 * Spenningen over emitterovergangen er v_EB = 0,60 V + (k_BT/q)ln(Δp_E/h), og basestrømmen er
 * (−v_EB − v_s)/R_B, positiv ut av basen. Når basen er tom (Q_p under 1 % av Q_s), lades
 * emitterovergangen som en kondensator på 1 pF gjennom R_B, så det tar rundt 14 ns fra «På» til
 * hullene kommer (forsinkelsen t_d), og etter «Av» faller v_EB mot −1 V på samme måte. Perioden
 * regnes ferdig når spaken flyttes (to perioder, den andre vises), og animasjonen leser av den.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const VT = 0.0259; // V
const TAU_P = 100; // ns
const BETA = 200;
const TAU_T = TAU_P / BETA; // ns
const IC_SAT = 4; // mA, |V_CC|/R_L
const QS = IC_SAT * TAU_T; // pC
const V_S0 = 0.6; // v_EB når Q_p = Q_s
const CJ = 1; // pF
const U_ON = 0.01;
const Q_ON = U_ON * QS;
const V_ON = V_S0 + VT * Math.log(U_ON);
const RB = 10; // kΩ
const T_ON = 400; // ns
const T_OFF = 60; // ns
const STRETCH = 4;
const DT = 0.02; // ns
const DS = 0.25; // ns mellom lagrede punkter
const SWEEP_S = 10; // s for én periode på skjermen
const Q_TOP = 3 * QS; // toppen av diagrammet
const P_TOP = 2.15; // toppen av basen, i h

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let vOn = -1;
  let paused = false;
  let now = 0; // ns i perioden
  let trace = null;

  const vebOf = (q) => {
    const u = Math.max(q / QS, 1e-9);
    return V_S0 + VT * Math.log(u <= 1 ? u : (u + 1) / 2);
  };

  /** Én periode fra tilstanden s, med punkter hver DS ns. */
  function run(s, keep) {
    const pts = [];
    let next = 0;
    const steps = Math.round((T_ON + T_OFF) / DT);
    for (let k = 0; k <= steps; k++) {
      const t = k * DT;
      const vs = t < T_ON ? vOn : 1;
      const veb = s.empty ? s.v : vebOf(s.Q);
      const ib = (-veb - vs) / RB;
      if (keep && t >= next - 1e-9) {
        pts.push({ t, Q: s.empty ? 0 : s.Q, empty: s.empty, ib, ic: s.empty ? 0 : s.Q <= QS ? s.Q / TAU_T : IC_SAT, vs });
        next += DS;
      }
      if (s.empty) {
        s.v += (DT * ib) / CJ;
        if (s.v >= V_ON) {
          s.empty = false;
          s.Q = Q_ON;
        }
      } else {
        s.Q += DT * (ib - s.Q / TAU_P);
        if (s.Q < Q_ON && ib < 0) {
          s.empty = true;
          s.Q = 0;
          s.v = V_ON;
        }
      }
    }
    return pts;
  }

  function compute() {
    const s = { Q: 0, v: -1, empty: true };
    run(s, false);
    const pts = run(s, true);
    let ts = null;
    let tsd = null;
    for (const p of pts) {
      if (ts === null && p.t < T_ON && p.Q >= QS) ts = p.t;
    }
    const atOff = pts.find((p) => p.t >= T_ON);
    if (atOff && atOff.Q > QS) for (const p of pts) if (tsd === null && p.t > T_ON && p.Q <= QS) tsd = p.t - T_ON;
    trace = { pts, ts, tsd };
  }

  const at = (t) => trace.pts[Math.max(0, Math.min(trace.pts.length - 1, Math.round(t / DS)))];

  // ── kontroller ──────────────────────────────────────────────────────────
  const label = document.createElement("label");
  const lt = document.createElement("span");
  lt.innerHTML = "v<sub>s</sub> på ";
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0.7";
  input.max = "1.2";
  input.step = "0.1";
  input.value = String(-vOn);
  input.setAttribute("aria-label", "Spenningen fra kilden når den er på, i volt under null");
  label.append(lt, out, input);
  const fmtV = (x) => (x < 0 ? "−" : "+") + (Number.isInteger(x) ? String(Math.abs(x)) : Math.abs(x).toFixed(1).replace(".", ",")) + " V";
  const showV = () => (out.textContent = fmtV(vOn));
  input.addEventListener(
    "input",
    () => {
      vOn = -Number(input.value);
      showV();
      compute();
      render();
    },
    { signal },
  );
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "sim-btn";
  const setPaused = (p) => {
    paused = p;
    pauseBtn.textContent = paused ? "Spill av" : "Pause";
    if (!paused) start();
  };
  pauseBtn.addEventListener("click", () => setPaused(!paused), { signal });
  controls.append(label, pauseBtn);
  showV();
  pauseBtn.textContent = "Pause";

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w: full, h } = getSize();
    if (full < 240 || h < 360) return null;
    // Bredere enn 560 px blir staven flat og lang, så tegningen står midt i rammen.
    const w = Math.min(full, 560);
    const ox = (full - w) / 2;
    const bx0 = 14;
    const bx1 = w - 46;
    const ew = Math.min(44, (bx1 - bx0) * 0.13);
    const zw = 5;
    const cx0 = 30; // diagrammet
    const cx1 = w - 34;
    const wOn = (cx1 - cx0) / (1 + (T_OFF * STRETCH) / T_ON);
    return {
      w, full, ox, h, bx0, bx1, ew, zw,
      xb0: bx0 + ew + zw, xb1: bx1 - ew - zw,
      sy: 20, ry0: 34, ry1: 56, by0: 74, by1: 164, my: 182,
      cx0, cx1, xOff: cx0 + wOn, cy0: 218, cy1: 330, ty: 345, spy: 362,
    };
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const wire = (d) => `<path d="${d}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;

  /** En strømpil, tykkere jo større strømmen er. (x, y) er midten, (dx, dy) retningen. */
  function arrow(x, y, dx, dy, mag) {
    if (mag < 0.03) return "";
    const len = 10 + 12 * Math.min(1, mag);
    const sw = 1.2 + 2.4 * Math.min(1, mag);
    const x0 = x - (dx * len) / 2;
    const y0 = y - (dy * len) / 2;
    const x1 = x + (dx * len) / 2;
    const y1 = y + (dy * len) / 2;
    const px = -dy;
    const py = dx;
    return `<path d="M ${P(x0)} ${P(y0)} L ${P(x1)} ${P(y1)} M ${P(x1 - dx * 6 + px * 4)} ${P(y1 - dy * 6 + py * 4)} L ${P(x1)} ${P(y1)} L ${P(x1 - dx * 6 - px * 4)} ${P(y1 - dy * 6 - py * 4)}" fill="none" style="stroke:var(--accent)" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  function device(p) {
    const { w, bx0, bx1, ew, zw, xb0, xb1, sy, ry0, ry1, by0, by1, my } = G;
    const xm = (xb0 + xb1) / 2;
    const ym = (by0 + by1) / 2;
    let s = "";
    // Profilen i basen: bunnen av staven er null, toppen P_TOP·h.
    const base = by1 - 4;
    const Y = (u) => base - (u / P_TOP) * (base - by0 - 6);
    const u = p.empty ? 0 : p.Q / QS;
    const [a, b] = p.empty ? [0, 0] : u <= 1 ? [u, 0] : [(u + 1) / 2, (u - 1) / 2];
    if (a > 0.004) {
      const d = `M ${P(xb0)} ${P(Y(a))} L ${P(xb1)} ${P(Y(b))}`;
      s += `<path d="${d} L ${P(xb1)} ${P(base)} L ${P(xb0)} ${P(base)} Z" style="fill:var(--red)" fill-opacity="0.18"/>`;
      s += `<path d="${d}" fill="none" style="stroke:var(--red)" stroke-width="1.8"/>`;
    }
    s += `<path d="M ${P(xb0)} ${P(Y(1))} L ${P(xb1)} ${P(base)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += tag(xb0 + (xb1 - xb0) * 0.62, Y(0.38) - 4, sub("Q", "s"), "start", "var(--muted)", ";font-style:italic" + halo);
    // Navnene ved endene står over linjen, eller under den inne i flaten når det er for trangt over.
    // Linjen stiger mot venstre, så Δp_C måles mot linjen ved venstre ende av navnet.
    if (a > 0.04) s += tag(xb0 + 5, Y(a) - 5 < by0 + 14 ? Y(a) + 14 : Y(a) - 5, sub("Δp", "E"), "start", "var(--red)", ";font-style:italic" + halo);
    if (b > 0.04) {
      const xl = xb1 - 5 - 34;
      const yl = Y(b + (a - b) * (1 - (xl - xb0) / (xb1 - xb0)));
      s += tag(xb1 - 5, yl - 4, sub("Δp", "C"), "end", "var(--red)", ";font-style:italic" + halo);
    }
    // Staven: emitter, soner, base, kollektor.
    s +=
      `<rect x="${P(bx0 + ew)}" y="${P(by0)}" width="${P(zw)}" height="${P(by1 - by0)}" style="fill:var(--orange)" fill-opacity="0.22"/>` +
      `<rect x="${P(bx1 - ew - zw)}" y="${P(by0)}" width="${P(zw)}" height="${P(by1 - by0)}" style="fill:var(--orange)" fill-opacity="0.22"/>` +
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(bx0)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(bx1)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(xm - 12)} ${P(by0)} H ${P(xm + 12)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += tag(bx0 + ew / 2, ym + 4, "p⁺", "middle", "var(--fg)") + tag(bx1 - ew / 2, ym + 4, "p", "middle", "var(--fg)");
    s += tag(xb1 - 6, by0 + 14, "n", "end", "var(--fg)");
    s += tag(bx0 + ew / 2, by1 + 15, "E", "middle", "var(--muted)") + tag(bx1 - ew / 2, by1 + 15, "C", "middle", "var(--muted)");
    s += tag(xm + 16, by0 - 5, "B", "start", "var(--muted)");
    // Kilden og R_B på basen.
    s += wire(`M ${P(xm)} ${P(by0)} V ${P(ry1)} M ${P(xm)} ${P(ry0)} V ${P(sy + 10)}`);
    let zz = `M ${P(xm)} ${P(ry1)}`;
    for (let k = 1; k <= 6; k++) zz += ` L ${P(xm + (k % 2 ? 5 : -5))} ${P(ry1 - ((k - 0.5) * (ry1 - ry0)) / 6)}`;
    zz += ` L ${P(xm)} ${P(ry0)}`;
    s += `<path d="${zz}" fill="none" style="stroke:var(--fg)" stroke-width="1.2" stroke-linejoin="round"/>`;
    s += tag(xm + 10, (ry0 + ry1) / 2 + 4, sub("R", "B"), "start", "var(--fg)", ";font-style:italic");
    s += `<circle cx="${P(xm)}" cy="${P(sy)}" r="10" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    s += wire(`M ${P(xm - 6)} ${P(sy + 3)} H ${P(xm - 2)} V ${P(sy - 3)} H ${P(xm + 2)} V ${P(sy + 3)} H ${P(xm + 6)}`);
    s += tag(xm - 15, sy + 4, sub("v", "s"), "end", "var(--fg)", ";font-style:italic");
    s += tag(xm + 15, sy + 4, fmtV(p.vs), "start", "var(--fg)");
    // Strømmene: i_B positiv ut av basen, opp mot kilden; i_C ut av kollektoren.
    const ax = xm - 16;
    const ay = (by0 + ry1) / 2 + 1;
    s += arrow(ax, ay, 0, p.ib > 0 ? -1 : 1, Math.abs(p.ib) / 0.16);
    if (Math.abs(p.ib) > 0.005) s += tag(ax - 9, ay + 4, sub("i", "B"), "end", "var(--accent)", ";font-style:italic");
    s += wire(`M ${P(bx1)} ${P(ym)} H ${P(w - 4)}`);
    s += arrow((bx1 + w) / 2, ym, 1, 0, p.ic / IC_SAT);
    if (p.ic > 0.1) s += tag((bx1 + w) / 2, ym - 13, sub("i", "C"), "middle", "var(--accent)", ";font-style:italic");
    // Modusen.
    const mode = p.empty ? "sperring" : p.Q > QS ? "metning" : "normal modus";
    s += tag(xm, my, mode, "middle", "var(--fg)", ";font-size:12px");
    return s;
  }

  function chart() {
    const { cx0, cx1, xOff, cy0, cy1, ty, spy } = G;
    const X = (t) => (t <= T_ON ? cx0 + (t / T_ON) * (xOff - cx0) : xOff + ((t - T_ON) / T_OFF) * (cx1 - xOff));
    const yQ = (q) => cy1 - (Math.min(q, Q_TOP) / Q_TOP) * (cy1 - cy0);
    const yC = (i) => yQ(i * TAU_T);
    let s = "";
    s += `<rect x="${P(cx0)}" y="${P(cy0)}" width="${P(cx1 - cx0)}" height="${P(cy1 - cy0)}" fill="none" style="stroke:var(--border)" stroke-width="1"/>`;
    s += `<path d="M ${P(xOff)} ${P(cy0)} V ${P(cy1)}" style="stroke:var(--border-strong)" stroke-width="1" stroke-dasharray="2 3"/>`;
    s += tag((cx0 + xOff) / 2, cy0 - 7, "På", "middle", "var(--fg)") + tag((xOff + cx1) / 2, cy0 - 7, "Av", "middle", "var(--fg)");
    s += `<path d="M ${P(cx0)} ${P(yQ(QS))} H ${P(cx1)}" style="stroke:var(--border-strong)" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += tag(cx0 - 4, yQ(QS) + 4, sub("Q", "s"), "end", "var(--muted)", ";font-style:italic");
    s += tag(cx1 + 4, yQ(QS) + 4, "4 mA", "start", "var(--accent)");
    // Sporene: det som har skjedd i perioden sterkt, resten av perioden svakt.
    const pts = trace.pts;
    const split = Math.min(pts.length - 1, Math.round(now / DS));
    const area = (i0, i1) => {
      if (i1 - i0 < 1) return "";
      let d = `M ${P(X(pts[i0].t))} ${P(cy1)}`;
      for (let k = i0; k <= i1; k++) d += ` L ${P(X(pts[k].t))} ${P(yQ(pts[k].Q))}`;
      return `${d} L ${P(X(pts[i1].t))} ${P(cy1)} Z`;
    };
    const line = (i0, i1) => {
      if (i1 - i0 < 1) return "";
      let d = "";
      for (let k = i0; k <= i1; k++) d += `${k === i0 ? "M" : "L"} ${P(X(pts[k].t))} ${P(yC(pts[k].ic))} `;
      return d;
    };
    s += `<path d="${area(split, pts.length - 1)}" style="fill:var(--red)" fill-opacity="0.09"/>`;
    s += `<path d="${line(split, pts.length - 1)}" fill="none" style="stroke:var(--accent)" stroke-width="1.4" opacity="0.35"/>`;
    s += `<path d="${area(0, split)}" style="fill:var(--red)" fill-opacity="0.28"/>`;
    s += `<path d="${line(0, split)}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    // Navnene på sporene ved 250 ns: i_C over linjen, Q_p nederst inne i flaten.
    const p250 = at(250);
    s += tag(X(250), yC(p250.ic) - 6, sub("i", "C"), "middle", "var(--accent)", ";font-style:italic" + halo);
    if (yQ(p250.Q) < cy1 - 18) s += tag(X(250), cy1 - 6, sub("Q", "p"), "middle", "var(--red)", ";font-style:italic" + halo);
    // Tidsaksen.
    for (const t of [0, 100, 200, 300, 400, 420, 440, 460]) {
      s += `<path d="M ${P(X(t))} ${P(cy1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
      if (t < 460) s += tag(X(t), ty, String(t), "middle", "var(--muted)");
    }
    s += tag(cx1 + 4, ty, "ns", "start", "var(--muted)");
    // t_s og t_sd under aksen.
    const span = (x0, x1, name) => {
      const c = "var(--red)";
      return (
        `<path d="M ${P(x0)} ${P(spy - 4)} V ${P(spy + 4)} M ${P(x0)} ${P(spy)} H ${P(x1)} M ${P(x1)} ${P(spy - 4)} V ${P(spy + 4)}" fill="none" style="stroke:${c}" stroke-width="1.2"/>` +
        tag(x1 + 4, spy + 4, name, "start", c, ";font-style:italic")
      );
    };
    if (trace.ts !== null) s += span(X(0), X(trace.ts), sub("t", "s"));
    if (trace.tsd !== null) s += span(X(T_ON), X(T_ON + trace.tsd), sub("t", "sd"));
    // Nå: streken med et håndtak på tidsaksen.
    const xn = X(now);
    s += `<path d="M ${P(xn)} ${P(cy0)} V ${P(cy1 + 2)}" style="stroke:var(--fg)" stroke-width="1" opacity="0.55"/>`;
    s += `<circle cx="${P(xn)}" cy="${P(cy1)}" r="5" style="fill:var(--fg)"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G || !trace) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.full.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block;touch-action:pan-y">` +
      `<g transform="translate(${G.ox.toFixed(1)} 0)">${device(at(now))}${chart()}</g></svg>`;
  }

  // ── dra streken ─────────────────────────────────────────────────────────
  function timeAt(clientX) {
    const r = stage.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * G.full - G.ox;
    const { cx0, cx1, xOff } = G;
    if (x <= xOff) return Math.max(0, ((x - cx0) / (xOff - cx0)) * T_ON);
    return Math.min(T_ON + T_OFF - DS, T_ON + ((x - xOff) / (cx1 - xOff)) * T_OFF);
  }
  let dragging = false;
  const onChart = (e) => {
    if (!G) return false;
    const r = stage.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * G.h;
    return y > G.cy0 - 4 && y < G.ty + 4;
  };
  stage.addEventListener(
    "pointerdown",
    (e) => {
      if (!onChart(e)) return;
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      setPaused(true);
      now = timeAt(e.clientX);
      render();
    },
    { signal },
  );
  stage.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      now = timeAt(e.clientX);
      render();
    },
    { signal },
  );
  const stop = () => (dragging = false);
  stage.addEventListener("pointerup", stop, { signal });
  stage.addEventListener("pointercancel", stop, { signal });

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(tNow) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches || paused) return;
    const dt = Math.min(0.05, Math.max(0, (tNow - last) / 1000 || 0));
    last = tNow;
    // Streken går like fort over hele diagrammet, så tiden går saktere etter «Av».
    const wOn = G ? G.xOff - G.cx0 : 1;
    const wOff = G ? G.cx1 - G.xOff : 1;
    const pxPerS = (wOn + wOff) / SWEEP_S;
    now += now < T_ON ? (dt * pxPerS * T_ON) / wOn : (dt * pxPerS * T_OFF) / wOff;
    if (now >= T_ON + T_OFF) now -= T_ON + T_OFF;
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    render();
    if (raf || !visible || reduce.matches || paused) return;
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
  reduce.addEventListener(
    "change",
    () => {
      if (reduce.matches) now = T_ON - 1;
      start();
    },
    { signal },
  );
  signal.addEventListener(
    "abort",
    () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
    { once: true },
  );
  onResize(() => render());
  compute();
  // Uten bevegelse står streken like før «Av», der basen er fullest.
  now = reduce.matches ? T_ON - 1 : 0;
  render();
}
