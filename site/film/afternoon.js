// Second half of the film: categories and the correction, privacy, and the month.

import { backOut, draw, easeInOut, easeOut, lerp, place, prog, through, visible } from "./engine.js";
import {
  AFTERNOON, CAPTIONS, CAT_COLOR, CHIP_GAP, CHIP_T0, CLOCK, FIX, MONTH_DAYS, MONTH_TODAY, MORNING, monthLoad,
} from "./data.js";
import { counted, fixProgress, fmtDuration } from "./morning.js";

const out4 = (t) => 1 - prog(t, 32.6, 33.2);

export function renderChips(r, t, S) {
  const fixed = fixProgress(t);
  r.chips.forEach((c, i) => {
    const t0 = CHIP_T0 + i * CHIP_GAP;
    const p = easeOut(prog(t, t0, t0 + 0.4));
    place(c.row, { o: p * out4(t), x: -30 * (1 - p) });
    if (p <= 0) return;
    draw(c.path, easeOut(prog(t, t0 + 0.35, t0 + 0.75)));
    const cat = c.fixedTo && t >= FIX.done ? c.fixedTo : c.cat;
    const pop = c.fixedTo ? visible(t, FIX.done, FIX.done + 0.45, 0.2) : 0;
    place(c.catEl, { o: easeOut(prog(t, t0 + 0.7, t0 + 1.0)), s: backOut(prog(t, t0 + 0.7, t0 + 1.1)) + 0.15 * pop });
    c.dot.style.background = CAT_COLOR[cat];
    c.name.textContent = S.cats[cat];
    c.why.textContent = c.fixedTo && t >= FIX.done ? S.byYou : S[c.by];
    place(c.why, { o: easeOut(prog(t, t0 + 0.9, t0 + 1.3)), r: -2 });
  });
}

// Cursor path: in from the lower right, onto the chat row's category, up to Study, and away.
const CURSOR_X = [[29.0, 780], [29.7, 590], [30.1, 590], [30.7, 606], [31.2, 606], [31.9, 780]];
const CURSOR_Y = [[29.0, 480], [29.7, 322], [30.1, 322], [30.7, 392], [31.2, 392], [31.9, 470]];

export function renderPicker(r, t, S) {
  const o = easeOut(prog(t, FIX.open, FIX.open + 0.15)) * (1 - prog(t, FIX.click2 + 0.1, FIX.click2 + 0.3));
  place(r.pick, { o, s: 0.94 + 0.06 * o, y: 8 * (1 - o) });
  for (const [k, item] of Object.entries(r.items)) {
    item.name.textContent = S.cats[k];
    const hover = k === "study" && t > 30.6;
    const current = k === "social";
    item.row.style.background = hover ? "var(--wash)" : "transparent";
    item.row.style.fontWeight = current ? "600" : "400";
  }
  const click = (at) => 0.16 * visible(t, at, at + 0.22, 0.1);
  place(r.cursor, {
    o: Math.min(easeOut(prog(t, FIX.enter, FIX.enter + 0.3)), 1 - prog(t, 31.7, 32.1)),
    x: through(CURSOR_X, t, easeInOut),
    y: through(CURSOR_Y, t, easeInOut),
    s: 1 - click(FIX.click1) - click(FIX.click2),
  });
}

const RING_ORDER = ["work", "study", "social", "entertainment", "other"];
const CIRC = 2 * Math.PI * 140;

function minutesByCategory(sim, fix) {
  const by = Object.fromEntries(RING_ORDER.map((k) => [k, 0]));
  for (const s of [...MORNING, ...AFTERNOON]) {
    const m = Math.max(0, Math.min(sim, s.to) - s.from);
    if (s.win === "discord") {
      by.social += m * (1 - fix);
      by.study += m * fix;
    } else {
      by[s.cat] += m;
    }
  }
  return by;
}

export function renderRing(r, t, S) {
  const o = easeOut(prog(t, 27.0, 27.6)) * out4(t);
  place(r.ring, { o, s: 0.94 + 0.06 * o });
  if (o <= 0) return;
  const sim = through(CLOCK, t);
  const by = minutesByCategory(sim, fixProgress(t));
  const total = RING_ORDER.reduce((a, k) => a + by[k], 0) || 1;
  const sweep = easeInOut(prog(t, 27.0, 28.4));
  let start = 0;
  for (const k of RING_ORDER) {
    const len = (by[k] / total) * CIRC * sweep;
    const gap = len > 10 ? 7 : 0;
    r.arcs[k].setAttribute("stroke-dasharray", `${Math.max(0, len - gap).toFixed(2)} ${CIRC.toFixed(2)}`);
    r.arcs[k].setAttribute("stroke-dashoffset", (-start).toFixed(2));
    start += len;
  }
  r.totalNum.textContent = fmtDuration(counted(sim));
  r.totalLabel.textContent = S.inTotal;
}

export function renderPrivacy(r, t, S) {
  const p = r.privacy;
  const fadeOut = 1 - prog(t, 39.6, 40.2);
  const boxIn = easeOut(prog(t, 33.3, 33.9));
  place(p.box, { o: boxIn * fadeOut, s: 0.96 + 0.04 * boxIn });
  p.boxLabel.textContent = S.yourComputer;
  p.host.textContent = "localhost:26535";
  p.host.style.opacity = easeOut(prog(t, 35.4, 35.9)).toFixed(3);
  // Rows of the day slide in from the left edge and drop into the database.
  p.rows.forEach((row, i) => {
    const a = 34.1 + i * 0.35;
    const f = easeInOut(prog(t, a, a + 0.9));
    const o = easeOut(prog(t, a, a + 0.2)) * (1 - prog(f, 0.75, 1)) * fadeOut;
    place(row, { o, x: lerp(20, 365, f), y: lerp(0, 340 - (290 + i * 26), f), s: lerp(1, 0.5, f) });
  });
  const cloudIn = easeOut(prog(t, 35.6, 36.2));
  place(p.cloud, { o: cloudIn * fadeOut });
  p.cloudLabel.textContent = S.theCloud;
  place(p.wire, { o: fadeOut * (t > 36 ? 1 : 0) });
  draw(p.wirePath, easeOut(prog(t, 36.0, 36.7)));
  place(p.cross, { o: fadeOut * (t > 36.8 ? 1 : 0) });
  draw(p.crossPaths[0], easeOut(prog(t, 36.8, 37.1)));
  draw(p.crossPaths[1], easeOut(prog(t, 37.1, 37.4)));
  p.sent.textContent = S.nothingSent;
  place(p.sent, { o: easeOut(prog(t, 37.4, 37.9)) * fadeOut, r: -2 });
}

const MIN_PAINT = 0.12;
const MAX_PAINT = 0.72;
const LOADS = Array.from({ length: MONTH_DAYS }, (_, i) => (i + 1 <= MONTH_TODAY ? monthLoad(i + 1) : 0));
const ACTIVE = LOADS.filter((v) => v > 0);
const LO = Math.min(...ACTIVE);
const HI = Math.max(...ACTIVE);

export function renderMonth(r, t, S) {
  const o = easeOut(prog(t, 40.0, 40.5)) * (1 - prog(t, 44.0, 44.6));
  place(r.month, { o, y: 10 * (1 - easeOut(prog(t, 40.0, 40.5))) });
  if (o <= 0) return;
  r.title.textContent = S.month;
  r.weekdays.forEach((w, i) => (w.textContent = S.weekdays[i]));
  r.days.forEach((d, i) => {
    const load = LOADS[i];
    const at = 40.4 + i * 0.1;
    const p = prog(t, at, at + 0.35);
    const paint = load ? MIN_PAINT + ((load - LO) / (HI - LO)) * (MAX_PAINT - MIN_PAINT) : 0;
    d.dab.style.background = `color-mix(in srgb, var(--heat) ${Math.round(paint * 100)}%, transparent)`;
    place(d.dab, { o: load ? easeOut(p) : 0, s: Math.max(0, backOut(p)) });
    d.cell.style.color = i + 1 > MONTH_TODAY ? "var(--faint)" : "var(--ink)";
  });
  r.legend.textContent = S.legend;
  r.legend.style.opacity = easeOut(prog(t, 43.0, 43.5)).toFixed(3);
}

export function renderCaption(r, t, S) {
  const i = CAPTIONS.findIndex(([a, b]) => t >= a && t < b);
  const text = i >= 0 ? S.captions[i] : "";
  if (r.caption.textContent !== text) r.caption.textContent = text;
  place(r.caption.parentElement, { o: i >= 0 ? visible(t, CAPTIONS[i][0], CAPTIONS[i][1], 0.3) : 0 });
}
