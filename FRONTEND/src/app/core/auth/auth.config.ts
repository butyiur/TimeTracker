import { AuthConfig } from 'angular-oauth2-oidc';
import { OIDC_ISSUER } from '../config/endpoints';

export const authConfig: AuthConfig = {
  issuer: OIDC_ISSUER,

  redirectUri: window.location.origin + '/auth/callback',
  postLogoutRedirectUri: window.location.origin + '/',

  clientId: 'timetracker-angular-spa',
  responseType: 'code',

  // ha roles-okat akarsz tokenben/claims-ben, kell az openid + profile minimum
  scope: 'openid profile api roles offline_access',

  // a te verziód nem ismeri a responseMode/usePkce mezőket → ne írd bele
  strictDiscoveryDocumentValidation: false, // most már egyezni fog, ezért lehet true
  requireHttps: true,
};