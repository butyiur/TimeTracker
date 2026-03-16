import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { AdminAuditApiService, AuditLogDto } from '../data/admin-audit-api.service';
import { AdminUserDto, AdminUsersApiService } from '../data/admin-users-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [
    `
      .wrap { display:grid; gap:14px; }
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:14px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .audit-card {
        background: #ffffff;
      }
      .hero-kicker {
        font-size: .74rem;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #5d5684;
        font-weight: 800;
      }
      .hero h1 { margin:0; }
      .hero p { margin:8px 0 0; color:#544c7a; }
      .kpi-grid { display:grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap:10px; }
      .kpi {
        border:1px solid #c8d1ef;
        border-radius:14px;
        padding:10px 12px;
        background:linear-gradient(180deg, #ffffff, #f7f8ff);
      }
      .kpi-label { color:#5a527f; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
      .kpi-value { color:#241d57; font-size:1.45rem; font-weight:800; line-height:1.1; margin-top:4px; }
      .toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
      .toolbar-actions { display:flex; gap:6px; flex-wrap:wrap; }
      .refresh-btn {
        min-height:30px;
        min-width:98px;
        padding:4px 8px;
        border-radius:9px;
        border:1px solid rgba(156, 143, 242, 0.72);
        background:linear-gradient(135deg, var(--tt-primary-a), var(--tt-primary-b));
        color:#fff;
        font-weight:700;
        font-size:.82rem;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        text-align:center;
      }
      .refresh-btn:disabled { opacity:.6; cursor:not-allowed; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #e8ebf6; padding:10px 8px; vertical-align:top; }
      th { color:#251f56; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
      .muted { color:#544c7a; }
      .status {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:84px;
        border-radius:999px;
        padding:4px 10px;
        border:1px solid transparent;
        font-size:.78rem;
        font-weight:700;
      }
      .status-success { color:#14532d; background:#dcfce7; border-color:#bbf7d0; }
      .status-fail { color:#991b1b; background:#fee2e2; border-color:#fecaca; }
      .status-other { color:#334155; background:#e2e8f0; border-color:#cbd5e1; }
      .event-chip {
        display:inline-flex;
        align-items:center;
        border:1px solid #d6ddf3;
        border-radius:999px;
        padding:4px 10px;
        background:#f8f9ff;
        color:#2d2769;
      }
      .error { color:#b00020; }
      @media (max-width: 1180px) {
        .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 720px) {
        .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <div class="card hero">
        <div class="hero-kicker">Admin Irányítópult</div>
        <h1>Áttekintés</h1>
        <p>Gyors rálátást kapsz a felhasználói állapotra, regisztrációs igényekre és a legutóbbi audit eseményekre.</p>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Összes felhasználó</div><div class="kpi-value">{{ totalUsers }}</div></div>
        <div class="kpi"><div class="kpi-label">Aktív</div><div class="kpi-value">{{ activeUsers }}</div></div>
        <div class="kpi"><div class="kpi-label">Inaktív</div><div class="kpi-value">{{ inactiveUsers }}</div></div>
        <div class="kpi"><div class="kpi-label">HR szerepkör</div><div class="kpi-value">{{ hrUsers }}</div></div>
        <div class="kpi"><div class="kpi-label">Admin szerepkör</div><div class="kpi-value">{{ adminUsers }}</div></div>
        <div class="kpi"><div class="kpi-label">Függő regisztráció</div><div class="kpi-value">{{ pendingRegistrationsLabel }}</div></div>
        <div class="kpi"><div class="kpi-label">Zárolt fiók</div><div class="kpi-value">{{ lockedUsers }}</div></div>
      </div>

      <div class="card audit-card">
        <div class="toolbar">
          <h3 style="margin:0;">Legutóbbi audit események</h3>
          <div class="toolbar-actions">
            <button class="refresh-btn" (click)="reload()" type="button" [disabled]="busy">Frissítés</button>
            <a class="refresh-btn" routerLink="/admin/system-logs" style="text-decoration:none; display:inline-flex; align-items:center;">Részletes napló</a>
          </div>
        </div>
        <div class="muted" style="margin-top:8px;" *ngIf="busy">Betöltés...</div>
        <div class="error" style="margin-top:8px;" *ngIf="error">{{ error }}</div>
        <table style="margin-top:10px;" *ngIf="recentAudit.length; else noAuditTpl">
          <thead>
            <tr>
              <th>Időpont</th>
              <th>Esemény</th>
              <th>Eredmény</th>
              <th>Felhasználó</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of recentAudit">
              <td>{{ formatDate(item.timestampUtc) }}</td>
              <td><span class="mono event-chip">{{ item.eventType }}</span></td>
              <td><span class="status" [ngClass]="resultClass(item.result)">{{ item.result }}</span></td>
              <td>{{ item.userEmail || item.userId || '-' }}</td>
              <td class="mono">{{ item.ipAddress || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <ng-template #noAuditTpl>
          <div class="muted">Nincs megjeleníthető audit esemény.</div>
        </ng-template>
      </div>
    </div>
  `,
})
export class AdminOverviewPage {
  private usersApi = inject(AdminUsersApiService);
  private auditApi = inject(AdminAuditApiService);
  private auth = inject(AuthStateService);
  private cdr = inject(ChangeDetectorRef);

  busy = false;
  error = '';
  users: AdminUserDto[] = [];
  recentAudit: AuditLogDto[] = [];
  pendingRegistrations: number | null = null;
  usersSummary = {
    totalItems: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    hrUsers: 0,
    adminUsers: 0,
    lockedUsers: 0,
  };

  get totalUsers(): number {
    return this.usersSummary.totalItems;
  }

  get activeUsers(): number {
    return this.usersSummary.activeUsers;
  }

  get inactiveUsers(): number {
    return this.usersSummary.inactiveUsers;
  }

  get hrUsers(): number {
    return this.usersSummary.hrUsers;
  }

  get adminUsers(): number {
    return this.usersSummary.adminUsers;
  }

  get lockedUsers(): number {
    return this.usersSummary.lockedUsers;
  }

  get pendingRegistrationsLabel(): string {
    return this.pendingRegistrations === null ? '-' : String(this.pendingRegistrations);
  }

  async ngOnInit(): Promise<void> {
    await this.auth.ensureMeLoaded();
    await this.reload();
  }

  async reload(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.pendingRegistrations = null;
    const canLoadHrRegistrations = this.auth.hasAnyRole(['HR']);

    const usersTask = firstValueFrom(this.usersApi.list({}).pipe(timeout(12000)));
    const registrationsTask = canLoadHrRegistrations
      ? firstValueFrom(this.usersApi.listRegistrationRequests().pipe(timeout(12000)))
      : null;
    const auditTask = firstValueFrom(this.auditApi.getAudit({ page: 1, pageSize: 8 }).pipe(timeout(12000)));

    const [usersRes, regRes, auditRes] = await Promise.allSettled([
      usersTask,
      registrationsTask ?? Promise.resolve([]),
      auditTask,
    ]);

    if (usersRes.status === 'fulfilled') {
      this.users = usersRes.value.items;
      this.usersSummary = {
        totalItems: usersRes.value.totalItems,
        activeUsers: usersRes.value.activeUsers,
        inactiveUsers: usersRes.value.inactiveUsers,
        hrUsers: usersRes.value.hrUsers,
        adminUsers: usersRes.value.adminUsers,
        lockedUsers: usersRes.value.lockedUsers,
      };
    } else {
      this.users = [];
      this.usersSummary = {
        totalItems: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        hrUsers: 0,
        adminUsers: 0,
        lockedUsers: 0,
      };
      this.error = this.resolveError(usersRes.reason, 'A felhasználó KPI-k nem töltődtek be.');
    }

    if (!canLoadHrRegistrations) {
      this.pendingRegistrations = null;
    } else if (regRes.status === 'fulfilled') {
      this.pendingRegistrations = regRes.value.length;
    } else {
      this.pendingRegistrations = null;
    }

    if (auditRes.status === 'fulfilled') {
      this.recentAudit = auditRes.value.items;
    } else {
      this.recentAudit = [];
      if (!this.error) {
        this.error = this.resolveError(auditRes.reason, 'Az audit adatok nem tolthettek be.');
      }
    }

    this.busy = false;
    this.cdr.detectChanges();
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('hu-HU');
  }

  resultClass(value: string | null | undefined): string {
    const key = String(value ?? '').trim().toLowerCase();
    if (key === 'success') return 'status-success';
    if (key === 'fail') return 'status-fail';
    return 'status-other';
  }

  private resolveError(e: any, fallback: string): string {
    return e?.error?.detail ?? e?.error?.error ?? e?.message ?? fallback;
  }
}