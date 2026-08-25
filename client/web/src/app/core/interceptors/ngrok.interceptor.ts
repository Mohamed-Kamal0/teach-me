import { HttpInterceptorFn } from '@angular/common/http';

/**
 * ngrok's free tier answers browser-looking traffic with an interstitial warning page instead of
 * forwarding it, which would turn every API call into an HTML page the client cannot parse. Any
 * value of this header skips it. The header is inert once the API is hosted somewhere else, so it
 * costs nothing to leave in place.
 *
 * These requests are same-origin — Vercel rewrites /api to the tunnel — so the custom header does
 * not trigger a CORS preflight.
 */
export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ setHeaders: { 'ngrok-skip-browser-warning': 'true' } }));
};
