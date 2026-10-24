/**
 * «Overgangen dannes» for TFE4146, pn-overgangen i likevekt.
 *
 * Én idé: når en p-bit og en n-bit settes sammen, vandrer hullene over til
 * n-siden og elektronene over til p-siden, og der de møtes, rekombinerer de.
 * Ionene de etterlater, står igjen uten bærer rundt skillet, og ladningen
 * deres gir et felt som driver bærerne tilbake. Sonen vokser til driften
 * holder diffusjonen igjen, og da ligger Fermi-nivåene på de to sidene på
 * linje (Streetman & Banerjee §5.2, fig. 5–11).
 *
 * Modellen er ekte, i én dimensjon: hver bærer tar tilfeldige steg (D) og
 * driver i feltet (µ = D i enheter der k_BT/q = 1), feltet regnes fra all
 * ladningen med Gauss' lov i hvert tidssteg, et elektron og et hull i samme
 * celle rekombinerer med raten k_r·n·p, og par genereres med raten k_r·n_i²,
 * så likevekten har n·p = n_i² og barrieren V₀ = ln(N_aN_d/n_i²) k_BT/q.
 * Barrieren er rundt 5 k_BT (rundt 30 i silisium); med en høyere barriere ville
 * de siste bærerne bruke minutter på å komme over. Fysikken regner med fire
 * ganger så mange bærere som det tegnes, hver med en firedel av ladningen, så
 * feltet ikke skjelver.
 *
 * Øverst står feltpilene, i staven ionene (− akseptorer, + donorer, oransje,
 * sterke der ingen bærer dekker dem), hullene som røde ringer og elektronene
 * som blå prikker. Under står båndskjemaet på samme x-akse: E_c og E_v fra
 * potensialet og Fermi-nivået i hver bit fra konsentrasjonen der.
 * Før kontakt ligger båndene i samme høyde og Fermi-nivåene ikke.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */
import { choiceRow } from "./_controls.js";

const NB = 100; // celler langs staven
const DX = 1 / NB;
const DT = 0.004; // s per fysikksteg
const DIFF = 0.011; // staver²/s
const KR = 0.9; // rekombinasjonskoeffisient
const NI2 = 172.5; // n_i², gir V₀ = 5 k_BT ved lik doping
const EPS = 0.72; // gir W = 0,3 av staven ved lik doping
const W8 = 0.25; // ladningen til hver bærer i fysikken
const DRAW_EVERY = 4; // hver fjerde bærer tegnes
const EG = 12; // båndgapet i modellen, i k_BT
const DOPING = {
  lik: { na: 160, nd: 160 },
  ppn: { na: 360, nd: 120 },
};
const NCV = 160 * Math.exp(3.5); // N_c = N_v, så E_F står 3,5 k_BT fra båndet ved lik doping
const SMOOTH = 0.3; // s, glatting av det som tegnes
const JOIN_TIME = 0.5; // s, bitene skyves sammen
const FADE = 0.35; // s, et par som rekombinerer, blekner
const YOUNG = 0.12; // s, nylig genererte bærere tegnes ikke ennå

export default function init({ stage, controls, getSize, onResize, signal }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let doping = "lik";
  let phase = "apart"; // apart | joining | joined
  let tJoin = 0; // tid siden bitene møttes
  let settled = false; // Fermi-nivåene har kommet på linje; støyen i modellen skal ikke skille dem igjen
  let joinU = 0; // 0 … 1 mens gapet lukkes
  let carriers = []; // { x, y, s (+1 hull, −1 elektron), draw, age, vy }
  let fading = []; // { x, y, s, t }
  const E = new Float64Array(NB + 1);
  const rho = new Float64Array(NB);
  const dop = new Float64Array(NB);
  const Es = new Float64Array(NB + 1); // glattet felt
  const Vs = new Float64Array(NB + 1); // glattet potensial, V(1) = 0
  const dh = new Float64Array(NB); // glattet hulltetthet per celle (i enheter av N)
  const de = new Float64Array(NB);
  let clock = 0;

  const D = () => DOPING[doping];
  const V0th = () => Math.log((D().na * D().nd) / NI2);

  // ── kontroller ──────────────────────────────────────────────────────────
  const join = document.createElement("button");
  join.type = "button";
  join.className = "sim-btn";
  join.addEventListener("click", () => (phase === "apart" ? startJoin() : reset()), { signal });
  const dopPick = choiceRow({
    ariaLabel: "Doping",
    label: "Doping",
    items: [
      { value: "lik", label: "Lik doping" },
      { value: "ppn", label: "p sterkere dopet" },
    ],
    onPick: (k) => {
      doping = k;
      reset();
    },
    signal,
  });
  controls.append(join, dopPick.el);
  function sync() {
    join.textContent = phase === "apart" ? "Sett sammen" : "Skill bitene";
    dopPick.sync(doping);
  }

  // ── modellen ────────────────────────────────────────────────────────────
  const rnd = Math.random;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const newCarrier = (x, s, draw) => ({ x, px: x, s, draw, age: 1, y: rnd(), vy: 0 });

  function reset() {
    phase = "apart";
    settled = false;
    tJoin = 0;
    joinU = 0;
    carriers = [];
    fading = [];
    const { na, nd } = D();
    const nh = Math.round((na * 0.5) / W8);
    const ne = Math.round((nd * 0.5) / W8);
    for (let i = 0; i < nh; i++) carriers.push(newCarrier(((i + rnd()) / nh) * 0.5, 1, i % DRAW_EVERY === 0));
    for (let i = 0; i < ne; i++) carriers.push(newCarrier(0.5 + ((i + rnd()) / ne) * 0.5, -1, i % DRAW_EVERY === 0));
    for (let b = 0; b < NB; b++) dop[b] = (b + 0.5) * DX < 0.5 ? -na * DX : nd * DX;
    E.fill(0);
    Es.fill(0);
    Vs.fill(0);
    for (let b = 0; b < NB; b++) {
      dh[b] = (b + 0.5) * DX < 0.5 ? 1 : 0;
      de[b] = (b + 0.5) * DX < 0.5 ? 0 : 1;
    }
    sync();
    if (reduce.matches) still();
    else start();
  }

  function startJoin() {
    phase = "joining";
    settled = false;
    joinU = 0;
    sync();
    if (reduce.matches) {
      phase = "joined";
      still();
    } else start();
  }

  const Eat = (x) => {
    const u = x / DX;
    const b = Math.floor(u);
    if (b < 0 || b >= NB) return 0;
    const f = u - b;
    return E[b] * (1 - f) + E[b + 1] * f;
  };

  const binsH = Array.from({ length: NB }, () => []);
  const binsE = Array.from({ length: NB }, () => []);

  /** Ett fysikksteg. Før kontakt holder en vegg ved x = 0,5 hver bit for seg, uten felt. */
  function physics(dt) {
    const apart = phase !== "joined";
    if (!apart) {
      rho.set(dop);
      for (const c of carriers) {
        const u = c.x / DX - 0.5;
        const b = Math.floor(u);
        const f = u - b;
        const q = c.s * W8;
        if (b < 0) rho[0] += q;
        else if (b >= NB - 1) rho[NB - 1] += q;
        else {
          rho[b] += q * (1 - f);
          rho[b + 1] += q * f;
        }
      }
      E[0] = 0;
      for (let b = 0; b < NB; b++) E[b + 1] = E[b] + rho[b] / EPS;
    } else E.fill(0);
    const sd = Math.sqrt(2 * DIFF * dt);
    for (const c of carriers) {
      let x = c.x + c.s * DIFF * Eat(c.x) * dt + sd * gauss();
      const lo = apart && c.s < 0 ? 0.5 : 0;
      const hi = apart && c.s > 0 ? 0.5 : 1;
      if (x < lo) x = 2 * lo - x;
      if (x > hi) x = 2 * hi - x;
      c.x = x;
      c.age += dt;
      c.vy += (gauss() * 0.9 - c.vy * 0.5) * dt * 4;
      c.y += c.vy * dt;
      if (c.y < 0.03) (c.y = 0.06 - c.y), (c.vy = Math.abs(c.vy));
      if (c.y > 0.97) (c.y = 1.94 - c.y), (c.vy = -Math.abs(c.vy));
    }
    if (apart) return;
    // Rekombinasjon og generasjon, celle for celle.
    for (let b = 0; b < NB; b++) {
      binsH[b].length = 0;
      binsE[b].length = 0;
    }
    carriers.forEach((c, i) => {
      const b = Math.min(NB - 1, Math.max(0, Math.floor(c.x / DX)));
      (c.s > 0 ? binsH : binsE)[b].push(i);
    });
    const dead = new Set();
    const born = [];
    for (let b = 0; b < NB; b++) {
      const h = binsH[b];
      const e = binsE[b];
      if (h.length && e.length) {
        const lam = ((KR * W8 * h.length * e.length) / DX) * dt;
        let k = Math.floor(lam) + (rnd() < lam - Math.floor(lam) ? 1 : 0);
        k = Math.min(k, h.length, e.length);
        for (let j = 0; j < k; j++) {
          const ih = h.splice(Math.floor(rnd() * h.length), 1)[0];
          const ie = e.splice(Math.floor(rnd() * e.length), 1)[0];
          dead.add(ih);
          dead.add(ie);
          // Bærerne er like, så en tegnet bærer som rekombinerer der det står andre av samme
          // slag, lever videre i en av dem; bare der ingen står igjen, blekner den.
          for (const [i, list] of [[ih, h], [ie, e]]) {
            const c = carriers[i];
            if (!c.draw) continue;
            const heir = list.find((m) => !carriers[m].draw && !dead.has(m));
            if (heir === undefined) continue;
            const hc = carriers[heir];
            hc.draw = true;
            hc.y = c.y;
            hc.vy = c.vy;
            hc.age = Math.max(hc.age, c.age);
            hc.px = c.px;
            c.draw = false;
          }
        }
      }
      if (rnd() < (KR * NI2 * DX * dt) / W8) {
        const x = (b + rnd()) * DX;
        // Et nytt par tegnes bare der bæreren er sjelden; i en tett sky ville det bare
        // blinke inn og ut.
        const draw = rnd() < 1 / DRAW_EVERY;
        const y = rnd();
        const { na: a, nd: d } = D();
        const nloc = (b + 0.5) * DX < 0.5 ? a : d;
        const sparseH = (h.length * W8) / DX < 0.3 * nloc;
        const sparseE = (e.length * W8) / DX < 0.3 * nloc;
        born.push({ ...newCarrier(x, 1, draw && sparseH), age: 0, y }, { ...newCarrier(x, -1, draw && sparseE), age: 0, y });
      }
    }
    if (dead.size) {
      const keep = [];
      carriers.forEach((c, i) => {
        if (!dead.has(i)) keep.push(c);
        else if (c.draw && c.age > YOUNG) fading.push({ x: c.px, y: c.y, s: c.s, t: clock });
      });
      carriers = keep;
    }
    if (born.length) carriers.push(...born);
  }

  /** Glatter feltet, potensialet og tettheten som tegnes. */
  function smooth(dt) {
    const k = Math.min(1, dt / SMOOTH);
    // Tegnet plass følger den fysiske med litt glatting, så prikkene vandrer i stedet for å skjelve.
    const kp = Math.min(1, dt / 0.08);
    for (const c of carriers) c.px += (c.x - c.px) * kp;
    const { na, nd } = D();
    const ch = new Float64Array(NB);
    const ce = new Float64Array(NB);
    for (const c of carriers) {
      const b = Math.min(NB - 1, Math.max(0, Math.floor(c.x / DX)));
      if (c.s > 0) ch[b] += W8;
      else ce[b] += W8;
    }
    let v = 0;
    const Vn = new Float64Array(NB + 1);
    for (let b = 0; b < NB; b++) {
      v -= 0.5 * (E[b] + E[b + 1]) * DX;
      Vn[b + 1] = v;
    }
    for (let b = 0; b <= NB; b++) {
      Es[b] += (E[b] - Es[b]) * k;
      Vs[b] += (Vn[b] - Vn[NB] - Vs[b]) * Math.min(1, dt / 0.5);
    }
    for (let b = 0; b < NB; b++) {
      const xc = (b + 0.5) * DX;
      const nloc = xc < 0.5 ? na : nd;
      const lo = Math.max(0, b - 1);
      const hi = Math.min(NB - 1, b + 1);
      let sh = 0;
      let se = 0;
      for (let j = lo; j <= hi; j++) (sh += ch[j]), (se += ce[j]);
      sh /= hi - lo + 1;
      se /= hi - lo + 1;
      dh[b] += (sh / DX / nloc - dh[b]) * k * 0.5;
      de[b] += (se / DX / nloc - de[b]) * k * 0.5;
    }
  }

  function advance(dt) {
    clock += dt;
    if (phase === "joining") {
      joinU = Math.min(1, joinU + dt / JOIN_TIME);
      if (joinU >= 1) {
        phase = "joined";
        tJoin = 0;
        sync();
      }
    } else if (phase === "joined") tJoin += dt;
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(DT, left);
      physics(h);
      left -= h;
    }
    smooth(dt);
    fading = fading.filter((f) => clock - f.t < FADE);
  }

  /** Uten bevegelse: kjør modellen fram til likevekt og tegn ett bilde. */
  function still() {
    if (phase === "joined") {
      for (let t = 0; t < 9; t += 0.02) advance(0.02);
      fading = [];
    }
    render();
  }

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (w < 200 || h < 300) return null;
    const bx0 = 14;
    const bx1 = w - 14;
    const arrowY = 15;
    const by0 = 32;
    const by1 = by0 + 104;
    const ey0 = by1 + 40; // båndskjemaets topp
    const ey1 = h - 14; // bunn
    const kT = (ey1 - ey0) / (EG + 6.6); // px per k_BT
    const ecn = ey0 + kT * 6.0; // E_c på n-siden
    return { w, h, bx0, bx1, len: bx1 - bx0, arrowY, by0, by1, ey0, ey1, kT, ecn };
  }
  const gapPx = () => (phase === "apart" ? 12 : phase === "joining" ? 12 * (1 - joinU) : 0);
  /** Skjerm-x for modell-x, med gapet mellom bitene før kontakt. */
  const X = (x) => {
    const g = gapPx();
    const half = (G.len - g) / 2;
    return x < 0.5 ? G.bx0 + (x / 0.5) * half : G.bx0 + half + g + ((x - 0.5) / 0.5) * half;
  };

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";

  /** Ionene i et fast gitter; tettheten følger dopingen. */
  function ions() {
    const { na, nd } = D();
    const rows = 8;
    const list = [];
    const per = (n) => Math.round((n * 0.5) / rows / (W8 * DRAW_EVERY)); // kolonner per bit
    const cp = per(na);
    const cn = per(nd);
    // Annenhver rad forskjøvet en halv kolonne, så ionene ikke danner streker.
    for (let i = 0; i < cp; i++) for (let r = 0; r < rows; r++) list.push({ x: ((i + 0.25 + 0.5 * (r % 2)) / cp) * 0.5, r, s: -1 });
    for (let i = 0; i < cn; i++) for (let r = 0; r < rows; r++) list.push({ x: 0.5 + ((i + 0.25 + 0.5 * (r % 2)) / cn) * 0.5, r, s: 1 });
    return { list, rows };
  }

  /** Kantene av sonen: der bærertettheten har falt under halvparten av dopingen. */
  function zoneEdges() {
    if (phase !== "joined") return null;
    let l = NB / 2 - 1;
    while (l > 0 && dh[l] < 0.5) l--;
    let r = NB / 2;
    while (r < NB - 1 && de[r] < 0.5) r++;
    const xl = (l + 1) * DX;
    const xr = r * DX;
    if (xr - xl < 0.04) return null;
    return { xl, xr };
  }

  function draw() {
    const { bx0, bx1, by0, by1, arrowY, ey0, ey1, kT, ecn, w } = G;
    const { na, nd } = D();
    let s = "";
    const zone = zoneEdges();

    // Sonen, tonet i staven og i båndskjemaet.
    if (zone) {
      const x0 = X(zone.xl);
      const x1 = X(zone.xr);
      s +=
        `<rect x="${P(x0)}" y="${P(by0)}" width="${P(x1 - x0)}" height="${P(by1 - by0)}" style="fill:var(--accent)" fill-opacity="0.10"/>` +
        `<rect x="${P(x0)}" y="${P(ey0 - 6)}" width="${P(x1 - x0)}" height="${P(ey1 - ey0 + 6)}" style="fill:var(--accent)" fill-opacity="0.07"/>` +
        `<path d="M ${P(x0)} ${P(by0)} V ${P(ey1)} M ${P(x1)} ${P(by0)} V ${P(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`;
      if (x1 - x0 > 22) {
        const yb = by1 + 12;
        s +=
          `<path d="M ${P(x0)} ${P(yb - 4)} v 8 M ${P(x0)} ${P(yb)} H ${P(x1)} M ${P(x1)} ${P(yb - 4)} v 8" style="stroke:var(--fg)" stroke-width="1"/>` +
          tag((x0 + x1) / 2, yb + 13, "W", "middle", "var(--fg)", ";font-style:italic" + halo);
      }
    }

    // Bitene.
    const g = gapPx();
    const halfLen = (G.len - g) / 2;
    s +=
      `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(halfLen)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<rect x="${P(bx0 + halfLen + g)}" y="${P(by0)}" width="${P(halfLen)}" height="${P(by1 - by0)}" rx="3" fill="none" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(bx0 + 2, by1 + 25, "p", "start", "var(--fg)") +
      tag(bx1 - 2, by1 + 25, "n", "end", "var(--fg)");

    // Ionene: svake der en bærer dekker dem, sterke der sonen har avdekket dem.
    const { list, rows } = ions();
    const rowY = (r) => by0 + ((r + 0.5) / rows) * (by1 - by0);
    let faint = "";
    let strong = "";
    for (const ion of list) {
      const b = Math.min(NB - 1, Math.floor(ion.x / DX));
      const cov = ion.s < 0 ? dh[b] : de[b];
      const u = phase === "joined" ? Math.max(0, Math.min(1, 1 - cov)) : 0;
      const x = X(ion.x);
      const y = rowY(ion.r) + (ion.r % 2 ? 0 : 0);
      const glyph = `M ${P(x - 2.2)} ${P(y)} h 4.4${ion.s > 0 ? ` M ${P(x)} ${P(y - 2.2)} v 4.4` : ""} `;
      if (u > 0.35) strong += glyph;
      else faint += glyph;
    }
    s +=
      `<path d="${faint}" style="stroke:var(--orange)" stroke-width="1.3" opacity="0.35"/>` +
      `<path d="${strong}" style="stroke:var(--orange)" stroke-width="1.7"/>`;

    // Bærerne.
    const ybar = (c) => by0 + 4 + c.y * (by1 - by0 - 8);
    let rings = "";
    let dots = "";
    for (const c of carriers) {
      if (!c.draw || c.age < YOUNG) continue;
      const x = X(c.x);
      if (c.s > 0) rings += `<circle cx="${P(X(c.px))}" cy="${P(ybar(c))}" r="2.3"/>`;
      else dots += `<circle cx="${P(X(c.px))}" cy="${P(ybar(c))}" r="2.1"/>`;
    }
    let fade = "";
    for (const f of fading) {
      const u = (clock - f.t) / FADE;
      const x = X(f.x);
      const y = by0 + 4 + f.y * (by1 - by0 - 8);
      fade +=
        f.s > 0
          ? `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.3 + 2 * u)}" fill="none" style="stroke:var(--red)" opacity="${(1 - u).toFixed(2)}"/>`
          : `<circle cx="${P(x)}" cy="${P(y)}" r="${P(2.1 + 2 * u)}" style="fill:var(--indigo)" opacity="${(1 - u).toFixed(2)}"/>`;
    }
    s +=
      `<g fill="none" style="stroke:var(--red)" stroke-width="1.3">${rings}</g>` +
      `<g style="fill:var(--indigo)">${dots}</g>${fade}`;

    // Feltet over staven som et bånd: tykkelsen følger |ℰ|, pilspissene viser retningen (mot p).
    const eRef = (DOPING.lik.na * 0.15) / EPS; // samme skala for begge dopingene
    const Mr = 160;
    const hOf = (xm) => {
      if (phase !== "joined") return 0;
      const u = xm / DX;
      const b = Math.min(NB - 1, Math.floor(u));
      const e = Es[b] * (1 - (u - b)) + Es[b + 1] * (u - b);
      const hh = Math.min(11, (Math.abs(e) / eRef) * 9);
      return hh < 0.8 ? 0 : hh;
    };
    let top = "";
    let bot = "";
    for (let i = 0; i <= Mr; i++) {
      const xm = i / Mr;
      const hh = hOf(xm);
      top += `${i ? "L" : "M"} ${P(X(xm))} ${P(arrowY - hh)} `;
      bot = `L ${P(X(xm))} ${P(arrowY + hh)} ` + bot;
    }
    s += `<path d="${top}${bot}Z" style="fill:var(--fg)" fill-opacity="0.22"/>`;
    const step = 20;
    for (let xs = G.bx0 + step / 2; xs < G.bx1; xs += step) {
      // modell-x for skjerm-x (gapet er null når feltet finnes)
      const xm = (xs - G.bx0) / G.len;
      const hh = hOf(xm);
      if (hh < 2.5) continue;
      const a = Math.min(6, 2 + hh * 0.45);
      s += `<path d="M ${P(xs + a * 0.6)} ${P(arrowY - a)} L ${P(xs - a * 0.6)} ${P(arrowY)} L ${P(xs + a * 0.6)} ${P(arrowY + a)}" fill="none" style="stroke:var(--fg)" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    s += tag(bx0, arrowY + 4, "ℰ", "start", "var(--fg)", ";font-style:italic");

    // Båndskjemaet: E_c og E_v fra potensialet, E_F i hver bit fra konsentrasjonen.
    const yE = (e) => ecn - e * kT; // e i k_BT, målt opp fra E_c på n-siden
    const pot = (x) => {
      if (phase !== "joined") return 0;
      const u = x / DX;
      const b = Math.min(NB - 1, Math.floor(u));
      return Vs[b] * (1 - (u - b)) + Vs[b + 1] * (u - b);
    };
    const M = 120;
    let pc = "";
    let pv = "";
    const seg = (x0, x1) => {
      let c = "";
      let v = "";
      for (let i = 0; i <= M; i++) {
        const x = x0 + ((x1 - x0) * i) / M;
        const e = -pot(x); // elektronenergien er −q𝒱
        c += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(e))} `;
        v += `${i ? "L" : "M"} ${P(X(x))} ${P(yE(e - EG))} `;
      }
      return [c, v];
    };
    if (phase === "joined") [pc, pv] = seg(0, 1);
    else {
      const [c1, v1] = seg(0, 0.4999);
      const [c2, v2] = seg(0.5001, 1);
      pc = c1 + c2;
      pv = v1 + v2;
    }
    s +=
      `<path d="${pc}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>` +
      `<path d="${pv}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    // Fermi-nivåene, fra konsentrasjonen langt inne i hver bit.
    const bulk = (arr, lo, hi) => {
      let sum = 0;
      for (let b = lo; b < hi; b++) sum += arr[b];
      return Math.max(0.05, sum / (hi - lo));
    };
    const pBulk = bulk(dh, 2, 25) * na;
    const nBulk = bulk(de, 75, 98) * nd;
    let efp = -pot(0.1) - EG + Math.log(NCV / pBulk);
    let efn = -pot(0.9) - Math.log(NCV / nBulk);
    if (phase === "joined" && Math.abs(efn - efp) < 0.7 && tJoin > 2.5) settled = true;
    if (settled && phase === "joined") efp = efn = (efp + efn) / 2;
    const efLine = (x0, x1, e) =>
      `<path d="M ${P(X(x0))} ${P(yE(e))} H ${P(X(x1))}" style="stroke:var(--accent)" stroke-width="1.5" stroke-dasharray="5 3"/>`;
    s += efLine(0, phase === "joined" ? 0.5 : 0.4999, efp) + efLine(phase === "joined" ? 0.5 : 0.5001, 1, efn);
    // Merkene.
    s +=
      tag(bx1, yE(0) - 8, sub("E", "c"), "end", "var(--fg)", halo) +
      tag(bx1, yE(-EG) - 8, sub("E", "v"), "end", "var(--fg)", halo) +
      tag(bx1, yE(efn) - 8, sub("E", "F"), "end", "var(--accent)", halo) +
      tag(bx0, yE(efp) - 8, sub("E", "F"), "start", "var(--accent)", halo);
    if (settled && phase === "joined") {
      // qV₀: E_c på p-siden forlenget, klamme mot E_c på n-siden.
      const ecp = -pot(0.05);
      const xk = bx1 - 34;
      s +=
        `<path d="M ${P(X(0.5))} ${P(yE(ecp))} H ${P(xk + 6)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>` +
        `<path d="M ${P(xk - 4)} ${P(yE(ecp))} h 8 M ${P(xk)} ${P(yE(ecp))} V ${P(yE(0))} M ${P(xk - 4)} ${P(yE(0))} h 8" style="stroke:var(--fg)" stroke-width="1.2"/>` +
        tag(xk - 7, (yE(ecp) + yE(0)) / 2 + 4, `q${sub("V", "0")}`, "end", "var(--fg)", halo);
    }
    void w;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${draw()}</svg>`;
  }

  // ── bevegelse ───────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = false;
  function frame(now) {
    raf = 0;
    if (signal.aborted || !visible || reduce.matches) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    advance(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() {
    render();
    if (raf || !visible || reduce.matches) return;
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
