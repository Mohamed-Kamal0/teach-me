import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AuthService } from './core/auth.service';
import { NotifyService } from './core/notify.service';
import { HelperWidgetComponent } from './features/helper/helper-widget.component';
import { ServerDownComponent } from './shared/server-down.component';
import { AvatarComponent } from './shared/avatar.component';

/** A destination in the app bar. The icon is the one the plan assigns to that concept, so the
 * drawer and the bar name the same thing the same way. */
export interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatSidenavModule, HelperWidgetComponent, ServerDownComponent, AvatarComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  /** The nav drawer, for widths where the links cannot sit in the bar. */
  readonly drawerOpen = signal(false);

  readonly links = computed<NavLink[]>(() => {
    const me = this.auth.me();
    if (!me) return [];

    switch (me.role) {
      case 'Admin':
        return [{ path: '/admin/approvals', label: 'Approvals', icon: 'how_to_reg' }];
      case 'Teacher': {
        const standing: NavLink = { path: '/teacher/standing', label: 'Standing', icon: 'badge' };
        if (me.teacherStatus !== 'Approved') return [standing];
        return [
          standing,
          { path: '/teacher/lessons', label: 'Lessons', icon: 'menu_book' },
          { path: '/teacher/students', label: 'Students', icon: 'group' },
          { path: '/teacher/progress', label: 'Progress', icon: 'insights' }
        ];
      }
      case 'Student':
        return [
          { path: '/student/courses', label: 'Courses', icon: 'school' },
          { path: '/student/join', label: 'Join', icon: 'key' },
          { path: '/student/whats-new', label: "What's New", icon: 'celebration' },
          { path: '/student/marks', label: 'Marks', icon: 'grade' },
          { path: '/student/profile', label: 'Profile', icon: 'account_circle' }
        ];
      default:
        return [];
    }
  });

  constructor() {
    // A drawer left open across a navigation covers the page it just opened.
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.drawerOpen.set(false));
  }

  /** Where the account menu's "Profile" link points, or null for roles without a profile page. */
  get profilePath(): string | null {
    switch (this.auth.role()) {
      case 'Student': return '/student/profile';
      case 'Teacher': return '/teacher/profile';
      default: return null;
    }
  }

  roleChipClass(): string {
    switch (this.auth.role()) {
      case 'Admin': return 'chip-admin';
      case 'Teacher': return 'chip-teacher';
      case 'Student': return 'chip-student';
      default: return '';
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.auth.logout();
    } catch {
      // The session is cleared either way; say so rather than leaving the sign-out silent.
      this.notify.error("Signed out on this device, but the server didn't confirm it.");
    }
    await this.router.navigate(['/']);
  }
}
