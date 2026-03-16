import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;

type ManualEntryRequestDto = {
  id: number;
  projectName: string;
  taskName: string | null;
  startUtc: string;
  endUtc: string;
  description: string | null;
  status: string;
  createdAtUtc: string;
};

type TimeEntryDto = {
  id: number;
  projectId: number;
  projectName: string;
  taskId: number | null;
  taskName: string | null;
  startUtc: string;
  endUtc: string | null;
  description: string | null;
};

type MyProjectDto = {
  id: number;
  name: string;
};

type ProjectTaskDto = {
  id: number;
  projectId: number;
  name: string;
  isActive: boolean;
  createdAtUtc: string;
};

type AssignedTaskChip = {
  projectId: number;
  projectName: string;
  taskName: string;
  color: string;
  border: string;
};

type TimeBenchmarkWindowDto = {
  minutes: number;
  percentile: number;
  bucket: 'red' | 'yellow' | 'green' | string;
  sampleSize: number;
};

type MyTimeBenchmarkDto = {
  day: TimeBenchmarkWindowDto;
  week: TimeBenchmarkWindowDto;
  month: TimeBenchmarkWindowDto;
  year: TimeBenchmarkWindowDto;
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [
    `
      .wrap { display:grid; gap:12px; max-width:none; }
      .card { border:1px solid #d4dbf2; border-radius:14px; padding:14px; background:#fff; }
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
        max-width: 820px;
      }
      .muted { opacity:.8; }
      .btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:34px;
        padding:5px 10px;
        border-radius:10px;
        font-size:.9rem;
        text-decoration:none;
      }
      .error { color:#b00020; }
      .request-panel { display:grid; gap:10px; }
      .kpi-grid {
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap:10px;
      }
      .kpi {
        border:1px solid #d8e0f5;
        border-radius:12px;
        padding:10px;
        background:#fff;
      }
      .kpi-label {
        font-size:.75rem;
        text-transform:uppercase;
        letter-spacing:.06em;
        color:#4a4375;
        font-weight:800;
      }
      .kpi-value {
        margin-top:5px;
        font-size:1.15rem;
        font-weight:800;
        color:#1f1a56;
      }
      .kpi-meta {
        margin-top:4px;
        font-size:.78rem;
        color:#5f5786;
      }
      .tone-red { border-color:#fecaca; background:#fff1f2; }
      .tone-yellow { border-color:#fde68a; background:#fff8db; }
      .tone-green { border-color:#bbf7d0; background:#ecfdf3; }
      .segment { display:grid; grid-template-columns: 1fr 1fr; gap:0; border:1px solid #ddd; border-radius:10px; overflow:hidden; }
      .segment-btn { border:0; border-right:1px solid #ddd; background:#fff; padding:8px 10px; text-align:left; cursor:pointer; color:#2a255b; }
      .segment-btn:last-child { border-right:0; }
      .segment-btn.active {
        background: linear-gradient(135deg, #e9e3ff, #d9ceff);
        color:#30246e;
      }
      .segment-btn.active .segment-title,
      .segment-btn.active .segment-count { color:#30246e; }
      .segment-title { font-size:12px; opacity:.8; }
      .segment-count { font-size:18px; font-weight:700; line-height:1.1; }
      .thin-list { list-style:none; margin:0; padding:0; border:1px solid #eee; border-radius:10px; overflow:hidden; }
      .thin-item { padding:8px 10px; border-top:1px solid #eee; font-size:13px; line-height:1.25; }
      .thin-item:first-child { border-top:0; }
      .pager { display:flex; gap:8px; align-items:center; }
      .pager-btn { padding:4px 8px; border:1px solid #ddd; border-radius:8px; background:#fff; cursor:pointer; }
      .pager-btn:disabled { opacity:.6; cursor:not-allowed; }
      .chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
      .chip {
        display:inline-flex;
        align-items:center;
        border:1px solid #d5dcf3;
        border-radius:999px;
        padding:3px 8px;
        background:#f8f9ff;
        color:#2d2769;
        font-size:.8rem;
      }
      .chip.project {
        background: var(--chip-bg, #f8f9ff);
        border-color: var(--chip-border, #d5dcf3);
      }
      .chip .dot {
        width:8px;
        height:8px;
        border-radius:999px;
        margin-right:6px;
        background: var(--chip-dot, #6d5ed6);
        box-shadow: 0 0 0 2px rgba(255,255,255,0.7);
      }
      .chip.task {
        border: 2px solid var(--task-border, #6d5ed6);
        background: var(--task-bg, #fbfcff);
      }
      .task-project {
        color:#5b5486;
        font-size:.76rem;
        margin-left:6px;
      }
      .request-note {
        margin-top:10px;
      }
      .request-actions {
        margin-top:14px;
      }
      @media (max-width: 1024px) {
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
        <div class="hero-kicker">Dolgozói Irányítópult</div>
        <h1>Áttekintés</h1>
        <div class="hero-sub">Napi munkavégzés, projekt-hozzárendelések és kézi időkérelmek egy helyen, gyors döntéstámogatással.</div>
      </header>

      <div class="card">
        <div><strong>Munkaidő teljesítmény</strong></div>
        <div class="muted" style="margin-top:4px;">Napi, heti, havi és éves összesítések az eddig ledolgozott idő alapján.</div>

        <div class="kpi-grid" style="margin-top:10px;">
          <div class="kpi" [ngClass]="kpiToneClass('day')">
            <div class="kpi-label">Napi munkaidő</div>
            <div class="kpi-value">{{ formatHours(workMinutes.day) }}</div>
            <div class="kpi-meta">{{ kpiMeta('day') }}</div>
          </div>

          <div class="kpi" [ngClass]="kpiToneClass('week')">
            <div class="kpi-label">Heti munkaidő</div>
            <div class="kpi-value">{{ formatHours(workMinutes.week) }}</div>
            <div class="kpi-meta">{{ kpiMeta('week') }}</div>
          </div>

          <div class="kpi" [ngClass]="kpiToneClass('month')">
            <div class="kpi-label">Havi munkaidő</div>
            <div class="kpi-value">{{ formatHours(workMinutes.month) }}</div>
            <div class="kpi-meta">{{ kpiMeta('month') }}</div>
          </div>

          <div class="kpi" [ngClass]="kpiToneClass('year')">
            <div class="kpi-label">Éves munkaidő</div>
            <div class="kpi-value">{{ formatHours(workMinutes.year) }}</div>
            <div class="kpi-meta">{{ kpiMeta('year') }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div><strong>Hozzárendelések</strong></div>
        <div class="muted" style="margin-top:4px;">Projektek és feladatok, amelyekhez a profilod jelenleg hozzáfér.</div>

        <div class="muted" style="margin-top:8px;"><strong>Projektek:</strong> {{ assignedProjects.length }}</div>
        <div class="chips" *ngIf="assignedProjects.length; else noProjectTpl">
          <span
            class="chip project"
            *ngFor="let p of assignedProjects"
            [style.--chip-bg]="projectColorStyle(p.id).bg"
            [style.--chip-border]="projectColorStyle(p.id).border"
            [style.--chip-dot]="projectColorStyle(p.id).dot"
          >
            <span class="dot"></span>{{ p.name }}
          </span>
        </div>
        <ng-template #noProjectTpl>
          <div class="muted">Nincs hozzád rendelt projekt.</div>
        </ng-template>

        <div class="muted" style="margin-top:10px;"><strong>Feladatok:</strong> {{ assignedTasks.length }}</div>
        <div class="chips" *ngIf="assignedTasks.length; else noTaskTpl">
          <span
            class="chip task"
            *ngFor="let t of assignedTasks"
            [style.--task-border]="t.border"
            [style.--task-bg]="alpha(t.color, 0.08)"
          >
            {{ t.taskName }}
            <span class="task-project">({{ t.projectName }})</span>
          </span>
        </div>
        <ng-template #noTaskTpl>
          <div class="muted">Nincs megjeleníthető feladat.</div>
        </ng-template>
      </div>

      <div class="card">
        <div><strong>Kézi időkérelmek</strong></div>
        <div class="request-panel">
          <div class="segment">
            <button type="button" class="segment-btn" [class.active]="requestView === 'pending'" (click)="setRequestView('pending')">
              <div class="segment-title">Függő</div>
              <div class="segment-count">{{ pendingCount }}</div>
            </button>
            <button type="button" class="segment-btn" [class.active]="requestView === 'closed'" (click)="setRequestView('closed')">
              <div class="segment-title">Lezárt (elfogadott/elutasított)</div>
              <div class="segment-count">{{ closedCount }}</div>
            </button>
          </div>

          <div class="muted" *ngIf="!visibleRequests.length">Nincs megjeleníthető kérelem ebben a nézetben.</div>

          <ul class="thin-list" *ngIf="visibleRequests.length">
            <li class="thin-item" *ngFor="let req of pagedVisibleRequests">
              {{ formatDate(req.startUtc) }}–{{ formatDate(req.endUtc) }} · {{ req.projectName }}
              <span class="muted" *ngIf="req.taskName"> / {{ req.taskName }}</span>
              <span class="muted" *ngIf="requestView === 'closed'"> · {{ req.status }}</span>
            </li>
          </ul>

          <div class="pager" *ngIf="requestTotalPages > 1">
            <button type="button" class="pager-btn" (click)="prevPage()" [disabled]="requestPage <= 1">‹ Előző</button>
            <span>{{ requestPage }} / {{ requestTotalPages }}</span>
            <button type="button" class="pager-btn" (click)="nextPage()" [disabled]="requestPage >= requestTotalPages">Következő ›</button>
          </div>
        </div>
        <div class="muted request-note">A függő kérelmek HR jóváhagyásra várnak.</div>
        <div class="request-actions">
          <a class="btn" routerLink="/calendar">Naptár megnyitása</a>
        </div>
      </div>

      <div class="error" *ngIf="error">{{ error }}</div>
    </div>
  `,
})
export class EmployeeOverviewPage {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private readonly pageSize = 5;

  pendingCount = 0;
  closedCount = 0;
  error = '';
  pendingRequests: ManualEntryRequestDto[] = [];
  closedRequests: ManualEntryRequestDto[] = [];
  requestView: 'pending' | 'closed' = 'pending';
  requestPage = 1;

  assignedProjects: MyProjectDto[] = [];
  assignedTasks: AssignedTaskChip[] = [];
  private readonly projectPalette = ['#3767d4', '#1f9d7a', '#d87b22', '#bf3d72', '#6d57d6', '#1290b9', '#8f7a1d', '#d14f3f', '#247b65', '#4457cc'];
  private readonly projectColorMap = new Map<number, string>();
  workMinutes = { day: 0, week: 0, month: 0, year: 0 };
  benchmark: MyTimeBenchmarkDto | null = null;

  get visibleRequests(): ManualEntryRequestDto[] {
    return this.requestView === 'pending' ? this.pendingRequests : this.closedRequests;
  }

  get requestTotalPages(): number {
    return Math.max(1, Math.ceil(this.visibleRequests.length / this.pageSize));
  }

  get pagedVisibleRequests(): ManualEntryRequestDto[] {
    const start = (this.requestPage - 1) * this.pageSize;
    return this.visibleRequests.slice(start, start + this.pageSize);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRequests(), this.loadWorkAndAssignments()]);
  }

  private async loadWorkAndAssignments(): Promise<void> {
    const [entriesRes, projectsRes, benchRes] = await Promise.allSettled([
      firstValueFrom(this.http.get<TimeEntryDto[]>(`${API_BASE}/api/timeentries/mine`)),
      firstValueFrom(this.http.get<MyProjectDto[]>(`${API_BASE}/api/projects/mine`)),
      firstValueFrom(this.http.get<MyTimeBenchmarkDto>(`${API_BASE}/api/timeentries/mine/benchmark`)),
    ]);

    let entries: TimeEntryDto[] = [];

    if (entriesRes.status === 'fulfilled') {
      entries = entriesRes.value;
    }

    if (projectsRes.status === 'fulfilled') {
      this.assignedProjects = projectsRes.value;
      this.rebuildProjectColorMap(this.assignedProjects);
      await this.loadTaskNames(this.assignedProjects);
    }

    if (benchRes.status === 'fulfilled') {
      this.benchmark = this.normalizeBenchmarkResponse(benchRes.value);
      this.workMinutes = {
        day: this.benchmark.day?.minutes ?? 0,
        week: this.benchmark.week?.minutes ?? 0,
        month: this.benchmark.month?.minutes ?? 0,
        year: this.benchmark.year?.minutes ?? 0,
      };
    } else {
      this.benchmark = null;
      this.workMinutes = this.computeOwnMinutesFromEntries(entries);
    }

    if (entriesRes.status === 'rejected' && projectsRes.status === 'rejected' && benchRes.status === 'rejected') {
      this.error = 'Az áttekintő adatok betöltése sikertelen.';
    }

    this.cdr.detectChanges();
  }

  private async loadRequests(): Promise<void> {
    this.error = '';

    try {
      let requests = await firstValueFrom(
        this.http.get<ManualEntryRequestDto[]>(`${API_BASE}/api/timeentries/manual-requests/mine?status=all`)
      );

      if (!requests.length) {
        await new Promise(resolve => setTimeout(resolve, 250));
        requests = await firstValueFrom(
          this.http.get<ManualEntryRequestDto[]>(`${API_BASE}/api/timeentries/manual-requests/mine?status=all`)
        );
      }

      this.pendingRequests = requests.filter(x => String(x.status).toLowerCase() === 'pending');
      this.closedRequests = requests.filter(x => String(x.status).toLowerCase() !== 'pending');
      this.pendingCount = this.pendingRequests.length;
      this.closedCount = this.closedRequests.length;
      this.requestPage = 1;
    } catch {
      this.error = 'A függő kérelmek számláló betöltése sikertelen.';
    } finally {
      this.cdr.detectChanges();
    }
  }

  private async loadTaskNames(projects: MyProjectDto[]): Promise<void> {
    if (!projects.length) {
      this.assignedTasks = [];
      return;
    }

    const taskCalls = projects.map(project =>
      firstValueFrom(this.http.get<ProjectTaskDto[]>(`${API_BASE}/api/projects/${project.id}/tasks`))
    );

    const results = await Promise.allSettled(taskCalls);
    const taskMap = new Map<string, AssignedTaskChip>();

    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];
      if (item.status !== 'fulfilled') continue;

      const project = projects[index];
      const color = this.projectColorById(project.id);

      for (const task of item.value) {
        if (!task.name?.trim()) continue;

        const taskName = task.name.trim();
        const key = `${project.id}::${taskName.toLocaleLowerCase('hu-HU')}`;

        if (taskMap.has(key)) continue;

        taskMap.set(key, {
          projectId: project.id,
          projectName: project.name,
          taskName,
          color,
          border: this.alpha(color, 0.6),
        });
      }
    }

    this.assignedTasks = [...taskMap.values()].sort((a, b) => {
      const projectCmp = a.projectName.localeCompare(b.projectName, 'hu-HU');
      if (projectCmp !== 0) return projectCmp;
      return a.taskName.localeCompare(b.taskName, 'hu-HU');
    });
  }

  private projectColorById(projectId: number): string {
    const safeId = Number(projectId);
    if (this.projectColorMap.has(safeId)) {
      return this.projectColorMap.get(safeId)!;
    }

    const fallbackIndex = Math.abs(safeId) % this.projectPalette.length;
    return this.projectPalette[fallbackIndex];
  }

  projectColorStyle(projectId: number): { bg: string; border: string; dot: string } {
    const dot = this.projectColorById(projectId);
    return {
      bg: this.alpha(dot, 0.1),
      border: this.alpha(dot, 0.58),
      dot,
    };
  }

  private rebuildProjectColorMap(projects: MyProjectDto[]): void {
    this.projectColorMap.clear();

    const ordered = [...projects].sort((a, b) => a.name.localeCompare(b.name, 'hu-HU'));

    for (let index = 0; index < ordered.length; index += 1) {
      const project = ordered[index];
      const paletteColor = this.projectPalette[index % this.projectPalette.length];
      const cycle = Math.floor(index / this.projectPalette.length);
      const color = cycle === 0 ? paletteColor : this.hslColorForIndex(index);
      this.projectColorMap.set(project.id, color);
    }
  }

  private hslColorForIndex(index: number): string {
    const hue = Math.round((index * 137.508) % 360);
    return `hsl(${hue} 64% 45%)`;
  }

  private normalizeBenchmarkResponse(value: MyTimeBenchmarkDto | any): MyTimeBenchmarkDto {
    const src = value ?? {};
    const readWindow = (camel: string, pascal: string): TimeBenchmarkWindowDto => {
      const node = src[camel] ?? src[pascal] ?? {};
      return {
        minutes: Number(node.minutes ?? node.Minutes ?? 0),
        percentile: Number(node.percentile ?? node.Percentile ?? 0),
        bucket: String(node.bucket ?? node.Bucket ?? ''),
        sampleSize: Number(node.sampleSize ?? node.SampleSize ?? 0),
      };
    };

    return {
      day: readWindow('day', 'Day'),
      week: readWindow('week', 'Week'),
      month: readWindow('month', 'Month'),
      year: readWindow('year', 'Year'),
    };
  }

  alpha(hex: string, opacity: number): string {
    const safe = String(hex ?? '').trim();
    const normalized = safe.startsWith('#') ? safe.slice(1) : safe;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(109,94,214,${opacity})`;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  private computeOwnMinutesFromEntries(entries: TimeEntryDto[]): { day: number; week: number; month: number; year: number } {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const weekStart = new Date(dayStart);
    weekStart.setDate(dayStart.getDate() - diffToMonday);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

    const totalInWindow = (start: Date): number => {
      let sum = 0;
      for (const entry of entries) {
        const entryStart = this.parseDate(entry.startUtc);
        const entryEnd = entry.endUtc ? this.parseDate(entry.endUtc) : now;
        if (!entryStart || !entryEnd) continue;

        const overlapStart = entryStart > start ? entryStart : start;
        const overlapEnd = entryEnd < now ? entryEnd : now;
        if (overlapEnd <= overlapStart) continue;

        sum += Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
      }
      return sum;
    };

    return {
      day: totalInWindow(dayStart),
      week: totalInWindow(weekStart),
      month: totalInWindow(monthStart),
      year: totalInWindow(yearStart),
    };
  }

  private parseDate(value: string): Date | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const hasZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(raw);
    const date = new Date(hasZone ? raw : `${raw}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  formatHours(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h} ó ${m} p`;
  }

  kpiToneClass(kind: 'day' | 'week' | 'month' | 'year'): string {
    const bucket = this.benchmark?.[kind]?.bucket;
    if (bucket === 'red') return 'tone-red';
    if (bucket === 'yellow') return 'tone-yellow';
    if (bucket === 'green') return 'tone-green';
    return '';
  }

  kpiMeta(kind: 'day' | 'week' | 'month' | 'year'): string {
    const item = this.benchmark?.[kind];
    if (!item) return 'Összevetés: még nincs elég adat';
    if ((item.sampleSize ?? 0) <= 0) return 'Összevetés: még nincs összehasonlítható dolgozói minta';

    if (item.bucket === 'red') {
      return `Összevetés: jelenleg a mezőny alsó sávjában vagy (${item.sampleSize} dolgozó adata alapján)`;
    }

    if (item.bucket === 'green') {
      return `Összevetés: jelenleg az élmezőnyben vagy (${item.sampleSize} dolgozó adata alapján)`;
    }

    return `Összevetés: jelenleg a középmezőnyben vagy (${item.sampleSize} dolgozó adata alapján)`;
  }

  setRequestView(view: 'pending' | 'closed'): void {
    this.requestView = view;
    this.requestPage = 1;
  }

  prevPage(): void {
    if (this.requestPage <= 1) return;
    this.requestPage -= 1;
  }

  nextPage(): void {
    if (this.requestPage >= this.requestTotalPages) return;
    this.requestPage += 1;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}