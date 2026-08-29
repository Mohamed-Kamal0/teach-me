import { Component } from '@angular/core';
import { IdentityCardComponent } from '../../shared/identity-card.component';
import { PasswordCardComponent } from '../../shared/password-card.component';
import { TeachingProfileCardComponent } from './teaching-profile-card.component';

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [IdentityCardComponent, TeachingProfileCardComponent, PasswordCardComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your profile</h1>
      </div>
    </div>

    <div class="stack">
      <app-identity-card></app-identity-card>
      <!-- Above the password card: the subject and the phone are the things on this page a
           teacher comes back to change, and a password reset is the thing they hope never to
           need. -->
      <app-teaching-profile-card></app-teaching-profile-card>
      <app-password-card></app-password-card>
    </div>
  `,
  styles: [`
    /* One column, capped: three password boxes stretched across 1100px would be a wall of
       empty field. The identity band above sets the width the eye reads to. */
    .stack { display: flex; flex-direction: column; gap: 1rem; max-width: 46rem; }
  `]
})
export class TeacherProfileComponent {
}
