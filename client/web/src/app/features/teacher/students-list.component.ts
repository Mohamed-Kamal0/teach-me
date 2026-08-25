import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { ProblemDetails, TeacherStudentsResponse } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-students-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, StatePanelComponent],
  template: `
    <div class="header">
      <h1 class="app-heading">Your students</h1>
      <a mat-flat-button color="primary" routerLink="/teacher/marks/new">
        <mat-icon>grade</mat-icon> Record a mark
      </a>
    </div>

    @if (data(); as d) {
      <p class="join-code">
        Your joining code: <strong class="text-tertiary tabular-nums">{{ d.joinCode }}</strong>
        <button mat-icon-button (click)="copyCode(d.joinCode)" aria-label="Copy joining code">
          <mat-icon>content_copy</mat-icon>
        </button>
      </p>
    }

    <app-state-panel [loading]="loading()" [error]="error()" [empty]="(data()?.students?.items?.length ?? 0) === 0"
      [emptyMessage]="'No students have joined yet. Share your code — ' + (data()?.joinCode ?? '') + ' — and they\\'ll appear here.'">
      <table mat-table [dataSource]="data()?.students?.items ?? []" class="full-width">
        <ng-container matColumnDef="fullName">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let row">{{ row.fullName }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let row">{{ row.email }}</td>
        </ng-container>
        <ng-container matColumnDef="joinedAtUtc">
          <th mat-header-cell *matHeaderCellDef>Joined</th>
          <td mat-cell *matCellDef="let row">{{ row.joinedAtUtc | date: 'mediumDate' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let row">
            <a mat-button [routerLink]="['/teacher/students', row.userId]">View grades</a>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns;"></tr>
      </table>
    </app-state-panel>
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 1rem; }
    .join-code { display: flex; align-items: center; gap: 0.25rem; }
    .header { display: flex; justify-content: space-between; align-items: center; }
  `]
})
export class StudentsListComponent implements OnInit {
  columns = ['fullName', 'email', 'joinedAtUtc', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<TeacherStudentsResponse | null>(null);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<TeacherStudentsResponse>('/api/teacher/students?pageSize=100').subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  copyCode(code: string): void {
    navigator.clipboard?.writeText(code);
  }
}
