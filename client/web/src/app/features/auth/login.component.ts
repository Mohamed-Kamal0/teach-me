import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="form-page">
      <mat-card class="form-card">
        <mat-card-header><mat-card-title class="app-heading">Sign in</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (expired()) {
            <p class="notice notice--warning">
              <mat-icon>lock_clock</mat-icon>
              <span>Your session ended. Sign in again and we'll take you back where you were.</span>
            </p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              @if (message('email', 'Email'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
              @if (message('password', 'Password'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            @if (banner()) {
              <p class="notice notice--danger" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ banner() }}</span>
              </p>
            }

            <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
              @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Sign in }
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <p class="alt">New here? <a routerLink="/register/teacher">Register as a teacher</a> or <a routerLink="/register/student">as a student</a>.</p>
    </div>
  `,
  styles: [`
    .form-page { max-width: 26rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .form-card { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
    form button[type="submit"] { margin-top: 0.5rem; }
    .alt { margin-top: 1rem; color: var(--muted); font-size: var(--step--1); }
  `]
})
export class LoginComponent implements OnInit {
  submitting = signal(false);
  /** Whatever the server said that did not belong to one field. */
  banner = signal<string | null>(null);
  expired = signal(false);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private returnUrl: string | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    // The error interceptor sends an expired session here with where it came from attached.
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.expired.set(!!this.returnUrl);
  }

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label);
  }

  async submit(): Promise<void> {
    // Rather than a disabled button that explains nothing, the unmet rules are made to speak.
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }

    this.submitting.set(true);
    this.banner.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      const result = await this.auth.login(email!, password!);
      if (this.returnUrl) await this.router.navigateByUrl(this.returnUrl);
      else if (result.role === 'Admin') await this.router.navigate(['/admin/approvals']);
      else if (result.role === 'Teacher') await this.router.navigate(['/teacher/standing']);
      else await this.router.navigate(['/student/profile']);
    } catch (err) {
      const problem = problemFrom(err);
      // 401 here means the credentials were wrong, not that a session lapsed. It is the pair
      // that failed, so it is reported over the form — pinning it under Email would accuse the
      // one of the two fields we have no reason to think is the wrong one.
      if (problem.status === 401) {
        const said = problem.title ?? Object.values(problem.errors ?? {})[0]?.[0];
        this.banner.set(said ?? 'That email and password do not match an account.');
      } else {
        this.banner.set(applyServerErrors(this.form, problem));
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
