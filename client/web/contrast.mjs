// The accessibility claim in docs/plan.md §8 and docs/darkmode.md §6, made checkable.
//
// Two grounds and thirty-odd pairs is past the point where "re-check it in a browser" is true,
// so both palettes and every pair that carries a word live here. `node contrast.mjs` prints the
// measured WCAG ratios and exits non-zero if one of them has fallen below the threshold it was
// published at. It also refuses any pair whose foreground is one of the two fill-only ambers —
// the demotion plan §8 made by hand is the one thing this file exists to keep.
//
//   node contrast.mjs          both grounds
//   node contrast.mjs light    just the one
//
// The values below are the source of truth for the :root block in src/styles/_theme.scss and
// the dark-tokens mixin in src/styles/_dark.scss; changing a colour there and not here is
// exactly what this is meant to catch.

const AA_TEXT = 4.5;      // WCAG 2.1 AA, body text
const AA_LARGE = 3.0;     // 18.66px bold / 24px — what a chip label is held to

/** Tokens that may only ever be a background. Naming them is half the check. */
const FILL_ONLY = new Set(['tertiary', 'warning']);

const light = {
  surface: '#FAF8F4',
  paper: '#FFFFFF',
  'paper-sunk': '#F3F0E9',
  border: '#E4DFD5',
  rule: '#EDE8DE',
  ink: '#1F2937',
  muted: '#666C79',
  primary: '#31456A',
  danger: '#9B3226',
  success: '#2E6B4F',
  'warning-text': '#7A4E10',
  'tertiary-text': '#8A5A12',
  tertiary: '#C9852A',
  warning: '#B4741A',
  'primary-wash': '#EEF1F7',
  'danger-wash': '#FBEEEC',
  'success-wash': '#ECF3EF',
  'warning-wash': '#FBF3E4',
  'role-admin-bg': '#F3F0E9',
  'role-admin-ink': '#4B5563',
  'role-teacher-bg': '#EEF1F7',
  'role-teacher-ink': '#31456A',
  'role-student-bg': '#DCEBE6',
  'role-student-ink': '#1F6357',
  'on-primary': '#FFFFFF',
  'on-danger': '#FFFFFF',
  'on-success': '#FFFFFF',
  'on-fill': '#1F2937',
  'bar-bg': '#31456A',
  'bar-ink': '#FFFFFF',
  'bar-hover-bg': '#E3E3E6',
  'bar-hover-ink': '#1F2937',
  'bar-current-bg': '#FFFFFF',
  'bar-current-ink': '#31456A'
};

const dark = {
  surface: '#141317',
  paper: '#1C1B20',
  'paper-sunk': '#26242B',
  border: '#332F38',
  rule: '#2A2830',
  ink: '#E9E6E1',
  muted: '#A7A2AC',
  primary: '#A8BEE8',
  danger: '#F0948A',
  success: '#7CC7A2',
  'warning-text': '#E5B25C',
  'tertiary-text': '#E6BC72',
  tertiary: '#C9852A',        // does not move — a badge is a badge on either ground (§6)
  warning: '#B4741A',         // likewise
  'primary-wash': '#232A3A',
  'danger-wash': '#33211F',
  'success-wash': '#1D2E27',
  'warning-wash': '#302617',
  'role-admin-bg': '#26242B',
  'role-admin-ink': '#C3C0C8',
  'role-teacher-bg': '#232A3A',
  'role-teacher-ink': '#A8BEE8',
  'role-student-bg': '#17302B',
  'role-student-ink': '#7FCCB8',
  'on-primary': '#12151C',
  'on-danger': '#2A100C',
  'on-success': '#082016',
  'on-fill': '#1F2937',       // ink on the two ambers, which did not move either
  'bar-bg': '#1A1D25',
  'bar-ink': '#E9E6E1',
  'bar-hover-bg': '#2A2E38',
  'bar-hover-ink': '#E9E6E1',
  'bar-current-bg': '#2E3543',
  'bar-current-ink': '#A8BEE8'
};

/**
 * Every pair in the app where a colour carries a word, named for where it is read. `min`
 * defaults to AA text; a pair marked `fill` is a plane against a plane — its ratio is recorded
 * because it is the thing that replaces a shadow in dark, not because a word sits on it.
 */
const PAIRS = [
  // Body text, on each of the three grounds a sentence actually lands on.
  ['ink', 'surface', 'body text on the page'],
  ['ink', 'paper', 'body text on a card'],
  ['ink', 'paper-sunk', 'body text in a header band'],
  ['muted', 'surface', 'drafts and empty states on the page'],
  ['muted', 'paper', 'drafts and empty states on a card'],
  ['muted', 'paper-sunk', 'column labels in the header band'],

  // The semantic words.
  ['primary', 'surface', 'links on the page'],
  ['primary', 'paper', 'links on a card'],
  ['danger', 'surface', 'failed · refused · turned away'],
  ['danger', 'paper', 'failed · refused, on a card'],
  ['success', 'surface', 'passed · lesson open'],
  ['success', 'paper', 'passed · lesson open, on a card'],
  ['warning-text', 'surface', 'pending approval · not open yet'],
  ['warning-text', 'paper', 'pending approval, on a card'],
  ['tertiary-text', 'surface', "what's-new counts, the joining code"],
  ['tertiary-text', 'paper', "what's-new counts, on a card"],

  // Notices — the word on its own wash.
  ['danger', 'danger-wash', 'the notice that failed'],
  ['success', 'success-wash', 'the notice that passed'],
  ['warning-text', 'warning-wash', 'the notice that is pending'],

  // The two ambers, as fills with ink on top. This is the pairing §8 demoted them to, and the
  // reason --on-fill exists: --ink would put 2.2:1 on a badge the moment ink turns pale.
  ['on-fill', 'tertiary', 'ink on the tertiary badge', { min: AA_LARGE }],
  ['on-fill', 'warning', 'ink on the warning chip', { min: AA_LARGE }],

  // Role chips — a three-login demo, read from the back of the room.
  ['role-admin-ink', 'role-admin-bg', 'the admin chip'],
  ['role-teacher-ink', 'role-teacher-bg', 'the teacher chip'],
  ['role-student-ink', 'role-student-bg', 'the student chip'],

  // Filled controls: the label on the colour. This is where #fff stops being right in dark.
  ['on-primary', 'primary', 'the label on a filled primary button'],
  ['on-danger', 'danger', 'the destructive button and the error toast'],
  ['on-success', 'success', 'the success toast'],

  // The app bar, which needs its own pair because dark's primary is a light indigo.
  ['bar-ink', 'bar-bg', 'the app bar'],
  ['bar-current-ink', 'bar-current-bg', 'the current-page pill in the bar'],
  ['bar-hover-ink', 'bar-hover-bg', 'a hovered bar link'],

  // Planes. Recorded, not required: in dark these carry the job a shadow used to do.
  ['border', 'paper', 'the hairline that replaces a lost shadow', { fill: true }],
  ['paper', 'surface', 'a card against the page', { fill: true }],
  ['paper-sunk', 'paper', 'a sunk band against the card', { fill: true }]
];

// ---- WCAG 2.1 relative luminance and contrast ratio -------------------------

function channel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

// ---- The run ----------------------------------------------------------------

function check(name, palette) {
  const rows = [];
  let failures = 0;

  for (const [fg, bg, where, opts = {}] of PAIRS) {
    const min = opts.fill ? null : (opts.min ?? AA_TEXT);

    // A fill-only token on the text side of a pair is a failure whatever its ratio says.
    if (min !== null && FILL_ONLY.has(fg)) {
      rows.push({ fg, bg, where, value: '—', verdict: 'FILL-ONLY AS TEXT' });
      failures++;
      continue;
    }

    const a = palette[fg];
    const b = palette[bg];
    if (!a || !b) {
      rows.push({ fg, bg, where, value: '—', verdict: `MISSING (${!a ? fg : bg})` });
      failures++;
      continue;
    }

    const value = ratio(a, b);
    const pass = min === null || value >= min;
    if (!pass) failures++;
    rows.push({
      fg, bg, where,
      value: value.toFixed(2),
      verdict: min === null ? 'plane' : pass ? `ok >= ${min}` : `FAIL < ${min}`
    });
  }

  const width = Math.max(...rows.map(r => `${r.fg} on ${r.bg}`.length));
  console.log(`\n=== ${name.toUpperCase()} ===`);
  for (const r of rows) {
    const pair = `${r.fg} on ${r.bg}`.padEnd(width);
    console.log(`  ${pair}  ${String(r.value).padStart(6)}:1  ${r.verdict.padEnd(18)} ${r.where}`);
  }
  console.log(`  ${rows.length - failures}/${rows.length} pairs hold`);
  return failures;
}

// ---- The twelve avatar hues (§12) -------------------------------------------
// The tile is generated, not written down, so it cannot be a row in the table above: the check
// is that *every* hue clears AA, not that the one on screen happens to. hsl -> rgb, twelve times.

function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function checkAvatar(lightness) {
  const label = '#FFFFFF';
  let worst = { value: Infinity, hue: -1, hex: '' };
  for (let i = 0; i < 12; i++) {
    const hue = i * 30;
    const hex = hslHex(hue, 0.55, lightness);
    const value = ratio(label, hex);
    if (value < worst.value) worst = { value, hue, hex };
  }
  const pass = worst.value >= AA_TEXT;
  console.log(`\n=== AVATAR TILE (hsl(h 55% ${Math.round(lightness * 100)}%), both grounds) ===`);
  console.log(`  worst of twelve hues: ${worst.hex} at hue ${worst.hue} — ${worst.value.toFixed(2)}:1  ` +
    (pass ? `ok >= ${AA_TEXT}` : `FAIL < ${AA_TEXT}`));
  return pass ? 0 : 1;
}

const which = process.argv[2];
const grounds = which === 'light' ? [['light', light]]
  : which === 'dark' ? [['dark', dark]]
  : [['light', light], ['dark', dark]];

let failures = 0;
for (const [name, palette] of grounds) failures += check(name, palette);
failures += checkAvatar(0.30);

console.log(failures
  ? `\n${failures} pair(s) below the published threshold.\n`
  : '\nEvery published ratio holds.\n');
process.exit(failures ? 1 : 0);
