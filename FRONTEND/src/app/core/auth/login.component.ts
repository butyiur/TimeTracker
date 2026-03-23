import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        padding: 24px;
        background:
          radial-gradient(1200px 520px at 10% -10%, #9e8cff 0%, rgba(158, 140, 255, 0) 58%),
          radial-gradient(1000px 460px at 100% 120%, #6f5cff 0%, rgba(111, 92, 255, 0) 60%),
          linear-gradient(145deg, #efeefe 0%, #e3e8ff 48%, #d9def8 100%);
        display: grid;
        place-items: center;
      }
      .auth-shell {
        width: min(1040px, 100%);
        display: grid;
        grid-template-columns: 1.05fr .95fr;
        border-radius: 22px;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #dadff2;
        box-shadow: 0 24px 52px rgba(34, 24, 86, 0.18);
      }
      .hero {
        position: relative;
        min-height: 560px;
        padding: 26px;
        display: grid;
        align-content: space-between;
        color: #f9f8ff;
        background: linear-gradient(165deg, #25134f, #1a1648);
        background-size: cover;
        background-position: center;
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(170deg, rgba(20, 10, 57, 0.18), rgba(20, 10, 57, 0.46));
        pointer-events: none;
        z-index: 1;
      }
      .hero::after {
        content: '';
        position: absolute;
        inset: 0;
        background: url('/auth/blob-bg.svg') center / cover no-repeat;
        opacity: .72;
        pointer-events: none;
        z-index: 0;
      }
      .hero > * { position: relative; z-index: 2; }
      .brand { font-size: 1.45rem; font-weight: 800; letter-spacing: .08em; }
      .hero-text { font-size: 2rem; line-height: 1.1; max-width: 360px; margin: 0; }
      .hero-sub { opacity: .9; max-width: 340px; }
      .panel {
        padding: 38px 36px;
        display: grid;
        align-content: center;
        gap: 14px;
        background: linear-gradient(180deg, #ffffff, #f9f9ff);
      }
      h2 { margin: 0; font-size: 2rem; color: #211a4b; }
      .title { text-align: center; }
      .subtitle { text-align: center; }
      .muted { color: #675f88; }
      .ok { color: #0a7f20; }
      .error { color: #b00020; }
      .btn-row {
        display: grid;
        gap: 10px;
        margin-top: 4px;
        width: min(540px, 100%);
        margin-inline: auto;
      }
      .btn {
        border-radius: 12px;
        border: 1px solid #d7dbef;
        background: #ffffff;
        color: #241d52;
        padding: 10px 14px;
        min-height: 44px;
        font-size: .94rem;
        font-weight: 700;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
      }
      .btn.primary {
        border-color: #5d4ad2;
        background: linear-gradient(135deg, #6b58df, #4f3ab9);
        color: #ffffff;
      }
      .btn:disabled { opacity: .62; cursor: not-allowed; }
      .btn:not(:disabled):hover {
        transform: translateY(-1px);
        border-color: #c6cdef;
        box-shadow: 0 8px 16px rgba(45, 33, 109, 0.09);
      }
      .links {
        display: flex !important;
        align-items: stretch;
        gap: 12px;
        width: 100%;
      }
      .links .btn {
        flex: 1 1 0;
        width: auto !important;
        min-width: 0 !important;
        min-height: 36px;
        padding: 6px 10px;
        font-size: .8rem;
        line-height: 1.1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        background: #ffffff;
        color: #241d52;
        border-color: #d7dbef;
        box-shadow: none !important;
        white-space: nowrap;
        overflow: hidden;
      }

      @media (max-width: 900px) {
        .auth-page { padding: 14px; }
        .auth-shell { grid-template-columns: 1fr; }
        .hero { min-height: 230px; }
        .hero-text { font-size: 1.5rem; }
        .panel { padding: 24px 18px; }
        .btn-row { width: 100%; }
        .links {
          gap: 8px;
          flex-direction: column;
        }
        .links .btn { font-size: .78rem; min-height: 34px; }
      }
    `,
  ],
  template: `
    <div class="auth-page">
      <section class="auth-shell">
        <aside class="hero">
          <div class="brand">TIMETRACKER</div>
          <div>
            <p class="hero-text">Biztonságos munkaidő-kezelés, vezetői rálátással</p>
            <p class="hero-sub">Központi beléptetés, auditálható jogosultságkezelés és döntéstámogató riportok egységes platformon.</p>
          </div>
        </aside>

        <div class="panel">
          <h2 class="title">Bejelentkezés</h2>
          <div class="muted subtitle">Jelentkezz be a saját vállalati fiókoddal.</div>

          <div class="ok" *ngIf="registered">Sikeres regisztráció. Most jelentkezz be.</div>
          <div class="ok" *ngIf="confirmed">E-mail címed megerősítve. Most jelentkezz be.</div>
          <div class="error" *ngIf="error">{{ error }}</div>

          <div class="btn-row">
            <button class="btn primary" type="button" (click)="startLogin()" [disabled]="busy">Belépés</button>
            <div class="links">
              <a class="btn" routerLink="/register">Regisztráció</a>
              <a class="btn" routerLink="/forgot-password">Elfelejtett jelszó</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  private oauth = inject(OAuthService);
  private route = inject(ActivatedRoute);
  registered = false;
  confirmed = false;
  busy = false;
  error = '';

  ngOnInit() {
    this.registered = this.route.snapshot.queryParamMap.get('registered') === '1';
    this.confirmed = this.route.snapshot.queryParamMap.get('confirmed') === '1';
  }

  async startLogin(): Promise<void> {
    if (this.busy) return;

    this.busy = true;
    this.error = '';

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/overview';

    try {
      await this.oauth.loadDiscoveryDocument();
      this.oauth.initCodeFlow(returnUrl);
    } catch (e) {
      console.error('Login start failed', e);
      this.error = 'A bejelentkezés indítása sikertelen. Ellenőrizd, hogy fut-e az API (https://localhost:7037).';
    } finally {
      this.busy = false;
    }
  }
}
