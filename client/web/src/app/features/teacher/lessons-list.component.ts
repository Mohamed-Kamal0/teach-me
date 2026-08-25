import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { Lesson, PagedResult, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-lessons-list',
  standalone: true,
  imports: [RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatDialogModule, StatePanelComponent],
  template: `
    <div class="header">
      <h1 class="app-heading">Your lessons</h1>
      <a mat-flat-button color="primary" routerLink="/teacher/lessons/new">
        <mat-icon>add</mat-icon> New lesson
      </a>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(rows()?.length ?? 0) === 0"
      emptyMessage="No lessons yet. Add your first one to get started.">
      <table mat-table [dataSource]="rows() ?? []" class="full-width">
        <ng-container matColumnDef="order">
          <th mat-header-cell *matHeaderCellDef>#</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.orderIndex }}</td>
        </ng-container>
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef>Title</th>
          <td mat-cell *matCellDef="let row">{{ row.title }}</td>
        </ng-container>
        <ng-container matColumnDef="moments">
          <th mat-header-cell *matHeaderCellDef>Moments</th>
          <td mat-cell *matCellDef="let row">
            <span class="moment" [class.is-open]="row.lessonOpen">
              <mat-icon inline>{{ row.lessonOpen ? 'check_circle' : 'lock_clock' }}</mat-icon>
              {{ row.lessonOpen ? 'Open' : 'Not open' }}
            </span>
            @if (row.quizUrl) {
              <span class="moment" [class.is-open]="row.quizOpen">
                <mat-icon inline>{{ row.quizOpen ? 'quiz' : 'lock_clock' }}</mat-icon>
                {{ row.quizOpen ? 'Quiz open' : 'Quiz not open' }}
              </span>
            }
            @if (row.answersUrl) {
              <span class="moment" [class.is-open]="row.answersOpen">
                <mat-icon inline>{{ row.answersOpen ? 'fact_check' : 'lock_clock' }}</mat-icon>
                {{ row.answersOpen ? 'Answers open' : 'Answers not open' }}
              </span>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="reorder">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let row; let i = index">
            <button mat-icon-button [disabled]="i === 0" (click)="move(i, -1)" aria-label="Move up"><mat-icon>arrow_upward</mat-icon></button>
            <button mat-icon-button [disabled]="i === (rows()?.length ?? 1) - 1" (click)="move(i, 1)" aria-label="Move down"><mat-icon>arrow_downward</mat-icon></button>
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let row">
            <a mat-button [routerLink]="['/teacher/lessons', row.id, 'edit']">Edit</a>
            <button mat-button color="warn" (click)="remove(row)">Delete</button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </app-state-panel>

    @if (actionError()) { <p class="text-danger">{{ actionError() }}</p> }
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .full-width { width: 100%; }
    .moment {
      display: inline-flex; align-items: center; gap: 0.2rem;
      margin-right: 0.75rem; font-size: 0.8rem; white-space: nowrap;
      color: var(--warning-text);
    }
    .moment.is-open { color: var(--success); }
  `]
})
export class LessonsListComponent implements OnInit {
  columns = ['order', 'title', 'moments', 'reorder', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  rows = signal<Lesson[] | null>(null);
  actionError = signal<string | null>(null);

  constructor(private http: HttpClient, private dialog: MatDialog) {}

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
      error: (err) => { this.actionError.set(problemFrom(err).title ?? 'Could not reorder.'); this.load(); }
    });
  }

  remove(row: Lesson): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete this lesson?', message: `"${row.title}" will be removed permanently.` }
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.actionError.set(null);
      this.http.delete(`/api/teacher/lessons/${row.id}`).subscribe({
        next: () => this.load(),
        error: (err) => this.actionError.set(problemFrom(err).title ?? 'Could not delete this lesson.')
      });
    });
  }
}
