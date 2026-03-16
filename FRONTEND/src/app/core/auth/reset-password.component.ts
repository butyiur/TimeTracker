import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/endpoints';
import {
  calculatePasswordStrength,
  DEFAULT_PASSWORD_POLICY,
  evaluatePasswordRules,
  generatePasswordByPolicy,
  passwordStrengthLabel,
  PasswordPolicyDto,
} from '../security/password-policy';

const API_BASE = API_BASE_URL;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        padding: 24px;
        background:
          radial-gradient(1200px 540px at 12% -12%, #a08eff 0%, rgba(160, 142, 255, 0) 56%),
          radial-gradient(980px 440px at 100% 120%, #6b57df 0%, rgba(107, 87, 223, 0) 60%),
          linear-gradient(150deg, #efedff 0%, #dde5ff 100%);
        display: grid;
        place-items: center;
      }
      .wrap {
        width: min(760px, 100%);
        border: 1px solid #dadff2;
        border-radius: 22px;
        padding: 26px;
        background: linear-gradient(180deg, #ffffff, #f8f9ff);
        box-shadow: 0 24px 52px rgba(34, 24, 86, 0.16);
        display: grid;
        gap: 14px;
      }
      .row { display: grid; gap: 8px; }
      label { font-weight: 600; color: #271f5a; }
      input { padding: 11px 12px; border: 1px solid #d7dbef; border-radius: 12px; }
      .password-wrap { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
      .toggle {
        border: 1px solid #d7dbef;
        border-radius: 12px;
        background: #fff;
        width: 46px;
        display: grid;
        place-items: center;
        color: #271f5a;
        cursor: pointer;
      }
      .toggle svg { width: 20px; height: 20px; }
      .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .actions.dual {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px;
        width: min(560px, 100%);
        margin-inline: auto;
      }
      .actions.dual .btn {
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box;
      }
      .btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:44px;
        padding: 10px 14px;
        border: 1px solid #d7dbef;
        border-radius: 12px;
        background: #fff;
        cursor: pointer;
        text-decoration: none;
        color: #271f5a;
        font-weight: 600;
        transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
      }
      .btn.primary {
        border-color: #5d4ad2;
        background: linear-gradient(135deg, #6b58df, #4f3ab9);
        color: #fff;
      }
      .btn:disabled { opacity: .6; cursor: not-allowed; }
      .btn:not(:disabled):hover {
        transform: translateY(-1px);
        border-color:#c6cdef;
        box-shadow: 0 8px 16px rgba(45, 33, 109, 0.09);
      }
      .ok { color: #0a7f20; }
      .error { color: #b00020; }
      .muted { color: #675f88; }
      .rules { margin: 4px 0 0; padding-left: 18px; display: grid; gap: 4px; }
      .pass { color: #0a7f20; }
      .fail { color: #666; }
      .meter { height: 8px; background: #ebeefb; border-radius: 999px; overflow: hidden; }
      .meter-fill { height: 100%; background: linear-gradient(90deg, #8f74ff, #5a41cf); }
      h2 { margin: 0; font-size: 2rem; color: #211a4b; text-align:center; }
      .subtitle { text-align:center; }

      @media (max-width: 760px) {
        .auth-page { padding: 14px; }
        .wrap { padding: 18px; border-radius: 16px; }
        .actions.dual {
          grid-template-columns: 1fr !important;
          width: 100%;
        }
      }
    `,
  ],
  template: `
    <div class="auth-page">
      <div class="wrap">
        <h2>Jelszó visszaállítás</h2>
        <div class="muted subtitle">Adj meg új jelszót a visszaállításhoz.</div>

      <div class="row">
        <label for="email">E-mail</label>
        <input id="email" type="email" [(ngModel)]="email" />
      </div>

      <div class="row">
        <label for="password">Új jelszó</label>
        <div class="password-wrap">
          <input id="password" [type]="showNewPassword ? 'text' : 'password'" [(ngModel)]="newPassword" />
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
        <div class="actions">
          <button class="btn" type="button" (click)="generatePassword()" [disabled]="busy">Jelszó generálása</button>
        </div>
        <div class="meter"><div class="meter-fill" [style.width.%]="passwordScore"></div></div>
        <div class="muted">Erősség: {{ passwordStrength }}</div>
        <ul class="rules">
          <li *ngFor="let rule of passwordRules" [class.pass]="rule.passed" [class.fail]="!rule.passed">
            {{ rule.passed ? '✓' : '•' }} {{ rule.label }}
          </li>
        </ul>
      </div>

      <div class="row">
        <label for="confirmPassword">Új jelszó megerősítése</label>
        <div class="password-wrap">
          <input id="confirmPassword" [type]="showConfirmPassword ? 'text' : 'password'" [(ngModel)]="confirmPassword" />
          <button
            class="toggle"
            type="button"
            [attr.aria-label]="showConfirmPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'"
            (click)="showConfirmPassword = !showConfirmPassword"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </div>

        <div class="actions dual">
          <button class="btn primary" (click)="submit()" [disabled]="busy">Jelszó visszaállítása</button>
          <a class="btn" routerLink="/login">Vissza bejelentkezéshez</a>
        </div>

        <div class="ok" *ngIf="message">{{ message }}</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  busy = false;
  message = '';
  error = '';

  policy: PasswordPolicyDto = DEFAULT_PASSWORD_POLICY;

  async ngOnInit(): Promise<void> {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    try {
      const response = await firstValueFrom(this.http.get<PasswordPolicyDto>(`${API_BASE}/api/auth/password-policy`));
      this.policy = {
        ...DEFAULT_PASSWORD_POLICY,
        ...response,
      };
    } catch {
      this.policy = DEFAULT_PASSWORD_POLICY;
    }
  }

  get passwordRules() {
    return evaluatePasswordRules(this.newPassword, this.policy);
  }

  get passwordScore(): number {
    return calculatePasswordStrength(this.newPassword, this.policy);
  }

  get passwordStrength(): string {
    return passwordStrengthLabel(this.passwordScore);
  }

  generatePassword(): void {
    const targetLength = Math.max(this.policy.passwordMinLength, 12);
    this.newPassword = generatePasswordByPolicy(this.policy, targetLength);
    this.confirmPassword = this.newPassword;
  }

  async submit(): Promise<void> {
    this.message = '';
    this.error = '';

    const email = this.email.trim();
    const token = this.token.trim();

    if (!email || !token || !this.newPassword) {
      this.error = 'Hiányzó adatok: e-mail, token vagy új jelszó.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'A két jelszó nem egyezik.';
      return;
    }

    const allRulesPass = this.passwordRules.every(x => x.passed);
    if (!allRulesPass) {
      this.error = 'A jelszó nem felel meg az aktuális policy-nek.';
      return;
    }

    this.busy = true;
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/api/auth/reset-password`, {
        email,
        token,
        newPassword: this.newPassword,
      }));

      this.message = 'A jelszó sikeresen visszaállítva. Átirányítás...';
      setTimeout(() => {
        void this.router.navigate(['/login']);
      }, 700);
    } catch (e: any) {
      const detailsArray = e?.error?.details;
      if (Array.isArray(detailsArray) && detailsArray.length) {
        this.error = String(detailsArray[0]);
      } else {
        this.error = e?.error?.error ?? 'Jelszó visszaállítás sikertelen.';
      }
    } finally {
      this.busy = false;
    }
  }
}
