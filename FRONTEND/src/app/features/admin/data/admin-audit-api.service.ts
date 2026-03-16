import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../../../core/config/endpoints';

export type AuditLogDto = {
  id: number;
  timestampUtc: string;
  eventType: string;
  result: string;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  correlationId: string | null;
  dataJson: string | null;
};

export type PagedAuditResponse = {
  page: number;
  pageSize: number;
  totalCount: number;
  items: AuditLogDto[];
};

export type AuditQuery = {
  fromUtc?: string;
  toUtc?: string;
  eventType?: string;
  userId?: string;
  result?: string;
  page?: number;
  pageSize?: number;
};

@Injectable({ providedIn: 'root' })
export class AdminAuditApiService {
  constructor(private http: HttpClient) {}

  getAudit(query: AuditQuery): Observable<PagedAuditResponse> {
    let params = new HttpParams();

    if (query.fromUtc) params = params.set('fromUtc', query.fromUtc);
    if (query.toUtc) params = params.set('toUtc', query.toUtc);
    if (query.eventType) params = params.set('eventType', query.eventType);
    if (query.userId) params = params.set('userId', query.userId);
    if (query.result) params = params.set('result', query.result);
    if (typeof query.page === 'number') params = params.set('page', String(query.page));
    if (typeof query.pageSize === 'number') params = params.set('pageSize', String(query.pageSize));

    return this.http.get<PagedAuditResponse>(buildApiUrl('/api/admin/audit'), { params });
  }
}
