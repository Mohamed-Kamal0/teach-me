import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { MediaEmbedComponent } from '../../shared/media-embed.component';
import { ReleaseRailComponent } from '../../shared/release-rail.component';
import { CursorPage, StudentLessonWithMark } from '../../core/models';
import { CursorList } from '../../core/cursor-list';

/** Whether the list is showing every open lesson, or only the ones with a mark on them. */
type LessonMarkState = 'all' | 'marked' | 'unmarked';

@Component({
  selector: 'app-course-lessons',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatButtonModule, MatIconModule, MatExpansionModule,
    MatButtonToggleModule, StatePanelComponent, ScrollMoreComponent, ListSearchComponent,
    MediaEmbedComponent, ReleaseRailComponent
  ],
  template: `
    <a mat-stroked-button routerLink="/student/courses" class="back-link"><mat-icon>arrow_back</mat-icon> Back to courses</a>

    @if (controlsVisible()) {
      <div class="list-controls">
        <app-list-search placeholder="Search lessons by title…"
          label="Search this course by lesson title" (search)="onSearch($event)"></app-list-search>
        <div class="list-controls__filters">
          <!-- "Marked" is this student's own mark: the quizzes already returned, against the
               ones still to come back. -->
          <mat-button-toggle-group [value]="state()" (change)="setState($event.value)"
            aria-label="Filter lessons by whether they have been marked">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <mat-button-toggle value="marked">Marked</mat-button-toggle>
            <mat-button-toggle value="unmarked">Not marked</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>
    }

    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="menu_book" (retry)="list.start()"
      [emptyMessage]="emptyMessage()">
      <mat-accordion multi>
        @for (item of list.rows(); track item.lesson.id) {
          <mat-expansion-panel class="lesson">
            <mat-expansion-panel-header>
              <mat-panel-title class="lesson__title">{{ item.lesson.title }}</mat-panel-title>
              <mat-panel-description class="lesson__desc">
                @if (item.score !== null) {
                  <span class="verdict" [class]="item.passed ? 'text-success' : 'text-danger'">
                    <mat-icon inline>{{ item.passed ? 'check_circle' : 'cancel' }}</mat-icon>
                    {{ item.score }} / {{ item.lesson.quizMaxScore }} — {{ item.passed ? 'Passed' : 'Failed' }}
                  </span>
                }
              </mat-panel-description>
            </mat-expansion-panel-header>

            <!-- What has opened, and what has not yet, before anything else. -->
            <app-release-rail [lesson]="item.lesson"></app-release-rail>

            <app-media-embed [url]="item.lesson.recordingUrl"></app-media-embed>

            <div class="links">
              @if (item.lesson.handoutUrl) {
                <a [href]="item.lesson.handoutUrl" target="_blank" rel="noopener"><mat-icon inline>description</mat-icon> Handout</a>
              }
              @if (item.lesson.quizUrl) {
                <a [href]="item.lesson.quizUrl" target="_blank" rel="noopener"><mat-icon inline>quiz</mat-icon> Quiz</a>
              } @else if (item.lesson.quizOpensAtUtc) {
                <span class="text-warning"><mat-icon inline>lock_clock</mat-icon> Quiz opens {{ item.lesson.quizOpensAtUtc | date: 'medium' }}</span>
              }
              @if (item.lesson.answersUrl) {
                <a [href]="item.lesson.answersUrl" target="_blank" rel="noopener"><mat-icon inline>fact_check</mat-icon> Answers</a>
              } @else if (item.lesson.answersOpenAtUtc) {
                <span class="text-warning"><mat-icon inline>lock_clock</mat-icon> Answers open {{ item.lesson.answersOpenAtUtc | date: 'medium' }}</span>
              }
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>

      <app-scroll-more [busy]="list.loadingMore()" [hasMore]="list.hasMore()"
        [error]="list.moreError()" (more)="list.more()"></app-scroll-more>
    </app-state-panel>
  `,
  styles: [`
    .back-link { margin-bottom: 1rem; }
    .lesson { margin-bottom: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius) !important; }
    .lesson__title { font-family: 'Lora', Georgia, serif; font-weight: 600; }
    .lesson__desc { justify-content: flex-end; flex-grow: 0; }
    .verdict { display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap; }
    app-release-rail { display: block; margin-bottom: 1.25rem; }
    .links {
      display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem;
      padding-top: 1rem; border-top: 1px solid var(--rule);
    }
    .links a, .links span { display: inline-flex; align-items: center; gap: 0.25rem; text-decoration: none; }
    .links a { font-weight: 500; }
    @media (max-width: 560px) {
      /* The score would otherwise squeeze the lesson title down to an ellipsis. */
      .lesson__desc { display: none; }
    }
  `]
})
export class CourseLessonsComponent implements OnInit {
  /** What the rows on screen were fetched with. Both go to the server: the accordion holds one
   *  slice of the course, and a lesson further down it is still one the search has to find. */
  readonly query = signal('');
  readonly state = signal<LessonMarkState>('all');

  private teacherId!: string;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  readonly list = new CursorList<StudentLessonWithMark>((cursor, limit) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (this.query()) params.set('q', this.query());
    if (this.state() !== 'all') params.set('state', this.state());
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<StudentLessonWithMark>>(
      `/api/student/courses/${this.teacherId}/lessons?${params}`);
  });

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId')!;
    this.list.start();
    // Marking the course seen is housekeeping — if it fails, nothing on this screen is wrong.
    this.http.post(`/api/student/courses/${this.teacherId}/seen`, {}).subscribe({ error: () => {} });
  }

  controlsVisible(): boolean {
    return this.list.total() > 1 || this.query().length > 0 || this.state() !== 'all';
  }

  emptyMessage(): string {
    if (this.query()) return `No lesson's title matches "${this.query()}".`;
    if (this.state() === 'marked') return 'None of your quizzes here has been marked yet.';
    if (this.state() === 'unmarked') return 'Every lesson open to you has been marked.';
    return "Your teacher hasn't opened anything here yet.";
  }

  /** A new term, or a new filter, is a different list — so it starts from the top. */
  onSearch(term: string): void {
    this.query.set(term);
    this.list.start();
  }

  setState(state: LessonMarkState): void {
    this.state.set(state);
    this.list.start();
  }
}
