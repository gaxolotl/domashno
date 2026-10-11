# Branding

The promo images are **generated from vector SVG** by
[`server/scripts/make-branding.mjs`](../../server/scripts/make-branding.mjs), then
rasterised with sharp. That keeps text perfectly crisp — no screenshot/JPEG
round-trip — and lets us render each asset at 2× for retina displays.

```bash
node server/scripts/make-branding.mjs
```

Outputs to **`docs/`** (used by the README + GitHub) and
**`web/public/branding/`** (served by the app, e.g. the `og:image`):

| File | Size | Used for |
|---|---|---|
| `banner.png` | 2880×720 (2× of 1440×360) | README header |
| `social-preview.png` | 2880×1440 (2× of 1440×720) | GitHub social preview, `og:image` |
| `promo.png` | 2880×1620 (2× of 1440×810) | README screenshots section |
| `logo-lockup.png` | 1440×360 (2× of 720×180) | logo + wordmark |

The design (colours, type scale, layout) lives in the script as SVG. Body text uses
**Segoe UI** — a Cyrillic-capable system font available to the SVG renderer; the app
itself uses Golos Text, which can't be embedded in librsvg via `@font-face`.

## Screenshots inside the mockups

`shots/` holds real captures of the app, embedded into the phone frames:

```
shots/today.jpg     390×844   the "Now" screen
shots/week.jpg      390×844   weekly timetable
shots/homework.jpg  390×844   homework list
```

Re-capture them whenever the UI changes meaningfully. For a good hero, make the demo
class have lessons *around the current time* so the **NOW** card is populated —
`server/scripts/seed-demo.mjs` does exactly that.
