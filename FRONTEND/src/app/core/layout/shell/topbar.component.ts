import { Component, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { buildCookieLogoutUrl } from '../../config/endpoints';


@Component({
  selector: 'tt-topbar',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display:block; width:100%; }

    .row {
      display:grid;
      grid-template-columns: minmax(0, 1fr) auto;
      width:100%;
      max-width:100%;
      box-sizing:border-box;
      align-items:center;
      gap: 10px;
      border: 1px solid var(--tt-topbar-border, rgba(203, 194, 252, 0.52));
      border-radius: 12px;
      padding: 6px 10px;
      background: var(--tt-topbar-bg);
      box-shadow: var(--tt-topbar-shadow, 0 8px 16px rgba(26, 18, 71, 0.22));
      backdrop-filter: blur(6px);
    }

    .left {
      display:flex;
      align-items:center;
      gap: 10px;
      min-width: 0;
      overflow: hidden;
    }

    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: var(--tt-topbar-avatar-bg, rgba(255,255,255,0.16));
      border: 1px solid var(--tt-topbar-avatar-border, rgba(238,230,255,0.4));
      overflow: hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size: 12px;
      font-weight: 700;
      color: var(--tt-topbar-avatar-color, #fff);
    }

    .avatar img { width:100%; height:100%; object-fit:cover; display:block; }

    .meta { display:flex; flex-direction:column; min-width:0; }
    .name {
      font-weight: 700;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      color: var(--tt-topbar-name, #fff);
    }
    .role { font-size: 12px; color: var(--tt-topbar-role, rgba(231,224,255,0.84)); }

    .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      color: var(--tt-topbar-badge-color, #fff);
      background: var(--tt-topbar-badge-bg, rgba(255,255,255,0.12));
      border: 1px solid var(--tt-topbar-badge-border, rgba(228,220,255,0.44));
      font-weight: 700;
      white-space: nowrap;
    }

    .topbar-btn {
      min-height: 36px;
      min-width: 112px;
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid var(--tt-topbar-btn-border, rgba(221,213,255,0.52));
      background: var(--tt-topbar-btn-bg, linear-gradient(135deg, rgba(130,105,255,0.9), rgba(95,72,216,0.88)));
      color: var(--tt-topbar-btn-color, #fff);
      cursor:pointer;
      font-weight: 700;
      font-size: .94rem;
      box-shadow: none;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .topbar-btn:hover {
      background: var(--tt-topbar-btn-hover-bg, linear-gradient(135deg, rgba(142,117,255,0.95), rgba(103,78,228,0.92))) !important;
      box-shadow: none !important;
    }

    @media (max-width: 920px) {
      .badge { display: none; }
      .topbar-btn {
        min-width: 108px;
        min-height: 36px;
      }
    }

    @media (max-width: 760px) {
      .row { padding: 6px 8px; }
      .name { max-width: 160px; }
      .topbar-btn {
        min-width: 100px;
        padding: 6px 8px;
      }
    }

    @media (max-width: 560px) {
      .row {
        grid-template-columns: 1fr;
      }
      .left {
        width: 100%;
      }
      .topbar-btn {
        width: 100%;
        min-width: 0;
      }
    }
  `],
  template: `
    <div class="row">
      <div class="left">
        <div class="avatar">
          <img *ngIf="(me$ | async)?.photoUrl as photoUrl; else noPhoto" [src]="photoUrl" alt="Profilkép" />
          <ng-template #noPhoto>👤</ng-template>
        </div>

        <div class="meta">
          <div class="name">{{ (auth.me$ | async)?.name ?? userName() }}</div>
          <div class="role">Bejelentkezve</div>
        </div>

        <span class="badge">{{ roleLabel() }}</span>
      </div>

      <button class="btn topbar-btn" (click)="logout()">Kijelentkezés</button>
    </div>
  `,
})
export class TopbarComponent {
  private oauth = inject(OAuthService);
  public auth = inject(AuthStateService);
  public me$ = this.auth.me$;

  userName(): string {
    return this.auth.userName() ?? 'Felhasználó';
  }

  roleLabel(): string {
    const roles = this.auth.roles();
    return roles.length ? roles.join(', ') : 'nincs szerepkör';
  }

  logout() {
    // OIDC lib cleanup
    this.oauth.logOut();

    // Cookie logout a backend felé
    window.location.href = buildCookieLogoutUrl(window.location.origin + '/');
  }
}