import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ReleaseRailComponent } from '../../shared/release-rail.component';
import { Lesson, PagedResult, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-lessons-list',
  standalone: true,
  imports: [
    RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    StatePanelComponent, ReleaseRailComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your lessons</h1>
        <p class="page-head__sub">The arrows set the order students see. Each part opens on its own schedule.</p>
      </div>
      <div class="page-head__actions">
        <a mat-flat-button color="primary" routerLink="/teacher/lessons/new">
          <mat-icon>add</mat-icon> New lesson
        </a>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyIcon="menu_book" (retry)="load()"
      emptyMessage="No lessons yet. Add your first one to get started.">
      <div class="table-wrap">
        <table mat-table [dataSource]="rows() ?? []" class="data-table">
          <ng-container matColumnDef="order">
            <th mat-header-cell *matHeaderCellDef>#</th>
            <td mat-cell *matCellDef="let row" data-label="Order" class="tabular-nums">{{ row.orderIndex }}</td>
          </ng-container>
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Title</th>
            <td mat-cell *matCellDef="let row" data-label="Title" class="cell-title">{{ row.title }}</td>
          </ng-container>
          <ng-container matColumnDef="moments">
            <th mat-header-cell *matHeaderCellDef>Moments</th>
            <td mat-cell *matCellDef="let row" data-label="Moments" class="cell-rail">
              <app-release-rail [lesson]="row" [compact]="true"></app-release-rail>
            </td>
          </ng-container>
          <ng-container matColumnDef="reorder">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Reorder</span></th>
            <td mat-cell *matCellDef="let row; let i = index" data-label="">
              <button mat-icon-button [disabled]="i === 0" (click)="move(i, -1)" [attr.aria-label]="'Move ' + row.title + ' up'"><mat-icon>arrow_upward</mat-icon></button>
              <button mat-icon-button [disabled]="i === (rows()?.length ?? 1) - 1" (click)="move(i, 1)" [attr.aria-label]="'Move ' + row.title + ' down'"><mat-icon>arrow_downward</mat-icon></button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Actions</span></th>
            <td mat-cell *matCellDef="let row" data-label="">
              <a mat-button [routerLink]="['/teacher/lessons', row.id, 'edit']">Edit</a>
              <button mat-button class="danger-action" (click)="remove(row)">Delete</button>
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
    .cell-rail { min-width: 20rem; padding-block: 0.75rem; }
    .danger-action { color: var(--danger); }
    @media (max-width: 720px) {
      .cell-rail { min-width: 0; display: block; text-align: left; }
    }
  `]
})
export class LessonsListComponent implements OnInit {
  columns = ['order', 'title', 'moments', 'reorder', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<Lesson[] | null>(null);

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<PagedResult<Lesson>>('/api/teacher/lessons?pageSize=100').subscribe({
      next: (res) => { this.rows.set(res.items); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  move(index: number, direction: -1 | 1): void {
    const rows = this.rows();
    if (!rows) return;
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.rows.set(reordered);

    this.http.put('/api/teacher/lessons/order', { lessonIds: reordered.map(r => r.id) }).subscribe({
      next: () => this.load(),
      // A failure at the foot of a long table is a failure nobody reads, so it arrives over it.
      error: (err) => {
        this.notify.error(problemFrom(err).title ?? 'Could not change the order.');
        this.load();
      }
    });
  }

  remove(row: Lesson): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete this lesson?', message: `"${row.title}" will be removed permanently.` }
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.http.delete(`/api/teacher/lessons/${row.id}`).subscribe({
        next: () => { this.notify.success(`Deleted "${row.title}".`); this.load(); },
        error: (err) => this.notify.error(problemFrom(err).title ?? 'Could not delete this lesson.')
      });
    });
  }
}
