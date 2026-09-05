# The Fault Foundation — brand reference

Transcribed from **Brand Book.pdf** (pages 06–08). This file is the canonical
machine-readable copy: the PDF is the source of truth for *intent*, this is the
source of truth for *values*. If they disagree, the PDF wins and this file is
out of date.

Everything below is wired up in [`styles/theme.css`](styles/theme.css) §1
(tokens) and §2b (typography), and in [`styles/fonts.css`](styles/fonts.css).
Change a value here and in the tokens together.

---

## Colour palette (p.07)

### Core monochrome scheme

A four-step ramp, darkest to lightest. Every surface on the site is one of
these four, or white.

| Token | Hex | Role |
| --- | --- | --- |
| `--ff-navy-900` | `#001A36` | Deepest navy — header/footer glass, dropdown panels, mobile overlay top |
| `--ff-navy-800` | `#003168` | Page background (`--ff-bg`) |
| `--ff-blue-600` | `#005084` | Mid surface (`--ff-surface-1`) |
| `--ff-blue-500` | `#0074A6` | Brand blue — primary buttons, gradient end (`--ff-blue`) |

### Highlights

| Token | Hex | Role |
| --- | --- | --- |
| `--ff-white` | `#FFFFFF` | Body text, headings |
| `--ff-yellow` | `#FFED57` | Accent (`--ff-accent`) — current-page marker, hover fills, Commons pill |
| `--ff-black` | `#000000` | Logo variants |
| `--ff-gray` | `#586468` | Neutral. A *content* grey (rules, disabled states) — it fails contrast against every navy above, so it is never a text colour on-surface. |

### Colours that are NOT brand

- `--ff-text-soft` (`#E4EDF9`) and `--ff-text-dim` (`#B8C7D9`) — the two tints
  between white and unreadable that the design needs for subtitles and
  metadata. The book specifies no tints; these are white desaturated toward
  the navy ground, not toward `--ff-gray`, which reads dirty on `#003168`.
- `--ff-warn` (`#FFB44A`) — semantic warning. A warning has to be
  distinguishable from the accent, and the book's only warm colour *is* the
  accent. Used only by `.ff-article-callout--warn`.
- `--wp--preset--color--accent-2` (`#F6CFF4`) and `accent-3` (`#503AA8`) —
  Twenty Twenty-Five leftovers in `styles/wp-globals.css`. Deliberately left
  un-remapped so a stray `has-accent-3-color` looks broken rather than quietly
  passing as brand.

> **Note.** The ported WordPress presets shipped `#003167` and `#FFEE58` —
> one digit off the book on both. `styles/theme.css` §1 restates the three
> affected presets (`base`, `custom-blue-main`, `accent-1`) with the book's
> values; `wp-globals.css` itself stays verbatim WordPress output.

---

## Typography (p.08)

**Montserrat** is the working typeface. **Fira Code** is the brand font.

| Book role | Setting | Where it lands |
| --- | --- | --- |
| Header 1 | Montserrat **Bold** (700), ALL CAPS | `h1`, `.ff-hero__title` |
| Header 2 | Montserrat **SemiBold** (600), ALL CAPS | `h2`, `.ff-carousel__title`, `.ff-footer__title` |
| Subheader | Montserrat Regular (400) | `.ff-hero__subtitle` |
| Body Text | Montserrat Light (300) | `body` |
| Brand font | Fira Code | Small uppercase labels (breadcrumbs, TOC headings, callout labels, footer group titles) and code |

### Two deliberate departures

The book describes a deck-and-poster system; this site also carries long-form
prose. Both departures are commented at `styles/theme.css` §2b.

1. **ALL CAPS is applied by class, not to `h1`/`h2` globally.** Article and
   policy headings are sentences — "Discord and Sharing Personal Information".
   Uppercasing them costs reading speed and throws away proper-noun casing.
   Page furniture takes the caps; prose keeps sentence case at the book's
   weights. To go all-caps everywhere, move the `.ff-hero__title` rule in §2b
   onto `h1, h2`.

2. **`h3`–`h6` stay SemiBold, not Regular.** The book's "Subheader" is the
   display line under a header, not an `<h3>`. `h3` renders at
   `--font-size--large` — the same size as body copy — so setting it Regular
   against Light body would leave no hierarchy at all. Regular goes to the
   deck lines that actually sit under a title.

### Font files

`public/fonts/` — self-hosted, no CDN, declared in `styles/fonts.css`.

- **Montserrat**: Google's variable woff2, weights 100–900, roman *and* true
  italic, `latin` + `latin-ext` subsets only. The site has no Cyrillic or
  Vietnamese copy; dropping those subsets saves ~180 KB. Roman and italic are
  separate faces because Montserrat's italic is a different design and
  synthesised oblique on a geometric sans looks wrong at prose sizes.
  *SIL Open Font License 1.1.*
- **Fira Code**: the full variable face vendored from the Twenty Twenty-Five
  theme — one file, every glyph, only ever loaded for short runs of text.
  *SIL Open Font License 1.1.*

Manrope was the pre-brand-book typeface and has been removed entirely.

---

## Logos (p.06)

The open-book-and-controller mark. Four approved lockups:

| | Variant | Notes |
| --- | --- | --- |
| **Primary** | Blue/White | The site header and favicon (`Blue-white-border-*.png`) |
| **Primary** | White/Black | For light grounds |
| **Secondary** | Black/White | |
| **Secondary** | Blue/Black | |

Files live under `public/wp-content/uploads/2025/10/` and `.../2025/11/`
(favicon crops), carried over from the WordPress media library.

---

## Applying this elsewhere

The Commons app (separate repo, `commons.fault.foundation`) carries its own
copy of `styles/theme.css` with the same `ff-` token names. The two headers are
kept visually identical on purpose — see `components/MainNav.tsx` in both. When
a token changes here, mirror it there.

Commons has **not** adopted Montserrat/Fira Code site-wide — it still runs on
Manrope. The one carve-out is the "The Fault Foundation" wordmark itself
(header, footer, homepage signature): that always renders in Montserrat Bold,
per this document, on both apps. Commons ships that as a single static
Bold-weight face (`styles/fonts.css` there), not the variable range this repo
uses, since nothing else in that app needs Montserrat yet.
