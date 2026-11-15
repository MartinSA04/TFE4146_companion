/**
 * «Båndgapet og sollyset» for TFE4146, fotodioder, lysdioder og lasere.
 *
 * Én idé: en solcelle med ett båndgap kan ikke bruke hele sollyset. Fotoner
 * under E_g går gjennom. Et foton over E_g lager ett par, og elektronet og
 * hullet faller ned til båndkantene, så bare E_g av energien blir igjen; resten
 * blir varme. Et lite båndgap taper mye til varme, et stort taper mye ved at
 * lyset går gjennom, og andelen som kan brukes, er størst rundt 1,1 eV.
 * Streetman & Banerjee §8.1.2; forelesningens figur «Efficiency / Losses».
 *
 * Sollyset er tilnærmet som stråling fra et svart legeme på 5800 K, effekt per
 * fotonenergi P(E) ∝ E³/(e^{E/k_BT} − 1). Over E_g deles hver stripe i
 * E_g·N(E) (kan brukes) og (E − E_g)·N(E) (varme), der N(E) = P(E)/E er antall
 * fotoner. Andelene er integraler over hele spekteret. Største andel som kan
 * brukes: 44 % ved 1,08 eV. Det synlige båndet er tegnet i sine egne farger
 * under aksen (det ene unntaket fra fargetokenene).
 *
 * Linjen for E_g kan dras i diagrammet, eller settes med glideren.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const KT = 8.617e-5 * 5800; // eV
const E_MAX = 4;
const EG_MIN = 0.5;
const EG_MAX = 2.5;
const MATERIALS = [
  { name: "Si", e: 1.11 },
  { name: "GaAs", e: 1.43 },
];

const P = (E) => (E <= 0 ? 0 : E ** 3 / Math.expm1(E / KT));
const Nf = (E) => (E <= 0 ? 0 : E ** 2 / Math.expm1(E / KT));
function integ(f, a, b, n = 1200) {
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h) * h;
  return s;
}
const TOTAL = integ(P, 1e-6, 14, 6000);
const P_PEAK = (() => {
  let m = 0;
  for (let E = 0.01; E < E_MAX; E += 0.005) m = Math.max(m, P(E));
  return m;
})();

// Farge for en bølgelengde i nm, 380–750 (vanlig stykkevis tilnærming).
function rgbOf(nm) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, (510 - nm) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, (645 - nm) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  let k = 1;
  if (nm < 420) k = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) k = 0.3 + (0.7 * (750 - nm)) / 50;
  const c = (v) => Math.round(255 * Math.pow(Math.max(0, v * k), 0.8));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  let Eg = 1.11;

  const label = document.createElement("label");
  label.append("Båndgap ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(EG_MIN);
  input.max = String(EG_MAX);
  input.step = "0.01";
  input.value = String(Eg);
  input.setAttribute("aria-label", "Båndgapet i elektronvolt");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      Eg = Number(input.value);
      update();
    },
    { signal },
  );
  controls.append(label);
  const comma = (x, d) => x.toFixed(d).replace(".", ",");

  function shares() {
    const below = integ(P, 1e-6, Eg) / TOTAL;
    const use = (Eg * integ(Nf, Eg, 14)) / TOTAL;
    return { below, use, heat: Math.max(0, 1 - below - use) };
  }

  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (!w || !h) return null;
    const x0 = 12;
    const x1 = w - 14;
    const top = 58;
    const base = h - 62; // energiaksen
    return { w, h, x0, x1, top, base };
  }
  const xE = (E) => G.x0 + (E / E_MAX) * (G.x1 - G.x0);
  const Ex = (x) => ((x - G.x0) / (G.x1 - G.x0)) * E_MAX;
  const yP = (p) => G.base - (p / P_PEAK) * (G.base - G.top);

  const Pn = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${Pn(x)}" y="${Pn(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function render() {
    G = layout();
    if (!G) return;
    const { w, h, x0, x1, base, top } = G;
    const sh = shares();
    let s = "";
    // Flatene.
    const N = 240;
    const pts = (f, a, b) => {
      let d = "";
      for (let i = 0; i <= N; i++) {
        const E = a + ((b - a) * i) / N;
        d += `L ${Pn(xE(E))} ${Pn(yP(f(E)))} `;
      }
      return d;
    };
    s += `<path d="M ${Pn(xE(0))} ${Pn(base)} ${pts(P, 0.001, Eg)} L ${Pn(xE(Eg))} ${Pn(base)} Z" style="fill:var(--muted)" fill-opacity="0.22"/>`;
    s += `<path d="M ${Pn(xE(Eg))} ${Pn(base)} ${pts((E) => Eg * Nf(E), Eg, E_MAX)} L ${Pn(xE(E_MAX))} ${Pn(base)} Z" style="fill:var(--green)" fill-opacity="0.34"/>`;
    // Varmen: mellom E_g·N(E) og P(E).
    let heat = `M ${Pn(xE(Eg))} ${Pn(yP(Eg * Nf(Eg)))} ${pts(P, Eg, E_MAX)}`;
    for (let i = N; i >= 0; i--) {
      const E = Eg + ((E_MAX - Eg) * i) / N;
      heat += `L ${Pn(xE(E))} ${Pn(yP(Eg * Nf(E)))} `;
    }
    s += `<path d="${heat} Z" style="fill:var(--orange)" fill-opacity="0.32"/>`;
    // Spekteret.
    s += `<path d="M ${Pn(xE(0))} ${Pn(base)} ${pts(P, 0.001, E_MAX)}" fill="none" style="stroke:var(--fg)" stroke-width="1.5"/>`;
    // Aksen og det synlige båndet.
    s += `<path d="M ${Pn(x0)} ${Pn(base)} H ${Pn(x1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    const sy = base + 4;
    const sH = 8;
    let strip = "";
    for (let nm = 380; nm < 750; nm += 5) {
      const ea = 1240 / nm;
      const eb = 1240 / (nm + 5);
      strip += `<rect x="${Pn(xE(eb))}" y="${Pn(sy)}" width="${Pn(xE(ea) - xE(eb) + 0.4)}" height="${sH}" fill="${rgbOf(nm + 2.5)}"/>`;
    }
    s += strip;
    for (let E = 0; E <= E_MAX; E += 1) {
      s += `<path d="M ${Pn(xE(E))} ${Pn(base)} v ${E === 0 ? 0 : 4}" style="stroke:var(--muted)" stroke-width="1"/>`;
      s += tag(xE(E), base + 26, E === E_MAX ? `${E} eV` : String(E), E === 0 ? "start" : E === E_MAX ? "end" : "middle");
    }
    s += tag(x1, base + 46, "fotonenergi", "end");
    s += tag(xE(2.45) + 4, yP(P(2.45)) - 6, "sollys", "start", "var(--muted)", halo);
    // Materialene.
    for (const m of MATERIALS) {
      const x = xE(m.e);
      const left = m.name === "Si";
      s += `<path d="M ${Pn(x)} ${Pn(base + 32)} v 8" style="stroke:var(--muted)" stroke-width="1"/>` + tag(x + (left ? -3 : 3), base + 46, m.name, left ? "end" : "start");
    }
    // Linjen for E_g med håndtak.
    const xg = xE(Eg);
    s +=
      `<path d="M ${Pn(xg)} ${Pn(top - 14)} V ${Pn(base)}" style="stroke:var(--accent)" stroke-width="2"/>` +
      `<circle cx="${Pn(xg)}" cy="${Pn(top - 14)}" r="6" style="fill:var(--accent);stroke:var(--canvas-bg)" stroke-width="2"/>` +
      tag(xg + (xg > w * 0.6 ? -10 : 10), top - 10, `${sub("E", "g")} = ${comma(Eg, 2)} eV`, xg > w * 0.6 ? "end" : "start", "var(--accent)", halo);
    // Andelene øverst, med fargeprøver.
    const items = [
      { c: "var(--muted)", o: 0.4, t: `går gjennom ${Math.round(sh.below * 100)} %` },
      { c: "var(--orange)", o: 0.5, t: `varme ${Math.round(sh.heat * 100)} %` },
      { c: "var(--green)", o: 0.5, t: `kan brukes ${Math.round(sh.use * 100)} %` },
    ];
    const narrow = w < 430;
    let lx = x0;
    let ly = 14;
    for (const it of items) {
      const wTxt = it.t.length * 6.7 + 18;
      if (lx + wTxt > x1 && lx > x0) {
        lx = x0;
        ly += 16;
      }
      s += `<rect x="${Pn(lx)}" y="${Pn(ly - 9)}" width="10" height="10" rx="2" style="fill:${it.c}" fill-opacity="${it.o}"/>` + tag(lx + 14, ly, it.t, "start", "var(--fg)");
      lx += wTxt + (narrow ? 6 : 14);
    }
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block;touch-action:pan-y">${s}</svg>`;
  }
  function update() {
    out.textContent = `${comma(Eg, 2)} eV`;
    input.value = String(Eg);
    render();
  }

  // Dra linjen i diagrammet.
  let dragging = false;
  const setFrom = (ev) => {
    const r = stage.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * G.w;
    Eg = Math.min(EG_MAX, Math.max(EG_MIN, Math.round(Ex(x) * 100) / 100));
    update();
  };
  stage.addEventListener(
    "pointerdown",
    (ev) => {
      if (!G) return;
      const r = stage.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * G.w;
      if (Math.abs(x - xE(Eg)) > 28) return;
      dragging = true;
      stage.setPointerCapture?.(ev.pointerId);
      setFrom(ev);
    },
    { signal },
  );
  stage.addEventListener("pointermove", (ev) => dragging && setFrom(ev), { signal });
  stage.addEventListener("pointerup", () => (dragging = false), { signal });
  stage.addEventListener("pointercancel", () => (dragging = false), { signal });
  stage.style.cursor = "ew-resize";

  onResize(() => render());
  update();
}
