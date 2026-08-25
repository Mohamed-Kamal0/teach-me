import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.serverUnreachable()) {
    return router.createUrlTree(['/server-down']);
  }
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
