/**
 * «Laserdioden» for TFE4146, fotodioder, lysdioder og lasere.
 *
 * Én idé: med mer strøm i lederetningen blir F_n − F_p ved overgangen større,
 * og når den passerer E_g, er det populasjonsinversjon: fotoner med
 * E_g < hν < F_n − F_p forsterkes. Resonatoren slipper bare frem bølgelengdene
 * som passer mellom speilene. Ved terskelen veier forsterkningen av den beste
 * moden opp for lyset som går ut gjennom speilene, og over terskelen tar den
 * moden all den ekstra strømmen. Streetman & Banerjee §8.4.1–8.4.2, fig.
 * 8–18 til 8–21.
 *
 * Modellen er et leketøy med GaAs-tall (E_g = 1,43 eV, 300 K): forsterkningen
 * er g(hν) ∝ √(hν − E_g)·tanh((Δ − hν)/4k_BT), positiv for E_g < hν < Δ, der
 * Δ = F_n − F_p; den spontane emisjonen er ∝ √(hν − E_g)/(1 + e^{(hν−Δ)/2k_BT})²,
 * fra E_g til omtrent Δ. Hver mode får fotoner fra den spontane emisjonen
 * (andelen β) og fra forsterkningen, og mister dem gjennom speilene (α):
 * S = βr/(α − g). Strømmen er den spontane rekombinasjonen pluss den
 * stimulerte, Σ g·S. Δ finnes slik at strømmen stemmer, og den kan ikke gå
 * over verdien der den beste moden har g = α (terskelen, Δ = E_g + 45 meV).
 * Modeavstanden er 6 meV, mot rundt 0,6 meV i en GaAs-laser på 300 µm.
 *
 * Øverst båndskjemaet over en p⁺n⁺-overgang med begge sidene degenerert
 * (Fermi-nivået 50 meV inne i båndene) og spenningen V = Δ/q. Gapet er tegnet
 * mye smalere enn i virkeligheten, energiene nær båndkantene i riktig skala.
 * F_n på p-siden faller k_BT for hver diffusjonslengde, så inversjonsområdet
 * blir rundt 1,7 diffusjonslengder bredt på hver side ved terskelen. Under
 * det spekteret: den spontane emisjonen (flate) og modene (streker) der
 * forsterkningen er positiv, skalert på nytt for hver strøm.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const EG = 1.43;
const KT = 0.02585;
const DE = 0.006;
const BETA = 2e-4;
const DEG = 0.05; // Fermi-nivået inne i båndet på hver side, eV
const V0 = EG + 2 * DEG;
const LD = 1; // diffusjonslengden, x-enhet
const XR = 3.2; // bildet går fra −XR til XR
const W0 = 0.32; // sonebredden i likevekt, x-enheter
const X_MIN = 0.05;
const X_MAX = 2.5;

const MODES = [];
for (let e = EG + DE / 2; e < EG + 0.16; e += DE) MODES.push(e);
const gain = (hv, D) => (hv <= EG ? 0 : Math.sqrt((hv - EG) / KT) * Math.tanh((D - hv) / (4 * KT)));
const rsp = (hv, D) => (hv <= EG ? 0 : Math.sqrt((hv - EG) / KT) / (1 + Math.exp((hv - D) / (2 * KT))) ** 2);
function Isp(D) {
  let s = 0;
  const h = 0.001;
  for (let e = EG + h / 2; e < EG + 0.4; e += h) s += rsp(e, D) * h;
  return s;
}
const D_TH = EG + 0.045;
const ALPHA = Math.max(...MODES.map((e) => gain(e, D_TH)));
function Itot(D) {
  let s = Isp(D);
  for (const e of MODES) {
    const g = gain(e, D);
    s += (g * BETA * rsp(e, D) * DE) / (ALPHA - g);
  }
  return s;
}
const I_TH = Isp(D_TH);
function solve(x) {
  const target = x * I_TH;
  let lo = EG - 0.35;
  let hi = D_TH - 1e-12;
  for (let k = 0; k < 70; k++) {
    const m = (lo + hi) / 2;
    if (Itot(m) < target) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
const spectrum = (D) =>
  MODES.map((e) => {
    const g = gain(e, D);
    const base = BETA * rsp(e, D) * DE;
    return { e, g, h: (base * ALPHA) / (ALPHA - g), base };
  });
const REF = Math.max(...spectrum(solve(0.9)).map((m) => m.h));
const B_MAX = V0 - solve(X_MIN); // høyeste barriere glideren gir

export default function init({ stage, controls, getSize, onResize, signal }) {
  let t = Math.log(0.1 / X_MIN) / Math.log(X_MAX / X_MIN); // glideren, 0–1; starter ved 0,1 × terskelen
  const xOf = (u) => X_MIN * Math.pow(X_MAX / X_MIN, u);

  const label = document.createElement("label");
  label.append("Strøm ");
  const out = document.createElement("output");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.005";
  input.value = String(t);
  input.setAttribute("aria-label", "Strømmen i lederetningen, som et multiplum av terskelstrømmen");
  label.append(out, input);
  input.addEventListener(
    "input",
    () => {
      t = Number(input.value);
      update();
    },
    { signal },
  );
  controls.append(label);
  const comma = (v, d) => v.toFixed(d).replace(".", ",");

  let G = null;
  function layout() {
    const { w, h } = getSize();
    if (!w || !h) return null;
    const bx0 = 10;
    const bx1 = w - 40;
    const ey0 = 22;
    const ey1 = Math.round(h * 0.5);
    const cy0 = ey1 + 30;
    const cy1 = h - 30;
    return { w, h, bx0, bx1, ey0, ey1, cy0, cy1 };
  }

  // ── båndskjemaet ────────────────────────────────────────────────────────
  // Energier i eV med E_v på p-siden langt ute som null. Tegnet energi: nær
  // båndkantene i skala, gapet presset sammen.
  function model(D) {
    const b = V0 - D; // barrieren
    const W = W0 * Math.sqrt(Math.max(0.01, b) / V0);
    const ep = -W / 2;
    const en = W / 2;
    const Evp = 0;
    const Ev = (x) => {
      if (x <= ep) return Evp;
      if (x >= en) return Evp - b;
      const h = W / 2;
      if (x <= 0) return Evp - (b / 2) * ((x - ep) / h) ** 2;
      return Evp - b + (b / 2) * ((en - x) / h) ** 2;
    };
    const Ec = (x) => Ev(x) + EG;
    const EFp = Evp - DEG; // F_p på p-siden
    const EFn = EFp + D; // F_n på n-siden, qV over
    const lift = (d) => KT * Math.log(1 + Math.expm1(D / KT) * Math.exp(-d / LD));
    const Fn = (x) => (x >= ep ? EFn : EFp + lift(ep - x));
    const Fp = (x) => (x <= en ? EFp : EFn - lift(x - en));
    return { b, W, ep, en, Ev, Ec, Fn, Fp };
  }

  const Pn = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${Pn(x)}" y="${Pn(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;

  function bands(D) {
    const { bx0, bx1, ey0, ey1 } = G;
    const M = model(D);
    const X = (x) => bx0 + ((x + XR) / (2 * XR)) * (bx1 - bx0);
    // Alt er i skala, k px per eV, bortsett fra at midten av gapet er klippet ut:
    // gapet tegnes som GAP eV, med GAP/2 under E_c og GAP/2 over E_v i skala.
    // Ingen linje går inn i den bortklipte delen, så F_n − F_p er lengre enn E_g
    // i bildet nøyaktig når den er det i virkeligheten.
    const GAP = 0.42;
    const top = 0.03;
    const k = (ey1 - ey0) / (top + GAP + B_MAX + 0.07);
    const yC0 = ey0 + top * k; // E_c på p-siden
    const y = (E, x) => {
      const ec = M.Ec(x);
      const ev = M.Ev(x);
      const yc = yC0 + (EG - ec) * k;
      const yv = yc + GAP * k;
      if (E >= ec - GAP / 2) return yc + (ec - E) * k;
      if (E <= ev + GAP / 2) return yv - (E - ev) * k;
      return (yc + yv) / 2; // brukes ikke
    };
    let s = "";
    const N = 160;
    const xs = [];
    for (let i = 0; i <= N; i++) xs.push(-XR + (2 * XR * i) / N);
    // Fylte tilstander: elektroner mellom E_c og F_n, hull mellom F_p og E_v.
    let fe = "";
    let fh = "";
    for (let i = 0; i < N; i++) {
      const xa = xs[i];
      const xb = xs[i + 1];
      const xm = (xa + xb) / 2;
      if (M.Fn(xm) > M.Ec(xm)) {
        fe += `M ${Pn(X(xa))} ${Pn(y(M.Ec(xa), xa))} L ${Pn(X(xb))} ${Pn(y(M.Ec(xb), xb))} L ${Pn(X(xb))} ${Pn(y(Math.max(M.Fn(xb), M.Ec(xb)), xb))} L ${Pn(X(xa))} ${Pn(y(Math.max(M.Fn(xa), M.Ec(xa)), xa))} Z `;
      }
      if (M.Fp(xm) < M.Ev(xm)) {
        fh += `M ${Pn(X(xa))} ${Pn(y(M.Ev(xa), xa))} L ${Pn(X(xb))} ${Pn(y(M.Ev(xb), xb))} L ${Pn(X(xb))} ${Pn(y(Math.min(M.Fp(xb), M.Ev(xb)), xb))} L ${Pn(X(xa))} ${Pn(y(Math.min(M.Fp(xa), M.Ev(xa)), xa))} Z `;
      }
    }
    s += `<path d="${fe}" style="fill:var(--indigo)" fill-opacity="0.32"/><path d="${fh}" style="fill:var(--red)" fill-opacity="0.26"/>`;
    // Inversjonsområdet: der F_n − F_p > E_g.
    let inv0 = null;
    let inv1 = null;
    for (const x of xs) {
      if (M.Fn(x) - M.Fp(x) > EG) {
        if (inv0 === null) inv0 = x;
        inv1 = x;
      }
    }
    if (inv0 !== null) {
      s += `<rect x="${Pn(X(inv0))}" y="${Pn(ey0 - 8)}" width="${Pn(X(inv1) - X(inv0))}" height="${Pn(ey1 - ey0 + 8)}" style="fill:var(--green)" fill-opacity="0.10"/>`;
      const yb = ey0 - 10;
      s +=
        `<path d="M ${Pn(X(inv0))} ${Pn(yb + 4)} v -4 H ${Pn(X(inv1))} v 4" fill="none" style="stroke:var(--green)" stroke-width="1.2"/>` +
        tag((X(inv0) + X(inv1)) / 2, yb - 4, "inversjonsområdet", "middle", "var(--green)", halo);
    }
    // Sonen.
    s += `<path d="M ${Pn(X(M.ep))} ${Pn(ey0)} V ${Pn(ey1)} M ${Pn(X(M.en))} ${Pn(ey0)} V ${Pn(ey1)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>`;
    // Båndkantene.
    const line = (f) => xs.map((x, i) => `${i ? "L" : "M"} ${Pn(X(x))} ${Pn(y(f(x), x))}`).join(" ");
    s += `<path d="${line(M.Ec)}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/><path d="${line(M.Ev)}" fill="none" style="stroke:var(--fg)" stroke-width="1.6"/>`;
    // Bruddmerket: midten av gapet er klippet ut.
    const zig = (x, ym) => `<path d="M ${Pn(x - 6)} ${Pn(ym - 1)} l 12 -5 M ${Pn(x - 6)} ${Pn(ym + 5)} l 12 -5" style="stroke:var(--muted)" stroke-width="1.2"/>`;
    // Kvasi-Fermi-nivåene.
    s +=
      `<path d="${line(M.Fn)}" fill="none" style="stroke:var(--indigo)" stroke-width="1.4" stroke-dasharray="5 3"/>` +
      `<path d="${line(M.Fp)}" fill="none" style="stroke:var(--red)" stroke-width="1.4" stroke-dasharray="5 3"/>`;
    // Merker.
    s +=
      tag(bx1 + 4, y(M.Ec(XR), XR) + 4, sub("E", "c"), "start", "var(--fg)") +
      tag(bx1 + 4, y(M.Ev(XR), XR) + 12, sub("E", "v"), "start", "var(--fg)") +
      tag(bx1 + 4, y(M.Fn(XR), XR) - 4, sub("F", "n"), "start", "var(--indigo)") +
      tag(bx0 + 14, y(M.Fp(-XR), -XR) + 14, sub("F", "p"), "start", "var(--red)", halo) +
      tag(bx0 + 2, ey0 - 8, "p⁺", "start", "var(--fg)", ";font-size:12px") +
      tag(bx1, ey0 - 8, "n⁺", "end", "var(--fg)", ";font-size:12px");
    // Ved overgangen: E_g og F_n − F_p side om side.
    const xg = X(0) - 16;
    const xf = X(0) + 16;
    const yc0 = y(M.Ec(0), 0);
    const yv0 = y(M.Ev(0), 0);
    const yfn = y(M.Fn(0), 0);
    const yfp = y(M.Fp(0), 0);
    const brk = (x, ya, yb, col) => `<path d="M ${Pn(x - 3)} ${Pn(ya)} h 6 M ${Pn(x)} ${Pn(ya)} V ${Pn(yb)} M ${Pn(x - 3)} ${Pn(yb)} h 6" style="stroke:${col}" stroke-width="1.2"/>`;
    s += brk(xg, yc0, yv0, "var(--fg)") + zig(xg, (yc0 + yv0) / 2) + tag(xg - 7, (yc0 + yv0) / 2 + 16, sub("E", "g"), "end", "var(--fg)", halo);
    s += brk(xf, yfn, yfp, "var(--accent)") + zig(xf, (yfn + yfp) / 2) + tag(xf + 7, (yfn + yfp) / 2 + 16, `${sub("F", "n")} − ${sub("F", "p")}`, "start", "var(--accent)", halo);
    return s;
  }

  // ── spekteret ───────────────────────────────────────────────────────────
  const H0 = EG - 0.03;
  const H1 = EG + 0.135;
  function chart(D, x) {
    const { w, cy0, cy1 } = G;
    const cx0 = 14;
    const cx1 = w - 14;
    const xh = (e) => cx0 + ((e - H0) / (H1 - H0)) * (cx1 - cx0);
    const sp = spectrum(D);
    const ymax = Math.max(...sp.map((m) => m.h), ...sp.map((m) => m.base)) * 1.12;
    const yv = (v) => cy1 - (v / ymax) * (cy1 - cy0);
    let s = "";
    // Den spontane emisjonen som flate.
    let d = `M ${Pn(xh(EG))} ${Pn(cy1)} `;
    for (let e = EG; e <= H1; e += 0.001) d += `L ${Pn(xh(e))} ${Pn(yv(BETA * rsp(e, D) * DE))} `;
    d += `L ${Pn(xh(H1))} ${Pn(cy1)} Z`;
    s += `<path d="${d}" style="fill:var(--muted);stroke:var(--muted)" fill-opacity="0.22" stroke-width="1"/>`;
    // Modene der forsterkningen er positiv.
    let lines = "";
    for (const m of sp) {
      if (m.g <= 0.02 * ALPHA) continue;
      lines += `M ${Pn(xh(m.e))} ${Pn(cy1)} V ${Pn(Math.min(cy1 - 1, yv(m.h)))} `;
    }
    s += `<path d="${lines}" style="stroke:var(--accent)" stroke-width="2"/>`;
    // Aksen og merkene.
    s += `<path d="M ${Pn(cx0)} ${Pn(cy1)} H ${Pn(cx1)}" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<path d="M ${Pn(xh(EG))} ${Pn(cy1)} v 5" style="stroke:var(--fg)" stroke-width="1"/>` + tag(xh(EG), cy1 + 17, sub("E", "g"), "middle", "var(--fg)");
    const xD = xh(D);
    if (D > H0 + 0.004) {
      s += `<path d="M ${Pn(xD)} ${Pn(cy0)} V ${Pn(cy1 + 5)}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="3 3"/>`;
      const anchor = D > EG + 0.004 ? "start" : "end";
      s += tag(xD + (anchor === "start" ? 4 : -4), cy1 + 17, `${sub("F", "n")} − ${sub("F", "p")}`, anchor, "var(--accent)", halo);
    }
    s += tag(cx1, cy1 + 17, "hν →", "end");
    s += tag(cx0, cy0 + 4, "lys", "start", "var(--fg)");
    // Skalaen.
    const f = ymax / 1.12 / REF;
    if (f >= 2) s += tag(cx0 + 30, cy0 + 4, `høyden ÷ ${f < 100 ? Math.round(f) : Number(f.toPrecision(2)).toLocaleString("nb-NO")}`, "start", "var(--muted)");
    else if (f <= 0.5) s += tag(cx0 + 30, cy0 + 4, `høyden × ${Math.round(1 / f)}`, "start", "var(--muted)");
    // Hvor vi er.
    const state = x < 0.985 ? "under terskelen" : x <= 1.015 ? "ved terskelen" : "over terskelen";
    s += tag(cx1, cy0 + 4, state, "end", "var(--fg)");
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    const x = xOf(t);
    const D = solve(x);
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.w.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `${bands(D)}${chart(D, x)}</svg>`;
  }
  function update() {
    const x = xOf(t);
    out.textContent = `${comma(x, 2)} × terskelen`;
    render();
  }
  onResize(() => render());
  update();
}
