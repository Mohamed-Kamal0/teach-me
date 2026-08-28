import { Component, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BusyRingComponent } from '../../shared/busy-ring.component';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

/** The server's wording, repeated here so the browser and the API say the same sentence about
 *  the same field rather than two sentences that happen to mean the same thing. */
const SUBJECT_MESSAGES = {
  required: 'Enter the subject you teach.',
  minlength: 'Enter the subject you teach.',
  maxlength: 'Enter the subject you teach, in 60 characters or fewer.'
};

/**
 * The "Subject" card on a teacher's own profile — the one field on that page a teacher can
 * change about how the rest of the app sees them.
 *
 * It is on the profile and not behind the approved guard on purpose. The subject is what an
 * administrator reads before deciding, and what the public directory is searched on the moment
 * that decision goes the teacher's way, so a typo in it has to be fixable while still waiting.
 *
 * The value is read from `auth.me()` rather than a fetch of its own: the subject rides on
 * identity, so there is one copy of it in the client and it cannot fall behind the server.
 */
@Component({
  selector: 'app-subject-card',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, BusyRingComponent
  ],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Subject</mat-card-title></mat-card-header>
      <mat-card-content>
        <p class="text-muted intro">
          What you teach, as it appears on your card in the teacher directory. People searching
          the directory find you by this or by your name.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Subject you teach</mat-label>
            <input matInput formControlName="subject" autocomplete="off" maxlength="60" />
            <mat-hint>Mathematics, Biology, English Literature…</mat-hint>
            @if (message(); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          @if (banner()) {
            <p class="notice notice--danger" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ banner() }}</span>
            </p>
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="saving() || !changed()">
            @if (saving()) {
              <span class="btn-busy"><app-busy-ring size="18px"></app-busy-ring>Saving…</span>
            } @else {
              Save subject
            }
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .intro { margin: 0 0 0.75rem; }
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    form button[type="submit"] { align-self: flex-start; margin-top: 0.25rem; }
  `]
})
export class SubjectCardComponent {
  readonly saving = signal(false);
  readonly banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  form = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]]
  });

  constructor() {
    // `me` arrives after bootstrap and again after every save, so the box follows it rather than
    // being filled once. An edit in progress is left alone: a refresh that overwrote what somebody
    // was halfway through typing would be the card losing their work for them.
    effect(() => {
      const subject = this.auth.me()?.subject ?? '';
      if (!this.form.dirty) {
        this.form.setValue({ subject });
      }
    });
  }

  message(): string | null {
    return fieldMessage(this.form, 'subject', 'Subject', SUBJECT_MESSAGES);
  }

  /** Nothing to save until it differs from what the server already holds — which also covers the
   *  teacher who has never set one, whose empty box is not a change worth a request. */
  changed(): boolean {
    const typed = (this.form.getRawValue().subject ?? '').trim();
    return typed !== (this.auth.me()?.subject ?? '');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.saving.set(true);
    this.banner.set(null);
    try {
      await this.auth.updateSubject(this.form.getRawValue().subject!.trim());
      // Pristine again, so the effect above may resume following `me` — which now carries the
      // trimmed value the server actually stored, not the one that was typed.
      this.form.markAsPristine();
      this.notify.success('Saved the subject you teach.');
    } catch (err) {
      this.banner.set(applyServerErrors(this.form, problemFrom(err)));
    } finally {
      this.saving.set(false);
    }
  }
}
