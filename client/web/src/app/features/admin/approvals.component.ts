import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { PagedResult, ProblemDetails, TeacherStatus, TeacherSummary } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    DatePipe, MatTableModule, MatButtonModule, MatButtonToggleModule, MatIconModule, StatePanelComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Administrator</span>
        <h1 class="app-heading">Teacher approvals</h1>
        <p class="page-head__sub">A teacher can't publish anything until they're approved here.</p>
      </div>
      <div class="page-head__actions">
        <mat-button-toggle-group [value]="status()" (change)="setStatus($event.value)" aria-label="Filter by standing">
          <mat-button-toggle value="Pending">Pending</mat-button-toggle>
          <mat-button-toggle value="Approved">Approved</mat-button-toggle>
          <mat-button-toggle value="Rejected">Rejected</mat-button-toggle>
        </mat-button-toggle-group>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="how_to_reg" (retry)="load()"
      [emptyMessage]="status() === 'Pending' ? 'Nobody is waiting right now.' : 'No teachers in this state yet.'">
      <div class="table-wrap">
        <table mat-table [dataSource]="rows() ?? []" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let row" data-label="Name" class="cell-name">{{ row.fullName }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let row" data-label="Email" class="cell-email">{{ row.email }}</td>
          </ng-container>
          <ng-container matColumnDef="createdAtUtc">
            <th mat-header-cell *matHeaderCellDef>Registered</th>
            <td mat-cell *matCellDef="let row" data-label="Registered">{{ row.createdAtUtc | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Decision</span></th>
            <td mat-cell *matCellDef="let row" data-label="">
              @if (row.status === 'Pending') {
                <button mat-flat-button color="primary" (click)="decide(row, 'approve')" [disabled]="deciding() === row.userId">Approve</button>
                <button mat-button class="danger-action" (click)="decide(row, 'reject')" [disabled]="deciding() === row.userId">Reject</button>
              } @else {
                <span class="decided" [class]="row.status === 'Approved' ? 'text-success' : 'text-danger'">
                  <mat-icon inline>{{ row.status === 'Approved' ? 'check_circle' : 'block' }}</mat-icon>
                  {{ row.status }} on {{ row.decidedAtUtc | date: 'mediumDate' }}
                </span>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>
    </app-state-panel>
  `,
  styles: [`
    .cell-name { font-weight: 500; }
    .cell-email { word-break: break-all; }
    .danger-action { color: var(--danger); }
    .decided { display: inline-flex; align-items: center; gap: 0.25rem; }
    @media (max-width: 560px) {
      mat-button-toggle-group { width: 100%; }
    }
  `]
})
export class ApprovalsComponent implements OnInit {
  columns = ['fullName', 'email', 'createdAtUtc', 'actions'];
  status = signal<TeacherStatus>('Pending');
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<TeacherSummary[] | null>(null);
  /** The teacher whose decision is in flight, so their two buttons can't be pressed twice. */
  deciding = signal<string | null>(null);

  private http = inject(HttpClient);
  private notify = inject(NotifyService);

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
    this.deciding.set(row.userId);
    this.http.post(`/api/admin/teachers/${row.userId}/${action}`, {}).subscribe({
      next: () => {
        this.deciding.set(null);
        // The row leaves the Pending list on success, so the toast is the only trace of what happened.
        this.notify.success(action === 'approve' ? `Approved ${row.fullName}.` : `Turned ${row.fullName} away.`);
        this.load();
      },
      error: (err) => {
        this.deciding.set(null);
        this.notify.error(problemFrom(err).title ?? `Could not ${action} ${row.fullName}.`);
      }
    });
  }
}
