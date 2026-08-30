import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ListSearchComponent } from '../../shared/list-search.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { LessonMark, ProblemDetails, StudentProfile } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

/** Which verdicts the marks table is showing. */
type MarkResult = 'all' | 'passed' | 'failed';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule, MatButtonToggleModule, FormsModule, StatePanelComponent,
    ListSearchComponent, AvatarComponent
  ],
  template: `
    <a mat-stroked-button routerLink="/teacher/students" class="back-link"><mat-icon>arrow_back</mat-icon> Back to students</a>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (data(); as d) {
        <div class="page-head">
          <app-avatar size="lg" [userId]="d.userId" [name]="d.fullName" [photoETag]="d.photoETag"></app-avatar>
          <div class="page-head__text">
            <span class="eyebrow">Student</span>
            <h1 class="app-heading">{{ d.fullName }}</h1>
            <!-- Each fact is nullable on Student and commonly null, so each gets its own guard:
                 never a "Phone:" label with nothing after it. -->
            @if (d.displayName && d.displayName !== d.fullName) {
              <p class="page-head__alias">&ldquo;{{ d.displayName }}&rdquo;</p>
            }
            <p class="page-head__sub facts">
              <span>{{ d.email }}</span>
              @if (d.phone) {
                <span class="facts__sep" aria-hidden="true">·</span>
                <span>{{ d.phone }}</span>
              }
              <span class="facts__sep" aria-hidden="true">·</span>
              <span>Joined {{ d.joinedAtUtc | date: 'mediumDate' }}</span>
            </p>
          </div>
        </div>

        <div class="rollup">
          <mat-progress-bar mode="determinate" [value]="percent(d)"
            [attr.aria-label]="d.fullName + ': ' + d.lessonsMarked + ' of ' + d.totalLessons + ' lessons marked'"></mat-progress-bar>
          <p class="rollup__figures tabular-nums">
            <span>{{ d.lessonsMarked }} of {{ d.totalLessons }} lessons marked</span>
            <span class="facts__sep" aria-hidden="true">·</span>
            <span class="text-success">{{ d.passedCount }} passed</span>
            <span class="facts__sep" aria-hidden="true">·</span>
            <span class="text-danger">{{ d.failedCount }} failed</span>
          </p>
        </div>

        @if (d.bio) {
          <section class="about">
            <h2 class="section-title">About</h2>
            <p class="about__text">{{ d.bio }}</p>
          </section>
        }

        <h2 class="section-title">Marks</h2>

        @if (d.marks.length === 0) {
          <p class="text-muted">No marks recorded for this student yet.</p>
        } @else {
          <!-- Every mark this teacher has given this student is already on the page, so both
               controls narrow what is drawn rather than asking the server again. -->
          @if (d.marks.length > 1) {
            <div class="list-controls">
              <app-list-search placeholder="Search marks by lesson…"
                label="Search this student's marks by lesson title" (search)="onSearch($event)"></app-list-search>
              <div class="list-controls__filters">
                <mat-button-toggle-group [value]="result()" (change)="setResult($event.value)"
                  aria-label="Filter marks by result">
                  <mat-button-toggle value="all">All</mat-button-toggle>
                  <mat-button-toggle value="passed">Passed</mat-button-toggle>
                  <mat-button-toggle value="failed">Failed</mat-button-toggle>
                </mat-button-toggle-group>
              </div>
            </div>
          }

          @if (visibleMarks().length === 0) {
            <p class="text-muted">{{ noMatchMessage() }}</p>
          }

          <div class="table-wrap">
            <table mat-table [dataSource]="visibleMarks()" class="data-table">
              <ng-container matColumnDef="lessonTitle">
                <th mat-header-cell *matHeaderCellDef>Lesson</th>
                <td mat-cell *matCellDef="let row" data-label="Lesson" class="cell-title">{{ row.lessonTitle }}</td>
              </ng-container>
              <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef>Score</th>
                <td mat-cell *matCellDef="let row" data-label="Score">
                  @if (editingId() === row.markId) {
                    <mat-form-field appearance="outline" class="score-field" subscriptSizing="dynamic">
                      <input matInput type="number" [(ngModel)]="editScore" min="0" [max]="row.quizMaxScore"
                        [attr.aria-label]="'Score out of ' + row.quizMaxScore" />
                    </mat-form-field>
                    <span class="score-of tabular-nums">/ {{ row.quizMaxScore }}</span>
                  } @else {
                    <span class="tabular-nums">{{ row.score }} / {{ row.quizMaxScore }}</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="result">
                <th mat-header-cell *matHeaderCellDef>Result</th>
                <td mat-cell *matCellDef="let row" data-label="Result">
                  <span class="verdict" [class]="row.passed ? 'text-success' : 'text-danger'">
                    <mat-icon inline>{{ row.passed ? 'check_circle' : 'cancel' }}</mat-icon>
                    {{ row.passed ? 'Passed' : 'Failed' }} (pass mark {{ row.passMark }})
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef><span class="sr-only">Actions</span></th>
                <td mat-cell *matCellDef="let row" data-label="">
                  @if (editingId() === row.markId) {
                    <button mat-flat-button color="primary" (click)="save(row)" [disabled]="saving()">Save</button>
                    <button mat-button (click)="cancel()">Cancel</button>
                  } @else {
                    <button mat-button (click)="edit(row)">Correct</button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>
        }
      }
    </app-state-panel>
  `,
  styles: [`
    .back-link { margin-bottom: 1rem; }
    /* The identity block belongs beside the face, not pushed to the far edge by the default
       page-head's space-between. */
    .page-head { align-items: center; justify-content: flex-start; gap: 1.25rem; }
    .page-head__alias { margin: 0.1rem 0 0; color: var(--tertiary-text); font-style: italic; }
    .facts { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
    .facts__sep { color: var(--border); }

    .rollup {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 1.25rem 0 1.5rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--paper);
    }
    .rollup mat-progress-bar { border-radius: 999px; }
    .rollup__figures { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0; }

    .section-title { font-size: var(--step-1); margin: 0 0 0.6rem; }
    .about { margin-bottom: 1.5rem; }
    /* A bio is free text a student wrote; three lines is enough to recognise them by. */
    .about__text {
      margin: 0;
      color: var(--muted);
      max-width: 60ch;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .cell-title { font-weight: 500; }
    .score-field { width: 5.5rem; }
    .score-of { margin-left: 0.4rem; color: var(--muted); }
    .verdict { display: inline-flex; align-items: center; gap: 0.25rem; }
  `]
})
export class StudentDetailComponent implements OnInit {
  columns = ['lessonTitle', 'score', 'result', 'actions'];
  /** What the marks table is narrowed to — both applied here, over rows already in hand. */
  readonly query = signal('');
  readonly result = signal<MarkResult>('all');
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<StudentProfile | null>(null);
  editingId = signal<string | null>(null);
  saving = signal(false);
  editScore = 0;

  /** The marks on screen: the verdict first, then what was typed. */
  readonly visibleMarks = computed(() => {
    const marks = this.data()?.marks ?? [];
    const result = this.result();
    const term = this.query().toLocaleLowerCase();
    return marks.filter(m => {
      if (result === 'passed' && !m.passed) return false;
      if (result === 'failed' && m.passed) return false;
      return !term || m.lessonTitle.toLocaleLowerCase().includes(term);
    });
  });

  private studentId!: string;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private notify = inject(NotifyService);

  ngOnInit(): void {
    this.studentId = this.route.snapshot.paramMap.get('studentId')!;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<StudentProfile>(`/api/teacher/students/${this.studentId}`).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  noMatchMessage(): string {
    if (this.query()) return `No lesson matches "${this.query()}".`;
    return this.result() === 'passed'
      ? 'No passes among these marks.'
      : 'No failures among these marks.';
  }

  onSearch(term: string): void {
    this.query.set(term);
  }

  setResult(result: MarkResult): void {
    this.result.set(result);
  }

  /** Same arithmetic as the progress table's bar, off the same two numbers. */
  percent(d: StudentProfile): number {
    return d.totalLessons === 0 ? 0 : Math.round((d.lessonsMarked / d.totalLessons) * 100);
  }

  edit(row: LessonMark): void {
    this.editingId.set(row.markId);
    this.editScore = row.score;
  }

  cancel(): void {
    this.editingId.set(null);
  }

  save(row: LessonMark): void {
    // Checked here as well as on the server so an obvious slip is answered without a round trip.
    if (this.editScore < 0 || this.editScore > row.quizMaxScore) {
      this.notify.error(`A score for "${row.lessonTitle}" has to be between 0 and ${row.quizMaxScore}.`);
      return;
    }

    this.saving.set(true);
    this.http.put(`/api/teacher/marks/${row.markId}`, { score: this.editScore }).subscribe({
      next: () => {
        this.editingId.set(null);
        this.saving.set(false);
        this.notify.success(`Corrected the mark for "${row.lessonTitle}".`);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(problemFrom(err).title ?? 'Could not save the correction.');
      }
    });
  }
}
