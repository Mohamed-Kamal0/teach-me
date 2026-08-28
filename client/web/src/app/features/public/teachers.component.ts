import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { TeacherCardComponent } from './teacher-card.component';
import { AuthService } from '../../core/auth.service';
import { CourseSummary, PagedResult, ProblemDetails, PublicTeacher } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

const PAGE_SIZE = 24;

/**
 * Who is teaching here — the app's first page that answers before anyone signs in. Everything on
 * it is an aggregate over a teacher's own course; nothing here names a student.
 */
@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    StatePanelComponent, TeacherCardComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Directory</span>
        <h1 class="app-heading">Teachers</h1>
        <p class="page-head__sub">Everyone teaching on the platform, and what they've published so far.</p>
      </div>
    </div>

    <!-- A search box over six cards is furniture; it appears once there is more than one page. -->
    @if (searchable()) {
      <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
        <mat-label>Search by name</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [ngModel]="query()" (ngModelChange)="onQuery($event)" autocomplete="off" />
      </mat-form-field>
    }

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="school" (retry)="load()" [emptyMessage]="emptyMessage()">
      <div class="grid">
        @for (t of rows(); track t.userId) {
          <app-teacher-card [teacher]="t" [enrolled]="enrolledIds().has(t.userId)"></app-teacher-card>
        }
      </div>

      @if (pageCount() > 1) {
        <nav class="pager" aria-label="Directory pages">
          <button mat-stroked-button [disabled]="page() === 1" (click)="goTo(page() - 1)">
            <mat-icon>chevron_left</mat-icon> Previous
          </button>
          <span class="pager__count tabular-nums">Page {{ page() }} of {{ pageCount() }}</span>
          <button mat-stroked-button [disabled]="page() === pageCount()" (click)="goTo(page() + 1)">
            Next <mat-icon>chevron_right</mat-icon>
          </button>
        </nav>
      }
    </app-state-panel>
  `,
  styles: [`
    .search { display: block; max-width: 22rem; margin-bottom: 1.25rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 1rem;
      align-items: stretch;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    .pager__count { color: var(--muted); font-size: var(--step--1); }
  `]
})
export class TeachersComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<PublicTeacher[] | null>(null);
  total = signal(0);
  page = signal(1);
  query = signal('');

  /** The teacher ids a signed-in student is already on. Empty for everyone else. */
  enrolledIds = signal<Set<string>>(new Set());

  private readonly typed = new Subject<string>();
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  constructor() {
    this.typed.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(value => {
      this.query.set(value);
      this.page.set(1);
      this.load();
    });
  }

  ngOnInit(): void {
    this.load();
    this.loadEnrolments();
  }

  /** True once the directory is bigger than one page — before that, searching is pointless. */
  searchable(): boolean {
    return this.total() > PAGE_SIZE || this.query().length > 0;
  }

  pageCount(): number {
    return Math.max(1, Math.ceil(this.total() / PAGE_SIZE));
  }

  emptyMessage(): string {
    return this.query()
      ? `No teacher matches "${this.query()}".`
      : 'No teachers have been approved yet.';
  }

  onQuery(value: string): void {
    this.typed.next(value);
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    const params = `page=${this.page()}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(this.query())}`;
    this.http.get<PagedResult<PublicTeacher>>(`/api/public/teachers?${params}`).subscribe({
      next: (res) => {
        this.rows.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  /** Only a student can be enrolled, and only this call can say so. If it fails, every card
   *  falls back to the "ask for a joining code" action — it never blocks the directory. */
  private loadEnrolments(): void {
    if (this.auth.role() !== 'Student') return;

    this.http.get<CourseSummary[]>('/api/student/courses').subscribe({
      next: (courses) => this.enrolledIds.set(new Set(courses.map(c => c.teacherUserId))),
      error: () => this.enrolledIds.set(new Set())
    });
  }
}
