import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { MediaEmbedComponent } from '../../shared/media-embed.component';
import { ReleaseRailComponent } from '../../shared/release-rail.component';
import { Lesson, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

/** One row of the materials list: a link the teacher always has, and the moment students get it. */
interface Material {
  label: string;
  icon: string;
  url: string;
  open: boolean;
  opensAt: string | null;
}

/**
 * A lesson as its own teacher sees it — the recording playing, every link reachable, and beside
 * each one the moment a student gets it.
 *
 * The teacher's payload carries every URL whatever the clock says, so this page can never be a
 * rehearsal of the student's screen; what it shows instead is the gap between the two. `Open` and
 * `Not open` here are statements about students, and the page says so in as many words.
 */
@Component({
  selector: 'app-lesson-detail',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatButtonModule, MatIconModule, StatePanelComponent, MediaEmbedComponent,
    ReleaseRailComponent
  ],
  template: `
    <a mat-stroked-button routerLink="/teacher/lessons" class="back-link">
      <mat-icon>arrow_back</mat-icon> Back to lessons
    </a>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (lesson(); as l) {
        <div class="page-head">
          <div class="page-head__text">
            <span class="eyebrow">Lesson {{ l.orderIndex }}</span>
            <h1 class="app-heading">{{ l.title }}</h1>
            <p class="page-head__sub facts">
              <span>{{ l.durationMinutes }} min</span>
              <span class="facts__sep" aria-hidden="true">·</span>
              <span>Quiz out of {{ l.quizMaxScore }}, pass at {{ l.passMark }}</span>
            </p>
          </div>
          <div class="page-head__actions">
            <a mat-flat-button color="primary" [routerLink]="['/teacher/lessons', l.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit lesson
            </a>
          </div>
        </div>

        <app-release-rail [lesson]="l"></app-release-rail>

        @if (!l.lessonOpen) {
          <p class="notice notice--warning">
            <mat-icon>lock_clock</mat-icon>
            <span>
              @if (l.opensAtUtc) {
                No student can see this lesson yet. It opens {{ l.opensAtUtc | date: 'medium' }}.
              } @else {
                No student can see this lesson: it has no opening date, so it stays off their list.
              }
            </span>
          </p>
        }

        <h2 class="section-title">Recording</h2>
        <app-media-embed [url]="l.recordingUrl"></app-media-embed>

        <h2 class="section-title">Materials</h2>
        @if (materials().length === 0) {
          <p class="text-muted">No handout, quiz or answers on this lesson yet.</p>
        } @else {
          <ul class="materials">
            @for (m of materials(); track m.label) {
              <li class="material" [class.is-open]="m.open">
                <span class="material__node" aria-hidden="true"><mat-icon>{{ m.icon }}</mat-icon></span>
                <span class="material__text">
                  <a class="material__link" [href]="m.url" target="_blank" rel="noopener">{{ m.label }}</a>
                  @if (m.open) {
                    <span class="material__state text-success">Students can open this.</span>
                  } @else if (m.opensAt) {
                    <span class="material__state text-warning">Students get it {{ m.opensAt | date: 'medium' }}.</span>
                  } @else {
                    <span class="material__state text-warning">No date set, so students never get it.</span>
                  }
                </span>
                <mat-icon class="material__out" aria-hidden="true">open_in_new</mat-icon>
              </li>
            }
          </ul>
        }
      }
    </app-state-panel>
  `,
  styles: [`
    .back-link { margin-bottom: 1rem; }
    .facts { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
    .facts__sep { color: var(--border); }
    .section-title { font-family: 'Lora', Georgia, serif; font-size: var(--step-1); margin: 1.5rem 0 0.75rem; }
    app-release-rail { display: block; margin-bottom: 1rem; }
    .notice { margin-bottom: 1rem; }

    .materials { list-style: none; margin: 0; padding: 0; }
    .material {
      display: flex; align-items: center; gap: 0.85rem;
      padding: 0.75rem 0; border-bottom: 1px solid var(--rule);
    }
    .material:last-child { border-bottom: 0; }
    .material__node {
      display: grid; place-items: center; width: 32px; height: 32px; flex: none;
      border-radius: 999px; border: 2px solid var(--border); color: var(--muted); background: var(--surface);
    }
    .material.is-open .material__node {
      border-color: var(--success); background: var(--success-wash); color: var(--success);
    }
    .material__node mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .material__text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
    .material__link { font-weight: 500; text-decoration: none; }
    .material__state { font-size: var(--step--1); }
    .material__out { flex: none; color: var(--muted); font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class LessonDetailComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  lesson = signal<Lesson | null>(null);

  private id!: string;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  /** The handout has no gate of its own — it rides in with the lesson, so it takes the lesson's
   *  moment rather than one of its own. See LessonQueries.VisibleTo on the server. */
  readonly materials = computed<Material[]>(() => {
    const l = this.lesson();
    if (!l) return [];

    const rows: Material[] = [];
    if (l.handoutUrl) {
      rows.push({ label: 'Handout', icon: 'description', url: l.handoutUrl, open: !!l.lessonOpen, opensAt: l.opensAtUtc });
    }
    if (l.quizUrl) {
      rows.push({ label: 'Quiz', icon: 'quiz', url: l.quizUrl, open: !!l.quizOpen, opensAt: l.quizOpensAtUtc });
    }
    if (l.answersUrl) {
      rows.push({ label: 'Answers', icon: 'fact_check', url: l.answersUrl, open: !!l.answersOpen, opensAt: l.answersOpenAtUtc });
    }
    return rows;
  });

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')!;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<Lesson>(`/api/teacher/lessons/${this.id}`).subscribe({
      next: (l) => { this.lesson.set(l); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
