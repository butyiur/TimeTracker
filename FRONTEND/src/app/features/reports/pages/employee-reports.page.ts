import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  HrUserLookup,
  ReportProjectLookup,
  ReportTaskLookup,
  ReportsApiService,
  TimeEntryReportRow,
  TimeEntrySummaryRow,
} from '../data/reports-api.service';
import { EmployeeReportFilters, ReportsFilterPanelComponent } from '../components/reports-filter-panel.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReportsFilterPanelComponent],
  styles: [
    `
      .wrap { display:grid; gap:14px; max-width:1200px; }
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
      .card { border:1px solid #ddd; border-radius:14px; padding:16px; background:#fff; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #eee; padding:8px; vertical-align:top; }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Dolgozói jelentések</h1>
        <div class="hero-sub">{{ dashboardSub }}</div>
      </header>

      <tt-reports-filter-panel
        mode="employee"
        [filters]="filters"
        [projects]="projects"
        [tasks]="availableTasks"
        [users]="users"
        [busy]="busy"
        [error]="error"
        (viewSwitch)="onViewSwitch($event)"
        (projectNameChanged)="onProjectNameChange()"
        (refreshLookups)="reloadLookups()"
        (presetWeek)="applyCurrentWeekPreset()"
        (presetMonth)="applyCurrentMonthPreset()"
        (presetPrevMonth)="applyPreviousMonthPreset()"
        (loadRows)="loadRows()"
        (loadSummary)="loadSummary()"
        (exportCsv)="downloadCsv()"
        (exportXlsx)="downloadXlsx()"></tt-reports-filter-panel>

      <div class="card" *ngIf="rows.length">
        <h3 style="margin:0 0 8px;">Részletes időbejegyzések</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Projekt</th>
              <th>Feladat</th>
              <th>Felhasználó</th>
              <th>Kezdés</th>
              <th>Befejezés</th>
              <th>Perc</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of rows">
              <td>{{ item.id }}</td>
              <td>{{ item.projectName }} ({{ item.projectId }})</td>
              <td>{{ item.taskName ? (item.taskName + ' (' + item.taskId + ')') : '-' }}</td>
              <td>{{ item.userEmail }}</td>
              <td>{{ formatDate(item.startUtc) }}</td>
              <td>{{ item.endUtc ? formatDate(item.endUtc) : 'Fut' }}</td>
              <td>{{ item.durationMinutes ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card" *ngIf="summary.length">
        <h3 style="margin:0 0 8px;">Összesítés (projekt + felhasználó)</h3>
        <table>
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Feladat</th>
              <th>Felhasználó</th>
              <th>Összes perc</th>
              <th>Összes óra</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of summary">
              <td>{{ item.projectName }} ({{ item.projectId }})</td>
              <td>{{ item.taskName ? (item.taskName + ' (' + item.taskId + ')') : '-' }}</td>
              <td>{{ item.userEmail }}</td>
              <td>{{ item.totalMinutes }}</td>
              <td>{{ (item.totalMinutes / 60).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EmployeeReportsPage implements OnDestroy, OnInit {
  private api = inject(ReportsApiService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private auth = inject(AuthStateService);
  private busyTimer: ReturnType<typeof setTimeout> | null = null;

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'HR Irányítópult';
    if (roles.includes('Admin')) return 'Admin Irányítópult';
    return 'Dolgozói Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'Dolgozói riportok elemzése HR nézetből, felhasználó szerinti bontásban.';
    if (roles.includes('Admin')) return 'Dolgozói riportok elemzése admin nézetből, felhasználó szerinti bontásban.';
    return 'Dolgozói időriportok áttekintése szűrhető nézetben.';
  }

  filters: EmployeeReportFilters = {
    employeeText: '',
    fromLocal: '',
    toLocal: '',
    projectName: '',
    taskName: '',
  };

  busy = false;
  error = '';
  rows: TimeEntryReportRow[] = [];
  summary: TimeEntrySummaryRow[] = [];

  users: HrUserLookup[] = [];
  projects: ReportProjectLookup[] = [];
  availableTasks: ReportTaskLookup[] = [];

  async ngOnInit(): Promise<void> {
    this.applyCurrentWeekPreset();
    await this.reloadLookups();
  }

  ngOnDestroy(): void {
    if (this.busyTimer) {
      clearTimeout(this.busyTimer);
      this.busyTimer = null;
    }
  }

  async onProjectNameChange(): Promise<void> {
    this.filters.taskName = '';
    await this.reloadTaskSuggestions();
  }

  async loadRows(): Promise<void> {
    const query = this.toQuery();
    if (!query) return;

    this.startBusy();
    this.error = '';

    try {
      this.rows = await firstValueFrom(this.api.getTimeEntries(query).pipe(timeout(12000)));
      this.summary = [];
    } catch (e: any) {
      this.error = e?.name === 'TimeoutError'
        ? 'A részletes riport betöltése időtúllépés miatt megszakadt.'
        : (e?.error?.error ?? e?.message ?? 'A részletes riport betöltése sikertelen.');
    } finally {
      this.stopBusy();
    }
  }

  async loadSummary(): Promise<void> {
    const query = this.toQuery();
    if (!query) return;

    this.startBusy();
    this.error = '';

    try {
      this.summary = await firstValueFrom(this.api.getSummary(query).pipe(timeout(12000)));
      this.rows = [];
    } catch (e: any) {
      this.error = e?.name === 'TimeoutError'
        ? 'Az összesítő riport betöltése időtúllépés miatt megszakadt.'
        : (e?.error?.error ?? e?.message ?? 'Az összesítő riport betöltése sikertelen.');
    } finally {
      this.stopBusy();
    }
  }

  async downloadCsv(): Promise<void> {
    const query = this.toQuery();
    if (!query) return;

    this.startBusy();
    this.error = '';

    try {
      const blob = await firstValueFrom(this.api.exportCsv(query).pipe(timeout(12000)));
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'timetracker-employee-report.csv';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      this.error = e?.name === 'TimeoutError'
        ? 'A CSV export időtúllépés miatt megszakadt.'
        : (e?.error?.error ?? e?.message ?? 'A CSV export sikertelen.');
    } finally {
      this.stopBusy();
    }
  }

  async downloadXlsx(): Promise<void> {
    const query = this.toQuery();
    if (!query) return;

    this.startBusy();
    this.error = '';

    try {
      const blob = await firstValueFrom(this.api.exportXlsx(query).pipe(timeout(12000)));
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'timetracker-employee-report.xlsx';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      this.error = e?.name === 'TimeoutError'
        ? 'Az XLSX export időtúllépés miatt megszakadt.'
        : (e?.error?.error ?? e?.message ?? 'Az XLSX export sikertelen.');
    } finally {
      this.stopBusy();
    }
  }

  applyCurrentWeekPreset(): void {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    this.filters.fromLocal = this.toDateTimeLocal(start);
    this.filters.toLocal = this.toDateTimeLocal(end);
  }

  applyCurrentMonthPreset(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    this.filters.fromLocal = this.toDateTimeLocal(start);
    this.filters.toLocal = this.toDateTimeLocal(end);
  }

  applyPreviousMonthPreset(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    this.filters.fromLocal = this.toDateTimeLocal(start);
    this.filters.toLocal = this.toDateTimeLocal(end);
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('hu-HU');
  }

  onViewSwitch(view: 'project' | 'employee'): void {
    if (view === 'project') {
      void this.router.navigateByUrl('/reports');
    }
  }

  async reloadLookups(): Promise<void> {
    this.startBusy();
    this.error = '';

    try {
      const [users, projects] = await Promise.all([
        firstValueFrom(this.api.getHrUsers().pipe(timeout(10000))),
        firstValueFrom(this.api.getProjects().pipe(timeout(10000))),
      ]);
      this.users = users;
      this.projects = projects;
      await this.reloadTaskSuggestions();
    } catch (e: any) {
      this.error = e?.error?.error ?? e?.message ?? 'A szűrő listák betöltése sikertelen.';
    } finally {
      this.stopBusy();
    }
  }

  private async reloadTaskSuggestions(): Promise<void> {
    const project = this.findProjectByName(this.filters.projectName);
    if (!project) {
      this.availableTasks = [];
      return;
    }

    this.availableTasks = await firstValueFrom(this.api.getProjectTasks(project.id).pipe(timeout(10000)));
  }

  private toQuery(): { from?: string; to?: string; projectId?: number; taskId?: number; userId?: string; includeRunning?: boolean } | null {
    const user = this.findUser(this.filters.employeeText);
    if (!user) {
      this.error = 'Válassz dolgozót a felajánlott listából.';
      return null;
    }

    const project = this.findProjectByName(this.filters.projectName);
    if (this.filters.projectName.trim() && !project) {
      this.error = 'A projekt mezőben válassz a felajánlott projektek közül.';
      return null;
    }

    const task = this.findTaskByName(this.filters.taskName);
    if (this.filters.taskName.trim() && !task) {
      this.error = 'A feladat mezőben válassz a felajánlott feladatok közül.';
      return null;
    }

    return {
      from: this.toUtcIsoOrUndefined(this.filters.fromLocal),
      to: this.toUtcIsoOrUndefined(this.filters.toLocal),
      projectId: project?.id,
      taskId: task?.id,
      userId: user.userId,
      includeRunning: false,
    };
  }

  private findUser(text: string): HrUserLookup | undefined {
    const query = text.trim().toLocaleLowerCase('hu-HU');
    if (!query) return undefined;

    return this.users.find(u =>
      (u.email ?? '').trim().toLocaleLowerCase('hu-HU') === query
      || (u.userName ?? '').trim().toLocaleLowerCase('hu-HU') === query
      || u.userId.trim().toLocaleLowerCase('hu-HU') === query
    );
  }

  private findProjectByName(name: string): ReportProjectLookup | undefined {
    const query = name.trim().toLocaleLowerCase('hu-HU');
    if (!query) return undefined;
    return this.projects.find(p => p.name.trim().toLocaleLowerCase('hu-HU') === query);
  }

  private findTaskByName(name: string): ReportTaskLookup | undefined {
    const query = name.trim().toLocaleLowerCase('hu-HU');
    if (!query) return undefined;
    return this.availableTasks.find(t => t.name.trim().toLocaleLowerCase('hu-HU') === query);
  }

  private toUtcIsoOrUndefined(localValue: string): string | undefined {
    const trimmed = String(localValue ?? '').trim();
    if (!trimmed) return undefined;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private toDateTimeLocal(value: Date): string {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  private startBusy(): void {
    this.busy = true;
    if (this.busyTimer) {
      clearTimeout(this.busyTimer);
    }

    this.busyTimer = setTimeout(() => {
      this.busy = false;
      this.busyTimer = null;
      this.error = this.error || 'A művelet túl sokáig tartott, próbáld újra.';
      this.cdr.detectChanges();
    }, 15000);

    this.cdr.detectChanges();
  }

  private stopBusy(): void {
    this.busy = false;
    if (this.busyTimer) {
      clearTimeout(this.busyTimer);
      this.busyTimer = null;
    }
    this.cdr.detectChanges();
  }
}
