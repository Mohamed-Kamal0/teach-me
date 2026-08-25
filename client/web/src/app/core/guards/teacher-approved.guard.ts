import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const teacherApprovedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.me();
  if (!me || me.role !== 'Teacher') {
    return router.createUrlTree(['/login']);
  }
  return me.teacherStatus === 'Approved' ? true : router.createUrlTree(['/teacher/standing']);
};
