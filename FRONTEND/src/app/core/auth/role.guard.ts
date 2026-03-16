import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStateService } from './auth-state.service';

export const roleGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    const returnUrl = state?.url?.length ? state.url : '/time';
    return router.parseUrl('/login?returnUrl=' + encodeURIComponent(returnUrl));
  }

  const required = (route.data?.['roles'] as string[] | undefined) ?? [];
  if (!required.length) return true;

  await auth.ensureMeLoaded();

  if (auth.hasAnyRole(required)) return true;

  await auth.refreshMe();

  if (auth.hasAnyRole(required)) return true;

  // If role profile could not be loaded, force a clean re-login instead of showing a misleading forbidden page.
  if (!auth.currentMe()) {
    const returnUrl = state?.url?.length ? state.url : '/overview';
    return router.parseUrl('/login?returnUrl=' + encodeURIComponent(returnUrl));
  }

  return router.parseUrl('/forbidden');
};