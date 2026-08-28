import { Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BusyRingComponent } from '../../shared/busy-ring.component';
import { AuthService } from '../../core/auth.service';
import { PASSWORD_RULE, applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-register-student',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, BusyRingComponent
  ],
  template: `
    <div class="form-page">
      <mat-card class="form-card">
        <mat-card-header><mat-card-title class="app-heading">Register as a student</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Full name</mat-label>
              <input matInput formControlName="fullName" autocomplete="name" />
              @if (message('fullName', 'Full name'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              @if (message('email', 'Email'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="password"
                autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" tabindex="-1"
                (click)="reveal.set(!reveal())"
                [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="reveal()">
                <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>{{ passwordRule }}</mat-hint>
              @if (message('password', 'Password'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirm password</mat-label>
              <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="confirmPassword"
                autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" tabindex="-1"
                (click)="reveal.set(!reveal())"
                [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="reveal()">
                <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (mismatch()) { <mat-error>Those passwords don't match.</mat-error> }
            </mat-form-field>

            @if (banner()) {
              <p class="notice notice--danger" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ banner() }}</span>
              </p>
            }

            <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
              @if (submitting()) { <app-busy-ring size="20px"></app-busy-ring> } @else { Register }
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <p class="alt">Already registered?</p>
      <div class="alt__actions">
        <a mat-stroked-button routerLink="/login">Sign in</a>
      </div>
    </div>
  `,
  styles: [`
    .form-page { max-width: 28rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .form-card { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    form button[type="submit"] { margin-top: 0.5rem; }
    /* The prompt stays a sentence; the way out of it is a button. */
    .alt { margin-top: 1rem; color: var(--muted); font-size: var(--step--1); }
    .alt__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
  `]
})
export class RegisterStudentComponent {
  readonly passwordRule = PASSWORD_RULE;

  /** One toggle for both boxes — they are meant to be compared, so revealing one and not the
   *  other would hide exactly the difference a person is checking for. */
  readonly reveal = signal(false);

  submitting = signal(false);
  banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordsMatch });

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label, name === 'password' ? { pattern: PASSWORD_RULE, minlength: PASSWORD_RULE } : {});
  }

  mismatch(): boolean {
    const confirm = this.form.get('confirmPassword');
    return !!this.form.errors?.['mismatch'] && !!(confirm?.touched || confirm?.dirty);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.banner.set(null);
    try {
      const { fullName, email, password } = this.form.getRawValue();
      await this.auth.registerStudent(fullName!, email!, password!);
      await this.auth.login(email!, password!);
      await this.router.navigate(['/student/profile']);
    } catch (err) {
      this.banner.set(applyServerErrors(this.form, problemFrom(err)));
    } finally {
      this.submitting.set(false);
    }
  }
}
