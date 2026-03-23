import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { OAuthService, OAuthStorage, provideOAuthClient } from 'angular-oauth2-oidc';




import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { initOAuthFactory } from './core/auth/oauth.init';
import { SettingsApiService } from './features/settings/data/settings-api.service';

function initThemeFactory(settingsApi: SettingsApiService): () => void {
  return () => settingsApi.applySavedTheme();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideOAuthClient(),
    { provide: OAuthStorage, useFactory: () => sessionStorage },

    {
      provide: APP_INITIALIZER,
      useFactory: initOAuthFactory,
      deps: [OAuthService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initThemeFactory,
      deps: [SettingsApiService],
      multi: true,
    },
  ],
};
