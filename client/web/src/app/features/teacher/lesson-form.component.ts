import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Lesson, LessonRequest, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-lesson-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatNativeDateModule],
  template: `
    <mat-card class="form-card">
      <mat-card-header><mat-card-title class="app-heading">{{ isEdit() ? 'Edit lesson' : 'New lesson' }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" />
            @if (fieldError('title'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Position</mat-label>
            <input matInput type="number" formControlName="orderIndex" />
            @if (fieldError('orderIndex'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Recording link</mat-label>
            <input matInput formControlName="recordingUrl" placeholder="https://…" />
            @if (fieldError('recordingUrl'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Handout link (optional)</mat-label>
            <input matInput formControlName="handoutUrl" placeholder="https://…" />
            @if (fieldError('handoutUrl'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Quiz link (optional)</mat-label>
            <input matInput formControlName="quizUrl" placeholder="https://…" />
            @if (fieldError('quizUrl'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Answers link (optional)</mat-label>
            <input matInput formControlName="answersUrl" placeholder="https://…" />
            @if (fieldError('answersUrl'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Length (minutes)</mat-label>
            <input matInput type="number" formControlName="durationMinutes" />
            @if (fieldError('durationMinutes'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Quiz marked out of</mat-label>
            <input matInput type="number" formControlName="quizMaxScore" />
            @if (fieldError('quizMaxScore'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Pass mark</mat-label>
            <input matInput type="number" formControlName="passMark" />
            @if (fieldError('passMark'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Opens at (leave blank = draft)</mat-label>
            <input matInput type="datetime-local" formControlName="opensAtUtc" />
            @if (fieldError('opensAtUtc'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Quiz opens at</mat-label>
            <input matInput type="datetime-local" formControlName="quizOpensAtUtc" />
            @if (fieldError('quizOpensAtUtc'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Answers open at</mat-label>
            <input matInput type="datetime-local" formControlName="answersOpenAtUtc" />
            @if (fieldError('answersOpenAtUtc'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          @if (topLevelError()) { <p class="text-danger">{{ topLevelError() }}</p> }

          <div class="actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
              {{ isEdit() ? 'Save changes' : 'Create lesson' }}
            </button>
            <a mat-button routerLink="/teacher/lessons">Cancel</a>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .form-card { max-width: 520px; margin: 1rem 0; }
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class LessonFormComponent implements OnInit {
  submitting = signal(false);
  problem = signal<ProblemDetails | null>(null);
  isEdit = signal(false);
  private lessonId: string | null = null;

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    orderIndex: [1, [Validators.required, Validators.min(1)]],
    recordingUrl: ['', [Validators.required]],
    handoutUrl: [''],
    quizUrl: [''],
    answersUrl: [''],
    durationMinutes: [30, [Validators.required, Validators.min(1), Validators.max(600)]],
    quizMaxScore: [20, [Validators.required, Validators.min(1)]],
    passMark: [10, [Validators.required, Validators.min(0)]],
    opensAtUtc: [''],
    quizOpensAtUtc: [''],
    answersOpenAtUtc: ['']
  });

  ngOnInit(): void {
    this.lessonId = this.route.snapshot.paramMap.get('id');
    if (this.lessonId) {
      this.isEdit.set(true);
      this.http.get<Lesson>(`/api/teacher/lessons/${this.lessonId}`).subscribe({
        next: (lesson) => this.form.patchValue({
          title: lesson.title,
          orderIndex: lesson.orderIndex,
          recordingUrl: lesson.recordingUrl,
          handoutUrl: lesson.handoutUrl ?? '',
          quizUrl: lesson.quizUrl ?? '',
          answersUrl: lesson.answersUrl ?? '',
          durationMinutes: lesson.durationMinutes,
          quizMaxScore: lesson.quizMaxScore,
          passMark: lesson.passMark,
          opensAtUtc: toLocalInput(lesson.opensAtUtc),
          quizOpensAtUtc: toLocalInput(lesson.quizOpensAtUtc),
          answersOpenAtUtc: toLocalInput(lesson.answersOpenAtUtc)
        }),
        error: () => this.router.navigate(['/not-found'])
      });
    }
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

    const v = this.form.getRawValue();
    const body: LessonRequest = {
      title: v.title!,
      orderIndex: v.orderIndex!,
      recordingUrl: v.recordingUrl!,
      handoutUrl: v.handoutUrl || null,
      quizUrl: v.quizUrl || null,
      answersUrl: v.answersUrl || null,
      durationMinutes: v.durationMinutes!,
      quizMaxScore: v.quizMaxScore!,
      passMark: v.passMark!,
      opensAtUtc: fromLocalInput(v.opensAtUtc),
      quizOpensAtUtc: fromLocalInput(v.quizOpensAtUtc),
      answersOpenAtUtc: fromLocalInput(v.answersOpenAtUtc)
    };

    const req = this.isEdit()
      ? this.http.put(`/api/teacher/lessons/${this.lessonId}`, body)
      : this.http.post('/api/teacher/lessons', body);

    req.subscribe({
      next: () => this.router.navigate(['/teacher/lessons']),
      error: (err) => { this.problem.set(problemFrom(err)); this.submitting.set(false); }
    });
  }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
