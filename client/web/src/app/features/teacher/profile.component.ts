import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../core/auth.service';
import { PhotoCardComponent } from '../../shared/photo-card.component';

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [MatCardModule, PhotoCardComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Teacher</span>
        <h1 class="app-heading">Your profile</h1>
      </div>
    </div>

    <div class="grid">
      <app-photo-card></app-photo-card>

      @if (auth.me(); as me) {
        <mat-card>
          <mat-card-header><mat-card-title>Account</mat-card-title></mat-card-header>
          <mat-card-content>
            <p class="identity">{{ me.fullName }}</p>
            <p class="text-muted identity__email">{{ me.email }}</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    @media (max-width: 800px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .identity { margin: 0; font-family: 'Lora', Georgia, serif; font-size: var(--step-1); font-weight: 600; }
    .identity__email { margin: 0; font-size: var(--step--1); word-break: break-all; }
  `]
})
export class TeacherProfileComponent {
  readonly auth = inject(AuthService);
}
