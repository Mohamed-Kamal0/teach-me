import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { UserRole } from '../models';

export function roleGuard(role: UserRole): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.serverUnreachable()) {
      return router.createUrlTree(['/server-down']);
    }
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    return auth.role() === role ? true : router.createUrlTree(['/']);
  };
}
