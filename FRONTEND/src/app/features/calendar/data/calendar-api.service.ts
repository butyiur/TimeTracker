import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;

export type MyProjectDto = {
  id: number;
  name: string;
};

export type TimeEntryDto = {
  id: number;
  projectId: number;
  projectName: string;
  taskId: number | null;
  taskName: string | null;
  startUtc: string;
  endUtc: string | null;
  description: string | null;
};

export type ProjectTaskDto = {
  id: number;
  projectId: number;
  name: string;
  isActive: boolean;
  createdAtUtc: string;
};

export type ManualEntryRequest = {
  projectId: number;
  taskId: number;
  startUtc: string;
  endUtc: string;
  description: string | null;
};

export type ManualEntryRequestDto = {
  id: number;
  projectId: number;
  projectName: string;
  taskId: number;
  taskName: string | null;
  startUtc: string;
  endUtc: string;
  description: string | null;
  status: string;
  createdAtUtc: string;
};

export type StopActiveRequest = {
  projectId: number | null;
  taskId: number | null;
  description: string | null;
};

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  constructor(private http: HttpClient) {}

  getMyProjects(): Observable<MyProjectDto[]> {
    return this.http.get<MyProjectDto[]>(`${API_BASE}/api/projects/mine`);
  }

  getProjectTasks(projectId: number): Observable<ProjectTaskDto[]> {
    return this.http.get<ProjectTaskDto[]>(`${API_BASE}/api/projects/${projectId}/tasks`);
  }

  getMyEntries(): Observable<TimeEntryDto[]> {
    return this.http.get<TimeEntryDto[]>(`${API_BASE}/api/timeentries/mine`);
  }

  getMyManualRequests(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'): Observable<ManualEntryRequestDto[]> {
    return this.http.get<ManualEntryRequestDto[]>(`${API_BASE}/api/timeentries/manual-requests/mine?status=${status}`);
  }

  createManualRequest(payload: ManualEntryRequest): Observable<ManualEntryRequestDto> {
    return this.http.post<ManualEntryRequestDto>(`${API_BASE}/api/timeentries/manual-requests`, payload);
  }

  start(projectId: number, taskId: number | null): Observable<TimeEntryDto> {
    return this.http.post<TimeEntryDto>(`${API_BASE}/api/timeentries/start`, { projectId, taskId });
  }

  stopActive(payload: StopActiveRequest): Observable<TimeEntryDto> {
    return this.http.post<TimeEntryDto>(`${API_BASE}/api/timeentries/stop-active`, payload);
  }

  deleteEntry(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/api/timeentries/${id}`);
  }
}
