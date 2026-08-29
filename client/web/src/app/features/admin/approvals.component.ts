import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ScrollMoreComponent } from '../../shared/scroll-more.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { CursorPage, TeacherStatus, TeacherSummary } from '../../core/models';
import { CursorList } from '../../core/cursor-list';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    DatePipe, MatTableModule, MatButtonModule, MatButtonToggleModule, MatIconModule, StatePanelComponent,
    ScrollMoreComponent, AvatarComponent
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

    <app-state-panel [loading]="list.loading()" [error]="list.error()" [empty]="list.rows().length === 0"
      emptyIcon="how_to_reg" (retry)="list.start()"
      [emptyMessage]="status() === 'Pending' ? 'Nobody is waiting right now.' : 'No teachers in this state yet.'">
      <div class="table-wrap">
        <table mat-table [dataSource]="list.rows()" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let row" data-label="Name" class="cell-name">
              <app-avatar size="sm" [userId]="row.userId" [name]="row.fullName" [photoETag]="row.photoETag"></app-avatar>
              <span>{{ row.fullName }}</span>
            </td>
          </ng-container>
          <!-- What they say they teach. Most of what an administrator has to decide on is here,
               so it sits beside the name rather than being something to go and look up. -->
          <ng-container matColumnDef="subject">
            <th mat-header-cell *matHeaderCellDef>Subject</th>
            <td mat-cell *matCellDef="let row" data-label="Subject">
              @if (row.subject) { {{ row.subject }} } @else { <span class="text-muted">—</span> }
            </td>
          </ng-container>
          <!-- The way to ask a question before deciding. The same number goes on the teacher's
               course card once they are approved, so what is checked here is what students get. -->
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let row" data-label="Phone" class="cell-phone">
              @if (row.phone) {
                <a [href]="'tel:' + row.phone">{{ row.phone }}</a>
              } @else {
                <span class="text-muted">—</span>
              }
            </td>
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

      <app-scroll-more [busy]="list.loadingMore()" [hasMore]="list.hasMore()"
        [error]="list.moreError()" (more)="list.more()"></app-scroll-more>
    </app-state-panel>
  `,
  styles: [`
    .cell-name { font-weight: 500; display: flex; align-items: center; gap: 0.6rem; }
    .cell-email { word-break: break-all; }
    /* A number is read in groups, so it must not be broken across a line the way an email may. */
    .cell-phone { white-space: nowrap; }
    .danger-action { color: var(--danger); }
    .decided { display: inline-flex; align-items: center; gap: 0.25rem; }
    @media (max-width: 560px) {
      mat-button-toggle-group { width: 100%; }
    }
  `]
})
export class ApprovalsComponent implements OnInit {
  columns = ['fullName', 'subject', 'phone', 'email', 'createdAtUtc', 'actions'];
  status = signal<TeacherStatus>('Pending');
  /** The teacher whose decision is in flight, so their two buttons can't be pressed twice. */
  deciding = signal<string | null>(null);

  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  readonly list = new CursorList<TeacherSummary>((cursor, limit) => {
    const params = new URLSearchParams({ status: this.status(), limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.http.get<CursorPage<TeacherSummary>>(`/api/admin/teachers?${params}`);
  });

  ngOnInit(): void {
    this.list.start();
  }

  /** Another tab is another list, so it starts from the top rather than re-reading this one. */
  setStatus(status: TeacherStatus): void {
    this.status.set(status);
    this.list.start();
  }

  decide(row: TeacherSummary, action: 'approve' | 'reject'): void {
    this.deciding.set(row.userId);
    this.http.post(`/api/admin/teachers/${row.userId}/${action}`, {}).subscribe({
      next: () => {
        this.deciding.set(null);
        // The row leaves the Pending list on success, so the toast is the only trace of what happened.
        this.notify.success(action === 'approve' ? `Approved ${row.fullName}.` : `Turned ${row.fullName} away.`);
        // The row leaves this tab, so what is on screen is re-read at its current length — an
        // administrator working down a queue keeps their place in it.
        this.list.refresh();
      },
      error: (err) => {
        this.deciding.set(null);
        this.notify.error(problemFrom(err).title ?? `Could not ${action} ${row.fullName}.`);
      }
    });
  }
}
