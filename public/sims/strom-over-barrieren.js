/**
 * «Strømmen gjennom kontakten» for TFE4146, metall–halvleder-overganger.
 *
 * Én idé: en spenning over en Schottky-kontakt flytter båndene i halvlederen opp eller
 * ned, så barrieren elektronene i halvlederen må over, blir q(V₀ − V). For hver k_BT den
 * senkes, kommer e ganger så mange over. Barrieren qΦ_B for elektronene i metallet ligger
 * fast ved grenseflaten, så strømmen fra metallet er den samme uansett spenning. Summen
 * er I₀(e^{qV/k_BT} − 1). Med sterk doping er sonen så tynn at elektronene tunnelerer
 * gjennom barrieren begge veier, og strømmen blir proporsjonal med spenningen (ohmsk).
 * Streetman & Banerjee §5.7.2–5.7.3, fig. 5–42.
 *
 * Modellen: energier i k_BT. Lett dopet: E_c − E_F = 2 i halvlederen, qΦ_B = 6, så
 * qV₀ = 4 (i silisium med gull er de rundt 10, 29 og 19). Elektronene i halvlederen har
 * kinetisk energi fra fordelingen i båndet og vandrer tilfeldig. De går over barrieren med
 * raten R₀·e^{qV/k_BT}, og metallet sender elektroner over qΦ_B med raten R₀. Kretsen
 * fyller på eller tar ut elektroner ved kontakten til høyre, så antallet står fast.
 * Sterkt dopet: E_F ligger 0,8 k_BT over E_c, sonen er 2,5 % av staven, og elektronene
 * tunnelerer ved energier nær Fermi-nivåene med ratene R_T(1 ± 0,3·qV/k_BT).
 *
 * Øverst står kretsen med batteriet og et amperemeter med nullpunkt i midten, så staven
 * med metallet og ionene i sonen (oransje), og under det båndskjemaet på samme x-akse med
 * elektronene (blå prikker) ved energiene sine. Valensbåndet ligger langt under og er ikke
 * tegnet.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const PHIB = 6; // qΦ_B, k_BT
const DOPING = {
  lett: { delta: 2, w0: 0.36, n: 34 },
  sterk: { delta: -0.8, w0: 0.025, n: 60 },
};
const V_MIN = -3;
const V_MAX = 3;
const E_LO = -4.4; // bunnen av båndskjemaet, k_BT over E_Fm
const E_HI = 10.6;
const R0 = 0.75; // per s, over barrieren hver vei ved V = 0
const RT = 2.6; // per s, tunnelering hver vei ved V = 0
const DIFF = 0.025; // staver²/s
const CROSS_V = 1.1; // staver/s for en tur over sonen
const CROSS_VT = 0.3; // staver/s for et elektron som tunnelerer
const TUNNEL_RUN = 0.12; // staver det tunnelerende elektronet går før og etter sonen
const FADE = 0.45;
const BORN = 0.35;

export function make({ doping: initial = "lett" } = {}) {
  return function init({ stage, controls, getSize, onResize, signal }) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let doping = initial;
    let V = 0;
    let paused = false;
    let carriers = [];
    let flashes = [];
    let clock = 0;
    let debtSM = 0;
    let debtMS = 0;
    let iShown = 0;

    const D = () => DOPING[doping];
    const V0 = () => PHIB - D().delta;
    const barrier = () => V0() - V; // fra halvledersiden
    const W = () => D().w0 * Math.sqrt(Math.max(0.05, barrier()) / V0());
    const ecB = () => V + D().delta; // E_c i bulk, målt fra E_Fm
    const efS = () => V; // E_F i halvlederen
    /** E_c(x): parabel i sonen fra PHIB ved grenseflaten til ecB() ved kanten. */
    function Ec(x) {
      const w = W();
      if (x >= w) return ecB();
      const f = 1 - x / w;
      return ecB() + barrier() * f * f;
    }
    const iTheory = () => (doping === "lett" ? Math.exp(V) - 1 : (0.6 * RT * V) / R0);
    const iFull = () => (doping === "lett" ? Math.exp(V_MAX) - 1 : (0.6 * RT * V_MAX) / R0);

    // ── kontroller ────────────────────────────────────────────────────────
    const label = document.createElement("label");
    label.append("Spenning ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(V_MIN);
    input.max = String(V_MAX);
    input.step = "0.5";
    input.value = "0";
    input.setAttribute("aria-label", "Spenningen over kontakten i enheter av k_BT/q, positiv med metallet positivt");
    label.append(out, input);
    input.addEventListener(
      "input",
      () => {
        V = Number(input.value);
        showV();
        if (reduce.matches || paused) still();
      },
      { signal },
    );
    function showV() {
      const t = V === 0 ? "0" : (V > 0 ? "+" : "−") + Math.abs(V).toString().replace(".", ",");
      out.innerHTML = `${t} k<sub>B</sub>T/q`;
    }
    const dopPick = choiceRow({
      ariaLabel: "Doping",
      label: "Doping",
      items: [
        { value: "lett", label: "Lett dopet" },
        { value: "sterk", label: "Sterkt dopet" },
      ],
      onPick: (k) => {
        doping = k;
        dopPick.sync(doping);
        reset();
      },
      signal,
    });
    const pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "sim-btn";
    pauseBtn.textContent = "Pause";
    pauseBtn.addEventListener(
      "click",
      () => {
        paused = !paused;
        pauseBtn.textContent = paused ? "Spill av" : "Pause";
        if (!paused) start();
      },
      { signal },
    );
    controls.append(label, pauseBtn, dopPick.el);
    dopPick.sync(doping);
    showV();

    // ── modellen ──────────────────────────────────────────────────────────
    const rnd = Math.random;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const expo = () => -Math.log(rnd() || 1e-12);
    // Kinetisk energi i båndet: Γ(3/2) når båndet er lett fylt, jevnt opp til litt over
    // E_F når E_F ligger i båndet.
    const thermal = () => {
      if (doping === "lett") return Math.min(4.6, 0.5 * gauss() ** 2 + expo());
      const top = efS() - ecB() + 0.9;
      return Math.max(0.05, top * Math.sqrt(rnd()));
    };
    const walker = (x, age = 1) => {
      const e = thermal();
      return { x, px: x, e, eT: e, state: "walk", age, retarget: rnd(), E: 0, x0: 0, dir: 0, tunnel: false };
    };

    function reset() {
      carriers = [];
      flashes = [];
      debtSM = debtMS = 0;
      const w = W();
      for (let i = 0; i < D().n; i++) carriers.push(walker(w + (1 - w) * ((i + rnd()) / D().n)));
      iShown = iTheory();
      if (reduce.matches || paused) still();
      else start();
    }

    function flash(x, E) {
      flashes.push({ x, E, t: clock });
    }

    /** Elektronet nærmest sonekanten med mest energi går over mot metallet. */
    function crossToMetal() {
      const w = W();
      let best = null;
      let score = -Infinity;
      for (const c of carriers) {
        if (c.state !== "walk") continue;
        const reach = doping === "lett" ? 0.04 : TUNNEL_RUN;
        const sc = (doping === "lett" ? c.e : rnd()) - 12 * Math.max(0, c.x - w - reach);
        if (sc > score) (score = sc), (best = c);
      }
      if (!best) return;
      best.state = "cross";
      best.dir = -1;
      best.x0 = best.x;
      if (doping === "lett") {
        best.tunnel = false;
        best.E = ecB() + Math.max(best.e, barrier() + 0.15 + 0.45 * expo());
      } else {
        best.tunnel = true;
        const lo = Math.max(ecB() + 0.1, Math.min(0, efS()) - 0.4);
        const hi = Math.max(lo + 0.2, Math.max(0, efS()));
        best.E = lo + (hi - lo) * rnd();
      }
      // Kretsen fyller på et elektron ved kontakten til høyre.
      carriers.push({ ...walker(1, 0), state: "enter" });
    }
    /** Metallet sender et elektron inn i halvlederen. */
    function emitFromMetal() {
      const c = walker(0, 1);
      c.state = "cross";
      c.dir = 1;
      c.x0 = 0;
      if (doping === "lett") {
        c.tunnel = false;
        c.E = PHIB + 0.15 + 0.6 * expo();
      } else {
        c.tunnel = true;
        const lo = Math.max(ecB() + 0.1, Math.min(0, efS()) - 0.4);
        const hi = Math.max(lo + 0.2, Math.max(0, efS()));
        c.E = lo + (hi - lo) * rnd();
      }
      carriers.push(c);
      // Kretsen tar ut elektronet nærmest kontakten til høyre.
      let far = null;
      for (const o of carriers) if (o.state === "walk" && (!far || o.x > far.x)) far = o;
      if (far) far.state = "leave";
    }

    function physics(dt) {
      clock += dt;
      const w = W();
      const rSM = doping === "lett" ? R0 * Math.exp(V) : RT * Math.max(0, 1 + 0.3 * V);
      const rMS = doping === "lett" ? R0 : RT * Math.max(0, 1 - 0.3 * V);
      debtSM += rSM * dt;
      debtMS += rMS * dt;
      // Strømmen i den nøytrale delen er drift: elektronene driver mot sonen med en fart som
      // gir like mange per sekund som går over.
      let nw = 0;
      for (const c of carriers) if (c.state === "walk" || c.state === "enter") nw++;
      const vd = nw ? ((rSM - rMS) * (1 - w)) / nw : 0;
      while (debtSM >= 1) (debtSM -= 1), crossToMetal();
      while (debtMS >= 1) (debtMS -= 1), emitFromMetal();
      const sd = Math.sqrt(2 * DIFF * dt);
      const keep = [];
      for (const c of carriers) {
        c.age += dt;
        if (c.state === "walk" || c.state === "enter") {
          let x = c.x - vd * dt + sd * gauss();
          if (x < w) x = 2 * w - x;
          if (x > 1) x = 2 - x;
          c.x = Math.max(w, Math.min(1, x));
          c.retarget -= dt;
          if (c.retarget < 0) (c.eT = thermal()), (c.retarget = 0.6 + rnd());
          c.e += (c.eT - c.e) * Math.min(1, dt / 0.5);
          if (c.state === "enter" && c.age > BORN) c.state = "walk";
          keep.push(c);
        } else if (c.state === "cross") {
          c.x += c.dir * (c.tunnel ? CROSS_VT : CROSS_V) * dt;
          if (c.dir < 0 && c.x <= 0) {
            flash(0, c.E);
            continue;
          }
          if (c.dir > 0 && c.x >= w + (c.tunnel ? TUNNEL_RUN : 0.03)) {
            c.state = "walk";
            c.e = Math.max(0.05, c.E - ecB());
            c.eT = thermal();
            c.retarget = 0.8;
          }
          keep.push(c);
        } else if (c.state === "leave") {
          c.x += 0.6 * dt;
          if (c.x < 1.04) keep.push(c);
        }
      }
      carriers = keep;
      flashes = flashes.filter((f) => clock - f.t < FADE);
      const target = iTheory();
      iShown += (target - iShown) * Math.min(1, dt / 0.35);
      for (const c of carriers) c.px += (c.x - c.px) * Math.min(1, dt / 0.06);
    }

    function advance(dt) {
      let left = dt;
      while (left > 1e-9) {
        const h = Math.min(1 / 60, left);
        physics(h);
        left -= h;
      }
    }
    function still() {
      for (let t = 0; t < 4; t += 1 / 30) advance(1 / 30);
      flashes = [];
      for (const c of carriers) c.px = c.x;
      iShown = iTheory();
      render();
    }

    // ── geometri ──────────────────────────────────────────────────────────
    let G = null;
    function layout() {
      const { w, h } = getSize();
      if (w < 200 || h < 300) return null;
      const bx0 = 12;
      const bx1 = w - 10;
      const mw = Math.round((bx1 - bx0) * 0.2);
      const wireY = 22;
      const by0 = 50;
      const by1 = 76;
      const ey0 = 104;
      const ey1 = h - 6;
      const kT = (ey1 - ey0) / (E_HI - E_LO);
      return { w, h, bx0, bx1, mw, wireY, by0, by1, ey0, ey1, kT };
    }
    const xS = () => G.bx0 + G.mw;
    const X = (x) => xS() + x * (G.bx1 - xS());
    const yE = (E) => G.ey0 + (E_HI - E) * G.kT;

    // ── tegning ───────────────────────────────────────────────────────────
    const P = (n) => n.toFixed(1);
    const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
    const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
      `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
    const sub = (main, t) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${t}</tspan>`;
    const bracket = (x, y0, y1) =>
      `<path d="M ${P(x - 4)} ${P(y0)} h 8 M ${P(x)} ${P(y0)} V ${P(y1)} M ${P(x - 4)} ${P(y1)} h 8" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;

    function circuit() {
      const { bx0, bx1, by0, by1, wireY } = G;
      const ym = (by0 + by1) / 2;
      let s = "";
      const xb = bx0 + (bx1 - bx0) * 0.32;
      const xa = bx0 + (bx1 - bx0) * 0.7;
      const r = 15;
      const gapB = Math.abs(V) > 1e-9 ? 5 : 0;
      s += `<path d="M ${P(bx0)} ${P(ym)} H ${P(bx0 - 6)} V ${P(wireY)} H ${P(xb - gapB)} M ${P(xb + gapB)} ${P(wireY)} H ${P(xa - r)} M ${P(xa + r)} ${P(wireY)} H ${P(bx1 + 4)} V ${P(ym)} H ${P(bx1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
      if (gapB) {
        // Den lange platen er pluss. I lederetningen er metallet (til venstre) positivt.
        const plusLeft = V > 0;
        const xl = xb - gapB;
        const xr = xb + gapB;
        const long = (x) => `M ${P(x)} ${P(wireY - 9)} V ${P(wireY + 9)}`;
        const short = (x) => `M ${P(x)} ${P(wireY - 5)} V ${P(wireY + 5)}`;
        s += `<path d="${plusLeft ? long(xl) : long(xr)}" style="stroke:var(--fg)" stroke-width="1.6"/>`;
        s += `<path d="${plusLeft ? short(xr) : short(xl)}" style="stroke:var(--fg)" stroke-width="3"/>`;
        s += tag(xl - 4, wireY - 6, plusLeft ? "+" : "−", "end", "var(--fg)") + tag(xr + 4, wireY - 6, plusLeft ? "−" : "+", "start", "var(--fg)");
      }
      const u = Math.max(-1.05, Math.min(1.05, iShown / iFull()));
      const ang = (u * 70 * Math.PI) / 180;
      s += `<circle cx="${P(xa)}" cy="${P(wireY)}" r="${r}" style="fill:var(--canvas-bg);stroke:var(--fg)" stroke-width="1.2"/>`;
      for (const t of [-1, -0.5, 0, 0.5, 1]) {
        const a = (t * 70 * Math.PI) / 180;
        const x0 = xa + Math.sin(a) * (r - 4);
        const y0 = wireY + 4 - Math.cos(a) * (r - 4);
        const x1 = xa + Math.sin(a) * (r - 1.5);
        const y1 = wireY + 4 - Math.cos(a) * (r - 1.5);
        s += `<path d="M ${P(x0)} ${P(y0)} L ${P(x1)} ${P(y1)}" style="stroke:var(--muted)" stroke-width="${t === 0 ? 1.4 : 1}"/>`;
      }
      s += `<path d="M ${P(xa)} ${P(wireY + 4)} L ${P(xa + Math.sin(ang) * (r - 3))} ${P(wireY + 4 - Math.cos(ang) * (r - 3))}" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round"/>`;
      s += tag(xa + r + 4, wireY - 8, "I", "start", "var(--fg)", ";font-style:italic");
      return s;
    }

    function bar() {
      const { bx0, bx1, mw, by0, by1 } = G;
      const w = W();
      let s = "";
      const x0 = X(0);
      const x1 = X(w);
      s +=
        `<rect x="${P(x0)}" y="${P(by0)}" width="${P(Math.max(1.5, x1 - x0))}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.12"/>` +
        `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(mw)}" height="${P(by1 - by0)}" rx="2" style="fill:var(--muted)" fill-opacity="0.28"/>` +
        `<rect x="${P(x0)}" y="${P(by0)}" width="${P(bx1 - x0)}" height="${P(by1 - by0)}" rx="2" fill="none" stroke="var(--border-strong)" stroke-width="1"/>`;
      const rows = 3;
      const cols = Math.max(1, Math.round((x1 - x0) / 9));
      let d = "";
      for (let i = 0; i < cols; i++)
        for (let r = 0; r < rows; r++) {
          const x = x0 + ((i + 0.5) / cols) * (x1 - x0);
          const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
          d += `M ${P(x - 2.2)} ${P(y)} h 4.4 M ${P(x)} ${P(y - 2.2)} v 4.4 `;
        }
      s += `<path d="${d}" style="stroke:var(--orange)" stroke-width="1.6"/>`;
      s += tag(bx0 + 5, by1 - 8, "Au", "start", "var(--fg)") + tag(bx1 - 5, by1 - 8, doping === "lett" ? "n" : "n⁺", "end", "var(--fg)");
      if (doping === "lett" && x1 - x0 > 20) {
        const yb = by1 + 10;
        s +=
          `<path d="M ${P(x0)} ${P(yb - 4)} v 8 M ${P(x0)} ${P(yb)} H ${P(x1)} M ${P(x1)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
          tag((x0 + x1) / 2, yb + 12, "W", "middle", "var(--fg)", ";font-style:italic" + halo);
      }
      return s;
    }

    function bands() {
      const { bx0, bx1, mw, ey0, ey1 } = G;
      const w = W();
      let s = "";
      const xI = X(0);
      // Sonen tonet.
      s += `<rect x="${P(xI)}" y="${P(ey0 - 6)}" width="${P(Math.max(1.5, X(w) - xI))}" height="${P(ey1 - ey0 + 6)}" style="fill:var(--accent)" fill-opacity="0.07"/>`;
      // Metallets fylte tilstander.
      s +=
        `<rect x="${P(bx0)}" y="${P(yE(0))}" width="${P(mw)}" height="${P(ey1 - yE(0))}" style="fill:var(--muted)" fill-opacity="0.28"/>` +
        `<path d="M ${P(bx0)} ${P(yE(0))} H ${P(xI)} V ${P(ey1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.4"/>`;
      // E_c.
      let pc = "";
      const M = 140;
      for (let i = 0; i <= M; i++) {
        const x = (w * 1.02 * i) / M;
        pc += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(Ec(x)))} `;
      }
      pc += `L ${P(bx1)} ${P(yE(ecB()))}`;
      s += `<path d="${pc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
      // Barrieren sett fra halvledersiden: E_c ved grenseflaten forlenget innover (stiplet).
      if (doping === "lett") s += `<path d="M ${P(xI)} ${P(yE(PHIB))} H ${P(bx1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
      // Fermi-nivåene: E_Fm i metallet, forlenget svakt over halvlederen når de skilles.
      s += `<path d="M ${P(bx0)} ${P(yE(0))} H ${P(xI)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
      if (Math.abs(V) > 1e-9) s += `<path d="M ${P(xI)} ${P(yE(0))} H ${P(bx1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>`;
      s += `<path d="M ${P(X(w))} ${P(yE(efS()))} H ${P(bx1)}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;

      // Elektronene.
      let dots = "";
      let trails = "";
      for (const c of carriers) {
        let E;
        let x = X(c.px);
        if (c.state === "cross") {
          E = c.E;
          const xs = Math.max(0, Math.min(1, c.px));
          x = X(xs);
          const x0 = c.dir < 0 ? Math.min(c.x0, w + (c.tunnel ? TUNNEL_RUN : 0.03)) : 0;
          trails += `<path d="M ${P(X(x0))} ${P(yE(E))} H ${P(x)}" style="stroke:var(--indigo)" stroke-width="1.2" opacity="0.4"${c.tunnel ? ' stroke-dasharray="2 2"' : ""}/>`;
        } else E = ecB() + (doping === "lett" ? c.e * Math.min(1, Math.max(0.1, barrier() - 0.12) / 4.6) : c.e);
        const op = c.state === "enter" ? Math.min(1, c.age / BORN) : c.state === "leave" ? Math.max(0, 1 - (c.x - 1) / 0.04) : 1;
        dots += `<circle cx="${P(x)}" cy="${P(yE(E))}" r="2.1"${op < 1 ? ` opacity="${op.toFixed(2)}"` : ""}/>`;
      }
      let fl = "";
      for (const f of flashes) {
        const u = (clock - f.t) / FADE;
        fl += `<circle cx="${P(X(f.x))}" cy="${P(yE(f.E))}" r="${P(2.1 + 2 * u)}" style="fill:var(--indigo)" opacity="${(0.6 * (1 - u)).toFixed(2)}"/>`;
      }
      s += trails + `<g style="fill:var(--indigo)">${dots}</g>${fl}`;

      // Merkene.
      s +=
        tag(bx1 - 2, yE(ecB()) + (doping === "lett" ? -6 : 14), sub("E", "c"), "end", "var(--fg)", halo) +
        tag(bx1 - 2, yE(efS()) + (doping === "lett" ? 14 : -6), sub("E", "F"), "end", "var(--accent)", halo) +
        tag(bx0 + 3, yE(0) + 14, sub("E", "Fm"), "start", "var(--accent)", halo);
      // qΦ_B ved grenseflaten.
      const xb = xI + 8;
      s += bracket(xb, yE(0), yE(PHIB)) + tag(xb + 7, yE(PHIB * 0.78) + 4, `q${sub("Φ", "B")}`, "start", "var(--fg)", halo);
      if (doping === "lett") {
        // q(V₀ − V) like utenfor sonen.
        const xk = Math.max(X(w) + 12, xb + 46);
        const lbl = Math.abs(V) < 1e-9 ? `q${sub("V", "0")}` : `q(${sub("V", "0")} − V)`;
        s += bracket(xk, yE(PHIB), yE(ecB())) + tag(xk + 2, yE(PHIB) - 7, lbl, "start", "var(--fg)", halo);
      }
      // qV mellom Fermi-nivåene, helt til høyre.
      if (Math.abs(V) >= 1) {
        const xq = bx1 - 44;
        s += bracket(xq, yE(0), yE(efS())) + tag(xq - 6, (yE(0) + yE(efS())) / 2 + 4, "qV", "end", "var(--fg)", halo);
      }
      return s;
    }

    function render() {
      G = layout();
      if (!G) return;
      stage.innerHTML =
        `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
        `${circuit()}${bar()}${bands()}</svg>`;
    }

    // ── bevegelse ─────────────────────────────────────────────────────────
    let raf = 0;
    let last = 0;
    let visible = false;
    function frame(now) {
      raf = 0;
      if (signal.aborted || !visible || reduce.matches || paused) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
      last = now;
      advance(dt);
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
    reduce.addEventListener("change", () => (reduce.matches ? still() : start()), { signal });
    signal.addEventListener(
      "abort",
      () => {
        io.disconnect();
        if (raf) cancelAnimationFrame(raf);
      },
      { once: true },
    );
    onResize(() => render());
    reset();
  };
}

export default make({ doping: "lett" });
