import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';
import { ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <mat-card class="form-card">
      <mat-card-header><mat-card-title class="app-heading">Sign in</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            @if (fieldError('email'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="current-password" />
            @if (fieldError('password'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          @if (topLevelError()) {
            <p class="text-danger">{{ topLevelError() }}</p>
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Sign in }
          </button>
        </form>
      </mat-card-content>
    </mat-card>
    <p>New here? <a routerLink="/register/teacher">Register as a teacher</a> or <a routerLink="/register/student">as a student</a>.</p>
  `,
  styles: [`
    .form-card { max-width: 420px; margin: 1rem 0; }
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
  `]
})
export class LoginComponent {
  submitting = signal(false);
  problem = signal<ProblemDetails | null>(null);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  fieldError(name: string): string | null {
    return this.problem()?.errors?.[name]?.[0] ?? null;
  }

  topLevelError(): string | null {
    const p = this.problem();
    if (!p || p.errors) return null;
    return p.title ?? null;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.problem.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      const result = await this.auth.login(email!, password!);
      if (result.role === 'Admin') await this.router.navigate(['/admin/approvals']);
      else if (result.role === 'Teacher') await this.router.navigate(['/teacher/standing']);
      else await this.router.navigate(['/student/profile']);
    } catch (err) {
      this.problem.set(problemFrom(err));
    } finally {
      this.submitting.set(false);
    }
  }
}
