import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { PagedResult, ProblemDetails, TeacherStatus, TeacherSummary } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [DatePipe, MatTableModule, MatButtonModule, MatButtonToggleModule, MatChipsModule, StatePanelComponent],
  template: `
    <h1 class="app-heading">Teacher approvals</h1>

    <mat-button-toggle-group [value]="status()" (change)="setStatus($event.value)">
      <mat-button-toggle value="Pending">Pending</mat-button-toggle>
      <mat-button-toggle value="Approved">Approved</mat-button-toggle>
      <mat-button-toggle value="Rejected">Rejected</mat-button-toggle>
    </mat-button-toggle-group>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      [emptyMessage]="status() === 'Pending' ? 'Nobody is waiting right now.' : 'No teachers in this state yet.'">
      <table mat-table [dataSource]="rows() ?? []" class="full-width">
        <ng-container matColumnDef="fullName">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let row">{{ row.fullName }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let row">{{ row.email }}</td>
        </ng-container>
        <ng-container matColumnDef="createdAtUtc">
          <th mat-header-cell *matHeaderCellDef>Registered</th>
          <td mat-cell *matCellDef="let row">{{ row.createdAtUtc | date: 'mediumDate' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let row">
            @if (row.status === 'Pending') {
              <button mat-button color="primary" (click)="decide(row, 'approve')">Approve</button>
              <button mat-button color="warn" (click)="decide(row, 'reject')">Reject</button>
            } @else {
              <span class="text-muted">
                {{ row.status }} on {{ row.decidedAtUtc | date: 'mediumDate' }}
              </span>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </app-state-panel>

    @if (actionError()) {
      <p class="text-danger">{{ actionError() }}</p>
    }
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 1rem; }
    mat-button-toggle-group { margin-top: 1rem; }
  `]
})
export class ApprovalsComponent implements OnInit {
  columns = ['fullName', 'email', 'createdAtUtc', 'actions'];
  status = signal<TeacherStatus>('Pending');
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<TeacherSummary[] | null>(null);
  actionError = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  setStatus(status: TeacherStatus): void {
    this.status.set(status);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PagedResult<TeacherSummary>>(`/api/admin/teachers?status=${this.status()}&pageSize=100`).subscribe({
      next: (res) => { this.rows.set(res.items); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  decide(row: TeacherSummary, action: 'approve' | 'reject'): void {
    this.actionError.set(null);
    this.http.post(`/api/admin/teachers/${row.userId}/${action}`, {}).subscribe({
      next: () => this.load(),
      error: (err) => this.actionError.set(problemFrom(err).title ?? 'Something went wrong.')
    });
  }
}
