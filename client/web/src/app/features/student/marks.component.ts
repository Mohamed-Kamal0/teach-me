import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ProblemDetails, StudentMark } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-student-marks',
  standalone: true,
  imports: [MatTableModule, MatIconModule, StatePanelComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">Your marks</h1>
        <p class="page-head__sub">Every quiz your teachers have marked, newest course first.</p>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="grade" (retry)="load()"
      emptyMessage="No marks recorded yet. They appear here as your teacher marks each quiz.">
      <div class="table-wrap">
        <table mat-table [dataSource]="rows() ?? []" class="data-table">
          <ng-container matColumnDef="teacherFullName">
            <th mat-header-cell *matHeaderCellDef>Teacher</th>
            <td mat-cell *matCellDef="let row" data-label="Teacher">{{ row.teacherFullName }}</td>
          </ng-container>
          <ng-container matColumnDef="lessonTitle">
            <th mat-header-cell *matHeaderCellDef>Lesson</th>
            <td mat-cell *matCellDef="let row" data-label="Lesson" class="cell-title">{{ row.lessonTitle }}</td>
          </ng-container>
          <ng-container matColumnDef="score">
            <th mat-header-cell *matHeaderCellDef>Score</th>
            <td mat-cell *matCellDef="let row" data-label="Score" class="tabular-nums">{{ row.score }} / {{ row.quizMaxScore }}</td>
          </ng-container>
          <ng-container matColumnDef="result">
            <th mat-header-cell *matHeaderCellDef>Result</th>
            <td mat-cell *matCellDef="let row" data-label="Result">
              <span class="verdict" [class]="row.passed ? 'text-success' : 'text-danger'">
                <mat-icon inline>{{ row.passed ? 'check_circle' : 'cancel' }}</mat-icon>
                {{ row.passed ? 'Passed' : 'Failed' }}
              </span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>
    </app-state-panel>
  `,
  styles: [`
    .cell-title { font-weight: 500; }
    .verdict { display: inline-flex; align-items: center; gap: 0.25rem; }
  `]
})
export class StudentMarksComponent implements OnInit {
  columns = ['teacherFullName', 'lessonTitle', 'score', 'result'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<StudentMark[] | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<StudentMark[]>('/api/student/marks').subscribe({
      next: (res) => { this.rows.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
