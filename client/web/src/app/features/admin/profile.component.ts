import { Component } from '@angular/core';
import { IdentityCardComponent } from '../../shared/identity-card.component';
import { PasswordCardComponent } from '../../shared/password-card.component';

/**
 * The administrator's profile. It exists mainly for the card at the bottom of it: the admin
 * account is seeded from `Seed:AdminPassword`, which means the first password it ever has is one
 * that also lives in a config file, a deploy script and a shell history. `DbSeeder` only ever
 * inserts — it never rewrites an existing row — so a password changed here is the password from
 * then on, and the seeded one can stop being a live credential.
 */
@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [IdentityCardComponent, PasswordCardComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Administrator</span>
        <h1 class="app-heading">Your profile</h1>
      </div>
    </div>

    <div class="stack">
      <app-identity-card></app-identity-card>
      <app-password-card></app-password-card>
    </div>
  `,
  styles: [`
    /* One column, capped: three password boxes stretched across 1100px would be a wall of
       empty field. The identity band above sets the width the eye reads to. */
    .stack { display: flex; flex-direction: column; gap: 1rem; max-width: 46rem; }
  `]
})
export class AdminProfileComponent {
}
