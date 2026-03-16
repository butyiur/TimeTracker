import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { LockedUserDto, ResetRequestLogDto, SecurityPolicyDto, SettingsApiService } from '../data/settings-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { max-width: 980px; display:grid; gap:16px; }
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
        color: #5d5684;
        font-weight: 800;
      }
      .hero h1 {
        margin: 4px 0 0;
        font-size: clamp(1.5rem, 2.3vw, 2.15rem);
        color: #1f1a56;
        line-height: 1.1;
      }
      .hero-sub {
        margin-top: 8px;
        color: #5a527f;
      }
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:16px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      input { padding:8px 10px; border:1px solid #bcc6eb; border-radius:12px; width:140px; }
      .btn {
        padding:8px 13px;
        border:1px solid rgba(143, 124, 245, 0.68);
        border-radius:12px;
        background:linear-gradient(135deg, #8f75ff, #654dd6);
        color:#fff;
        cursor:pointer;
        font-weight:700;
      }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
      .btn-success { border-color: rgba(31, 138, 82, 0.72); background: linear-gradient(135deg, #2fb36c, #1f8a52); }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #eee; padding:8px; }
      .ok { color:#0a7f20; }
      .error { color:#b00020; }
      .muted { opacity:1; color:#544c7a; }
      .policy-grid { display:grid; gap:10px; }
      .slider-wrap { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .slider { width:220px; }
      .link-actions { display:flex; gap:8px; align-items:center; }
      .age-badge {
        display:inline-flex;
        align-items:center;
        padding:2px 8px;
        border-radius:999px;
        border:1px solid transparent;
        font-size:12px;
        font-weight:600;
        line-height:1.3;
      }
      .info {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:18px;
        height:18px;
        border:1px solid #bbb;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
        line-height:1;
        cursor:help;
        user-select:none;
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">Admin Irányítópult</div>
        <h1>Biztonsági beállítások</h1>
        <div class="hero-sub">Hitelesítési policy, zárolások és reset kérelmek felügyelete.</div>
      </header>

      <ng-container>
        <div class="card">
          <h3>Bejelentkezési policy</h3>
          <div class="policy-grid" style="margin-top:10px;">
            <div class="row">
              <label>Session timeout (perc)</label>
              <input type="number" min="5" max="1440" [(ngModel)]="policy.sessionTimeoutMinutes" />

              <label>Max sikertelen próbálkozás</label>
              <span class="info" title="A legkisebb megadható érték 3." aria-label="A legkisebb megadható érték 3.">i</span>
              <input type="number" min="3" max="20" [(ngModel)]="policy.maxFailedLoginAttempts" />
            </div>

            <div class="slider-wrap">
              <label>Jelszó min. hossz</label>
              <input class="slider" type="range" min="6" max="32" [(ngModel)]="policy.passwordMinLength" />
              <input type="number" min="6" max="128" [(ngModel)]="policy.passwordMinLength" />
            </div>

            <div class="row">
              <label>
              <input type="checkbox" [(ngModel)]="policy.passwordRequireUppercase" />
              Kötelező nagybetű
              </label>

              <label>
              <input type="checkbox" [(ngModel)]="policy.passwordRequireLowercase" />
              Kötelező kisbetű
              </label>

              <label>
              <input type="checkbox" [(ngModel)]="policy.passwordRequireDigit" />
              Kötelező szám
              </label>

              <label>
              <input type="checkbox" [(ngModel)]="policy.passwordRequireNonAlphanumeric" />
              Kötelező speciális karakter
              </label>
            </div>

            <div class="row">
              <button class="btn btn-success" (click)="savePolicy()" [disabled]="busy || loading">Mentés</button>
            </div>
          </div>
          <div class="muted" style="margin-top:8px;">A jelszó policy a regisztrációra és jelszócserére azonnal érvényes. A lockout túllépés után admin feloldással oldható fel.</div>
        </div>

        <div class="card">
          <div class="row" style="justify-content:space-between;">
            <h3>Zárolt fiókok</h3>
            <button class="btn" (click)="loadLockedUsers()" [disabled]="busy || loading">Frissítés</button>
          </div>

          <table *ngIf="lockedUsers.length; else noLockedUsers">
            <thead>
              <tr>
                <th>Felhasználó</th>
                <th>E-mail</th>
                <th>Sikertelen próbák</th>
                <th>Állapot</th>
                <th>Zárolás kezdete</th>
                <th>Kora</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of lockedUsers">
                <td>{{ user.userName ?? '-' }}</td>
                <td>{{ user.email ?? '-' }}</td>
                <td>{{ user.accessFailedCount }}</td>
                <td>{{ user.isLockedOut ? 'Zárolt' : 'Nincs zárolva' }}</td>
                <td>{{ user.lockoutStartedAtUtc ? formatDate(user.lockoutStartedAtUtc) : '-' }}</td>
                <td>
                  <span
                    class="age-badge"
                    *ngIf="user.lockoutStartedAtUtc; else noLockAge"
                    [ngStyle]="lockAgeStyle(user.lockoutStartedAtUtc)">
                    {{ lockAgeLabel(user.lockoutStartedAtUtc) }}
                  </span>
                  <ng-template #noLockAge>-</ng-template>
                </td>
                <td><button class="btn btn-success" (click)="unlock(user)" [disabled]="busy || loading">Feloldás</button></td>
              </tr>
            </tbody>
          </table>

          <ng-template #noLockedUsers>
            <div class="muted">Nincs zárolt felhasználó.</div>
          </ng-template>
        </div>

        <div class="card">
          <div class="row" style="justify-content:space-between;">
            <h3>Jelszó reset kérelmek (dev)</h3>
            <button class="btn" (click)="loadResetRequests()" [disabled]="busy || loading">Frissítés</button>
          </div>

          <table *ngIf="resetRequests.length; else noResetRequests">
            <thead>
              <tr>
                <th>Időpont</th>
                <th>Címzett</th>
                <th>Tárgy</th>
                <th>Reset link</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of resetRequests">
                <td>{{ formatDate(item.timestampUtc) }}</td>
                <td>{{ item.to ?? '-' }}</td>
                <td>{{ item.subject ?? '-' }}</td>
                <td>
                  <div class="link-actions" *ngIf="item.resetUrl; else noResetLink">
                    <a [href]="item.resetUrl" target="_blank" rel="noreferrer">Megnyitás</a>
                    <button class="btn" (click)="copyResetUrl(item.resetUrl)" [disabled]="busy || loading">Másolás</button>
                  </div>
                  <ng-template #noResetLink>
                    <span>-</span>
                  </ng-template>
                </td>
              </tr>
            </tbody>
          </table>

          <ng-template #noResetRequests>
            <div class="muted">Nincs reset kérelem a dev mailbox logban.</div>
          </ng-template>
        </div>

        <div class="ok" *ngIf="message">{{ message }}</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </ng-container>
    </div>
  `,
})
export class AdminSecurityPage implements OnInit, OnDestroy {
  private api = inject(SettingsApiService);
  private cdr = inject(ChangeDetectorRef);
  private readonly policyCacheKey = 'tt.admin.security.policy';

  loading = true;
  busy = false;
  message = '';
  error = '';

  policy: SecurityPolicyDto = {
    sessionTimeoutMinutes: 60,
    maxFailedLoginAttempts: 5,
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireLowercase: false,
    passwordRequireDigit: false,
    passwordRequireNonAlphanumeric: false,
  };

  lockedUsers: LockedUserDto[] = [];
  resetRequests: ResetRequestLogDto[] = [];
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    const cached = this.readCachedPolicy();
    if (cached) {
      this.policy = cached;
    }

    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading = true;
    this.clearError();

    const results = await Promise.allSettled([
      this.withRetry(() => firstValueFrom(this.api.getSecurityPolicy().pipe(timeout(12000)))),
      this.withRetry(() => firstValueFrom(this.api.getLockedUsers().pipe(timeout(20000)))),
      this.withRetry(() => firstValueFrom(this.api.getResetRequests(50).pipe(timeout(12000)))),
    ]);

    const failedParts: string[] = [];

    const policyRes = results[0];
    if (policyRes.status === 'fulfilled') {
      this.policy = policyRes.value;
      this.writeCachedPolicy(this.policy);
    } else {
      failedParts.push('policy');
    }

    const lockedRes = results[1];
    if (lockedRes.status === 'fulfilled') {
      this.lockedUsers = lockedRes.value;
    } else {
      this.lockedUsers = [];
      failedParts.push('zárolt fiókok');
    }

    const resetRes = results[2];
    if (resetRes.status === 'fulfilled') {
      this.resetRequests = resetRes.value;
    } else {
      this.resetRequests = [];
      failedParts.push('reset kérelmek');
    }

    if (failedParts.length) {
      this.showError(`Néhány rész nem töltött be: ${failedParts.join(', ')}.`);
    }

    this.loading = false;
    this.cdr.detectChanges();
  }

  async savePolicy(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.updateSecurityPolicy(this.policy));
      this.policy = await firstValueFrom(this.api.getSecurityPolicy().pipe(timeout(10000)));
      this.writeCachedPolicy(this.policy);
      this.showSuccess('Mentve.');
    }, 'Policy mentése sikertelen.');
  }

  async loadLockedUsers(): Promise<void> {
    await this.run(async () => {
      this.lockedUsers = await this.withRetry(() => firstValueFrom(this.api.getLockedUsers().pipe(timeout(10000))));
    }, 'Zárolt felhasználók betöltése sikertelen.');
  }

  async unlock(user: LockedUserDto): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.unlockUser(user.userId));
      this.lockedUsers = this.lockedUsers.filter(x => x.userId !== user.userId);
      this.showSuccess(`Feloldva: ${user.userName ?? user.userId}`);
    }, 'Felhasználó feloldása sikertelen.');
  }

  async loadResetRequests(): Promise<void> {
    await this.run(async () => {
      this.resetRequests = await firstValueFrom(this.api.getResetRequests(50));
    }, 'Reset kérelmek betöltése sikertelen.');
  }

  async copyResetUrl(url: string | null): Promise<void> {
    if (!url) {
      this.showError('Nincs másolható link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.showSuccess('Reset link kimásolva.');
    } catch {
      this.showError('A link másolása sikertelen.');
    }
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

  lockAgeLabel(value: string | null | undefined): string {
    const started = this.parseDate(value);
    if (!started) return '-';

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));

    if (elapsedMinutes < 60) {
      return `${elapsedMinutes} p`;
    }

    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;

    if (hours < 24) {
      return `${hours} ó ${minutes} p`;
    }

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} n ${remHours} ó`;
  }

  lockAgeStyle(value: string | null | undefined): Record<string, string> {
    const started = this.parseDate(value);
    if (!started) {
      return {
        'background-color': 'transparent',
        color: 'inherit',
        'border-color': '#ddd',
      };
    }

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
    const ratio = Math.min(1, elapsedMinutes / (7 * 24 * 60));

    const color = this.interpolateLockAgeColor(ratio);

    return {
      'background-color': `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.18)`,
      color: `hsl(${color.h}, ${Math.min(95, color.s + 12)}%, ${Math.max(20, color.l - 18)}%)`,
      'border-color': `hsla(${color.h}, ${color.s}%, ${Math.max(20, color.l - 8)}%, 0.42)`,
    };
  }

  private interpolateLockAgeColor(ratio: number): { h: number; s: number; l: number } {
    const stops = [
      { at: 0.0, h: 145, s: 58, l: 26 },
      { at: 0.18, h: 120, s: 52, l: 38 },
      { at: 0.34, h: 88, s: 56, l: 46 },
      { at: 0.5, h: 52, s: 86, l: 52 },
      { at: 0.66, h: 34, s: 86, l: 50 },
      { at: 0.8, h: 10, s: 82, l: 46 },
      { at: 0.92, h: 0, s: 76, l: 42 },
      { at: 1.0, h: 340, s: 65, l: 32 },
    ];

    for (let i = 0; i < stops.length - 1; i++) {
      const start = stops[i];
      const end = stops[i + 1];
      if (ratio <= end.at) {
        const span = Math.max(0.0001, end.at - start.at);
        const local = (ratio - start.at) / span;

        return {
          h: this.mix(start.h, end.h, local),
          s: this.mix(start.s, end.s, local),
          l: this.mix(start.l, end.l, local),
        };
      }
    }

    const last = stops[stops.length - 1];
    return { h: last.h, s: last.s, l: last.l };
  }

  private mix(from: number, to: number, weight: number): number {
    return from + (to - from) * Math.min(1, Math.max(0, weight));
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const hasZone = /z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/i.test(trimmed);
    const normalized = hasZone ? trimmed : `${trimmed}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
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
    this.clearMessage();
    this.clearError();
  }

  private showSuccess(text: string): void {
    this.clearMessage();
    this.message = text;
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
      this.cdr.detectChanges();
    }, 2600);
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
    }, 3600);
    this.cdr.detectChanges();
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

  private readCachedPolicy(): SecurityPolicyDto | null {
    try {
      const raw = localStorage.getItem(this.policyCacheKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<SecurityPolicyDto>;
      if (
        typeof parsed?.sessionTimeoutMinutes !== 'number' ||
        typeof parsed?.maxFailedLoginAttempts !== 'number' ||
        typeof parsed?.passwordMinLength !== 'number' ||
        typeof parsed?.passwordRequireUppercase !== 'boolean' ||
        typeof parsed?.passwordRequireLowercase !== 'boolean' ||
        typeof parsed?.passwordRequireDigit !== 'boolean' ||
        typeof parsed?.passwordRequireNonAlphanumeric !== 'boolean'
      ) {
        return null;
      }

      return {
        sessionTimeoutMinutes: parsed.sessionTimeoutMinutes,
        maxFailedLoginAttempts: parsed.maxFailedLoginAttempts,
        passwordMinLength: parsed.passwordMinLength,
        passwordRequireUppercase: parsed.passwordRequireUppercase,
        passwordRequireLowercase: parsed.passwordRequireLowercase,
        passwordRequireDigit: parsed.passwordRequireDigit,
        passwordRequireNonAlphanumeric: parsed.passwordRequireNonAlphanumeric,
      };
    } catch {
      return null;
    }
  }

  private writeCachedPolicy(policy: SecurityPolicyDto): void {
    try {
      localStorage.setItem(this.policyCacheKey, JSON.stringify(policy));
    } catch {
    }
  }
}
