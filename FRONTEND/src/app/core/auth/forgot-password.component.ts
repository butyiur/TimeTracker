import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/endpoints';

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
        min-height:36px;
        padding: 6px 10px;
        border: 1px solid #d7dbef;
        border-radius: 12px;
        background: #fff;
        cursor: pointer;
        text-decoration: none;
        color: #271f5a;
        font-weight: 600;
        font-size: .86rem;
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
        <h2>Elfelejtett jelszó</h2>
        <div class="muted subtitle">Add meg az e-mail címed, és küldünk egy biztonságos jelszó-visszaállító linket.</div>

        <div class="row">
          <label for="email">E-mail</label>
          <input id="email" type="email" [(ngModel)]="email" placeholder="pelda@email.com" />
        </div>

        <div class="actions dual">
          <button class="btn primary" (click)="submit()" [disabled]="busy">Link küldése</button>
          <a class="btn" routerLink="/login">Vissza bejelentkezéshez</a>
        </div>

        <div class="ok" *ngIf="message">{{ message }}</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private http = inject(HttpClient);

  email = '';
  busy = false;
  message = '';
  error = '';

  async submit(): Promise<void> {
    this.message = '';
    this.error = '';

    const email = this.email.trim();
    if (!email) {
      this.error = 'Az e-mail cím megadása kötelező.';
      return;
    }

    this.busy = true;
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/api/auth/forgot-password`, { email }));
      this.message = 'Ha létezik ilyen fiók, elküldtük a visszaállító linket.';
    } catch {
      this.message = 'Ha létezik ilyen fiók, elküldtük a visszaállító linket.';
    } finally {
      this.busy = false;
    }
  }
}
