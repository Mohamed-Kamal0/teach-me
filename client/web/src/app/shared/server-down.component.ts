import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BusyRingComponent } from './busy-ring.component';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-server-down',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, BusyRingComponent],
  template: `
    <div class="wrap" role="alert">
      <span class="badge"><mat-icon>cloud_off</mat-icon></span>
      <span class="eyebrow">Nothing is lost</span>
      <h2 class="app-heading">Can't reach the server</h2>
      <p class="text-muted">You may still be signed in — the app just can't talk to the API right
      now. Try again once the connection is back.</p>
      <button mat-flat-button color="primary" (click)="retry()" [disabled]="checking()">
        @if (checking()) { <app-busy-ring size="20px"></app-busy-ring> } @else { Try again }
      </button>
      @if (failedAgain()) {
        <p class="text-danger">Still no answer. The API is not responding yet.</p>
      }
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
      background: var(--danger-wash);
      color: var(--danger);
    }
    .badge mat-icon { font-size: 30px; width: 30px; height: 30px; }
    h2 { margin: 0; }
    .eyebrow { margin: 0; }
  `]
})
export class ServerDownComponent {
  private auth = inject(AuthService);

  readonly checking = signal(false);
  readonly failedAgain = signal(false);

  /** Re-asks the API rather than reloading — a reload would throw away the page for nothing if
   * the server is still down. */
  async retry(): Promise<void> {
    this.checking.set(true);
    this.failedAgain.set(false);
    await this.auth.bootstrap();
    this.failedAgain.set(this.auth.serverUnreachable());
    this.checking.set(false);
  }
}
