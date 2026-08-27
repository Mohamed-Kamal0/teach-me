import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ngrokInterceptor } from './core/interceptors/ngrok.interceptor';
import { AuthService } from './core/auth.service';

function bootstrapAuth(auth: AuthService) {
  return () => auth.bootstrap();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([credentialsInterceptor, ngrokInterceptor, errorInterceptor]),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })
    ),
    // MatSnackBar is provided by its module, so the module has to be loaded for NotifyService
    // to be able to inject it anywhere in the app.
    importProvidersFrom(MatSnackBarModule),
    { provide: APP_INITIALIZER, useFactory: bootstrapAuth, deps: [AuthService], multi: true }
  ]
};
