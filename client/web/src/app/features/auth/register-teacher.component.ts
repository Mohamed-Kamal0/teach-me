import { Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/auth.service';
import { ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register-teacher',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule],
  template: `
    @if (done()) {
      <mat-card class="form-card">
        <mat-card-content>
          <h2 class="app-heading">Your account is waiting</h2>
          <p>Thanks for registering — an administrator will review your account before you can
          teach here. <a routerLink="/login">Sign in</a> any time to check your standing.</p>
        </mat-card-content>
      </mat-card>
    } @else {
      <mat-card class="form-card">
        <mat-card-header><mat-card-title class="app-heading">Register as a teacher</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Full name</mat-label>
              <input matInput formControlName="fullName" />
              @if (fieldError('fullName'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" />
              @if (fieldError('email'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" />
              @if (fieldError('password'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm password</mat-label>
              <input matInput type="password" formControlName="confirmPassword" />
              @if (form.errors?.['mismatch'] && form.get('confirmPassword')?.touched) {
                <mat-error>Those passwords don't match.</mat-error>
              }
            </mat-form-field>

            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
              Register
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .form-card { max-width: 460px; margin: 1rem 0; }
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
  `]
})
export class RegisterTeacherComponent {
  submitting = signal(false);
  problem = signal<ProblemDetails | null>(null);
  done = signal(false);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordsMatch });

  fieldError(name: string): string | null {
    return this.problem()?.errors?.[name]?.[0] ?? null;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.problem.set(null);
    try {
      const { fullName, email, password } = this.form.getRawValue();
      await this.auth.registerTeacher(fullName!, email!, password!);
      this.done.set(true);
    } catch (err) {
      this.problem.set(problemFrom(err));
    } finally {
      this.submitting.set(false);
    }
  }
}
