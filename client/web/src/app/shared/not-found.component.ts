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
      <mat-icon class="text-muted">search_off</mat-icon>
      <h2 class="app-heading">We couldn't find that page.</h2>
      <p class="text-muted">It may have moved, or the id in the address doesn't exist.</p>
      <a mat-flat-button color="primary" routerLink="/">Back to the home page</a>
    </div>
  `,
  styles: [`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:4rem 1rem; text-align:center; }
    mat-icon { font-size: 48px; width:48px; height:48px; }
  `]
})
export class NotFoundComponent {}
