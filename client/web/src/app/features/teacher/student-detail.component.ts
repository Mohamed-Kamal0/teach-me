import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { LessonMark, ProblemDetails, StudentGradeDetail } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, FormsModule, StatePanelComponent, AvatarComponent
  ],
  template: `
    <a routerLink="/teacher/students" class="back-link"><mat-icon inline>arrow_back</mat-icon> Back to students</a>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (data(); as d) {
        <div class="page-head">
          <app-avatar size="lg" [userId]="d.userId" [name]="d.fullName" [photoETag]="d.photoETag"></app-avatar>
          <div class="page-head__text">
            <span class="eyebrow">Student</span>
            <h1 class="app-heading">{{ d.fullName }}</h1>
            <p class="page-head__sub">{{ d.email }}</p>
          </div>
        </div>

        @if (d.marks.length === 0) {
          <p class="text-muted">No marks recorded for this student yet.</p>
        } @else {
          <div class="table-wrap">
            <table mat-table [dataSource]="d.marks" class="data-table">
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
    .back-link { display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; margin-bottom: 1rem; }
    .page-head { align-items: center; }
    .cell-title { font-weight: 500; }
    .score-field { width: 5.5rem; }
    .score-of { margin-left: 0.4rem; color: var(--muted); }
    .verdict { display: inline-flex; align-items: center; gap: 0.25rem; }
  `]
})
export class StudentDetailComponent implements OnInit {
  columns = ['lessonTitle', 'score', 'result', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<StudentGradeDetail | null>(null);
  editingId = signal<string | null>(null);
  saving = signal(false);
  editScore = 0;

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
    this.http.get<StudentGradeDetail>(`/api/teacher/students/${this.studentId}`).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
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
