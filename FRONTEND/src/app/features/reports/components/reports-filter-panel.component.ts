import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrUserLookup, ReportProjectLookup, ReportTaskLookup } from '../data/reports-api.service';

export type ProjectReportFilters = {
  fromLocal: string;
  toLocal: string;
  projectName: string;
  taskName: string;
  userId: string;
  includeRunning: boolean;
};

export type EmployeeReportFilters = {
  employeeText: string;
  fromLocal: string;
  toLocal: string;
  projectName: string;
  taskName: string;
};

@Component({
  selector: 'tt-reports-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .card {
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:16px;
        background:#ffffff;
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
      }
      .top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .muted { opacity:.75; }
      .quick-top { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .tabs { display:flex; gap:8px; flex-wrap:wrap; }
      .tab {
        padding:8px 13px;
        border:1px solid #ccd4f1;
        border-radius:999px;
        background:linear-gradient(180deg, #ffffff, #f8f9ff);
        color:#2a245c;
        cursor:pointer;
        font-weight:700;
      }
      .tab.active {
        border-color: rgba(143, 124, 245, 0.68);
        background: linear-gradient(135deg, #8f75ff, #654dd6);
        color:#fff;
      }
      .row { display:flex; gap:10px; align-items:end; flex-wrap:wrap; }
      .field { display:grid; gap:6px; min-width:220px; }
      input { padding:8px 10px; border:1px solid #bcc6eb; border-radius:12px; }
      .btn {
        min-height:34px;
        min-width:112px;
        padding:5px 9px;
        border:1px solid rgba(143, 124, 245, 0.68);
        border-radius:10px;
        background:linear-gradient(135deg, #8f75ff, #654dd6);
        color:#fff;
        cursor:pointer;
        font-weight:700;
        font-size:.88rem;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        white-space:nowrap;
      }
      .btn:disabled { opacity:.6; cursor:not-allowed; }
      .after-filters {
        margin-top:10px;
        display:grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap:10px;
        align-items:start;
      }
      .quick-top .btn.small {
        min-height:30px;
        min-width:96px;
        padding:4px 8px;
        font-size:.82rem;
        border-radius:9px;
      }
      .run-stack {
        border:1px solid #d3daf2;
        border-radius:14px;
        padding:10px;
        background:#ffffff;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .run-stack .btn.small {
        min-height:30px;
        min-width:118px;
        padding:4px 8px;
        font-size:.82rem;
        border-radius:9px;
      }
      .export-stack {
        border:1px solid #d3daf2;
        border-radius:14px;
        padding:10px;
        background:#ffffff;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .export-stack .btn.small {
        min-height:30px;
        min-width:118px;
        padding:4px 8px;
        font-size:.82rem;
        border-radius:9px;
      }
      @media (max-width: 1080px) {
        .after-filters {
          grid-template-columns: 1fr;
        }
      }
      .error { color:#b00020; }
    `,
  ],
  template: `
    <div class="card">
      <div class="top">
        <div class="quick-top">
          <button type="button" class="btn small" (click)="presetWeek.emit()">Aktuális hét</button>
          <button type="button" class="btn small" (click)="presetMonth.emit()">Aktuális hónap</button>
          <button type="button" class="btn small" (click)="presetPrevMonth.emit()">Előző hónap</button>
        </div>

        <div class="tabs">
          <button type="button" class="tab" [class.active]="mode === 'project'" (click)="viewSwitch.emit('project')">Projekt nézet</button>
          <button type="button" class="tab" [class.active]="mode === 'employee'" (click)="viewSwitch.emit('employee')">Dolgozó nézet</button>
        </div>
      </div>

      <div class="row" style="margin-top:12px;">
        <label class="field" *ngIf="mode === 'employee'" style="min-width:280px;">
          <span>Dolgozó</span>
          <input
            [attr.list]="employeeListId"
            [(ngModel)]="employeeFilters.employeeText"
            placeholder="E-mail / név / user id" />
          <datalist [id]="employeeListId">
            <option *ngFor="let u of users" [value]="userLabel(u)"></option>
          </datalist>
        </label>

        <label class="field">
          <span>Kezdő dátum/idő</span>
          <input type="datetime-local" [(ngModel)]="currentFromLocal" />
        </label>

        <label class="field">
          <span>Záró dátum/idő</span>
          <input type="datetime-local" [(ngModel)]="currentToLocal" />
        </label>

        <label class="field">
          <span>Projekt neve{{ mode === 'employee' ? ' (opcionális)' : '' }}</span>
          <input
            [attr.list]="projectListId"
            [(ngModel)]="currentProjectName"
            (ngModelChange)="projectNameChanged.emit()"
            placeholder="Kezdj el gépelni..." />
          <datalist [id]="projectListId">
            <option *ngFor="let p of projects" [value]="p.name"></option>
          </datalist>
        </label>

        <label class="field">
          <span>Feladat neve{{ mode === 'employee' ? ' (opcionális)' : '' }}</span>
          <input
            [attr.list]="taskListId"
            [(ngModel)]="currentTaskName"
            placeholder="Kezdj el gépelni..." />
          <datalist [id]="taskListId">
            <option *ngFor="let t of tasks" [value]="t.name"></option>
          </datalist>
        </label>

        <label class="field" *ngIf="mode === 'project'" style="min-width:220px;">
          <span>Felhasználó ID (opcionális)</span>
          <input [(ngModel)]="projectFilters.userId" placeholder="ASP.NET user id" />
        </label>

        <label class="field" *ngIf="mode === 'project'" style="min-width:140px;">
          <span>Futó elemek</span>
          <input type="checkbox" [(ngModel)]="projectFilters.includeRunning" style="width:18px; height:18px;" />
        </label>
      </div>

      <div class="after-filters">
        <div class="run-stack">
          <button type="button" class="btn small" (click)="loadRows.emit()" [disabled]="busy">Részletes lista</button>
          <button type="button" class="btn small" (click)="loadSummary.emit()" [disabled]="busy">Összesítés</button>
          <button type="button" class="btn small" (click)="refreshLookups.emit()" [disabled]="busy">Listák frissítése</button>
        </div>

        <div class="export-stack">
          <button type="button" class="btn small" (click)="exportCsv.emit()" [disabled]="busy">CSV export</button>
          <button type="button" class="btn small" (click)="exportXlsx.emit()" [disabled]="busy">XLSX export</button>
        </div>
      </div>

      <div class="muted" style="margin-top:8px;" *ngIf="busy">Betöltés...</div>
      <div class="error" style="margin-top:8px;" *ngIf="error">{{ error }}</div>
    </div>
  `,
})
export class ReportsFilterPanelComponent {
  @Input({ required: true }) mode: 'project' | 'employee' = 'project';
  @Input({ required: true }) filters!: ProjectReportFilters | EmployeeReportFilters;
  @Input() projects: ReportProjectLookup[] = [];
  @Input() tasks: ReportTaskLookup[] = [];
  @Input() users: HrUserLookup[] = [];
  @Input() busy = false;
  @Input() error = '';

  @Output() viewSwitch = new EventEmitter<'project' | 'employee'>();
  @Output() projectNameChanged = new EventEmitter<void>();
  @Output() refreshLookups = new EventEmitter<void>();
  @Output() presetWeek = new EventEmitter<void>();
  @Output() presetMonth = new EventEmitter<void>();
  @Output() presetPrevMonth = new EventEmitter<void>();
  @Output() loadRows = new EventEmitter<void>();
  @Output() loadSummary = new EventEmitter<void>();
  @Output() exportCsv = new EventEmitter<void>();
  @Output() exportXlsx = new EventEmitter<void>();

  get projectFilters(): ProjectReportFilters {
    return this.filters as ProjectReportFilters;
  }

  get employeeFilters(): EmployeeReportFilters {
    return this.filters as EmployeeReportFilters;
  }

  get currentFromLocal(): string {
    return this.mode === 'project' ? this.projectFilters.fromLocal : this.employeeFilters.fromLocal;
  }

  set currentFromLocal(value: string) {
    if (this.mode === 'project') this.projectFilters.fromLocal = value;
    else this.employeeFilters.fromLocal = value;
  }

  get currentToLocal(): string {
    return this.mode === 'project' ? this.projectFilters.toLocal : this.employeeFilters.toLocal;
  }

  set currentToLocal(value: string) {
    if (this.mode === 'project') this.projectFilters.toLocal = value;
    else this.employeeFilters.toLocal = value;
  }

  get currentProjectName(): string {
    return this.mode === 'project' ? this.projectFilters.projectName : this.employeeFilters.projectName;
  }

  set currentProjectName(value: string) {
    if (this.mode === 'project') this.projectFilters.projectName = value;
    else this.employeeFilters.projectName = value;
  }

  get currentTaskName(): string {
    return this.mode === 'project' ? this.projectFilters.taskName : this.employeeFilters.taskName;
  }

  set currentTaskName(value: string) {
    if (this.mode === 'project') this.projectFilters.taskName = value;
    else this.employeeFilters.taskName = value;
  }

  get projectListId(): string {
    return this.mode === 'project' ? 'reportProjectOptions' : 'employeeProjectOptions';
  }

  get taskListId(): string {
    return this.mode === 'project' ? 'reportTaskOptions' : 'employeeTaskOptions';
  }

  get employeeListId(): string {
    return 'employeeOptions';
  }

  userLabel(user: HrUserLookup): string {
    return user.email ?? user.userName ?? user.userId;
  }
}
