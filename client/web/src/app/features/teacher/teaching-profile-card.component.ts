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
import {
  PHONE_MESSAGES, PHONE_PATTERN, applyServerErrors, fieldMessage, revealErrors
} from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';

/** The server's wording, repeated here so the browser and the API say the same sentence about
 *  the same field rather than two sentences that happen to mean the same thing. */
const SUBJECT_MESSAGES = {
  required: 'Enter the subject you teach.',
  minlength: 'Enter the subject you teach.',
  maxlength: 'Enter the subject you teach, in 60 characters or fewer.'
};

/**
 * The "Teaching profile" card on a teacher's own profile — the two things a teacher stated about
 * themselves at registration, and the only ones on that page they can change about how the rest
 * of the app sees them.
 *
 * It is on the profile and not behind the approved guard on purpose. These are the fields an
 * administrator reads before deciding, and the subject is what the public directory is searched
 * on the moment that decision goes the teacher's way, so a typo in either has to be fixable while
 * still waiting.
 *
 * The two fields share one Save because the server takes them as a pair: it replaces both, so
 * posting one alone would read as the other being cleared.
 *
 * The values are read from `auth.me()` rather than a fetch of their own: both ride on identity,
 * so there is one copy of them in the client and it cannot fall behind the server.
 */
@Component({
  selector: 'app-teaching-profile-card',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, BusyRingComponent
  ],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Teaching profile</mat-card-title></mat-card-header>
      <mat-card-content>
        <p class="text-muted intro">
          How your course appears when students discover it. They find you by the subject or by
          your name, and reach you on the number.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Subject you teach</mat-label>
            <input matInput formControlName="subject" autocomplete="off" maxlength="60" />
            <mat-hint>Mathematics, Biology, English Literature…</mat-hint>
            @if (message('subject', 'Subject'); as msg) { <mat-error>{{ msg }}</mat-error> }
          </mat-form-field>

          <!-- Published beside the subject on your course card, so it is edited beside the
               subject here too. -->
          <mat-form-field appearance="outline">
            <mat-label>Phone number</mat-label>
            <input matInput type="tel" formControlName="phone" autocomplete="tel"
              inputmode="tel" maxlength="30" />
            <mat-hint>Shown on your course card, so students can ask about the course.</mat-hint>
            @if (message('phone', 'Phone number'); as msg) { <mat-error>{{ msg }}</mat-error> }
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
              Save changes
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
export class TeachingProfileCardComponent {
  readonly saving = signal(false);
  readonly banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  form = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    phone: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(PHONE_PATTERN)]]
  });

  constructor() {
    // `me` arrives after bootstrap and again after every save, so the boxes follow it rather than
    // being filled once. An edit in progress is left alone: a refresh that overwrote what somebody
    // was halfway through typing would be the card losing their work for them.
    effect(() => {
      const me = this.auth.me();
      if (!this.form.dirty) {
        this.form.setValue({ subject: me?.subject ?? '', phone: me?.phone ?? '' });
      }
    });
  }

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label, name === 'phone' ? PHONE_MESSAGES : SUBJECT_MESSAGES);
  }

  /** Nothing to save until one of the two differs from what the server already holds — which also
   *  covers the teacher who has never set either, whose empty boxes are not a change worth a
   *  request. */
  changed(): boolean {
    const { subject, phone } = this.form.getRawValue();
    const me = this.auth.me();
    return (subject ?? '').trim() !== (me?.subject ?? '')
      || (phone ?? '').trim() !== (me?.phone ?? '');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.saving.set(true);
    this.banner.set(null);
    try {
      const { subject, phone } = this.form.getRawValue();
      await this.auth.updateTeacherProfile(subject!.trim(), phone!.trim());
      // Pristine again, so the effect above may resume following `me` — which now carries the
      // trimmed values the server actually stored, not the ones that were typed.
      this.form.markAsPristine();
      this.notify.success('Saved your teaching profile.');
    } catch (err) {
      this.banner.set(applyServerErrors(this.form, problemFrom(err)));
    } finally {
      this.saving.set(false);
    }
  }
}
