import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { buildApiUrl } from '../../../core/config/endpoints';

export type AdminUserDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  roles: string[];
  isActive: boolean;
  isLockedOut: boolean;
  lockoutEnd: string | null;
  accessFailedCount: number;
  emailConfirmed: boolean;
  lockoutReason: string | null;
};

export type AdminUsersQuery = {
  q?: string;
  role?: string;
  page?: number;
  pageSize?: number;
  employmentActive?: boolean;
};

export type AdminUsersPagedDto = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  activeUsers: number;
  inactiveUsers: number;
  hrUsers: number;
  adminUsers: number;
  lockedUsers: number;
  items: AdminUserDto[];
};

export type AdminUserDetailsDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  phoneNumber: string | null;
  emailConfirmed: boolean;
  roles: string[];
  isActive: boolean;
  isLockedOut: boolean;
  lockoutEnd: string | null;
  accessFailedCount: number;
  lockoutReason: string | null;
  photoUrl: string | null;
};

export type RegistrationRequestDto = {
  userId: string;
  email: string | null;
  userName: string | null;
  emailConfirmed: boolean;
  registrationRequestedAtUtc: string | null;
};

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  constructor(private http: HttpClient) {}

  list(query: AdminUsersQuery): Observable<AdminUsersPagedDto> {
    let params = new HttpParams();
    const requestedPage = typeof query.page === 'number' ? query.page : 1;
    const requestedPageSize = typeof query.pageSize === 'number' ? query.pageSize : 25;

    if (query.q?.trim()) params = params.set('q', query.q.trim());
    if (query.role?.trim()) params = params.set('role', query.role.trim());
    if (typeof query.employmentActive === 'boolean') {
      params = params.set('employmentActive', String(query.employmentActive));
    }
    if (typeof query.page === 'number') params = params.set('page', String(query.page));
    if (typeof query.pageSize === 'number') params = params.set('pageSize', String(query.pageSize));

    return this.http.get<AdminUsersPagedDto | AdminUserDto[]>(buildApiUrl('/api/admin/users'), { params }).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return {
            page: 1,
            pageSize: requestedPageSize,
            totalItems: response.length,
            totalPages: 1,
            activeUsers: response.filter(x => x.isActive).length,
            inactiveUsers: response.filter(x => !x.isActive).length,
            hrUsers: response.filter(x => x.roles.includes('HR')).length,
            adminUsers: response.filter(x => x.roles.includes('Admin')).length,
            lockedUsers: response.filter(x => x.isLockedOut).length,
            items: response,
          } satisfies AdminUsersPagedDto;
        }

        return {
          page: response.page ?? requestedPage,
          pageSize: response.pageSize ?? requestedPageSize,
          totalItems: response.totalItems ?? response.items?.length ?? 0,
          totalPages: response.totalPages ?? 1,
          activeUsers: response.activeUsers ?? 0,
          inactiveUsers: response.inactiveUsers ?? 0,
          hrUsers: response.hrUsers ?? 0,
          adminUsers: response.adminUsers ?? 0,
          lockedUsers: response.lockedUsers ?? 0,
          items: Array.isArray(response.items) ? response.items : [],
        } satisfies AdminUsersPagedDto;
      })
    );
  }

  setActive(userId: string, isActive: boolean): Observable<{ ok: boolean; userId: string; isActive: boolean }> {
    return this.http.put<{ ok: boolean; userId: string; isActive: boolean }>(
      buildApiUrl(`/api/admin/users/${encodeURIComponent(userId)}/active`),
      { isActive }
    );
  }

  setEmploymentActive(userId: string, isActive: boolean): Observable<{ ok: boolean; userId: string; isActive: boolean }> {
    return this.http.put<{ ok: boolean; userId: string; isActive: boolean }>(
      buildApiUrl(`/api/hr/users/${encodeURIComponent(userId)}/employment-active`),
      { isActive }
    );
  }

  listRegistrationRequests(): Observable<RegistrationRequestDto[]> {
    return this.http.get<RegistrationRequestDto[]>(
      buildApiUrl('/api/hr/registration-requests')
    );
  }

  approveRegistrationRequest(userId: string): Observable<{ ok: boolean; userId: string; approved: boolean }> {
    return this.http.post<{ ok: boolean; userId: string; approved: boolean }>(
      buildApiUrl(`/api/hr/registration-requests/${encodeURIComponent(userId)}/approve`),
      {}
    );
  }

  rejectRegistrationRequest(userId: string): Observable<{ ok: boolean; userId: string; rejected: boolean }> {
    return this.http.post<{ ok: boolean; userId: string; rejected: boolean }>(
      buildApiUrl(`/api/hr/registration-requests/${encodeURIComponent(userId)}/reject`),
      {}
    );
  }

  setRoles(userId: string, roles: string[]): Observable<{ ok: boolean; userId: string; roles: string[] }> {
    return this.http.put<{ ok: boolean; userId: string; roles: string[] }>(
      buildApiUrl(`/api/admin/users/${encodeURIComponent(userId)}/roles`),
      { roles }
    );
  }

  getById(userId: string): Observable<AdminUserDetailsDto> {
    return this.http.get<AdminUserDetailsDto>(
      buildApiUrl(`/api/admin/users/${encodeURIComponent(userId)}`)
    );
  }
}
