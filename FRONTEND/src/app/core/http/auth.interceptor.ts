import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { API_BASE_URL } from '../config/endpoints';

const API_BASE = API_BASE_URL;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauth = inject(OAuthService);

  // csak a saját API-ra
  if (!req.url.startsWith(API_BASE)) {
    return next(req);
  }

  // ezekre NE tegyünk tokent (ha mégis, néha gondot okoz)
  if (req.url.includes('/.well-known/') || req.url.includes('/connect/')) {
    return next(req);
  }

  const token = oauth.getAccessToken();
  if (!token) return next(req);

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  // Debug: csak a /api/auth/me-re logolunk
  if (req.url.startsWith(`${API_BASE}/api/auth/me`)) {
    console.log('[authInterceptor] attached bearer to /api/auth/me');
  }

  return next(authReq);
};