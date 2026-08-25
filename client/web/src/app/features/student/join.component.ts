import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule],
  template: `
    <mat-card class="form-card">
      <mat-card-header><mat-card-title class="app-heading">Join a course</mat-card-title></mat-card-header>
      <mat-card-content>
        @if (joined()) {
          <p class="text-success">You're on the course. <a routerLink="/student/courses">View your courses</a>.</p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Teacher's joining code</mat-label>
              <input matInput formControlName="code" maxlength="8" placeholder="e.g. 7KQ4M2XB" />
              @if (fieldError('code'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">Join</button>
          </form>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .form-card { max-width: 420px; margin: 1rem 0; }
    .full-width { width: 100%; }
  `]
})
export class JoinComponent {
  submitting = signal(false);
  joined = signal(false);
  problem = signal<ProblemDetails | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  form = this.fb.group({
    code: ['', [Validators.required]]
  });

  fieldError(name: string): string | null {
    return this.problem()?.errors?.[name]?.[0] ?? null;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.problem.set(null);
    this.http.post('/api/student/enrollments', this.form.getRawValue()).subscribe({
      next: () => { this.joined.set(true); this.submitting.set(false); },
      error: (err) => { this.problem.set(problemFrom(err)); this.submitting.set(false); }
    });
  }
}
