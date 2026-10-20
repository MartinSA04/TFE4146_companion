/**
 * «Et bånd i et elektrisk felt» for TFE4146, modul 01.
 *
 * Én idé: et fullt bånd fører ingen strøm, og et bånd der ett elektron
 * mangler, fører strøm som én positiv ladning i den tomme tilstanden.
 *
 * Båndet er tettbindingsbåndet E(k) = E₀ − 2t·cos(ka) over én Brillouin-sone,
 * k ∈ (−π/a, π/a]. Med periodiske randbetingelser på N = 16 gitterplasser er
 * de tillatte tilstandene k_j = j·2π/(Na), j = −7 … 8, så k = 0 (bunnen) og
 * k = π/a (toppen) er med, og resten kommer i par k, −k. Sonekantene −π/a og
 * π/a er samme tilstand; den tegnes ved π/a, med en blek kopi ved −π/a.
 *
 * Farten til et elektron i tilstand k er v = (1/ħ)·dE/dk = (2ta/ħ)·sin(ka),
 * stigningstallet til kurven. Pila under hvert elektron har lengde ∝ sin(ka).
 * Strømmen er I = −q·Σv over elektronene, og den er tegnet i samme skala som
 * fartspilene: mangler ett elektron, er I = −q·(Σ_alle v − v_tom) = +q·v_tom,
 * så strømpila er like lang som pila under den tomme tilstanden. Dette er
 * Streetman & Banerjee §3.2.1, lign. (3–2a) og (3–2b) og fig. 3–8.
 *
 * Feltet peker mot høyre. Kraften på et elektron er F = −qℰ, mot venstre, så
 * ħ·dk/dt = −qℰ flytter alle elektronene mot negativ k i samme takt. Spredning
 * trekker fordelingen tilbake, d(Δk)/dt = −qℰ/ħ − Δk/τ, så i stasjonær tilstand
 * er hele fordelingen forskjøvet Δk = −qℰτ/ħ (driften mot spredningen er
 * Streetman & Banerjee §3.4.1). Animasjonen er denne relaksasjonen: Δk(t)
 * nærmer seg målet eksponentielt med tidskonstant TAU, både når feltet slås
 * på og av. Ingen Bloch-svingninger: spredningen holder forskyvningen fast.
 *
 * Forskyvningen er SHIFT = 2 tilstander (Δk = π/4a), langt større enn i et
 * virkelig felt, der Δk er en liten brøkdel av sonen. Et helt antall
 * tilstander gjør at hvert elektron ender i en tillatt tilstand: i det fulle
 * båndet havner alle i tilstander som allerede var opptatt, og bildet er det
 * samme som før. Elektronene er like, så hvem som gikk hvor, er bare
 * tegningens måte å vise forskyvningen på.
 *
 * Kontrakt: default-eksporter init(api), api = { stage, controls, getSize, onResize, signal }.
 */

import { choiceRow } from "./_controls.js";

const N = 16; // tilstander i sonen
const J_MIN = -7; // j = −7 … 8, k_j = j·2π/(Na)
const DK = (2 * Math.PI) / N; // avstanden mellom tilstandene, i enheter av 1/a
const SHIFT = 2; // forskyvningen i feltet, i tilstander
const FEW = 5; // elektroner i «noen få», sentrert om k = 0
const TAU = 0.45; // s, relaksasjonstiden i tegningen (i Si er τ ~ 10⁻¹³ s)

const FILLINGS = [
  { key: "fullt", label: "Fullt bånd" },
  { key: "mangler", label: "Ett elektron mangler" },
  { key: "faa", label: "Noen få elektroner" },
];

/** Tilstandsindeksene j som har et elektron i likevekt. */
function occupied(fill) {
  const all = Array.from({ length: N }, (_, i) => J_MIN + i);
  if (fill === "fullt") return all;
  if (fill === "mangler") return all.filter((j) => j !== N / 2); // toppen, k = π/a, er tom
  const half = (FEW - 1) / 2;
  return all.filter((j) => Math.abs(j) <= half);
}

/** Fasen ka pakket inn i (−π, π]. */
const wrap = (th) => th - 2 * Math.PI * Math.ceil((th - Math.PI) / (2 * Math.PI) - 1e-9);

export default function init({ stage, controls, getSize, onResize, signal }) {
  let fill = "fullt";
  let field = false;
  let shift = 0; // nåværende forskyvning, i tilstander (negativ = mot −k)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const target = () => (field ? -SHIFT : 0);

  // ── kontroller ────────────────────────────────────────────────────────────
  const fillPick = choiceRow({
    ariaLabel: "Hvor fullt båndet er",
    items: FILLINGS.map((f) => ({ value: f.key, label: f.label })),
    onPick: (k) => {
      fill = k;
      // Et nytt bånd starter i likevekt; står feltet på, ser du det forskyves.
      shift = 0;
      changed();
    },
    signal,
  });

  const fieldBtn = document.createElement("button");
  fieldBtn.type = "button";
  fieldBtn.className = "sim-btn";
  fieldBtn.addEventListener(
    "click",
    () => {
      field = !field;
      changed();
    },
    { signal },
  );

  controls.append(fillPick.el, fieldBtn);

  function sync() {
    fillPick.sync(fill);
    fieldBtn.textContent = field ? "Felt: på" : "Felt: av";
    fieldBtn.setAttribute("aria-pressed", String(field));
  }

  function changed() {
    sync();
    if (reduce.matches) shift = target();
    render();
    start();
  }

  // ── tegning ───────────────────────────────────────────────────────────────
  const P = (n) => n.toFixed(1);
  const tag = (x, y, text, anchor = "start", color = "var(--muted)", extra = "") =>
    `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" style="fill:${color};font-family:var(--font-mono);font-size:11px${extra}">${text}</text>`;

  /** Vannrett pil fra x1 til x2 ved høyden y; hodet krymper med korte piler. */
  const hArrow = (x1, x2, y, color, width) => {
    const len = Math.abs(x2 - x1);
    if (len < 5) return ""; // stumper under 5 px leses som flekker, ikke piler
    const dir = Math.sign(x2 - x1);
    const head = Math.min(6 + width, len * 0.6);
    const half = Math.min(3 + width * 0.6, head * 0.6);
    const hx = x2 - dir * head;
    return (
      `<path d="M ${P(x1)} ${P(y)} H ${P(hx)}" stroke="${color}" stroke-width="${width}" fill="none"/>` +
      `<path d="M ${P(x2)} ${P(y)} L ${P(hx)} ${P(y - half)} L ${P(hx)} ${P(y + half)} Z" style="fill:${color}"/>`
    );
  };

  function render() {
    const { w, h } = getSize();
    if (w < 200 || h < 240) return; // ikke lagt ut ennå

    // Plottet: sonen fra −π/a (x0) til π/a (x1).
    const xE = 14; // energiaksen
    const x0 = 34;
    const x1 = w - 16;
    const pw = x1 - x0;
    const cx = (x0 + x1) / 2;
    const yTop = 30; // båndets topp, E₀ + 2t
    const yBot = h - 96; // båndets bunn, E₀ − 2t
    const H = yBot - yTop;
    const yAx = yBot + 26; // k-aksen
    const yCur = h - 18; // strømraden

    const X = (th) => cx + (th / Math.PI) * (pw / 2);
    const Y = (th) => yTop + (H * (1 + Math.cos(th))) / 2;

    const sp = pw / N; // px mellom tilstandene
    const R = Math.max(4, Math.min(5.5, sp / 3.6)); // prikkens radius
    const LV = Math.min(44, 2 * sp); // px for største fart
    const OFF = R + 7; // fartspila står så langt under prikken

    let s = "";

    // Aksene. Sonekantene som stiplede linjer: der går elektronene ut og inn.
    s +=
      `<path d="M ${P(xE)} ${P(yAx)} V ${P(yTop - 18)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(xE)} ${P(yTop - 22)} l -3 6 h 6 z" style="fill:var(--border-strong)"/>` +
      tag(xE + 7, yTop - 13, "E", "start", "var(--muted)", ";font-style:italic") +
      `<path d="M ${P(xE)} ${P(yAx)} H ${P(x1 + 6)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      `<path d="M ${P(x0)} ${P(yAx)} V ${P(yTop - 6)} M ${P(x1)} ${P(yAx)} V ${P(yTop - 6)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>` +
      `<path d="M ${P(cx)} ${P(yAx - 4)} V ${P(yAx + 4)} M ${P(x0)} ${P(yAx - 4)} V ${P(yAx + 4)} M ${P(x1)} ${P(yAx - 4)} V ${P(yAx + 4)}" stroke="var(--border-strong)" stroke-width="1"/>` +
      tag(x0, yAx + 16, "−π/a", "middle") +
      tag(cx, yAx + 16, "0", "middle") +
      tag(x1, yAx + 16, "π/a", "end") +
      tag((cx + x1) / 2, yAx + 16, "k", "middle", "var(--muted)", ";font-style:italic");

    // Båndet E(k).
    let curve = "";
    for (let i = 0; i <= 160; i++) {
      const th = -Math.PI + (2 * Math.PI * i) / 160;
      curve += `${i === 0 ? "M" : "L"} ${P(X(th))} ${P(Y(th))} `;
    }
    s += `<path d="${curve}" fill="none" stroke="var(--border-strong)" stroke-width="2"/>`;

    // De tillatte tilstandene som blanke ringer. Kantilstanden står ved π/a,
    // med en blek kopi ved −π/a.
    let rings = "";
    for (let i = 0; i < N; i++) {
      const th = (J_MIN + i) * DK;
      rings += `<circle cx="${P(X(th))}" cy="${P(Y(th))}" r="${P(R - 0.4)}"/>`;
    }
    s += `<g fill="var(--canvas-bg)" stroke="var(--border-strong)" stroke-width="1.2">${rings}</g>`;
    s += `<circle cx="${P(X(-Math.PI))}" cy="${P(Y(-Math.PI))}" r="${P(R - 0.4)}" fill="var(--canvas-bg)" stroke="var(--border-strong)" stroke-width="1.2" opacity="0.4"/>`;

    // Elektronene der de står nå, og den tomme tilstanden som flytter seg med dem.
    const occ = occupied(fill);
    const thetas = occ.map((j) => wrap((j + shift) * DK));
    const holeTh = fill === "mangler" ? wrap((N / 2 + shift) * DK) : null;
    const atEdge = (th) => Math.abs(th - Math.PI) < 1e-6;

    let arrows = "";
    let dots = "";
    let ghost = "";
    let vsum = 0;
    for (const th of thetas) {
      const v = Math.sin(th);
      vsum += v;
      const x = X(th);
      const y = Y(th);
      arrows += hArrow(x, x + LV * v, y + OFF, "var(--indigo)", 1.6);
      dots += `<circle cx="${P(x)}" cy="${P(y)}" r="${P(R)}"/>`;
      if (atEdge(th)) ghost += `<circle cx="${P(X(-Math.PI))}" cy="${P(Y(-Math.PI))}" r="${P(R)}"/>`;
    }
    s += arrows;
    s += `<g style="fill:var(--indigo)" opacity="0.4">${ghost}</g>`;
    s += `<g style="fill:var(--indigo)">${dots}</g>`;

    if (holeTh !== null) {
      const hx = X(holeTh);
      const hy = Y(holeTh);
      s += hArrow(hx, hx + LV * Math.sin(holeTh), hy + OFF, "var(--red)", 1.6);
      s +=
        `<circle cx="${P(hx)}" cy="${P(hy)}" r="${P(R + 0.6)}" fill="var(--canvas-bg)" stroke="var(--red)" stroke-width="2"/>` +
        `<path d="M ${P(hx - R + 2)} ${P(hy)} H ${P(hx + R - 2)} M ${P(hx)} ${P(hy - R + 2)} V ${P(hy + R - 2)}" stroke="var(--red)" stroke-width="1.6"/>`;
      // Kopien ved −π/a er bare en stiplet ring uten «+», så den ikke leses som et hull til.
      if (atEdge(holeTh))
        s += `<circle cx="${P(X(-Math.PI))}" cy="${P(Y(-Math.PI))}" r="${P(R)}" fill="var(--canvas-bg)" stroke="var(--red)" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6"/>`;
      // Etiketten oppe til venstre for hullet, inne i båndets bue.
      const right = holeTh >= 0;
      s += tag(hx + (right ? -1 : 1) * (R + 4), hy - R - 4, "hull", right ? "end" : "start", "var(--red)");
    }

    // Feltet, inne i buen over bunnen.
    if (field) {
      const fy = yTop + H * 0.3;
      s +=
        tag(cx - 30, fy + 5, "ℰ", "middle", "var(--accent)", ";font-size:var(--text-sm);font-style:italic") +
        hArrow(cx - 20, cx + 26, fy, "var(--accent)", 2);
    }

    // Strømmen: I = −q·Σv, i samme skala som fartspilene. Feltet peker alltid
    // mot høyre, så I ≥ 0 og etiketten kan stå fast til venstre for nullpunktet.
    const I = -vsum;
    s += tag(cx - 12, yCur + 4, "strøm", "end", "var(--fg)", ";font-size:var(--text-sm)");
    const len = LV * I;
    if (Math.abs(len) < 5) {
      s +=
        `<circle cx="${P(cx)}" cy="${P(yCur)}" r="3.5" style="fill:var(--fg)"/>` +
        tag(cx + 9, yCur + 4, "0", "start", "var(--fg)", ";font-size:var(--text-sm)");
    } else {
      s += `<circle cx="${P(cx)}" cy="${P(yCur)}" r="2" style="fill:var(--fg)"/>`;
      s += hArrow(cx, cx + len, yCur, "var(--fg)", 2.5);
    }

    stage.innerHTML =
      `<svg width="100%" height="100%" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="none" role="img" aria-hidden="true" style="display:block">` +
      s +
      `</svg>`;
  }

  // ── bevegelse ─────────────────────────────────────────────────────────────
  let raf = 0;
  let last = 0;
  let visible = true;
  function frame(now) {
    raf = 0;
    if (signal.aborted) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    const goal = target();
    shift += (goal - shift) * (1 - Math.exp(-dt / TAU));
    if (Math.abs(goal - shift) < 2e-3) shift = goal;
    render();
    if (shift !== goal && visible) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || shift === target()) return;
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
  onResize(render);
  render();
}
