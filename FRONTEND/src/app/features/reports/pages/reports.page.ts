import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  ReportProjectLookup,
  ReportTaskLookup,
  ReportsApiService,
  TimeEntryReportRow,
  TimeEntrySummaryRow,
} from '../data/reports-api.service';
import { ProjectReportFilters, ReportsFilterPanelComponent } from '../components/reports-filter-panel.component';

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
      .chart-title { margin:0; font-size:1.02rem; }
      .chart-subtitle { margin:4px 0 12px; color:#59606d; font-size:.9rem; }
      .pie-wrap { display:grid; gap:14px; grid-template-columns:minmax(180px, 220px) 1fr; align-items:center; }
      .pie {
        width:180px;
        height:180px;
        border-radius:50%;
        border:1px solid #e1e4eb;
        box-shadow:inset 0 0 0 1px #fff;
      }
      .legend { display:grid; gap:8px; }
      .legend-item { display:flex; align-items:center; gap:8px; }
      .legend-dot { width:10px; height:10px; border-radius:50%; flex:0 0 auto; }
      .legend-main { display:flex; justify-content:space-between; gap:8px; width:100%; }
      .legend-label { color:#1d2430; }
      .legend-value { color:#59606d; white-space:nowrap; }
      .trend-wrap { display:grid; gap:8px; }
      .trend-meta { display:flex; justify-content:space-between; color:#59606d; font-size:.86rem; }
      .trend-svg { width:100%; height:240px; display:block; border:1px solid #eceff3; border-radius:12px; background:linear-gradient(180deg, #fafcff 0%, #ffffff 100%); }
      .trend-grid { stroke:#edf0f5; stroke-width:1; }
      .trend-line { fill:none; stroke:#0a7e66; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
      .trend-area { fill:rgba(10, 126, 102, 0.12); }
      .trend-dot { fill:#0a7e66; }
      .burnup-wrap { display:grid; gap:10px; }
      .burnup-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
      .burnup-control { display:flex; align-items:center; gap:8px; color:#334155; font-size:.9rem; }
      .burnup-control input {
        width:82px;
        border:1px solid #d5dce7;
        border-radius:8px;
        padding:5px 8px;
        font:inherit;
      }
      .burnup-svg { width:100%; height:250px; display:block; border:1px solid #eceff3; border-radius:12px; background:linear-gradient(180deg, #fafeff 0%, #ffffff 100%); }
      .burnup-grid { stroke:#ecf1f5; stroke-width:1; }
      .burnup-plan { fill:none; stroke:#94a3b8; stroke-width:2.5; stroke-dasharray:6 5; }
      .burnup-actual { fill:none; stroke:#0ea5e9; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
      .burnup-dot { fill:#0ea5e9; }
      .burnup-meta { display:flex; align-items:center; justify-content:space-between; gap:10px; color:#475569; font-size:.86rem; flex-wrap:wrap; }
      .pill {
        padding:3px 9px;
        border-radius:999px;
        font-size:.8rem;
        border:1px solid #cfe5f7;
        background:#e9f6ff;
        color:#0c4a6e;
      }
      .status-chip {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:2px 8px;
        border-radius:999px;
        font-size:.78rem;
        font-weight:600;
        border:1px solid transparent;
      }
      .status-over { color:#991b1b; background:#fee2e2; border-color:#fecaca; }
      .status-warn { color:#92400e; background:#fef3c7; border-color:#fde68a; }
      .status-good { color:#14532d; background:#dcfce7; border-color:#bbf7d0; }
      .status-none { color:#334155; background:#e2e8f0; border-color:#cbd5e1; }
      .alerts { display:grid; gap:8px; }
      .alert-item { padding:10px 12px; border-radius:10px; border:1px solid #fecaca; background:#fff1f2; color:#7f1d1d; }
      .alert-title { font-weight:600; }
      .heatmap-wrap { display:grid; gap:10px; }
      .heatmap-scroll { overflow-x:auto; border:1px solid #eceff3; border-radius:12px; }
      .heatmap {
        min-width:840px;
        display:grid;
        grid-template-columns:110px repeat(24, minmax(26px, 1fr));
        gap:4px;
        padding:10px;
        background:linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
      }
      .heat-head {
        font-size:.74rem;
        color:#6b7280;
        text-align:center;
        line-height:1.4;
      }
      .heat-day {
        font-size:.84rem;
        color:#1d2430;
        font-weight:600;
        display:flex;
        align-items:center;
      }
      .heat-cell {
        height:24px;
        border-radius:6px;
        border:1px solid #e7ecf4;
      }
      .heat-legend {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }
      .heat-scale {
        width:min(260px, 100%);
        height:10px;
        border-radius:999px;
        background:linear-gradient(90deg, #f3faf6, #cbeed8, #66c18c, #0a7e66);
        border:1px solid #d9e1ef;
      }
      .muted { color:#59606d; font-size:.9rem; }
      .tip { margin-top:10px; padding:8px 10px; border-radius:10px; background:#f5f7fb; color:#445066; font-size:.86rem; }
      table { width:100%; border-collapse:collapse; }
      th, td { text-align:left; border-bottom:1px solid #eee; padding:8px; vertical-align:top; }

      @media (max-width: 760px) {
        .pie-wrap { grid-template-columns:1fr; }
        .pie { margin:0 auto; }
      }

    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Jelentések</h1>
        <div class="hero-sub">{{ dashboardSub }}</div>
      </header>

      <tt-reports-filter-panel
        mode="project"
        [filters]="filters"
        [projects]="projects"
        [tasks]="availableTasks"
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

      <section class="card" *ngIf="pieSlices.length">
        <h3 class="chart-title">Munkaidő megoszlás felhasználónként</h3>
        <p class="chart-subtitle">A szűrt adatok alapján mutatja, ki mennyi időt rögzített.</p>

        <div class="pie-wrap">
          <div class="pie" [style.background]="pieBackground"></div>

          <div class="legend">
            <div class="legend-item" *ngFor="let item of pieSlices">
              <span class="legend-dot" [style.background]="item.color"></span>
              <div class="legend-main">
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-value">{{ formatMinutes(item.minutes) }} ({{ item.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card" *ngIf="dailyTrend.length">
        <h3 class="chart-title">Összes rögzített munkaidő trend</h3>
        <p class="chart-subtitle">Napi bontású, "árfolyam" jellegű görbe a részletes időbejegyzésekből.</p>

        <div class="trend-wrap">
          <svg class="trend-svg" viewBox="0 0 760 240" preserveAspectRatio="none" aria-label="Munkaidő trend grafikon">
            <line class="trend-grid" x1="42" y1="24" x2="42" y2="210"></line>
            <line class="trend-grid" x1="42" y1="210" x2="740" y2="210"></line>
            <line class="trend-grid" x1="42" y1="163" x2="740" y2="163"></line>
            <line class="trend-grid" x1="42" y1="116" x2="740" y2="116"></line>
            <line class="trend-grid" x1="42" y1="69" x2="740" y2="69"></line>

            <polygon class="trend-area" [attr.points]="trendAreaPoints"></polygon>
            <polyline class="trend-line" [attr.points]="trendPolylinePoints"></polyline>

            <circle class="trend-dot" *ngFor="let point of trendPoints" [attr.cx]="point.x" [attr.cy]="point.y" r="3"></circle>
          </svg>

          <div class="trend-meta">
            <span>Kezdet: {{ dailyTrend[0].label }}</span>
            <span>Csúcs: {{ formatMinutes(maxDailyMinutes) }}</span>
            <span>Vég: {{ dailyTrend[dailyTrend.length - 1].label }}</span>
          </div>

          <div class="tip">Tipp: a trendgrafikon a "Részletes időbejegyzések" betöltése után lesz a legpontosabb.</div>
        </div>
      </section>

      <section class="card" *ngIf="burnupSeries.length">
        <h3 class="chart-title">Kumulált terv vs tény (Burnup)</h3>
        <p class="chart-subtitle">A ténylegesen rögzített idő felhalmozódása a HR által megadott tervórákhoz képest.</p>

        <div class="burnup-wrap">
          <div class="burnup-toolbar">
            <div class="burnup-control" *ngIf="!hasPlannedScope">
              <label for="burnupTargetHours">Napi célóra:</label>
              <input
                id="burnupTargetHours"
                type="number"
                min="1"
                max="16"
                step="0.5"
                [value]="burnupTargetHoursPerWorkday"
                (input)="onBurnupTargetInput($event)">
            </div>
            <div class="muted" *ngIf="hasPlannedScope">
              Terv forrás: {{ burnupPlanSourceLabel }} ({{ plannedScopeHours }} óra)
            </div>
            <span class="pill">{{ burnupStatusLabel }}</span>
          </div>

          <svg class="burnup-svg" viewBox="0 0 760 250" preserveAspectRatio="none" aria-label="Burnup terv vs tény grafikon">
            <line class="burnup-grid" x1="42" y1="24" x2="42" y2="220"></line>
            <line class="burnup-grid" x1="42" y1="220" x2="740" y2="220"></line>
            <line class="burnup-grid" x1="42" y1="171" x2="740" y2="171"></line>
            <line class="burnup-grid" x1="42" y1="122" x2="740" y2="122"></line>
            <line class="burnup-grid" x1="42" y1="73" x2="740" y2="73"></line>

            <polyline class="burnup-plan" [attr.points]="burnupPlanPoints"></polyline>
            <polyline class="burnup-actual" [attr.points]="burnupActualPoints"></polyline>

            <circle
              class="burnup-dot"
              *ngFor="let point of burnupActualPointList"
              [attr.cx]="point.x"
              [attr.cy]="point.y"
              r="2.6"></circle>
          </svg>

          <div class="burnup-meta">
            <span>Időszak: {{ burnupSeries[0].label }} - {{ burnupSeries[burnupSeries.length - 1].label }}</span>
            <span>Tény összesen: {{ formatMinutes(lastBurnupActualMinutes) }}</span>
            <span>Terv összesen: {{ formatMinutes(lastBurnupPlanMinutes) }}</span>
            <span>Eltérés: {{ formatSignedMinutes(burnupDeltaMinutes) }}</span>
          </div>

          <div class="tip" *ngIf="hasPlannedScope">A tervvonal lineárisan osztja el a megadott tervórát az időszakra.</div>
          <div class="tip" *ngIf="!hasPlannedScope">Nincs tervóra megadva, ezért fallbackként napi célóra alapján számol a rendszer.</div>
        </div>
      </section>

      <section class="card" *ngIf="taskPlanRows.length">
        <h3 class="chart-title">Feladat terv vs tény</h3>
        <p class="chart-subtitle">Feladatonként mutatja, hol tartasz a becsült órához képest.</p>

        <div class="alerts" *ngIf="overrunAlerts.length">
          <div class="alert-item" *ngFor="let alert of overrunAlerts">
            <div class="alert-title">{{ alert.taskName }} – túllépés veszély</div>
            <div>
              Terv: {{ formatHours(alert.plannedMinutes) }} | Tény: {{ formatHours(alert.actualMinutes) }} | Teljesítés: {{ alert.progressPercent }}%
            </div>
          </div>
        </div>

        <table style="margin-top:10px;">
          <thead>
            <tr>
              <th>Feladat</th>
              <th>Terv</th>
              <th>Tény</th>
              <th>Eltérés</th>
              <th>Státusz</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of taskPlanRows">
              <td>{{ item.taskName }}</td>
              <td>{{ item.plannedMinutes ? formatHours(item.plannedMinutes) : 'nincs' }}</td>
              <td>{{ formatHours(item.actualMinutes) }}</td>
              <td>{{ item.plannedMinutes ? formatSignedMinutes(item.deltaMinutes) : '-' }}</td>
              <td>
                <span class="status-chip" [ngClass]="item.statusClass">{{ item.statusLabel }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="tip" *ngIf="!hasPlannedTaskRows">
          Ennél a szűrésnél nincs rögzített feladat-tervóra. HR oldalon a projekten belüli feladatoknál add meg a tervezett órát.
        </div>
      </section>

      <section class="card" *ngIf="heatmapRows.length && heatmapMaxMinutes > 0">
        <h3 class="chart-title">Munkaidő heatmap (hét napja x órasáv)</h3>
        <p class="chart-subtitle">Megmutatja, melyik nap melyik órájában ment a legtöbb rögzítés a szűrt adatokból.</p>

        <div class="heatmap-wrap">
          <div class="heatmap-scroll">
            <div class="heatmap">
              <div class="heat-head"></div>
              <div class="heat-head" *ngFor="let hour of heatmapHours">{{ hour }}</div>

              <ng-container *ngFor="let row of heatmapRows">
                <div class="heat-day">{{ row.dayLabel }}</div>
                <div
                  class="heat-cell"
                  *ngFor="let cell of row.cells"
                  [style.background]="cell.color"
                  [title]="cell.title"></div>
              </ng-container>
            </div>
          </div>

          <div class="heat-legend">
            <span class="muted">Gyenge aktivitás</span>
            <div class="heat-scale"></div>
            <span class="muted">Erős aktivitás</span>
          </div>

          <div class="tip">
            Összes szétosztott idő: {{ formatMinutes(heatmapTotalMinutes) }} | Erősségi referencia: {{ formatMinutes(heatmapMaxMinutes) }}/óra
          </div>
        </div>
      </section>

      <div class="card" *ngIf="!hasAnyChartData && !busy">
        <h3 class="chart-title">Vizualizációk</h3>
        <p class="muted">Tölts be egy riportot a fenti szűrőkkel, és itt azonnal megjelennek a grafikonok.</p>
      </div>

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
export class ReportsPage implements OnDestroy, OnInit {
  private api = inject(ReportsApiService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private auth = inject(AuthStateService);
  private busyTimer: ReturnType<typeof setTimeout> | null = null;

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'HR Irányítópult';
    return 'Admin Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('HR')) return 'Projekt- és időriportok elemzése HR nézetből, gyors döntéstámogatáshoz.';
    return 'Projekt- és időriportok elemzése admin nézetből, auditálható adatokkal.';
  }

  filters: ProjectReportFilters = {
    fromLocal: '',
    toLocal: '',
    projectName: '',
    taskName: '',
    userId: '',
    includeRunning: false,
  };

  busy = false;
  error = '';
  rows: TimeEntryReportRow[] = [];
  summary: TimeEntrySummaryRow[] = [];

  projects: ReportProjectLookup[] = [];
  availableTasks: ReportTaskLookup[] = [];
  burnupTargetHoursPerWorkday = 8;
  private readonly chartPalette = ['#0a7e66', '#2fb36c', '#6acb93', '#95d5b2', '#1f9d72', '#34a853', '#4cbf99'];

  get hasAnyChartData(): boolean {
    return this.pieSlices.length > 0 || this.dailyTrend.length > 0 || this.heatmapMaxMinutes > 0 || this.burnupSeries.length > 0 || this.taskPlanRows.length > 0;
  }

  get pieSlices(): Array<{ label: string; minutes: number; percent: number; color: string }> {
    const totals = new Map<string, number>();

    if (this.summary.length) {
      for (const row of this.summary) {
        const key = row.userEmail || row.userId;
        totals.set(key, (totals.get(key) ?? 0) + row.totalMinutes);
      }
    } else {
      for (const row of this.rows) {
        if (typeof row.durationMinutes !== 'number' || row.durationMinutes <= 0) continue;
        const key = row.userEmail || row.userId;
        totals.set(key, (totals.get(key) ?? 0) + row.durationMinutes);
      }
    }

    const entries = [...totals.entries()]
      .filter(([, minutes]) => minutes > 0)
      .sort((a, b) => b[1] - a[1]);

    const grandTotal = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
    if (!grandTotal) return [];

    return entries.map(([label, minutes], index) => ({
      label,
      minutes,
      percent: Math.round((minutes / grandTotal) * 100),
      color: this.chartPalette[index % this.chartPalette.length],
    }));
  }

  get totalPieMinutes(): number {
    return this.pieSlices.reduce((sum, item) => sum + item.minutes, 0);
  }

  get pieBackground(): string {
    if (!this.pieSlices.length) return '#f3f5f9';

    let start = 0;
    const segments = this.pieSlices.map(slice => {
      const sweep = (slice.minutes / this.totalPieMinutes) * 360;
      const end = start + sweep;
      const segment = `${slice.color} ${start}deg ${end}deg`;
      start = end;
      return segment;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }

  get burnupSeries(): Array<{ key: string; label: string; actualCumulativeMinutes: number; plannedCumulativeMinutes: number }> {
    if (!this.rows.length) return [];

    const byDay = new Map<string, number>();
    for (const row of this.rows) {
      if (typeof row.durationMinutes !== 'number' || row.durationMinutes <= 0) continue;
      const start = new Date(row.startUtc);
      if (Number.isNaN(start.getTime())) continue;
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      byDay.set(key, (byDay.get(key) ?? 0) + row.durationMinutes);
    }

    const range = this.resolveBurnupRange();
    if (!range) return [];

    const dayMinutes = Math.max(60, Math.round(this.burnupTargetHoursPerWorkday * 60));
    const scopeMinutes = this.plannedScopeMinutes;
    const hasScope = scopeMinutes > 0;
    const totalDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1);
    const series: Array<{ key: string; label: string; actualCumulativeMinutes: number; plannedCumulativeMinutes: number }> = [];
    let actual = 0;
    let planned = 0;
    let dayIndex = 0;

    const cursor = new Date(range.start);
    while (cursor.getTime() <= range.end.getTime()) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const minutes = byDay.get(key) ?? 0;
      actual += minutes;

      if (hasScope) {
        const ratio = totalDays === 1 ? 1 : dayIndex / (totalDays - 1);
        planned = Math.round(scopeMinutes * ratio);
      } else {
        const day = cursor.getDay();
        const isWorkday = day >= 1 && day <= 5;
        if (isWorkday) planned += dayMinutes;
      }

      series.push({
        key,
        label: cursor.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
        actualCumulativeMinutes: Math.round(actual),
        plannedCumulativeMinutes: Math.round(planned),
      });

      cursor.setDate(cursor.getDate() + 1);
      dayIndex += 1;
    }

    return series;
  }

  get hasPlannedScope(): boolean {
    return this.plannedScopeHours > 0;
  }

  get plannedScopeHours(): number {
    const task = this.findTaskByName(this.filters.taskName);
    if (task && typeof task.plannedHours === 'number' && task.plannedHours > 0) {
      return task.plannedHours;
    }

    const project = this.findProjectByName(this.filters.projectName);
    if (!project) return 0;

    const taskHours = this.availableTasks
      .filter(t => typeof t.plannedHours === 'number' && (t.plannedHours ?? 0) > 0)
      .reduce((sum, t) => sum + (t.plannedHours ?? 0), 0);

    if (taskHours > 0) return taskHours;

    if (typeof project.plannedHours === 'number' && project.plannedHours > 0) {
      return project.plannedHours;
    }

    return 0;
  }

  get plannedScopeMinutes(): number {
    return Math.round(this.plannedScopeHours * 60);
  }

  get burnupPlanSourceLabel(): string {
    const task = this.findTaskByName(this.filters.taskName);
    if (task && typeof task.plannedHours === 'number' && task.plannedHours > 0) {
      return `Feladat terv: ${task.name}`;
    }

    const project = this.findProjectByName(this.filters.projectName);
    if (!project) return 'Nincs kiválasztott projekt';

    const hasTaskHours = this.availableTasks.some(t => typeof t.plannedHours === 'number' && (t.plannedHours ?? 0) > 0);
    if (hasTaskHours) {
      return `Projekt feladat-tervek összege: ${project.name}`;
    }

    return `Projekt terv: ${project.name}`;
  }

  get burnupMaxCumulative(): number {
    return this.burnupSeries.reduce(
      (max, item) => Math.max(max, item.actualCumulativeMinutes, item.plannedCumulativeMinutes),
      0,
    );
  }

  get burnupActualPointList(): Array<{ x: number; y: number }> {
    return this.toBurnupPoints(item => item.actualCumulativeMinutes);
  }

  get burnupPlanPointList(): Array<{ x: number; y: number }> {
    return this.toBurnupPoints(item => item.plannedCumulativeMinutes);
  }

  get burnupActualPoints(): string {
    return this.burnupActualPointList.map(point => `${point.x},${point.y}`).join(' ');
  }

  get burnupPlanPoints(): string {
    return this.burnupPlanPointList.map(point => `${point.x},${point.y}`).join(' ');
  }

  get lastBurnupActualMinutes(): number {
    if (!this.burnupSeries.length) return 0;
    return this.burnupSeries[this.burnupSeries.length - 1].actualCumulativeMinutes;
  }

  get lastBurnupPlanMinutes(): number {
    if (!this.burnupSeries.length) return 0;
    return this.burnupSeries[this.burnupSeries.length - 1].plannedCumulativeMinutes;
  }

  get burnupDeltaMinutes(): number {
    return this.lastBurnupActualMinutes - this.lastBurnupPlanMinutes;
  }

  get burnupStatusLabel(): string {
    if (!this.burnupSeries.length) return 'Nincs adat';
    const delta = this.burnupDeltaMinutes;
    if (Math.abs(delta) < 30) return 'Terv szerint halad';
    return delta > 0 ? `Terv felett: ${this.formatSignedMinutes(delta)}` : `Terv alatt: ${this.formatSignedMinutes(delta)}`;
  }

  get heatmapHours(): number[] {
    return Array.from({ length: 24 }, (_, hour) => hour);
  }

  get heatmapRows(): Array<{ dayLabel: string; cells: Array<{ minutes: number; color: string; title: string }> }> {
    const matrix = this.buildHeatmapMatrix();
    const dayLabels = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
    const max = this.heatmapMaxMinutes;

    return dayLabels.map((dayLabel, dayIndex) => ({
      dayLabel,
      cells: matrix[dayIndex].map((minutes, hour) => {
        const intensity = max > 0 ? minutes / max : 0;
        const lightness = 97 - Math.round(intensity * 52);
        const color = minutes <= 0 ? '#f4f6fa' : `hsl(150 56% ${lightness}%)`;
        return {
          minutes,
          color,
          title: `${dayLabel}, ${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59 | ${this.formatMinutes(Math.round(minutes))}`,
        };
      }),
    }));
  }

  get heatmapMaxMinutes(): number {
    const matrix = this.buildHeatmapMatrix();
    let max = 0;
    for (const day of matrix) {
      for (const minutes of day) {
        if (minutes > max) max = minutes;
      }
    }
    return max;
  }

  get heatmapTotalMinutes(): number {
    const matrix = this.buildHeatmapMatrix();
    let total = 0;
    for (const day of matrix) {
      for (const minutes of day) {
        total += minutes;
      }
    }
    return Math.round(total);
  }

  get taskPlanRows(): Array<{
    taskName: string;
    plannedMinutes: number | null;
    actualMinutes: number;
    deltaMinutes: number;
    statusLabel: string;
    statusClass: string;
    progressPercent: number | null;
  }> {
    const actualByTask = new Map<string, number>();

    if (this.summary.length) {
      for (const row of this.summary) {
        const taskName = row.taskName?.trim() || 'Feladat nélkül';
        actualByTask.set(taskName, (actualByTask.get(taskName) ?? 0) + row.totalMinutes);
      }
    } else {
      for (const row of this.rows) {
        if (typeof row.durationMinutes !== 'number' || row.durationMinutes <= 0) continue;
        const taskName = row.taskName?.trim() || 'Feladat nélkül';
        actualByTask.set(taskName, (actualByTask.get(taskName) ?? 0) + row.durationMinutes);
      }
    }

    const plannedByTask = new Map<string, number>();
    for (const task of this.availableTasks) {
      const plannedHours = typeof task.plannedHours === 'number' ? task.plannedHours : null;
      if (!plannedHours || plannedHours <= 0) continue;
      plannedByTask.set(task.name.trim().toLocaleLowerCase('hu-HU'), Math.round(plannedHours * 60));
    }

    const rows = [...actualByTask.entries()]
      .map(([taskName, actualMinutes]) => {
        const plannedMinutes = plannedByTask.get(taskName.trim().toLocaleLowerCase('hu-HU')) ?? null;
        const deltaMinutes = plannedMinutes === null ? 0 : Math.round(actualMinutes - plannedMinutes);
        const progressPercent = plannedMinutes && plannedMinutes > 0
          ? Math.round((actualMinutes / plannedMinutes) * 100)
          : null;

        let statusLabel = 'Nincs terv';
        let statusClass = 'status-none';

        if (plannedMinutes !== null) {
          if (actualMinutes > plannedMinutes) {
            statusLabel = 'Túllépve';
            statusClass = 'status-over';
          } else if (actualMinutes >= plannedMinutes * 0.8) {
            statusLabel = 'Közel a tervhez';
            statusClass = 'status-warn';
          } else {
            statusLabel = 'Rendben';
            statusClass = 'status-good';
          }
        }

        return {
          taskName,
          plannedMinutes,
          actualMinutes: Math.round(actualMinutes),
          deltaMinutes,
          statusLabel,
          statusClass,
          progressPercent,
        };
      })
      .sort((a, b) => b.actualMinutes - a.actualMinutes);

    return rows;
  }

  get hasPlannedTaskRows(): boolean {
    return this.taskPlanRows.some(row => row.plannedMinutes !== null);
  }

  get overrunAlerts(): Array<{ taskName: string; plannedMinutes: number; actualMinutes: number; progressPercent: number }> {
    return this.taskPlanRows
      .filter(row => row.plannedMinutes !== null && row.progressPercent !== null && row.progressPercent >= 80)
      .sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0))
      .slice(0, 4)
      .map(row => ({
        taskName: row.taskName,
        plannedMinutes: row.plannedMinutes!,
        actualMinutes: row.actualMinutes,
        progressPercent: row.progressPercent!,
      }));
  }

  get dailyTrend(): Array<{ key: string; label: string; minutes: number }> {
    if (!this.rows.length) return [];

    const grouped = new Map<string, number>();
    for (const row of this.rows) {
      if (typeof row.durationMinutes !== 'number' || row.durationMinutes <= 0) continue;

      const date = new Date(row.startUtc);
      if (Number.isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      grouped.set(key, (grouped.get(key) ?? 0) + row.durationMinutes);
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, minutes]) => {
        const parsed = new Date(`${key}T00:00:00`);
        return {
          key,
          minutes,
          label: Number.isNaN(parsed.getTime()) ? key : parsed.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
        };
      });
  }

  get maxDailyMinutes(): number {
    return this.dailyTrend.reduce((max, item) => Math.max(max, item.minutes), 0);
  }

  get trendPoints(): Array<{ x: number; y: number }> {
    const points = this.dailyTrend;
    if (!points.length) return [];

    const left = 42;
    const right = 740;
    const top = 24;
    const bottom = 210;
    const width = right - left;
    const height = bottom - top;
    const maxMinutes = Math.max(1, this.maxDailyMinutes);
    const scaledMax = maxMinutes * 1.12;

    if (points.length === 1) {
      const y = bottom - (points[0].minutes / scaledMax) * height;
      return [
        { x: left + width * 0.12, y },
        { x: right - width * 0.12, y },
      ];
    }

    return points.map((item, index) => {
      const x = left + (index / (points.length - 1)) * width;
      const y = bottom - (item.minutes / scaledMax) * height;
      return { x, y };
    });
  }

  get trendPolylinePoints(): string {
    return this.trendPoints.map(point => `${point.x},${point.y}`).join(' ');
  }

  get trendAreaPoints(): string {
    const points = this.trendPoints;
    if (!points.length) return '';

    const first = points[0];
    const last = points[points.length - 1];
    return `${first.x},210 ${points.map(point => `${point.x},${point.y}`).join(' ')} ${last.x},210`;
  }

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

  async reloadLookups(): Promise<void> {
    this.startBusy();
    this.error = '';

    try {
      this.projects = await firstValueFrom(this.api.getProjects().pipe(timeout(10000)));
      await this.reloadTaskSuggestions();
    } catch (e: any) {
      this.error = e?.error?.error ?? e?.message ?? 'A projekt/feladat listák betöltése sikertelen.';
    } finally {
      this.stopBusy();
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
      anchor.download = 'timetracker-project-report.csv';
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
      anchor.download = 'timetracker-project-report.xlsx';
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

  formatMinutes(minutes: number): string {
    if (!minutes) return '0 ó 0 p';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs} ó ${mins} p`;
  }

  formatSignedMinutes(minutes: number): string {
    const sign = minutes >= 0 ? '+' : '-';
    return `${sign}${this.formatMinutes(Math.abs(minutes))}`;
  }

  formatHours(minutes: number): string {
    if (!minutes) return '0.00 ó';
    return `${(minutes / 60).toFixed(2)} ó`;
  }

  onBurnupTargetInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    this.burnupTargetHoursPerWorkday = Math.min(16, Math.max(1, value));
  }

  onViewSwitch(view: 'project' | 'employee'): void {
    if (view === 'employee') {
      void this.router.navigateByUrl('/reports/employees');
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
      userId: this.filters.userId.trim() || undefined,
      includeRunning: this.filters.includeRunning,
    };
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

  private toBurnupPoints(selector: (item: { actualCumulativeMinutes: number; plannedCumulativeMinutes: number }) => number): Array<{ x: number; y: number }> {
    const points = this.burnupSeries;
    if (!points.length) return [];

    const left = 42;
    const right = 740;
    const top = 24;
    const bottom = 220;
    const width = right - left;
    const height = bottom - top;
    const max = Math.max(1, this.burnupMaxCumulative * 1.08);

    if (points.length === 1) {
      const y = bottom - (selector(points[0]) / max) * height;
      return [
        { x: left + width * 0.12, y },
        { x: right - width * 0.12, y },
      ];
    }

    return points.map((item, index) => ({
      x: left + (index / (points.length - 1)) * width,
      y: bottom - (selector(item) / max) * height,
    }));
  }

  private resolveBurnupRange(): { start: Date; end: Date } | null {
    const fromParsed = this.parseLocalDateInput(this.filters.fromLocal);
    const toParsed = this.parseLocalDateInput(this.filters.toLocal);

    if (fromParsed && toParsed) {
      const start = new Date(fromParsed.getFullYear(), fromParsed.getMonth(), fromParsed.getDate(), 0, 0, 0, 0);
      const endRaw = new Date(toParsed.getFullYear(), toParsed.getMonth(), toParsed.getDate(), 0, 0, 0, 0);
      const end = endRaw.getTime() >= start.getTime()
        ? endRaw
        : new Date(start);
      return { start, end };
    }

    const daily = this.dailyTrend;
    if (!daily.length) return null;

    const start = new Date(`${daily[0].key}T00:00:00`);
    const end = new Date(`${daily[daily.length - 1].key}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  private parseLocalDateInput(value: string): Date | null {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private buildHeatmapMatrix(): number[][] {
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    if (!this.rows.length) return matrix;

    for (const row of this.rows) {
      const start = new Date(row.startUtc);
      if (Number.isNaN(start.getTime())) continue;

      let end: Date | null = null;
      if (row.endUtc) {
        const parsedEnd = new Date(row.endUtc);
        if (!Number.isNaN(parsedEnd.getTime())) {
          end = parsedEnd;
        }
      }

      if (!end && typeof row.durationMinutes === 'number' && row.durationMinutes > 0) {
        end = new Date(start.getTime() + row.durationMinutes * 60_000);
      }

      if (!end || end.getTime() <= start.getTime()) continue;

      let cursor = new Date(start);
      while (cursor.getTime() < end.getTime()) {
        const bucketStart = new Date(cursor);
        bucketStart.setMinutes(0, 0, 0);

        const bucketEnd = new Date(bucketStart);
        bucketEnd.setHours(bucketStart.getHours() + 1);

        const segmentEnd = end.getTime() < bucketEnd.getTime() ? end : bucketEnd;
        const minutes = (segmentEnd.getTime() - cursor.getTime()) / 60_000;

        const dayIndex = (bucketStart.getDay() + 6) % 7;
        const hour = bucketStart.getHours();
        matrix[dayIndex][hour] += minutes;

        cursor = new Date(segmentEnd);
      }
    }

    return matrix;
  }
}
