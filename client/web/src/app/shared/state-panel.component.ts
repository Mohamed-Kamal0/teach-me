import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ProblemDetails } from '../core/models';

/** Loading | error | empty — the three awkward states every list needs, in one place. */
@Component({
  selector: 'app-state-panel',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatIconModule],
  template: `
    @if (loading) {
      <div class="state state-loading">
        <mat-spinner diameter="32"></mat-spinner>
        <p>Loading…</p>
      </div>
    } @else if (error) {
      <div class="state state-error">
        <mat-icon class="text-danger">error_outline</mat-icon>
        <p>{{ error.title || "Something went wrong." }}</p>
      </div>
    } @else if (empty) {
      <div class="state state-empty">
        <mat-icon class="text-muted">info</mat-icon>
        <p>{{ emptyMessage }}</p>
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
      padding: 3rem 1rem;
      text-align: center;
      color: var(--muted);
    }
    .state mat-icon { font-size: 32px; width: 32px; height: 32px; }
  `]
})
export class StatePanelComponent {
  @Input() loading = false;
  @Input() error: ProblemDetails | null = null;
  @Input() empty = false;
  @Input() emptyMessage = 'Nothing here yet.';
}
