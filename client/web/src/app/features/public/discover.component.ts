import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { TeacherCardComponent } from './teacher-card.component';
import { AuthService } from '../../core/auth.service';
import { CourseSummary, CursorPage, PublicTeacher } from '../../core/models';
import { CursorList } from '../../core/cursor-list';

/**
 * Discover — every course on the platform, and the teacher behind each one. It is the app's first
 * page that answers before anyone signs in, and it is named for what somebody does on it rather
 * than for the rows it happens to hold: a visitor arrives looking for a course to take, not for a
 * list of staff.
 *
 * Everything on it is about a teacher's own course — aggregates over it, and the number they
 * gave to be asked about it. Nothing here names a student.
 */
@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    StatePanelComponent, ScrollMoreComponent, ListSearchComponent, TeacherCardComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Discover</span>
        <h1 class="app-heading">Courses on Teach Me</h1>
        <p class="page-head__sub">Every course being taught here, and what each teacher has published so far.</p>
      </div>
    </div>

    <!-- The box searches names *and* subjects, which is why it appears as soon as there is more
         than one course to choose between: "who teaches chemistry" is a real question over six
         cards, where "which of these six is called Amina" was not. -->
    @if (searchable()) {
      <div class="list-controls">
        <app-list-search placeholder="Search by name or subject…"
          label="Search courses by teacher name or subject"
          (search)="onSearch($event)"></app-list-search>
      </div>
    }

    <!-- No pager. A visitor browsing courses is looking, not filing, and "page 3 of 7" asks them
         to keep a place they never wanted to keep — the cards simply carry on as they scroll. -->
    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="school" (retry)="list.start()" [emptyMessage]="emptyMessage()">
      <div class="grid">
        @for (t of list.rows(); track t.userId) {
          <app-teacher-card [teacher]="t" [enrolled]="enrolledIds().has(t.userId)"></app-teacher-card>
        }
      </div>

      <app-scroll-more [busy]="list.loadingMore()" [hasMore]="list.hasMore()"
        [error]="list.moreError()" (more)="list.more()"></app-scroll-more>
    </app-state-panel>
  `,
  styles: [`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr));
      gap: 1rem;
      align-items: stretch;
    }
  `]
})
export class DiscoverComponent implements OnInit {
  /** The term the rows on screen were fetched with. The box itself owns the half-typed one. */
  query = signal('');

  /** The teacher ids a signed-in student is already on. Empty for everyone else. */
  enrolledIds = signal<Set<string>>(new Set());

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly list = new CursorList<PublicTeacher>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit), q: this.query() });
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<PublicTeacher>>(`/api/public/teachers?${params}`);
  });

  ngOnInit(): void {
    this.list.start();
    this.loadEnrolments();
  }

  /** True once there is more than one course to tell apart — and always while a term is in
   *  force, so a search that matches nothing cannot take the box away with it. */
  searchable(): boolean {
    return this.list.total() > 1 || this.query().length > 0;
  }

  emptyMessage(): string {
    return this.query()
      ? `No course's subject or teacher name matches "${this.query()}".`
      : 'No courses have been published yet.';
  }

  /** A new term is a different list, so it starts from the top rather than re-reading this one. */
  onSearch(term: string): void {
    this.query.set(term);
    this.list.start();
  }

  /** Only a student can be enrolled, and only this call can say so. If it fails, every card
   *  falls back to the "ask for a joining code" action — it never blocks the page. */
  private loadEnrolments(): void {
    if (this.auth.role() !== 'Student') return;

    this.http.get<CourseSummary[]>('/api/student/courses').subscribe({
      next: (courses) => this.enrolledIds.set(new Set(courses.map(c => c.teacherUserId))),
      error: () => this.enrolledIds.set(new Set())
    });
  }
}
