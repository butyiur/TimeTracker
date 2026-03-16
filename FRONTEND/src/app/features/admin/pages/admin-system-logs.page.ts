import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { AdminAuditApiService, AuditLogDto, PagedAuditResponse } from '../data/admin-audit-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { display:grid; gap:16px; max-width:1320px; }
      .hero {
        border:1px solid #c7cff0;
        border-radius:20px;
        padding:18px 20px;
        background:
          radial-gradient(520px 200px at 90% 12%, rgba(123, 102, 245, 0.22), rgba(123, 102, 245, 0) 70%),
          linear-gradient(180deg, #ffffff, #eef3ff);
        box-shadow:0 14px 30px rgba(33, 22, 86, 0.16);
      }
      .hero h1 { margin:0; }
      .hero p { margin:8px 0 0; color:#4f4675; }
      .hero-kicker {
        font-size: .74rem;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #5d5684;
        font-weight: 800;
      }
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:16px;
        background:linear-gradient(180deg, #ffffff, #f3f6ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .row { display:flex; gap:10px; align-items:end; flex-wrap:wrap; }
      .filters-grid {
        display:grid;
        grid-template-columns: repeat(4, minmax(170px, 1fr));
        gap:10px;
      }
      .field { display:grid; gap:6px; min-width:0; }
      .field.sm { min-width:100px; }
      .field span { font-weight:600; color:#2a245d; }
      input, select { padding:10px 11px; border:1px solid #bcc6eb; border-radius:12px; }
      .btn {
        padding:8px 13px;
        border:1px solid rgba(156, 143, 242, 0.72);
        border-radius:12px;
        background:linear-gradient(135deg, var(--tt-primary-a), var(--tt-primary-b));
        color:#fff;
        cursor:pointer;
        font-weight:700;
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
      .muted { opacity:1; color:#544c7a; }
      .error { color:#b00020; }
      .toolbar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
      }
      .chip {
        display:inline-flex;
        align-items:center;
        border:1px solid #d3daf2;
        border-radius:999px;
        padding:5px 10px;
        color:#352d72;
        font-size:.82rem;
        font-weight:700;
        background:#f7f9ff;
      }
      .quick-btn {
        min-height:34px;
        min-width:0;
        padding:6px 10px;
        border:1px solid #d3daf2;
        border-radius:999px;
        color:#352d72;
        font-size:.82rem;
        font-weight:700;
        background:#f7f9ff;
        cursor:pointer;
      }
      .quick-btn:hover {
        border-color:#bfc9ef;
        background:#eef2ff;
      }
      .count { color:#1e1852; font-size:1.2rem; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #e8ebf6; padding:10px 8px; vertical-align:top; }
      th { color:#251f56; font-size:1.01rem; }
      tbody tr:hover { background:rgba(125, 108, 229, 0.05); }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; }
      .pager { display:flex; gap:8px; align-items:center; }
      .pager-btn { min-width:118px; }
      .event-chip {
        display:inline-flex;
        align-items:center;
        border:1px solid #d6ddf3;
        border-radius:999px;
        padding:4px 10px;
        background:#f8f9ff;
        color:#2d2769;
      }
      .result-pill {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:80px;
        border-radius:999px;
        padding:4px 10px;
        border:1px solid transparent;
        font-size:.78rem;
        font-weight:700;
      }
      .result-success { color:#14532d; background:#dcfce7; border-color:#bbf7d0; }
      .result-fail { color:#991b1b; background:#fee2e2; border-color:#fecaca; }
      .result-other { color:#334155; background:#e2e8f0; border-color:#cbd5e1; }
      .json {
        max-width:460px;
        white-space:pre-wrap;
        word-break:break-word;
        background:#f7f8ff;
        border:1px solid #dce2f5;
        border-radius:10px;
        padding:8px;
      }
      .table-wrap { overflow:auto; border-radius:12px; }
      @media (max-width: 1180px) {
        .filters-grid { grid-template-columns: repeat(2, minmax(170px, 1fr)); }
      }
      @media (max-width: 760px) {
        .filters-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">Admin Irányítópult</div>
        <h1>Rendszerlogok</h1>
        <p>Audit események, bejelentkezési minták és hibák átlátható, szűrhető nézetben.</p>
      </header>

      <div class="card">
        <div class="filters-grid">
          <label class="field">
            <span>Ettől (UTC)</span>
            <input type="datetime-local" [(ngModel)]="filters.fromLocal" />
          </label>

          <label class="field">
            <span>Eddig (UTC)</span>
            <input type="datetime-local" [(ngModel)]="filters.toLocal" />
          </label>

          <label class="field">
            <span>Event type</span>
            <input [(ngModel)]="filters.eventType" placeholder="pl. auth.login.success" />
          </label>

          <label class="field">
            <span>User ID</span>
            <input [(ngModel)]="filters.userId" placeholder="user id" />
          </label>

          <label class="field">
            <span>Result</span>
            <select [(ngModel)]="filters.result">
              <option value="">Összes</option>
              <option value="success">success</option>
              <option value="fail">fail</option>
            </select>
          </label>

          <label class="field sm">
            <span>Lapméret</span>
            <select [(ngModel)]="filters.pageSize">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
          </label>
        </div>

        <div class="toolbar" style="margin-top:12px;">
          <div class="row">
            <button type="button" class="quick-btn" (click)="applyQuickFilter('today-fail')" [disabled]="busy">Mai hibák</button>
            <button type="button" class="quick-btn" (click)="applyQuickFilter('today-success')" [disabled]="busy">Mai sikeresek</button>
            <button type="button" class="quick-btn" (click)="applyQuickFilter('auth')" [disabled]="busy">Audit auth</button>
          </div>

          <div class="row">
          <button class="btn" (click)="load(1)" [disabled]="busy">Szűrés</button>
          <button class="btn" (click)="resetFilters()" [disabled]="busy">Alaphelyzet</button>
          </div>
        </div>

        <div class="muted" style="margin-top:8px;" *ngIf="busy">Betöltés...</div>
        <div class="error" style="margin-top:8px;" *ngIf="error">{{ error }}</div>
      </div>

      <div class="card" *ngIf="response">
        <div class="toolbar">
          <strong class="count">Találatok: {{ response.totalCount }}</strong>
          <div class="pager">
            <button class="btn pager-btn" (click)="prevPage()" [disabled]="busy || response.page <= 1">Előző</button>
            <span>{{ response.page }} / {{ totalPages() }}</span>
            <button class="btn pager-btn" (click)="nextPage()" [disabled]="busy || response.page >= totalPages()">Következő</button>
          </div>
        </div>

        <div class="table-wrap" style="margin-top:10px;" *ngIf="response.items.length; else noDataTpl">
        <table>
          <thead>
            <tr>
              <th>Időpont</th>
              <th>Event</th>
              <th>Result</th>
              <th>Felhasználó</th>
              <th>IP</th>
              <th>Correlation</th>
              <th>Adat</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of response.items">
              <td>{{ formatDate(item.timestampUtc) }}</td>
              <td><span class="mono event-chip">{{ item.eventType }}</span></td>
              <td>
                <span
                  class="result-pill"
                  [ngClass]="resultClass(item.result)">
                  {{ item.result }}
                </span>
              </td>
              <td>
                <div>{{ item.userEmail || '-' }}</div>
                <div class="muted mono">{{ item.userId || '-' }}</div>
              </td>
              <td class="mono">{{ item.ipAddress || '-' }}</td>
              <td class="mono">{{ item.correlationId || '-' }}</td>
              <td class="mono json">{{ trimJson(item.dataJson) }}</td>
            </tr>
          </tbody>
        </table>
        </div>

        <ng-template #noDataTpl>
          <div class="muted" style="margin-top:8px;">Nincs találat a megadott szűrőkkel.</div>
        </ng-template>
      </div>
    </div>
  `,
})
export class AdminSystemLogsPage {
  private api = inject(AdminAuditApiService);
  private cdr = inject(ChangeDetectorRef);

  busy = false;
  error = '';
  response: PagedAuditResponse | null = null;

  filters = {
    fromLocal: '',
    toLocal: '',
    eventType: '',
    userId: '',
    result: '',
    pageSize: 50,
  };

  async ngOnInit(): Promise<void> {
    await this.load(1);
  }

  async load(page: number): Promise<void> {
    this.busy = true;
    this.error = '';

    try {
      this.response = await firstValueFrom(
        this.api
          .getAudit({
            fromUtc: this.toUtcIsoOrUndefined(this.filters.fromLocal),
            toUtc: this.toUtcIsoOrUndefined(this.filters.toLocal),
            eventType: this.filters.eventType.trim() || undefined,
            userId: this.filters.userId.trim() || undefined,
            result: this.filters.result || undefined,
            page,
            pageSize: this.filters.pageSize,
          })
          .pipe(timeout(12000))
      );
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        this.error = 'A munkamenet lejárt. Jelentkezz be újra.';
      } else if (status === 403) {
        this.error = 'Nincs jogosultságod az admin audit naplóhoz.';
      } else if (e?.name === 'TimeoutError') {
        this.error = 'Az audit napló betöltése időtúllépés miatt megszakadt.';
      } else {
        this.error = e?.error?.error ?? 'Az audit napló betöltése sikertelen.';
      }
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  applyQuickFilter(kind: 'today-fail' | 'today-success' | 'auth'): void {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (kind === 'today-fail') {
      this.filters.fromLocal = this.toLocalDateTimeInput(dayStart);
      this.filters.toLocal = this.toLocalDateTimeInput(now);
      this.filters.result = 'fail';
      this.filters.eventType = '';
      this.filters.userId = '';
      void this.load(1);
      return;
    }

    if (kind === 'today-success') {
      this.filters.fromLocal = this.toLocalDateTimeInput(dayStart);
      this.filters.toLocal = this.toLocalDateTimeInput(now);
      this.filters.result = 'success';
      this.filters.eventType = '';
      this.filters.userId = '';
      void this.load(1);
      return;
    }

    this.filters.fromLocal = '';
    this.filters.toLocal = '';
    this.filters.result = '';
    this.filters.eventType = 'auth.';
    this.filters.userId = '';
    void this.load(1);
  }

  async prevPage(): Promise<void> {
    if (!this.response || this.response.page <= 1) return;
    await this.load(this.response.page - 1);
  }

  async nextPage(): Promise<void> {
    if (!this.response || this.response.page >= this.totalPages()) return;
    await this.load(this.response.page + 1);
  }

  totalPages(): number {
    if (!this.response) return 1;
    return Math.max(1, Math.ceil(this.response.totalCount / this.response.pageSize));
  }

  resetFilters(): void {
    this.filters = {
      fromLocal: '',
      toLocal: '',
      eventType: '',
      userId: '',
      result: '',
      pageSize: 50,
    };
    void this.load(1);
    this.cdr.detectChanges();
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('hu-HU');
  }

  trimJson(value: string | null): string {
    if (!value) return '-';
    if (value.length <= 300) return value;
    return `${value.slice(0, 300)}…`;
  }

  resultClass(value: string | null | undefined): string {
    const key = String(value ?? '').trim().toLowerCase();
    if (key === 'success') return 'result-success';
    if (key === 'fail') return 'result-fail';
    return 'result-other';
  }

  private toUtcIsoOrUndefined(localValue: string): string | undefined {
    const trimmed = localValue.trim();
    if (!trimmed) return undefined;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private toLocalDateTimeInput(value: Date): string {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }
}
