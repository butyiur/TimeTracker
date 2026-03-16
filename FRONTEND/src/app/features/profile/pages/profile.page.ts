import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Subscription } from 'rxjs';
import { ProfileApiService, ProfileMeDto } from '../data/profile-api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      .wrap { width: 100%; display: grid; gap: 16px; }
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
        border: 1px solid #d7dcf0;
        border-radius: 16px;
        padding: 16px;
        background: linear-gradient(180deg, #ffffff, #f8f9ff);
        box-shadow: 0 10px 24px rgba(38, 28, 86, 0.1);
      }
      .row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
      .profile-card {
        display: grid;
        gap: 14px;
      }
      .profile-head {
        justify-content: center;
        text-align: center;
      }
      .profile-meta {
        display: grid;
        gap: 4px;
        justify-items: center;
      }

      .avatar {
        width: 96px;
        height: 96px;
        border-radius: 999px;
        border: 1px solid #cfd6ef;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        font-weight: 700;
        color: #241d58;
        background: #f8f9ff;
      }

      .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

      .grid {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 10px 16px;
      }

      .label { font-weight: 600; }
      .muted { color: #675f88; }

      .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .profile-actions { justify-content: center; }
      .profile-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 230px));
        gap: 10px;
      }
      .profile-actions .btn {
        width: 100%;
        min-width: 0;
        min-height: 40px;
        padding: 8px 12px;
        font-size: .92rem;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .file-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .file-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .ok { color: #0a7f20; }
      .error { color: #b00020; }
      .status-card {
        display: grid;
        gap: 10px;
      }
      .status-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .status-percent {
        font-size: 1.4rem;
        font-weight: 800;
        color: #1f1a56;
      }
      .status-track {
        height: 10px;
        border-radius: 999px;
        background: #e8ecfb;
        overflow: hidden;
      }
      .status-fill {
        height: 100%;
        background: linear-gradient(90deg, #2fb36c, #1f8a52);
      }
      .status-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .status-chip {
        border: 1px solid #d5dcf3;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: .82rem;
        color: #2d2769;
        background: #f8f9ff;
      }
      .status-chip.ok {
        border-color: #b7ebc8;
        background: #ecfdf3;
        color: #17663f;
      }
      .status-chip.warn {
        border-color: #fde68a;
        background: #fff8db;
        color: #7a5a12;
      }
      .divider { border-top: 1px solid #e6ebfb; margin: 10px 0 2px; }
      @media (max-width: 640px) {
        .profile-actions {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Profilom</h1>
        <div class="hero-sub">{{ dashboardSub }}</div>
      </header>

      <div class="card" *ngIf="loading && !profile">Profil adatok betöltése...</div>

      <div class="card error" *ngIf="loadError">
        <div>{{ loadError }}</div>
        <div style="margin-top: 10px;">
          <button class="btn primary" (click)="loadProfile()" [disabled]="loading">Újrapróbálás</button>
        </div>
      </div>

      <ng-container *ngIf="profile as p">
        <div class="card profile-card status-card">
          <div class="row profile-head">
            <div class="avatar">
              <img *ngIf="photoSrc; else initialsTpl" [src]="photoSrc" alt="Profilkép" />
              <ng-template #initialsTpl>{{ initials(p.name) }}</ng-template>
            </div>

            <div class="profile-meta">
              <div><strong>{{ p.name }}</strong></div>
              <div class="muted">{{ p.email ?? 'nincs e-mail cím' }}</div>
              <div class="muted">Szerepkör: {{ p.roles.length ? p.roles.join(', ') : 'nincs' }}</div>
            </div>
          </div>

          <div class="actions profile-actions" style="margin-top: 4px;">
            <input id="profile-photo-input" class="file-hidden" type="file" accept="image/*" (change)="onFileSelected($event)" />
            <label class="btn file-trigger" for="profile-photo-input">Fájl kiválasztása</label>
            <button class="btn btn-danger" type="button" (click)="deletePhoto()" [disabled]="busy">Profilkép törlése</button>
          </div>

          <div class="ok" *ngIf="message">{{ message }}</div>
          <div class="error" *ngIf="error">{{ error }}</div>

          <div class="divider"></div>
          <h3>Fiók adatok</h3>
          <div class="grid" style="margin-top: 10px;">
            <div class="label">Felhasználó azonosító:</div>
            <div>{{ p.userId }}</div>

            <div class="label">Felhasználónév:</div>
            <div>{{ p.userName ?? '-' }}</div>

            <div class="label">E-mail:</div>
            <div>{{ p.email ?? '-' }}</div>

            <div class="label">E-mail megerősítve:</div>
            <div>{{ p.emailConfirmed ? 'Igen' : 'Nem' }}</div>

            <div class="label">Telefonszám:</div>
            <div>{{ p.phoneNumber ?? '-' }}</div>
          </div>

          <div class="status-head">
            <div>
              <strong>Profil állapot</strong>
              <div class="muted">A profil teljessége segít a gyorsabb adminisztrációban és értesítésekben.</div>
            </div>
            <div class="status-percent">{{ profileCompleteness }}%</div>
          </div>

          <div class="status-track">
            <div class="status-fill" [style.width.%]="profileCompleteness"></div>
          </div>

          <div class="status-chips">
            <span class="status-chip" [class.ok]="!!p.email" [class.warn]="!p.email">{{ p.email ? 'E-mail megadva' : 'E-mail hiányzik' }}</span>
            <span class="status-chip" [class.ok]="p.emailConfirmed" [class.warn]="!p.emailConfirmed">{{ p.emailConfirmed ? 'E-mail megerősítve' : 'E-mail nincs megerősítve' }}</span>
            <span class="status-chip" [class.ok]="!!p.phoneNumber" [class.warn]="!p.phoneNumber">{{ p.phoneNumber ? 'Telefonszám megadva' : 'Telefonszám hiányzik' }}</span>
            <span class="status-chip" [class.ok]="!!p.photoUrl" [class.warn]="!p.photoUrl">{{ p.photoUrl ? 'Profilkép beállítva' : 'Profilkép nincs beállítva' }}</span>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class ProfilePage implements OnInit, OnDestroy {
  private api = inject(ProfileApiService);
  private auth = inject(AuthStateService);

  profile: ProfileMeDto | null = null;
  loading = true;
  loadError = '';
  private photoVersion = Date.now();

  selectedFile: File | null = null;
  busy = false;
  message = '';
  error = '';
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  private objectUrl: string | null = null;
  private meSubscription: Subscription | null = null;

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'HR Irányítópult';
    if (roles.includes('Admin')) return 'Admin Irányítópult';
    return 'Dolgozói Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'Személyes adatok és fiókállapot áttekintése HR szerepkörhöz igazítva.';
    if (roles.includes('Admin')) return 'Személyes adatok, profilkép és fiókállapot admin szerepkörhöz igazítva.';
    return 'Személyes adatok, profilkép és fiókállapot gyors áttekintése.';
  }

  get photoSrc(): string | null {
    if (this.objectUrl) return this.objectUrl;
    if (!this.profile?.photoUrl) return null;

    return `${this.profile.photoUrl}?v=${this.photoVersion}`;
  }

  get hasServerPhoto(): boolean {
    return !!this.profile?.photoUrl;
  }

  get profileCompleteness(): number {
    const p = this.profile;
    if (!p) return 0;

    let score = 0;
    if (p.email) score += 25;
    if (p.emailConfirmed) score += 25;
    if (p.phoneNumber) score += 25;
    if (p.photoUrl) score += 25;
    return score;
  }

  async ngOnInit(): Promise<void> {
    this.meSubscription = this.auth.me$.subscribe(me => {
      if (!me || !this.profile) return;

      this.profile = {
        ...this.profile,
        name: me.name ?? this.profile.name,
        userName: me.name ?? this.profile.userName,
        email: me.email ?? this.profile.email,
        phoneNumber: me.phoneNumber ?? this.profile.phoneNumber,
        roles: me.roles?.length ? me.roles : this.profile.roles,
        photoUrl: me.photoUrl ?? this.profile.photoUrl,
      };
      this.photoVersion = Date.now();
    });

    this.profile = this.createFallbackProfile();
    await this.loadProfile();
  }

  ngOnDestroy(): void {
    this.meSubscription?.unsubscribe();
    this.meSubscription = null;
    this.clearMessage();
    this.clearError();
    this.revokeObjectUrl();
  }

  async loadProfile(): Promise<void> {
    this.loading = true;
    this.clearError();
    this.loadError = '';

    try {
      const serverProfile = await this.withRetry(() => firstValueFrom(this.api.me().pipe(timeout(10000))));
      const authMe = this.auth.currentMe();
      const authPhotoUrl = this.auth.currentMe()?.photoUrl ?? null;

      this.profile = {
        ...serverProfile,
        email: serverProfile.email ?? authMe?.email ?? null,
        phoneNumber: serverProfile.phoneNumber ?? authMe?.phoneNumber ?? null,
        photoUrl: serverProfile.photoUrl ?? authPhotoUrl,
      };

      this.photoVersion = Date.now();
    } catch {
      this.profile = this.createFallbackProfile();
      this.showError('Nem sikerült betölteni a profil adatokat a szerverről. A helyi adatok látszanak.');
    } finally {
      this.loading = false;
    }
  }

  onFileSelected(event: Event): void {
    this.message = '';
    this.error = '';

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedFile = file;
    this.revokeObjectUrl();

    if (file) {
      this.objectUrl = URL.createObjectURL(file);
      void this.uploadPhoto();
    }
  }

  async uploadPhoto(): Promise<void> {
    if (!this.selectedFile) return;

    this.busy = true;
    this.clearMessage();
    this.clearError();

    try {
      const result = await firstValueFrom(this.api.uploadPhoto(this.selectedFile!));

      if (this.profile) {
        this.profile = {
          ...this.profile,
          photoUrl: result.photoUrl,
        };
      }

      this.selectedFile = null;
      this.revokeObjectUrl();
      this.photoVersion = Date.now();
      await this.auth.refreshMe();
      this.showSuccess('Profilkép sikeresen feltöltve.');
    } catch {
      this.showError('A profilkép feltöltése sikertelen.');
    } finally {
      this.busy = false;
    }
  }

  async deletePhoto(): Promise<void> {
    if (!this.profile?.photoUrl) {
      this.showError('Nincs törölhető profilkép.');
      return;
    }

    this.busy = true;
    this.clearMessage();
    this.clearError();

    try {
      await firstValueFrom(this.api.deletePhoto());

      if (this.profile) {
        this.profile = {
          ...this.profile,
          photoUrl: null,
        };
      }

      this.revokeObjectUrl();
      this.selectedFile = null;
      this.photoVersion = Date.now();
      await this.auth.refreshMe();
      await this.loadProfile();
      this.showSuccess('Profilkép törölve.');
    } catch (e: any) {
      const details = e?.error?.details?.[0] ?? e?.error?.error ?? e?.error ?? null;
      this.showError(details ? `A profilkép törlése sikertelen: ${details}` : 'A profilkép törlése sikertelen.');
    } finally {
      this.busy = false;
    }
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  private createFallbackProfile(): ProfileMeDto {
    const currentMe = this.auth.currentMe();
    const roles = this.auth.roles();
    const displayName = this.auth.userName() ?? 'Felhasználó';

    return {
      userId: currentMe?.userId ?? '-',
      name: displayName,
      userName: displayName,
      email: currentMe?.email ?? null,
      phoneNumber: currentMe?.phoneNumber ?? null,
      emailConfirmed: false,
      roles,
      photoUrl: currentMe?.photoUrl ?? null,
    };
  }

  private revokeObjectUrl(): void {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private showSuccess(text: string): void {
    this.clearMessage();
    this.message = text;
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
    }, 2600);
  }

  private showError(text: string): void {
    this.clearError();
    this.error = text;
    this.errorTimer = setTimeout(() => {
      this.error = '';
      this.errorTimer = null;
    }, 3600);
  }

  private clearMessage(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.message = '';
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
}