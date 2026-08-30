import { TestBed } from '@angular/core/testing';
import { THEME_KEY, ThemeService } from './theme.service';

/**
 * The four behaviours of docs/darkmode.md §3 that are not obvious from reading the service, plus
 * the storage that refuses to work at all. What is *not* here is any assertion that a screen
 * "looks right" dark — that is contrast arithmetic, and contrast.mjs does arithmetic.
 */
describe('ThemeService', () => {
  let listeners: ((e: MediaQueryListEvent) => void)[];
  let store: Record<string, string>;

  /** Stands in for the OS setting. Flip it with `osSaysDark(true)` *before* injecting. */
  let systemDark: boolean;

  function osSaysDark(dark: boolean): void {
    systemDark = dark;
  }

  /** Fires the media query the way the browser would when the OS changes mid-session. */
  function osFlipsTo(dark: boolean): void {
    systemDark = dark;
    listeners.forEach(fn => fn({ matches: dark } as MediaQueryListEvent));
  }

  function inject(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    return service;
  }

  beforeEach(() => {
    listeners = [];
    store = {};
    systemDark = false;

    spyOn(window, 'matchMedia').and.callFake((query: string) => ({
      matches: query.includes('dark') ? systemDark : false,
      media: query,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn),
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false
    } as unknown as MediaQueryList));

    spyOn(Storage.prototype, 'getItem').and.callFake((k: string) => store[k] ?? null);
    spyOn(Storage.prototype, 'setItem').and.callFake((k: string, v: string) => { store[k] = v; });
    spyOn(Storage.prototype, 'removeItem').and.callFake((k: string) => { delete store[k]; });

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the OS when nothing has been chosen', () => {
    osSaysDark(true);
    const theme = inject();

    expect(theme.choice()).toBe('system');
    expect(theme.resolved()).toBe('dark');
    // `system` leaves the attribute off entirely, so following the OS stays a CSS fact.
    expect(document.documentElement.hasAttribute('data-theme')).toBeFalse();
  });

  it('lets an explicit light choice win on a dark OS', () => {
    osSaysDark(true);
    const theme = inject();

    theme.set('light');
    TestBed.flushEffects();

    expect(theme.resolved()).toBe('light');
    // This is the case the `:not([data-theme="light"])` guard in _theme.scss exists for: without
    // the attribute, the media block would keep the page dark against the reader's wishes.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(store[THEME_KEY]).toBe('light');
  });

  it('treats a value it no longer understands as system rather than throwing', () => {
    store[THEME_KEY] = 'solarized';
    osSaysDark(false);

    expect(() => inject()).not.toThrow();
    expect(TestBed.inject(ThemeService).choice()).toBe('system');
  });

  it('follows the OS changing its mind only while the choice is system', () => {
    osSaysDark(false);
    const theme = inject();
    expect(theme.resolved()).toBe('light');

    osFlipsTo(true);
    expect(theme.resolved()).toBe('dark');

    theme.set('light');
    osFlipsTo(false);
    osFlipsTo(true);
    expect(theme.resolved()).toBe('light');

    // ...and it starts following again the moment the reader hands the decision back.
    theme.set('system');
    expect(theme.resolved()).toBe('dark');
  });

  it('still resolves a ground when localStorage throws on both accessors', () => {
    // Private windows and locked-down browsers raise on the accessor itself. The app renders
    // correctly with no stored value; it simply stops remembering, which is the right failure.
    (Storage.prototype.getItem as jasmine.Spy).and.throwError('denied');
    (Storage.prototype.setItem as jasmine.Spy).and.throwError('denied');
    (Storage.prototype.removeItem as jasmine.Spy).and.throwError('denied');
    osSaysDark(true);

    let theme!: ThemeService;
    expect(() => { theme = inject(); }).not.toThrow();
    expect(theme.resolved()).toBe('dark');

    expect(() => theme.set('light')).not.toThrow();
    TestBed.flushEffects();
    expect(theme.resolved()).toBe('light');
  });
});
