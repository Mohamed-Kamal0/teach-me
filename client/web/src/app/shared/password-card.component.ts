import { Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BusyRingComponent } from './busy-ring.component';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';
import { PASSWORD_RULE, applyServerErrors, fieldMessage, revealErrors } from '../core/form-errors';
import { problemFrom } from '../core/interceptors/error.interceptor';

/** The same rule registration uses, applied to the same pair of boxes. Client-only: the server
 *  is never sent a confirmation field, so there is nothing for it to disagree with. */
function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * The "Password" card — reset your own password from inside your own session.
 *
 * This app sends no email, so the emailed-link flow that "reset password" usually means cannot
 * exist here. What replaces the link is the current password: the one thing a stranger holding
 * a hijacked tab does not have. That makes the card safe to put on the profile page next to the
 * photo, and it is the same card for a teacher, a student and the administrator — one screen,
 * because the rule it enforces is one rule.
 */
@Component({
  selector: 'app-password-card',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, BusyRingComponent
  ],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Password</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Current password</mat-label>
            <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="currentPassword"
              autocomplete="current-password" />
            <button mat-icon-button matSuffix type="button" tabindex="-1"
              (click)="reveal.set(!reveal())"
              [attr.aria-label]="reveal() ? 'Hide passwords' : 'Show passwords'"
              [attr.aria-pressed]="reveal()">
              <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (message('currentPassword', 'Current password'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="newPassword"
              autocomplete="new-password" />
            <button mat-icon-button matSuffix type="button" tabindex="-1"
              (click)="reveal.set(!reveal())"
              [attr.aria-label]="reveal() ? 'Hide passwords' : 'Show passwords'"
              [attr.aria-pressed]="reveal()">
              <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-hint>{{ passwordRule }}</mat-hint>
            @if (message('newPassword', 'New password'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirm new password</mat-label>
            <input matInput [type]="reveal() ? 'text' : 'password'" formControlName="confirmPassword"
              autocomplete="new-password" />
            <button mat-icon-button matSuffix type="button" tabindex="-1"
              (click)="reveal.set(!reveal())"
              [attr.aria-label]="reveal() ? 'Hide passwords' : 'Show passwords'"
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

          <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
            @if (saving()) {
              <span class="btn-busy"><app-busy-ring size="18px"></app-busy-ring>Saving…</span>
            } @else {
              Change password
            }
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    form button[type="submit"] { align-self: flex-start; margin-top: 0.25rem; }
  `]
})
export class PasswordCardComponent {
  readonly passwordRule = PASSWORD_RULE;

  readonly saving = signal(false);
  /** One toggle for all three boxes. They exist to be compared with each other; revealing one
   *  and not the others would hide the very difference a person is checking for. */
  readonly reveal = signal(false);
  readonly banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordsMatch });

  message(name: string, label: string): string | null {
    return fieldMessage(
      this.form, name, label,
      name === 'newPassword' ? { pattern: PASSWORD_RULE, minlength: PASSWORD_RULE } : {}
    );
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
    this.saving.set(true);
    this.banner.set(null);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await this.auth.changePassword(currentPassword!, newPassword!);
      // Emptied, not just marked pristine — three passwords left sitting in a form on a shared
      // classroom machine is the failure this card exists to prevent.
      this.form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      this.reveal.set(false);
      this.notify.success('Changed your password.');
    } catch (err) {
      this.banner.set(applyServerErrors(this.form, problemFrom(err)));
    } finally {
      this.saving.set(false);
    }
  }
}
