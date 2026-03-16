import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';

export const authGuard: CanActivateFn = (_route, state) => {
  const oauth = inject(OAuthService);
  const router = inject(Router);

  // callbacket soha ne blokkoljuk
  if (state.url.startsWith('/auth/callback')) return true;

  // ha van token, mehet
  if (oauth.hasValidAccessToken()) return true;

  // különben login, vissza a kért oldalra
  return router.parseUrl('/login?returnUrl=' + encodeURIComponent(state.url));
};