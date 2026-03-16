import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../../../core/config/endpoints';

export type TimeEntryReportRow = {
  id: number;
  projectId: number;
  projectName: string;
  taskId: number | null;
  taskName: string | null;
  userId: string;
  userEmail: string;
  startUtc: string;
  endUtc: string | null;
  durationMinutes: number | null;
};

export type TimeEntrySummaryRow = {
  projectId: number;
  projectName: string;
  taskId: number | null;
  taskName: string | null;
  userId: string;
  userEmail: string;
  totalMinutes: number;
};

export type ReportProjectLookup = {
  id: number;
  name: string;
  plannedHours?: number | null;
};

export type ReportTaskLookup = {
  id: number;
  projectId: number;
  name: string;
  isActive: boolean;
  plannedHours?: number | null;
  createdAtUtc: string;
};

export type HrUserLookup = {
  userId: string;
  email: string | null;
  userName: string | null;
  roles: string[];
};

export type ReportsQuery = {
  from?: string;
  to?: string;
  projectId?: number;
  taskId?: number;
  userId?: string;
  includeRunning?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private http: HttpClient) {}

  getProjects(): Observable<ReportProjectLookup[]> {
    return this.http.get<ReportProjectLookup[]>(buildApiUrl('/api/projects'));
  }

  getProjectTasks(projectId: number): Observable<ReportTaskLookup[]> {
    return this.http.get<ReportTaskLookup[]>(buildApiUrl(`/api/projects/${projectId}/tasks`));
  }

  getHrUsers(): Observable<HrUserLookup[]> {
    return this.http.get<HrUserLookup[]>(buildApiUrl('/api/hr/users'));
  }

  getTimeEntries(query: ReportsQuery): Observable<TimeEntryReportRow[]> {
    return this.http.get<TimeEntryReportRow[]>(buildApiUrl('/api/reports/timeentries'), {
      params: this.toParams(query),
    });
  }

  getSummary(query: ReportsQuery): Observable<TimeEntrySummaryRow[]> {
    return this.http.get<TimeEntrySummaryRow[]>(buildApiUrl('/api/reports/summary'), {
      params: this.toParams(query),
    });
  }

  exportCsv(query: ReportsQuery): Observable<Blob> {
    return this.http.get(buildApiUrl('/api/reports/export.csv'), {
      params: this.toParams(query),
      responseType: 'blob',
    });
  }

  exportXlsx(query: ReportsQuery): Observable<Blob> {
    return this.http.get(buildApiUrl('/api/reports/export.xlsx'), {
      params: this.toParams(query),
      responseType: 'blob',
    });
  }

  private toParams(query: ReportsQuery): HttpParams {
    let params = new HttpParams();

    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (typeof query.projectId === 'number') params = params.set('projectId', String(query.projectId));
    if (typeof query.taskId === 'number') params = params.set('taskId', String(query.taskId));
    if (query.userId) params = params.set('userId', query.userId);
    if (typeof query.includeRunning === 'boolean') params = params.set('includeRunning', String(query.includeRunning));

    return params;
  }
}
