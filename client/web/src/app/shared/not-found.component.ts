import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="wrap">
      <span class="badge"><mat-icon>search_off</mat-icon></span>
      <span class="eyebrow">404</span>
      <h2 class="app-heading">We couldn't find that page.</h2>
      <p class="text-muted">It may have moved, or the id in the address doesn't exist.</p>
      <a mat-flat-button color="primary" routerLink="/">Back to the home page</a>
    </div>
  `,
  styles: [`
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      max-width: 30rem;
      margin: clamp(1.5rem, 6vw, 4rem) auto;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      text-align: center;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow-1);
    }
    .badge {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 999px;
      background: var(--paper-sunk);
      color: var(--muted);
    }
    .badge mat-icon { font-size: 30px; width: 30px; height: 30px; }
    h2 { margin: 0; }
    .eyebrow { margin: 0; }
  `]
})
export class NotFoundComponent {}
