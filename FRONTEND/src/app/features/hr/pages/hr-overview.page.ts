import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;

type HrManualTimeRequestDto = {
  id: number;
  requesterUserId: string;
  requesterEmail: string | null;
  projectId: number;
  projectName: string;
  taskId: number | null;
  taskName: string | null;
  startUtc: string;
  endUtc: string;
  description: string | null;
  status: string;
  createdAtUtc: string;
  reviewerUserId: string | null;
  reviewedAtUtc: string | null;
  reviewerComment: string | null;
};

type HrRegistrationRequestDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  emailConfirmed: boolean;
  registrationRequestedAtUtc: string | null;
};

type HrPagedResponse<T> = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};

type HrUserListItemDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  roles: string[];
};

type HrProjectListItemDto = {
  id: number;
  name: string;
  isActive?: boolean;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { display:grid; gap:14px; max-width:1100px; }
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
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap:10px;
      }
      .kpi {
        border:1px solid #c8d1ef;
        border-radius:14px;
        padding:10px 12px;
        background:linear-gradient(180deg, #ffffff, #f7f8ff);
      }
      .kpi-label { color:#5a527f; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
      .kpi-value { color:#241d57; font-size:1.3rem; font-weight:800; line-height:1.1; margin-top:4px; }
      .mini-grid {
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
      }
      .mini-card {
        border:1px solid #d5dcf3;
        border-radius:12px;
        padding:10px;
        background:#ffffff;
      }
      .mini-title {
        margin:0 0 8px;
        color:#29235f;
        font-size:1rem;
      }
      .activity-list {
        margin:0;
        padding-left:18px;
        display:grid;
        gap:6px;
      }
      .empty-note {
        color:#544c7a;
        font-size:.94rem;
      }
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:14px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .btn {
        padding:8px 13px;
        border:1px solid rgba(156, 143, 242, 0.72);
        border-radius:12px;
        background:linear-gradient(135deg, var(--tt-primary-a), var(--tt-primary-b));
        color:#fff;
        cursor:pointer;
        font-weight:700;
        min-height:40px;
      }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
      .btn-mini { padding:6px 10px; border-radius:10px; font-size:12px; min-height:34px; }
      .btn-success { border-color: rgba(31, 138, 82, 0.72); background: linear-gradient(135deg, #2fb36c, #1f8a52); }
      .btn-danger { border-color:#dba5a5; background:linear-gradient(135deg, #f06d8b, #d33d66); }
      select { padding:8px 10px; border:1px solid #bcc6eb; border-radius:10px; background:#fff; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #eee; padding:8px; vertical-align:top; }
      .compact { font-size:13px; }
      .compact th, .compact td { padding:5px 8px; }
      .muted { opacity:1; color:#544c7a; }
      .ok { color:#0a7f20; }
      .error { color:#b00020; }
      textarea { width:100%; min-height:36px; border:1px solid #bcc6eb; border-radius:10px; padding:6px; box-sizing:border-box; font-size:12px; }
      .actions-col { min-width:210px; }
      .table-scroll { max-height:360px; overflow:auto; border-top:1px solid #eee; margin-top:8px; }
      .description { max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .comment-wrap { margin-top:6px; }

      @media (max-width: 1080px) {
        .kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      @media (max-width: 760px) {
        .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .mini-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">HR Irányítópult</div>
        <h1>Áttekintés</h1>
        <div class="hero-sub">Kérelmek, regisztrációk, állapotok és kapacitásjelzések egy gyors döntéstámogató felületen.</div>
      </header>

      <section class="kpi-grid" aria-label="HR gyorsmutatók">
        <div class="kpi"><div class="kpi-label">Függő kérelmek</div><div class="kpi-value">{{ pendingRequestsCount }}</div></div>
        <div class="kpi"><div class="kpi-label">Mai elfogadások</div><div class="kpi-value">{{ approvedTodayCount }}</div></div>
        <div class="kpi"><div class="kpi-label">Mai elutasítások</div><div class="kpi-value">{{ rejectedTodayCount }}</div></div>
        <div class="kpi"><div class="kpi-label">Függő regisztrációk</div><div class="kpi-value">{{ registrationRequests.length }}</div></div>
        <div class="kpi"><div class="kpi-label">Kezelt 7 napon belül</div><div class="kpi-value">{{ reviewedLast7DaysCount }}</div></div>
        <div class="kpi"><div class="kpi-label">Aktív projektek</div><div class="kpi-value">{{ activeProjectsCount }}</div></div>
        <div class="kpi"><div class="kpi-label">Felhasználók</div><div class="kpi-value">{{ users.length }}</div></div>
      </section>

      <div class="card mini-grid">
        <div class="mini-card">
          <h3 class="mini-title">Legutóbbi elbírált kérelmek</h3>
          <ul class="activity-list" *ngIf="recentReviewedRequests.length; else noReviewedTpl">
            <li *ngFor="let item of recentReviewedRequests">
              {{ item.requesterEmail ?? item.requesterUserId }} · {{ item.projectName }} · {{ item.status }}
              <span class="muted">({{ formatDate(item.reviewedAtUtc) }})</span>
            </li>
          </ul>
          <ng-template #noReviewedTpl>
            <div class="empty-note">Még nincs elbírált kérelem.</div>
          </ng-template>
        </div>

        <div class="mini-card">
          <h3 class="mini-title">Jelzés és fókusz</h3>
          <ul class="activity-list">
            <li>Legrégebbi függő kérelem: <strong>{{ oldestPendingAgeLabel }}</strong></li>
            <li>Jelenlegi szűrő: <strong>{{ statusFilterLabel }}</strong></li>
            <li>HR/Admin felhasználók: <strong>{{ privilegedUsersCount }}</strong></li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <h3 style="margin:0;">Kézi időkérelmek</h3>
          <div class="row">
            <select [(ngModel)]="statusFilter" (ngModelChange)="onStatusChange()">
              <option value="pending">Függőben</option>
              <option value="approved">Elfogadott</option>
              <option value="rejected">Elutasított</option>
              <option value="all">Összes</option>
            </select>
            <button type="button" class="btn" (click)="loadRequests()" [disabled]="busy || loading">Frissítés</button>
          </div>
        </div>

        <div class="muted" *ngIf="loading">Betöltés...</div>
        <div class="muted" *ngIf="!loading && !error && !requests.length">Nincs találat.</div>

        <div class="table-scroll" *ngIf="requests.length">
          <table class="compact">
            <thead>
              <tr>
                <th>Kérelmező</th>
                <th>Intervallum</th>
                <th>Projekt</th>
                <th>Leírás</th>
                <th>Állapot</th>
                <th>Művelet</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of requests">
                <td>
                  <div>{{ item.requesterEmail ?? item.requesterUserId }}</div>
                  <div class="muted" style="font-size:11px;">ID: {{ item.requesterUserId }}</div>
                </td>
                <td>
                  <div>{{ formatDate(item.startUtc) }}</div>
                  <div>→ {{ formatDate(item.endUtc) }}</div>
                </td>
                <td>
                  <div>{{ item.projectName }}</div>
                  <div class="muted" *ngIf="item.taskName">Feladat: {{ item.taskName }}</div>
                </td>
                <td><span class="description" [title]="item.description ?? '-'">{{ item.description ?? '-' }}</span></td>
                <td>{{ item.status }}</td>
                <td class="actions-col">
                  <ng-container *ngIf="isPending(item.status); else reviewed">
                    <div class="row">
                      <button type="button" class="btn btn-mini btn-success" (click)="approve(item)" [disabled]="busy">Elfogadás</button>
                      <button type="button" class="btn btn-mini btn-danger" (click)="reject(item)" [disabled]="busy">Elutasítás</button>
                      <button type="button" class="btn btn-mini" (click)="toggleComment(item.id)" [disabled]="busy">
                        {{ isCommentOpen(item.id) ? 'Megjegyzés elrejtése' : 'Megjegyzés' }}
                      </button>
                    </div>
                    <div class="comment-wrap" *ngIf="isCommentOpen(item.id)">
                      <textarea [(ngModel)]="reviewComments[item.id]" placeholder="HR megjegyzés (opcionális)"></textarea>
                    </div>
                  </ng-container>
                  <ng-template #reviewed>
                    <div class="muted">{{ item.reviewerComment ?? '-' }}</div>
                  </ng-template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Regisztrációs kérelmek</h3>
          <button type="button" class="btn" (click)="loadRegistrationRequests()" [disabled]="busy || loading">Frissítés</button>
        </div>

        <div class="muted" *ngIf="!loading && !error && !registrationRequests.length" style="margin-top:8px;">Nincs függő regisztrációs kérelem.</div>

        <table class="compact" *ngIf="registrationRequests.length" style="margin-top:8px;">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Felhasználónév</th>
              <th>Kérelem ideje</th>
              <th>E-mail státusz</th>
              <th>Művelet</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of registrationRequests">
              <td>{{ item.email ?? '-' }}</td>
              <td>{{ item.userName ?? '-' }}</td>
              <td>{{ formatDate(item.registrationRequestedAtUtc) }}</td>
              <td>{{ item.emailConfirmed ? 'Megerősítve' : 'Nincs megerősítve' }}</td>
              <td>
                <div class="row">
                  <button type="button" class="btn btn-mini btn-success" (click)="approveRegistration(item)" [disabled]="isRegistrationBusy(item.userId) || busy">Engedélyezés</button>
                  <button type="button" class="btn btn-mini btn-danger" (click)="rejectRegistration(item)" [disabled]="isRegistrationBusy(item.userId) || busy">Elutasítás</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="row" style="justify-content:space-between; margin-top:10px;" *ngIf="registrationTotalPages > 1">
          <div class="muted">Oldal: {{ registrationPage }} / {{ registrationTotalPages }} · Összesen: {{ registrationTotalItems }}</div>
          <div class="row">
            <button type="button" class="btn btn-mini" (click)="goToRegistrationPage(registrationPage - 1)" [disabled]="busy || loading || registrationPage <= 1">Előző</button>
            <button type="button" class="btn btn-mini" (click)="goToRegistrationPage(registrationPage + 1)" [disabled]="busy || loading || registrationPage >= registrationTotalPages">Következő</button>
          </div>
        </div>
      </div>

      <div class="ok" *ngIf="message">{{ message }}</div>
      <div class="error" *ngIf="error">{{ error }}</div>
    </div>
  `,
})
export class HrOverviewPage {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private requestsLoadSeq = 0;

  allRequests: HrManualTimeRequestDto[] = [];
  requests: HrManualTimeRequestDto[] = [];
  registrationRequests: HrRegistrationRequestDto[] = [];
  registrationPage = 1;
  registrationPageSize = 10;
  registrationTotalItems = 0;
  registrationTotalPages = 1;
  private usePagedRegistrationApi = true;
  users: HrUserListItemDto[] = [];
  projects: HrProjectListItemDto[] = [];
  statusFilter: 'pending' | 'approved' | 'rejected' | 'all' = 'pending';
  loading = false;
  busy = false;
  message = '';
  error = '';
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  reviewComments: Record<number, string> = {};
  private commentOpenById: Record<number, boolean> = {};
  private registrationBusyByUserId: Record<string, boolean> = {};

  get pendingRequestsCount(): number {
    return this.allRequests.filter(x => this.isPending(x.status)).length;
  }

  get approvedTodayCount(): number {
    const today = this.dayKey(new Date());
    return this.allRequests.filter(x => this.isApproved(x.status) && this.dayKey(x.reviewedAtUtc) === today).length;
  }

  get rejectedTodayCount(): number {
    const today = this.dayKey(new Date());
    return this.allRequests.filter(x => this.isRejected(x.status) && this.dayKey(x.reviewedAtUtc) === today).length;
  }

  get reviewedLast7DaysCount(): number {
    const edge = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return this.allRequests.filter(x => {
      const reviewed = this.parseDate(x.reviewedAtUtc);
      return !!reviewed && reviewed.getTime() >= edge;
    }).length;
  }

  get recentReviewedRequests(): HrManualTimeRequestDto[] {
    return this.allRequests
      .filter(x => this.isApproved(x.status) || this.isRejected(x.status))
      .sort((a, b) => (this.parseDate(b.reviewedAtUtc)?.getTime() ?? 0) - (this.parseDate(a.reviewedAtUtc)?.getTime() ?? 0))
      .slice(0, 5);
  }

  get oldestPendingAgeLabel(): string {
    const oldest = this.allRequests
      .filter(x => this.isPending(x.status))
      .sort((a, b) => (this.parseDate(a.createdAtUtc)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (this.parseDate(b.createdAtUtc)?.getTime() ?? Number.MAX_SAFE_INTEGER))[0];

    if (!oldest) return 'nincs függő kérelem';

    const created = this.parseDate(oldest.createdAtUtc);
    if (!created) return 'ismeretlen';

    const hours = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60)));
    if (hours < 24) return `${hours} óra`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} nap ${remHours} óra`;
  }

  get statusFilterLabel(): string {
    if (this.statusFilter === 'all') return 'Összes';
    if (this.statusFilter === 'approved') return 'Elfogadott';
    if (this.statusFilter === 'rejected') return 'Elutasított';
    return 'Függőben';
  }

  get privilegedUsersCount(): number {
    return this.users.filter(x => x.roles.includes('HR') || x.roles.includes('Admin')).length;
  }

  get activeProjectsCount(): number {
    return this.projects.filter(x => x.isActive !== false).length;
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadRequests(),
      this.loadRegistrationRequests(),
      this.loadDashboardFacts(),
    ]);
  }

  async loadRequests(): Promise<void> {
    const requestSeq = ++this.requestsLoadSeq;
    this.loading = true;
    this.clearError();
    this.clearMessage();

    try {
      const requests = await firstValueFrom(
        this.http
          .get<HrManualTimeRequestDto[]>(`${API_BASE}/api/hr/manual-time-requests?status=all`)
          .pipe(timeout(10000))
      );

      if (requestSeq !== this.requestsLoadSeq) {
        return;
      }

      this.allRequests = requests;
      this.applyStatusFilter();
      this.clearError();
    } catch (e: any) {
      if (requestSeq !== this.requestsLoadSeq) {
        return;
      }

      this.setError(this.extractError(e, 'A kérelmek betöltése sikertelen.'));
      this.allRequests = [];
      this.requests = [];
    } finally {
      if (requestSeq === this.requestsLoadSeq) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async onStatusChange(): Promise<void> {
    this.applyStatusFilter();
    this.cdr.detectChanges();
  }

  async approve(item: HrManualTimeRequestDto): Promise<void> {
    const confirmed = window.confirm(`Biztosan elfogadod ezt a kézi időkérelmet?\n\nKérelmező: ${item.requesterEmail ?? item.requesterUserId}`);
    if (!confirmed) {
      return;
    }

    await this.review(item.id, 'approve');
  }

  async reject(item: HrManualTimeRequestDto): Promise<void> {
    const confirmed = window.confirm(`Biztosan elutasítod ezt a kézi időkérelmet?\n\nKérelmező: ${item.requesterEmail ?? item.requesterUserId}`);
    if (!confirmed) {
      return;
    }

    await this.review(item.id, 'reject');
  }

  formatDate(utc: string | null | undefined): string {
    if (!utc) return '-';
    const trimmed = String(utc).trim();
    if (!trimmed) return '-';

    const hasZone = /z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/i.test(trimmed);
    const normalized = hasZone ? trimmed : `${trimmed}Z`;
    const value = new Date(normalized);
    return Number.isNaN(value.getTime()) ? '-' : value.toLocaleString('hu-HU');
  }

  isPending(status: string | null | undefined): boolean {
    return String(status ?? '').trim().toLowerCase() === 'pending';
  }

  isRegistrationBusy(userId: string): boolean {
    return this.registrationBusyByUserId[userId] === true;
  }

  toggleComment(id: number): void {
    this.commentOpenById[id] = !this.commentOpenById[id];
  }

  isCommentOpen(id: number): boolean {
    return this.commentOpenById[id] === true;
  }

  async loadRegistrationRequests(): Promise<void> {
    try {
      const response = await this.fetchRegistrationRequestsPagedResponse();
      this.registrationRequests = response.items;
      this.registrationPage = response.page;
      this.registrationPageSize = response.pageSize;
      this.registrationTotalItems = response.totalItems;
      this.registrationTotalPages = response.totalPages;
    } catch (e: any) {
      this.setError(this.extractError(e, 'A regisztrációs kérelmek betöltése sikertelen.'));
      this.registrationRequests = [];
      this.registrationTotalItems = 0;
      this.registrationTotalPages = 1;
    } finally {
      this.cdr.detectChanges();
    }
  }

  goToRegistrationPage(page: number): void {
    if (page < 1 || page > this.registrationTotalPages || page === this.registrationPage) {
      return;
    }

    this.registrationPage = page;
    void this.loadRegistrationRequests();
  }

  async approveRegistration(item: HrRegistrationRequestDto): Promise<void> {
    const confirmed = window.confirm(`Biztosan engedélyezed ezt a regisztrációt?\n\n${item.email ?? item.userName ?? item.userId}`);
    if (!confirmed) {
      return;
    }

    this.registrationBusyByUserId[item.userId] = true;
    this.clearFeedback();

    try {
      await firstValueFrom(
        this.http.post(`${API_BASE}/api/hr/registration-requests/${encodeURIComponent(item.userId)}/approve`, {})
          .pipe(timeout(10000))
      );

      this.setMessage(`Regisztráció engedélyezve: ${item.email ?? item.userName ?? item.userId}`);
      await this.loadRegistrationRequests();
      await this.loadDashboardFacts();
    } catch (e: any) {
      this.setError(this.extractError(e, 'Regisztráció jóváhagyása sikertelen.'));
    } finally {
      this.registrationBusyByUserId[item.userId] = false;
      this.cdr.detectChanges();
    }
  }

  async rejectRegistration(item: HrRegistrationRequestDto): Promise<void> {
    const confirmed = window.confirm(`Biztosan törlöd/elutasítod ezt a regisztrációt?\n\n${item.email ?? item.userName ?? item.userId}`);
    if (!confirmed) {
      return;
    }

    this.registrationBusyByUserId[item.userId] = true;
    this.clearFeedback();

    try {
      await firstValueFrom(
        this.http.post(`${API_BASE}/api/hr/registration-requests/${encodeURIComponent(item.userId)}/reject`, {})
          .pipe(timeout(10000))
      );

      this.setMessage(`Regisztráció elutasítva: ${item.email ?? item.userName ?? item.userId}`);
      await this.loadRegistrationRequests();
      await this.loadDashboardFacts();
    } catch (e: any) {
      this.setError(this.extractError(e, 'Regisztráció elutasítása sikertelen.'));
    } finally {
      this.registrationBusyByUserId[item.userId] = false;
      this.cdr.detectChanges();
    }
  }

  private async review(id: number, action: 'approve' | 'reject'): Promise<void> {
    this.busy = true;
    this.clearFeedback();

    try {
      await firstValueFrom(this.http.post(`${API_BASE}/api/hr/manual-time-requests/${id}/${action}`, {
        comment: (this.reviewComments[id] ?? '').trim() || null,
      }).pipe(timeout(10000)));

      this.setMessage(action === 'approve' ? 'Kérelem elfogadva.' : 'Kérelem elutasítva.');
      await this.loadRequests();
    } catch (e: any) {
      this.setError(this.extractError(e, 'A művelet sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  private extractError(e: any, fallback: string): string {
    if (e?.status === 403) {
      return 'Nincs jogosultságod ehhez a művelethez (403). Jelentkezz ki és be újra HR/Admin fiókkal.';
    }

    if (e?.name === 'TimeoutError') {
      return 'A kérés időtúllépés miatt megszakadt. Próbáld újra Frissítés gombbal.';
    }

    const details = e?.error?.details;
    if (Array.isArray(details) && details.length) {
      return String(details[0]);
    }

    if (typeof e?.error === 'string' && e.error.trim()) {
      return e.error;
    }

    if (typeof e?.error?.message === 'string' && e.error.message.trim()) {
      return e.error.message;
    }

    if (typeof e?.error?.error === 'string' && e.error.error.trim()) {
      return e.error.error;
    }

    return fallback;
  }

  private async loadDashboardFacts(): Promise<void> {
    try {
      const [users, projects] = await Promise.all([
        firstValueFrom(this.http.get<HrUserListItemDto[]>(`${API_BASE}/api/hr/users`).pipe(timeout(10000))),
        firstValueFrom(this.http.get<HrProjectListItemDto[]>(`${API_BASE}/api/projects`).pipe(timeout(10000))),
      ]);

      this.users = users;
      this.projects = projects;
    } catch {
      this.users = [];
      this.projects = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  private async fetchRegistrationRequestsPagedResponse(): Promise<HrPagedResponse<HrRegistrationRequestDto>> {
    if (this.usePagedRegistrationApi) {
      const params = new URLSearchParams({
        page: String(this.registrationPage),
        pageSize: String(this.registrationPageSize),
      });

      try {
        return await firstValueFrom(
          this.http
            .get<HrPagedResponse<HrRegistrationRequestDto>>(`${API_BASE}/api/hr/registration-requests/paged?${params.toString()}`)
            .pipe(timeout(10000))
        );
      } catch (e: any) {
        if (e?.status !== 404) {
          throw e;
        }

        this.usePagedRegistrationApi = false;
      }
    }

    const list = await firstValueFrom(
      this.http
        .get<HrRegistrationRequestDto[]>(`${API_BASE}/api/hr/registration-requests`)
        .pipe(timeout(10000))
    );

    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.registrationPageSize));
    const page = Math.min(Math.max(1, this.registrationPage), totalPages);
    const start = (page - 1) * this.registrationPageSize;

    return {
      page,
      pageSize: this.registrationPageSize,
      totalItems,
      totalPages,
      items: list.slice(start, start + this.registrationPageSize),
    };
  }

  private applyStatusFilter(): void {
    if (this.statusFilter === 'all') {
      this.requests = [...this.allRequests];
      return;
    }

    this.requests = this.allRequests.filter(x => {
      if (this.statusFilter === 'pending') return this.isPending(x.status);
      if (this.statusFilter === 'approved') return this.isApproved(x.status);
      return this.isRejected(x.status);
    });
  }

  private isApproved(status: string | null | undefined): boolean {
    return String(status ?? '').trim().toLowerCase() === 'approved';
  }

  private isRejected(status: string | null | undefined): boolean {
    return String(status ?? '').trim().toLowerCase() === 'rejected';
  }

  private dayKey(value: string | Date | null | undefined): string {
    const parsed = value instanceof Date ? value : this.parseDate(value);
    if (!parsed) return '';

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;

    const hasZone = /z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/i.test(trimmed);
    const normalized = hasZone ? trimmed : `${trimmed}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private clearFeedback(): void {
    this.clearMessage();
    this.clearError();
  }

  private setMessage(text: string): void {
    this.clearMessage();
    this.message = text;
    this.messageTimer = setTimeout(() => {
      this.message = '';
      this.messageTimer = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  private setError(text: string): void {
    this.clearError();
    this.error = text;
    this.errorTimer = setTimeout(() => {
      this.error = '';
      this.errorTimer = null;
      this.cdr.detectChanges();
    }, 5000);
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
}