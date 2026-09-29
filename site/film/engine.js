// Timing helpers and the player. Scenes are pure functions of time, so the player only has to
// keep a clock; seeking, scrubbing and frame-by-frame recording all go through render(t).

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, x) => a + (b - a) * x;
/** Progress of t through [a, b], clamped to 0..1. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const backOut = (x) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

/** Fades in over `f` seconds from a, and out over `f` seconds before b. */
export function visible(t, a, b, f = 0.35) {
  return Math.min(easeOut(prog(t, a, a + f)), 1 - prog(t, b - f, b));
}

/** Linear interpolation through [time, value] keys (times ascending). */
export function through(keys, t, ease = (x) => x) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

/** First time at which `through(keys, t)` reaches value v (values ascending). */
export function whenReached(keys, v) {
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1];
    const [t1, v1] = keys[i];
    if (v <= v1 && v1 > v0) return lerp(t0, t1, clamp((v - v0) / (v1 - v0)));
  }
  return keys[keys.length - 1][0];
}

/** Writes opacity and transform in one go; fully transparent elements are hidden. */
export function place(el, { o = 1, x = 0, y = 0, s = 1, r = 0 } = {}) {
  el.style.opacity = o.toFixed(3);
  el.style.visibility = o <= 0.001 ? "hidden" : "visible";
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`;
}

/** Stroke-draws an SVG path from 0 to 1. */
export function draw(path, p) {
  if (!path.__len) path.__len = path.getTotalLength();
  path.style.strokeDasharray = `${path.__len}`;
  path.style.strokeDashoffset = `${(path.__len * (1 - p)).toFixed(2)}`;
}

export function el(tag, className, parent, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  if (parent) parent.appendChild(node);
  return node;
}

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Plays a film on the page: scales the stage to fit, runs the clock, and drives the play button,
 * the scrubber and the chapter marks. Autoplays once when scrolled into view, unless the reader
 * prefers reduced motion.
 */
export class Player {
  constructor({ root, stage, duration, chapters, render, poster }) {
    this.root = root;
    this.stage = stage;
    this.duration = duration;
    this.chapters = chapters;
    this.renderFrame = render;
    this.poster = poster;
    this.t = poster;
    this.playing = false;
    this.last = 0;
    this.viewport = root.querySelector(".viewport");
    this.playBtn = root.querySelector(".play");
    this.track = root.querySelector(".track");
    this.fill = root.querySelector(".track-fill");
    this.timeEl = root.querySelector(".time");
    this.chapterList = root.querySelector(".chapters");
    this.tick = this.tick.bind(this);
  }

  mount(labels) {
    this.labels = labels;
    this.buildChapters();
    new ResizeObserver(() => this.fit()).observe(this.viewport);
    this.fit();
    this.viewport.addEventListener("click", () => this.toggle());
    this.playBtn.addEventListener("click", () => this.toggle());
    this.bindScrub();
    this.root.addEventListener("keydown", (e) => this.onKey(e));
    this.observe();
    this.render();
  }

  setLabels(labels) {
    this.labels = labels;
    this.buildChapters();
    this.render();
  }

  fit() {
    this.stage.style.setProperty("--s", String(this.viewport.clientWidth / 1280));
  }

  buildChapters() {
    this.chapterList.replaceChildren(
      ...this.chapters.map((c) => {
        const li = el("li");
        li.style.left = `${(c.t / this.duration) * 100}%`;
        const b = el("button", "", li, this.labels.chapters[c.key]);
        b.type = "button";
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.seek(c.t);
          this.play();
        });
        return li;
      }),
    );
  }

  bindScrub() {
    const at = (e) => {
      const r = this.track.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width) * this.duration;
    };
    this.track.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      this.track.setPointerCapture(e.pointerId);
      this.seek(at(e));
      const move = (ev) => this.seek(at(ev));
      const up = () => {
        this.track.removeEventListener("pointermove", move);
        this.track.removeEventListener("pointerup", up);
      };
      this.track.addEventListener("pointermove", move);
      this.track.addEventListener("pointerup", up);
    });
  }

  onKey(e) {
    if (e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      this.toggle();
    } else if (e.key === "ArrowRight") {
      this.seek(this.t + 5);
    } else if (e.key === "ArrowLeft") {
      this.seek(this.t - 5);
    }
  }

  observe() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let autoplayed = false;
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !autoplayed && !reduce) {
          autoplayed = true;
          this.seek(0);
          this.play();
        } else if (!entry.isIntersecting && this.playing) {
          this.pause();
        }
      },
      { threshold: 0.55 },
    ).observe(this.viewport);
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  play() {
    if (this.playing) return;
    if (this.t >= this.duration - 0.05) this.t = 0;
    this.playing = true;
    this.root.classList.add("is-playing", "has-played");
    this.last = performance.now();
    requestAnimationFrame(this.tick);
    this.render();
  }

  pause() {
    this.playing = false;
    this.root.classList.remove("is-playing");
    this.render();
  }

  seek(t) {
    this.t = clamp(t, 0, this.duration);
    this.root.classList.add("has-played");
    this.render();
  }

  tick(now) {
    if (!this.playing) return;
    this.t = Math.min(this.duration, this.t + (now - this.last) / 1000);
    this.last = now;
    if (this.t >= this.duration) this.pause();
    this.render();
    if (this.playing) requestAnimationFrame(this.tick);
  }

  render() {
    this.renderFrame(this.t);
    this.fill.style.width = `${(this.t / this.duration) * 100}%`;
    this.timeEl.textContent = `${fmtClock(this.t)} / ${fmtClock(this.duration)}`;
    const current = this.chapters.filter((c) => c.t <= this.t + 0.01).length - 1;
    [...this.chapterList.children].forEach((li, i) => li.classList.toggle("is-current", i === current));
    const state = `${this.playing}|${this.labels.play}`;
    if (this.btnState === state) return;
    this.btnState = state;
    this.playBtn.setAttribute("aria-label", this.playing ? this.labels.pause : this.labels.play);
    this.playBtn.innerHTML = this.playing
      ? '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.4" height="12" rx="1"/><rect x="9.6" y="2" width="3.4" height="12" rx="1"/></svg>'
      : '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.2v11.6c0 .6.7 1 1.2.7l9-5.8c.5-.3.5-1 0-1.4l-9-5.8C4.7 1.2 4 1.6 4 2.2z"/></svg>';
  }
}
