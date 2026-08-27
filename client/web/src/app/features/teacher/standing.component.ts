import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-teacher-standing',
  standalone: true,
  imports: [DatePipe, RouterLink, MatIconModule, MatButtonModule],
  template: `
    @if (auth.me(); as me) {
      @switch (me.teacherStatus) {
        @case ('Pending') {
          <div class="standing standing--waiting">
            <span class="badge"><mat-icon>lock_clock</mat-icon></span>
            <span class="eyebrow">Awaiting review</span>
            <h2 class="app-heading">Your account is waiting</h2>
            <p>An administrator hasn't reviewed your registration yet. Check back soon — this
            page updates as soon as a decision is made, no need to sign in again.</p>
          </div>
        }
        @case ('Rejected') {
          <div class="standing standing--refused">
            <span class="badge"><mat-icon>block</mat-icon></span>
            <span class="eyebrow">Decision made</span>
            <h2 class="app-heading">You were not approved</h2>
            <p>
              @if (me.teacherDecidedAtUtc) {
                An administrator turned this registration away on {{ me.teacherDecidedAtUtc | date: 'mediumDate' }}.
              } @else {
                An administrator turned this registration away.
              }
            </p>
          </div>
        }
        @case ('Approved') {
          <div class="standing standing--open">
            <span class="badge"><mat-icon>check_circle</mat-icon></span>
            <span class="eyebrow">Approved</span>
            <h2 class="app-heading">You're approved</h2>
            <p>Your courses are open. Publish a lesson and its parts will release on the schedule you set.</p>
            <a mat-flat-button color="primary" routerLink="/teacher/lessons">Go to lessons</a>
          </div>
        }
      }
    }
  `,
  styles: [`
    .standing {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
      max-width: 34rem;
      margin: clamp(0.5rem, 3vw, 1.5rem) 0;
      padding: clamp(1.25rem, 4vw, 2rem);
      border: 1px solid var(--border);
      border-left: 4px solid var(--muted);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow-1);
    }
    .standing h2 { margin: 0; }
    .standing p { margin: 0; color: var(--muted); }
    .eyebrow { margin: 0; }
    .badge {
      display: grid; place-items: center;
      width: 48px; height: 48px; border-radius: 999px;
      background: var(--paper-sunk); color: var(--muted); margin-bottom: 0.25rem;
    }
    .badge mat-icon { font-size: 26px; width: 26px; height: 26px; }

    /* Status is colour, icon and word together — never colour on its own (plan §8). */
    .standing--waiting { border-left-color: var(--warning); }
    .standing--waiting .badge { background: var(--warning-wash); color: var(--warning-text); }
    .standing--waiting .eyebrow { color: var(--warning-text); }

    .standing--refused { border-left-color: var(--danger); }
    .standing--refused .badge { background: var(--danger-wash); color: var(--danger); }
    .standing--refused .eyebrow { color: var(--danger); }

    .standing--open { border-left-color: var(--success); }
    .standing--open .badge { background: var(--success-wash); color: var(--success); }
    .standing--open .eyebrow { color: var(--success); }
    .standing--open a { margin-top: 0.5rem; }
  `]
})
export class TeacherStandingComponent {
  readonly auth = inject(AuthService);
}
