import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from './auth.config';

export function initOAuthFactory(oauth: OAuthService) {
  return async () => {
    try {
      oauth.configure(authConfig);
      await oauth.loadDiscoveryDocument();
    } catch (e) {
      console.error('OAuth init failed', e);
    }
  };
}
