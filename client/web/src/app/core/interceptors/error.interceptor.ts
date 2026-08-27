import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { ProblemDetails } from '../models';

/** Endpoints that answer 401 as a normal part of their job. Signing in with the wrong password
 * and probing for a session are not "your session ended", so neither may trigger the bounce. */
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/logout', '/api/me'];

/** Normalises every failure — including the network dying mid-demo — into a ProblemDetails
 * shape so every screen's error state has one thing to read, and sends an expired session back
 * to the sign-in page instead of leaving a signed-out user on a screen that cannot load. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  // The injector is held rather than the services: AuthService is built on the very HttpClient
  // this interceptor belongs to, so it is resolved only once a 401 has actually happened.
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) {
        // Rebuild a real HttpErrorResponse — spreading it into a plain object would drop the
        // prototype, and callers legitimately test `instanceof` / read `.status`.
        const problem: ProblemDetails = {
          title: titleForStatus(0),
          status: 0,
          offline: true
        };
        return throwError(() => new HttpErrorResponse({
          error: problem,
          status: 0,
          statusText: 'Unknown Error',
          url: err.url ?? undefined
        }));
      }

      if (err.status === 401 && !AUTH_ENDPOINTS.some(path => req.url.includes(path))) {
        expireSession(injector);
      }

      return throwError(() => err);
    })
  );
};

function expireSession(injector: Injector): void {
  const auth = injector.get(AuthService);
  const router = injector.get(Router);
  if (!auth.isAuthenticated()) return;      // already handled by an earlier failed request
  auth.clearSession();
  const returnUrl = router.url;
  router.navigate(['/login'], {
    queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {}
  });
}

/** What a status code means to the person looking at the screen. Says what happened and what to
 * do about it — never "Error 403", never an apology. */
export function titleForStatus(status: number | undefined): string {
  switch (status) {
    case 0: return "Can't reach the server. Check your connection and try again.";
    case 400:
    case 422: return 'Some of what you entered needs another look.';
    case 401: return 'Your session has ended. Sign in to carry on.';
    case 403: return "You don't have access to this.";
    case 404: return "That isn't here any more.";
    case 409: return 'That has already been done.';
    case 429: return 'Too many tries in a row. Wait a moment, then try again.';
    default:
      if (status && status >= 500) return 'The server ran into a problem. Try again in a moment.';
      return 'Something went wrong. Try again.';
  }
}

export function problemFrom(err: unknown): ProblemDetails {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ProblemDetails | undefined;
    const offline = err.status === 0;
    // A server that named the problem is always more useful than a status code, but an HTML
    // error page (a proxy, a tunnel interstitial) is not a ProblemDetails and must not be shown.
    if (body && typeof body === 'object' && (body.title || body.errors)) {
      return { ...body, status: err.status, offline };
    }
    return { title: titleForStatus(err.status), status: err.status, offline };
  }
  return { title: 'Something went wrong. Try again.' };
}
