import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
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
    FormsModule, MatIconModule, StatePanelComponent, ScrollMoreComponent, TeacherCardComponent
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
      <!-- A plain input rather than <mat-form-field>: an outlined field is drawn from three
           separate outline segments, and every rounded-pill variant of it here was a stack of
           ::ng-deep overrides that Material could move out from under at any release. The
           element below owes nothing to MDC, so the pill is simply a pill. No <label>: the
           magnifier and the placeholder say what the box is, and the aria-label says it to a
           screen reader. -->
      <div class="search">
        <mat-icon class="search__icon" aria-hidden="true">search</mat-icon>
        <input class="search__input" [ngModel]="draft()" (ngModelChange)="onQuery($event)"
          autocomplete="off" type="search" placeholder="Search by name or subject…"
          aria-label="Search courses by teacher name or subject" (keyup.enter)="searchNow()" />
        @if (draft()) {
          <button type="button" class="search__clear" aria-label="Clear the search"
            (click)="clear()">
            <mat-icon>close</mat-icon>
          </button>
        }
        <!-- Typing already searches, so this button is not the only way in — it is the way that
             skips the 250ms wait. An arrow rather than a second magnifier: the icon at the front
             of the box already said "search", and this one means "now". -->
        <button type="button" class="search__go" aria-label="Search now" (click)="searchNow()">
          <mat-icon>arrow_forward</mat-icon>
        </button>
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
    /* One control: a pill holding the magnifier, the text, and the two buttons. Everything sits
       *inside* the border, so nothing overhangs an edge that a narrow screen can cut off, and
       the box lines up with the card grid below it. */
    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      max-width: 26rem;
      margin: 0 0 1.25rem;
      padding: 0.3rem 0.35rem 0.3rem 0.85rem;
      background: var(--paper);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: var(--shadow-1);
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    .search:hover { border-color: var(--primary); }

    /* The ring is drawn on the box rather than on the input, because the input's own outline
       would be drawn inside the pill. This is the field's focus indicator: hence the input
       suppressing its own below. */
    .search:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-wash);
    }

    .search__icon {
      flex: none;
      color: var(--muted);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .search__input {
      flex: 1 1 auto;
      min-width: 0;
      height: 2.25rem;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: var(--step-0);
    }
    .search__input:focus { outline: none; }
    .search__input::placeholder { color: var(--muted); }
    /* Chrome draws its own clear affordance on type="search"; ours is the one that resets the
       page as well as the box. */
    .search__input::-webkit-search-cancel-button { display: none; }

    .search__clear,
    .search__go {
      display: grid;
      place-items: center;
      flex: none;
      padding: 0;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease, transform 140ms ease;
    }
    .search__clear mat-icon,
    .search__go mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .search__clear {
      width: 2rem;
      height: 2rem;
      background: none;
      color: var(--muted);
    }
    .search__clear:hover { background: var(--paper-sunk); color: var(--ink); }

    .search__go {
      width: 2.25rem;
      height: 2.25rem;
      background: var(--primary);
      color: #fff;
    }
    .search__go:hover { background: var(--ink); }
    .search__go:active { transform: scale(0.94); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr));
      gap: 1rem;
      align-items: stretch;
    }
  `]
})
export class DiscoverComponent implements OnInit {
  /** The term the rows on screen were fetched with. */
  query = signal('');
  /** What is in the box right now. It leads `query` by up to the debounce, which is exactly the
   *  gap the button and the Enter key exist to close — both read this, never `query`. */
  draft = signal('');

  /** The teacher ids a signed-in student is already on. Empty for everyone else. */
  enrolledIds = signal<Set<string>>(new Set());

  private readonly typed = new Subject<string>();
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly list = new CursorList<PublicTeacher>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit), q: this.query() });
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<PublicTeacher>>(`/api/public/teachers?${params}`);
  });

  constructor() {
    this.typed.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(value => {
      // A term the button or the Enter key already sent: re-fetching it would answer the same
      // rows twice for one intention.
      if (value === this.query()) return;
      this.query.set(value);
      this.list.start();
    });
  }

  ngOnInit(): void {
    this.list.start();
    this.loadEnrolments();
  }

  /** True once there is more than one course to tell apart — and always while there is anything
   *  in the box, so a search that matches nothing cannot take the box away with it. */
  searchable(): boolean {
    return this.list.total() > 1 || this.draft().length > 0;
  }

  emptyMessage(): string {
    return this.query()
      ? `No course's subject or teacher name matches "${this.query()}".`
      : 'No courses have been published yet.';
  }

  onQuery(value: string): void {
    this.draft.set(value);
    this.typed.next(value);
  }

  /** Pressing the button, or Enter, is somebody saying they have finished typing — so it goes
   *  now rather than 250ms from now. The debounced stream is left alone; the worst it can do is
   *  fire once more with the same term, which the server answers identically. */
  searchNow(): void {
    if (this.draft() === this.query()) return;
    this.query.set(this.draft());
    this.list.start();
  }

  /** The debounce exists to hold off on a request while somebody is still typing. Pressing clear
   *  is not typing, so it takes effect at once rather than 250ms after the box is already empty. */
  clear(): void {
    if (!this.draft()) return;
    this.draft.set('');
    this.typed.next('');
    if (this.query() === '') return;
    this.query.set('');
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
