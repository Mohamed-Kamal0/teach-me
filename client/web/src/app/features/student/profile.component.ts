import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { Profile, ProblemDetails } from '../../core/models';
import { problemFrom } from '../../core/interceptors/error.interceptor';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, RouterLink, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, StatePanelComponent],
  template: `
    <h1 class="app-heading">Your profile</h1>

    <app-state-panel [loading]="loading()" [error]="error()">
      @if (profile(); as p) {
        <div class="grid">
          <mat-card>
            <mat-card-header><mat-card-title>Account</mat-card-title></mat-card-header>
            <mat-card-content>
              <p><strong>{{ p.fullName }}</strong></p>
              <p class="text-muted">{{ p.email }}</p>

              <form [formGroup]="form" (ngSubmit)="save()">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Display name (optional)</mat-label>
                  <input matInput formControlName="displayName" />
                  @if (fieldError('displayName'); as msg) { <mat-error>{{ msg }}</mat-error> }
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Phone (optional)</mat-label>
                  <input matInput formControlName="phone" />
                  @if (fieldError('phone'); as msg) { <mat-error>{{ msg }}</mat-error> }
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Bio (optional)</mat-label>
                  <textarea matInput formControlName="bio" rows="3"></textarea>
                  @if (fieldError('bio'); as msg) { <mat-error>{{ msg }}</mat-error> }
                </mat-form-field>
                <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">Save</button>
                @if (saved()) { <span class="text-success"> Saved.</span> }
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
                    <li>
                      <a [routerLink]="['/student/courses', c.teacherUserId]">{{ c.teacherFullName }}</a>
                      <span class="text-muted"> — joined {{ c.joinedAtUtc | date: 'mediumDate' }}</span>
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
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem; }
    .course-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  `]
})
export class ProfileComponent implements OnInit {
  loading = signal(true);
  error = signal<ProblemDetails | null>(null);
  profile = signal<Profile | null>(null);
  saving = signal(false);
  saved = signal(false);
  problem = signal<ProblemDetails | null>(null);

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

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

  fieldError(name: string): string | null {
    return this.problem()?.errors?.[name]?.[0] ?? null;
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saved.set(false);
    this.problem.set(null);
    this.http.put<Profile>('/api/student/profile', this.form.getRawValue()).subscribe({
      next: (p) => { this.profile.set(p); this.saving.set(false); this.saved.set(true); },
      error: (err) => { this.problem.set(problemFrom(err)); this.saving.set(false); }
    });
  }
}
