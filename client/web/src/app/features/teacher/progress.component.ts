import { Component, OnInit, inject, signal } from '@angular/core';
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
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Class progress</h1>
        <p class="page-head__sub">How far each student has been marked, and how those marks fell.</p>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="insights" (retry)="load()"
      emptyMessage="No students have joined yet, so there's nothing to show.">
      <div class="table-wrap">
        <table mat-table [dataSource]="rows() ?? []" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Student</th>
            <td mat-cell *matCellDef="let row" data-label="Student" class="cell-name">{{ row.fullName }}</td>
          </ng-container>
          <ng-container matColumnDef="progress">
            <th mat-header-cell *matHeaderCellDef>Lessons marked</th>
            <td mat-cell *matCellDef="let row" data-label="Marked">
              <div class="progress-cell">
                <mat-progress-bar mode="determinate" [value]="percent(row)"
                  [attr.aria-label]="row.fullName + ': ' + row.lessonsMarked + ' of ' + row.totalLessons + ' lessons marked'"></mat-progress-bar>
                <span class="tabular-nums">{{ row.lessonsMarked }} / {{ row.totalLessons }}</span>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="passed">
            <th mat-header-cell *matHeaderCellDef>Passed</th>
            <td mat-cell *matCellDef="let row" data-label="Passed" class="text-success tabular-nums">{{ row.passedCount }}</td>
          </ng-container>
          <ng-container matColumnDef="failed">
            <th mat-header-cell *matHeaderCellDef>Failed</th>
            <td mat-cell *matCellDef="let row" data-label="Failed" class="text-danger tabular-nums">{{ row.failedCount }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>
    </app-state-panel>
  `,
  styles: [`
    .cell-name { font-weight: 500; }
    .progress-cell { display: flex; align-items: center; gap: 0.75rem; min-width: 12rem; }
    .progress-cell mat-progress-bar { flex: 1; border-radius: 999px; }
    @media (max-width: 720px) {
      .progress-cell { min-width: 9rem; }
    }
  `]
})
export class ProgressComponent implements OnInit {
  columns = ['fullName', 'progress', 'passed', 'failed'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<ProgressRow[] | null>(null);

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PagedResult<ProgressRow>>('/api/teacher/progress?pageSize=100').subscribe({
      next: (res) => { this.rows.set(res.items); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  percent(row: ProgressRow): number {
    return row.totalLessons === 0 ? 0 : Math.round((row.lessonsMarked / row.totalLessons) * 100);
  }
}
