import { Component } from '@angular/core';
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
          <div class="standing text-warning">
            <mat-icon>lock_clock</mat-icon>
            <h2 class="app-heading">Your account is waiting</h2>
            <p>An administrator hasn't reviewed your registration yet. Check back soon — this
            page updates as soon as a decision is made, no need to sign in again.</p>
          </div>
        }
        @case ('Rejected') {
          <div class="standing text-danger">
            <mat-icon>block</mat-icon>
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
          <div class="standing text-success">
            <mat-icon>check_circle</mat-icon>
            <h2 class="app-heading">You're approved</h2>
            <p>Head to your lessons to get started.</p>
            <a mat-flat-button color="primary" routerLink="/teacher/lessons">Go to lessons</a>
          </div>
        }
      }
    }
  `,
  styles: [`
    .standing { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; max-width: 480px; padding: 1.5rem 0; }
    mat-icon { font-size: 32px; width: 32px; height: 32px; }
  `]
})
export class TeacherStandingComponent {
  constructor(public auth: AuthService) {}
}
