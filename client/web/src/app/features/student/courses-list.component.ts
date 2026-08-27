import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { CourseSummary, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, StatePanelComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">Your courses</h1>
      </div>
      <div class="page-head__actions">
        <a mat-stroked-button routerLink="/student/join"><mat-icon>key</mat-icon> Join a course</a>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="school" (retry)="load()"
      emptyMessage="You're not on any course yet. Enter your teacher's joining code to get started.">
      <a emptyAction mat-flat-button color="primary" routerLink="/student/join">Enter a joining code</a>

      <div class="grid">
        @for (c of rows(); track c.teacherUserId) {
          <a [routerLink]="['/student/courses', c.teacherUserId]" class="course">
            <span class="course__mark"><mat-icon>school</mat-icon></span>
            <h2 class="course__name">{{ c.teacherFullName }}</h2>
            <p class="course__meta">Joined {{ c.joinedAtUtc | date: 'mediumDate' }}</p>
            <p class="course__count tabular-nums">
              {{ c.lessonCount }} lesson{{ c.lessonCount === 1 ? '' : 's' }} open
            </p>
          </a>
        }
      </div>
    </app-state-panel>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 1rem;
    }
    .course {
      display: block;
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow-1);
      color: inherit;
      text-decoration: none;
      transition: box-shadow 140ms ease, transform 140ms ease, border-color 140ms ease;
    }
    .course:hover, .course:focus-visible {
      border-color: var(--primary);
      box-shadow: var(--shadow-2);
      transform: translateY(-2px);
    }
    .course__mark {
      display: grid; place-items: center;
      width: 40px; height: 40px; border-radius: 999px;
      background: var(--primary-wash); color: var(--primary);
    }
    .course__name { font-size: var(--step-1); margin: 0.75rem 0 0.25rem; }
    .course__meta { margin: 0; color: var(--muted); font-size: var(--step--1); }
    .course__count {
      margin: 0.6rem 0 0;
      padding-top: 0.6rem;
      border-top: 1px solid var(--rule);
      color: var(--success);
      font-weight: 500;
    }
  `]
})
export class CoursesListComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<CourseSummary[] | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CourseSummary[]>('/api/student/courses').subscribe({
      next: (res) => { this.rows.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
