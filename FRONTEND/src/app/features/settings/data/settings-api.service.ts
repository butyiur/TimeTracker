import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PasswordPolicyDto } from '../../../core/security/password-policy';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;
const THEME_KEY = 'tt.theme';

export type ThemeMode = 'light' | 'dark';

export type LastLoginDto = {
  timestampUtc: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type UserSettingsDto = {
  userId: string;
  userName: string | null;
  email: string | null;
  emailConfirmed: boolean;
  phoneNumber: string | null;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
  roles: string[];
  lastLogins: LastLoginDto[];
};

export type TotpSetupDto = {
  sharedKey: string;
  authenticatorUri: string;
};

export type TotpEnableDto = {
  enabled: boolean;
  recoveryCodes: string[];
};

export type SecurityPolicyDto = {
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireDigit: boolean;
  passwordRequireNonAlphanumeric: boolean;
};

export type LockedUserDto = {
  userId: string;
  userName: string | null;
  email: string | null;
  accessFailedCount: number;
  lockoutEnd: string | null;
  lockoutEnabled: boolean;
  isLockedOut: boolean;
  lockoutStartedAtUtc: string | null;
};

export type ResetRequestLogDto = {
  timestampUtc: string;
  to: string | null;
  subject: string | null;
  resetUrl: string | null;
};

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private http: HttpClient) {}

  me(): Observable<UserSettingsDto> {
    return this.http.get<UserSettingsDto>(`${API_BASE}/api/settings/me`);
  }

  getPasswordPolicy(): Observable<PasswordPolicyDto> {
    return this.http.get<PasswordPolicyDto>(`${API_BASE}/api/auth/password-policy`);
  }

  resendEmailConfirmation(email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API_BASE}/api/auth/resend-email-confirmation`, {
      email,
    });
  }

  changeUserName(newUserName: string): Observable<{ ok: boolean; userName: string }> {
    return this.http.post<{ ok: boolean; userName: string }>(`${API_BASE}/api/settings/me/username`, {
      newUserName,
    });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API_BASE}/api/settings/me/password`, {
      currentPassword,
      newPassword,
    });
  }

  changePhoneNumber(phoneNumber: string | null): Observable<{ ok: boolean; phoneNumber: string | null }> {
    return this.http.post<{ ok: boolean; phoneNumber: string | null }>(`${API_BASE}/api/settings/me/phone`, {
      phoneNumber,
    });
  }

  setupTotp(): Observable<TotpSetupDto> {
    return this.http.post<TotpSetupDto>(`${API_BASE}/api/account/2fa/totp/setup`, {});
  }

  enableTotp(code: string): Observable<TotpEnableDto> {
    return this.http.post<TotpEnableDto>(`${API_BASE}/api/account/2fa/totp/enable`, { code });
  }

  disableTotp(): Observable<{ enabled: boolean }> {
    return this.http.post<{ enabled: boolean }>(`${API_BASE}/api/account/2fa/totp/disable`, {});
  }

  regenerateRecoveryCodes(): Observable<{ recoveryCodes: string[] }> {
    return this.http.post<{ recoveryCodes: string[] }>(`${API_BASE}/api/account/2fa/recoverycodes/regenerate`, {});
  }

  getSecurityPolicy(): Observable<SecurityPolicyDto> {
    return this.http.get<SecurityPolicyDto>(`${API_BASE}/api/admin/security/policy`);
  }

  updateSecurityPolicy(payload: SecurityPolicyDto): Observable<SecurityPolicyDto> {
    return this.http.put<SecurityPolicyDto>(`${API_BASE}/api/admin/security/policy`, payload);
  }

  getLockedUsers(): Observable<LockedUserDto[]> {
    return this.http.get<LockedUserDto[]>(`${API_BASE}/api/admin/security/locked-users`);
  }

  getResetRequests(take = 50): Observable<ResetRequestLogDto[]> {
    return this.http.get<ResetRequestLogDto[]>(`${API_BASE}/api/admin/security/reset-requests?take=${take}`);
  }

  unlockUser(userId: string): Observable<{ ok: boolean; userId: string }> {
    return this.http.post<{ ok: boolean; userId: string }>(`${API_BASE}/api/admin/security/unlock/${encodeURIComponent(userId)}`, {});
  }

  getTheme(): ThemeMode {
    const current = localStorage.getItem(THEME_KEY);
    return current === 'dark' ? 'dark' : 'light';
  }

  setTheme(theme: ThemeMode): void {
    localStorage.setItem(THEME_KEY, theme);
    this.applyTheme(theme);
  }

  applySavedTheme(): void {
    this.applyTheme(this.getTheme());
  }

  private applyTheme(theme: ThemeMode): void {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('tt-dark');
    } else {
      html.classList.remove('tt-dark');
    }
  }
}
