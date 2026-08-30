import { Injectable, computed, effect, signal } from '@angular/core';

/**
 * Light, dark, or whatever the device already decided.
 *
 * Two states would be simpler and would drop the only one that is actually a preference — "do
 * what my phone does at 9pm". Somebody who has never opened this menu gets the ground their OS
 * told every other app to use, and the menu says **System** rather than pretending they chose.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Read by index.html's boot classifier too. Changing it here changes it there. */
export const THEME_KEY = 'teachme.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The ground the app is painted on (docs/darkmode.md §3).
 *
 * The choice lives on the device, not on the account, and not in a cookie: the home page and the
 * public directory are read with no session at all, so a preference fetched from `/api/me` could
 * not reach the first page a visitor sees; and it is a property of the room rather than of the
 * person — the same student reads on a phone in bed and on a lab machine under fluorescent light.
 *
 * Applying it is one attribute on `<html>`. The stylesheet does the rest, which is why `system`
 * costs nothing: with no attribute at all the media query decides and this service is not
 * consulted.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** What the reader asked for. */
  readonly choice = signal<ThemeChoice>(readStored());

  /**
   * The media query, mirrored into a signal. It is attached once and for good, and read only
   * while the choice is `system` — detaching and reattaching it on every change is a
   * subscription to get wrong, and reading a signal is not.
   */
  private readonly systemPrefersDark = signal(matches(DARK_QUERY));

  /** The ground actually on screen. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const choice = this.choice();
    if (choice === 'system') return this.systemPrefersDark() ? 'dark' : 'light';
    return choice;
  });

  constructor() {
    const query = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null;
    query?.addEventListener('change', e => this.systemPrefersDark.set(e.matches));

    // Keeps `<html>` and the mobile browser chrome in step with the choice, including the first
    // run — where it agrees with what index.html's classifier already stamped, so nothing moves.
    effect(() => this.stamp(this.choice(), this.resolved()));
  }

  /**
   * The other ground. Flipping from `system` commits to the opposite of whatever the OS had
   * just resolved to, which is the only reading of "the other one" that matches what is on
   * screen at the moment of the press — and it is why this goes through `resolved` rather than
   * through `choice`.
   */
  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  /** Record a choice and repaint. Storage that refuses to hold it is not an error worth showing:
   *  the app renders correctly either way, it just stops remembering. */
  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      if (choice === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Private windows and locked-down browsers throw on the accessor itself.
    }
  }

  /**
   * `system` leaves the attribute off entirely rather than writing the resolved ground into it,
   * so following the OS stays a CSS fact that survives the OS changing its mind mid-session.
   */
  private stamp(choice: ThemeChoice, resolved: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);

    // The two <meta name="theme-color"> tags carry their own media queries, which is the right
    // answer while the choice is `system`. An explicit choice has to override both, or mobile
    // browser chrome stays on the ground the OS picked and the page stops matching its frame.
    for (const meta of Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))) {
      const ground = meta.dataset['ground'];
      if (!ground) continue;
      if (choice === 'system') meta.media = `(prefers-color-scheme: ${ground})`;
      else meta.media = ground === resolved ? 'all' : 'not all';
    }
  }
}

function matches(query: string): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** A value this code no longer understands degrades to the default. `localStorage` is
 *  user-writable and survives a deploy, so junk in it has to be a shrug and not a crash. */
function readStored(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Reading can throw for the same reasons writing can.
  }
  return 'system';
}
