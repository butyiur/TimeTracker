import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { buildApiUrl } from '../config/endpoints';

export type MeDto = {
  userId: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  roles: string[];
  photoUrl?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthApiService {

  constructor(private http: HttpClient) {}

  me(): Observable<MeDto> {
    return this.http.get<MeDto>(buildApiUrl('/api/auth/me'));
  }
}