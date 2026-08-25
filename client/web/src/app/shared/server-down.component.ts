import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-server-down',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="wrap">
      <mat-icon class="text-danger">cloud_off</mat-icon>
      <h2 class="app-heading">Can't reach the server</h2>
      <p class="text-muted">You may still be signed in — the app just can't talk to the API right
      now. Once it's back, reload this page.</p>
      <button mat-flat-button color="primary" (click)="reload()">Try again</button>
    </div>
  `,
  styles: [`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:4rem 1rem; text-align:center; }
    mat-icon { font-size: 48px; width:48px; height:48px; }
  `]
})
export class ServerDownComponent {
  reload(): void {
    window.location.reload();
  }
}
