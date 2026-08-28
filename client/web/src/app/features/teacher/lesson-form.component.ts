import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
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

@Component({
  selector: 'app-lesson-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatCardModule, MatIconModule, BusyRingComponent
  ],
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
                <div class="grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Recording opens at</mat-label>
                    <input matInput type="datetime-local" formControlName="opensAtUtc" />
                    <mat-hint>Blank = draft.</mat-hint>
                    @if (message('opensAtUtc', 'Recording opens at'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Quiz opens at</mat-label>
                    <input matInput type="datetime-local" formControlName="quizOpensAtUtc" />
                    @if (message('quizOpensAtUtc', 'Quiz opens at'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Answers open at</mat-label>
                    <input matInput type="datetime-local" formControlName="answersOpenAtUtc" />
                    @if (message('answersOpenAtUtc', 'Answers open at'); as msg) { <mat-error>{{ msg }}</mat-error> }
                  </mat-form-field>
                </div>
              </fieldset>

              @if (banner()) {
                <p class="notice notice--danger" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ banner() }}</span>
                </p>
              }

              <div class="actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
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
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem; }
    @media (max-width: 620px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
    }
  `]
})
export class LessonFormComponent implements OnInit {
  submitting = signal(false);
  banner = signal<string | null>(null);
  loadError = signal<ProblemDetails | null>(null);
  isEdit = signal(false);

  private lessonId: string | null = null;
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);

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
    opensAtUtc: [''],
    quizOpensAtUtc: [''],
    answersOpenAtUtc: ['']
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
      next: (lesson) => this.form.patchValue({
        title: lesson.title,
        orderIndex: lesson.orderIndex,
        recordingUrl: lesson.recordingUrl,
        handoutUrl: lesson.handoutUrl ?? '',
        quizUrl: lesson.quizUrl ?? '',
        answersUrl: lesson.answersUrl ?? '',
        durationMinutes: lesson.durationMinutes,
        quizMaxScore: lesson.quizMaxScore,
        passMark: lesson.passMark,
        opensAtUtc: toLocalInput(lesson.opensAtUtc),
        quizOpensAtUtc: toLocalInput(lesson.quizOpensAtUtc),
        answersOpenAtUtc: toLocalInput(lesson.answersOpenAtUtc)
      }),
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

  submit(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.submitting.set(true);
    this.banner.set(null);

    const v = this.form.getRawValue();
    const body: LessonRequest = {
      title: v.title!,
      orderIndex: v.orderIndex!,
      recordingUrl: v.recordingUrl!,
      handoutUrl: v.handoutUrl || null,
      quizUrl: v.quizUrl || null,
      answersUrl: v.answersUrl || null,
      durationMinutes: v.durationMinutes!,
      quizMaxScore: v.quizMaxScore!,
      passMark: v.passMark!,
      opensAtUtc: fromLocalInput(v.opensAtUtc),
      quizOpensAtUtc: fromLocalInput(v.quizOpensAtUtc),
      answersOpenAtUtc: fromLocalInput(v.answersOpenAtUtc)
    };

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

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
