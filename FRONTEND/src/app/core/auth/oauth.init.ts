import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth.config';

export function initOAuthFactory(oauth: OAuthService) {
  return async () => {
    try {
      oauth.configure(authConfig);
      await oauth.loadDiscoveryDocument();
      // Temporary: disable auto refresh to avoid noisy /connect/token 400 loops while stabilizing auth flow.
    } catch (e) {
      console.error('OAuth init failed', e);
    }
  };
}