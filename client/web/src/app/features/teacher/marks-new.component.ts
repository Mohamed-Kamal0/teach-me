import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { forkJoin } from 'rxjs';
import { Lesson, PagedResult, ProblemDetails, StudentSummary, TeacherStudentsResponse } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-marks-new',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card class="form-card">
      <mat-card-header><mat-card-title class="app-heading">Record a mark</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Student</mat-label>
            <mat-select formControlName="studentUserId">
              @for (s of students(); track s.userId) {
                <mat-option [value]="s.userId">{{ s.fullName }} ({{ s.email }})</mat-option>
              }
            </mat-select>
            @if (fieldError('studentUserId'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Lesson</mat-label>
            <mat-select formControlName="lessonId" (selectionChange)="onLessonChange()">
              @for (l of lessons(); track l.id) {
                <mat-option [value]="l.id">{{ l.title }}</mat-option>
              }
            </mat-select>
            @if (fieldError('lessonId'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Score @if (maxScore()) { (out of {{ maxScore() }}) }</mat-label>
            <input matInput type="number" formControlName="score" />
            @if (fieldError('score'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          @if (topLevelError()) { <p class="text-danger">{{ topLevelError() }}</p> }

          <div class="actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">Record mark</button>
            <a mat-button routerLink="/teacher/students">Cancel</a>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .form-card { max-width: 460px; margin: 1rem 0; }
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class MarksNewComponent implements OnInit {
  submitting = signal(false);
  problem = signal<ProblemDetails | null>(null);
  students = signal<StudentSummary[]>([]);
  lessons = signal<Lesson[]>([]);
  maxScore = signal<number | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  form = this.fb.group({
    studentUserId: ['', Validators.required],
    lessonId: ['', Validators.required],
    score: [0, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    forkJoin({
      students: this.http.get<TeacherStudentsResponse>('/api/teacher/students?pageSize=100'),
      lessons: this.http.get<PagedResult<Lesson>>('/api/teacher/lessons?pageSize=100')
    }).subscribe(({ students, lessons }) => {
      this.students.set(students.students.items);
      this.lessons.set(lessons.items);
    });
  }

  onLessonChange(): void {
    const lesson = this.lessons().find(l => l.id === this.form.value.lessonId);
    this.maxScore.set(lesson?.quizMaxScore ?? null);
  }

  fieldError(name: string): string | null {
    return this.problem()?.errors?.[name]?.[0] ?? null;
  }

  topLevelError(): string | null {
    const p = this.problem();
    return p && !p.errors ? p.title ?? null : null;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.problem.set(null);
    this.http.post('/api/teacher/marks', this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/teacher/students']),
      error: (err) => { this.problem.set(problemFrom(err)); this.submitting.set(false); }
    });
  }
}
