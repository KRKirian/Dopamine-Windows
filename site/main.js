// Page behaviour: language switching, the download button for this computer, scroll reveals,
// and the film.

import { mountFilm } from "./film/film.js";
import { PAGE_STRINGS } from "./i18n.js";

const LANG_KEY = "dopamine.site.lang";
const VIDEO = { en: "media/dopamine-tour.mp4", "zh-CN": "media/dopamine-tour.zh-CN.mp4", "zh-TW": "media/dopamine-tour.zh-TW.mp4" };
const root = document.documentElement;
const params = new URLSearchParams(location.search);

// English is whatever the page was written in; remember it before any language swaps.
const english = {};
document.querySelectorAll("[data-i18n]").forEach((node) => (english[node.dataset.i18n] = node.innerHTML));
document.querySelectorAll("[data-i18n-alt]").forEach((node) => (english[node.dataset.i18nAlt] = node.alt));
english.title = document.title;

function applyLang(lang) {
  const dict = PAGE_STRINGS[lang] ?? {};
  const text = (key) => dict[key] ?? english[key];
  root.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const next = text(node.dataset.i18n);
    if (next != null && node.innerHTML !== next) node.innerHTML = next;
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((node) => (node.alt = text(node.dataset.i18nAlt)));
  document.title = text("title");
  document.querySelector("[data-video]").href = VIDEO[lang] ?? VIDEO.en;
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}

/** Puts the download for the reader's own system first. */
function preferOwnPlatform() {
  const isWindows = /windows/i.test(navigator.userAgent);
  if (!isWindows) return;
  const box = document.querySelector("[data-downloads]");
  const win = box.querySelector('[data-os="win"]');
  const mac = box.querySelector('[data-os="mac"]');
  box.prepend(win);
  win.classList.add("primary");
  mac.classList.remove("primary");
}

function revealOnScroll() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  items.forEach((n) => io.observe(n));
}

const lang = root.lang;
const record = params.has("record");
applyLang(lang);
const film = mountFilm(document.getElementById("film-root"), lang, { record });

if (record) {
  window.__film = film;
} else {
  preferOwnPlatform();
  revealOnScroll();
  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = b.dataset.lang;
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // Private windows may refuse storage; the choice still applies to this visit.
      }
      applyLang(next);
      film.setLang(next);
    }),
  );
}
