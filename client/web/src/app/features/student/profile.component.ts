import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { BusyRingComponent } from '../../shared/busy-ring.component';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { IdentityCardComponent } from '../../shared/identity-card.component';
import { PasswordCardComponent } from '../../shared/password-card.component';
import { Profile, ProblemDetails } from '../../core/models';
import { applyServerErrors, fieldMessage, revealErrors, MessageOverrides } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { AuthService } from '../../core/auth.service';

/**
 * `yyyy-MM-dd` to a Date, and back. Both read the value as a local calendar day: a birthday is a
 * date and not an instant, so `new Date('2004-03-18')` (which is parsed as UTC midnight) and
 * `toISOString()` (which converts to UTC first) are both wrong here — either can move the day by
 * one for a reader west of Greenwich.
 */
function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The calendar cannot offer a future day, but a keyboard can still reach one — and when it
 *  does the field should say what the server would have said, word for word. */
const DOB_MESSAGES: MessageOverrides = {
  matDatepickerMax: "Your date of birth can't be in the future."
};

function formatIsoDate(value: Date | null): string | null {
  if (!value) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatDatepickerModule, BusyRingComponent,
    StatePanelComponent, IdentityCardComponent, PasswordCardComponent
  ],
  // The calendar needs an adapter to turn its cells into dates. Provided here rather than in
  // app.config so it loads with this route's chunk, which is the only place a calendar opens.
  providers: [provideNativeDateAdapter()],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">Your profile</h1>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (profile(); as p) {
        <div class="stack">
          <app-identity-card>
            @if (p.courses.length > 0) {
              <p class="text-muted identity__note">
                <mat-icon class="facts__icon" aria-hidden="true">school</mat-icon>
                <span>On {{ p.courses.length }} {{ p.courses.length === 1 ? 'course' : 'courses' }}.</span>
              </p>
            }

            <!-- What the form below saved, read back from the server's answer. Filled-in facts
                 only: an empty row would be a label pointing at nothing. -->
            <dl class="facts">
              @if (p.displayName) {
                <div class="facts__row">
                  <mat-icon class="facts__icon" aria-hidden="true">badge</mat-icon>
                  <div class="facts__pair">
                    <dt>Known as</dt>
                    <dd>{{ p.displayName }}</dd>
                  </div>
                </div>
              }
              @if (p.phone) {
                <div class="facts__row">
                  <mat-icon class="facts__icon" aria-hidden="true">call</mat-icon>
                  <div class="facts__pair">
                    <dt>Phone</dt>
                    <dd><a [href]="'tel:' + p.phone">{{ p.phone }}</a></dd>
                  </div>
                </div>
              }
              @if (p.dateOfBirth) {
                <div class="facts__row">
                  <mat-icon class="facts__icon" aria-hidden="true">cake</mat-icon>
                  <div class="facts__pair">
                    <dt>Born</dt>
                    <dd>{{ p.dateOfBirth | date: 'longDate' }}</dd>
                  </div>
                </div>
              }
              @if (p.bio) {
                <div class="facts__row facts__row--wide">
                  <mat-icon class="facts__icon" aria-hidden="true">notes</mat-icon>
                  <div class="facts__pair">
                    <dt>Bio</dt>
                    <dd class="facts__bio">{{ p.bio }}</dd>
                  </div>
                </div>
              }
            </dl>
          </app-identity-card>

          <div class="grid">
            <div class="col">
              <mat-card>
                <mat-card-header><mat-card-title>Your details</mat-card-title></mat-card-header>
                <mat-card-content>
                  <form [formGroup]="form" (ngSubmit)="save()" novalidate>
                    <mat-form-field appearance="outline">
                      <mat-label>Display name (optional)</mat-label>
                      <input matInput formControlName="displayName" />
                      <mat-hint>What your teachers see instead of your full name.</mat-hint>
                      @if (message('displayName', 'Display name'); as msg) { <mat-error>{{ msg }}</mat-error> }
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Phone (optional)</mat-label>
                      <input matInput formControlName="phone" inputmode="tel" autocomplete="tel" />
                      @if (message('phone', 'Phone'); as msg) { <mat-error>{{ msg }}</mat-error> }
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Date of birth (optional)</mat-label>
                      <!-- Readonly, and the whole box opens the calendar: the day is picked off a
                           month grid rather than typed, so there is no format to get wrong. -->
                      <input matInput readonly formControlName="dateOfBirth"
                        [matDatepicker]="dobPicker" [max]="today" (click)="dobPicker.open()" />
                      <!-- Both controls in one suffix: Material lays each icon suffix out as a
                           block, so two of them stack into a second row on a narrow screen. -->
                      <span matIconSuffix class="dob-suffix">
                        @if (form.value.dateOfBirth) {
                          <button mat-icon-button type="button" aria-label="Clear date of birth"
                            (click)="clearDateOfBirth($event)">
                            <mat-icon>close</mat-icon>
                          </button>
                        }
                        <mat-datepicker-toggle [for]="dobPicker"></mat-datepicker-toggle>
                      </span>
                      <!-- Years first: a birthday is decades back, and a month-by-month walk to
                           1998 is a hundred clicks. Pick the year, then the month, then the day. -->
                      <mat-datepicker #dobPicker startView="multi-year" [startAt]="dobStartAt()"></mat-datepicker>
                      <mat-hint>Pick the day from the calendar.</mat-hint>
                      @if (message('dateOfBirth', 'Date of birth', DOB_MESSAGES); as msg) {
                        <mat-error>{{ msg }}</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Bio (optional)</mat-label>
                      <textarea matInput formControlName="bio" rows="3"></textarea>
                      <mat-hint>{{ bioLength() }} / 500</mat-hint>
                      @if (message('bio', 'Bio'); as msg) { <mat-error>{{ msg }}</mat-error> }
                    </mat-form-field>

                    @if (banner()) {
                      <p class="notice notice--danger" role="alert">
                        <mat-icon>error_outline</mat-icon>
                        <span>{{ banner() }}</span>
                      </p>
                    }

                    <button mat-flat-button color="primary" type="submit"
                      [disabled]="saving() || form.invalid || !changed()">
                      @if (saving()) { <app-busy-ring size="20px"></app-busy-ring> } @else { Save changes }
                    </button>
                  </form>
                </mat-card-content>
              </mat-card>

              <mat-card>
                <mat-card-header><mat-card-title>Your courses</mat-card-title></mat-card-header>
                <mat-card-content>
                  @if (p.courses.length === 0) {
                    <p class="text-muted">You're not on any course yet.</p>
                    <a mat-stroked-button routerLink="/student/join"><mat-icon>key</mat-icon> Enter a joining code</a>
                  } @else {
                    <ul class="course-list">
                      @for (c of p.courses; track c.teacherUserId) {
                        <li class="course-list__item">
                          <a mat-stroked-button [routerLink]="['/student/courses', c.teacherUserId]">
                            <mat-icon>school</mat-icon> {{ c.teacherFullName }}
                          </a>
                          <span class="text-muted">joined {{ c.joinedAtUtc | date: 'mediumDate' }}</span>
                        </li>
                      }
                    </ul>
                  }
                </mat-card-content>
              </mat-card>
            </div>

            <div class="col">
              <app-password-card></app-password-card>
            </div>
          </div>
        </div>
      }
    </app-state-panel>
  `,
  styles: [`
    .stack { display: flex; flex-direction: column; gap: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    .col { display: flex; flex-direction: column; gap: 1rem; }
    @media (max-width: 800px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .identity__note {
      display: flex; align-items: center; gap: 0.4rem; margin: 0.35rem 0 0; font-size: var(--step--1);
    }
    /* Label above value, in as many columns as fit - a phone number and a birthday are short
       enough to sit side by side, and the bio is given the full width to run in. */
    .facts {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, max-content));
      gap: 0.5rem 1.5rem; margin: 0.6rem 0 0; font-size: var(--step--1);
    }
    .facts__row { display: flex; align-items: flex-start; gap: 0.5rem; }
    .facts__row--wide { grid-column: 1 / -1; }
    /* The icon labels the row at a glance; the word underneath it is what a screen reader gets,
       which is why the icon itself is aria-hidden rather than given a label of its own. */
    .facts__icon {
      flex: none; color: var(--muted);
      font-size: 20px; width: 20px; height: 20px; line-height: 20px; margin-top: 0.1rem;
    }
    .facts__pair { min-width: 0; }
    .facts dt {
      color: var(--muted); font-size: var(--step--2); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .facts dd { margin: 0.1rem 0 0; }
    .facts__bio { white-space: pre-wrap; max-width: 40rem; }
    /* The box is readonly but not disabled - it should still read as somewhere to click. */
    input[readonly] { cursor: pointer; }
    .dob-suffix { display: inline-flex; align-items: center; white-space: nowrap; }
    form { display: flex; flex-direction: column; gap: 0.5rem; }
    form button[type="submit"] { align-self: flex-start; margin-top: 0.25rem; }
    .course-list { list-style: none; padding: 0; margin: 0; }
    .course-list__item {
      /* Centred, not baseline: a button has no text baseline to sit a date against. */
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 0.5rem; padding: 0.6rem 0; border-bottom: 1px solid var(--rule);
      font-size: var(--step--1);
    }
    .course-list__item:last-child { border-bottom: 0; }
    /* The teacher's name is where you go next, so it is a button and not a run of blue text. */
    .course-list__item a { font-weight: 500; }
  `]
})
export class ProfileComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  profile = signal<Profile | null>(null);
  saving = signal(false);
  banner = signal<string | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);

  form = this.fb.group({
    displayName: ['', Validators.maxLength(120)],
    phone: ['', Validators.maxLength(30)],
    dateOfBirth: [null as Date | null],
    bio: ['', Validators.maxLength(500)]
  });

  /** Caps the calendar at today, so the server's "can't be in the future" rule is one the form
   *  makes unreachable rather than one it reports after the round trip. */
  readonly today = new Date();

  protected readonly DOB_MESSAGES = DOB_MESSAGES;

  /** Where the calendar opens when the box is empty: a plausible student birthday rather than
   *  today, so the year grid lands near the answer instead of two decades past it. */
  dobStartAt(): Date {
    return this.form.value.dateOfBirth ?? new Date(this.today.getFullYear() - 18, 0, 1);
  }

  /** Clears the box. The click is stopped from reaching the input behind it, which would
   *  otherwise reopen the calendar the moment the date was removed. */
  clearDateOfBirth(event: Event): void {
    event.stopPropagation();
    this.form.patchValue({ dateOfBirth: null });
    this.form.markAsDirty();
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<Profile>('/api/student/profile').subscribe({
      next: (p) => {
        this.apply(p);
        this.loading.set(false);
      },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  /** Takes the server's copy as the truth: the card reads from it, and the form is re-seeded
   *  from it so the boxes show what was actually stored - trimmed, and blank where the server
   *  turned an all-spaces value into nothing. */
  private apply(p: Profile): void {
    this.profile.set(p);
    this.form.patchValue({
      displayName: p.displayName ?? '',
      phone: p.phone ?? '',
      dateOfBirth: parseIsoDate(p.dateOfBirth),
      bio: p.bio ?? ''
    });
    this.form.markAsPristine();
  }

  message(name: string, label: string, overrides: MessageOverrides = {}): string | null {
    return fieldMessage(this.form, name, label, overrides);
  }

  bioLength(): number {
    return (this.form.get('bio')?.value ?? '').length;
  }

  /** Nothing to save until a box differs from the copy the server sent back — the same rule the
   *  Subject card follows. Compared value by value rather than through `dirty`, so opening the
   *  calendar and re-picking the day already on file, or typing into a box and undoing it, leaves
   *  the button off. Trimmed on the way in, because the server stores it trimmed and a trailing
   *  space is not an edit. */
  changed(): boolean {
    const stored = this.profile();
    if (!stored) return false;
    const { displayName, phone, dateOfBirth, bio } = this.form.getRawValue();
    return (displayName ?? '').trim() !== (stored.displayName ?? '')
      || (phone ?? '').trim() !== (stored.phone ?? '')
      || formatIsoDate(dateOfBirth) !== (stored.dateOfBirth ?? null)
      || (bio ?? '').trim() !== (stored.bio ?? '');
  }

  save(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.saving.set(true);
    this.banner.set(null);
    const { dateOfBirth, ...rest } = this.form.getRawValue();
    // The calendar hands back a Date; the server stores a DateOnly. An empty box is `null`,
    // which is what "no birthday on file" is spelled as on the wire.
    const body = { ...rest, dateOfBirth: formatIsoDate(dateOfBirth) };
    this.http.put<Profile>('/api/student/profile', body).subscribe({
      next: async (p) => {
        this.apply(p);
        // The band at the top of the page is drawn from the session, not from this response, so
        // it has to be re-read as well - otherwise the card below shows the new details while
        // the name and photo above it are still the ones the page loaded with.
        await this.auth.refreshMe();
        this.saving.set(false);
        // "Save changes" produces "Saved" — the same word for the same act, start to finish.
        this.notify.success('Saved your changes.');
      },
      error: (err) => {
        this.banner.set(applyServerErrors(this.form, problemFrom(err)));
        this.saving.set(false);
      }
    });
  }
}
