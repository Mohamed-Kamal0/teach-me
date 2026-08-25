import { Component, OnInit, signal } from '@angular/core';
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
    <h1 class="app-heading">Your marks</h1>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyMessage="No marks recorded yet.">
      <table mat-table [dataSource]="rows() ?? []" class="full-width">
        <ng-container matColumnDef="teacherFullName">
          <th mat-header-cell *matHeaderCellDef>Teacher</th>
          <td mat-cell *matCellDef="let row">{{ row.teacherFullName }}</td>
        </ng-container>
        <ng-container matColumnDef="lessonTitle">
          <th mat-header-cell *matHeaderCellDef>Lesson</th>
          <td mat-cell *matCellDef="let row">{{ row.lessonTitle }}</td>
        </ng-container>
        <ng-container matColumnDef="score">
          <th mat-header-cell *matHeaderCellDef>Score</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.score }} / {{ row.quizMaxScore }}</td>
        </ng-container>
        <ng-container matColumnDef="result">
          <th mat-header-cell *matHeaderCellDef>Result</th>
          <td mat-cell *matCellDef="let row">
            <span [class]="row.passed ? 'text-success' : 'text-danger'">
              <mat-icon inline>{{ row.passed ? 'check_circle' : 'cancel' }}</mat-icon>
              {{ row.passed ? 'Passed' : 'Failed' }}
            </span>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </app-state-panel>
  `,
  styles: [`.full-width { width: 100%; margin-top: 1rem; }`]
})
export class StudentMarksComponent implements OnInit {
  columns = ['teacherFullName', 'lessonTitle', 'score', 'result'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<StudentMark[] | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<StudentMark[]>('/api/student/marks').subscribe({
      next: (res) => { this.rows.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }
}
