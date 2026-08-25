import { Component, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { HelperAnswer } from '../../core/models';

@Component({
  selector: 'app-helper-widget',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    @if (open()) {
      <div class="panel">
        <div class="panel-header">
          <span class="app-heading">Helper</span>
          <button mat-icon-button (click)="open.set(false)" aria-label="Close helper"><mat-icon>close</mat-icon></button>
        </div>

        <div class="panel-body">
          @if (result(); as r) {
            @if (r.unknown) {
              <p>I don't know that one yet. Here's what I can help with:</p>
              <ul>
                @for (topic of r.knownTopics; track topic) { <li>{{ topic }}</li> }
              </ul>
            } @else {
              <p>{{ r.answer }}</p>
              @if (r.route) {
                <button mat-button color="primary" (click)="go(r.route)">Take me there</button>
              }
            }
          } @else {
            <p class="text-muted">Ask me something like "where are my results" or "how do I join a course".</p>
          }
        </div>

        <form class="panel-form" (ngSubmit)="ask()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ask a question</mat-label>
            <input matInput [(ngModel)]="question" name="question" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" [disabled]="!question.trim()">Ask</button>
        </form>
      </div>
    }

    <button mat-fab color="primary" class="fab" (click)="open.set(!open())" aria-label="Open helper">
      <mat-icon>help</mat-icon>
    </button>
  `,
  styles: [`
    .fab { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 20; }
    .panel {
      position: fixed; bottom: 5.5rem; right: 1.5rem; width: 320px; max-width: calc(100vw - 2rem);
      background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 20;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--primary); color: white; }
    .panel-body { padding: 1rem; min-height: 60px; }
    .panel-form { display: flex; gap: 0.5rem; padding: 0 1rem 1rem; align-items: flex-start; }
    .full-width { flex: 1; }
  `]
})
export class HelperWidgetComponent {
  open = signal(false);
  question = '';
  result = signal<HelperAnswer | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  ask(): void {
    if (!this.question.trim()) return;
    this.http.get<HelperAnswer>(`/api/helper/ask?q=${encodeURIComponent(this.question)}`).subscribe({
      next: (res) => this.result.set(res),
      error: () => this.result.set({ unknown: true, knownTopics: [] })
    });
  }

  go(route: string): void {
    this.open.set(false);
    this.router.navigateByUrl(route);
  }
}
