import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

/**
 * The one search box in the app. It began on Discover and now sits above every list, because a
 * list long enough to scroll is a list somebody will want to search, and a second implementation
 * of "type, wait, ask" would be a second set of races to get right.
 *
 * A plain input rather than <mat-form-field>: an outlined field is drawn from three separate
 * outline segments, and every rounded-pill variant of it here was a stack of ::ng-deep overrides
 * that Material could move out from under at any release. The element below owes nothing to MDC,
 * so the pill is simply a pill. No <label>: the magnifier and the placeholder say what the box
 * is, and the aria-label says it to a screen reader.
 *
 * `search` fires with the committed term and never with the same term twice — typing settles
 * after 250ms, and the arrow and the Enter key skip that wait rather than duplicating it. What
 * the page does with a new term is start its list again from the top; a `CursorList` is built
 * for exactly that.
 */
@Component({
  selector: 'app-list-search',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="search">
      <mat-icon class="search__icon" aria-hidden="true">search</mat-icon>
      <input class="search__input" [ngModel]="draft()" (ngModelChange)="onType($event)"
        autocomplete="off" type="search" [placeholder]="placeholder()"
        [attr.aria-label]="label()" (keyup.enter)="searchNow()" />
      @if (draft()) {
        <button type="button" class="search__clear" aria-label="Clear the search" (click)="clear()">
          <mat-icon>close</mat-icon>
        </button>
      }
      <!-- Typing already searches, so this button is not the only way in — it is the way that
           skips the 250ms wait. An arrow rather than a second magnifier: the icon at the front
           of the box already said "search", and this one means "now". -->
      <button type="button" class="search__go" aria-label="Search now" (click)="searchNow()">
        <mat-icon>arrow_forward</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 26rem; }

    /* One control: a pill holding the magnifier, the text, and the two buttons. Everything sits
       *inside* the border, so nothing overhangs an edge that a narrow screen can cut off, and
       the box lines up with whatever it sits above. */
    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.3rem 0.35rem 0.3rem 0.85rem;
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: var(--shadow-1);
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    .search:hover { border-color: var(--primary); }

    /* The ring is drawn on the box rather than on the input, because the input's own outline
       would be drawn inside the pill. This is the field's focus indicator: hence the input
       suppressing its own below. */
    .search:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-wash);
    }

    .search__icon {
      flex: none;
      color: var(--muted);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .search__input {
      flex: 1 1 auto;
      min-width: 0;
      height: 2.25rem;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: var(--step-0);
    }
    .search__input:focus { outline: none; }
    .search__input::placeholder { color: var(--muted); }
    /* Chrome draws its own clear affordance on type="search"; ours is the one that resets the
       page as well as the box. */
    .search__input::-webkit-search-cancel-button { display: none; }

    .search__clear,
    .search__go {
      display: grid;
      place-items: center;
      flex: none;
      padding: 0;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease, transform 140ms ease;
    }
    .search__clear mat-icon,
    .search__go mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .search__clear {
      width: 2rem;
      height: 2rem;
      background: none;
      color: var(--muted);
    }
    .search__clear:hover { background: var(--paper-sunk); color: var(--ink); }

    .search__go {
      width: 2.25rem;
      height: 2.25rem;
      background: var(--primary);
      color: var(--on-primary);
    }
    /* --ink is body text, which on the dark ground is nearly white — hovering to it would turn
       the button into a bright square. --primary-wash darkens on that ground instead, so the
       hover stays a step away from the resting colour in the same direction on both. */
    .search__go:hover { background: var(--primary-wash); color: var(--primary); }
    .search__go:active { transform: scale(0.94); }
  `]
})
export class ListSearchComponent {
  readonly placeholder = input('Search…');
  /** What the box is, said to a screen reader — the placeholder is not read as a name. */
  readonly label = input('Search this list');

  /** The committed term. Fires only when it differs from the last one committed. */
  readonly search = output<string>();

  /** What is in the box right now. It leads the committed term by up to the debounce, which is
   *  exactly the gap the arrow and the Enter key exist to close. Public so a page can keep the
   *  controls on screen while a search that matched nothing is still in the box. */
  readonly draft = signal('');

  private term = '';
  private readonly typed = new Subject<string>();

  constructor() {
    this.typed.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(value => this.commit(value));
  }

  onType(value: string): void {
    this.draft.set(value);
    this.typed.next(value);
  }

  /** Pressing the arrow, or Enter, is somebody saying they have finished typing — so it goes now
   *  rather than 250ms from now. The debounced stream is left alone; the worst it can do is fire
   *  once more with the same term, which `commit` then drops. */
  searchNow(): void {
    this.commit(this.draft());
  }

  /** The debounce exists to hold off while somebody is still typing. Pressing clear is not
   *  typing, so it takes effect at once rather than 250ms after the box is already empty. */
  clear(): void {
    this.draft.set('');
    this.typed.next('');
    this.commit('');
  }

  private commit(value: string): void {
    const next = value.trim();
    if (next === this.term) return;
    this.term = next;
    this.search.emit(next);
  }
}
