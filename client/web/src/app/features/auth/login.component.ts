import { Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BusyRingComponent } from '../../shared/busy-ring.component';
import { AuthService } from '../../core/auth.service';
import { applyServerErrors, clearServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, BusyRingComponent
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
              <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="password"
                autocomplete="current-password" />
              <button mat-icon-button matSuffix type="button" tabindex="-1"
                (click)="reveal.set(!reveal())"
                [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="reveal()">
                <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (message('password', 'Password'); as msg) { <mat-error>{{ msg }}</mat-error> }
            </mat-form-field>

            @if (banner()) {
              <p class="notice notice--danger" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ banner() }}</span>
              </p>
            }

            <button mat-flat-button color="primary" type="submit" [disabled]="submitting() || form.invalid">
              @if (submitting()) { <app-busy-ring size="20px"></app-busy-ring> } @else { Sign in }
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <p class="alt">New here?</p>
      <div class="alt__actions">
        <a mat-stroked-button routerLink="/register/teacher">Register as a teacher</a>
        <a mat-stroked-button routerLink="/register/student">Register as a student</a>
      </div>
    </div>
  `,
  styles: [`
    .form-page { max-width: 26rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .form-card { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; }
    form button[type="submit"] { margin-top: 0.5rem; }
    /* The prompt stays a sentence; the way out of it is a button. */
    .alt { margin-top: 1rem; color: var(--muted); font-size: var(--step--1); }
    .alt__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
  `]
})
export class LoginComponent implements OnInit {
  /** A password box you cannot read is how a typo becomes "email or password is incorrect".
   *  The toggle is `tabindex="-1"` so it never sits between the box and the submit button. */
  readonly reveal = signal(false);

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
    // What the server said last time is not a reason to refuse to ask it again — otherwise the
    // second press of a button that appears to work does nothing at all.
    clearServerErrors(this.form);

    // The button is disabled until both boxes hold something and the email parses, so this is a
    // backstop rather than the usual path — and when it does fire it makes the unmet rules speak.
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
      // A refused pair is reported over the form, never under one box: the server declines to
      // say which half was wrong, and pinning its message to Email would accuse the one of the
      // two fields we have no reason to think is the wrong one. It arrives named `credentials`,
      // which matches no control, so `applyServerErrors` hands it back for exactly that. A 401
      // is read the same way — the interceptor lets this endpoint's 401 through untouched,
      // because signing in with the wrong password is not a session that lapsed.
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
