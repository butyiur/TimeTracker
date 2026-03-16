import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/endpoints';

const API_BASE = API_BASE_URL;

export type ProfileMeDto = {
  userId: string;
  name: string;
  userName: string | null;
  email: string | null;
  phoneNumber: string | null;
  emailConfirmed: boolean;
  roles: string[];
  photoUrl: string | null;
};

export type PhotoUploadDto = {
  photoUrl: string;
};

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  constructor(private http: HttpClient) {}

  me(): Observable<ProfileMeDto> {
    return this.http.get<ProfileMeDto>(`${API_BASE}/api/profile/me`);
  }

  uploadPhoto(file: File): Observable<PhotoUploadDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<PhotoUploadDto>(`${API_BASE}/api/profile/me/photo`, formData);
  }

  deletePhoto(): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/api/profile/me/photo`);
  }
}
