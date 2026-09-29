# Intro page

The page at <https://tempestshaw.github.io/Dopamine/>. Plain HTML, CSS and JavaScript modules with no build step; [`pages.yml`](../.github/workflows/pages.yml) publishes this folder whenever it changes on `main`.

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `main.js` | The page. English lives in the HTML; `i18n.js` holds 简体中文 and 繁體中文 |
| `film/` | The 48-second tour. Every frame is a function of time: `data.js` is the script, `morning.js` and `afternoon.js` draw it, `strings.js` holds its words |
| `media/` | The tour as MP4, one per language, rendered from `film/` |
| `tools/` | The recorder. Not published |

## Preview

```bash
python3 -m http.server 4173 --directory site
```

Add `?lang=zh-CN` or `?lang=zh-TW` to the address to pick a language, or `?record=1` to see the film alone at 1280 × 720.

## Re-record the videos

After changing anything in `film/`, render the MP4s again. This needs Google Chrome, and takes about ten minutes per language.

```bash
cd site/tools
npm install
npm run record                    # all three languages
npm run record -- --lang en       # just one
```
