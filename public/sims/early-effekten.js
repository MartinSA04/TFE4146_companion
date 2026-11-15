/**
 * «Early-effekten» for TFE4146, bipolartransistoren.
 *
 * Én idé: sperrespenningen over kollektorovergangen skyver sonen inn i en svakt dopet base, så den
 * nøytrale basen W_b = L_b − l blir smalere, profilen av hull blir brattere, og I_C øker med
 * spenningen. Den samme l er en større del av en smal base, så der øker strømmen mer per volt, og
 * kurven peker mot en −V_A nærmere null. Når sonen når helt over basen, er det punch-through.
 * Streetman & Banerjee §7.7.2, fig. 7–17.
 *
 * Øverst står en p⁺np⁺-transistor som en stav, med basen L_b bred. Sonen ved kollektorovergangen
 * (tonet) ligger nesten bare i basen, med grensen mellom basen og kollektoren prikket. Den røde
 * flaten er overskuddet av hull i den nøytrale basen, en trekant fra Δp_E til null ved kanten av
 * sonen. Under står I_C mot −V_CE, med den rette delen forlenget bakover til −V_A.
 *
 * Modellen: spenningen over emitterovergangen er fast, så Δp_E står stille, og I_C = qAD_pΔp_E/W_b.
 * l = K√(−V_CE) med K = (0,5 µm)/√(36 V), som er sonebredden (2εV/qN_d)^{1/2} i en base dopet med
 * rundt 1,9·10¹⁷ cm⁻³ (kontaktpotensialet og V_EB er sett bort fra). Punch-through kommer ved
 * V_PT = (L_b/K)², 36 V for 0,5 µm. Kurven er I_C delt på strømmen ved null spenning,
 * 1/(1 − √(V/V_PT)), så den har samme form i V/V_PT for alle L_b og starter like høyt. −V_A er der
 * linjen gjennom kurven ved 0,08·V_PT og 0,25·V_PT møter spenningsaksen: V_A = 0,311·V_PT, altså
 * 45 V for 1 µm og 11 V for 0,5 µm. V_A ∝ L_b².
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

const K = 0.5 / 6; // µm/√V
const V_MAX = 40;
const I_TOP = 3;
const V_LEFT = -50;
const FIT = [0.08, 0.25]; // brøker av V_PT for den rette delen

const vPT = (Lb) => (Lb / K) ** 2;
const lOf = (V) => K * Math.sqrt(Math.max(0, V));
const iOf = (Lb, V) => {
  const wb = Lb - lOf(V);
  return wb <= 0 ? Infinity : Lb / wb;
};
function early(Lb) {
  const a = FIT[0] * vPT(Lb);
  const b = FIT[1] * vPT(Lb);
  const s = (iOf(Lb, b) - iOf(Lb, a)) / (b - a);
  const i0 = iOf(Lb, a) - s * a;
  return { s, i0, va: i0 / s, vEnd: b };
}

export default function init({ stage, controls, getSize, onResize, signal }) {
  let Lb = 1; // µm
  let V = 12; // V

  // ── kontroller ──────────────────────────────────────────────────────────
  const fmt = (x, d) => x.toFixed(d).replace(".", ",");
  function slider(html, min, max, step, value, aria, text, onInput) {
    const label = document.createElement("label");
    const lt = document.createElement("span");
    lt.innerHTML = html;
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", aria);
    label.append(lt, out, input);
    const show = () => (out.textContent = text());
    input.addEventListener(
      "input",
      () => {
        onInput(Number(input.value));
        show();
        render();
      },
      { signal },
    );
    show();
    return label;
  }
  controls.append(
    slider("L<sub>b</sub> ", 0.4, 1, 0.05, Lb, "Bredden av basen, i mikrometer", () => `${fmt(Lb, 2)} µm`, (x) => (Lb = x)),
    slider("−V<sub>CE</sub> ", 1, V_MAX, 1, V, "Spenningen over transistoren, i volt under null", () => `${V} V`, (x) => (V = x)),
  );

  // ── geometri ────────────────────────────────────────────────────────────
  let G = null;
  function layout() {
    const { w: full, h } = getSize();
    if (full < 240 || h < 340) return null;
    const w = Math.min(full, 560);
    const ox = (full - w) / 2;
    const bx0 = 10;
    const ew = 40; // emitteren
    const cw = 40; // kollektoren
    const px = Math.min(260, w - 30 - bx0 - ew - cw); // piksler per µm
    return { w, full, ox, h, bx0, ew, cw, px, by0: 30, by1: 96, py0: 186, py1: 318, ty: 334 };
  }

  // ── tegning ─────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const halo = ";paint-order:stroke;stroke:var(--canvas-bg);stroke-width:3px";
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;
  const sub = (main, s) => `${main}<tspan baseline-shift="sub" style="font-size:8px">${s}</tspan>`;
  const it = ";font-style:italic";

  function device() {
    const { bx0, ew, cw, px, by0, by1 } = G;
    const xb0 = bx0 + ew; // emitterovergangen
    const xm = xb0 + Lb * px; // grensen mellom basen og kollektoren
    const bx1 = xm + cw;
    const punch = lOf(V) >= Lb;
    const l = Math.min(lOf(V), Lb);
    const xz = xm - l * px; // kanten av sonen i basen
    const xz1 = xm + 0.06 * l * px; // litt inn i kollektoren
    const ym = (by0 + by1) / 2;
    let s = "";
    // Sonene.
    s += `<rect x="${P(xb0)}" y="${P(by0)}" width="4" height="${P(by1 - by0)}" style="fill:var(--orange)" fill-opacity="0.18"/>`;
    s += `<rect x="${P(xz)}" y="${P(by0)}" width="${P(xz1 - xz)}" height="${P(by1 - by0)}" style="fill:var(--orange)" fill-opacity="0.18"/>`;
    // Hullene i den nøytrale basen: Δp_E står fast, kanten flytter seg.
    const base = by1 - 3;
    const top = by0 + 14;
    if (!punch) {
      s += `<path d="M ${P(xb0 + 4)} ${P(top)} L ${P(xz)} ${P(base)} L ${P(xb0 + 4)} ${P(base)} Z" style="fill:var(--red)" fill-opacity="0.2"/>`;
      s += `<path d="M ${P(xb0 + 4)} ${P(top)} L ${P(xz)} ${P(base)}" fill="none" style="stroke:var(--red)" stroke-width="1.8"/>`;
      s += tag(xb0 + 9, top - 3, sub("Δp", "E"), "start", "var(--red)", it + halo);
    }
    // Staven.
    s += `<rect x="${P(bx0)}" y="${P(by0)}" width="${P(bx1 - bx0)}" height="${P(by1 - by0)}" rx="3" fill="none" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    s += `<path d="M ${P(xm)} ${P(by0)} V ${P(by1)}" style="stroke:var(--muted)" stroke-width="1.2" stroke-dasharray="1.5 3"/>`;
    const xbc = xb0 + Math.min(40, (Lb * px) / 2);
    s += `<path d="M ${P(bx0)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(bx1)} ${P(by0 + 2)} V ${P(by1 - 2)} M ${P(xbc - 10)} ${P(by0)} H ${P(xbc + 10)}" style="stroke:var(--fg)" stroke-width="3"/>`;
    s += tag(bx0 + ew / 2, ym + 4, "p⁺", "middle", "var(--fg)") + tag(bx1 - cw / 2, ym + 4, "p⁺", "middle", "var(--fg)");
    s += tag(bx0 + ew / 2, by0 - 6, "E", "middle", "var(--muted)") + tag(xbc + 14, by0 - 6, "B", "start", "var(--muted)") + tag(bx1 - cw / 2, by0 - 6, "C", "middle", "var(--muted)");
    // Strømmen ut av kollektoren.
    const i = iOf(Lb, V);
    const mag = punch ? 1 : Math.min(1, (i - 0.8) / 2.2);
    const len = 12 + 12 * mag;
    const sw = 1.4 + 2.6 * mag;
    const ax = bx1 + 6;
    s += `<path d="M ${P(bx1)} ${P(ym)} H ${P(ax + len + 4)}" fill="none" style="stroke:var(--fg)" stroke-width="1.2"/>`;
    s += `<path d="M ${P(ax)} ${P(ym)} H ${P(ax + len)} M ${P(ax + len - 6)} ${P(ym - 4)} L ${P(ax + len)} ${P(ym)} L ${P(ax + len - 6)} ${P(ym + 4)}" fill="none" style="stroke:var(--accent)" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += tag(ax + len / 2, ym - 13, sub("I", "C"), "middle", "var(--accent)", it);
    // Bredder under staven.
    const y1 = by1 + 14;
    const brace = (xa, xb, y) => `<path d="M ${P(xa)} ${P(y - 5)} V ${P(y)} H ${P(xb)} V ${P(y - 5)}" fill="none" style="stroke:var(--fg)" stroke-width="1.1"/>`;
    if (!punch && xz - xb0 > 18) {
      s += brace(xb0 + 1, xz - 1, y1) + tag((xb0 + xz) / 2, y1 + 15, sub("W", "b"), "middle", "var(--fg)", it);
    }
    // Ved punch-through er l hele basen, så navnet står der l ellers står.
    if (punch) s += tag((xb0 + xm) / 2, y1 + 4, "punch-through", "middle", "var(--red)");
    else if (xm - xz > 8) s += brace(xz + 1, xm - 1, y1) + tag((xz + xm) / 2, y1 + 15, "l", "middle", "var(--fg)", it);
    s += brace(xb0 + 1, xm - 1, y1 + 30) + tag((xb0 + xm) / 2, y1 + 45, sub("L", "b"), "middle", "var(--fg)", it);
    return s;
  }

  function chart() {
    const { w, py0, py1, ty } = G;
    const x0 = 14;
    const x1 = w - 40;
    const X = (v) => x0 + ((v - V_LEFT) / (V_MAX - V_LEFT)) * (x1 - x0);
    const Y = (i) => py1 - (Math.min(i, I_TOP) / I_TOP) * (py1 - py0);
    const xo = X(0);
    let s = "";
    s += `<path d="M ${P(x0)} ${P(py1)} H ${P(x1 + 8)} M ${P(xo)} ${P(py1)} V ${P(py0 - 10)}" fill="none" style="stroke:var(--border-strong)" stroke-width="1.2"/>`;
    s += `<path d="M ${P(x1 + 8)} ${P(py1)} l -6 -4 M ${P(x1 + 8)} ${P(py1)} l -6 4 M ${P(xo)} ${P(py0 - 10)} l -4 6 M ${P(xo)} ${P(py0 - 10)} l 4 6" fill="none" style="stroke:var(--border-strong)" stroke-width="1.2"/>`;
    s += tag(xo - 6, py0 - 2, sub("I", "C"), "end", "var(--fg)", it);
    s += tag(x1 + 8, py1 - 8, "−" + sub("V", "CE"), "end", "var(--fg)", it);
    s += tag(xo, ty, "0", "middle", "var(--muted)");
    s += tag(X(V_MAX), ty, `${V_MAX} V`, "middle", "var(--muted)");
    s += `<path d="M ${P(X(V_MAX))} ${P(py1)} v 4" style="stroke:var(--border-strong)" stroke-width="1"/>`;
    // Den rette delen forlenget bakover til −V_A.
    const e = early(Lb);
    const vEnd = Math.min(e.vEnd, V_MAX);
    s += `<path d="M ${P(X(-e.va))} ${P(py1)} L ${P(X(vEnd))} ${P(Y(e.i0 + e.s * vEnd))}" fill="none" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${P(X(-e.va))}" cy="${P(py1)}" r="3.2" style="fill:var(--accent)"/>`;
    s += tag(X(-e.va), ty, "−" + sub("V", "A"), "middle", "var(--accent)", it);
    // Kurven, til den går ut av toppen.
    let d = `M ${P(xo)} ${P(py1)}`;
    for (let v = 0.05; v <= V_MAX + 1e-9; v += 0.1) {
      const i = iOf(Lb, v) * (1 - Math.exp(-v / 0.4));
      if (i >= I_TOP) {
        d += ` L ${P(X(v))} ${P(Y(I_TOP))}`;
        break;
      }
      d += ` L ${P(X(v))} ${P(Y(i))}`;
    }
    s += `<path d="${d}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    // Punktet transistoren står i nå; over toppen av diagrammet en pil oppover ved kanten.
    const i = iOf(Lb, V) * (1 - Math.exp(-V / 0.4));
    // Nær høyre ende starter streken over aksetittelen.
    const yd = X(V) > x1 - 45 ? py1 - 18 : py1;
    s += `<path d="M ${P(X(V))} ${P(yd)} V ${P(Y(i))}" style="stroke:var(--accent)" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>`;
    if (i < I_TOP) s += `<circle cx="${P(X(V))}" cy="${P(Y(i))}" r="4.5" style="fill:var(--accent)"/>`;
    else s += `<path d="M ${P(X(V))} ${P(py0 - 6)} l -5 8 h 10 Z" style="fill:var(--accent)"/>`;
    return s;
  }

  function render() {
    G = layout();
    if (!G) return;
    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${G.full.toFixed(0)} ${G.h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      `<g transform="translate(${G.ox.toFixed(1)} 0)">${device()}${chart()}</g></svg>`;
  }

  onResize(() => render());
  render();
}
