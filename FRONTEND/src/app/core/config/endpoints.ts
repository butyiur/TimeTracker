import { environment } from '../../../environments/environment';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(environment.apiBaseUrl);
export const OIDC_ISSUER = environment.oidcIssuer;

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function buildCookieLogoutUrl(returnUrl: string): string {
  const encodedReturnUrl = encodeURIComponent(returnUrl);
  return `${buildApiUrl('/api/auth/cookie-logout')}?returnUrl=${encodedReturnUrl}`;
}
