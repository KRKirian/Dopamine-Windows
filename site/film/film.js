// Entry point for the explainer film: builds the stage, and plays it on the page or, in
// recording mode, exposes render(t) so frames can be captured one by one.

import { buildStage } from "./build.js";
import { CHAPTERS, DURATION, POSTER } from "./data.js";
import { Player } from "./engine.js";
import { renderChips, renderCaption, renderMonth, renderPicker, renderPrivacy, renderRing } from "./afternoon.js";
import { renderDesk, renderLockup, renderStrip } from "./morning.js";
import { FILM_STRINGS } from "./strings.js";

/**
 * @param {HTMLElement} root  the element holding .viewport and the controls
 * @param {string} lang       "en", "zh-CN" or "zh-TW"
 * @param {{ record?: boolean }} options
 */
export function mountFilm(root, lang, { record = false } = {}) {
  const stage = root.querySelector(".stage");
  const outsideCaption = root.querySelector(".film-caption");
  const refs = buildStage(stage);
  let current = lang;
  let S = FILM_STRINGS[lang] ?? FILM_STRINGS.en;

  const render = (t) => {
    renderLockup(refs, t, S);
    renderDesk(refs, t, S, current);
    renderStrip(refs, t, S, current);
    renderChips(refs, t, S);
    renderRing(refs, t, S);
    renderPicker(refs, t, S);
    renderPrivacy(refs, t, S);
    renderMonth(refs, t, S);
    renderCaption(refs, t, S);
    if (outsideCaption && outsideCaption.textContent !== refs.caption.textContent) {
      outsideCaption.textContent = refs.caption.textContent;
    }
  };
  const tickLabels = () => {
    const labels = current === "en" ? ["9 AM", "12 PM", "3 PM", "6 PM"] : ["9:00", "12:00", "15:00", "18:00"];
    refs.tickEls.forEach((el, i) => (el.textContent = labels[i]));
  };
  tickLabels();

  if (record) {
    root.querySelector(".stage").style.setProperty("--s", "1");
    return { render, duration: DURATION, setLang: () => {} };
  }

  const player = new Player({ root, stage, duration: DURATION, chapters: CHAPTERS, render, poster: POSTER });
  player.mount(S);
  return {
    render,
    duration: DURATION,
    setLang(next) {
      current = next;
      S = FILM_STRINGS[next] ?? FILM_STRINGS.en;
      tickLabels();
      player.setLabels(S);
    },
  };
}
