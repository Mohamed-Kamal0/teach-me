import { Component, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { routeFade } from './app.animations';
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
    MatMenuModule, MatSidenavModule, MatTooltipModule,
    HelperWidgetComponent, ServerDownComponent,
    AvatarComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [routeFade]
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  /** The nav drawer, for widths where the links cannot sit in the bar. */
  readonly drawerOpen = signal(false);

  /** True while the router is fetching and activating a page. Starts true because the first
   * navigation is already under way by the time this component exists. */
  readonly navigating = signal(true);

  /** Drives the page cross-fade: a new value on every navigation runs the `routeFade` transition.
   * Held constant when the reader asked for less motion, so no transition ever fires. */
  readonly routeKey = signal('');

  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** The one destination that is not behind a session. Signed out, it is the only thing in the
   * bar worth navigating to; a teacher or admin doesn't get it — their bars are full and the
   * directory isn't aimed at them. */
  private static readonly directory: NavLink = { path: '/teachers', label: 'Teachers', icon: 'groups' };

  readonly links = computed<NavLink[]>(() => {
    const me = this.auth.me();
    if (!me) return [AppComponent.directory];

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
          AppComponent.directory,
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
    // This component only exists once the session check in APP_INITIALIZER has come back, so
    // reaching here is the signal that index.html's loading splash has done its job.
    document.querySelector('.app-splash')?.remove();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.navigating.set(true);
        return;
      }
      // Cancelled and failed navigations end the wait too — otherwise a guard that redirects
      // nowhere would leave the spinner turning over an empty page for good.
      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.navigating.set(false);
        return;
      }
      if (event instanceof NavigationEnd) {
        this.navigating.set(false);
        // A drawer left open across a navigation covers the page it just opened.
        this.drawerOpen.set(false);
        if (!this.reduceMotion) this.routeKey.set(event.urlAfterRedirects.split('?')[0]);
      }
    });
  }

  /** Where the account menu's "Profile" link points, or null for roles without a profile page. */
  get profilePath(): string | null {
    switch (this.auth.role()) {
      case 'Student': return '/student/profile';
      case 'Teacher': return '/teacher/profile';
      case 'Admin': return '/admin/profile';
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

  /** The glyph the role badge wears. Distinct from any nav icon, so the badge is not mistaken
   * for a destination. */
  roleIcon(): string {
    switch (this.auth.role()) {
      case 'Admin': return 'shield_person';
      case 'Teacher': return 'co_present';
      case 'Student': return 'person';
      default: return 'person';
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
