import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="form-page">
      <mat-card class="form-card">
        <mat-card-header><mat-card-title class="app-heading">Join a course</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (joined()) {
            <div class="done">
              <span class="badge"><mat-icon>check_circle</mat-icon></span>
              <p class="done__title text-success">You're on the course.</p>
              <p class="text-muted">Lessons appear as your teacher opens them.</p>
              <div class="done__actions">
                <a mat-flat-button color="primary" routerLink="/student/courses">View your courses</a>
                <button mat-button (click)="again()">Join another</button>
              </div>
            </div>
          } @else {
            <p class="text-muted intro">Your teacher gives out an eight-character code. Enter it here
            and their lessons appear under Courses.</p>

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <mat-form-field appearance="outline">
                <mat-label>Teacher's joining code</mat-label>
                <input matInput formControlName="code" maxlength="8" placeholder="e.g. 7KQ4M2XB"
                  autocapitalize="characters" autocomplete="off" spellcheck="false" class="code-input" />
                <mat-hint>Eight letters and numbers.</mat-hint>
                @if (message('code', 'Joining code'); as msg) { <mat-error>{{ msg }}</mat-error> }
              </mat-form-field>

              @if (banner()) {
                <p class="notice notice--danger" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ banner() }}</span>
                </p>
              }

              <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
                @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Join }
              </button>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .form-page { max-width: 26rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .form-card { width: 100%; }
    .intro { font-size: var(--step--1); }
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    /* The code is read off a board and typed in, so it is set to be checked character by character. */
    .code-input { font-family: 'Lora', Georgia, serif; font-size: var(--step-2); letter-spacing: 0.22em; text-transform: uppercase; }
    .done { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
    .done__title { margin: 0; font-size: var(--step-1); font-weight: 600; }
    .done__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .badge {
      display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px;
      background: var(--success-wash); color: var(--success); margin-bottom: 0.25rem;
    }
  `]
})
export class JoinComponent {
  submitting = signal(false);
  joined = signal(false);
  banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(8)]]
  });

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label, {
      minlength: 'A joining code is eight characters long.',
      maxlength: 'A joining code is eight characters long.'
    });
  }

  again(): void {
    this.joined.set(false);
    this.banner.set(null);
    this.form.reset({ code: '' });
  }

  submit(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.banner.set(null);

    // Codes are read aloud and typed in, so case and stray spaces are the user's least interesting
    // mistake — they get fixed here rather than refused.
    const code = (this.form.getRawValue().code ?? '').trim().toUpperCase();

    this.http.post('/api/student/enrollments', { code }).subscribe({
      next: () => { this.joined.set(true); this.submitting.set(false); },
      error: (err) => {
        const problem = problemFrom(err);
        this.banner.set(problem.status === 404
          ? 'No teacher has that joining code. Check it with your teacher and try again.'
          : applyServerErrors(this.form, problem));
        this.submitting.set(false);
      }
    });
  }
}
