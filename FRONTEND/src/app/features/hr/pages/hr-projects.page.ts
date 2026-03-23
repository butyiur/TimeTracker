import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;

type HrProjectListItemDto = {
  id: number;
  name: string;
  isActive?: boolean;
  plannedHours: number | null;
  createdByUserId: string;
};

type HrProjectTaskDto = {
  id: number;
  projectId: number;
  name: string;
  isActive: boolean;
  plannedHours: number | null;
  createdAtUtc: string;
};

type HrUserListItemDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  roles: string[];
};

type HrProjectAssigneeDto = {
  id: string;
  email: string | null;
  assignedAtUtc: string;
};

type PagedResponse<T> = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [
    `
      .wrap { display:grid; gap:14px; max-width:1180px; width:100%; min-width:0; }
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
        border:1px solid #c4cdec;
        border-radius:18px;
        padding:14px;
        background:linear-gradient(180deg, #ffffff, #f4f7ff);
        box-shadow:0 12px 28px rgba(30, 21, 84, 0.14);
        min-width:0;
        overflow:hidden;
      }

      .workspace-grid {
        display:grid;
        grid-template-columns: minmax(300px, 0.95fr) minmax(0, 1.05fr);
        gap:14px;
        align-items:stretch;
      }
      .workspace-grid > * { min-width:0; }
      .workspace-column {
        display:grid;
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
        gap:14px;
        min-height:760px;
        min-width:0;
      }

      .section-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:2px 6px 4px 2px;
      }
      .section-head h3 {
        margin:0;
        color:#1f1a56;
      }
      .projects-rail .section-head {
        padding-right:10px;
      }
      .btn-refresh {
        min-height:38px;
        padding:7px 12px;
        margin-top:-2px;
      }
      .btn-compact {
        min-height:30px;
        padding:5px 9px;
        border-radius:10px;
        font-size:.88rem;
        line-height:1.1;
        white-space:nowrap;
        min-width:108px;
      }

      .block {
        border:1px solid var(--tt-border);
        border-radius:14px;
        padding:11px;
        background:var(--tt-surface-soft);
      }
      .block + .block { margin-top:10px; }
      .block-title {
        margin:0 0 8px;
        color:var(--tt-heading);
        font-size:1rem;
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
      .btn-success {
        border-color: rgba(31, 138, 82, 0.72);
        background: linear-gradient(135deg, #2fb36c, #1f8a52);
      }
      .btn-danger {
        border-color:#dba5a5;
        background:linear-gradient(135deg, #f06d8b, #d33d66);
      }

      .field { display:grid; gap:6px; min-width:0; }
      .field span {
        color:var(--tt-label);
        font-size:.92rem;
        font-weight:600;
      }

      input, select {
        width:100%;
        box-sizing:border-box;
        padding:8px 10px;
        border:1px solid var(--tt-border);
        border-radius:12px;
        background:var(--tt-input-bg);
        color:var(--tt-text);
      }

      .projects-rail {
        position:sticky;
        top:12px;
        min-height:760px;
      }
      .project-list { display:grid; gap:8px; margin-top:10px; }
      .project-item {
        width:100%;
        text-align:left;
        padding:11px;
        border:1px solid var(--tt-border);
        border-radius:14px;
        background:linear-gradient(180deg, var(--tt-surface), var(--tt-surface-soft));
        cursor:pointer;
        box-shadow:0 8px 18px rgba(46, 33, 125, 0.08);
      }
      .project-item.active {
        border-color: rgba(156, 143, 242, 0.72);
        background: linear-gradient(135deg, rgba(154, 140, 255, 0.28), rgba(116, 105, 221, 0.24));
        font-weight:700;
      }
      .project-item.enabled {
        border-color: color-mix(in srgb, var(--tt-ok-border) 78%, var(--tt-border));
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--tt-ok-soft) 38%, var(--tt-surface)),
          color-mix(in srgb, var(--tt-ok-soft) 18%, var(--tt-surface-soft))
        );
      }
      .project-item.inactive {
        border-color: color-mix(in srgb, var(--tt-error-border) 72%, var(--tt-border));
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--tt-error-soft) 35%, var(--tt-surface)),
          color-mix(in srgb, var(--tt-error-soft) 18%, var(--tt-surface-soft))
        );
      }
      .project-meta { margin-top:4px; font-size:.84rem; color:var(--tt-muted); }
      .state-active { color:#177f46; font-weight:700; }
      .state-inactive { color:var(--tt-error); font-weight:700; }

      .list-shell {
        margin-top:10px;
        max-height:400px;
        overflow:auto;
        padding-right:2px;
      }

      .project-plan-row {
        display:grid;
        grid-template-columns: minmax(140px, 1fr) auto;
        gap:8px;
        align-items:end;
        min-width:0;
      }

      .hours-input { max-width:120px; }

      .task-form {
        display:grid;
        grid-template-columns: minmax(0, 1fr) minmax(120px, 190px) minmax(120px, 160px);
        gap:10px;
        align-items:end;
        min-width:0;
      }
      .task-form .btn { width:100%; }

      .table-shell {
        margin-top:10px;
        overflow-x:auto;
        overflow-y:auto;
        border-top:1px solid var(--tt-table-border);
      }
      table { width:100%; border-collapse:collapse; min-width:0; table-layout:fixed; }
      th, td {
        text-align:left;
        border-bottom:1px solid var(--tt-table-border);
        padding:8px;
        vertical-align:top;
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      th { color:var(--tt-table-head); font-size:.9rem; }
      .table-shell td .row {
        flex-wrap: wrap !important;
      }

      .muted { opacity:1; color:var(--tt-muted); }
      .ok { color:var(--tt-ok); }
      .error { color:var(--tt-error); }

      .status-badge {
        display:inline-flex;
        align-items:center;
        padding:4px 10px;
        border-radius:999px;
        border:1px solid var(--tt-border);
        background:var(--tt-surface-soft);
        color:var(--tt-text);
        font-size:.83rem;
      }

      .assign-controls {
        display: grid;
        gap: 10px;
        align-items: end;
        grid-template-columns: minmax(0, 1fr) minmax(170px, 260px) minmax(120px, 160px);
      }
      .assign-controls .field {
        min-width: 0;
      }
      .assign-controls input,
      .assign-controls select {
        width: 100%;
        box-sizing: border-box;
      }
      .assign-controls .btn {
        white-space: nowrap;
        min-width: 0;
        width: 100%;
      }

      .pager {
        margin-top:10px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:8px 10px;
        border:1px solid var(--tt-border);
        border-radius:12px;
        background:var(--tt-surface-soft);
      }
      .pager-meta {
        color:var(--tt-muted);
        font-size:.86rem;
      }
      .pager-actions {
        display:flex;
        gap:6px;
      }
      .btn-pager {
        min-height:32px;
        padding:6px 10px;
        border-radius:10px;
        font-size:.85rem;
      }

      @media (max-width: 1400px) {
        .btn {
          min-height:36px;
          padding:6px 10px;
          font-size:.86rem;
        }
        .btn-refresh {
          min-height:34px;
          padding:6px 10px;
          font-size:.84rem;
        }
        .task-form {
          grid-template-columns: minmax(0, 1fr) minmax(110px, 160px) minmax(110px, 140px);
        }
        .assign-controls {
          grid-template-columns: minmax(0, 1fr) minmax(140px, 220px) minmax(110px, 140px);
        }
      }

      @media (max-width: 1320px) {
        .workspace-grid {
          grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
        }
        .project-plan-row {
          grid-template-columns: 1fr;
        }
        .project-plan-row .row {
          justify-content:flex-start !important;
        }
        .btn-compact {
          white-space:normal;
          min-width:0;
          width:100%;
        }
      }

      @media (max-width: 1160px) {
        .workspace-grid {
          grid-template-columns: 1fr;
        }
        .projects-rail {
          position:static;
          min-height:0;
        }
        .workspace-column {
          grid-template-rows: auto;
          min-height:0;
        }
        .task-form {
          grid-template-columns: 1fr;
        }
        .assign-controls {
          grid-template-columns: 1fr;
        }
        .assign-controls .btn {
          width: 100%;
          min-width: 0;
        }
        th, td { padding:6px; }
        th:nth-child(4),
        td:nth-child(4) {
          display:none;
        }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <header class="hero">
        <div class="hero-kicker">{{ dashboardKicker }}</div>
        <h1>Projektek és feladatok</h1>
        <div class="hero-sub">{{ dashboardSub }}</div>
      </header>

      <div class="workspace-grid">
        <aside class="card projects-rail">
          <div class="section-head">
            <h3>Projektek</h3>
            <button type="button" class="btn btn-refresh" (click)="loadProjects()" [disabled]="loading || busy">Frissítés</button>
          </div>

          <div class="block">
            <h4 class="block-title">Új projekt létrehozása</h4>
            <label class="field">
              <span>Projekt neve</span>
              <input [(ngModel)]="newProjectName" placeholder="pl. Kanban webapp" />
            </label>
            <button type="button" class="btn btn-success" (click)="createProject()" [disabled]="busy || !newProjectName.trim()" style="margin-top:8px; width:100%;">
              Projekt létrehozása
            </button>
          </div>

          <div class="block" *ngIf="selectedProjectId">
            <h4 class="block-title">Projekt kapacitás-terv</h4>
            <div class="project-meta" style="margin-bottom:8px;">
              Állapot:
              <span [class.state-active]="selectedProjectIsActive" [class.state-inactive]="!selectedProjectIsActive">
                {{ selectedProjectIsActive ? 'Aktív' : 'Inaktív' }}
              </span>
            </div>
            <div class="project-plan-row">
              <label class="field">
                <span>Tervezett óra</span>
                <input class="hours-input" type="number" min="0" step="1" [(ngModel)]="selectedProjectPlannedHours" placeholder="nincs" />
              </label>
              <div class="row" style="justify-content:flex-end;">
                <button type="button" class="btn btn-success btn-compact" (click)="saveSelectedProjectPlannedHours()" [disabled]="busy || !selectedProjectId">
                  Terv mentése
                </button>
                <button
                  type="button"
                  class="btn btn-compact"
                  [class.btn-danger]="selectedProjectIsActive"
                  [class.btn-success]="!selectedProjectIsActive"
                  (click)="toggleSelectedProjectActive()"
                  [disabled]="busy || !selectedProjectId">
                  {{ selectedProjectIsActive ? 'Projekt inaktiválása' : 'Projekt aktiválása' }}
                </button>
              </div>
            </div>

            <div class="project-meta" style="margin-top:10px;">
              Kiválasztott: <b>{{ selectedProjectName }}</b> | Mentett terv: <b>{{ selectedProjectPlannedHoursLabel }}</b>
            </div>
          </div>

          <div class="block" style="margin-top:10px;">
            <h4 class="block-title">Projekt keresése</h4>
            <label class="field">
              <span>Kereső</span>
              <input [(ngModel)]="projectSearch" (ngModelChange)="onProjectSearchChange()" placeholder="Keresés név vagy azonosító alapján" />
            </label>
          </div>

          <div class="muted" style="margin-top:8px;" *ngIf="loading">Betöltés...</div>
          <div class="muted" style="margin-top:8px;" *ngIf="!loading && !error && !projects.length && !projectSearch.trim()">Nincs még projekt.</div>

          <div class="list-shell" *ngIf="projects.length">
            <div class="project-list">
              <button
                *ngFor="let p of projects"
                type="button"
                class="project-item"
                [class.active]="selectedProjectId === p.id"
                [class.enabled]="p.isActive !== false"
                [class.inactive]="p.isActive === false"
                (click)="selectProject(p.id)">
                {{ p.name }}
                <div class="project-meta">
                  Állapot: {{ p.isActive === false ? 'Inaktív' : 'Aktív' }} | Terv: {{ p.plannedHours ? (p.plannedHours + ' óra') : 'nincs' }}
                </div>
              </button>
            </div>
          </div>
          <div class="muted" style="margin-top:8px;" *ngIf="!loading && !error && !projects.length && projectSearch.trim()">Nincs találat a keresésre.</div>

          <div class="pager" *ngIf="projectTotalPages > 1">
            <div class="pager-meta">Projekt oldal: {{ projectPage }} / {{ projectTotalPages }} · Összes: {{ projectTotalItems }}</div>
            <div class="pager-actions">
              <button type="button" class="btn btn-pager" (click)="goToProjectPage(projectPage - 1)" [disabled]="loading || projectPage <= 1">Előző</button>
              <button type="button" class="btn btn-pager" (click)="goToProjectPage(projectPage + 1)" [disabled]="loading || projectPage >= projectTotalPages">Következő</button>
            </div>
          </div>
        </aside>

        <section class="workspace-column">
          <div class="card">
            <div class="section-head">
              <h3>Feladatok</h3>
              <button type="button" class="btn btn-refresh" (click)="loadTasks()" [disabled]="busy || !selectedProjectId">Frissítés</button>
            </div>

            <div class="muted" style="margin-top:8px;" *ngIf="!selectedProjectId">Válassz projektet a bal oldali listából.</div>
            <div style="margin-top:10px;" *ngIf="selectedProjectId">
              <span class="status-badge">Projekt: {{ selectedProjectName }}</span>
            </div>

            <div class="block" style="margin-top:10px;" *ngIf="selectedProjectId">
              <h4 class="block-title">Új feladat hozzáadása</h4>
              <div class="task-form">
                <label class="field">
                  <span>Feladat neve</span>
                  <input [(ngModel)]="newTaskName" placeholder="pl. Frontend vagy Tesztelés" />
                </label>
                <label class="field">
                  <span>Tervezett óra (opcionális)</span>
                  <input class="hours-input" type="number" min="0" step="1" [(ngModel)]="newTaskPlannedHours" placeholder="pl. 80" />
                </label>
                <button type="button" class="btn btn-success" (click)="createTask()" [disabled]="busy || !newTaskName.trim()">Feladat felvétele</button>
              </div>
            </div>

            <div class="muted" style="margin-top:8px;" *ngIf="selectedProjectId && taskLoading">Feladatok betöltése...</div>
            <div class="muted" style="margin-top:8px;" *ngIf="!taskLoading && !error && selectedProjectId && !tasks.length">Nincs még feladat ehhez a projekthez.</div>

            <div class="table-shell" *ngIf="tasks.length">
              <table>
                <thead>
                  <tr>
                    <th>Feladat</th>
                    <th>Állapot</th>
                    <th>Tervezett óra</th>
                    <th>Létrehozva</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let task of tasks">
                    <td>{{ task.name }}</td>
                    <td>{{ task.isActive ? 'Aktív' : 'Inaktív' }}</td>
                    <td>
                      <div class="row" style="gap:6px;">
                        <input
                          class="hours-input"
                          type="number"
                          min="0"
                          step="1"
                          [(ngModel)]="taskPlannedHoursDraft[task.id]"
                          placeholder="nincs" />
                        <button type="button" class="btn btn-success" (click)="saveTaskPlannedHours(task)" [disabled]="busy">Mentés</button>
                      </div>
                    </td>
                    <td>{{ formatDate(task.createdAtUtc) }}</td>
                    <td>
                      <button type="button" class="btn" [class.btn-danger]="task.isActive" [class.btn-success]="!task.isActive" (click)="toggleTask(task)" [disabled]="busy">
                        {{ task.isActive ? 'Inaktiválás' : 'Aktiválás' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="section-head">
              <h3>Projekt-hozzárendelések</h3>
              <button type="button" class="btn btn-refresh" (click)="refreshAssignmentsData()" [disabled]="assignBusy || assignLoading || !selectedProjectId">Frissítés</button>
            </div>

            <div class="muted" style="margin-top:8px;" *ngIf="!selectedProjectId">Válassz projektet a hozzárendeléshez.</div>

            <div class="block" style="margin-top:10px;" *ngIf="selectedProjectId">
              <h4 class="block-title">Felhasználó hozzárendelése projekthez</h4>
              <div class="assign-controls">
                <label class="field">
                  <span>Felhasználó keresés</span>
                  <input [(ngModel)]="userSearch" (ngModelChange)="onUserSearchChange()" placeholder="Keresés e-mail / név / user id" [disabled]="!selectedProjectIsActive" />
                </label>

                <label class="field">
                  <span>Felhasználó</span>
                  <select [(ngModel)]="selectedUserId" [disabled]="!selectedProjectIsActive">
                    <option [ngValue]="''">Válassz felhasználót...</option>
                    <option *ngFor="let u of users" [ngValue]="u.userId">
                      {{ u.email ?? u.userName ?? u.userId }}
                      <ng-container *ngIf="u.roles.length">[{{ u.roles.join(', ') }}]</ng-container>
                    </option>
                  </select>
                </label>

                <button type="button" class="btn btn-success" (click)="assignSelectedUser()" [disabled]="assignBusy || !selectedProjectId || !selectedUserId || !selectedProjectIsActive">
                  Hozzárendelés
                </button>
              </div>
              <div class="muted" style="margin-top:8px;" *ngIf="!selectedProjectIsActive">
                Inaktív projekthez nem lehet új felhasználót hozzárendelni.
              </div>
            </div>

            <div class="muted" style="margin-top:8px;" *ngIf="!assignLoading && selectedProjectId && !users.length">Nincs választható felhasználó.</div>
            <div class="muted" style="margin-top:8px;" *ngIf="selectedProjectId && assignLoading">Hozzárendelések betöltése...</div>
            <div class="muted" style="margin-top:8px;" *ngIf="!assignLoading && !error && selectedProjectId && !assignees.length">Nincs hozzárendelt felhasználó.</div>

            <div class="pager" *ngIf="selectedProjectId && userTotalPages > 1">
              <div class="pager-meta">Felhasználó oldal: {{ userPage }} / {{ userTotalPages }} · Összes: {{ userTotalItems }}</div>
              <div class="pager-actions">
                <button type="button" class="btn btn-pager" (click)="goToUserPage(userPage - 1)" [disabled]="assignLoading || userPage <= 1">Előző</button>
                <button type="button" class="btn btn-pager" (click)="goToUserPage(userPage + 1)" [disabled]="assignLoading || userPage >= userTotalPages">Következő</button>
              </div>
            </div>

            <div class="table-shell" *ngIf="assignees.length">
              <table>
                <thead>
                  <tr>
                    <th>Felhasználó</th>
                    <th>Hozzárendelve</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of assignees">
                    <td>{{ a.email ?? a.id }}</td>
                    <td>{{ formatDate(a.assignedAtUtc) }}</td>
                    <td>
                      <button type="button" class="btn btn-danger" (click)="unassignUser(a.id)" [disabled]="assignBusy">Levétel</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <div class="ok" *ngIf="message">{{ message }}</div>
      <div class="error" *ngIf="error">{{ error }}</div>
    </div>
  `,
})
export class HrProjectsPage {
  private http = inject(HttpClient);
  private auth = inject(AuthStateService);
  private cdr = inject(ChangeDetectorRef);
  private projectsLoadSeq = 0;
  private tasksLoadSeq = 0;
  private assigneesLoadSeq = 0;
  private projectSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private usePagedProjectsApi = true;
  private usePagedUsersApi = true;

  projects: HrProjectListItemDto[] = [];
  tasks: HrProjectTaskDto[] = [];
  selectedProjectId: number | null = null;
  projectSearch = '';
  projectPage = 1;
  projectPageSize = 8;
  projectTotalItems = 0;
  projectTotalPages = 1;
  newProjectName = '';
  selectedProjectPlannedHours: string | number = '';
  newTaskName = '';
  newTaskPlannedHours: string | number = '';
  taskPlannedHoursDraft: Partial<Record<number, string | number>> = {};
  users: HrUserListItemDto[] = [];
  userPage = 1;
  userPageSize = 10;
  userTotalItems = 0;
  userTotalPages = 1;
  assignees: HrProjectAssigneeDto[] = [];
  userSearch = '';
  selectedUserId = '';
  loading = false;
  taskLoading = false;
  assignLoading = false;
  assignBusy = false;
  busy = false;
  message = '';
  error = '';
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  get dashboardKicker(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('Admin') && !roles.includes('HR')) return 'Admin Irányítópult';
    return 'HR Irányítópult';
  }

  get dashboardSub(): string {
    const roles = this.auth.effectiveRoles();
    if (roles.includes('Admin') && !roles.includes('HR')) {
      return 'Projektstruktúra, feladat-tervezés és felhasználói hozzárendelések kezelése admin nézetben.';
    }
    return 'Projektstruktúra, feladat-tervezés és felhasználói hozzárendelések kezelése.';
  }

  get selectedProjectName(): string {
    if (!this.selectedProjectId) return '-';
    const selected = this.projects.find(p => p.id === this.selectedProjectId);
    return selected ? selected.name : `#${this.selectedProjectId}`;
  }

  get selectedProjectIsActive(): boolean {
    if (!this.selectedProjectId) return false;
    const selected = this.projects.find(p => p.id === this.selectedProjectId);
    return selected?.isActive ?? true;
  }

  get selectedProjectPlannedHoursLabel(): string {
    if (!this.selectedProjectId) return 'nincs';
    const selected = this.projects.find(p => p.id === this.selectedProjectId);
    return selected?.plannedHours ? `${selected.plannedHours} óra` : 'nincs';
  }

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  onProjectSearchChange(): void {
    this.projectPage = 1;
    if (this.projectSearchTimer) {
      clearTimeout(this.projectSearchTimer);
      this.projectSearchTimer = null;
    }
    this.projectSearchTimer = setTimeout(() => {
      this.loadProjects(false);
    }, 250);
  }

  onUserSearchChange(): void {
    this.userPage = 1;
    if (this.userSearchTimer) {
      clearTimeout(this.userSearchTimer);
      this.userSearchTimer = null;
    }
    this.userSearchTimer = setTimeout(() => {
      this.refreshAssignableUsersOnly();
    }, 250);
  }

  async goToProjectPage(page: number): Promise<void> {
    if (page < 1 || page > this.projectTotalPages || page === this.projectPage) return;
    this.projectPage = page;
    await this.loadProjects(false);
  }

  async goToUserPage(page: number): Promise<void> {
    if (page < 1 || page > this.userTotalPages || page === this.userPage) return;
    this.userPage = page;
    await this.refreshAssignableUsersOnly();
  }

  async loadProjects(loadRelatedData = true): Promise<void> {
    const requestSeq = ++this.projectsLoadSeq;
    this.loading = true;
    this.clearError();

    try {
      const response = await this.fetchProjectsPagedResponse();

      if (requestSeq !== this.projectsLoadSeq) {
        return;
      }

      this.projects = response.items;
      this.projectPage = response.page;
      this.projectPageSize = response.pageSize;
      this.projectTotalItems = response.totalItems;
      this.projectTotalPages = response.totalPages;

      if (this.projects.length) {
        const hasSelected = this.selectedProjectId && this.projects.some(p => p.id === this.selectedProjectId);
        if (!hasSelected) {
          this.selectedProjectId = this.projects[0].id;
        }
      } else if (!this.selectedProjectId) {
        this.selectedProjectId = null;
      }

      this.selectedProjectPlannedHours = this.resolveSelectedProjectPlannedHours();

      if (loadRelatedData) {
        await Promise.all([
          this.loadTasks(this.selectedProjectId),
          this.refreshAssignmentsData(this.selectedProjectId),
        ]);
      }

      if (requestSeq === this.projectsLoadSeq) {
        this.clearError();
      }
    } catch (e: any) {
      if (requestSeq !== this.projectsLoadSeq) {
        return;
      }

      this.setError(this.extractError(e, 'A projektek betöltése sikertelen.'));
      this.projects = [];
      this.projectTotalItems = 0;
      this.projectTotalPages = 1;
      this.tasks = [];
      this.users = [];
      this.assignees = [];
      this.selectedUserId = '';
      this.selectedProjectId = null;
    } finally {
      if (requestSeq === this.projectsLoadSeq) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async selectProject(projectId: number): Promise<void> {
    if (!projectId) return;

    if (this.selectedProjectId === projectId && !this.taskLoading && !this.assignLoading) {
      return;
    }

    this.selectedProjectId = projectId;
    this.newTaskName = '';
    this.newTaskPlannedHours = '';
    this.selectedUserId = '';
    this.userPage = 1;
    this.selectedProjectPlannedHours = this.resolveSelectedProjectPlannedHours();

    await Promise.all([
      this.loadTasks(projectId),
      this.refreshAssignmentsData(projectId),
    ]);
  }

  async createProject(): Promise<void> {
    const name = this.newProjectName.trim();
    if (!name) return;

    this.busy = true;
    this.clearFeedback();

    try {
      const created = await firstValueFrom(
        this.http.post<HrProjectListItemDto>(`${API_BASE}/api/projects`, {
          name,
        }).pipe(timeout(10000))
      );

      this.newProjectName = '';
      this.setMessage('Projekt létrehozva.');

      if (created?.id) {
        this.selectedProjectId = created.id;
      }

      this.projectPage = 1;
      this.projectSearch = '';
      await this.loadProjects(false);

      await Promise.all([
        this.loadTasks(this.selectedProjectId),
        this.refreshAssignmentsData(this.selectedProjectId),
      ]);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Projekt létrehozása sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  async createTask(): Promise<void> {
    const name = this.newTaskName.trim();
    const targetProjectId = this.selectedProjectId;
    if (!targetProjectId || !name) return;

    this.busy = true;
    this.clearFeedback();

    try {
      await firstValueFrom(this.http.post(`${API_BASE}/api/projects/${targetProjectId}/tasks`, {
        name,
        plannedHours: this.parsePlannedHoursInput(this.newTaskPlannedHours),
      }).pipe(timeout(10000)));
      this.newTaskName = '';
      this.newTaskPlannedHours = '';
      this.setMessage('Feladat létrehozva.');
      await this.loadTasks(targetProjectId);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Feladat létrehozása sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  async toggleTask(task: HrProjectTaskDto): Promise<void> {
    const targetProjectId = task.projectId;

    this.busy = true;
  this.clearFeedback();

    try {
      await firstValueFrom(this.http.put(`${API_BASE}/api/projects/tasks/${task.id}`, {
        isActive: !task.isActive,
      }).pipe(timeout(10000)));

      this.setMessage(!task.isActive ? 'Feladat aktiválva.' : 'Feladat inaktiválva.');
      await this.loadTasks(targetProjectId);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Feladat módosítása sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  async loadTasks(projectId: number | null = this.selectedProjectId): Promise<void> {
    if (!projectId) {
      this.tasks = [];
      this.taskLoading = false;
      return;
    }

    const requestSeq = ++this.tasksLoadSeq;
    this.taskLoading = true;

    try {
      const tasks = await firstValueFrom(
        this.http.get<HrProjectTaskDto[]>(`${API_BASE}/api/projects/${projectId}/tasks`).pipe(timeout(10000))
      );

      if (requestSeq !== this.tasksLoadSeq || this.selectedProjectId !== projectId) {
        return;
      }

      this.tasks = tasks;
      this.taskPlannedHoursDraft = Object.fromEntries(
        tasks.map(task => [task.id, typeof task.plannedHours === 'number' ? task.plannedHours : '']),
      );
      this.clearError();
    } catch (e: any) {
      if (requestSeq !== this.tasksLoadSeq || this.selectedProjectId !== projectId) {
        return;
      }

      this.setError(this.extractError(e, 'A projekt feladatainak betöltése sikertelen.'));
      this.tasks = [];
    } finally {
      if (requestSeq === this.tasksLoadSeq) {
        this.taskLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async refreshAssignmentsData(projectId: number | null = this.selectedProjectId): Promise<void> {
    if (!projectId) {
      this.users = [];
      this.userTotalItems = 0;
      this.userTotalPages = 1;
      this.assignees = [];
      this.assignLoading = false;
      return;
    }

    const requestSeq = ++this.assigneesLoadSeq;
    this.assignLoading = true;

    try {
      const [usersResponse, assignees] = await Promise.all([
        this.loadAssignableUsers(projectId),
        firstValueFrom(this.http.get<HrProjectAssigneeDto[]>(`${API_BASE}/api/projects/${projectId}/assignees`).pipe(timeout(10000))),
      ]);

      if (requestSeq !== this.assigneesLoadSeq || this.selectedProjectId !== projectId) {
        return;
      }

      this.users = usersResponse.items;
      this.userPage = usersResponse.page;
      this.userPageSize = usersResponse.pageSize;
      this.userTotalItems = usersResponse.totalItems;
      this.userTotalPages = usersResponse.totalPages;
      this.assignees = assignees;
      this.selectedProjectPlannedHours = this.resolveSelectedProjectPlannedHours();
      this.clearError();
    } catch (e: any) {
      if (requestSeq !== this.assigneesLoadSeq || this.selectedProjectId !== projectId) {
        return;
      }

      this.setError(this.extractError(e, 'A hozzárendelési adatok betöltése sikertelen.'));
      this.assignees = [];
    } finally {
      if (requestSeq === this.assigneesLoadSeq) {
        this.assignLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  private async loadAssignableUsers(projectId: number | null = this.selectedProjectId): Promise<PagedResponse<HrUserListItemDto>> {
    if (!projectId) {
      return {
        page: 1,
        pageSize: this.userPageSize,
        totalItems: 0,
        totalPages: 1,
        items: [],
      };
    }

    if (!this.selectedProjectIsActive) {
      return {
        page: 1,
        pageSize: this.userPageSize,
        totalItems: 0,
        totalPages: 1,
        items: [],
      };
    }

    const response = await this.fetchUsersPagedResponse();

    this.users = response.items;
    this.userPage = response.page;
    this.userPageSize = response.pageSize;
    this.userTotalItems = response.totalItems;
    this.userTotalPages = response.totalPages;

    if (this.selectedUserId && !this.users.some(x => x.userId === this.selectedUserId)) {
      this.selectedUserId = '';
    }

    return response;
  }

  private async fetchProjectsPagedResponse(): Promise<PagedResponse<HrProjectListItemDto>> {
    if (this.usePagedProjectsApi) {
      try {
        const params = new URLSearchParams({
          page: String(this.projectPage),
          pageSize: String(this.projectPageSize),
        });
        if (this.projectSearch.trim()) {
          params.set('q', this.projectSearch.trim());
        }

        const response = await firstValueFrom(
          this.http.get<PagedResponse<HrProjectListItemDto>>(`${API_BASE}/api/projects/paged?${params.toString()}`).pipe(timeout(10000))
        );

        return {
          ...response,
          items: response.items.map(p => this.normalizeProject(p)),
        };
      } catch (e: any) {
        if (e?.status !== 404) {
          throw e;
        }
        this.usePagedProjectsApi = false;
      }
    }

    const allProjects = await firstValueFrom(
      this.http.get<HrProjectListItemDto[]>(`${API_BASE}/api/projects`).pipe(timeout(10000))
    );

    const normalizedProjects = allProjects.map(p => this.normalizeProject(p));

    const query = this.projectSearch.trim().toLocaleLowerCase('hu-HU');
    const filtered = !query
      ? normalizedProjects
      : normalizedProjects.filter(p =>
        p.name.toLocaleLowerCase('hu-HU').includes(query)
        || String(p.id).includes(query)
      );

    const pageSize = this.projectPageSize;
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(1, this.projectPage), totalPages);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      items,
    };
  }

  private async fetchUsersPagedResponse(): Promise<PagedResponse<HrUserListItemDto>> {
    if (this.usePagedUsersApi) {
      try {
        const params = new URLSearchParams({
          assignableOnly: 'true',
          page: String(this.userPage),
          pageSize: String(this.userPageSize),
        });
        if (this.userSearch.trim()) {
          params.set('q', this.userSearch.trim());
        }

        return await firstValueFrom(
          this.http
            .get<PagedResponse<HrUserListItemDto>>(`${API_BASE}/api/hr/users/paged?${params.toString()}`)
            .pipe(timeout(10000))
        );
      } catch (e: any) {
        if (e?.status !== 404) {
          throw e;
        }
        this.usePagedUsersApi = false;
      }
    }

    const allUsers = await firstValueFrom(
      this.http.get<HrUserListItemDto[]>(`${API_BASE}/api/hr/users`).pipe(timeout(10000))
    );

    const query = this.userSearch.trim().toLocaleLowerCase('hu-HU');
    const filtered = !query
      ? allUsers
      : allUsers.filter(u => {
        const email = (u.email ?? '').toLocaleLowerCase('hu-HU');
        const userName = (u.userName ?? '').toLocaleLowerCase('hu-HU');
        const userId = u.userId.toLocaleLowerCase('hu-HU');
        return email.includes(query) || userName.includes(query) || userId.includes(query);
      });

    const pageSize = this.userPageSize;
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(1, this.userPage), totalPages);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      items,
    };
  }

  private async refreshAssignableUsersOnly(): Promise<void> {
    if (!this.selectedProjectId) {
      this.users = [];
      this.userTotalItems = 0;
      this.userTotalPages = 1;
      return;
    }

    this.assignLoading = true;
    try {
      await this.loadAssignableUsers(this.selectedProjectId);
      this.clearError();
    } catch (e: any) {
      this.setError(this.extractError(e, 'A felhasználók betöltése sikertelen.'));
      this.users = [];
      this.userTotalItems = 0;
      this.userTotalPages = 1;
    } finally {
      this.assignLoading = false;
      this.cdr.detectChanges();
    }
  }

  async assignSelectedUser(): Promise<void> {
    const targetProjectId = this.selectedProjectId;
    const targetUserId = this.selectedUserId;
    if (!targetProjectId || !targetUserId || !this.selectedProjectIsActive) return;

    this.assignBusy = true;
    this.clearFeedback();

    try {
      await firstValueFrom(
        this.http.post(
          `${API_BASE}/api/projects/${targetProjectId}/assign`,
          { userId: targetUserId },
          { responseType: 'text' }
        ).pipe(timeout(10000))
      );

      this.setMessage('Felhasználó hozzárendelve a projekthez.');
      await this.refreshAssignmentsData(targetProjectId);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Hozzárendelés sikertelen.'));
    } finally {
      this.assignBusy = false;
      this.cdr.detectChanges();
    }
  }

  async unassignUser(userId: string): Promise<void> {
    const targetProjectId = this.selectedProjectId;
    if (!targetProjectId || !userId) return;

    this.assignBusy = true;
    this.clearFeedback();

    try {
      await firstValueFrom(
        this.http.post(
          `${API_BASE}/api/projects/${targetProjectId}/unassign`,
          { userId },
          { responseType: 'text' }
        ).pipe(timeout(10000))
      );

      this.setMessage('Felhasználó levéve a projektről.');
      await this.refreshAssignmentsData(targetProjectId);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Levétel sikertelen.'));
    } finally {
      this.assignBusy = false;
      this.cdr.detectChanges();
    }
  }

  formatDate(utc: string): string {
    const value = new Date(utc);
    return Number.isNaN(value.getTime()) ? '-' : value.toLocaleString('hu-HU');
  }

  async saveSelectedProjectPlannedHours(): Promise<void> {
    const projectId = this.selectedProjectId;
    if (!projectId) return;

    this.busy = true;
    this.clearFeedback();

    try {
      const plannedHours = this.parsePlannedHoursInput(this.selectedProjectPlannedHours);
      await firstValueFrom(
        this.http.put<HrProjectListItemDto>(`${API_BASE}/api/projects/${projectId}`, {
          plannedHours,
        }).pipe(timeout(10000))
      );

      const idx = this.projects.findIndex(p => p.id === projectId);
      if (idx >= 0) {
        this.projects[idx] = {
          ...this.projects[idx],
          plannedHours: plannedHours > 0 ? plannedHours : null,
        };
      }
      this.selectedProjectPlannedHours = plannedHours > 0 ? plannedHours : '';
      this.setMessage('Projekt tervezett óra mentve.');
    } catch (e: any) {
      this.setError(this.extractError(e, 'Projekt terv mentése sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  async toggleSelectedProjectActive(): Promise<void> {
    const projectId = this.selectedProjectId;
    if (!projectId) return;

    const nextActive = !this.selectedProjectIsActive;

    this.busy = true;
    this.clearFeedback();

    try {
      await firstValueFrom(
        this.http.put<HrProjectListItemDto>(`${API_BASE}/api/projects/${projectId}`, {
          isActive: nextActive,
        }).pipe(timeout(10000))
      );

      const idx = this.projects.findIndex(p => p.id === projectId);
      if (idx >= 0) {
        this.projects[idx] = {
          ...this.projects[idx],
          isActive: nextActive,
        };
      }

      if (!nextActive) {
        this.selectedUserId = '';
      }

      this.setMessage(nextActive ? 'Projekt aktiválva.' : 'Projekt inaktiválva.');
      await this.refreshAssignmentsData(projectId);
    } catch (e: any) {
      this.setError(this.extractError(e, 'Projekt állapot módosítása sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  async saveTaskPlannedHours(task: HrProjectTaskDto): Promise<void> {
    if (!task?.id) return;

    this.busy = true;
    this.clearFeedback();

    try {
      const plannedHours = this.parsePlannedHoursInput(this.taskPlannedHoursDraft[task.id]);
      await firstValueFrom(
        this.http.put(`${API_BASE}/api/projects/tasks/${task.id}`, {
          plannedHours,
        }).pipe(timeout(10000))
      );

      const taskIndex = this.tasks.findIndex(t => t.id === task.id);
      if (taskIndex >= 0) {
        this.tasks[taskIndex] = {
          ...this.tasks[taskIndex],
          plannedHours: plannedHours > 0 ? plannedHours : null,
        };
      }
      this.taskPlannedHoursDraft[task.id] = plannedHours > 0 ? plannedHours : '';
      this.setMessage('Feladat tervezett óra mentve.');
    } catch (e: any) {
      this.setError(this.extractError(e, 'Feladat terv mentése sikertelen.'));
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }

  private resolveSelectedProjectPlannedHours(): string | number {
    if (!this.selectedProjectId) return '';
    const project = this.projects.find(p => p.id === this.selectedProjectId);
    return typeof project?.plannedHours === 'number' ? project.plannedHours : '';
  }

  private parsePlannedHoursInput(raw: string | number | undefined): number {
    if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
    const normalized = String(raw).trim().replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
  }

  private normalizeProject(project: HrProjectListItemDto): HrProjectListItemDto {
    return {
      ...project,
      isActive: project.isActive ?? true,
    };
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
