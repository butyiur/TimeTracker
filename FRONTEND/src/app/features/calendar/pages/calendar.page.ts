import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CalendarApiService, ManualEntryRequestDto, MyProjectDto, ProjectTaskDto, TimeEntryDto } from '../data/calendar-api.service';

type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  key: string;
};

type CalendarEntry = TimeEntryDto;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { display:grid; gap:16px; }
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
      .layout { display:grid; grid-template-columns: minmax(620px, 1fr) 500px; gap:16px; align-items:start; }
      .card { border:1px solid #ddd; border-radius:12px; background:#fff; padding:14px; }
      .head { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
      .month-nav { display:flex; gap:8px; align-items:center; }
      .dow { display:grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap:6px; margin-bottom:6px; }
      .dow div { font-weight:600; text-align:center; padding:6px 4px; border:1px solid #eee; border-radius:8px; }
      .grid { display:grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap:6px; }
      .day { min-height:92px; border:1px solid #eee; border-radius:10px; padding:6px; background:#fafafa; cursor:pointer; display:grid; align-content:start; gap:6px; }
      .day.off { opacity:.45; }
      .day.active { border-color:#2c7be5; box-shadow: inset 0 0 0 1px #2c7be5; }
      .day.today { border-color:#86b7ff; }
      .day.locked { background:#f3f3f3; }
      .day-num { font-size:12px; font-weight:600; }
      .chips { display:grid; gap:4px; }
      .chip { font-size:11px; line-height:1.2; padding:3px 6px; border-radius:999px; background:#eef4ff; border:1px solid #d9e7ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .summary { font-size:11px; line-height:1.2; padding:3px 6px; border-radius:999px; border:1px solid #ddd; background:#f7f7f7; width:max-content; }
      .summary.low { background:#fff4e5; border-color:#ffd9a8; }
      .summary.ok { background:#e9f7ef; border-color:#b7ebc8; }
      .summary.high { background:#ffe8e8; border-color:#ffc0c0; }
      .muted { opacity:.72; }
      .section { display:grid; gap:8px; }
      .section h3, .section h4 { margin:0; }
      .field { display:grid; gap:6px; }
      .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      input, select, textarea { padding:8px 10px; border:1px solid #ddd; border-radius:10px; width:100%; box-sizing:border-box; }
      textarea { min-height:80px; resize:vertical; }
      .list { margin:0; padding-left:18px; display:grid; gap:6px; }
      .error { color:#b00020; }
      .ok { color:#0a7f20; }
      .warn { color:#8a6d00; }
      .divider { border-top:1px solid #eee; margin:8px 0; }
      .tabs { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .tab { padding:6px 10px; border:1px solid #ddd; border-radius:999px; background:#fff; cursor:pointer; }
      .tab.active { border-color:#2c7be5; color:#2c7be5; font-weight:600; }
      .pager { display:flex; gap:8px; align-items:center; }
      @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">Dolgozói Irányítópult</div>
        <h1>Időnyilvántartás</h1>
        <div class="hero-sub">Napi rögzítés, stopperes követés és kézi korrekciós kérelmek egy helyen.</div>
      </header>

      <div class="layout">
        <div class="card">
          <div class="head">
            <div class="month-nav">
              <button type="button" class="btn btn-sm" (click)="changeMonth(-1)">‹ Előző</button>
              <strong>{{ monthLabel }}</strong>
              <button type="button" class="btn btn-sm" (click)="changeMonth(1)">Következő ›</button>
            </div>
            <button type="button" class="btn btn-sm" (click)="goToToday()">Mai nap</button>
          </div>

          <div class="dow">
            <div *ngFor="let name of dayNames">{{ name }}</div>
          </div>

          <div class="grid">
            <button
              class="day"
              type="button"
              *ngFor="let cell of dayCells"
              [class.off]="!cell.inCurrentMonth"
              [class.active]="cell.key === selectedDateKey"
              [class.today]="cell.key === todayKey"
              [class.locked]="!isDateEditable(cell.date)"
              (click)="selectDate(cell.date)">
              <div class="day-num">{{ cell.date.getDate() }}</div>
              <div class="summary" *ngIf="entriesByDate[cell.key]?.length" [class.low]="dayStatus(cell.key) === 'low'" [class.ok]="dayStatus(cell.key) === 'ok'" [class.high]="dayStatus(cell.key) === 'high'">
                {{ dayTotalHours(cell.key) }} óra
              </div>
              <div class="chips" *ngIf="entriesByDate[cell.key]?.length">
                <div class="chip" *ngFor="let item of previewEntries(cell.key)">
                  {{ timeLabel(item.startUtc) }}–{{ endLabel(item.endUtc) }} · {{ item.projectName }}<ng-container *ngIf="item.taskName"> / {{ item.taskName }}</ng-container>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="card section">
          <h3>Időkövetés – {{ selectedDateLabel }}</h3>
          <div class="muted" *ngIf="selectedEntries.length">Napi összesen: {{ dayTotalHours(selectedDateKey) }} óra</div>
          <div class="warn" *ngIf="activeTrackingLabel">Aktív mérés fut: {{ activeTrackingLabel }}</div>
          <div class="warn" *ngIf="!projects.length">Nincs hozzád rendelt projekt. Kérj hozzárendelést HR-től/Admin-tól.</div>

          <ng-container *ngIf="showStopperSection">
            <h4>Stopperes rögzítés (mai nap)</h4>

            <label class="field">
              <span>Projekt (stopperhez)</span>
              <select [(ngModel)]="selectedProjectId" (ngModelChange)="onStartProjectChange()">
                <option [ngValue]="null">Válassz projektet...</option>
                <option *ngFor="let item of projects" [ngValue]="item.id">{{ item.name }}</option>
              </select>
            </label>

            <label class="field" *ngIf="selectedProjectId">
              <span>Feladat (kötelező)</span>
              <select [(ngModel)]="selectedTaskId">
                <option [ngValue]="null">Válassz feladatot...</option>
                <option *ngFor="let item of taskOptionsFor(selectedProjectId)" [ngValue]="item.id">{{ item.name }}</option>
              </select>
            </label>

            <div class="row">
              <button type="button" class="btn" (click)="toggleTracking()" [disabled]="!canToggleTracking">{{ hasActiveTracking ? 'Stopper leállítása' : 'Stopper indítása' }}</button>
            </div>
          </ng-container>

          <ng-container *ngIf="showManualSection">
            <div class="divider"></div>

            <h4>Kézi korrekció (HR jóváhagyással)</h4>
            <div class="muted">Közvetlen kézi mentés nincs: a kérelem HR listába kerül, és elfogadás után lesz időbejegyzés.</div>
            <div class="muted">Rögzítés: visszamenőleg maximum 7 napra.</div>

            <label class="field">
              <span>Projekt</span>
              <select [(ngModel)]="manualForm.projectId" (ngModelChange)="onManualProjectChange()">
                <option [ngValue]="null">Válassz projektet...</option>
                <option *ngFor="let item of projects" [ngValue]="item.id">{{ item.name }}</option>
              </select>
            </label>

            <label class="field" *ngIf="manualForm.projectId">
              <span>Feladat</span>
              <select [(ngModel)]="manualForm.taskId">
                <option [ngValue]="null">Válassz feladatot...</option>
                <option *ngFor="let item of taskOptionsFor(manualForm.projectId)" [ngValue]="item.id">{{ item.name }}</option>
              </select>
            </label>

            <div class="row">
              <label class="field" style="flex:1; min-width:110px;">
                <span>Kezdés</span>
                <input type="time" [(ngModel)]="manualForm.start" />
              </label>
              <label class="field" style="flex:1; min-width:110px;">
                <span>Befejezés</span>
                <input type="time" [(ngModel)]="manualForm.end" />
              </label>
            </div>

            <label class="field">
              <span>Leírás</span>
              <textarea [(ngModel)]="manualForm.description" placeholder="Miért kell kézi korrekció?"></textarea>
            </label>

            <div class="row">
              <button type="button" class="btn btn-sm" (click)="submitManualRequest()" [disabled]="!projects.length || manualSubmitting">Kérelem küldése HR-nek</button>
            </div>
          </ng-container>

          <div class="muted" *ngIf="showReadOnlyHistorySection">
            Ez a nap már csak megtekinthető. Új rögzítés/kérelem itt nem adható fel.
          </div>

          <div class="ok" *ngIf="message">{{ message }}</div>
          <div class="error" *ngIf="error">{{ error }}</div>

          <div class="divider"></div>
          <h4>{{ requestSectionTitle }}</h4>
          <div class="tabs">
            <button
              type="button"
              class="tab"
              [class.active]="requestView === 'pending'"
              (click)="setRequestView('pending')">
              Függő
            </button>
            <button
              type="button"
              class="tab"
              [class.active]="requestView === 'closed'"
              (click)="setRequestView('closed')">
              Lezárt
            </button>
          </div>

          <div class="muted" *ngIf="!selectedDateVisibleRequests.length">Nincs kérelem erre a napra ebben a nézetben.</div>
          <ul class="list" *ngIf="selectedDateVisibleRequests.length">
            <li *ngFor="let req of pagedVisibleRequests">
              {{ formatDateTime(req.startUtc) }} → {{ formatDateTime(req.endUtc) }} · {{ req.projectName }}
              <span class="muted" *ngIf="req.taskName"> / {{ req.taskName }}</span>
              <span class="muted" *ngIf="req.description"> · {{ req.description }}</span>
              <span class="muted" *ngIf="requestView === 'closed'"> · Állapot: {{ req.status }}</span>
            </li>
          </ul>

          <div class="pager" *ngIf="requestTotalPages > 1">
            <button type="button" class="btn btn-sm" (click)="prevRequestPage()" [disabled]="requestPage <= 1">Előző</button>
            <span>{{ requestPage }} / {{ requestTotalPages }}</span>
            <button type="button" class="btn btn-sm" (click)="nextRequestPage()" [disabled]="requestPage >= requestTotalPages">Következő</button>
          </div>

          <div class="divider"></div>
          <h4>Időbejegyzéseim – kiválasztott nap</h4>
          <div class="muted" *ngIf="!selectedEntries.length">Nincs időbejegyzés a kiválasztott napra.</div>

          <ul class="list" *ngIf="selectedEntries.length">
            <li *ngFor="let item of selectedEntries; let i = index">
              {{ timeLabel(item.startUtc) }}–{{ endLabel(item.endUtc) }} · {{ item.projectName }}
              <span class="muted" *ngIf="item.taskName"> / {{ item.taskName }}</span>
              <span class="muted" *ngIf="item.description"> · {{ item.description }}</span>
              <button type="button" class="btn btn-sm" style="margin-left:8px;" (click)="removeEntry(i)" [disabled]="deleteBusy">Törlés</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class CalendarPage implements OnInit, OnDestroy {
  dayNames = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];

  viewDate = this.startOfMonth(new Date());
  selectedDate = new Date();
  dayCells: DayCell[] = [];

  projects: MyProjectDto[] = [];
  selectedProjectId: number | null = null;
  selectedTaskId: number | null = null;
  tasksByProject: Record<number, ProjectTaskDto[]> = {};
  trackingBusy = false;
  manualSubmitting = false;
  deleteBusy = false;

  manualForm = {
    projectId: null as number | null,
    taskId: null as number | null,
    start: '08:00',
    end: '16:00',
    description: '',
  };

  error = '';
  message = '';
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  entriesByDate: Record<string, CalendarEntry[]> = {};
  pendingRequests: ManualEntryRequestDto[] = [];
  closedRequests: ManualEntryRequestDto[] = [];
  requestView: 'pending' | 'closed' = 'pending';
  requestPage = 1;
  readonly requestPageSize = 5;

  constructor(private api: CalendarApiService, private cdr: ChangeDetectorRef) {
    this.rebuildGrid();
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.loadData();
    } finally {
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  get monthLabel(): string {
    return this.viewDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' });
  }

  get selectedDateKey(): string {
    return this.toKey(this.selectedDate);
  }

  get selectedDateLabel(): string {
    return this.selectedDate.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  get todayKey(): string {
    return this.toKey(new Date());
  }

  get selectedEntries(): CalendarEntry[] {
    return this.entriesByDate[this.selectedDateKey] ?? [];
  }

  get minAllowedDate(): Date {
    const d = this.startOfDay(new Date());
    d.setDate(d.getDate() - 7);
    return d;
  }

  get isSelectedDateEditable(): boolean {
    return this.isDateEditable(this.selectedDate);
  }

  get isTodaySelected(): boolean {
    return this.selectedDateKey === this.todayKey;
  }

  get showStopperSection(): boolean {
    return this.isTodaySelected;
  }

  get showManualSection(): boolean {
    return !this.isTodaySelected && this.isSelectedDateEditable;
  }

  get showReadOnlyHistorySection(): boolean {
    return !this.isTodaySelected && !this.isSelectedDateEditable;
  }

  get hasActiveTracking(): boolean {
    return this.findActiveTracking() !== null;
  }

  get canToggleTracking(): boolean {
    if (!this.showStopperSection || !this.projects.length || !this.selectedProjectId || this.trackingBusy) {
      return false;
    }

    if (this.hasActiveTracking) {
      return true;
    }

    return !!this.selectedTaskId;
  }

  get visibleRequests(): ManualEntryRequestDto[] {
    return this.requestView === 'pending' ? this.pendingRequests : this.closedRequests;
  }

  get selectedDateVisibleRequests(): ManualEntryRequestDto[] {
    return this.visibleRequests.filter(req => this.toKey(this.parseApiDate(req.startUtc)) === this.selectedDateKey);
  }

  get requestSectionTitle(): string {
    return this.isTodaySelected ? 'Mai kérelmek' : 'Kiválasztott napi kérelmek';
  }

  get requestTotalPages(): number {
    return Math.max(1, Math.ceil(this.selectedDateVisibleRequests.length / this.requestPageSize));
  }

  get pagedVisibleRequests(): ManualEntryRequestDto[] {
    const start = (this.requestPage - 1) * this.requestPageSize;
    return this.selectedDateVisibleRequests.slice(start, start + this.requestPageSize);
  }

  get activeTrackingLabel(): string | null {
    const active = this.findActiveTracking();
    if (!active) return null;

    const date = this.parseKey(active.dateKey);
    const dateLabel = date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    const taskSuffix = active.entry.taskName ? ` / ${active.entry.taskName}` : '';
    return `${dateLabel} ${this.timeLabel(active.entry.startUtc)} · ${active.entry.projectName}${taskSuffix}`;
  }

  async toggleTracking(): Promise<void> {
    if (this.trackingBusy) return;

    this.clearFeedback();

    if (!this.showStopperSection) {
      this.error = 'Stopper kizárólag a mai napnál használható.';
      this.scheduleFeedbackClear();
      return;
    }

    const active = this.findActiveTracking();

    if (!this.selectedProjectId) {
      this.error = 'Válassz projektet a stopperhez.';
      this.scheduleFeedbackClear();
      return;
    }

    if (!active && !this.selectedTaskId) {
      this.error = 'Válassz feladatot a stopperhez.';
      this.scheduleFeedbackClear();
      return;
    }

    this.trackingBusy = true;

    try {
      if (active) {
        const stopped = await firstValueFrom(this.api.stopActive({
          projectId: this.selectedProjectId,
          taskId: this.selectedTaskId ?? active.entry.taskId,
          description: null,
        }));
        this.upsertEntry(stopped);
      } else {
        const started = await firstValueFrom(this.api.start(this.selectedProjectId, this.selectedTaskId));
        this.upsertEntry(started);
      }

      this.selectedDate = new Date();
      this.viewDate = this.startOfMonth(new Date());
      this.rebuildGrid();
      await this.syncTrackingSelectors();
    } catch (e) {
      this.error = this.extractError(e, active ? 'A stopper leállítása nem sikerült.' : 'A stopper indítása nem sikerült.');
      this.scheduleFeedbackClear();
    } finally {
      this.trackingBusy = false;
      this.cdr.detectChanges();
    }
  }

  async submitManualRequest(): Promise<void> {
    if (this.manualSubmitting) return;

    this.clearFeedback();

    if (!this.isSelectedDateEditable) {
      this.error = 'Kézi kérelem csak visszamenőleg 7 napra adható be. Mai napnál használd a stoppert.';
      this.scheduleFeedbackClear();
      return;
    }

    if (!this.manualForm.projectId) {
      this.error = 'Válassz projektet.';
      this.scheduleFeedbackClear();
      return;
    }

    if (!this.manualForm.start || !this.manualForm.end) {
      this.error = 'A kezdés és befejezés kötelező.';
      this.scheduleFeedbackClear();
      return;
    }

    if (!this.manualForm.taskId) {
      this.error = 'Válassz feladatot.';
      this.scheduleFeedbackClear();
      return;
    }

    if (this.manualForm.end <= this.manualForm.start) {
      this.error = 'A befejezés későbbi legyen, mint a kezdés.';
      this.scheduleFeedbackClear();
      return;
    }

    const startUtc = this.toUtcIso(this.selectedDate, this.manualForm.start);
    const endUtc = this.toUtcIso(this.selectedDate, this.manualForm.end);
    this.manualSubmitting = true;

    try {
      const created = await firstValueFrom(this.api.createManualRequest({
        projectId: this.manualForm.projectId,
        taskId: this.manualForm.taskId,
        startUtc,
        endUtc,
        description: this.manualForm.description.trim() || null,
      }));

      this.message = 'Kérelem elküldve HR jóváhagyásra.';
      this.manualForm.description = '';
      this.pendingRequests = [created, ...this.pendingRequests].slice(0, 20);
      this.setRequestView('pending');
      this.scheduleFeedbackClear();
    } catch (e) {
      this.error = this.extractError(e, 'A kérelem küldése nem sikerült.');
      this.scheduleFeedbackClear();
    } finally {
      this.manualSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  async removeEntry(index: number): Promise<void> {
    if (this.deleteBusy) return;

    this.clearFeedback();
    const target = this.selectedEntries[index];
    if (!target) return;

    const confirmed = window.confirm('Biztosan törölni szeretnéd ezt az időbejegyzést?');
    if (!confirmed) return;

    this.deleteBusy = true;

    try {
      await firstValueFrom(this.api.deleteEntry(target.id));
      this.removeFromLocal(target.id);
    } catch (e) {
      this.error = this.extractError(e, 'A törlés nem sikerült.');
      this.scheduleFeedbackClear();
    } finally {
      this.deleteBusy = false;
      this.cdr.detectChanges();
    }
  }

  previewEntries(key: string): CalendarEntry[] {
    return (this.entriesByDate[key] ?? []).slice(0, 2);
  }

  dayTotalHours(key: string): string {
    const list = this.entriesByDate[key] ?? [];
    const totalMinutes = list.reduce((sum, item) => sum + this.durationMinutes(item), 0);
    return (totalMinutes / 60).toFixed(1);
  }

  dayStatus(key: string): 'low' | 'ok' | 'high' {
    const totalHours = Number(this.dayTotalHours(key));
    if (totalHours < 4) return 'low';
    if (totalHours <= 8) return 'ok';
    return 'high';
  }

  changeMonth(delta: number): void {
    const next = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + delta, 1);
    this.viewDate = this.startOfMonth(next);
    this.rebuildGrid();
  }

  goToToday(): void {
    this.selectedDate = new Date();
    this.viewDate = this.startOfMonth(new Date());
    this.rebuildGrid();
  }

  selectDate(date: Date): void {
    this.selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    this.requestPage = 1;

    if (date.getMonth() !== this.viewDate.getMonth() || date.getFullYear() !== this.viewDate.getFullYear()) {
      this.viewDate = this.startOfMonth(date);
      this.rebuildGrid();
    }
  }

  isDateEditable(date: Date): boolean {
    const day = this.startOfDay(date);
    const min = this.minAllowedDate;
    const max = this.startOfDay(new Date());
    return day >= min && day < max;
  }

  timeLabel(utc: string): string {
    return this.formatTime(utc);
  }

  endLabel(utc: string | null): string {
    return utc ? this.formatTime(utc) : 'Fut';
  }

  private async loadData(): Promise<void> {
    this.clearFeedback();

    const [projectsResult, entriesResult, requestsResult] = await Promise.allSettled([
      firstValueFrom(this.api.getMyProjects()),
      firstValueFrom(this.api.getMyEntries()),
      firstValueFrom(this.api.getMyManualRequests('all')),
    ]);

    if (projectsResult.status === 'fulfilled') {
      this.projects = projectsResult.value;
      if (!this.selectedProjectId && this.projects.length) {
        this.selectedProjectId = this.projects[0].id;
        await this.ensureTasksLoaded(this.selectedProjectId);
        this.selectedTaskId = this.taskOptionsFor(this.selectedProjectId)[0]?.id ?? null;
      }
      if (!this.manualForm.projectId && this.projects.length) {
        this.manualForm.projectId = this.projects[0].id;
        await this.ensureTasksLoaded(this.manualForm.projectId);
        this.manualForm.taskId = this.taskOptionsFor(this.manualForm.projectId)[0]?.id ?? null;
      }
    } else {
      this.projects = [];
    }

    if (entriesResult.status === 'fulfilled') {
      this.hydrateEntries(entriesResult.value);
    } else {
      this.entriesByDate = {};
    }

    if (requestsResult.status === 'fulfilled') {
      this.pendingRequests = requestsResult.value
        .filter(x => String(x.status).toLowerCase() === 'pending')
        .slice(0, 20);
      this.closedRequests = requestsResult.value
        .filter(x => String(x.status).toLowerCase() !== 'pending')
        .slice(0, 20);
    } else {
      this.pendingRequests = [];
      this.closedRequests = [];
    }

    this.requestPage = 1;

    await this.syncTrackingSelectors();

    const failures = [projectsResult, entriesResult, requestsResult].filter(x => x.status === 'rejected');
    if (failures.length) {
      const firstError = (failures[0] as PromiseRejectedResult).reason;
      const status = Number((firstError as any)?.status ?? 0);

      if (status === 401) {
        this.error = 'A munkamenet lejárt. Jelentkezz be újra.';
        return;
      }

      if (status === 403) {
        this.error = 'Ehhez az oldalhoz nincs megfelelő jogosultságod.';
        return;
      }

      this.error = this.extractError(firstError, 'A naptár adatok betöltése részben sikertelen.');
      this.scheduleFeedbackClear();
    }
  }

  private clearFeedback(): void {
    this.error = '';
    this.message = '';
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  private scheduleFeedbackClear(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    this.feedbackTimer = setTimeout(() => {
      this.error = '';
      this.message = '';
      this.feedbackTimer = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  formatDateTime(utc: string): string {
    const value = this.parseApiDate(utc);
    return Number.isNaN(value.getTime()) ? '-' : value.toLocaleString('hu-HU');
  }

  setRequestView(view: 'pending' | 'closed'): void {
    this.requestView = view;
    this.requestPage = 1;
  }

  prevRequestPage(): void {
    if (this.requestPage <= 1) return;
    this.requestPage -= 1;
  }

  nextRequestPage(): void {
    if (this.requestPage >= this.requestTotalPages) return;
    this.requestPage += 1;
  }

  private hydrateEntries(entries: CalendarEntry[]): void {
    const map: Record<string, CalendarEntry[]> = {};

    for (const entry of entries) {
      const key = this.toKey(this.parseApiDate(entry.startUtc));
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => this.parseApiDate(a.startUtc).getTime() - this.parseApiDate(b.startUtc).getTime());
    }

    this.entriesByDate = map;
  }

  private upsertEntry(entry: CalendarEntry): void {
    this.removeFromLocal(entry.id);

    const key = this.toKey(this.parseApiDate(entry.startUtc));
    const list = [...(this.entriesByDate[key] ?? []), entry];
    list.sort((a, b) => this.parseApiDate(a.startUtc).getTime() - this.parseApiDate(b.startUtc).getTime());

    this.entriesByDate = {
      ...this.entriesByDate,
      [key]: list,
    };
  }

  private removeFromLocal(entryId: number): void {
    const next: Record<string, CalendarEntry[]> = {};

    for (const [key, list] of Object.entries(this.entriesByDate)) {
      const filtered = list.filter(x => x.id !== entryId);
      if (filtered.length) {
        next[key] = filtered;
      }
    }

    this.entriesByDate = next;
  }

  private findActiveTracking(): { dateKey: string; entry: CalendarEntry } | null {
    for (const [dateKey, list] of Object.entries(this.entriesByDate)) {
      const entry = list.find(item => item.endUtc === null);
      if (entry) {
        return { dateKey, entry };
      }
    }

    return null;
  }

  private durationMinutes(entry: CalendarEntry): number {
    const start = this.parseApiDate(entry.startUtc).getTime();
    const end = entry.endUtc ? this.parseApiDate(entry.endUtc).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    return Math.max(0, Math.round((end - start) / 60000));
  }

  private formatTime(utc: string): string {
    const date = this.parseApiDate(utc);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private parseApiDate(value: string): Date {
    const input = String(value ?? '').trim();
    if (!input) return new Date(Number.NaN);
    const hasZone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(input);
    return new Date(hasZone ? input : `${input}Z`);
  }

  private toUtcIso(date: Date, value: string): string {
    const [hour, minute] = value.split(':').map(x => Number(x));
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number.isNaN(hour) ? 0 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
    return local.toISOString();
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseKey(key: string): Date {
    const [y, m, d] = key.split('-').map(x => Number(x));
    return new Date(y, (m || 1) - 1, d || 1);
  }

  private rebuildGrid(): void {
    const first = this.startOfMonth(this.viewDate);
    const startDay = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startDay);

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inCurrentMonth: d.getMonth() === this.viewDate.getMonth(), key: this.toKey(d) });
    }

    this.dayCells = cells;
  }

  private extractError(error: unknown, fallback: string): string {
    const e = error as any;
    const details = e?.error?.details;

    if (Array.isArray(details) && details.length) {
      return String(details[0]);
    }

    if (typeof e?.error === 'string' && e.error.trim()) {
      return e.error;
    }

    if (typeof e?.error?.error === 'string' && e.error.error.trim()) {
      return e.error.error;
    }

    return fallback;
  }

  taskOptionsFor(projectId: number | null): ProjectTaskDto[] {
    if (!projectId) return [];
    return this.tasksByProject[projectId] ?? [];
  }

  async onStartProjectChange(): Promise<void> {
    this.selectedTaskId = null;
    if (this.selectedProjectId) {
      await this.ensureTasksLoaded(this.selectedProjectId);
      this.selectedTaskId = this.taskOptionsFor(this.selectedProjectId)[0]?.id ?? null;
    }
  }

  async onManualProjectChange(): Promise<void> {
    this.manualForm.taskId = null;
    if (this.manualForm.projectId) {
      await this.ensureTasksLoaded(this.manualForm.projectId);
      this.manualForm.taskId = this.taskOptionsFor(this.manualForm.projectId)[0]?.id ?? null;
    }
  }

  private async ensureTasksLoaded(projectId: number): Promise<void> {
    if (this.tasksByProject[projectId]) return;

    try {
      const tasks = await firstValueFrom(this.api.getProjectTasks(projectId));
      this.tasksByProject[projectId] = tasks.filter(x => x.isActive);
    } catch {
      this.tasksByProject[projectId] = [];
    }
  }

  private async syncTrackingSelectors(): Promise<void> {
    const active = this.findActiveTracking();

    if (active) {
      this.selectedProjectId = active.entry.projectId;
      await this.ensureTasksLoaded(active.entry.projectId);
      this.selectedTaskId = active.entry.taskId ?? this.taskOptionsFor(active.entry.projectId)[0]?.id ?? null;
      return;
    }

    if (!this.selectedProjectId && this.projects.length) {
      this.selectedProjectId = this.projects[0].id;
      await this.ensureTasksLoaded(this.selectedProjectId);
    }

    if (this.selectedProjectId) {
      if (!this.tasksByProject[this.selectedProjectId]) {
        await this.ensureTasksLoaded(this.selectedProjectId);
      }

      const options = this.taskOptionsFor(this.selectedProjectId);
      if (!this.selectedTaskId || !options.some(x => x.id === this.selectedTaskId)) {
        this.selectedTaskId = options[0]?.id ?? null;
      }
    }
  }
}
