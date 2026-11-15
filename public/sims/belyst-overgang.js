/**
 * «Lys på pn-overgangen» for TFE4146, fotodioder, lysdioder og lasere.
 *
 * Én idé: lys gir en ekstra generasjonsstrøm. Et par som dannes i sonen eller
 * innenfor en diffusjonslengde fra den, samles opp av feltet, elektronet på
 * n-siden og hullet på p-siden, så fotostrømmen går fra n til p og
 * I–V-kurven senkes med I_op = qAg_op(L_p + L_n + W). Hvor overgangen ligger
 * på kurven, avgjør hva den er: i fjerde kvadrant leverer den effekt
 * (solcelle), i tredje er strømmen satt av lyset alene (fotodetektor), i
 * første tar den imot effekt (lysdiode, laser). Streetman & Banerjee §8.1.1,
 * fig. 8–1 til 8–3 og 8–6.
 *
 * Komponenten er en solcelle av Si på 1 cm² med I_0 = 3·10⁻¹² A og
 * I_op = 40 mA i fullt sollys, så V_oc = 0,60 V, V_m ≈ 0,52 V, P_max ≈ 20 mW
 * og fyllfaktoren ≈ 0,83. Kurven er den ideelle diodeligningen minus I_op.
 *
 * Øverst båndskjemaet (Si, E_g = 1,11 eV, V_0 = 0,8 V, lik doping) med sonen
 * tonet og diffusjonslengdene merket. Lyset lager par jevnt over hele staven
 * (en gul pil fra E_v til E_c, som i modul 04). Minoritetsbæreren vandrer tilfeldig med
 * diffusjonslengden L og rekombinerer etter i snitt levetiden; når den når
 * sonen, feies den over. Majoritetspartneren går inn i mengden av
 * majoritetsbærere og toner bort. Et par i sonen feies fra hverandre med en
 * gang. I lederetningen kommer majoritetsbærere over den lavere barrieren
 * med raten I_0(e^{qV/k_BT} − 1), vandrer inn som minoritetsbærere og
 * rekombinerer. Antall bærere per sekund er skalert slik at I_op i fullt
 * sollys svarer til rundt 14 oppsamlede par per sekund.
 *
 * Under det I–V-kurven: mørk (stiplet) og belyst (heltrukket), arbeidspunktet
 * og rektangelet fra origo til punktet, med arealet lik effekten.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const EG = 1.11; // eV
const V0 = 0.8; // V, kontaktpotensialet
const VT = 0.02585; // k_BT/q ved 300 K
const I0 = 3e-12; // A
const IOP_MAX = 0.04; // A, fullt sollys
const V_MIN = -0.5;
const V_MAX = 0.65;
const W0 = 0.1; // bredden av sonen i likevekt, i staver
const L = 0.15; // diffusjonslengden, i staver
const TAU = 1.2; // s, levetiden i bildet
const DIFF = (L * L) / TAU;
const RATE_FULL = 14; // oppsamlede par per sekund i fullt sollys
const BORN_FULL = RATE_FULL / (2 * L + W0); // par per sekund og stavlengde
const RATE_CAP = 160; // injiserte bærere per sekund, øvre grense i bildet
const CROSS_T = 0.3; // s for en tur over sonen
const FADE = 0.45; // s
const ARROW_T = 0.22; // s, absorpsjonspilen

const DELTA = (EG - V0) / 2; // E_F under E_c på n-siden og over E_v på p-siden
const E_TOP = 0.78; // øverste energi i bildet, eV over midten mellom E_c på de to sidene
const E_BOT = -1.84;

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let light = 1; // andel av fullt sollys
  let V = 0;
  let paused = false;
  let carriers = [];
  let arrows = []; // { x, t }
  let flashes = []; // { x, E, s, t }
  let clock = 0;
  let debtG = 0;
  let debtI = 0;

  const iop = () => light * IOP_MAX;
  const iDark = (v) => I0 * (Math.exp(v / VT) - 1);
  const iLit = (v) => iDark(v) - iop();
  const voc = () => (iop() > 0 ? VT * Math.log(iop() / I0 + 1) : 0);

  const b = () => V0 - V; // barrieren, eV
  function zone() {
    const W = W0 * Math.sqrt(Math.max(0.02, b()) / V0);
    return { W, ep: 0.5 - W / 2, en: 0.5 + W / 2 };
  }
  // E_c(x): to parabler i sonen, b delt likt så bildet står stille i midten.
  function Ec(x) {
    const { W, ep, en } = zone();
    const bb = b();
    const h = W / 2;
    if (x <= ep) return bb / 2;
    if (x >= en) return -bb / 2;
    if (x <= 0.5) return bb / 2 - (bb / 2) * ((x - ep) / h) ** 2;
    return -bb / 2 + (bb / 2) * ((en - x) / h) ** 2;
  }
  const Ev = (x) => Ec(x) - EG;

  // ── kontroller ──────────────────────────────────────────────────────────
  function slider(name, aria, min, max, step, value, onInput) {
    const label = document.createElement("label");
    label.append(name + " ");
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(out, input);
    input.addEventListener("input", () => onInput(Number(input.value)), { signal });
    return { label, out, input };
  }
  const lys = slider("Lys", "Lyset i prosent av fullt sollys", 0, 100, 5, 100, (v) => {
    light = v / 100;
    show();
    redraw();
  });
  const spenn = slider(
    "Spenning",
    "Spenningen over overgangen i volt, positiv med p-siden positiv",
    V_MIN,
    V_MAX,
    0.01,
    0,
    (v) => {
      V = v;
      show();
      redraw();
    },
  );
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
  controls.append(lys.label, spenn.label, pauseBtn);
  const comma = (x, d) => x.toFixed(d).replace(".", ",").replace("-", "−");
  function show() {
    lys.out.textContent = `${Math.round(light * 100)} %`;
    spenn.out.textContent = `${V > 0 ? "+" : ""}${comma(V, 2)} V`;
  }
  show();
  function redraw() {
    if (reduce.matches || paused || !raf) render();
  }

  // ── modellen ────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const jitter = () => 0.015 + 0.05 * rnd(); // kinetisk energi i bildet, eV
  const side = (x) => (x < 0.5 ? "p" : "n");

  // En bærer: s = −1 elektron, +1 hull. state: walk | cross | fade.
  const mk = (s, x, kind) => ({ s, x, e: jitter(), kind, state: "walk", age: 0, cr: null, left: -Math.log(rnd() || 1e-12) * TAU });

  function energyOf(c) {
    const base = c.state === "cross" ? (c.s < 0 ? Ec(c.x) : Ev(c.x)) : c.s < 0 ? Ec(c.x) : Ev(c.x);
    return c.s < 0 ? base + c.e : base - c.e;
  }

  function birth(x) {
    const z = zone();
    arrows.push({ x, t: clock });
    const el = mk(-1, x, "op");
    const ho = mk(1, x, "op");
    if (x > z.ep && x < z.en) {
      // Feltet i sonen skiller paret med en gang.
      cross(el, z.en + 0.004);
      cross(ho, z.ep - 0.004);
      carriers.push(el, ho);
      return;
    }
    // Majoritetspartneren går inn i mengden og toner bort.
    const maj = side(x) === "p" ? ho : el;
    const min = side(x) === "p" ? el : ho;
    maj.state = "fade";
    maj.age = 0;
    carriers.push(maj, min);
  }
  function cross(c, xTo) {
    c.state = "cross";
    c.cr = { x0: c.x, x1: xTo, t: 0, T: CROSS_T * Math.max(0.3, Math.abs(xTo - c.x) / W0) };
  }
  function inject(s) {
    // En majoritetsbærer kommer over barrieren og blir minoritetsbærer på den andre siden.
    const z = zone();
    const c = mk(s, s < 0 ? z.en : z.ep, "inj");
    cross(c, s < 0 ? z.ep - 0.004 : z.en + 0.004);
    carriers.push(c);
  }

  function advance(dt) {
    clock += dt;
    const z = zone();
    // Generasjon av par, jevnt over staven.
    debtG += BORN_FULL * light * dt;
    while (debtG >= 1) {
      debtG -= 1;
      birth(rnd());
    }
    // Injeksjon over barrieren i lederetningen, like mange elektroner som hull.
    const iInj = Math.max(0, iDark(V));
    const rInj = Math.min(RATE_CAP, (RATE_FULL * iInj) / IOP_MAX);
    debtI += rInj * dt;
    while (debtI >= 1) {
      debtI -= 1;
      inject(rnd() < 0.5 ? -1 : 1);
    }
    const sig = Math.sqrt(2 * DIFF * dt);
    const keep = [];
    for (const c of carriers) {
      c.age += dt;
      if (c.state === "fade") {
        if (c.age < FADE) keep.push(c);
        continue;
      }
      if (c.state === "cross") {
        c.cr.t += dt;
        const u = Math.min(1, c.cr.t / c.cr.T);
        c.x = c.cr.x0 + (c.cr.x1 - c.cr.x0) * (u * u * (3 - 2 * u));
        if (u >= 1) {
          if (c.kind === "op") {
            // Oppsamlet: majoritetsbærer på den andre siden, går ut i kretsen.
            c.state = "fade";
            c.age = 0;
          } else {
            c.state = "walk";
            c.age = 0;
          }
        }
        keep.push(c);
        continue;
      }
      // Vandring som minoritetsbærer.
      c.left -= dt;
      if (c.left <= 0) {
        flashes.push({ x: c.x, E: energyOf(c), s: c.s, t: clock });
        continue;
      }
      let x = c.x + sig * gauss();
      if (x < 0) x = -x;
      if (x > 1) x = 2 - x;
      const minSide = c.s < 0 ? "p" : "n";
      if (minSide === "p" && x >= z.ep) {
        if (c.kind === "op") {
          c.x = z.ep;
          cross(c, z.en + 0.004);
          keep.push(c);
          continue;
        }
        x = 2 * z.ep - x; // injiserte bærere er alt regnet med og snur ved kanten
      }
      if (minSide === "n" && x <= z.en) {
        if (c.kind === "op") {
          c.x = z.en;
          cross(c, z.ep - 0.004);
          keep.push(c);
          continue;
        }
        x = 2 * z.en - x;
      }
      c.x = x;
      keep.push(c);
    }
    carriers = keep;
    arrows = arrows.filter((a) => clock - a.t < ARROW_T);
    flashes = flashes.filter((f) => clock - f.t < FADE);
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (!w || !h) return null;
    const gutL = 10;
    const gutR = w < 420 ? 34 : 44;
    const bx0 = gutL;
    const bx1 = w - gutR;
    const ey0 = 14;
    const ey1 = Math.round(h * 0.44);
    const kE = (ey1 - ey0) / (E_TOP - E_BOT);
    const brY = ey1 + 14; // klammene under båndene
    const cy0 = brY + 40; // diagrammet
    const cy1 = h - 18;
    const cx0 = 26;
    const cx1 = w - 12;
    return { w, h, bx0, bx1, len: bx1 - bx0, ey0, ey1, kE, brY, cy0, cy1, cx0, cx1 };
  }
  const X = (x) => G.bx0 + x * G.len;
  const yE = (E) => G.ey0 + (E_TOP - E) * G.kE;

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function bands() {
    const { bx0, bx1, ey0, ey1, brY } = G;
    const z = zone();
    let s = "";
    s +=
      `<rect x="${P(X(z.ep))}" y="${P(ey0 - 6)}" width="${P(X(z.en) - X(z.ep))}" height="${P(ey1 - ey0 + 6)}" style="fill:var(--accent)" fill-opacity="0.08"/>` +
      `<path d="M ${P(X(z.ep))} ${P(ey0 - 6)} V ${P(ey1)} M ${P(X(z.en))} ${P(ey0 - 6)} V ${P(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`;
    // E_c og E_v.
    let zc = "";
    let zv = "";
    for (let i = 0; i <= 40; i++) {
      const x = z.ep + ((z.en - z.ep) * i) / 40;
      zc += `L ${P(X(x))} ${P(yE(Ec(x)))} `;
      zv += `L ${P(X(x))} ${P(yE(Ev(x)))} `;
    }
    s +=
      `<path d="M ${P(bx0)} ${P(yE(Ec(0)))} ${zc} L ${P(bx1)} ${P(yE(Ec(1)))}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="M ${P(bx0)} ${P(yE(Ev(0)))} ${zv} L ${P(bx1)} ${P(yE(Ev(1)))}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    // Fermi-nivåene langt ute på hver side: qV fra hverandre.
    const efp = Ev(0) + DELTA;
    const efn = Ec(1) - DELTA;
    const split = Math.abs(V) > 0.005;
    s +=
      `<path d="M ${P(bx0)} ${P(yE(efp))} H ${P(X(0.3))}" style="stroke:${split ? "var(--red)" : "var(--accent)"}" stroke-width="1.4" stroke-dasharray="5 3"/>` +
      `<path d="M ${P(X(0.7))} ${P(yE(efn))} H ${P(bx1)}" style="stroke:${split ? "var(--indigo)" : "var(--accent)"}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    if (split) {
      s += tag(X(0.3) - 2, yE(efp) - 5, sub("F", "p"), "end", "var(--red)", halo) + tag(X(0.7) + 2, yE(efn) + 13, sub("F", "n"), "start", "var(--indigo)", halo);
      // qV mellom nivåene, ved høyre kant.
      const xk = bx1 + 12;
      const y0 = yE(efp);
      const y1 = yE(efn);
      if (Math.abs(y1 - y0) > 8)
        s +=
          `<path d="M ${P(X(0.7))} ${P(y0)} H ${P(xk + 4)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>` +
          `<path d="M ${P(xk)} ${P(y0)} V ${P(y1)} M ${P(xk - 3)} ${P(y0)} h 6 M ${P(xk - 3)} ${P(y1)} h 6" style="stroke:var(--fg)" stroke-width="1.1"/>` +
          tag(xk + 5, (y0 + y1) / 2 + 4, "qV", "start", "var(--fg)", ";font-style:italic" + halo);
    } else s += tag(X(0.3) - 2, yE(efp) - 5, sub("E", "F"), "end", "var(--accent)", halo) + tag(X(0.7) + 2, yE(efn) + 13, sub("E", "F"), "start", "var(--accent)", halo);
    // Absorpsjonspilene.
    for (const a of arrows) {
      const u = (clock - a.t) / ARROW_T;
      const x = X(a.x);
      const y0 = yE(Ev(a.x));
      const y1 = yE(Ec(a.x));
      s += `<path d="M ${P(x)} ${P(y0)} V ${P(y1 + 3)}" style="stroke:var(--yellow)" stroke-width="1.5" opacity="${(0.75 * (1 - u)).toFixed(2)}" marker-end="url(#pil-lys)"/>`;
    }
    // Bærerne.
    let dots = "";
    let rings = "";
    for (const c of carriers) {
      const E = energyOf(c);
      const x = X(c.x);
      const y = yE(E);
      const op = c.state === "fade" ? Math.max(0, 1 - c.age / FADE) : 1;
      const opa = op < 1 ? ` opacity="${op.toFixed(2)}"` : "";
      if (c.s < 0) dots += `<circle cx="${P(x)}" cy="${P(y)}" r="2.2"${opa}/>`;
      else rings += `<circle cx="${P(x)}" cy="${P(y)}" r="2.4"${opa}/>`;
    }
    let fl = "";
    for (const f of flashes) {
      const u = (clock - f.t) / FADE;
      const x = X(f.x);
      const y = yE(f.E);
      fl +=
        f.s > 0
          ? `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.4 + 2 * u)}" fill="none" style="stroke:var(--red)" opacity="${(0.7 * (1 - u)).toFixed(2)}"/>`
          : `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.2 + 2 * u)}" style="fill:var(--indigo)" opacity="${(0.6 * (1 - u)).toFixed(2)}"/>`;
    }
    s += `<g style="fill:var(--indigo)">${dots}</g><g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>${fl}`;
    // Merkene.
    s +=
      tag(bx1 + 4, yE(Ec(1)) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(bx1 + 4, yE(Ev(1)) + 4, sub("E", "v"), "start", "var(--fg)") +
      tag(bx0 + 2, ey0 + 2, "p", "start", "var(--fg)", ";font-size:12px") +
      tag(bx1 - 2, ey0 + 2, "n", "end", "var(--fg)", ";font-size:12px");
    // Klammene: L_n på p-siden, W over sonen, L_p på n-siden.
    const br = (x0, x1, label) => {
      const a = X(x0);
      const c = X(x1);
      return (
        `<path d="M ${P(a)} ${P(brY - 4)} v 8 M ${P(a)} ${P(brY)} H ${P(c)} M ${P(c)} ${P(brY - 4)} v 8" style="stroke:var(--muted)" stroke-width="1"/>` +
        tag((a + c) / 2, brY + 14, label, "middle", "var(--muted)", ";font-style:italic")
      );
    };
    s += br(Math.max(0, z.ep - L), z.ep, sub("L", "n")) + br(z.ep, z.en, "W") + br(z.en, Math.min(1, z.en + L), sub("L", "p"));
    // Fotostrømmen, fra n til p, inne i overgangen.
    if (light > 0) {
      const yA = brY + 26;
      const x0 = X(z.en + L * 0.9);
      const x1 = X(z.ep - L * 0.9);
      const sw = 1 + 2.5 * light;
      s +=
        `<path d="M ${P(x0)} ${P(yA)} H ${P(x1 + 6)}" style="stroke:var(--accent)" stroke-width="${sw.toFixed(1)}" marker-end="url(#pil-strom)"/>` +
        tag(X(z.en + L * 0.9) + 5, yA + 4, sub("I", "op"), "start", "var(--accent)", ";font-style:italic");
    }
    return s;
  }

  // ── I–V-diagrammet ──────────────────────────────────────────────────────
  const I_MIN = -0.05;
  const I_MAX = 0.03;
  const CV0 = -0.5;
  const CV1 = 0.7;
  let chartKey = "";
  let chartSvg = "";
  function chart() {
    const key = `${G.w}|${G.h}|${light}|${V}`;
    if (key === chartKey) return chartSvg;
    chartKey = key;
    const { cx0, cx1, cy0, cy1 } = G;
    const xv = (v) => cx0 + ((v - CV0) / (CV1 - CV0)) * (cx1 - cx0);
    const yi = (i) => cy0 + ((I_MAX - i) / (I_MAX - I_MIN)) * (cy1 - cy0);
    const clampY = (y) => Math.max(cy0 - 4, Math.min(cy1 + 4, y));
    let s = "";
    const x0 = xv(0);
    const y0 = yi(0);
    // Akser gjennom origo.
    s +=
      `<path d="M ${P(cx0)} ${P(y0)} H ${P(cx1)} M ${P(x0)} ${P(cy0)} V ${P(cy1)}" style="stroke:var(--border-strong)" stroke-width="1"/>` +
      tag(cx1, y0 - 5, "V", "end", "var(--fg)", ";font-style:italic") +
      tag(x0 + 5, cy0 + 8, "I", "start", "var(--fg)", ";font-style:italic") +
      tag(x0 + 18, cy0 + 8, "mA", "start");
    // Kvadrantnumrene.
    const qx = (cx1 - x0) * 0.5;
    s +=
      tag(x0 + qx + 30, cy0 + 12, "1", "middle", "var(--muted)") +
      tag((cx0 + x0) / 2, cy0 + 12, "2", "middle", "var(--muted)") +
      tag((cx0 + x0) / 2, cy1 - 4, "3", "middle", "var(--muted)") +
      tag(x0 + qx + 30, cy1 - 4, "4", "middle", "var(--muted)");
    // Enkle merker på aksene.
    for (const v of [-0.4, 0.4]) s += `<path d="M ${P(xv(v))} ${P(y0 - 3)} v 6" style="stroke:var(--muted)" stroke-width="1"/>` + tag(xv(v), y0 + 14, comma(v, 1), "middle");
    for (const i of [0.02, -0.02, -0.04]) if (light === 0 || Math.abs(i + iop()) > 0.006) s += `<path d="M ${P(x0 - 3)} ${P(yi(i))} h 6" style="stroke:var(--muted)" stroke-width="1"/>` + tag(x0 - 5, yi(i) + 4, String(Math.round(i * 1000)).replace("-", "−"), "end");
    // Kurvene.
    const curve = (f) => {
      let d = "";
      let pen = false;
      const N = 160;
      for (let k = 0; k <= N; k++) {
        const v = CV0 + ((CV1 - CV0) * k) / N;
        const i = f(v);
        const y = yi(i);
        if (y < cy0 - 2) {
          // Kurven går ut av toppen: stopp der.
          if (pen) {
            const vPrev = CV0 + ((CV1 - CV0) * (k - 1)) / N;
            // finn skjæringen med toppen
            let lo = vPrev;
            let hi = v;
            for (let j = 0; j < 30; j++) {
              const m = (lo + hi) / 2;
              if (yi(f(m)) < cy0 - 2) hi = m;
              else lo = m;
            }
            d += `L ${P(xv(lo))} ${P(cy0 - 2)} `;
          }
          break;
        }
        d += `${pen ? "L" : "M"} ${P(xv(v))} ${P(y)} `;
        pen = true;
      }
      return d;
    };
    // Effektrektangelet og V_oc × I_sc.
    const I = iLit(V);
    const yP = clampY(yi(I));
    const out = V > 0 && I < 0; // fjerde kvadrant
    if (light > 0) {
      const xo = xv(voc());
      const ys = yi(-iop());
      s += `<rect x="${P(x0)}" y="${P(y0)}" width="${P(xo - x0)}" height="${P(ys - y0)}" fill="none" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>`;
    }
    const rx = Math.min(x0, xv(V));
    const ry = Math.min(y0, yP);
    const rw = Math.abs(xv(V) - x0);
    const rh = Math.abs(yP - y0);
    if (rw > 0.5 && rh > 0.5)
      s += `<rect x="${P(rx)}" y="${P(ry)}" width="${P(rw)}" height="${P(rh)}" style="fill:${out ? "var(--green)" : "var(--muted)"};stroke:${out ? "var(--green)" : "var(--muted)"}" fill-opacity="${out ? 0.28 : 0.16}" stroke-width="1"/>`;
    s += `<path d="${curve(iDark)}" fill="none" style="stroke:var(--muted)" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    if (light > 0) s += `<path d="${curve(iLit)}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>`;
    // V_oc og I_sc.
    if (light > 0) {
      const xo = xv(voc());
      const ys = yi(-iop());
      s +=
        `<circle cx="${P(xo)}" cy="${P(y0)}" r="2.5" style="fill:var(--accent)"/>` +
        tag(xo - 5, y0 - 6, sub("V", "oc"), "end", "var(--accent)", ";font-style:italic" + halo) +
        `<circle cx="${P(x0)}" cy="${P(ys)}" r="2.5" style="fill:var(--accent)"/>` +
        tag(x0 - 5, ys + 4, sub("I", "sc"), "end", "var(--accent)", ";font-style:italic" + halo);
    }
    // Arbeidspunktet og effekten.
    const xP = xv(V);
    const offTop = yi(I) < cy0 - 4;
    s += offTop
      ? `<path d="M ${P(xP)} ${P(cy0 + 8)} V ${P(cy0 - 2)}" style="stroke:var(--fg)" stroke-width="1.6" marker-end="url(#pil-opp)"/>`
      : `<circle cx="${P(xP)}" cy="${P(yP)}" r="4.5" style="fill:var(--fg);stroke:var(--canvas-bg)" stroke-width="1.5"/>`;
    const pmW = Math.abs(V * I) * 1000;
    if (rw > 26 && rh > 16 && !offTop) {
      const txt = `${out ? "leverer" : "tar imot"} ${comma(pmW, 1)} mW`;
      const tx = (x0 + xv(V)) / 2;
      const ty = (y0 + yP) / 2 + 4;
      s += tag(tx, ty, txt, "middle", out ? "var(--fg)" : "var(--muted)", halo);
    }
    chartSvg = s;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `<defs>` +
      `<marker id="pil-lys" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--yellow)"/></marker>` +
      `<marker id="pil-strom" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--accent)"/></marker>` +
      `<marker id="pil-opp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--fg)"/></marker>` +
      `</defs>${bands()}${chart()}</svg>`;
  }
  function still() {
    // Uten bevegelse: et øyeblikksbilde med bærerne der de typisk står.
    carriers = [];
    arrows = [];
    flashes = [];
    for (let k = 0; k < 120; k++) advance(1 / 30);
    render();
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
  if (reduce.matches) still();
  else {
    for (let k = 0; k < 90; k++) advance(1 / 30); // start med en jevn tilstand
    start();
  }
}
