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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { Profile, ProblemDetails } from '../../core/models';
import { applyServerErrors, fieldMessage, revealErrors } from '../../core/form-errors';
import { problemFrom } from '../../core/interceptors/error.interceptor';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, StatePanelComponent
  ],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Student</span>
        <h1 class="app-heading">Your profile</h1>
      </div>
    </div>

    <app-state-panel [loading]="loading()" [error]="error()" (retry)="load()">
      @if (profile(); as p) {
        <div class="grid">
          <mat-card>
            <mat-card-header><mat-card-title>Account</mat-card-title></mat-card-header>
            <mat-card-content>
              <p class="identity">{{ p.fullName }}</p>
              <p class="text-muted identity__email">{{ p.email }}</p>

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

                <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
                  @if (saving()) { <mat-spinner diameter="20"></mat-spinner> } @else { Save changes }
                </button>
              </form>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header><mat-card-title>Your courses</mat-card-title></mat-card-header>
            <mat-card-content>
              @if (p.courses.length === 0) {
                <p class="text-muted">You're not on any course yet. <a routerLink="/student/join">Enter a joining code</a> to get started.</p>
              } @else {
                <ul class="course-list">
                  @for (c of p.courses; track c.teacherUserId) {
                    <li class="course-list__item">
                      <a [routerLink]="['/student/courses', c.teacherUserId]">{{ c.teacherFullName }}</a>
                      <span class="text-muted">joined {{ c.joinedAtUtc | date: 'mediumDate' }}</span>
                    </li>
                  }
                </ul>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }
    </app-state-panel>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    @media (max-width: 800px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .identity { margin: 0; font-family: 'Lora', Georgia, serif; font-size: var(--step-1); font-weight: 600; }
    .identity__email { margin: 0 0 0.5rem; font-size: var(--step--1); word-break: break-all; }
    form { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
    form button[type="submit"] { align-self: flex-start; margin-top: 0.25rem; }
    .course-list { list-style: none; padding: 0; margin: 0; }
    .course-list__item {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
      gap: 0.5rem; padding: 0.6rem 0; border-bottom: 1px solid var(--rule);
      font-size: var(--step--1);
    }
    .course-list__item:last-child { border-bottom: 0; }
    .course-list__item a { font-size: var(--step-0); font-weight: 500; }
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

  form = this.fb.group({
    displayName: ['', Validators.maxLength(120)],
    phone: ['', Validators.maxLength(30)],
    bio: ['', Validators.maxLength(500)]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<Profile>('/api/student/profile').subscribe({
      next: (p) => {
        this.profile.set(p);
        this.form.patchValue({ displayName: p.displayName ?? '', phone: p.phone ?? '', bio: p.bio ?? '' });
        this.loading.set(false);
      },
      error: (err) => { this.error.set(problemFrom(err)); this.loading.set(false); }
    });
  }

  message(name: string, label: string): string | null {
    return fieldMessage(this.form, name, label);
  }

  bioLength(): number {
    return (this.form.get('bio')?.value ?? '').length;
  }

  save(): void {
    if (this.form.invalid) {
      revealErrors(this.form);
      return;
    }
    this.saving.set(true);
    this.banner.set(null);
    this.http.put<Profile>('/api/student/profile', this.form.getRawValue()).subscribe({
      next: (p) => {
        this.profile.set(p);
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
