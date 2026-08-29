import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { BusyRingComponent } from './busy-ring.component';
import { ProblemDetails } from '../core/models';

/**
 * The foot of an endlessly scrolling list: a tripwire that asks for the next slice, the ring
 * that shows one arriving, and the way back from one that didn't.
 *
 * The tripwire sits 600px below the last row rather than at it, so the request is already in
 * flight by the time the reader reaches the bottom and the list appears simply to continue. It
 * is removed while a slice is loading and while an error stands — an observer left watching
 * would fire again on every scroll event and ask for the same rows over and over.
 */
@Component({
  selector: 'app-scroll-more',
  standalone: true,
  imports: [MatButtonModule, BusyRingComponent],
  template: `
    @if (error(); as problem) {
      <div class="more more--error" role="alert">
        <p class="more__text">{{ problem.title || 'Could not load any more.' }}</p>
        <button mat-stroked-button (click)="more.emit()">Try again</button>
      </div>
    } @else if (busy()) {
      <div class="more" role="status" aria-live="polite">
        <app-busy-ring size="22px" width="2.5px" class="more__ring"></app-busy-ring>
        <span class="more__text">Loading more…</span>
      </div>
    }

    @if (hasMore() && !busy() && !error()) {
      <div #sentinel class="sentinel" aria-hidden="true"></div>
    }
  `,
  styles: [`
    .more {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.5rem 1rem;
      color: var(--muted);
      font-size: var(--step--1);
    }
    .more__text { margin: 0; }
    .more--error .more__text { color: var(--danger); }
    .more__ring { color: var(--primary); }
    /* Nothing to see: it exists to be crossed, and any height at all is enough for an
       observer that already reaches 600px past it. */
    .sentinel { height: 1px; }
  `]
})
export class ScrollMoreComponent {
  /** True while a later slice is in flight. */
  readonly busy = input(false);
  /** False once the list has handed out its last row — the tripwire goes with it. */
  readonly hasMore = input(false);
  /** A failed *later* slice. A failed first slice belongs to the state panel, not here. */
  readonly error = input<ProblemDetails | null>(null);

  readonly more = output<void>();

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    // Re-runs whenever the sentinel comes or goes, which is also every time a slice finishes
    // loading. That matters: on a short list the sentinel never leaves the viewport, and an
    // observer only reports a *change* in intersection — a fresh one reports the state it
    // finds, so the list keeps filling until it is taller than the screen or out of rows.
    effect((onCleanup) => {
      const element = this.sentinel()?.nativeElement;
      if (!element) return;

      const observer = new IntersectionObserver(
        entries => { if (entries.some(entry => entry.isIntersecting)) this.more.emit(); },
        { rootMargin: '600px 0px' });

      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
