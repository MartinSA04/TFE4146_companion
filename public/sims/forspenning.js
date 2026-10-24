/**
 * «Spenning over overgangen» for TFE4146, diodeligningen og gjennombrudd.
 *
 * Én idé: en spenning flytter båndene på n-siden opp eller ned i forhold til
 * p-siden, så barrieren blir q(V₀ − V). Majoritetsbærerne som har energi over
 * barrieren, kommer over (diffusjon), og for hver k_BT barrieren senkes, kommer
 * e ganger så mange over. Minoritetsbærerne som vandrer inn i sonen, går over
 * uansett hvor høy barrieren er (drift), så antallet per sekund er satt av hvor
 * mange som dannes nær sonen. Bærerne som har kommet over, er minoritetsbærere
 * på den andre siden: de vandrer innover og rekombinerer innen en
 * diffusjonslengde (injeksjon). I sperreretningen feies minoritetsbærerne ved
 * kantene over, og ingen kommer tilbake (ekstraksjon). Streetman & Banerjee
 * §5.3, fig. 5–13, 5–15 og 5–18.
 *
 * Modellen følger læreboka: hver bærer har en kinetisk energi trukket fra
 * fordelingen i båndet (tettest litt over båndkanten) og vandrer tilfeldig.
 * Majoritetsbærere kommer over barrieren med raten R₀·e^{qV/k_BT}, og bare
 * bærere med energi over barrieren går over. Minoritetsbærere dannes jevnt i
 * hvert nøytralt område og rekombinerer med levetiden τ; de som når sonekanten,
 * feies over. En bærer som har kommet over barrieren, er alt regnet med og
 * snur ved kanten. Med R₀ satt lik driftraten i likevekt gir summen av de to
 * gruppene nøyaktig profilen n_p + n_p(e^{qV/k_BT} − 1)e^{−x/L}, og strømmen
 * blir I₀(e^{qV/k_BT} − 1). Barrieren er rundt 3 k_BT (rundt 30 i silisium),
 * og spenningen går fra −3 til +2 k_BT/q.
 *
 * Øverst står kretsen med batteriet og et amperemeter med nullpunkt i midten,
 * så staven med ionene i sonen (oransje), og under det båndskjemaet på samme
 * x-akse med elektronene (blå prikker) og hullene (røde ringer) ved energiene
 * sine, kvasi-Fermi-nivåene F_n og F_p, og barrieren som stiplede linjer.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const EG = 7; // båndgapet i modellen, i k_BT
const L = 0.1; // diffusjonslengden, i staver
const TAU = 1.2; // levetiden til minoritetsbærerne, s
const DIFF = (L * L) / TAU; // staver²/s
const V_MIN = -3;
const V_MAX = 2;
const DOPING = {
  // tettheter per stavlengde; N·X bærere i et nøytralt område med lengde X
  lik: { na: 280, nd: 280 },
  ppn: { na: 420, nd: 140 },
};
const NI2 = 280 * 280 * Math.exp(-3); // gir V₀ = 3 k_BT ved lik doping
const WK = 1.155 * Math.sqrt(1.4); // W = WK·√(b·(1/N_a + 1/N_d)), W = 0,2 stav ved lik doping i likevekt
const E_TOP = 7.3; // øverste energi i bildet, k_BT over midten mellom E_c på de to sidene
const E_SPAN = 21.6; // høyden av båndskjemaet, k_BT
const CROSS_T = 0.32; // s for en tur over sonen
const FADE = 0.4; // s
const BORN = 0.3; // s, en nydannet bærer toner inn

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let doping = "lik";
  let V = 0; // i k_BT/q
  let paused = false;
  let carriers = [];
  let flashes = []; // { x, E, s, t }
  let clock = 0;
  let debtE = 0;
  let debtH = 0;
  let iShown = 0;

  const D = () => DOPING[doping];
  const V0 = () => Math.log((D().na * D().nd) / NI2);
  const b = () => V0() - V; // barrieren, k_BT
  // Avstanden fra E_F til majoritetsbåndet på hver side, så V₀ = EG − δn − δp.
  const deltas = () => {
    const { na, nd } = D();
    const sum = EG - V0();
    const diff = Math.log(na / nd); // δn − δp
    return { dn: (sum + diff) / 2, dp: (sum - diff) / 2 };
  };
  function zone() {
    const { na, nd } = D();
    const W = WK * Math.sqrt(Math.max(0.05, b()) * (1 / na + 1 / nd));
    const xp0 = (W * nd) / (na + nd);
    const xn0 = (W * na) / (na + nd);
    return { W, xp0, xn0, ep: 0.5 - xp0, en: 0.5 + xn0 };
  }
  // E_c på hver side: barrieren b deles likt, så bildet står stille i midten.
  const ecP = () => b() / 2;
  const ecN = () => -b() / 2;
  // E_c(x) med to parabler i sonen.
  function Ec(x) {
    const { xp0, xn0, ep, en } = zone();
    const { na, nd } = D();
    const bb = b();
    const bp = (bb * nd) / (na + nd);
    const bn = (bb * na) / (na + nd);
    const top = bb / 2;
    if (x <= ep) return top;
    if (x >= en) return top - bb;
    if (x <= 0.5) return top - bp * ((x - ep) / xp0) ** 2;
    return top - bb + bn * ((en - x) / xn0) ** 2;
  }
  const Ev = (x) => Ec(x) - EG;
  // Minoritetstettheten i likevekt og raten R₀ over barrieren i likevekt.
  const npEq = () => NI2 / D().na; // elektroner per stav på p-siden
  const pnEq = () => NI2 / D().nd; // hull per stav på n-siden
  const SIG_FRAME = Math.sqrt(2 * DIFF * (1 / 60));
  const CORR = L / (L + 0.58 * SIG_FRAME); // diskrete steg forskyver den absorberende kanten
  const R0e = () => npEq() * Math.sqrt(DIFF / TAU) * CORR;
  const R0h = () => pnEq() * Math.sqrt(DIFF / TAU) * CORR;

  // ── kontroller ──────────────────────────────────────────────────────────
  const label = document.createElement("label");
  label.append("Spenning ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(V_MIN);
  input.max = String(V_MAX);
  input.step = "0.5";
  input.value = "0";
  input.setAttribute("aria-label", "Spenningen over dioden i enheter av k_BT/q, positiv med p-siden positiv");
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
      { value: "lik", label: "Lik doping" },
      { value: "ppn", label: "p sterkere dopet" },
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
  pauseBtn.addEventListener(
    "click",
    () => {
      paused = !paused;
      pauseBtn.textContent = paused ? "Spill av" : "Pause";
      if (!paused) start();
    },
    { signal },
  );
  pauseBtn.textContent = "Pause";
  controls.append(label, pauseBtn, dopPick.el);
  dopPick.sync(doping);
  showV();

  // ── modellen ────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  // Kinetisk energi i et bånd: Γ(3/2), tettest litt over båndkanten.
  const thermal = () => Math.min(4.2, 0.5 * gauss() ** 2 - Math.log(rnd() || 1e-12));
  const mk = (s, side, x, origin, age = 1) => {
    const e = thermal();
    return { s, side, x, px: x, e, eT: e, origin, state: "walk", age, cr: null };
  };
  const isMaj = (c) => (c.s < 0 ? c.side === "n" : c.side === "p");

  function reset() {
    carriers = [];
    flashes = [];
    debtE = 0;
    debtH = 0;
    const { na, nd } = D();
    const z = zone();
    const nh = Math.round(na * z.ep);
    const ne = Math.round(nd * (1 - z.en));
    for (let i = 0; i < nh; i++) carriers.push(mk(1, "p", ((i + rnd()) / nh) * z.ep, "maj"));
    for (let i = 0; i < ne; i++) carriers.push(mk(-1, "n", z.en + ((i + rnd()) / ne) * (1 - z.en), "maj"));
    // Minoritetsbærerne i likevekt, jevnt fordelt.
    const me = Math.round(npEq() * z.ep);
    const mh = Math.round(pnEq() * (1 - z.en));
    for (let i = 0; i < me; i++) carriers.push(mk(-1, "p", rnd() * z.ep, rnd() < 0.5 ? "gen" : "inj"));
    for (let i = 0; i < mh; i++) carriers.push(mk(1, "n", z.en + rnd() * (1 - z.en), rnd() < 0.5 ? "gen" : "inj"));
    iShown = 0;
    if (reduce.matches || paused) still();
    else start();
  }

  function flash(c) {
    flashes.push({ x: c.px, E: energyOf(c), s: c.s, t: clock });
  }
  function energyOf(c) {
    if (c.state === "cross") return c.cr.E;
    return c.s < 0 ? Ec(c.x) + c.e : Ev(c.x) - c.e;
  }

  /** Fjern majoritetsbæreren av typen s nærmest x, og sett en ny inn ved kontakten. */
  function swapMajority(s, x, flashIt) {
    let best = -1;
    let bd = 1e9;
    carriers.forEach((c, i) => {
      if (c.s !== s || !isMaj(c) || c.state !== "walk") return;
      const d = Math.abs(c.x - x);
      if (d < bd) (bd = d), (best = i);
    });
    if (best < 0) return;
    if (flashIt) flash(carriers[best]);
    carriers.splice(best, 1);
    const z = zone();
    carriers.push(mk(s, s > 0 ? "p" : "n", s > 0 ? rnd() * 0.02 : 1 - rnd() * 0.02, "maj", 0));
    void z;
  }
  /** En majoritetsbærer går ut gjennom kontakten. */
  function exitAtContact(s) {
    let best = -1;
    let bd = -1;
    carriers.forEach((c, i) => {
      if (c.s !== s || !isMaj(c) || c.state !== "walk") return;
      const d = s > 0 ? -c.x : c.x; // hull: nærmest x = 0, elektroner: nærmest x = 1
      if (d > bd) (bd = d), (best = i);
    });
    if (best >= 0) carriers.splice(best, 1);
  }

  function startCross(c) {
    const z = zone();
    c.state = "cross";
    const fromP = c.side === "p";
    const x0 = fromP ? z.ep : z.en;
    const x1 = fromP ? z.en : z.ep;
    c.cr = { x0, x1, t: 0, dur: CROSS_T * (0.6 + z.W * 2), E: c.s < 0 ? Ec(x0) + c.e : Ev(x0) - c.e, maj: isMaj(c) };
    c.x = x0;
  }
  function endCross(c) {
    const toN = c.cr.x1 > 0.5;
    c.side = toN ? "n" : "p";
    c.x = c.cr.x1 + (toN ? 0.004 : -0.004);
    c.px = c.x;
    const E = c.cr.E;
    c.e = Math.max(0, c.s < 0 ? E - Ec(c.x) : Ev(c.x) - E);
    c.eT = thermal();
    c.state = "walk";
    if (c.cr.maj) {
      // Over barrieren: nå en injisert minoritetsbærer; kontakten erstatter majoritetsbæreren.
      c.origin = "inj";
      carriers.push(mk(c.s, c.s > 0 ? "p" : "n", c.s > 0 ? rnd() * 0.02 : 1 - rnd() * 0.02, "maj", 0));
    } else {
      // Feid over: nå en majoritetsbærer; en går ut gjennom kontakten.
      c.origin = "maj";
      exitAtContact(c.s);
    }
    c.cr = null;
  }

  /** Neste bærer som skal over barrieren: en majoritetsbærer nær kanten med energi over barrieren. */
  function inject(s) {
    const z = zone();
    const edge = s < 0 ? z.en : z.ep;
    const bb = b();
    let best = null;
    let bd = 1e9;
    let near = null;
    let nd = 1e9;
    for (const c of carriers) {
      if (c.s !== s || !isMaj(c) || c.state !== "walk") continue;
      const d = Math.abs(c.x - edge);
      if (d < nd) (nd = d), (near = c);
      if (d < 0.06 && c.e > bb && d < bd) (bd = d), (best = c);
    }
    if (best) return startCross(best);
    if (near) {
      // Ingen har nok energi akkurat nå: den nærmeste får et termisk dytt over barrieren.
      near.state = "aim";
      near.eT = bb + 0.3 + 0.6 * -Math.log(rnd() || 1e-12);
    }
  }

  function physics(dt) {
    const z = zone();
    const sd = Math.sqrt(2 * DIFF * dt);
    const Ie = R0e() * (Math.exp(V) - 1);
    const Ih = R0h() * (Math.exp(V) - 1);
    const Itot = Ie + Ih; // bærere per sekund
    const { na, nd } = D();
    // Majoritetsbærerne strømmer mot sonen med farten som fører strømmen.
    const vH = Itot / na;
    const vE = -Itot / nd;
    for (const c of carriers) {
      c.age += dt;
      // Energien følger et termisk mål, som byttes tilfeldig; varme bærere kjøles ned.
      if (c.state !== "aim" && rnd() < dt * 1.5) c.eT = thermal();
      const ke = c.state === "aim" ? dt / 0.12 : dt / 0.35;
      c.e += (c.eT - c.e) * Math.min(1, ke);
      if (c.state === "cross") {
        c.cr.t += dt;
        const u = Math.min(1, c.cr.t / c.cr.dur);
        c.x = c.cr.x0 + (c.cr.x1 - c.cr.x0) * u;
        if (u >= 1) endCross(c);
        continue;
      }
      const maj = isMaj(c);
      let x = c.x + sd * gauss();
      if (maj) x += (c.s > 0 ? vH : vE) * dt;
      if (c.state === "aim") x += (c.s > 0 ? 1 : -1) * 0.08 * dt; // mot sonen
      if (c.side === "p") {
        if (x < 0) x = -x; // kontakten holder likevektstettheten
        if (x >= z.ep) {
          if (maj) {
            if (c.state === "aim" && c.e > b()) {
              startCross(c);
              continue;
            }
            x = 2 * z.ep - x;
          } else if (c.origin === "gen") {
            startCross(c);
            continue;
          } else x = 2 * z.ep - x;
        }
        x = Math.min(x, z.ep - 1e-4);
      } else {
        if (x > 1) x = 2 - x;
        if (x <= z.en) {
          if (maj) {
            if (c.state === "aim" && c.e > b()) {
              startCross(c);
              continue;
            }
            x = 2 * z.en - x;
          } else if (c.origin === "gen") {
            startCross(c);
            continue;
          } else x = 2 * z.en - x;
        }
        x = Math.max(x, z.en + 1e-4);
      }
      c.x = x;
      if (c.state === "aim" && c.e > b() && Math.abs(x - (c.side === "p" ? z.ep : z.en)) < 0.02) startCross(c);
    }

    // Rekombinasjon av minoritetsbærere; en majoritetsbærer går med, og kontakten erstatter den.
    const gone = [];
    for (const c of carriers) if (c.state === "walk" && !isMaj(c) && rnd() < dt / TAU) gone.push(c);
    for (const c of gone) {
      const i = carriers.indexOf(c);
      if (i < 0) continue;
      flash(c);
      carriers.splice(i, 1);
      swapMajority(-c.s, c.x, true);
    }
    // Generasjon: nye minoritetsbærere jevnt i hvert nøytralt område.
    const gE = (npEq() * z.ep * dt) / TAU;
    const gH = (pnEq() * (1 - z.en) * dt) / TAU;
    if (rnd() < gE) carriers.push(mk(-1, "p", rnd() * z.ep, "gen", 0));
    if (rnd() < gH) carriers.push(mk(1, "n", z.en + rnd() * (1 - z.en), "gen", 0));
    // Over barrieren.
    debtE += R0e() * Math.exp(V) * dt;
    debtH += R0h() * Math.exp(V) * dt;
    while (debtE >= 1) (debtE -= 1), inject(-1);
    while (debtH >= 1) (debtH -= 1), inject(1);
    // Antallet majoritetsbærere følger dopingen ganger lengden av det nøytrale området.
    const holdCount = (s, target) => {
      const list = carriers.filter((c) => c.s === s && isMaj(c) && c.state === "walk");
      if (list.length < target - 1) {
        const x = s > 0 ? z.ep - 0.01 * rnd() : z.en + 0.01 * rnd();
        carriers.push(mk(s, s > 0 ? "p" : "n", x, "maj", 0));
      } else if (list.length > target + 1) {
        const edge = s > 0 ? z.ep : z.en;
        list.sort((a, c) => Math.abs(a.x - edge) - Math.abs(c.x - edge));
        carriers.splice(carriers.indexOf(list[0]), 1);
      }
    };
    holdCount(1, na * z.ep);
    holdCount(-1, nd * (1 - z.en));
    // Bærere som ligger i sonen etter at den har vokst, skyves ut.
    for (const c of carriers) {
      if (c.state === "cross") continue;
      if (c.side === "p" && c.x > z.ep) c.x = z.ep - 0.002;
      if (c.side === "n" && c.x < z.en) c.x = z.en + 0.002;
    }
  }

  function advance(dt) {
    clock += dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(1 / 60, left);
      physics(h);
      left -= h;
    }
    const kp = Math.min(1, dt / 0.07);
    for (const c of carriers) c.px = c.state === "cross" ? c.x : c.px + (c.x - c.px) * kp;
    const target = (R0e() + R0h()) * (Math.exp(V) - 1);
    iShown += (target - iShown) * Math.min(1, dt / 0.35);
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }

  /** Uten bevegelse: kjør modellen fram til stasjonær tilstand og tegn ett bilde. */
  function still() {
    for (let t = 0; t < 6; t += 1 / 30) advance(1 / 30);
    flashes = [];
    for (const c of carriers) c.px = c.x;
    iShown = (R0e() + R0h()) * (Math.exp(V) - 1);
    render();
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 300) return null;
    const gut = 44; // høyre marg for merkene i båndskjemaet
    const bx0 = 10;
    const bx1 = w - gut;
    const wireY = 22;
    const by0 = 50;
    const by1 = 74;
    const ey0 = 104;
    const ey1 = h - 6;
    const kT = (ey1 - ey0) / E_SPAN;
    return { w, h, bx0, bx1, len: bx1 - bx0, wireY, by0, by1, ey0, ey1, kT };
  }
  const X = (x) => G.bx0 + x * G.len;
  const yE = (E) => G.ey0 + (E_TOP - E) * G.kT;

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function circuit() {
    const { bx0, bx1, by0, by1, wireY } = G;
    const ym = (by0 + by1) / 2;
    let s = "";
    // Ledningene fra kontaktene opp til toppen.
    const xb = bx0 + G.len * 0.3;
    const xa = bx0 + G.len * 0.7;
    const r = 15;
    const gapB = Math.abs(V) > 1e-9 ? 5 : 0;
    s += `<path d="M ${P(bx0)} ${P(ym)} H ${P(bx0 - 6)} V ${P(wireY)} H ${P(xb - gapB)} M ${P(xb + gapB)} ${P(wireY)} H ${P(xa - r)} M ${P(xa + r)} ${P(wireY)} H ${P(bx1 + 6)} V ${P(ym)} H ${P(bx1)}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    // Batteriet: den lange platen er pluss.
    if (gapB) {
      const plusLeft = V > 0;
      const xl = xb - gapB;
      const xr = xb + gapB;
      const long = (x) => `M ${P(x)} ${P(wireY - 9)} V ${P(wireY + 9)}`;
      const short = (x) => `M ${P(x)} ${P(wireY - 5)} V ${P(wireY + 5)}`;
      s += `<path d="${plusLeft ? long(xl) + short(xr) : short(xl) + long(xr)}" style="stroke:var(--fg)" stroke-width="${plusLeft ? "1.6" : "1.6"}"/>`;
      s += `<path d="${plusLeft ? short(xr) : short(xl)}" style="stroke:var(--fg)" stroke-width="3"/>`;
      s += tag(xl - 4, wireY - 6, plusLeft ? "+" : "−", "end", "var(--fg)") + tag(xr + 4, wireY - 6, plusLeft ? "−" : "+", "start", "var(--fg)");
    }
    // Amperemeteret med nullpunkt i midten.
    const imax = refI() * (Math.exp(V_MAX) - 1);
    const u = Math.max(-1.05, Math.min(1.05, iShown / imax));
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
  const refI = () => {
    const ni2 = NI2;
    const { na, nd } = DOPING.lik;
    return (ni2 / na + ni2 / nd) * Math.sqrt(DIFF / TAU) * CORR;
  };

  function bar() {
    const { bx0, bx1, by0, by1 } = G;
    const z = zone();
    const { na, nd } = D();
    let s = "";
    const x0 = X(z.ep);
    const x1 = X(z.en);
    s +=
      `<rect x="${P(x0)}" y="${P(by0)}" width="${P(x1 - x0)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(bx0)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(bx1)} ${P(by0 + 2)} V ${P(by1 - 2)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    // Ionene i sonen, i et fast gitter: tettheten følger dopingen.
    const rows = 3;
    const ions = (from, to, n, sign) => {
      const cols = Math.max(1, Math.round(((to - from) * n) / 11));
      let d = "";
      for (let i = 0; i < cols; i++)
        for (let r = 0; r < rows; r++) {
          const x = X(from + ((i + 0.5) / cols) * (to - from));
          const y = by0 + ((r + 0.5) / rows) * (by1 - by0);
          d += `M ${P(x - 2.2)} ${P(y)} h 4.4${sign > 0 ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""} `;
        }
      return d;
    };
    s += `<path d="${ions(z.ep, 0.5, na, -1)}${ions(0.5, z.en, nd, 1)}" style="stroke:var(--orange)" stroke-width="1.6"/>`;
    s += tag(bx0 + 6, by1 - 7, "p", "start", "var(--fg)") + tag(bx1 - 6, by1 - 7, "n", "end", "var(--fg)");
    // W under staven.
    const yb = by1 + 11;
    if (x1 - x0 > 18)
      s +=
        `<path d="M ${P(x0)} ${P(yb - 4)} v 8 M ${P(x0)} ${P(yb)} H ${P(x1)} M ${P(x1)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
        tag((x0 + x1) / 2, yb + 13, "W", "middle", "var(--fg)", ";font-style:italic" + halo);
    return s;
  }

  function bands() {
    const { bx0, bx1, ey0, ey1 } = G;
    const z = zone();
    const bb = b();
    const { dn, dp } = deltas();
    let s = "";
    // Sonen tonet.
    s +=
      `<rect x="${P(X(z.ep))}" y="${P(ey0 - 8)}" width="${P(X(z.en) - X(z.ep))}" height="${P(ey1 - ey0 + 8)}" style="fill:var(--accent)" fill-opacity="0.07"/>` +
      `<path d="M ${P(X(z.ep))} ${P(G.by0)} V ${P(ey1)} M ${P(X(z.en))} ${P(G.by0)} V ${P(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;
    // Barrierene: E_c på p-siden forlenget over n-siden, E_v på n-siden forlenget over p-siden.
    s +=
      `<path d="M ${P(X(z.ep))} ${P(yE(ecP()))} H ${P(bx1)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
      `<path d="M ${P(bx0)} ${P(yE(ecN() - EG))} H ${P(X(z.en))}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    // E_c og E_v.
    const M = 90;
    let pc = "";
    let pv = "";
    for (let i = 0; i <= M; i++) {
      const x = i / M;
      const xs = x < z.ep || x > z.en ? x : x; // samme x
      pc += `${i ? "L" : "M"} ${P(X(xs))} ${P(yE(Ec(xs)))} `;
      pv += `${i ? "L" : "M"} ${P(X(xs))} ${P(yE(Ev(xs)))} `;
    }
    // finere i sonen
    let zc = "";
    let zv = "";
    for (let i = 0; i <= 40; i++) {
      const x = z.ep + ((z.en - z.ep) * i) / 40;
      zc += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(Ec(x)))} `;
      zv += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(Ev(x)))} `;
    }
    s +=
      `<path d="M ${P(bx0)} ${P(yE(ecP()))} H ${P(X(z.ep))} M ${P(X(z.en))} ${P(yE(ecN()))} H ${P(bx1)} ${zc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="M ${P(bx0)} ${P(yE(ecP() - EG))} H ${P(X(z.ep))} M ${P(X(z.en))} ${P(yE(ecN() - EG))} H ${P(bx1)} ${zv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    void pc;
    void pv;
    // Kvasi-Fermi-nivåene fra minoritetsprofilene i teorien.
    const efp = ecP() - EG + dp; // E_F på p-siden
    const efn = ecN() - dn; // E_F på n-siden, qV over E_F på p-siden
    const ev = Math.exp(V) - 1;
    let fn = "";
    let fp = "";
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const x = (z.ep * i) / N;
      const xp = z.ep - x;
      const f = efp + Math.log(Math.max(1e-9, 1 + ev * Math.exp(-xp / L)));
      fn += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(Math.max(f, E_TOP - E_SPAN)))} `;
    }
    fn += `L ${P(bx1)} ${P(yE(efn))}`;
    fp += `M ${P(bx0)} ${P(yE(efp))} L ${P(X(z.en))} ${P(yE(efp))} `;
    for (let i = 0; i <= N; i++) {
      const xn = ((1 - z.en) * i) / N;
      const f = efn - Math.log(Math.max(1e-9, 1 + ev * Math.exp(-xn / L)));
      fp += `L ${P(X(z.en + xn))} ${P(yE(Math.min(f, E_TOP)))} `;
    }
    const split = Math.abs(V) > 0.01;
    s +=
      `<path d="${fp}" fill="none" style="stroke:var(--red)" stroke-width="1.4" stroke-dasharray="5 3"/>` +
      `<path d="${fn}" fill="none" style="stroke:var(--indigo)" stroke-width="1.4" stroke-dasharray="5 3"${split ? "" : ' stroke-dashoffset="4"'}/>`;
    // Bærerne.
    let dots = "";
    let rings = "";
    let trails = "";
    for (const c of carriers) {
      const E = energyOf(c);
      const x = X(c.px);
      const y = yE(E);
      const op = c.age < BORN ? c.age / BORN : 1;
      const opa = op < 1 ? ` opacity="${op.toFixed(2)}"` : "";
      if (c.state === "cross") {
        trails += `<path d="M ${P(X(c.cr.x0))} ${P(y)} H ${P(x)}" style="stroke:${c.s < 0 ? "var(--indigo)" : "var(--red)"}" stroke-width="1.2" opacity="0.45"/>`;
      }
      if (c.s < 0) dots += `<circle cx="${P(x)}" cy="${P(y)}" r="2.1"${opa}/>`;
      else rings += `<circle cx="${P(x)}" cy="${P(y)}" r="2.3"${opa}/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const u = (clock - f.t) / FADE;
      const x = X(f.x);
      const y = yE(f.E);
      fl +=
        f.s > 0
          ? `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.3 + 1.5 * u)}" fill="none" style="stroke:var(--red)" opacity="${(0.7 * (1 - u)).toFixed(2)}"/>`
          : `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.1 + 1.5 * u)}" style="fill:var(--indigo)" opacity="${(0.6 * (1 - u)).toFixed(2)}"/>`;
    }
    s += trails + `<g style="fill:var(--indigo)">${dots}</g><g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>${fl}`;

    // Merkene til høyre.
    const xr = bx1 + 4;
    s +=
      tag(xr, yE(ecN()) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(xr, yE(ecN() - EG) + 4, sub("E", "v"), "start", "var(--fg)");
    // Barrieren: klamme fra E_c på n-siden opp til den stiplede linjen.
    const xk = bx1 + 30;
    s +=
      `<path d="M ${P(bx1)} ${P(yE(ecP()))} H ${P(xk + 4)} M ${P(xk - 4)} ${P(yE(ecP()))} h 8 M ${P(xk)} ${P(yE(ecP()))} V ${P(yE(ecN()))} M ${P(xk - 4)} ${P(yE(ecN()))} h 8" style="stroke:var(--fg)" stroke-width="1.1"/>`;
    const lbl = Math.abs(V) < 0.01 ? `q${sub("V", "0")}` : `q(${sub("V", "0")} − V)`;
    // Merket står over elektronskyen på n-siden, med en strek ned til klammen.
    const yl = Math.min(yE(ecP()), yE(ecN() + 4.4)) - 7;
    s += tag(G.w - 2, yl, lbl, "end", "var(--fg)", halo);
    if (yE(ecP()) - yl > 12) s += `<path d="M ${P(xk)} ${P(yl + 3)} V ${P(yE(ecP()))}" style="stroke:var(--fg)" stroke-width="1" stroke-dasharray="2 2"/>`;
    // Kvasi-Fermi-merkene like utenfor sonen, F_n på n-siden og F_p på p-siden, bort fra den andre linjen.
    const xm = (X(z.ep) + X(z.en)) / 2;
    if (split) {
      const up = V > 0; // F_n over F_p i lederetningen
      s +=
        tag(X(z.en) + 4, yE(efn) + (up ? -5 : 13), sub("F", "n"), "start", "var(--indigo)", halo) +
        tag(X(z.ep) - 4, yE(efp) + (up ? 13 : -5), sub("F", "p"), "end", "var(--red)", halo);
    } else s += tag(xm, yE(efp) - 5, sub("E", "F"), "middle", "var(--accent)", halo);
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${circuit()}${bar()}${bands()}</svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
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
}
