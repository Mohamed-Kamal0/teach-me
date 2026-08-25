import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ProblemDetails } from '../models';

/** Normalises every failure — including the network dying mid-demo — into a ProblemDetails
 * shape so every screen's error state has one thing to read. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) {
        // Rebuild a real HttpErrorResponse — spreading it into a plain object would drop the
        // prototype, and callers legitimately test `instanceof` / read `.status`.
        const problem: ProblemDetails = {
          title: "Can't reach the server. Check your connection and try again.",
          status: 0
        };
        return throwError(() => new HttpErrorResponse({
          error: problem,
          status: 0,
          statusText: 'Unknown Error',
          url: err.url ?? undefined
        }));
      }
      return throwError(() => err);
    })
  );
};

export function problemFrom(err: unknown): ProblemDetails {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ProblemDetails | undefined;
    return body?.title
      ? body
      : { title: "Can't reach the server. Check your connection and try again.", status: err.status };
  }
  return { title: 'Something went wrong.' };
}
