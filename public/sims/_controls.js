/**
 * Delte kontroller for simuleringene i dette emnet.
 *
 * `choiceRow` gir det samme valget i to former: en knapperad på brede skjermer
 * og en nativ <select> på telefon. Sju krystallsystemer eller fem gittertyper
 * som knapper brytes over flere rader og spiser halve skjermen, mens en select
 * blir stående på én linje og åpner OS-plukkeren. Det er samme grep som
 * rammeverkets egen seksjonsfilter i Flashcards bruker.
 *
 * Begge formene ligger i DOM-en hele tiden, og JS viser én av gangen: en
 * kurs-sim kan ikke skrive media queries (kontrollene injiseres uten scoped
 * CSS), så bruddpunktet leses med matchMedia i stedet.
 */

const PHONE = "(max-width: 640px)";

/**
 * @param {object} o
 * @param {string} o.ariaLabel   Navn på gruppen, brukt av begge formene.
 * @param {string} [o.label]     Valgfri ledetekst foran raden.
 * @param {{value: string, label: string}[]} o.items
 * @param {(value: string) => void} o.onPick
 * @param {AbortSignal} o.signal
 * @returns {{ el: HTMLElement, sync: (current: string, disabled?: (v: string) => boolean) => void }}
 */
export function choiceRow({ ariaLabel, label, items, onPick, signal }) {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center";

  if (label) {
    const tag = document.createElement("span");
    tag.style.cssText =
      "font-family:var(--font-mono);font-size:var(--text-xs);color:var(--muted)";
    tag.textContent = label;
    wrap.append(tag);
  }

  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", ariaLabel);

  const select = document.createElement("select");
  // .sim-btn er :global() i Simulation.astro, så en <select> arver den samme
  // pillen som knappene — fyll, radius og mono-typen. Listen selv forblir nativ.
  select.className = "sim-btn";
  select.setAttribute("aria-label", ariaLabel);
  select.style.cssText = "max-width:60vw;text-overflow:ellipsis";

  const btns = [];
  const opts = [];
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sim-btn";
    b.textContent = it.label;
    b.addEventListener("click", () => onPick(it.value), { signal });
    row.append(b);
    btns.push(b);

    const o = document.createElement("option");
    o.value = it.value;
    o.textContent = it.label;
    select.append(o);
    opts.push(o);
  }

  select.addEventListener("change", () => onPick(select.value), { signal });
  wrap.append(row, select);

  const mq = window.matchMedia(PHONE);
  const applyLayout = () => {
    row.style.display = mq.matches ? "none" : "flex";
    select.style.display = mq.matches ? "block" : "none";
  };
  mq.addEventListener("change", applyLayout, { signal });
  applyLayout();

  return {
    el: wrap,
    sync(current, disabled = () => false) {
      for (let i = 0; i < items.length; i++) {
        const off = disabled(items[i].value);
        btns[i].disabled = off;
        btns[i].setAttribute(
          "aria-pressed",
          String(!off && items[i].value === current),
        );
        opts[i].disabled = off;
      }
      select.value = current;
    },
  };
}
