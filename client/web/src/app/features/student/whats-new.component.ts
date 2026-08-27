import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ProblemDetails, WhatsNewResponse } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, StatePanelComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">What's new</h1>
        <p class="page-head__sub">Everything your teachers opened since you last looked.</p>
      </div>
      @if (data(); as d) {
        @if (d.totalNew > 0) {
          <p class="tally">
            <mat-icon>celebration</mat-icon>
            <strong class="tabular-nums">{{ d.totalNew }}</strong> new since you last looked
          </p>
        }
      }
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(data()?.courses?.length ?? 0) === 0"
      emptyIcon="celebration" (retry)="load()"
      emptyMessage="You're not on any course yet. Enter a joining code to get started.">
      <a emptyAction mat-flat-button color="primary" routerLink="/student/join">Enter a joining code</a>

      <div class="courses">
        @for (c of data()?.courses; track c.teacherUserId) {
          <article class="course">
            <h2 class="course__name">{{ c.teacherFullName }}</h2>

            @if (c.welcome) {
              <p class="text-tertiary course__line">Welcome! Open this course to see what's inside.</p>
            } @else if (c.newItems.length === 0) {
              <p class="text-muted course__line">Nothing new here since you last looked.</p>
            } @else {
              <ul class="items">
                @for (item of c.newItems; track item.lessonId + item.kind) {
                  <li class="item">
                    <mat-icon class="item__icon" inline>{{ kindIcon(item.kind) }}</mat-icon>
                    <span><strong>{{ item.lessonTitle }}</strong> — {{ kindLabel(item.kind) }}</span>
                  </li>
                }
              </ul>
            }

            <a mat-stroked-button [routerLink]="['/student/courses', c.teacherUserId]">Open course</a>
          </article>
        }
      </div>
    </app-state-panel>
  `,
  styles: [`
    .tally {
      display: flex; align-items: center; gap: 0.4rem; margin: 0;
      padding: 0.4rem 0.8rem; border-radius: 999px;
      background: var(--warning-wash); color: var(--tertiary-text); font-weight: 500;
    }
    .tally strong { font-family: 'Lora', Georgia, serif; font-size: var(--step-1); }
    .courses { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 1rem; }
    .course {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem;
      padding: 1.25rem; border: 1px solid var(--border); border-radius: var(--radius);
      background: var(--paper); box-shadow: var(--shadow-1);
    }
    .course__name { font-size: var(--step-1); margin: 0; }
    .course__line { margin: 0; font-size: var(--step--1); }
    .items { list-style: none; margin: 0; padding: 0; width: 100%; }
    .item {
      display: flex; align-items: baseline; gap: 0.45rem;
      padding: 0.4rem 0; border-bottom: 1px solid var(--rule); font-size: var(--step--1);
    }
    .item:last-child { border-bottom: 0; }
    .item__icon { color: var(--tertiary-text); }
    .course a { margin-top: auto; }
  `]
})
export class WhatsNewComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<WhatsNewResponse | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<WhatsNewResponse>('/api/student/whats-new').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'lesson': return 'lesson opened';
      case 'quiz': return 'quiz opened';
      case 'answers': return 'answers released';
      default: return kind;
    }
  }

  /** One icon per concept, the same one the rest of the app uses for it (plan §8). */
  kindIcon(kind: string): string {
    switch (kind) {
      case 'lesson': return 'play_circle';
      case 'quiz': return 'quiz';
      case 'answers': return 'fact_check';
      default: return 'circle';
    }
  }
}
