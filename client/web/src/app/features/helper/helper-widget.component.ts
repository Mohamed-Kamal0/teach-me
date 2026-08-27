import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HelperAnswer } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-helper-widget',
  standalone: true,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    @if (open()) {
      <div class="panel" role="dialog" aria-label="Helper">
        <div class="panel-header">
          <span class="app-heading">Helper</span>
          <button mat-icon-button (click)="open.set(false)" aria-label="Close helper"><mat-icon>close</mat-icon></button>
        </div>

        <div class="panel-body" aria-live="polite">
          @if (asking()) {
            <div class="thinking"><mat-spinner diameter="20"></mat-spinner><span>Looking…</span></div>
          } @else if (failure()) {
            <!-- A helper that answers "I don't know that one" when the API is down is lying about
                 whose fault it is, and sends the reader looking for a better question. -->
            <p class="notice notice--danger" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ failure() }}</span>
            </p>
            <button mat-button color="primary" (click)="ask()">Try again</button>
          } @else {
            @if (result(); as r) {
              @if (r.unknown) {
                <p>I don't know that one yet. Here's what I can help with:</p>
                <ul class="topics">
                  @for (topic of r.knownTopics; track topic) { <li>{{ topic }}</li> }
                </ul>
              } @else {
                <p>{{ r.answer }}</p>
                @if (r.route) {
                  <button mat-flat-button color="primary" (click)="go(r.route)">Take me there</button>
                }
              }
            } @else {
              <p class="text-muted">Ask me something like "where are my results" or "how do I join a course".</p>
            }
          }
        </div>

        <form class="panel-form" (ngSubmit)="ask()">
          <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
            <mat-label>Ask a question</mat-label>
            <input matInput [(ngModel)]="question" name="question" autocomplete="off" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" [disabled]="!question.trim() || asking()">Ask</button>
        </form>
      </div>
    }

    <button mat-fab color="primary" class="fab" (click)="open.set(!open())"
      [attr.aria-label]="open() ? 'Close helper' : 'Open helper'" [attr.aria-expanded]="open()">
      <mat-icon>{{ open() ? 'close' : 'help' }}</mat-icon>
    </button>
  `,
  styles: [`
    .fab { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 20; }
    .panel {
      position: fixed; bottom: 5.5rem; right: 1.5rem; width: 21rem;
      max-width: calc(100vw - 2rem); max-height: min(30rem, calc(100dvh - 8rem));
      background: var(--paper); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow-2); z-index: 20;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.6rem 0.5rem 0.6rem 1rem; background: var(--primary); color: white;
    }
    .panel-header button { color: white; }
    .panel-body { padding: 1rem; min-height: 60px; overflow-y: auto; flex: 1; }
    .panel-body p:last-of-type { margin-bottom: 0; }
    .thinking { display: flex; align-items: center; gap: 0.5rem; color: var(--muted); }
    .topics { margin: 0.5rem 0 0; padding-left: 1.1rem; color: var(--muted); font-size: var(--step--1); }
    .panel-form { display: flex; gap: 0.5rem; padding: 0.75rem 1rem 1rem; align-items: center; border-top: 1px solid var(--rule); }
    .full-width { flex: 1; }

    /* On a phone the panel is a sheet: a 21rem card floating over a 20rem screen is a card
       nobody can read or dismiss. */
    @media (max-width: 480px) {
      .panel {
        right: 0; left: 0; bottom: 0; width: auto; max-width: none;
        max-height: 80dvh; border-radius: var(--radius) var(--radius) 0 0;
      }
      .fab { bottom: 1rem; right: 1rem; }
    }
  `]
})
export class HelperWidgetComponent {
  open = signal(false);
  question = '';
  result = signal<HelperAnswer | null>(null);
  asking = signal(false);
  /** Set only when the request itself failed — never when the helper simply has no answer. */
  failure = signal<string | null>(null);

  private http = inject(HttpClient);
  private router = inject(Router);

  ask(): void {
    const question = this.question.trim();
    if (!question || this.asking()) return;

    this.asking.set(true);
    this.failure.set(null);
    this.http.get<HelperAnswer>(`/api/helper/ask?q=${encodeURIComponent(question)}`).subscribe({
      next: (res) => { this.result.set(res); this.asking.set(false); },
      error: (err) => {
        this.result.set(null);
        this.failure.set(problemFrom(err).title ?? 'Something went wrong. Try again.');
        this.asking.set(false);
      }
    });
  }

  go(route: string): void {
    this.open.set(false);
    this.router.navigateByUrl(route);
  }
}
