// The day the film tells: one morning at the computer, an hour away, and an afternoon.
// Times are minutes since midnight; `t` values are seconds into the film.

export const DURATION = 48;
/** Frame shown before the film has been played (the painted-in categories). */
export const POSTER = 29.6;

export const CHAPTERS = [
  { t: 5, key: "front" },
  { t: 17, key: "away" },
  { t: 23, key: "categories" },
  { t: 33, key: "privacy" },
  { t: 40, key: "month" },
];

export const CAT_COLOR = {
  work: "var(--cat-work)",
  study: "var(--cat-study)",
  social: "var(--cat-social)",
  entertainment: "var(--cat-entertainment)",
  other: "var(--cat-other)",
};

/** Windows on the desk, placed inside the 780 × 410 screen. */
export const WINDOWS = {
  code: { app: "VS Code", glyph: "&lt;/&gt;", color: "var(--cat-work)", x: 40, y: 58, w: 520, h: 300 },
  chrome: { app: "Chrome", glyph: "◎", color: "var(--cat-entertainment)", x: 218, y: 76, w: 520, h: 300 },
  discord: { app: "Discord", glyph: "D", color: "var(--cat-other)", x: 112, y: 104, w: 460, h: 262 },
  spotify: { app: "Spotify", glyph: "♪", color: "var(--cat-study)", x: 330, y: 88, w: 380, h: 240 },
};

/** The narrated morning, one entry per stretch with a window in front. */
export const MORNING = [
  { win: "code", title: "analytics.ts — dopamine", cat: "work", from: 540, to: 610 },
  { win: "chrome", title: "Two Sum - LeetCode - Google Chrome", cat: "study", from: 610, to: 650, page: "leet" },
  { win: "discord", title: "#general | Study Group", cat: "social", from: 650, to: 665 },
  { win: "code", title: "Dashboard.tsx — dopamine", cat: "work", from: 665, to: 720 },
  { win: "chrome", title: "YouTube - Google Chrome", cat: "entertainment", from: 720, to: 740, page: "tube" },
];

/** A three-second look at Spotify, between the chat and going back to code. */
export const GLANCE = { win: "spotify", title: "Spotify Premium", at: 665, t0: 11.0, t1: 11.9 };

export const AWAY = { from: 740, to: 790 };

/** The rest of the day, filled in quickly once categories are known. */
export const AFTERNOON = [
  { cat: "work", from: 790, to: 858 },
  { cat: "social", from: 858, to: 872 },
  { cat: "study", from: 872, to: 955 },
  { cat: "other", from: 955, to: 968 },
  { cat: "work", from: 968, to: 1046 },
  { cat: "entertainment", from: 1046, to: 1070 },
  { cat: "study", from: 1070, to: 1110 },
];

/** Film time → clock time. Flat stretches hold the clock (the glance); the away hour runs fast. */
export const CLOCK = [
  [5.5, 540],
  [8.6, 610],
  [10.1, 650],
  [11.0, 665],
  [11.9, 665],
  [14.2, 720],
  [15.6, 740],
  [18.4, 740],
  [21.0, 790],
  [27.2, 790],
  [29.0, 1110],
];

/** When each caption is on screen; the words live in strings.js. */
export const CAPTIONS = [
  [5.5, 11.0],
  [11.0, 16.9],
  [17.2, 22.9],
  [23.2, 28.9],
  [29.0, 32.9],
  [33.2, 39.9],
  [40.2, 44.3],
  [44.8, 48.01],
];

/** Visible part of the day on the strip. */
export const DAY_FROM = 480;
export const DAY_TO = 1200;
export const STRIP_W = 1000;
export const TICKS = [540, 720, 900, 1080];

/** Titles sorted into categories, in the order they appear, with the evidence used. */
export const CHIPS = [
  { win: "code", title: "analytics.ts — dopamine", cat: "work", by: "byApp" },
  { win: "chrome", title: "Two Sum - LeetCode - Google Chrome", cat: "study", by: "bySite" },
  { win: "discord", title: "#general | Study Group", cat: "social", by: "byApp", fixedTo: "study" },
  { win: "chrome", title: "YouTube - Google Chrome", cat: "entertainment", by: "bySite" },
];
export const CHIP_T0 = 23.6;
export const CHIP_GAP = 0.9;

/** The correction: click the chat window's category and choose Study. */
export const FIX = { enter: 29.0, click1: 29.8, open: 29.9, click2: 31.0, done: 31.1 };
export const PICK_ORDER = ["work", "study", "social", "entertainment", "other"];

/** September 2026 starts on a Tuesday. Minutes per day, lighter at weekends. */
export const MONTH_START_WEEKDAY = 2;
export const MONTH_DAYS = 30;
export const MONTH_TODAY = 29;
export function monthLoad(day) {
  const weekday = (MONTH_START_WEEKDAY + day - 1) % 7;
  const weekend = weekday === 0 || weekday === 6;
  const noise = ((day * 7919) % 97) / 97;
  if (weekend && noise < 0.35) return 0;
  return (weekend ? 90 : 300) + noise * (weekend ? 180 : 260);
}
