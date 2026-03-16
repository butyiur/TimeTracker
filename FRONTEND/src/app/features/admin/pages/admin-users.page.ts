import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { AdminUserDetailsDto, AdminUserDto, AdminUsersApiService } from '../data/admin-users-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { display:grid; gap:14px; max-width:1300px; }
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
      .kpi-grid {
        display:grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap:10px;
      }
      .kpi {
        border:1px solid #c4cdec;
        border-radius:16px;
        padding:12px;
        background:linear-gradient(180deg, #ffffff, #f6f8ff);
        box-shadow:0 10px 24px rgba(30, 21, 84, 0.12);
      }
      .kpi-label { color:#5a527f; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
      .kpi-value { color:#241d57; font-size:1.5rem; font-weight:800; line-height:1.1; margin-top:4px; }
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:14px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .filter-card {
        position: sticky;
        top: 10px;
        z-index: 20;
      }
      .row { display:flex; gap:10px; align-items:end; flex-wrap:wrap; }
      .field { display:grid; gap:6px; min-width:180px; }
      input, select { padding:8px 10px; border:1px solid #bcc6eb; border-radius:12px; }
      .btn {
        padding:8px 13px;
        border:1px solid rgba(156, 143, 242, 0.72);
        border-radius:12px;
        background:linear-gradient(135deg, var(--tt-primary-a), var(--tt-primary-b));
        color:#fff;
        cursor:pointer;
        font-weight:700;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:40px;
      }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
      .btn-success { border-color: rgba(31, 138, 82, 0.72); background: linear-gradient(135deg, #2fb36c, #1f8a52); }
      .btn-danger { border-color:#dba5a5; background:linear-gradient(135deg, #f06d8b, #d33d66); }
      .muted { opacity:1; color:#544c7a; }
      .error { color:#b00020; }
      .ok { color:#0b6b2f; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #eee; padding:8px; vertical-align:top; }
      .roles { display:flex; gap:10px; flex-wrap:wrap; }
      .status {
        display:inline-block;
        border:1px solid #ddd;
        border-radius:999px;
        padding:2px 8px;
        font-size:12px;
        font-weight:700;
      }
      .status.active {
        color:#166534;
        border-color:#86efac;
        background:#dcfce7;
      }
      .status.inactive {
        color:#991b1b;
        border-color:#fca5a5;
        background:#fee2e2;
      }
      .link-btn { border:0; background:none; color:#0b4fb3; cursor:pointer; padding:0; text-decoration:underline; font:inherit; }
      .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:1500; }
      .modal {
        width:min(760px, 92vw);
        border:1px solid #c4cdec;
        border-radius:18px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        padding:16px;
        display:grid;
        gap:12px;
      }
      .modal-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .avatar { width:96px; height:96px; border-radius:999px; border:1px solid #ddd; display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:28px; }
      .avatar img { width:100%; height:100%; object-fit:cover; }
      .details-grid { display:grid; grid-template-columns:180px 1fr; gap:8px 12px; }
      .label { font-weight:600; }
      .actions-col { width: 220px; min-width: 220px; }
      .actions-col .row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        justify-items: stretch;
      }
      .actions-col .btn {
        width: 100%;
        min-width: 0;
      }
      .pager {
        margin-top: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        border: 1px solid #d7def4;
        border-radius: 12px;
        padding: 8px 10px;
        background: #fff;
      }
      .pager-meta {
        color: #4f4675;
        font-size: .88rem;
      }
      .pager-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .pager-actions .btn {
        min-height: 34px;
        padding: 6px 10px;
      }
      .pager-select {
        min-width: 88px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pager-select span {
        color: #241d57;
        font-weight: 600;
        white-space: nowrap;
      }
      .pager-select select {
        min-width: 88px;
      }
      @media (max-width: 980px) {
        .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .kpi-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Felhasználók</h1>
        <div class="hero-sub">{{ dashboardSub }}</div>
      </header>

      <section class="kpi-grid" aria-label="Felhasználói összesítések">
        <div class="kpi">
          <div class="kpi-label">Összes felhasználó</div>
          <div class="kpi-value">{{ totalUsers }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Aktív</div>
          <div class="kpi-value">{{ activeUsers }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Inaktív</div>
          <div class="kpi-value">{{ inactiveUsers }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">HR szerepkör</div>
          <div class="kpi-value">{{ hrUsers }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Admin szerepkör</div>
          <div class="kpi-value">{{ adminUsers }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Zárolt fiók</div>
          <div class="kpi-value">{{ lockedUsers }}</div>
        </div>
      </section>

      <div class="card filter-card">
        <div class="row">
          <label class="field" style="min-width:260px;">
            <span>Keresés (e-mail / felhasználónév)</span>
            <input [(ngModel)]="filters.q" placeholder="pl. admin@timetracker.local" />
          </label>

          <label class="field">
            <span>Szerepkör</span>
            <select [(ngModel)]="filters.role">
              <option value="">Összes</option>
              <option value="Employee">Employee</option>
              <option value="HR">HR</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn" (click)="load()" [disabled]="busy">Szűrés</button>
          <button class="btn" (click)="resetFilters()" [disabled]="busy">Alaphelyzet</button>
        </div>

        <div class="muted" style="margin-top:8px;" *ngIf="busy">Betöltés...</div>
        <div class="error" style="margin-top:8px;" *ngIf="error">{{ error }}</div>
        <div class="ok" style="margin-top:8px;" *ngIf="ok">{{ ok }}</div>
      </div>

      <div class="card">
        <div class="pager">
          <div class="pager-meta">
            Oldal: {{ page }} / {{ totalPages }} · Összesen: {{ totalItems }}
          </div>
          <div class="pager-actions">
            <label class="pager-select">
              <span>Lapméret</span>
              <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange($event)" [disabled]="busy">
                <option [ngValue]="5">5</option>
                <option [ngValue]="10">10</option>
                <option [ngValue]="25">25</option>
                <option [ngValue]="50">50</option>
              </select>
            </label>
            <button class="btn" (click)="goToPage(page - 1)" [disabled]="busy || page <= 1">Előző</button>
            <button class="btn" (click)="goToPage(page + 1)" [disabled]="busy || page >= totalPages">Következő</button>
          </div>
        </div>

        <table style="margin-top:10px;" *ngIf="users.length; else noUsersTpl">
          <thead>
            <tr>
              <th>Felhasználó</th>
              <th>Állapot</th>
              <th>Szerepkörök</th>
              <th class="actions-col">Műveletek</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td>
                <div>
                  <button class="link-btn" (click)="openDetails(user)">{{ user.email || user.userName || user.userId }}</button>
                </div>
                <div class="muted">{{ user.userName || '-' }}</div>
                <div class="mono">{{ user.userId }}</div>
              </td>

              <td>
                <span class="status" [ngClass]="user.isActive ? 'active' : 'inactive'">{{ user.isActive ? 'Aktív' : 'Inaktív' }}</span>
                <div class="muted" *ngIf="user.isLockedOut">Zárolva</div>
                <div class="muted" *ngIf="!user.emailConfirmed">Email nincs megerősítve</div>
              </td>

              <td>
                <div>{{ user.roles.length ? user.roles.join(', ') : '-' }}</div>
              </td>

              <td class="actions-col">
                <div class="row">
                  <button
                    class="btn"
                    *ngIf="canManageHrRole(user)"
                    (click)="toggleHrRole(user)"
                    [disabled]="isRowBusy(user.userId)">
                    {{ user.roles.includes('HR') ? 'HR jog elvétele' : 'HR jog adása' }}
                  </button>

                  <button class="btn btn-danger" *ngIf="canManageEmploymentStatus" (click)="setEmploymentActive(user, false)" [disabled]="isRowBusy(user.userId) || !user.isActive || !canToggleEmployment(user)">
                    Inaktiválás
                  </button>

                  <button class="btn btn-success" *ngIf="canManageEmploymentStatus" (click)="setEmploymentActive(user, true)" [disabled]="isRowBusy(user.userId) || user.isActive || !canToggleEmployment(user)">
                    Aktiválás
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #noUsersTpl>
          <div class="muted">Nincs találat a megadott szűrőkkel.</div>
        </ng-template>
      </div>

      <div class="modal-backdrop" *ngIf="detailsOpen" (click)="closeDetails()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3 style="margin:0;">Felhasználó adatai</h3>
            <button class="btn" (click)="closeDetails()">Bezárás</button>
          </div>

          <div class="muted" *ngIf="detailsBusy">Betöltés...</div>
          <div class="error" *ngIf="detailsError">{{ detailsError }}</div>

          <ng-container *ngIf="details">
            <div class="row" style="align-items:center;">
              <div class="avatar">
                <img *ngIf="details.photoUrl; else noAvatar" [src]="details.photoUrl" alt="Profilkép" />
                <ng-template #noAvatar>👤</ng-template>
              </div>
              <div>
                <div><strong>{{ details.email || details.userName || details.userId }}</strong></div>
                <div class="muted">{{ details.userName || '-' }}</div>
                <div class="muted">Szerepkörök: {{ details.roles.length ? details.roles.join(', ') : 'nincs' }}</div>
              </div>
            </div>

            <div class="details-grid">
              <div class="label">Felhasználó ID</div><div class="mono">{{ details.userId }}</div>
              <div class="label">E-mail</div><div>{{ details.email || '-' }}</div>
              <div class="label">Telefonszám</div><div>{{ details.phoneNumber || '-' }}</div>
              <div class="label">E-mail megerősítve</div><div>{{ details.emailConfirmed ? 'Igen' : 'Nem' }}</div>
              <div class="label">Állapot</div><div>{{ details.isActive ? 'Aktív' : 'Inaktív' }}</div>
              <div class="label">Zárolás oka</div><div>{{ lockoutReasonLabel(details.lockoutReason) }}</div>
              <div class="label">Lockout vége</div><div>{{ formatDate(details.lockoutEnd) }}</div>
              <div class="label">Aktuális lockout számláló</div><div>{{ details.accessFailedCount }}</div>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
})
export class AdminUsersPage {
  private api = inject(AdminUsersApiService);
  private auth = inject(AuthStateService);
  private cdr = inject(ChangeDetectorRef);

  users: AdminUserDto[] = [];
  busy = false;
  error = '';
  ok = '';
  page = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 1;
  summary = {
    activeUsers: 0,
    inactiveUsers: 0,
    hrUsers: 0,
    adminUsers: 0,
    lockedUsers: 0,
  };

  private rowBusyByUserId: Record<string, boolean> = {};
  private currentUserId: string | null = null;

  detailsOpen = false;
  detailsBusy = false;
  detailsError = '';
  details: AdminUserDetailsDto | null = null;

  filters = {
    q: '',
    role: '',
  };

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR') && !roles.includes('Admin')) return 'HR Irányítópult';
    return 'Admin Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR') && !roles.includes('Admin')) {
      return 'Foglalkoztatási státuszok és felhasználói hozzáférések kezelése HR nézetben.';
    }

    return 'Felhasználói állapotok, szerepkörök és hozzáférési döntések központi kezelése.';
  }

  get totalUsers(): number {
    return this.totalItems;
  }

  get activeUsers(): number {
    return this.summary.activeUsers;
  }

  get inactiveUsers(): number {
    return this.summary.inactiveUsers;
  }

  get hrUsers(): number {
    return this.summary.hrUsers;
  }

  get adminUsers(): number {
    return this.summary.adminUsers;
  }

  get lockedUsers(): number {
    return this.summary.lockedUsers;
  }

  get canEditRoles(): boolean {
    return this.auth.effectiveRoles().includes('Admin');
  }

  get canManageEmploymentStatus(): boolean {
    const roles = this.auth.effectiveRoles();
    return roles.includes('HR') && !roles.includes('Admin');
  }

  async ngOnInit(): Promise<void> {
    await this.auth.ensureMeLoaded();
    this.currentUserId = this.auth.currentMe()?.userId ?? null;
    await this.load();
  }

  async load(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.ok = '';

    try {
      const response = await firstValueFrom(
        this.api
          .list({
            q: this.filters.q.trim() || undefined,
            role: this.filters.role || undefined,
            page: this.page,
            pageSize: this.pageSize,
          })
          .pipe(timeout(12000))
      );

      this.users = response.items;
      this.page = response.page;
      this.pageSize = response.pageSize;
      this.totalItems = response.totalItems;
      this.totalPages = response.totalPages;
      this.summary = {
        activeUsers: response.activeUsers,
        inactiveUsers: response.inactiveUsers,
        hrUsers: response.hrUsers,
        adminUsers: response.adminUsers,
        lockedUsers: response.lockedUsers,
      };
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        this.error = 'A munkamenet lejárt. Jelentkezz be újra.';
      } else if (status === 403) {
        this.error = 'Nincs jogosultságod a felhasználók kezeléséhez.';
      } else if (e?.name === 'TimeoutError') {
        this.error = 'A felhasználók betöltése időtúllépés miatt megszakadt.';
      } else {
        this.error = e?.error?.detail ?? e?.error?.error ?? e?.message ?? 'A felhasználók betöltése sikertelen.';
      }
      this.users = [];
      this.totalItems = 0;
      this.totalPages = 1;
      this.summary = {
        activeUsers: 0,
        inactiveUsers: 0,
        hrUsers: 0,
        adminUsers: 0,
        lockedUsers: 0,
      };
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  resetFilters(): void {
    this.filters = { q: '', role: '' };
    this.page = 1;
    void this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.page = page;
    void this.load();
  }

  onPageSizeChange(value: number | string): void {
    const parsed = Number(value);
    this.pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
    this.page = 1;
    void this.load();
  }

  async openDetails(user: AdminUserDto): Promise<void> {
    this.detailsOpen = true;
    this.detailsBusy = true;
    this.detailsError = '';
    this.details = null;

    try {
      this.details = await firstValueFrom(this.api.getById(user.userId).pipe(timeout(12000)));
    } catch (e: any) {
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      this.detailsError = (e?.error?.detail ?? e?.error?.error ?? 'A felhasználó részletei nem tölthetők be.') + status;
    } finally {
      this.detailsBusy = false;
      this.cdr.detectChanges();
    }
  }

  closeDetails(): void {
    this.detailsOpen = false;
    this.detailsBusy = false;
    this.detailsError = '';
    this.details = null;
  }

  isRowBusy(userId: string): boolean {
    return this.rowBusyByUserId[userId] === true;
  }

  canManageHrRole(user: AdminUserDto): boolean {
    if (!this.canEditRoles) return false;
    if (this.currentUserId && user.userId === this.currentUserId) return false;
    if (user.roles.includes('Admin')) return false;
    return user.roles.includes('Employee') || user.roles.includes('HR');
  }

  canToggleEmployment(user: AdminUserDto): boolean {
    if (!this.canManageEmploymentStatus) return false;
    if (this.currentUserId && user.userId === this.currentUserId) {
      return false;
    }
    return !user.roles.includes('Admin');
  }

  async setEmploymentActive(user: AdminUserDto, isActive: boolean): Promise<void> {
    this.error = '';
    this.ok = '';

    if (!isActive && this.canManageEmploymentStatus) {
      const confirmed = window.confirm(`Biztosan inaktiválod ezt a felhasználót?\n\n${user.email || user.userName || user.userId}`);
      if (!confirmed) {
        return;
      }
    }

    this.rowBusyByUserId[user.userId] = true;

    try {
      await firstValueFrom(this.api.setEmploymentActive(user.userId, isActive).pipe(timeout(12000)));
      await this.load();
      this.ok = isActive
        ? 'Felhasználó aktiválva.'
        : 'Felhasználó inaktiválva.';
    } catch (e: any) {
      const status = e?.status ? ` (HTTP ${e.status})` : '';
      this.error = (e?.error?.detail ?? e?.error?.error ?? 'Foglalkoztatási státusz módosítása sikertelen.') + status;
    } finally {
      this.rowBusyByUserId[user.userId] = false;
      this.cdr.detectChanges();
    }
  }

  async toggleHrRole(user: AdminUserDto): Promise<void> {
    this.error = '';
    this.ok = '';

    if (!this.canManageHrRole(user)) {
      this.error = 'Ennél a felhasználónál nem módosítható a HR jogosultság.';
      return;
    }

    const hasHr = user.roles.includes('HR');
    const nextRoles = hasHr ? ['Employee'] : ['HR'];

    this.rowBusyByUserId[user.userId] = true;

    try {
      const result = await firstValueFrom(this.api.setRoles(user.userId, nextRoles).pipe(timeout(12000)));
      user.roles = [...result.roles];
      this.ok = hasHr
        ? 'HR jogosultság eltávolítva, a felhasználó Employee szerepkört kapott.'
        : 'HR jogosultság beállítva. Következő belépéstől 2FA kötelező lesz.';
    } catch (e: any) {
      const backendError = e?.error?.error;
      if (backendError === 'hr_requires_2fa') {
        this.error = 'HR jogosultság csak akkor adható, ha a felhasználó előtte bekapcsolta a 2FA-t.';
      } else {
        this.error = backendError ?? 'HR jogosultság módosítása sikertelen.';
      }
    } finally {
      this.rowBusyByUserId[user.userId] = false;
      this.cdr.detectChanges();
    }
  }

  formatDate(value: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    if (date.getUTCFullYear() >= 9999) return 'Határozatlan (inaktivált)';
    return date.toLocaleString('hu-HU');
  }

  lockoutReasonLabel(reason: string | null): string {
    if (!reason) return '-';
    if (reason === 'manual_inactivation') return 'Foglalkoztatási inaktiválás (HR)';
    if (reason === 'failed_login_attempts') return 'Túl sok sikertelen bejelentkezés';
    return 'Zárolás';
  }
}
