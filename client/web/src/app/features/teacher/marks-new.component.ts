import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { Lesson, PagedResult, ProblemDetails, StudentSummary, TeacherStudentsResponse } from '../../core/models';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-marks-new',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="form-page">
      <mat-card class="form-card">
        <mat-card-header><mat-card-title class="app-heading">Record a mark</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (loadError()) {
            <!-- Without this the two dropdowns would simply be empty, with nothing said. -->
            <p class="notice notice--danger" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>
                <span class="notice__title">Couldn't load your students and lessons.</span>
                {{ loadError()?.title }}
              </span>
            </p>
            <button mat-stroked-button (click)="loadOptions()">Try again</button>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <mat-form-field appearance="outline">
                <mat-label>Student</mat-label>
                <mat-select formControlName="studentUserId">
                  @for (s of students(); track s.userId) {
                    <mat-option [value]="s.userId">{{ s.fullName }} ({{ s.email }})</mat-option>
                  }
                </mat-select>
                @if (students().length === 0 && !loadingOptions()) {
                  <mat-hint>No students have joined yet. Share your joining code first.</mat-hint>
                }
                @if (message('studentUserId', 'Student'); as msg) { <mat-error>{{ msg }}</mat-error> }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Lesson</mat-label>
                <mat-select formControlName="lessonId" (selectionChange)="onLessonChange()">
                  @for (l of lessons(); track l.id) {
                    <mat-option [value]="l.id">{{ l.title }}</mat-option>
                  }
                </mat-select>
                @if (lessons().length === 0 && !loadingOptions()) {
                  <mat-hint>You haven't added a lesson yet.</mat-hint>
                }
                @if (message('lessonId', 'Lesson'); as msg) { <mat-error>{{ msg }}</mat-error> }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Score @if (maxScore()) { (out of {{ maxScore() }}) }</mat-label>
                <input matInput type="number" formControlName="score" min="0" [max]="maxScore() ?? 100" />
                @if (maxScore()) { <mat-hint>Between 0 and {{ maxScore() }}.</mat-hint> }
                @if (message('score', 'Score'); as msg) { <mat-error>{{ msg }}</mat-error> }
              </mat-form-field>

              @if (banner()) {
                <p class="notice notice--danger" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ banner() }}</span>
                </p>
              }

              <div class="actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
                  @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Record mark }
                </button>
                <a mat-button routerLink="/teacher/students">Cancel</a>
              </div>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .form-page { max-width: 30rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .form-card { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class MarksNewComponent implements OnInit {
  submitting = signal(false);
  banner = signal<string | null>(null);
  students = signal<StudentSummary[]>([]);
  lessons = signal<Lesson[]>([]);
  maxScore = signal<number | null>(null);
  loadingOptions = signal(true);
  loadError = signal<ProblemDetails | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotifyService);

  form = this.fb.group({
    studentUserId: ['', Validators.required],
    lessonId: ['', Validators.required],
    score: [0, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    this.loadOptions();
  }

  loadOptions(): void {
    this.loadingOptions.set(true);
    this.loadError.set(null);
    forkJoin({
      students: this.http.get<TeacherStudentsResponse>('/api/teacher/students?pageSize=100'),
      lessons: this.http.get<PagedResult<Lesson>>('/api/teacher/lessons?pageSize=100')
    }).subscribe({
      next: ({ students, lessons }) => {
        this.students.set(students.students.items);
        this.lessons.set(lessons.items);
        this.loadingOptions.set(false);
      },
      error: (err) => {
        this.loadError.set(problemFrom(err));
        this.loadingOptions.set(false);
      }
    });
  }

  onLessonChange(): void {
    const lesson = this.lessons().find(l => l.id === this.form.value.lessonId);
    this.maxScore.set(lesson?.quizMaxScore ?? null);
    // The ceiling belongs to the lesson, so it is attached the moment a lesson is chosen.
    const score = this.form.get('score')!;
    score.setValidators(lesson
      ? [Validators.required, Validators.min(0), Validators.max(lesson.quizMaxScore)]
      : [Validators.required, Validators.min(0)]);
    score.updateValueAndValidity();
  }

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label);
  }

  submit(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.banner.set(null);
    this.http.post('/api/teacher/marks', this.form.getRawValue()).subscribe({
      next: () => {
        this.notify.success('Mark recorded.');
        this.router.navigate(['/teacher/students']);
      },
      error: (err) => {
        this.banner.set(applyServerErrors(this.form, problemFrom(err)));
        this.submitting.set(false);
      }
    });
  }
}
