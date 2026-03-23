import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { Subscription } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { SettingsApiService, UserSettingsDto, ThemeMode } from '../data/settings-api.service';
import {
  calculatePasswordStrength,
  DEFAULT_PASSWORD_POLICY,
  evaluatePasswordRules,
  generatePasswordByPolicy,
  passwordStrengthLabel,
  PasswordPolicyDto,
} from '../../../core/security/password-policy';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [
    `
      .page {
  min-height: 100%;
  padding: 0;
  position: relative;
  isolation: isolate;
  background: var(--tt-app-bg);
}

.page::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0));
}
      .wrap {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 1200px;
        display: grid;
        gap: 14px;
      }
      .hero {
        border: 1px solid #cbd5f1;
        border-radius: 16px;
        padding: 16px 18px;
        background:
          radial-gradient(520px 180px at 95% -30%, rgba(111, 92, 255, 0.16), rgba(111, 92, 255, 0) 65%),
          linear-gradient(180deg, #ffffff, #f8f9ff);
        box-shadow: 0 10px 24px rgba(36, 26, 92, 0.1);
      }
      .hero-kicker {
  font-size: .74rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--tt-muted);
  font-weight: 800;
}

.hero h1 {
  margin: 4px 0 0;
  font-size: clamp(1.5rem, 2.3vw, 2.15rem);
  color: var(--tt-heading);
  line-height: 1.1;
}

.hero-sub {
  margin: 8px 0 0;
  color: var(--tt-muted);
  max-width: 760px;
}

      .card {
        border: 1px solid #c5cdee;
        border-radius: 16px;
        padding: 16px;
        background: linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow: 0 12px 28px rgba(29, 18, 82, 0.16);
      }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .grid { display:grid; grid-template-columns: 190px 1fr; gap:12px 18px; }
      .label {
color: var(--tt-label);
font-weight: 700;
letter-spacing: 0.01em;
}
      input {
        padding: 10px 12px;
        border: 1px solid #bbc6ee;
        border-radius: 12px;
        min-width: 260px;
        background: #fcfdff;
        color: #1f1948;
      }
      .password-field {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        flex: 1 1 300px;
        min-width: 280px;
      }
      .password-field input {
        min-width: 0;
        width: 100%;
      }
      .toggle {
        border: 1px solid #d7dbef;
        border-radius: 12px;
        background: #fff;
        width: 46px;
        min-width: 46px;
        height: 42px;
        display: grid;
        place-items: center;
        color: #271f5a;
        cursor: pointer;
      }
      .toggle svg {
        width: 20px;
        height: 20px;
      }
      input::placeholder { color: #736a9b; }
      input:focus {
        outline: none;
        border-color: #6e59dc;
        box-shadow: 0 0 0 3px rgba(110, 89, 220, 0.2);
      }
      .ok {
        color:#0a7f20;
        border: 1px solid rgba(10, 127, 32, 0.25);
        border-radius: 12px;
        background: rgba(10, 127, 32, 0.08);
        padding: 10px 12px;
        font-weight: 700;
      }
      .error {
        color:#b00020;
        border: 1px solid rgba(176, 0, 32, 0.25);
        border-radius: 12px;
        background: rgba(176, 0, 32, 0.08);
        padding: 10px 12px;
        font-weight: 700;
      }
      .muted { color: #4f4675; }
      .login-list { margin:0; padding-left:18px; display:grid; gap:6px; color: #8d83d5; }
      .section-title { margin:0 0 10px; color: #221b50; }
      .rules { margin: 6px 0 0; padding-left:18px; display:grid; gap:4px; }
      .pass { color:#0a7f20; }
      .fail { color:#605987; }
      .meter { height:8px; background: #e8ecfb; border-radius:999px; overflow:hidden; min-width:260px; }
      .meter-fill { height:100%; background: linear-gradient(90deg, #8d73ff, #5842ca); }
      .info {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:18px;
        height:18px;
        border:1px solid #b8c1e6;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
        line-height:1;
        cursor:help;
        user-select:none;
        color: #3b3278;
        background: #f7f8ff;
      }
      .field-error { color:#b00020; margin-top:6px; }
      .status-badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid #8d83d5;
        border-radius: 999px;
        padding: 5px 10px;
        color: #3e367d;
        background: #8d83d5;
        font-weight: 700;
        font-size: .82rem;
      }
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #cfd6ef;
        border-radius: 12px;
        padding: 10px 12px;
        background: #b5aeed;
        color: #2c255f;
      }
      .theme-toggle input { min-width: 0; accent-color: #674fda; }
      a { color: #4f3fc1; }
      a:hover { color: #2f2287; }

      @media (max-width: 860px) {
        .grid { grid-template-columns: 1fr; }
        .label { padding-top: 0; }
      }
    `,
  ],
  template: `
    <section class="page">
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Beállítások</h1>
        <p class="hero-sub">{{ dashboardSub }}</p>
      </header>

      <ng-container *ngIf="settings as s">
        <div class="card">
          <h3 class="section-title">Fiók</h3>
          <div class="grid">
            <div class="label">Megjelenített név</div>
            <div>
              <div class="row">
                <input [(ngModel)]="newUserName" placeholder="Új megjelenített név" />
                <button class="btn btn-success" (click)="saveUserName()" [disabled]="busy || loading">Mentés</button>
              </div>
              <div class="muted">Jelenlegi: {{ s.userName ?? '-' }}</div>
            </div>

            <div class="label">Telefonszám</div>
            <div>
              <div class="row">
                <input [(ngModel)]="newPhoneNumber" (ngModelChange)="validatePhoneFormat()" placeholder="Telefonszám (pl. +36301234567)" maxlength="16" />
                <span class="info" title="Formátum: + jellel kezdődjön, csak számjegyek (pl. +36301234567)." aria-label="Formátum: + jellel kezdődjön, csak számjegyek (pl. +36301234567).">i</span>
                <button class="btn btn-success" (click)="savePhoneNumber()" [disabled]="busy || loading">Mentés</button>
              </div>
              <div class="muted">Jelenlegi: {{ s.phoneNumber ?? '-' }}</div>
              <div class="field-error" *ngIf="phoneValidationError">{{ phoneValidationError }}</div>
            </div>

            <div class="label">E-mail megerősítés</div>
            <div>
              <div class="muted">Állapot: {{ s.email ? (s.emailConfirmed ? 'Megerősítve' : 'Nincs megerősítve') : 'Nincs e-mail cím' }}</div>
              <div class="row" style="margin-top:8px;" *ngIf="s.email && !s.emailConfirmed">
                <button class="btn" (click)="resendEmailConfirmation()" [disabled]="busy || loading">Megerősítő e-mail újraküldése</button>
              </div>
            </div>

            <div class="label">Jelszó módosítás</div>
            <div>
              <div class="row">
                <div class="password-field">
                  <input [(ngModel)]="currentPassword" [type]="showCurrentPassword ? 'text' : 'password'" placeholder="Jelenlegi jelszó" />
                  <button
                    class="toggle"
                    type="button"
                    [attr.aria-label]="showCurrentPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'"
                    (click)="showCurrentPassword = !showCurrentPassword"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <div class="password-field">
                  <input [(ngModel)]="newPassword" [type]="showNewPassword ? 'text' : 'password'" placeholder="Új jelszó" />
                  <button
                    class="toggle"
                    type="button"
                    [attr.aria-label]="showNewPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'"
                    (click)="showNewPassword = !showNewPassword"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <button class="btn" (click)="generatePassword()" [disabled]="busy || loading">Generálás</button>
                <button class="btn btn-success" (click)="savePassword()" [disabled]="busy || loading">Jelszó módosítás</button>
              </div>
              <div class="meter" style="margin-top:8px;"><div class="meter-fill" [style.width.%]="passwordScore"></div></div>
              <div class="muted" style="margin-top:6px;">Erősség: {{ passwordStrength }}</div>
              <ul class="rules">
                <li *ngFor="let rule of passwordRules" [class.pass]="rule.passed" [class.fail]="!rule.passed">
                  {{ rule.passed ? '✓' : '•' }} {{ rule.label }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">Kétlépcsős azonosítás (2FA)</h3>
          <div class="row">
            <span class="status-badge">{{ s.twoFactorEnabled ? 'Bekapcsolva' : 'Kikapcsolva' }}</span>
          </div>
          <div class="muted" *ngIf="s.twoFactorRequired">A szerepköröd miatt kötelező (HR/Admin).</div>

          <div class="row" style="margin-top:10px;">
            <button class="btn" *ngIf="!s.twoFactorEnabled" (click)="startTotpSetup()" [disabled]="busy || loading">2FA setup indítása</button>
            <button class="btn" *ngIf="s.twoFactorEnabled" (click)="disableTotp()" [disabled]="busy || loading || s.twoFactorRequired">2FA kikapcsolása</button>
            <button class="btn" *ngIf="s.twoFactorEnabled" (click)="regenerateRecoveryCodes()" [disabled]="busy || loading">Recovery kódok újragenerálása</button>
          </div>

          <div *ngIf="totpSharedKey" style="margin-top:12px;">
            <div><strong>Shared key:</strong> {{ totpSharedKey }}</div>
            <div class="muted">Authenticator URI: {{ totpUri }}</div>
            <div class="row" style="margin-top:10px;">
              <input [(ngModel)]="totpCode" placeholder="Authenticator kód (6 számjegy)" />
              <button class="btn" (click)="enableTotp()" [disabled]="busy || loading">2FA bekapcsolása</button>
            </div>
          </div>

          <div *ngIf="recoveryCodes.length" style="margin-top:12px;">
            <div><strong>Recovery kódok:</strong></div>
            <ul class="login-list">
              <li *ngFor="let code of recoveryCodes">{{ code }}</li>
            </ul>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">Megjelenés</h3>
          <div class="theme-toggle">
            <label>
              <input type="checkbox" [checked]="theme === 'dark'" (change)="toggleTheme($event)" />
              Sötét mód
            </label>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">Utolsó bejelentkezések</h3>
          <ul class="login-list" *ngIf="s.lastLogins.length; else noLogins">
            <li *ngFor="let item of s.lastLogins">
              {{ formatDate(item.timestampUtc) }} · IP: {{ item.ipAddress ?? 'ismeretlen' }}
            </li>
          </ul>
          <ng-template #noLogins><div class="muted">Nincs még bejelentkezési napló.</div></ng-template>
        </div>

        <div class="card" *ngIf="isAdmin(s)">
          <h3 class="section-title">Admin</h3>
          <a routerLink="/admin/security">Biztonsági beállítások megnyitása</a>
        </div>

        <div class="ok" *ngIf="message">{{ message }}</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </ng-container>
    </div>
    </section>
  `,
})
export class SettingsPage implements OnInit, OnDestroy {
  private api = inject(SettingsApiService);
  private auth = inject(AuthStateService);
  private cdr = inject(ChangeDetectorRef);

  settings: UserSettingsDto | null = null;
  loading = true;

  busy = false;
  message = '';
  error = '';

  newUserName = '';
  newPhoneNumber = '';
  currentPassword = '';
  newPassword = '';
  showCurrentPassword = false;
  showNewPassword = false;

  totpSharedKey = '';
  totpUri = '';
  totpCode = '';
  recoveryCodes: string[] = [];
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private meSubscription: Subscription | null = null;

  theme: ThemeMode = 'light';
  passwordPolicy: PasswordPolicyDto = DEFAULT_PASSWORD_POLICY;
  private readonly phoneRegex = /^\+[1-9][0-9]{7,14}$/;
  phoneValidationError = '';

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'HR Irányítópult';
    if (roles.includes('Admin')) return 'Admin Irányítópult';
    return 'Dolgozói Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'Fiók, biztonság és megjelenés beállításai HR szerepkörhöz igazítva.';
    if (roles.includes('Admin')) return 'Személyes fiók, biztonság és megjelenés konfigurációja admin szerepkörhöz igazítva.';
    return 'Személyes fiók, biztonság és megjelenés konfigurációja egy egységes felületen.';
  }

  async ngOnInit(): Promise<void> {
    this.meSubscription = this.auth.me$.subscribe(me => {
      if (!me || !this.settings) return;

      const nextName = me.name ?? this.settings.userName ?? '';
      this.settings = {
        ...this.settings,
        userName: nextName,
        email: me.email ?? this.settings.email,
        emailConfirmed: me.emailConfirmed ?? this.settings.emailConfirmed,
        phoneNumber: me.phoneNumber ?? this.settings.phoneNumber,
        roles: me.roles?.length ? me.roles : this.settings.roles,
      };

      if (!this.busy) {
        this.newUserName = nextName;
      }
    });

    this.theme = this.api.getTheme();
    this.api.applySavedTheme();
    await this.loadPasswordPolicy();
    this.settings = this.createFallbackSettings();
    this.newUserName = this.settings.userName ?? '';
    await this.load();
  }

  get passwordRules() {
    return evaluatePasswordRules(this.newPassword, this.passwordPolicy);
  }

  get passwordScore(): number {
    return calculatePasswordStrength(this.newPassword, this.passwordPolicy);
  }

  get passwordStrength(): string {
    return passwordStrengthLabel(this.passwordScore);
  }

  async load(): Promise<void> {
    this.loading = true;

    try {
      const serverSettings = await this.withRetry(() => firstValueFrom(this.api.me().pipe(timeout(10000))));
      this.settings = this.normalizeSettings(serverSettings);
      this.newUserName = this.settings.userName ?? '';
      this.newPhoneNumber = this.settings.phoneNumber ?? '';
      this.phoneValidationError = '';
    } catch {
      if (!this.settings) {
        this.settings = this.createFallbackSettings();
        this.newUserName = this.settings.userName ?? '';
        this.newPhoneNumber = this.settings.phoneNumber ?? '';
      }
      this.showError('Nem sikerült betölteni a beállításokat.');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async saveUserName(): Promise<void> {
    if (!this.newUserName.trim()) return;
    await this.run(async () => {
      const normalized = this.newUserName.trim();
      const result = await firstValueFrom(this.api.changeUserName(normalized));
      if (this.settings) {
        this.settings = { ...this.settings, userName: result.userName ?? normalized };
      }
      this.newUserName = result.userName ?? normalized;
      await this.auth.refreshMe();
      await this.load();
      this.showSuccess('Megjelenített név frissítve.');
    }, 'Megjelenített név módosítás sikertelen.');
  }

  async savePhoneNumber(): Promise<void> {
    const normalized = this.newPhoneNumber.trim();
    const payload = normalized ? normalized : null;

    if (payload && !this.phoneRegex.test(payload)) {
      this.phoneValidationError = 'Nem megfelelő formátum. Példa: +36301234567';
      return;
    }

    this.phoneValidationError = '';

    await this.run(async () => {
      const result = await firstValueFrom(this.api.changePhoneNumber(payload));

      if (this.settings) {
        this.settings = {
          ...this.settings,
          phoneNumber: result.phoneNumber ?? null,
        };
      }

      this.newPhoneNumber = result.phoneNumber ?? '';
      await this.auth.refreshMe();
      await this.load();
      this.showSuccess('Telefonszám frissítve.');
    }, 'Telefonszám módosítás sikertelen.');
  }

  async resendEmailConfirmation(): Promise<void> {
    const email = this.settings?.email?.trim();
    if (!email) {
      this.showError('Nincs mentett e-mail cím a megerősítéshez.');
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.api.resendEmailConfirmation(email));
      this.showSuccess('Megerősítő e-mail elküldve (dev módban a mailbox logba íródhat).');
    }, 'Megerősítő e-mail küldése sikertelen.');
  }

  validatePhoneFormat(): void {
    const normalized = this.newPhoneNumber.trim();
    if (!normalized) {
      this.phoneValidationError = '';
      return;
    }

    this.phoneValidationError = this.phoneRegex.test(normalized)
      ? ''
      : 'Nem megfelelő formátum. Példa: +36301234567';
  }

  async savePassword(): Promise<void> {
    if (!this.currentPassword || !this.newPassword) return;
    const allRulesPass = this.passwordRules.every(x => x.passed);
    if (!allRulesPass) {
      this.showError('Az új jelszó nem felel meg az aktuális policy-nek.');
      return;
    }

    await this.run(async () => {
      await firstValueFrom(this.api.changePassword(this.currentPassword, this.newPassword));
      this.currentPassword = '';
      this.newPassword = '';
      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showSuccess('Jelszó sikeresen módosítva.');
    }, 'Jelszó módosítás sikertelen.');
  }

  async startTotpSetup(): Promise<void> {
    await this.run(async () => {
      const setupRaw = await firstValueFrom(this.api.setupTotp() as any);
      const setup = (setupRaw ?? {}) as Record<string, unknown>;
      const sharedKey = (setup['sharedKey'] ?? setup['SharedKey'] ?? setup['authenticatorKey'] ?? setup['AuthenticatorKey'] ?? '') as string;
      const authenticatorUri = (setup['authenticatorUri'] ?? setup['AuthenticatorUri'] ?? setup['otpauthUri'] ?? setup['OtpAuthUri'] ?? '') as string;

      // Keep the setup panel open as long as we received at least one usable value.
      this.totpSharedKey = String(sharedKey ?? '');
      this.totpUri = String(authenticatorUri ?? '');
      this.totpCode = '';

      if (!this.totpSharedKey && !this.totpUri) {
        throw new Error('A 2FA setup válasz nem tartalmazott használható adatot.');
      }

      this.cdr.detectChanges();
      this.showSuccess('2FA setup létrehozva. Add hozzá az authenticator apphoz, majd írd be a kódot.');
    }, '2FA setup létrehozása sikertelen.');
  }

  async enableTotp(): Promise<void> {
    if (!this.totpCode.trim()) return;
    await this.run(async () => {
      const result = await firstValueFrom(this.api.enableTotp(this.totpCode.trim()));
      this.recoveryCodes = result.recoveryCodes ?? [];
      this.totpCode = '';
      this.totpSharedKey = '';
      this.totpUri = '';
      if (this.settings) {
        this.settings = {
          ...this.settings,
          twoFactorEnabled: true,
        };
      }
      await this.load();
      this.showSuccess('2FA bekapcsolva.');
    }, '2FA bekapcsolása sikertelen.');
  }

  async disableTotp(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.disableTotp());
      this.recoveryCodes = [];
      await this.load();
      this.showSuccess('2FA kikapcsolva.');
    }, '2FA kikapcsolása sikertelen vagy a szerepkör miatt nem engedélyezett.');
  }

  async regenerateRecoveryCodes(): Promise<void> {
    await this.run(async () => {
      const result = await firstValueFrom(this.api.regenerateRecoveryCodes());
      this.recoveryCodes = result.recoveryCodes ?? [];
      this.showSuccess('Recovery kódok újragenerálva.');
    }, 'Recovery kód generálás sikertelen.');
  }

  toggleTheme(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.theme = checked ? 'dark' : 'light';
    this.api.setTheme(this.theme);
    this.showSuccess(checked ? 'Sötét mód bekapcsolva.' : 'Világos mód bekapcsolva.');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';

    const trimmed = value.trim();
    if (!trimmed) return '-';

    const hasZone = /z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/i.test(trimmed);
    const normalized = hasZone ? trimmed : `${trimmed}Z`;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('hu-HU');
  }

  isAdmin(settings: UserSettingsDto): boolean {
    return settings.roles.includes('Admin');
  }

  generatePassword(): void {
    const targetLength = Math.max(this.passwordPolicy.passwordMinLength, 12);
    this.newPassword = generatePasswordByPolicy(this.passwordPolicy, targetLength);
    this.showNewPassword = true;
  }

  private async run(action: () => Promise<void>, fallbackError: string): Promise<void> {
    this.busy = true;
    this.clearMessage();
    this.clearError();

    try {
      await action();
    } catch (e: any) {
      const msg = e?.error?.details?.[0] ?? e?.error?.error ?? fallbackError;
      this.showError(msg);
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.meSubscription?.unsubscribe();
    this.meSubscription = null;
    this.clearMessage();
    this.clearError();
  }

  private showSuccess(text: string): void {
    this.clearMessage();
    this.message = text;
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
    }, 2600);
  }

  private clearMessage(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.message = '';
  }

  private showError(text: string): void {
    this.clearError();
    this.error = text;
    this.errorTimer = setTimeout(() => {
      this.error = '';
      this.errorTimer = null;
    }, 3600);
  }

  private clearError(): void {
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
    this.error = '';
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      await this.delay(250);
      return operation();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createFallbackSettings(): UserSettingsDto {
    const me = this.auth.currentMe();

    return {
      userId: me?.userId ?? '-',
      userName: me?.name ?? this.auth.userName() ?? '-',
      email: me?.email ?? null,
      emailConfirmed: me?.emailConfirmed ?? false,
      phoneNumber: me?.phoneNumber ?? null,
      twoFactorEnabled: false,
      twoFactorRequired: false,
      roles: this.auth.roles(),
      lastLogins: [],
    };
  }

  private async loadPasswordPolicy(): Promise<void> {
    try {
      const policy = await this.withRetry(() => firstValueFrom(this.api.getPasswordPolicy().pipe(timeout(10000))));
      this.passwordPolicy = {
        ...DEFAULT_PASSWORD_POLICY,
        ...policy,
      };
    } catch {
      this.passwordPolicy = DEFAULT_PASSWORD_POLICY;
    }
  }

  private normalizeSettings(dto: UserSettingsDto): UserSettingsDto {
    const normalizedLogins = (dto.lastLogins ?? []).map((item: any) => {
      const timestampUtc =
        item?.timestampUtc ??
        item?.timestampUTC ??
        item?.timestamp ??
        item?.TimestampUtc ??
        '';

      return {
        timestampUtc,
        ipAddress: item?.ipAddress ?? item?.IpAddress ?? null,
        userAgent: item?.userAgent ?? item?.UserAgent ?? null,
      };
    });

    return {
      ...dto,
      lastLogins: normalizedLogins,
    };
  }
}
