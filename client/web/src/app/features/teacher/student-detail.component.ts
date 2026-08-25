import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { LessonMark, ProblemDetails, StudentGradeDetail } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, FormsModule, StatePanelComponent],
  template: `
    <a routerLink="/teacher/students" class="back-link"><mat-icon inline>arrow_back</mat-icon> Back to students</a>

    <app-state-panel [loading]="loading()" [error]="error()">
      @if (data(); as d) {
        <h1 class="app-heading">{{ d.fullName }}</h1>
        <p class="text-muted">{{ d.email }}</p>

        @if (d.marks.length === 0) {
          <p class="text-muted">No marks recorded for this student yet.</p>
        } @else {
          <table mat-table [dataSource]="d.marks" class="full-width">
            <ng-container matColumnDef="lessonTitle">
              <th mat-header-cell *matHeaderCellDef>Lesson</th>
              <td mat-cell *matCellDef="let row">{{ row.lessonTitle }}</td>
            </ng-container>
            <ng-container matColumnDef="score">
              <th mat-header-cell *matHeaderCellDef>Score</th>
              <td mat-cell *matCellDef="let row">
                @if (editingId() === row.markId) {
                  <mat-form-field appearance="outline" class="score-field">
                    <input matInput type="number" [(ngModel)]="editScore" />
                  </mat-form-field>
                } @else {
                  <span class="tabular-nums">{{ row.score }} / {{ row.quizMaxScore }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="result">
              <th mat-header-cell *matHeaderCellDef>Result</th>
              <td mat-cell *matCellDef="let row">
                <span [class]="row.passed ? 'text-success' : 'text-danger'">
                  <mat-icon inline>{{ row.passed ? 'check_circle' : 'cancel' }}</mat-icon>
                  {{ row.passed ? 'Passed' : 'Failed' }} (pass mark {{ row.passMark }})
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                @if (editingId() === row.markId) {
                  <button mat-button color="primary" (click)="save(row)">Save</button>
                  <button mat-button (click)="cancel()">Cancel</button>
                } @else {
                  <button mat-button (click)="edit(row)">Correct</button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>
          </table>
        }

        @if (actionError()) { <p class="text-danger">{{ actionError() }}</p> }
      }
    </app-state-panel>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; margin-bottom: 1rem; }
    .full-width { width: 100%; margin-top: 1rem; }
    .score-field { width: 90px; }
  `]
})
export class StudentDetailComponent implements OnInit {
  columns = ['lessonTitle', 'score', 'result', 'actions'];
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  data = signal<StudentGradeDetail | null>(null);
  actionError = signal<string | null>(null);
  editingId = signal<string | null>(null);
  editScore = 0;

  private studentId!: string;

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.studentId = this.route.snapshot.paramMap.get('studentId')!;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<StudentGradeDetail>(`/api/teacher/students/${this.studentId}`).subscribe({
      next: (res) => { this.data.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  edit(row: LessonMark): void {
    this.editingId.set(row.markId);
    this.editScore = row.score;
    this.actionError.set(null);
  }

  cancel(): void {
    this.editingId.set(null);
  }

  save(row: LessonMark): void {
    this.http.put(`/api/teacher/marks/${row.markId}`, { score: this.editScore }).subscribe({
      next: () => { this.editingId.set(null); this.load(); },
      error: (err) => this.actionError.set(problemFrom(err).title ?? 'Could not save the correction.')
    });
  }
}
