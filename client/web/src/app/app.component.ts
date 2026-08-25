import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from './core/auth.service';
import { HelperWidgetComponent } from './features/helper/helper-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, HelperWidgetComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(public auth: AuthService, private router: Router) {}

  roleChipClass(): string {
    switch (this.auth.role()) {
      case 'Admin': return 'chip-admin';
      case 'Teacher': return 'chip-teacher';
      case 'Student': return 'chip-student';
      default: return '';
    }
  }

  async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
