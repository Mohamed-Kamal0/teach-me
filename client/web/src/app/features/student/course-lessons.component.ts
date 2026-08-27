import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { MediaEmbedComponent } from '../../shared/media-embed.component';
import { ReleaseRailComponent } from '../../shared/release-rail.component';
import { PagedResult, ProblemDetails, StudentLessonWithMark } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-course-lessons',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatIconModule, MatExpansionModule, StatePanelComponent,
    MediaEmbedComponent, ReleaseRailComponent
  ],
  template: `
    <a routerLink="/student/courses" class="back-link"><mat-icon inline>arrow_back</mat-icon> Back to courses</a>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="menu_book" (retry)="load()"
      emptyMessage="Your teacher hasn't opened anything here yet.">
      <mat-accordion multi>
        @for (item of rows(); track item.lesson.id) {
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
    </app-state-panel>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; margin-bottom: 1rem; }
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
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<StudentLessonWithMark[] | null>(null);

  private teacherId!: string;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId')!;
    this.load();
    // Marking the course seen is housekeeping — if it fails, nothing on this screen is wrong.
    this.http.post(`/api/student/courses/${this.teacherId}/seen`, {}).subscribe({ error: () => {} });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PagedResult<StudentLessonWithMark>>(`/api/student/courses/${this.teacherId}/lessons?pageSize=100`).subscribe({
      next: (res) => { this.rows.set(res.items); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
