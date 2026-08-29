import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { BusyRingComponent } from '../../shared/busy-ring.component';
import { Lesson, LessonRequest, ProblemDetails } from '../../core/models';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

/** A pass mark above the total is not a stricter lesson, it is an unpassable one. */
function passMarkWithinTotal(group: AbstractControl): ValidationErrors | null {
  const total = group.get('quizMaxScore')?.value;
  const pass = group.get('passMark')?.value;
  return typeof total === 'number' && typeof pass === 'number' && pass > total ? { passTooHigh: true } : null;
}

/**
 * One moment in the release schedule, split across the two boxes it is filled in with. The day is
 * picked off a calendar and the time set beside it — `datetime-local` asked for both at once in a
 * format that differs by browser and locale, which is a format to get wrong for no gain.
 *
 * The day control keeps the name the server uses for the whole moment, so a validation message
 * about `opensAtUtc` still lands on a field instead of in the banner at the foot of the form.
 */
interface ReleaseSlot {
  readonly date: 'opensAtUtc' | 'quizOpensAtUtc' | 'answersOpenAtUtc';
  readonly time: 'opensAtTime' | 'quizOpensAtTime' | 'answersOpenAtTime';
  readonly label: string;
  readonly hint?: string;
}

@Component({
  selector: 'app-lesson-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, MatDatepickerModule, BusyRingComponent
  ],
  // The calendar needs an adapter to turn its cells into dates. Provided here rather than in
  // app.config so it loads with this route's chunk.
  providers: [provideNativeDateAdapter()],
  template: `
    <div class="form-page">
      <mat-card>
        <mat-card-header>
          <mat-card-title class="app-heading">{{ isEdit() ? 'Edit lesson' : 'New lesson' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (loadError()) {
            <p class="notice notice--danger" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ loadError()?.title }}</span>
            </p>
            <div class="actions">
              <button mat-flat-button color="primary" (click)="loadLesson()">Try again</button>
              <a mat-button routerLink="/teacher/lessons">Back to lessons</a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <fieldset class="group">
                <legend class="eyebrow">The lesson</legend>
                <div class="grid">
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Title</mat-label>
                    <input matInput formControlName="title" />
                    @if (message('title', 'Title'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Position</mat-label>
                    <input matInput type="number" formControlName="orderIndex" min="1" />
                    <mat-hint>Where it sits in the course.</mat-hint>
                    @if (message('orderIndex', 'Position'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Length (minutes)</mat-label>
                    <input matInput type="number" formControlName="durationMinutes" min="1" max="600" />
                    @if (message('durationMinutes', 'Length'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>
                </div>
              </fieldset>

              <fieldset class="group">
                <legend class="eyebrow">Links</legend>
                <div class="grid">
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Recording link</mat-label>
                    <input matInput formControlName="recordingUrl" placeholder="https://…" inputmode="url" />
                    @if (message('recordingUrl', 'Recording link'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Handout link (optional)</mat-label>
                    <input matInput formControlName="handoutUrl" placeholder="https://…" inputmode="url" />
                    @if (message('handoutUrl', 'Handout link'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Quiz link (optional)</mat-label>
                    <input matInput formControlName="quizUrl" placeholder="https://…" inputmode="url" />
                    @if (message('quizUrl', 'Quiz link'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Answers link (optional)</mat-label>
                    <input matInput formControlName="answersUrl" placeholder="https://…" inputmode="url" />
                    @if (message('answersUrl', 'Answers link'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>
                </div>
              </fieldset>

              <fieldset class="group">
                <legend class="eyebrow">Marking</legend>
                <div class="grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Quiz marked out of</mat-label>
                    <input matInput type="number" formControlName="quizMaxScore" min="1" />
                    @if (message('quizMaxScore', 'Total'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Pass mark</mat-label>
                    <input matInput type="number" formControlName="passMark" min="0" />
                    @if (passTooHigh()) {
                      <mat-error>A pass mark can't be above the total the quiz is marked out of.</mat-error>
                    } @else {
                      @if (message('passMark', 'Pass mark'); as msg) { <mat-error>{{ msg }}</mat-error> }
                    }
                  </mat-form-field>
                </div>
              </fieldset>

              <fieldset class="group">
                <legend class="eyebrow">Release schedule</legend>
                <p class="group__note">Each part opens on its own. Leave the recording blank to keep
                the lesson a draft that no student can see.</p>
                @for (slot of slots; track slot.date) {
                  <div class="slot">
                    <mat-form-field appearance="outline">
                      <mat-label>{{ slot.label }}</mat-label>
                      <!-- Readonly, and the whole box opens the calendar: the day is picked off a
                           month grid rather than typed, so there is no format to get wrong. -->
                      <input matInput readonly [formControlName]="slot.date"
                        [matDatepicker]="picker" (click)="picker.open()" (dateChange)="datePicked(slot)" />
                      <!-- Both controls in one suffix: Material lays each icon suffix out as a
                           block, so two of them stack into a second row on a narrow screen. -->
                      <span matIconSuffix class="date-suffix">
                        @if (form.get(slot.date)?.value) {
                          <button mat-icon-button type="button" [attr.aria-label]="'Clear ' + slot.label"
                            (click)="clearSlot(slot, $event)">
                            <mat-icon>close</mat-icon>
                          </button>
                        }
                        <mat-datepicker-toggle [for]="picker"></mat-datepicker-toggle>
                      </span>
                      <mat-datepicker #picker></mat-datepicker>
                      @if (slot.hint) { <mat-hint>{{ slot.hint }}</mat-hint> }
                      @if (message(slot.date, slot.label); as msg) { <mat-error>{{ msg }}</mat-error> }
                    </mat-form-field>

                    <!-- The clock half. Blank is midnight, so a day picked and the time left alone
                         opens at the start of that day rather than not at all. -->
                    <mat-form-field appearance="outline">
                      <mat-label>Time</mat-label>
                      <input matInput type="time" [formControlName]="slot.time"
                        [attr.aria-label]="slot.label + ' time'" />
                      @if (message(slot.time, 'Time'); as msg) { <mat-error>{{ msg }}</mat-error> }
                    </mat-form-field>
                  </div>
                }
              </fieldset>

              @if (banner()) {
                <p class="notice notice--danger" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ banner() }}</span>
                </p>
              }

              <div class="actions">
                <!-- Off until there is something to send: every required box filled for a new
                     lesson, and for an existing one a value that actually differs from the copy
                     the server handed back. -->
                <button mat-flat-button color="primary" type="submit"
                  [disabled]="submitting() || form.invalid || !changed()">
                  @if (submitting()) { <app-busy-ring size="20px"></app-busy-ring> }
                  @else { {{ isEdit() ? 'Save changes' : 'Create lesson' }} }
                </button>
                <a mat-button routerLink="/teacher/lessons">Cancel</a>
              </div>
            </form>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .form-page { max-width: 46rem; margin: clamp(0.5rem, 3vw, 2rem) auto; }
    .group { border: 0; padding: 0; margin: 0 0 1.5rem; }
    .group legend { padding: 0; margin-bottom: 0.6rem; }
    .group__note { margin: -0.25rem 0 0.75rem; color: var(--muted); font-size: var(--step--1); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem 1rem; }
    .span-2 { grid-column: 1 / -1; }
    /* Day and time read as one answer, so they sit on one line - the time box only as wide as
       the digits it holds. */
    .slot { display: grid; grid-template-columns: minmax(0, 1fr) 9rem; gap: 0 1rem; }
    /* The box is readonly but not disabled - it should still read as somewhere to click. */
    input[readonly] { cursor: pointer; }
    .date-suffix { display: inline-flex; align-items: center; white-space: nowrap; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem; }
    @media (max-width: 620px) {
      .grid, .slot { grid-template-columns: minmax(0, 1fr); }
    }
  `]
})
export class LessonFormComponent implements OnInit {
  submitting = signal(false);
  banner = signal<string | null>(null);
  loadError = signal<ProblemDetails | null>(null);
  isEdit = signal(false);

  /** The request as it stood when the lesson was loaded, serialised. What "unchanged" means. */
  private baseline = signal<string | null>(null);

  private lessonId: string | null = null;
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);

  protected readonly slots: ReleaseSlot[] = [
    { date: 'opensAtUtc', time: 'opensAtTime', label: 'Recording opens at', hint: 'Blank = draft.' },
    { date: 'quizOpensAtUtc', time: 'quizOpensAtTime', label: 'Quiz opens at' },
    { date: 'answersOpenAtUtc', time: 'answersOpenAtTime', label: 'Answers open at' }
  ];

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    orderIndex: [1, [Validators.required, Validators.min(1)]],
    recordingUrl: ['', [Validators.required]],
    handoutUrl: [''],
    quizUrl: [''],
    answersUrl: [''],
    durationMinutes: [30, [Validators.required, Validators.min(1), Validators.max(600)]],
    quizMaxScore: [20, [Validators.required, Validators.min(1)]],
    passMark: [10, [Validators.required, Validators.min(0)]],
    opensAtUtc: [null as Date | null],
    opensAtTime: [''],
    quizOpensAtUtc: [null as Date | null],
    quizOpensAtTime: [''],
    answersOpenAtUtc: [null as Date | null],
    answersOpenAtTime: ['']
  }, { validators: passMarkWithinTotal });

  ngOnInit(): void {
    this.lessonId = this.route.snapshot.paramMap.get('id');
    if (this.lessonId) {
      this.isEdit.set(true);
      this.loadLesson();
    }
  }

  loadLesson(): void {
    this.loadError.set(null);
    this.http.get<Lesson>(`/api/teacher/lessons/${this.lessonId}`).subscribe({
      next: (lesson) => {
        this.form.patchValue({
          title: lesson.title,
          orderIndex: lesson.orderIndex,
          recordingUrl: lesson.recordingUrl,
          handoutUrl: lesson.handoutUrl ?? '',
          quizUrl: lesson.quizUrl ?? '',
          answersUrl: lesson.answersUrl ?? '',
          durationMinutes: lesson.durationMinutes,
          quizMaxScore: lesson.quizMaxScore,
          passMark: lesson.passMark,
          opensAtUtc: datePart(lesson.opensAtUtc),
          opensAtTime: timePart(lesson.opensAtUtc),
          quizOpensAtUtc: datePart(lesson.quizOpensAtUtc),
          quizOpensAtTime: timePart(lesson.quizOpensAtUtc),
          answersOpenAtUtc: datePart(lesson.answersOpenAtUtc),
          answersOpenAtTime: timePart(lesson.answersOpenAtUtc)
        });
        this.form.markAsPristine();
        // Taken from the form rather than from the response, so "unchanged" is measured against
        // exactly what the boxes now hold - a round trip through the calendar and back included.
        this.baseline.set(JSON.stringify(this.buildBody()));
      },
      error: (err) => {
        // Only a 404 means the lesson isn't there. A dropped connection used to land here too,
        // and telling someone their lesson doesn't exist because the wifi blinked is a lie.
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.router.navigate(['/not-found']);
          return;
        }
        this.loadError.set(problemFrom(err));
      }
    });
  }

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label);
  }

  passTooHigh(): boolean {
    const control = this.form.get('passMark');
    return !!this.form.errors?.['passTooHigh'] && !!(control?.touched || control?.dirty);
  }

  /** A day picked with the time box still empty means the start of that day, and the box should
   *  say so rather than sit blank beside a date that is now real. */
  datePicked(slot: ReleaseSlot): void {
    const time = this.form.get(slot.time)!;
    if (this.form.get(slot.date)!.value && !time.value) time.setValue('00:00');
  }

  /** Clears the moment, both halves. The click is stopped from reaching the input behind it,
   *  which would otherwise reopen the calendar the instant the date was removed. */
  clearSlot(slot: ReleaseSlot, event: Event): void {
    event.stopPropagation();
    this.form.get(slot.date)!.setValue(null);
    this.form.get(slot.time)!.setValue('');
    this.form.markAsDirty();
  }

  /**
   * Whether there is anything to send. A new lesson always has - it does not exist yet, so the
   * button there turns only on the required boxes being filled. An edit has something to send
   * only once a value differs from the copy the server returned, compared value by value rather
   * than through `dirty`: re-picking the day already on file, or typing into a box and undoing
   * it, leaves the button off.
   */
  changed(): boolean {
    if (!this.isEdit()) return true;
    const base = this.baseline();
    return base !== null && JSON.stringify(this.buildBody()) !== base;
  }

  private buildBody(): LessonRequest {
    const v = this.form.getRawValue();
    return {
      title: v.title!,
      orderIndex: v.orderIndex!,
      recordingUrl: v.recordingUrl!,
      handoutUrl: v.handoutUrl || null,
      quizUrl: v.quizUrl || null,
      answersUrl: v.answersUrl || null,
      durationMinutes: v.durationMinutes!,
      quizMaxScore: v.quizMaxScore!,
      passMark: v.passMark!,
      opensAtUtc: toIso(v.opensAtUtc, v.opensAtTime),
      quizOpensAtUtc: toIso(v.quizOpensAtUtc, v.quizOpensAtTime),
      answersOpenAtUtc: toIso(v.answersOpenAtUtc, v.answersOpenAtTime)
    };
  }

  submit(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.banner.set(null);

    const body = this.buildBody();

    const req = this.isEdit()
      ? this.http.put(`/api/teacher/lessons/${this.lessonId}`, body)
      : this.http.post('/api/teacher/lessons', body);

    req.subscribe({
      next: () => {
        this.notify.success(this.isEdit() ? `Saved "${body.title}".` : `Created "${body.title}".`);
        this.router.navigate(['/teacher/lessons']);
      },
      error: (err) => {
        this.banner.set(applyServerErrors(this.form, problemFrom(err)));
        this.submitting.set(false);
      }
    });
  }
}

const pad = (n: number) => n.toString().padStart(2, '0');

/** The calendar day an instant falls on, read locally: the calendar deals in days, not instants. */
function datePart(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function timePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The two boxes back into the one instant the server stores. No day means no moment at all - a
 *  time on its own is not a release date, it is half of one. */
function toIso(date: Date | null, time: string | null | undefined): string | null {
  if (!date) return null;
  const [hours, minutes] = (time || '00:00').split(':').map(Number);
  return new Date(
    date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0
  ).toISOString();
}
