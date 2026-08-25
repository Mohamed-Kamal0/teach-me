import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { PagedResult, ProblemDetails, ProgressRow } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [MatTableModule, MatProgressBarModule, StatePanelComponent],
  template: `
    <h1 class="app-heading">Class progress</h1>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyMessage="No students have joined yet, so there's nothing to show.">
      <table mat-table [dataSource]="rows() ?? []" class="full-width">
        <ng-container matColumnDef="fullName">
          <th mat-header-cell *matHeaderCellDef>Student</th>
          <td mat-cell *matCellDef="let row">{{ row.fullName }}</td>
        </ng-container>
        <ng-container matColumnDef="progress">
          <th mat-header-cell *matHeaderCellDef>Lessons marked</th>
          <td mat-cell *matCellDef="let row">
            <div class="progress-cell">
              <mat-progress-bar mode="determinate" [value]="percent(row)"></mat-progress-bar>
              <span class="tabular-nums">{{ row.lessonsMarked }} / {{ row.totalLessons }}</span>
            </div>
          </td>
        </ng-container>
        <ng-container matColumnDef="passed">
          <th mat-header-cell *matHeaderCellDef>Passed</th>
          <td mat-cell *matCellDef="let row" class="text-success tabular-nums">{{ row.passedCount }}</td>
        </ng-container>
        <ng-container matColumnDef="failed">
          <th mat-header-cell *matHeaderCellDef>Failed</th>
          <td mat-cell *matCellDef="let row" class="text-danger tabular-nums">{{ row.failedCount }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </app-state-panel>
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 1rem; }
    .progress-cell { display: flex; align-items: center; gap: 0.75rem; min-width: 180px; }
    .progress-cell mat-progress-bar { flex: 1; }
  `]
})
export class ProgressComponent implements OnInit {
  columns = ['fullName', 'progress', 'passed', 'failed'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<ProgressRow[] | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<PagedResult<ProgressRow>>('/api/teacher/progress?pageSize=100').subscribe({
      next: (res) => { this.rows.set(res.items); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  percent(row: ProgressRow): number {
    return row.totalLessons === 0 ? 0 : Math.round((row.lessonsMarked / row.totalLessons) * 100);
  }
}
