import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/endpoints';

const API_BASE = API_BASE_URL;

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [
    `
      .wrap { max-width: 640px; margin: 48px auto; border: 1px solid #ddd; border-radius: 12px; padding: 20px; display: grid; gap: 14px; }
      .ok { color: #0a7f20; }
      .error { color: #b00020; }
      .muted { opacity: .75; }
      .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .btn { padding: 10px 14px; border: 1px solid #ddd; border-radius: 10px; background: #fff; cursor: pointer; text-decoration: none; color: inherit; }
    `,
  ],
  template: `
    <div class="wrap">
      <h2>E-mail megerősítés</h2>
      <div class="muted" *ngIf="loading">Megerősítés folyamatban...</div>
      <div class="ok" *ngIf="message">{{ message }}</div>
      <div class="error" *ngIf="error">{{ error }}</div>

      <div class="actions">
        <a class="btn" routerLink="/login">Bejelentkezés</a>
        <a class="btn" routerLink="/register">Regisztráció</a>
      </div>
    </div>
  `,
})
export class ConfirmEmailComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  loading = true;
  message = '';
  error = '';

  async ngOnInit(): Promise<void> {
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!userId || !token) {
      this.loading = false;
      this.error = 'Hiányzó megerősítési adatok.';
      return;
    }

    try {
      await firstValueFrom(this.http.post(`${API_BASE}/api/auth/confirm-email`, { userId, token }));
      this.message = 'Az e-mail címed sikeresen megerősítve.';
    } catch (e: any) {
      const details = e?.error?.details;
      if (Array.isArray(details) && details.length) {
        this.error = String(details[0]);
      } else {
        this.error = e?.error?.error ?? 'Az e-mail megerősítés sikertelen.';
      }
    } finally {
      this.loading = false;
    }
  }
}
