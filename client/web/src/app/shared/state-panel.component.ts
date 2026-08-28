import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BusyRingComponent } from './busy-ring.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProblemDetails } from '../core/models';

/** Loading | error | empty — the three awkward states every list needs, in one place. An error
 * here always offers the way out of it, because a screen that only says "no" is half a screen. */
@Component({
  selector: 'app-state-panel',
  standalone: true,
  imports: [BusyRingComponent, MatButtonModule, MatIconModule],
  template: `
    @if (loading) {
      <div class="state state-loading" role="status" aria-live="polite">
        <app-busy-ring size="32px" width="3px" class="state__ring"></app-busy-ring>
        <p>Loading…</p>
      </div>
    } @else if (error) {
      <div class="state state-error" role="alert">
        <span class="state__badge state__badge--danger">
          <mat-icon>{{ error.offline ? 'cloud_off' : 'error_outline' }}</mat-icon>
        </span>
        <p class="state__title">{{ error.title || "Something went wrong." }}</p>
        @if (error.detail) { <p class="state__detail">{{ error.detail }}</p> }
        @if (retry.observed) {
          <button mat-flat-button color="primary" (click)="retry.emit()">Try again</button>
        }
      </div>
    } @else if (empty) {
      <div class="state state-empty">
        <span class="state__badge">
          <mat-icon>{{ emptyIcon }}</mat-icon>
        </span>
        <p class="state__title">{{ emptyMessage }}</p>
        <ng-content select="[emptyAction]"></ng-content>
      </div>
    } @else {
      <ng-content></ng-content>
    }
  `,
  styles: [`
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: clamp(2rem, 6vw, 3.5rem) 1.25rem;
      text-align: center;
      color: var(--muted);
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      background: var(--paper);
    }
    .state__badge {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 999px;
      background: var(--paper-sunk);
      color: var(--muted);
    }
    .state__badge--danger { background: var(--danger-wash); color: var(--danger); }
    .state__badge mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .state__title { margin: 0; max-width: 34rem; font-size: var(--step-1); color: var(--ink); }
    .state-error .state__title { color: var(--danger); }
    .state__detail { margin: 0; max-width: 34rem; }
    /* The ring draws in currentColor, and the panel's text is deliberately muted — this
       is the one thing in it that should carry the app's own colour. */
    .state__ring { color: var(--primary); }
  `]
})
export class StatePanelComponent {
  @Input() loading = false;
  @Input() error: ProblemDetails | null = null;
  @Input() empty = false;
  @Input() emptyMessage = 'Nothing here yet.';
  @Input() emptyIcon = 'inbox';

  /** Bind this and the error state grows a "Try again" button; leave it and it doesn't. */
  @Output() retry = new EventEmitter<void>();
}
