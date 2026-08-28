import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { ProblemDetails, TeacherStudentsResponse } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, StatePanelComponent, AvatarComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your students</h1>
      </div>
      <div class="page-head__actions">
        <a mat-flat-button color="primary" routerLink="/teacher/marks/new">
          <mat-icon>grade</mat-icon> Record a mark
        </a>
      </div>
    </div>

    @if (data(); as d) {
      <!-- The code a teacher reads out loud, set large enough to read from the back of a room. -->
      <div class="join-code">
        <p class="join-code__row">
          Your joining code: <strong class="join-code__value tabular-nums">{{ d.joinCode }}</strong>
          <button mat-icon-button (click)="copyCode(d.joinCode)" aria-label="Copy the joining code">
            <mat-icon>content_copy</mat-icon>
          </button>
        </p>
        <p class="join-code__note">Students enter this on their Join screen to appear here.</p>
      </div>
    }

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(data()?.students?.items?.length ?? 0) === 0"
      emptyIcon="group" (retry)="load()"
      [emptyMessage]="'No students have joined yet. Share your code — ' + (data()?.joinCode ?? '') + ' — and they\\'ll appear here.'">
      <div class="table-wrap">
        <table mat-table [dataSource]="data()?.students?.items ?? []" class="data-table">
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let row" data-label="Name" class="cell-name">
              <app-avatar size="sm" [userId]="row.userId" [name]="row.fullName" [photoETag]="row.photoETag"></app-avatar>
              <span>{{ row.fullName }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let row" data-label="Email" class="cell-email">{{ row.email }}</td>
          </ng-container>
          <ng-container matColumnDef="joinedAtUtc">
            <th mat-header-cell *matHeaderCellDef>Joined</th>
            <td mat-cell *matCellDef="let row" data-label="Joined">{{ row.joinedAtUtc | date: 'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Actions</span></th>
            <td mat-cell *matCellDef="let row" data-label="">
              <a mat-button [routerLink]="['/teacher/students', row.userId]">View grades</a>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </div>
    </app-state-panel>
  `,
  styles: [`
    .join-code {
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border);
      border-left: 4px solid var(--tertiary);
      border-radius: var(--radius);
      background: var(--paper);
    }
    .join-code__row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin: 0; }
    .join-code__value {
      font-family: 'Lora', Georgia, serif;
      font-size: var(--step-2);
      letter-spacing: 0.18em;
      color: var(--tertiary-text);
    }
    .join-code__note { margin: 0.25rem 0 0; color: var(--muted); font-size: var(--step--1); }
    .cell-name { font-weight: 500; display: flex; align-items: center; gap: 0.6rem; }
    .cell-email { word-break: break-all; }
  `]
})
export class StudentsListComponent implements OnInit {
  columns = ['fullName', 'email', 'joinedAtUtc', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<TeacherStudentsResponse | null>(null);

  private http = inject(HttpClient);
  private notify = inject(NotifyService);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<TeacherStudentsResponse>('/api/teacher/students?pageSize=100').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  async copyCode(code: string): Promise<void> {
    // The clipboard is refused outright over plain HTTP and in some embedded browsers, and a
    // copy button that silently does nothing is worse than one that admits it.
    try {
      await navigator.clipboard.writeText(code);
      this.notify.success(`Copied ${code}.`);
    } catch {
      this.notify.error(`Couldn't copy. Your code is ${code} — write it down or select it.`);
    }
  }
}
