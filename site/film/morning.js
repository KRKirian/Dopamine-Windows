// First half of the film: the title, the computer in the morning, the strip, and the away hour.

import { backOut, draw, easeOut, place, prog, through, visible, whenReached } from "./engine.js";
import { AFTERNOON, CAT_COLOR, CHIPS, CHIP_GAP, CHIP_T0, CLOCK, DAY_FROM, DAY_TO, FIX, GLANCE, MORNING, STRIP_W } from "./data.js";

export const counted = (sim) =>
  [...MORNING, ...AFTERNOON].reduce((sum, s) => sum + Math.max(0, Math.min(sim, s.to) - s.from), 0);

export const fmtDuration = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function fmtClock(min, lang) {
  const h = Math.floor(min / 60);
  const m = String(Math.floor(min % 60)).padStart(2, "0");
  if (lang !== "en") return `${h}:${m}`;
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** When a category's chip is sorted, the pencil stretches of that category take its paint. */
export function paintedAt(cat) {
  const i = CHIPS.findIndex((c) => c.cat === cat);
  return CHIP_T0 + i * CHIP_GAP + 0.8;
}

/** The chat stretch changes from social to study once the category has been corrected. */
export const fixProgress = (t) => easeOut(prog(t, FIX.done, FIX.done + 0.5));

export function renderLockup(r, t, S) {
  const finale = t >= 44.4;
  const t0 = finale ? 44.6 : 0.2;
  const fade = finale ? 1 : 1 - easeOut(prog(t, 4.1, 4.8));
  const lift = finale ? 0 : -24 * prog(t, 4.1, 4.8);
  const shown = t >= t0 && (finale || t < 4.8);
  r.intro.spans.forEach((s, i) => {
    const p = backOut(prog(t, t0 + i * 0.16, t0 + i * 0.16 + 0.55));
    s.style.transform = `scale(${Math.max(0, p).toFixed(3)})`;
  });
  place(r.intro.box, { o: shown ? fade : 0, x: 320, y: 196 + lift });
  const w = easeOut(prog(t, t0 + 0.7, t0 + 1.3));
  place(r.word, { o: shown ? w * fade : 0, x: 580, y: 236 + lift + 14 * (1 - w) });
  const g = easeOut(prog(t, t0 + 1.4, t0 + 2.0));
  r.tag.textContent = finale ? S.tagEnd : S.tagIntro;
  place(r.tag, { o: shown ? g * fade : 0, x: 588, y: 352 + lift, r: -2 });
}

function frontWindow(t, sim) {
  if (t >= GLANCE.t0 && t < GLANCE.t1) return GLANCE.win;
  const now = MORNING.find((s) => sim >= s.from && sim < s.to) ?? MORNING[sim < MORNING[0].from ? 0 : MORNING.length - 1];
  return now.win;
}

const activatedAt = (s, i) => (i === 0 ? CLOCK[0][0] : s.from === GLANCE.at ? GLANCE.t1 : whenReached(CLOCK, s.from));
const ACTIVATIONS = [
  ...MORNING.map((s, i) => ({ win: s.win, at: activatedAt(s, i) })),
  { win: GLANCE.win, at: GLANCE.t0 },
].sort((a, b) => a.at - b.at);

function renderWindows(r, t, sim) {
  const front = frontWindow(t, sim);
  const last = {};
  for (const a of ACTIVATIONS) if (a.at <= t) last[a.win] = a.at;
  const order = Object.keys(r.wins).sort((a, b) => (last[a] ?? -1) - (last[b] ?? -1));
  order.forEach((key, i) => {
    const w = r.wins[key];
    w.node.style.zIndex = String(i + 1);
    const pop = key === front && last[key] != null ? easeOut(prog(t, last[key], last[key] + 0.3)) : 1;
    place(w.node, { s: 0.975 + 0.025 * pop, y: 6 * (1 - pop) });
    w.node.style.filter = key === front ? "none" : "saturate(0.6)";
  });
  r.wins.code.title.textContent = sim < 665 ? MORNING[0].title : MORNING[3].title;
  r.wins.chrome.title.textContent = sim < 720 ? MORNING[1].title : MORNING[4].title;
  r.wins.discord.title.textContent = MORNING[2].title;
  r.wins.spotify.title.textContent = GLANCE.title;
  r.wins.chrome.leet.style.display = sim < 720 ? "block" : "none";
  r.wins.chrome.tube.style.display = sim < 720 ? "none" : "grid";
}

export function renderDesk(r, t, S, lang) {
  const o = Math.min(easeOut(prog(t, 4.6, 5.4)), 1 - easeOut(prog(t, 22.8, 23.5)));
  place(r.screen, { o, s: 0.96 + 0.04 * easeOut(prog(t, 4.6, 5.4)) - 0.04 * prog(t, 22.8, 23.5) });
  if (o <= 0) return;
  const sim = through(CLOCK, t);
  renderWindows(r, t, sim);
  r.total.textContent = fmtDuration(counted(sim));
  r.clockEl.textContent = fmtClock(sim, lang);
  r.glass.style.background = visible(t, 12.4, 16.9) > 0.5 ? "var(--wash)" : "transparent";
  place(r.dim, { o: visible(t, 17.6, 22.3, 0.5) });
}

function renderSegments(r, t, sim) {
  const px = (min) => (min / (DAY_TO - DAY_FROM)) * STRIP_W;
  const fix = fixProgress(t);
  r.morning.forEach((s) => {
    const w = px(Math.max(0, Math.min(sim, s.to) - s.from));
    s.node.style.width = `${Math.max(0, w - 2).toFixed(2)}px`;
    s.node.style.visibility = w > 2 ? "visible" : "hidden";
    const paint = easeOut(prog(t, paintedAt(s.cat), paintedAt(s.cat) + 0.5));
    s.pencil.style.opacity = (1 - paint).toFixed(3);
    s.paint.style.opacity = paint.toFixed(3);
    if (s.win === "discord") {
      s.paint.style.background = `color-mix(in srgb, ${CAT_COLOR.study} ${Math.round(fix * 100)}%, ${CAT_COLOR.social})`;
      s.node.style.transform = `scaleY(${1 + 0.25 * visible(t, FIX.done, FIX.done + 0.5, 0.25)})`;
    }
  });
  r.afternoon.forEach((s) => {
    const w = px(Math.max(0, Math.min(sim, s.to) - s.from));
    s.node.style.width = `${Math.max(0, w - 2).toFixed(2)}px`;
    s.node.style.visibility = w > 2 ? "visible" : "hidden";
    s.pencil.style.opacity = "0";
    s.paint.style.opacity = "1";
  });
  r.glance.style.left = `${px(GLANCE.at - DAY_FROM) - 1}px`;
  place(r.glance, { o: visible(t, GLANCE.t0, GLANCE.t1 + 0.9, 0.15) });
}

function renderNotes(r, t, S) {
  const { front, total, glance } = r.notes;
  const notes = [
    [front, S.noteFront, 6.2, 9.4],
    [total, S.noteTotal, 12.4, 16.9],
    [glance, S.noteGlance, 11.2, 14.8],
  ];
  for (const [n, text, a, b] of notes) {
    if (n.text.innerHTML !== text) n.text.innerHTML = text;
    place(n.n, { o: visible(t, a, b) });
    draw(n.path, easeOut(prog(t, a + 0.2, a + 0.9)));
  }
  r.bracket.label.textContent = S.noteAway;
  place(r.bracket.b, { o: visible(t, 19.2, 22.8) });
  draw(r.bracket.path, easeOut(prog(t, 19.2, 19.9)));
}

export function renderStrip(r, t, S, lang) {
  renderNotes(r, t, S);
  const inP = easeOut(prog(t, 5, 5.8));
  const o = Math.min(inP, 1 - prog(t, 32.6, 33.2));
  place(r.strip, { o });
  place(r.clock, { o: Math.min(easeOut(prog(t, 5.2, 5.8)), 1 - prog(t, 32.6, 33.2)), x: 48, y: 40 });
  if (o <= 0) return;
  r.base.style.transform = `scaleX(${inP.toFixed(3)})`;
  const sim = through(CLOCK, t);
  r.clock.textContent = fmtClock(sim, lang);
  renderSegments(r, t, sim);
}
