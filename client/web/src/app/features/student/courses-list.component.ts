import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { CourseSummary, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-courses-list',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatButtonModule, MatIconModule, StatePanelComponent, ListSearchComponent
  ],
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

    <!-- The whole list is already here — a student is on a handful of courses, not a page of
         them — so the box narrows what is on screen rather than asking the server again. -->
    @if (controlsVisible()) {
      <div class="list-controls">
        <app-list-search placeholder="Search your courses by teacher…"
          label="Search your courses by teacher name" (search)="onSearch($event)"></app-list-search>
      </div>
    }

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="visible().length === 0"
      emptyIcon="school" (retry)="load()"
      [emptyMessage]="emptyMessage()">
      @if (!query()) {
        <a emptyAction mat-flat-button color="primary" routerLink="/student/join">Enter a joining code</a>
      }

      <div class="grid">
        @for (c of visible(); track c.teacherUserId) {
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
  /** What is in the search box, applied here rather than at the server. */
  readonly query = signal('');

  /** The cards on screen: every course, or the ones whose teacher matches what was typed. */
  readonly visible = computed(() => {
    const all = this.rows() ?? [];
    const term = this.query().toLocaleLowerCase();
    if (!term) return all;
    return all.filter(c => c.teacherFullName.toLocaleLowerCase().includes(term));
  });

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  controlsVisible(): boolean {
    return (this.rows()?.length ?? 0) > 1 || this.query().length > 0;
  }

  emptyMessage(): string {
    return this.query()
      ? `None of your courses is taught by anybody matching "${this.query()}".`
      : "You're not on any course yet. Enter your teacher's joining code to get started.";
  }

  onSearch(term: string): void {
    this.query.set(term);
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
