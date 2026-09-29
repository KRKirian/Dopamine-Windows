// Builds the film's stage once. Rendering later only moves and fades what is built here.

import { el } from "./engine.js";
import {
  AFTERNOON, CAT_COLOR, CHIPS, DAY_FROM, DAY_TO, MONTH_DAYS, MONTH_START_WEEKDAY, MORNING,
  PICK_ORDER, STRIP_W, TICKS, WINDOWS,
} from "./data.js";

export const stripX = (minute) => ((minute - DAY_FROM) / (DAY_TO - DAY_FROM)) * STRIP_W;

const HOURGLASS =
  '<svg viewBox="0 0 14 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 1h10M2 15h10M3 1c0 4 8 4 8 7s-8 3-8 7M11 1c0 4-8 4-8 7s8 3 8 7"/></svg>';
const LOCK =
  '<svg viewBox="0 0 54 64"><rect x="5" y="28" width="44" height="32" rx="7"/><path d="M14 28v-9a13 13 0 0 1 26 0v9"/><path d="M27 40v8"/></svg>';
const CURSOR =
  '<svg viewBox="0 0 26 30"><path d="M3 2l19 15-8.5 1.4L18 27l-4 1.8-4.4-8.6L3 26z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"/></svg>';

function logo(parent) {
  const box = el("div", "f-logo paint", parent);
  // Circles from the Dopamine mark, in a 240 px box.
  const dots = [
    { x: 86, y: 86, r: 58, c: "#e8799f" },
    { x: 150, y: 92, r: 52, c: "#ffd23f" },
    { x: 104, y: 150, r: 55, c: "#2f6bff" },
    { x: 161, y: 155, r: 35, c: "#4fb58a" },
  ];
  const spans = dots.map((d) => {
    const s = el("span", "", box);
    Object.assign(s.style, {
      left: `${d.x - d.r}px`, top: `${d.y - d.r}px`, width: `${d.r * 2}px`, height: `${d.r * 2}px`, background: d.c,
    });
    return s;
  });
  return { box, spans };
}

function windowBody(key, body) {
  const line = (w, c = "var(--line)") => el("div", "f-line", body).setAttribute("style", `width:${w}%;background:${c}`);
  if (key === "code") {
    [[38, "var(--cat-work)"], [62], [54], [70, "var(--cat-study)"], [44], [58], [30, "var(--cat-social)"], [66], [48]].forEach(
      ([w, c]) => line(w, c),
    );
    return {};
  }
  if (key === "chrome") {
    const leet = el("div", "", body);
    el("div", "f-line", leet).setAttribute("style", "width:34%;height:14px;background:var(--ink);opacity:.7");
    [80, 74, 66].forEach((w) => el("div", "f-line", leet).setAttribute("style", `width:${w}%`));
    const code = el("div", "", leet);
    code.setAttribute("style", "margin-top:16px;padding:14px;border-radius:8px;background:var(--wash)");
    [46, 60, 38].forEach((w, i) =>
      el("div", "f-line", code).setAttribute("style", `width:${w}%;${i === 1 ? "background:var(--cat-study)" : ""}`),
    );
    const tube = el("div", "", body);
    tube.setAttribute(
      "style",
      "position:absolute;inset:14px 18px;border-radius:10px;background:color-mix(in srgb,var(--ink) 16%,transparent);display:grid;place-items:center",
    );
    el("div", "", tube, '<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="28" fill="var(--cat-entertainment)"/><path d="M23 18v22l17-11z" fill="#fff"/></svg>');
    return { leet, tube };
  }
  if (key === "discord") {
    [[52, 0], [40, 1], [60, 0], [34, 1], [48, 0]].forEach(([w, right]) => {
      const b = el("div", "f-line", body);
      b.setAttribute(
        "style",
        `width:${w}%;height:22px;border-radius:11px;margin-left:${right ? "auto" : "0"};background:${right ? "var(--cat-social)" : "var(--line)"};opacity:${right ? 0.7 : 1}`,
      );
    });
    return {};
  }
  const row = el("div", "", body);
  row.setAttribute("style", "display:flex;gap:18px;align-items:center");
  el("div", "paint", row).setAttribute("style", "width:110px;height:110px;border-radius:10px;background:var(--cat-study)");
  const lines = el("div", "", row);
  lines.setAttribute("style", "flex:1");
  [70, 50, 84].forEach((w) => el("div", "f-line", lines).setAttribute("style", `width:${w}%`));
  return {};
}

function buildScreen(stage) {
  const screen = el("div", "f-screen", stage);
  const bar = el("div", "f-menubar", screen);
  el("div", "f-apple", bar, "<span></span><span>File</span><span>Edit</span><span>View</span>");
  const glass = el("div", "f-glass", bar, `${HOURGLASS}<span>0m</span>`);
  const total = glass.querySelector("span");
  el("span", "", bar, "Tue 9:41");
  const wins = {};
  for (const [key, w] of Object.entries(WINDOWS)) {
    const node = el("div", "f-win", screen);
    Object.assign(node.style, { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px` });
    const barEl = el("div", "f-bar", node, `<span class="f-dots"><i></i><i></i><i></i></span>`);
    el("span", "f-icon", barEl, w.glyph).style.background = w.color;
    const title = el("span", "", barEl);
    const body = el("div", "f-body", node);
    wins[key] = { node, title, ...windowBody(key, body) };
  }
  const dim = el("div", "f-dim", screen, LOCK);
  return { screen, total, glass, wins, dim, clockEl: bar.lastElementChild };
}

function buildStrip(stage) {
  const strip = el("div", "f-strip", stage);
  const base = el("div", "f-base rule", strip);
  const ticks = el("div", "f-ticks", strip);
  const tickEls = TICKS.map((m) => {
    const s = el("span", "", ticks);
    s.style.left = `${stripX(m)}px`;
    return s;
  });
  const seg = (item) => {
    const node = el("div", "f-seg", strip);
    node.style.left = `${stripX(item.from)}px`;
    el("b", "", node);
    const paint = el("u", "paint", node);
    paint.style.background = CAT_COLOR[item.cat];
    return { ...item, node, pencil: node.firstChild, paint };
  };
  const morning = MORNING.map(seg);
  const afternoon = AFTERNOON.map(seg);
  const glance = el("div", "f-glance", strip);
  return { strip, base, ticks, tickEls, morning, afternoon, glance };
}

function note(stage, pathD, box) {
  const n = el("div", "f-note f-hand", stage);
  const text = el("span", "", n);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", box.viewBox);
  Object.assign(svg.style, box.style);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  n.appendChild(svg);
  return { n, text, path };
}

function buildNotes(stage) {
  // Arrow tips land on the code window's title bar, the menu bar total, and the glance mark.
  const front = note(stage, "M4 50 C 40 20, 90 8, 132 10 M120 2 L132 10 L121 19", {
    viewBox: "0 0 140 60", style: { left: "110px", top: "-50px", width: "140px", height: "60px" },
  });
  Object.assign(front.n.style, { left: "40px", top: "250px" });
  const total = note(stage, "M182 58 C 130 52, 60 40, 22 10 M20 24 L22 10 L36 14", {
    viewBox: "0 0 190 64", style: { left: "-190px", top: "-64px", width: "190px", height: "64px" },
  });
  Object.assign(total.n.style, { left: "1046px", top: "118px" });
  const glance = note(stage, "M40 12 C 20 20, 8 36, 6 56 M0 46 L6 56 L14 47", {
    viewBox: "0 0 44 64", style: { left: "-40px", top: "0px", width: "44px", height: "64px" },
  });
  Object.assign(glance.n.style, { left: "420px", top: "470px" });
  return { front, total, glance };
}

function buildBracket(stage) {
  const b = el("div", "f-bracket", stage);
  const left = 140 + stripX(740);
  b.style.left = `${left - 6}px`;
  b.style.width = `${stripX(790) - stripX(740) + 12}px`;
  el("span", "f-hand", b);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 22");
  svg.setAttribute("preserveAspectRatio", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M2 20 C 2 10, 6 10, 20 10 L 44 10 C 48 10, 50 4, 50 2 C 50 4, 52 10, 56 10 L 80 10 C 94 10, 98 10, 98 20");
  svg.appendChild(path);
  b.appendChild(svg);
  return { b, label: b.firstChild, path };
}

function buildChips(stage) {
  const box = el("div", "f-chips", stage);
  const chips = CHIPS.map((c) => {
    const row = el("div", "f-chip", box);
    const title = el("div", "f-title", row);
    const w = WINDOWS[c.win];
    el("span", "f-icon", title, w.glyph).style.background = w.color;
    el("span", "", title, c.title);
    title.style.width = "390px";
    const arrow = el("span", "", row, '<svg viewBox="0 0 56 16"><path d="M2 8 C 18 5, 34 11, 50 8 M42 2 l9 6-9 6"/></svg>');
    const path = arrow.querySelector("path");
    const cat = el("div", "f-cat", row, `<i class="dab paint"></i><span></span>`);
    const why = el("span", "f-hand", row);
    why.style.fontSize = "26px";
    return { ...c, row, title, path, catEl: cat, dot: cat.querySelector("i"), name: cat.querySelector("span"), why };
  });
  return { box, chips };
}

function buildPicker(stage) {
  const pick = el("div", "f-pick", stage);
  const items = Object.fromEntries(
    PICK_ORDER.map((k) => {
      const row = el("div", "", pick, `<i class="dab paint" style="background:${CAT_COLOR[k]}"></i><span></span>`);
      return [k, { row, name: row.lastChild }];
    }),
  );
  const cursor = el("div", "f-cursor", stage, CURSOR);
  return { pick, items, cursor };
}

function buildRing(stage) {
  const ring = el("div", "f-ring", stage);
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 340 340");
  svg.classList.add("paint");
  const arcs = Object.fromEntries(
    Object.entries(CAT_COLOR).map(([k, c]) => {
      const a = document.createElementNS(svgNS, "circle");
      Object.entries({ cx: 170, cy: 170, r: 140, fill: "none", stroke: c, "stroke-width": 44 }).forEach(([n, v]) =>
        a.setAttribute(n, String(v)),
      );
      svg.appendChild(a);
      return [k, a];
    }),
  );
  ring.appendChild(svg);
  const total = el("div", "f-total", ring, "<strong></strong><span class='f-hand'></span>");
  return { ring, arcs, totalNum: total.firstChild, totalLabel: total.lastChild };
}

function buildPrivacy(stage) {
  const box = el("div", "f-box", stage);
  const boxLabel = el("span", "f-hand", box);
  const db = el("div", "f-db", box, '<svg viewBox="0 0 140 160"><path d="M4 22v116c0 11 30 20 66 20s66-9 66-20V22"/><ellipse cx="70" cy="22" rx="66" ry="20"/><path d="M4 62c0 11 30 20 66 20s66-9 66-20M4 100c0 11 30 20 66 20s66-9 66-20" fill="none"/></svg><span>dopamine.db</span>');
  const host = el("span", "", box);
  host.setAttribute("style", "position:absolute;left:22px;bottom:14px;font:500 14px var(--mono);color:var(--graphite)");
  const rows = ["work", "study", "social"].map((k, i) => {
    const r = el("div", "f-row paint", stage);
    Object.assign(r.style, { left: "0px", top: `${290 + i * 26}px`, width: "90px", background: CAT_COLOR[k] });
    return r;
  });
  const wire = el("div", "f-wire", stage, '<svg viewBox="0 0 170 4"><path d="M0 2 H170"/></svg>');
  const cloud = el("div", "f-cloud", stage, '<svg viewBox="0 0 300 200"><path d="M70 170 C 20 170, 10 110, 56 100 C 50 50, 120 30, 146 70 C 170 30, 250 40, 240 100 C 290 104, 290 170, 236 170 Z"/></svg>');
  const cloudLabel = el("span", "f-hand", cloud);
  cloudLabel.setAttribute("style", "position:absolute;left:0;right:0;top:92px;text-align:center;font-size:28px;color:var(--faint)");
  const cross = el("div", "f-cross", stage, '<svg viewBox="0 0 80 80"><path d="M12 14 L 68 66"/><path d="M66 12 L 14 68"/></svg>');
  const sent = el("div", "f-note f-hand", stage);
  Object.assign(sent.style, { left: "640px", top: "384px", fontSize: "32px" });
  return {
    box, boxLabel, db, host, rows, wire, wirePath: wire.querySelector("path"), cloud, cloudPath: cloud.querySelector("path"),
    cloudLabel, cross, crossPaths: [...cross.querySelectorAll("path")], sent,
  };
}

function buildMonth(stage) {
  const month = el("div", "f-month", stage);
  const title = el("h4", "", month);
  const grid = el("div", "f-grid", month);
  const weekdays = Array.from({ length: 7 }, () => el("div", "f-wd", grid));
  for (let i = 0; i < MONTH_START_WEEKDAY; i++) el("div", "", grid);
  const shapes = ["48% 52% 45% 55% / 55% 44% 56% 45%", "55% 45% 52% 48% / 46% 56% 44% 54%", "44% 56% 58% 42% / 52% 48% 52% 48%"];
  const days = Array.from({ length: MONTH_DAYS }, (_, i) => {
    const cell = el("div", "", grid);
    const dab = el("i", "paint", cell);
    dab.style.borderRadius = shapes[i % shapes.length];
    el("span", "", cell, String(i + 1));
    return { cell, dab };
  });
  const legend = el("div", "f-hand", month);
  legend.setAttribute("style", "margin-top:10px;text-align:right;font-size:24px");
  return { month, title, weekdays, days, legend };
}

export function buildStage(stage) {
  const intro = logo(stage);
  const word = el("div", "f-word", stage, "Dopamine");
  const tag = el("div", "f-tag f-hand", stage);
  const clock = el("div", "f-clock f-hand", stage);
  const caption = el("div", "f-caption", stage, "<p></p>");
  return {
    stage, intro, word, tag, clock, caption: caption.firstChild,
    ...buildScreen(stage),
    ...buildStrip(stage),
    notes: buildNotes(stage),
    bracket: buildBracket(stage),
    ...buildChips(stage),
    ...buildRing(stage),
    ...buildPicker(stage),
    privacy: buildPrivacy(stage),
    ...buildMonth(stage),
  };
}
