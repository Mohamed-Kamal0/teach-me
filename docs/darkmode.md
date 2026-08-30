# Dark Mode Plan — One Palette, Two Grounds

> Companion to [`plan.md`](plan.md). `plan.md` §8 decided the look: a classroom, not a dashboard,
> defined once in `_theme.scss` and never overridden component by component. This file decides how
> that same look is given a **second ground** — without a second stylesheet, a second component, a
> server change, or a single new guarantee.

**Stack touched:** `src/styles/_theme.scss` · one new `_dark.scss` partial · one Angular service ·
`index.html` · `mat.all-component-colors` · **no API change, no migration, no endpoint, no DTO field.**

_Added 2026-08-30, after the twenty-three requirements and the six extensions of §12 were all passing._

---

## 0. The one line of `plan.md` this changes

> §8: _"Every ratio below is measured against `surface` `#FAF8F4`"_ — and the table that follows,
> whose whole value is that **the measured number is written down**.

That claim is not weakened here; it is **duplicated**. The palette table gains a second column of
measured ratios against a second surface, and §11 of this file adds the script that recomputes both
on demand — because a stated accessibility claim that nobody can re-check is a decoration, and §8
already says so. Nothing else in §8 moves: the type scale, the vocabulary, the iconography, the role
cues and the shared components are ground-independent by construction.

---

## 1. The decision in three lines

1. **The tokens already exist.** §8 put every colour in the app behind a CSS custom property on
   `:root` and nothing paints from a literal. Dark mode is therefore **a second set of values for
   the same names**, not a second design.
2. **The choice lives on the device, not on the account** — `localStorage`, defaulting to
   `prefers-color-scheme`, with an explicit choice winning in both directions.
3. **The ground is chosen before Angular exists** — a four-line inline script in `<head>`, because
   the app already shows a splash for the seconds a cold API takes to answer, and a white splash
   ahead of a dark app is the one moment a theme cannot recover from.

---

## 2. Scope

| In                                                                                | Out                                                                          |
| :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| Every screen, signed in or out — including `/`, `/discover` and `/login`          | A per-role or per-page theme                                                 |
| Three states: **light · dark · system**, system by default                        | A schedule ("dark after sunset") — the OS already has one                    |
| One control in the app bar, reachable with no session                             | A settings page                                                              |
| A measured contrast table for the dark ground, and a script that checks it        | Contrast-checking the embedded recording, which is somebody else's page      |
| Material's own components, recoloured by `mat.all-component-colors`               | Restyling Material component by component                                    |
| The pre-boot splash in `index.html`                                               | A theme transition animation — a cross-fading page is nausea, not polish     |

**Not in scope, and worth saying out loud: nothing on the server.** No column, no `MeResponse` field,
no endpoint. §3 gives the reason, and it is not laziness.

---

## 3. Where the choice lives — and why not on the user's row

### Why not a column on `Users`

It is the obvious move and it is wrong for this app specifically, for three reasons in ascending
order of weight:

- **It would not cover the screens that need it first.** The home page (Req 7) and the public
  directory (§12.2) are read **with no session at all** — Appendix C is a whole appendix about
  exactly that. A preference fetched from `/api/me` cannot reach the first page a visitor sees, so a
  server-stored theme would leave the app's own front door in whichever ground the visitor did not
  choose, and then snap when they signed in.
- **It is a property of the room, not the person.** The same student reads on a phone in bed and on a
  lab machine under fluorescent light. An account-wide preference makes one of those two wrong, and
  syncs the mistake to every device they own.
- **It would be the first write to `Users` that is not about identity.** Every column on that table
  is either who somebody is or what they may do; `Users` is read on every authenticated request
  (`CurrentUser`, every policy, `MeController`). Adding a display preference to the hottest row in
  the schema, and a migration to the deployed volume, to hold one enum a browser can hold for free,
  is a cost with no matching benefit. [`media.md`](media.md) §3 declined a `byte[]` on that table for
  a milder version of the same reason.

### Why not a cookie

The session cookie is `httpOnly` and set by the server (§4, "How the session is carried"). A theme
cookie would be a second cookie, readable by script, sent on every request including every photo
`GET`, to inform a server that has no use for it. `localStorage` is the correct store for a value
that never leaves the browser.

### The three states, and why three

| Stored value            | What it means                                                                                 |
| :---------------------- | :--------------------------------------------------------------------------------------------- |
| _(absent)_ or `system`  | Follow `prefers-color-scheme`, and keep following it when the OS changes it mid-session        |
| `light`                 | This ground, on this device, whatever the OS says                                              |
| `dark`                  | Likewise                                                                                       |

Two states would be simpler and would lose the only one that is actually a preference: _"do what my
phone does at 9pm"_. A person who has never touched the control gets the ground their OS already told
every other app to use, and the control shows **System** as the current answer rather than pretending
they chose.

`core/theme.service.ts` holds it, in the shape the rest of the app already uses (§8, signals):

```ts
export type ThemeChoice = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>(read());       // localStorage, 'system' if absent or junk
  readonly resolved = computed<'light' | 'dark'>(...); // choice, or the media query when 'system'
  set(choice: ThemeChoice): void;                      // writes localStorage, stamps <html>
}
```

Three details that are not obvious and are each a test in §11:

- **A junk value is `system`, not a crash.** `localStorage` is user-writable and survives a deploy; a
  value this code no longer understands has to degrade to the default rather than throw at boot.
- **The media-query listener is attached always and consulted only while the choice is `system`.**
  Detaching and reattaching it on every change is a subscription to get wrong; reading the signal is
  not.
- **`localStorage` can throw.** Private windows and locked-down browsers make the accessor itself
  raise. Every read and every write is wrapped, and the app renders correctly with no stored value —
  it simply stops remembering, which is the right failure.

---

## 4. How it is applied

**One attribute on `<html>`, and three selectors in the stylesheet.** The attribute is stamped by the
boot script (§5) and thereafter by the service:

```html
<html data-theme="dark">
  <!-- or "light"; absent means "follow the OS" -->
</html>
```

```scss
:root { /* the light values — plan §8's table, unchanged */ }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { @include dark-tokens; }
}

:root[data-theme='dark'] { @include dark-tokens; }
```

Why all three rather than a class toggled by JavaScript:

- The **media block** is what makes `system` free: with no attribute at all, the OS decides and no
  script has to run, re-run, or be listened to.
- The `:not([data-theme='light'])` guard is what makes an explicit **light** choice win _on a dark
  OS_ — the case a naive `@media` block silently loses.
- The third selector is what makes an explicit **dark** choice win on a light OS.

**`color-scheme` is set alongside the tokens, and it is not optional.** It is what tells the browser
to draw its own furniture dark: scrollbars, the spinner in a native control, form-control chrome and
— the one that matters here — **the date picker's own glyphs**, which Req 9 and §12 put on four
forms. Without it a dark page grows a white scrollbar and a white calendar button.

```scss
:root { color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { color-scheme: dark; } }
:root[data-theme='dark'] { color-scheme: dark; }
```

The dark values live in `src/styles/_dark.scss` as a single `@mixin dark-tokens`, `@use`d by
`_theme.scss`. One mixin, emitted twice — so the two dark selectors cannot drift apart, which is
precisely the bug this structure exists to prevent.

---

## 5. The flash before Angular exists

`index.html` paints a splash **before the bundle loads**, on purpose: `AuthService` bootstraps by
calling `/api/me`, and a cold container takes seconds to answer. That splash is currently written in
literals — `#FAF8F4`, `#31456A`, `#6B7280` — so a dark-mode reader would get a full-screen white
flash on every cold load, which is worse than no dark mode at all.

Two changes, both in `index.html`:

1. **A blocking classifier in `<head>`**, before any stylesheet:

   ```html
   <script>
     try {
       var t = localStorage.getItem('teachme.theme');
       if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
     } catch (e) {}
   </script>
   ```

   It must be **inline and synchronous** — an external or deferred script runs after first paint,
   which is the flash it exists to prevent. It reads and stamps, and does nothing else; resolving
   `system` is left to CSS, which needs no script at all.

2. **The splash paints from the tokens**, not from literals. Its `<style>` block moves below the
   stylesheet link and uses `var(--surface)`, `var(--primary)` and `var(--muted)` — the same three
   values `.route-loading__ring` already uses, so the boot ring and the route ring stay the one
   continuous wait §8 designed them to be.

`<meta name="theme-color">` gets the same treatment — two tags with `media="(prefers-color-scheme: …)"`
so mobile browser chrome matches the page — updated by the service when the choice is explicit.

---

## 6. The dark palette, measured

Same names, same hues, second ground. Every ratio below is measured against `--paper` `#1C1B20`
(cards and tables, where most text sits); the page ground `--surface` is darker still, so every one
of these is a **lower bound**. AA needs **4.5:1** for body text.

| Token           | Light     | Dark          | On dark `paper`   | Text?         | Used for                                     |
| :-------------- | :-------- | :------------ | :---------------- | :------------ | :-------------------------------------------- |
| `surface`       | `#FAF8F4` | `#141317`     | —                 | —             | page ground                                  |
| `paper`         | `#FFFFFF` | `#1C1B20`     | —                 | —             | cards, tables                                |
| `paper-sunk`    | `#F3F0E9` | `#26242B`     | —                 | —             | table headers, drawer head, inset strips     |
| `border`        | `#E4DFD5` | `#332F38`     | 1.31:1 vs paper   | —             | the hairline that replaces a lost shadow     |
| `rule`          | `#EDE8DE` | `#2A2830`     | —                 | —             | row separators                               |
| `ink`           | `#1F2937` | `#E9E6E1`     | **13.75:1**       | yes           | body text, headings                          |
| `muted`         | `#6B7280` | `#A7A2AC`     | **6.85:1**        | yes           | drafts, empty states, "nothing here yet"     |
| `primary`       | `#31456A` | `#A8BEE8`     | **9.12:1**        | yes           | links, primary actions                       |
| `danger`        | `#9B3226` | `#F0948A`     | **7.59:1**        | yes           | failed · refused · turned away               |
| `success`       | `#2E6B4F` | `#7CC7A2`     | **8.60:1**        | yes           | passed · lesson open                         |
| `warning-text`  | `#7A4E10` | `#E5B25C`     | **8.85:1**        | yes           | pending approval · quiz not open yet         |
| `tertiary-text` | `#8A5A12` | `#E6BC72`     | **9.62:1**        | yes           | what's-new counts, the joining code          |
| `tertiary`      | `#C9852A` | **`#C9852A`** | 2.36:1            | **fill only** | badge and rule fills                         |
| `warning`       | `#B4741A` | **`#B4741A`** | 1.87:1            | **fill only** | chips and borders, never a sentence          |
| `primary-wash`  | `#EEF1F7` | `#232A3A`     | —                 | —             | the current page in the nav, quiet fills     |
| `danger-wash`   | `#FBEEEC` | `#33211F`     | `danger` on it: **6.75:1**  | —   | the notice that failed                       |
| `success-wash`  | `#ECF3EF` | `#1D2E27`     | `success` on it: **7.16:1** | —   | the notice that passed                       |
| `warning-wash`  | `#FBF3E4` | `#302617`     | `warning-text` on it: **7.67:1** | — | pending · not open yet                    |

Role chips, ink on fill: admin **8.54:1** (`#C3C0C8` on `#26242B`) · teacher **7.65:1** (`#A8BEE8` on
`#232A3A`) · student **7.52:1** (`#7FCCB8` on `#17302B`). The three-login demo stays legible from the
back of the room on either ground.

### The two bright ambers do not move, and that is the point

§8's sharpest paragraph is the one where the accent colour failed its own AA claim at 2.9:1 and was
**demoted to a fill** rather than quietly kept as text. Dark mode is exactly where that decision gets
tested, because the tempting move is to lighten them into text-safe amber and let the distinction
lapse.

They stay `#C9852A` and `#B4741A` on both grounds, with `#1F2937` on top of them on both grounds —
**4.80:1** and **3.81:1**, the same two numbers §8 wrote down, because neither colour in the pair
changed. A badge is a badge on either ground, `_theme.scss` still names the fills apart from the
words, and the one mistake that naming exists to prevent is prevented on both grounds by the same
mechanism.

### Two things that shift by more than a hue

- **The washes invert their relationship to the ground.** In light a wash is a _tint_ — paper with a
  little of the hue in it. In dark it must be a _shade_: near-black with a little of the hue, or it
  becomes a bright block on a dark page and the notice shouts. The four dark washes are therefore
  built from the hue at roughly 12% over `--surface`, not from the light wash darkened.
- **Elevation stops being a shadow.** `--shadow-1` and `--shadow-2` are `rgba(31, 41, 55, …)` — ink
  smoke, invisible on a dark ground. In dark they become `rgba(0, 0, 0, 0.5)` and, more importantly,
  **`--border` does the work instead**: a dark card is told apart from a dark page by being one step
  lighter with a hairline, not by a shadow nobody can see. Both tokens already exist and every card
  already uses both, so this is a value change, not a markup change.

### "Sunk" is a difference, not a direction

`--paper-sunk` is a recess in light: `#F3F0E9`, _below_ both the page and the card. In dark it is
`#26242B` — _above_ the card. The name still holds, because what it actually buys is **a band the eye
reads as a different plane from the rows beneath it**, and in a dark interface planes rise as they
come forward. Inverting the direction and keeping the name is the honest choice; renaming it would
touch nine call sites to say the same thing.

---

## 7. The tokens dark mode forces into existence

Grep the client for a colour literal and there are exactly **fourteen**, and they are nearly all the
same literal: `#fff`, sitting on a fill. That is a light-mode habit and it is where dark mode
actually bites, because it encodes an assumption — _the fill is dark, so its label is white_ — that
stops being true the moment `--primary` becomes `#A8BEE8`.

Four token pairs, each named for the pairing rather than for the colour:

| Token          | Light     | Dark      | Why it cannot be `#fff` or `--ink`                                                                                                                                       |
| :------------- | :-------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--on-primary` | `#FFFFFF` | `#12151C` | A filled primary button. Dark's primary is a _light_ indigo; a white label on it is 1.4:1. **9.74:1** as specified.                                                        |
| `--on-danger`  | `#FFFFFF` | `#2A100C` | The error toast and the destructive confirm button. **7.90:1**.                                                                                                           |
| `--on-success` | `#FFFFFF` | `#082016` | The success toast. **8.59:1**.                                                                                                                                            |
| `--on-fill`    | `#1F2937` | `#1F2937` | Ink on the two ambers. Identical on both grounds — the fills didn't move, so neither does their ink. Today this job is done by `--ink`, which in dark would put 2.2:1 text on a badge. |

`--ink` doing two jobs — _body text_ and _ink on amber_ — is invisible in light mode because both
answers happen to be the same dark colour. **This is the one real bug dark mode exposes in the
existing sheet**, and splitting the two is a rename at three call sites (`.chip-fill-tertiary`,
`.chip-fill-warning`, and the role chips' fallback). It is the change this whole feature exists to
force.

### The app bar needs its own pair, and it is not `--primary`

`.app-bar` is `background: var(--primary); color: #fff` — a deep indigo band under a pale page.
Substituting dark's `--primary` gives a **pale band under a dark page**: the brightest object on
screen becomes the chrome, and the hierarchy inverts. So the bar gets tokens of its own:

| Token               | Light                     | Dark                                        |
| :------------------ | :------------------------ | :------------------------------------------ |
| `--bar-bg`          | `var(--primary)` `#31456A` | `#1A1D25` — an elevated, blue-leaning surface |
| `--bar-ink`         | `#FFFFFF`                 | `var(--ink)` — **13.54:1**                   |
| `--bar-hover-bg`    | `#E3E3E6`                 | `#2A2E38`                                    |
| `--bar-current-bg`  | `#FFFFFF`                 | `#2E3543`                                    |
| `--bar-current-ink` | `var(--primary)`          | `var(--primary)` — **6.56:1** on the pill    |

`app.component.scss`'s existing comment — that MDC's own tokens outrank a plain `color`, and that the
hamburger renders at 1.03:1 without the `--mdc-*` overrides — applies unchanged; those overrides just
take `var(--bar-ink)` instead of `#fff`. The bug it documents is a same-on-same contrast bug, which is
to say it is the class of bug this whole file is about, already found once by hand.

---

## 8. Angular Material

§8 pins M3's generated palettes for the surfaces that carry the app's identity and lets Material's own
theme drive everything structural. Dark mode needs the second half of that recoloured, and Material 18
has exactly the right mixin:

```scss
$web-theme-dark: mat.define-theme((
  color: (theme-type: dark, primary: mat.$azure-palette, tertiary: mat.$orange-palette),
));

@mixin dark-material { @include mat.all-component-colors($web-theme-dark); }
```

**`all-component-colors`, not `all-component-themes`.** Typography and density do not change between
grounds, and re-emitting them under two more selectors would duplicate most of the stylesheet for no
visual difference. The colour-only mixin emits the tokens that actually differ.

It is included inside the same two dark selectors as the custom properties, immediately after them, so
the pinned overrides below (`.mat-mdc-card`, `.mat-mdc-form-field`, `.mat-datepicker-content`,
`.toast`) keep winning on specificity exactly as they do in light — they read from tokens, so they
follow the ground without being written twice.

The four Material surfaces §8 had to pin by hand are the four that need re-checking on the dark
ground, and for the same reason each was pinned in the first place: the datepicker panel's M3
elevation is a shadow with no offset and no blur, which on a dark page is not merely subtle but
absent. Its `--border` hairline is what keeps it floating, and that hairline is already in the rule.

---

## 9. Three things stay light on purpose

- **The embedded recording.** `MediaEmbedComponent` renders somebody else's page in an iframe (Req
  15). We do not recolour it, and we do not put a filter over video — a `filter: invert()` on a
  lecture recording is a defect, not a courtesy. Its `background: #000` letterbox is already correct
  on both grounds and stays a literal, because black behind video is not a theme decision.
- **The initials tile.** `AvatarComponent` hashes a `userId` to one of twelve hues at a fixed
  lightness. Same tile, same colour, same person, both grounds — a roster that recolours itself when
  the sun goes down is not "recognisable at a glance", which is the entire claim the component makes.
  It gains one thing in dark: a `--border` hairline, so a dark-blue tile on a dark card reads as a
  tile rather than as a hole. (§12 has a defect to report about that tile, found while writing this
  file.)
- **A photo.** An uploaded 256×256 WebP is a photograph of a person. It is not dimmed, tinted or
  filtered on either ground.

The hero image on the home page is the one place where a photograph does need the ground: its
readability comes from a scrim — `linear-gradient(rgba(250,248,244,.80), rgba(250,248,244,.90))`, the
light surface at 80–90%, over `Elearning_platform.jpg`. That literal becomes a token pair
(`--scrim-from` / `--scrim-to`) so the dark ground scrims to `#141317` at the same two alphas. The
photo is untouched; what changes is what is laid over it.

---

## 10. The control

**One `mat-icon-button` in the app bar's end group, before the account control, at every width.** It
opens a three-item `mat-menu` — Light · Dark · System — with the current choice checked.

- **In the bar, not on a settings page**, because the people who need it most arrive with **no
  account**: `/`, `/discover` and `/login` are all read signed out, and a control behind a session
  cannot reach them.
- **A menu, not a cycle.** A button that cycles through three states makes "System" a place you pass
  through on the way somewhere, and gives no way to see which of the three you are currently in. Three
  items say what the options are and which one is live.
- **It survives the responsive collapse.** `app.component.scss` documents which controls the bar sheds
  and at which width — the centre nav at 1023px, the role badge at 400px. The theme button is 40px and
  sheds at neither; if the 400px bar is ever short of room, the badge is the thing that already gives
  way, and the drawer already says who you are signed in as.
- **Icon and label.** `light_mode` · `dark_mode` · `brightness_auto` — one glyph per concept, per §8's
  iconography rule, and `aria-label="Appearance"` on the trigger. The menu items carry words, because
  a glyph alone is a guess.

---

## 11. Tests

### `contrast.mjs` — the claim, made checkable

§8 says the ratios "get re-checked in a browser during the Day 18 theme slot, because a stated
accessibility claim is checkable in ten seconds by anyone who doubts it". Two grounds and thirty-odd
pairs is past the point where that is true by hand, so it becomes a script: `client/web/contrast.mjs`
holds both palettes and every pair that carries text, computes the WCAG ratios, prints the table, and
**exits non-zero if any text pair falls below 4.5:1** or if a token declared fill-only is used as text.

It was written before this plan was finished, and it reproduces §8's own published numbers exactly —
9.04, 6.88, 5.94, 4.56, 6.77, 5.57, and ink-on-tertiary at 4.80 — which is what makes the dark column
in §6 worth the same trust as the light one beside it.

### `core/theme.service.spec.ts`

Four assertions, one per non-obvious behaviour of §3:

1. No stored value → `choice` is `system`, and `resolved` follows the media query.
2. `set('light')` on a dark OS → `resolved` is `light` and `<html data-theme="light">` — the case the
   `:not()` guard exists for.
3. A junk stored value → `system`, not a throw.
4. The OS flipping while the choice is `system` moves `resolved`; the same flip while the choice is
   explicit moves nothing.

A fifth for the storage that throws: with `localStorage` stubbed to raise on both accessors, the
service still constructs and still resolves a ground.

### `smoke.mjs` — a dark pass

Playwright takes `colorScheme` on the context. One extra block at the end of the existing script: open
the public home with `colorScheme: 'dark'`, assert the computed `background-color` of `<body>` is the
dark surface rather than the light one, assert **no console error**, and write
`smoke-shots/home-dark.png` beside the shots already collected. That single assertion is what catches
the failure mode this feature actually has — a stylesheet that loads but never applies — which no unit
test can see.

The existing passes stay on the default ground, so the demo script is verified where it is demoed.

### What is not tested, and why

There is no test that a given screen "looks right" dark. Screenshot-diffing thirty screens against a
golden set is a maintenance liability that fails on a font-rendering change, and it would not have
caught any of the four real bugs in §7 — those are contrast arithmetic, and arithmetic is what
`contrast.mjs` does.

---

## 12. A defect this found, and the one-number fix

`contrast.mjs` was pointed at the existing light theme first, and it found something that is **not a
dark-mode bug at all**:

`AvatarComponent.background` returns `hsl(<hue> 55% 42%)` over twelve hues, with `color: #fff` on top.
At hue 60 — the olive — that is **2.59:1**. It fails AA on the light ground today, and has since the
component was written; it is invisible in review because eleven of the twelve hues pass and the
twelfth only appears for the people whose id happens to hash to it.

The fix is the lightness. At **30%**, the worst of the twelve hues is **4.72:1** and every other one
lands between 5:1 and 13:1 — one number, in one file, verified across all twelve rather than across
the one that happened to be on screen. It is recorded here rather than fixed silently, because the
script finding it is the argument for the script.

---

## 13. Files touched

**New (4):**

| File                                          | What                                                                             |
| :-------------------------------------------- | :--------------------------------------------------------------------------------- |
| `client/web/src/styles/_dark.scss`            | `@mixin dark-tokens` and `@mixin dark-material` — the dark values, written once   |
| `client/web/src/app/core/theme.service.ts`    | choice · resolved · set, as signals per §8                                        |
| `client/web/src/app/core/theme.service.spec.ts` | §11                                                                            |
| `client/web/contrast.mjs`                     | §11 — both palettes, exits non-zero on a failure                                 |

**Changed (9):**

| File                                            | What                                                                                                        |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `src/styles/_theme.scss`                        | the three selectors of §4; `color-scheme`; the four `--on-*` and five `--bar-*` tokens of §7; `--scrim-from/to` |
| `src/index.html`                                | the blocking classifier; the splash paints from tokens; two `theme-color` metas                             |
| `src/app/app.component.html`                    | the appearance button and its menu, in `.bar__side--end`                                                    |
| `src/app/app.component.ts`                      | inject `ThemeService`; the menu's three actions                                                             |
| `src/app/app.component.scss`                    | ten `#fff` / `#e3e3e6` literals → `--bar-*` (lines 17, 24–25, 28–29, 38, 45, 71, 94, 102)                    |
| `src/app/shared/avatar.component.ts`            | tile lightness 42% → 30% (§12); a `--border` hairline in dark; `#fff` label kept — the tile is dark on both grounds |
| `src/app/shared/confirm-dialog.component.ts`    | line 33: `#fff` → `var(--on-danger)`                                                                        |
| `src/app/features/public/discover.component.ts` | line 160: `#fff` → `var(--on-primary)`; the `:hover` off `--ink`                                             |
| `src/app/features/public/home.component.ts`     | line 133: the hero scrim's two literals → `--scrim-from` / `--scrim-to`                                      |

`media-embed.component.ts`'s `#000` is deliberately left (§9). **No file under `server/` is touched.**

---

## 14. Build order

1. `_dark.scss` + the three selectors + `color-scheme`. Stop here and flip the OS setting: every screen
   should already be dark, and several should be wrong. **Definition of done:** the wrong ones are
   wrong in the ways §7 predicts, and no others.
2. The four `--on-*` tokens, the five `--bar-*` tokens, and the fourteen literals that need them — the
   bar, the toasts, the confirm dialog and the two amber chips.
3. `mat.all-component-colors` inside both dark selectors. Re-check the four hand-pinned Material
   surfaces of §8: card, form field, datepicker panel, toast.
4. `contrast.mjs`, run against both palettes. Anything below 4.5:1 is fixed here, not later.
5. `ThemeService` + the bar control + the spec.
6. `index.html` — the classifier and the splash. Verified by a hard reload on a throttled connection
   with the choice set to dark: no white frame.
7. The `smoke.mjs` dark pass, and the avatar lightness fix of §12.

Steps 1–3 are the feature; 4–7 are what makes it true. If the day runs out, **the cut is step 5** —
following the OS with no control at all is a complete, coherent feature, and it is the half that
serves the visitor who never opens a menu. Cutting 4, 6 or 7 instead would ship a claim nobody
checked, a white flash, and no regression net.

---

## 15. Rollback

Delete one line: the `@use 'dark'` in `_theme.scss`. The three selectors stop being emitted, every
token falls back to its `:root` value, `data-theme` becomes an attribute nothing reads, and the app is
byte-for-byte the light app it was — the same shape of rollback as the AI helper's unset key
([`ai.md`](ai.md) §8.3). The `--on-*` tokens stay, because they are a correctness fix on either ground.

---

## 16. Deliberately not done

- **A high-contrast or sepia third ground.** Two grounds, both measured, is a claim that can be kept.
  Five is a table nobody re-checks.
- **Syncing the choice across a person's devices.** §3 — the preference is about the room.
- **Theming the embedded recording, or dimming photographs.** §9.
- **A transition between grounds.** The tokens swap instantly. A 300 ms cross-fade of every colour on
  the page is the one animation `prefers-reduced-motion` exists for, and the honest response to that
  is not to write it.
