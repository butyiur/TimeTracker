import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { buildCookieLogoutUrl } from '../config/endpoints';

@Component({
  standalone: true,
  imports: [RouterLink],
  styles: [
    `
      .forbidden-page {
        min-height: 100vh;
        padding: 24px;
        display: grid;
        place-items: center;
        background:
          linear-gradient(150deg, rgba(36, 12, 82, 0.44), rgba(20, 6, 54, 0.8)),
          url('/auth/blob-bg.svg');
        background-size: cover;
        background-position: center;
      }
      .forbidden-card {
        width: min(940px, 100%);
        color: #f6f5ff;
        border: 1px solid rgba(228, 220, 255, 0.26);
        border-radius: 22px;
        padding: 28px;
        backdrop-filter: blur(8px);
        background: linear-gradient(170deg, rgba(24, 13, 63, 0.62), rgba(24, 13, 63, 0.34));
        box-shadow: 0 24px 50px rgba(11, 5, 35, 0.42);
        display: grid;
        gap: 16px;
        text-align: center;
        justify-items: center;
      }
      .headline {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        flex-wrap: wrap;
        width: 100%;
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
        color: #ffffff;
      }
      .sub {
        margin: 0;
        max-width: 760px;
        color: rgba(236, 230, 255, 0.95);
        font-size: 1.08rem;
      }
      .nope-wrap {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid rgba(223, 214, 255, 0.34);
        background: rgba(255, 255, 255, 0.1);
        padding: 8px 12px;
      }
      .finger {
        display: inline-block;
        font-size: 1.7rem;
        line-height: 1;
        transform-origin: center;
        animation: noNoFinger 0.9s ease-in-out infinite;
      }
      .finger-rot {
        display: inline-grid;
        place-items: center;
        transform: rotate(0deg);
      }
      .nope-text {
        font-size: 0.86rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
        color: #ffffff;
      }
      .meta {
        margin: 4px 0 0;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(227, 218, 255, 0.26);
        background: rgba(19, 11, 50, 0.45);
        width: min(680px, 100%);
        text-align: center;
      }
      .meta-line {
        color: rgba(244, 241, 255, 0.97);
        font-size: 1rem;
      }
      .meta-line + .meta-line {
        margin-top: 4px;
      }
      .actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        width: 100%;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid rgba(226, 217, 255, 0.35);
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
        padding: 10px 14px;
        text-decoration: none;
        font-weight: 700;
        min-width: 240px;
        text-align: center;
      }
      .btn.primary {
        border-color: rgba(157, 141, 255, 0.6);
        background: linear-gradient(135deg, #7f68ff, #5d47d2);
      }
      .btn.ghost {
        cursor: pointer;
      }

      @keyframes noNoFinger {
        0% { transform: translateX(-4px) rotate(-6deg); }
        50% { transform: translateX(4px) rotate(6deg); }
        100% { transform: translateX(-4px) rotate(-6deg); }
      }

      @media (max-width: 700px) {
        .forbidden-page { padding: 14px; }
        .forbidden-card { padding: 18px; border-radius: 16px; }
        .actions { display: grid; grid-template-columns: 1fr; }
        .btn { min-width: 0; }
      }
    `,
  ],
  template: `
    <section class="forbidden-page">
      <div class="forbidden-card">
        <div class="headline">
          <h1>403 - Nincs jogosultság</h1>
          <div class="nope-wrap" aria-hidden="true">
            <span class="finger-rot"><span class="finger">☝️</span></span>
            <span class="nope-text">Hozzáférés megtagadva</span>
          </div>
        </div>

        <p class="sub">
          Ehhez az oldalhoz jelenleg nincs hozzáférésed. Ha úgy gondolod, hogy ez hiba,
          jelezd az adminisztrátornak.
        </p>

        <div class="meta">
          <div class="meta-line"><strong>Bejelentkezve:</strong> {{ userName() ?? 'ismeretlen' }}</div>
          <div class="meta-line"><strong>Szerepkörök:</strong> {{ rolesText() }}</div>
        </div>

        <div class="actions">
          <a class="btn primary" routerLink="/calendar">Vissza az időnyilvántartáshoz</a>
          <button class="btn ghost" (click)="logout()">Kijelentkezés</button>
        </div>
      </div>
    </section>
  `,
})
export class ForbiddenPage {
  private auth = inject(AuthStateService);

  userName() {
    return this.auth.userName();
  }

  rolesText() {
    const r = this.auth.roles();
    return r.length ? r.join(', ') : 'nincs';
  }

  logout() {
    window.location.href = buildCookieLogoutUrl(window.location.origin + '/');
  }
}