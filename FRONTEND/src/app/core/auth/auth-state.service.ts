import { Injectable, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthApiService, MeDto } from './auth-api.service';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthStateService { 
  private oauth = inject(OAuthService);
  private api = inject(AuthApiService);

  private meSubject = new BehaviorSubject<MeDto | null>(null);
  me$ = this.meSubject.asObservable();
  private meLoadPromise: Promise<void> | null = null;

  currentMe(): MeDto | null {
    return this.meSubject.value;
  }

  isAuthenticated(): boolean {
    return this.oauth.hasValidAccessToken();
  }

  async refreshMe(): Promise<void> {
    if (!this.isAuthenticated()) {
      this.meSubject.next(null);
      return;
    }

    try {
      const me = await firstValueFrom(this.api.me().pipe(timeout(6000)));
      this.meSubject.next(me);
    } catch {
      this.meSubject.next(null);
    }
  }

  async ensureMeLoaded(): Promise<void> {
    if (!this.isAuthenticated()) {
      this.meSubject.next(null);
      return;
    }

    if (this.meSubject.value) {
      return;
    }

    if (!this.meLoadPromise) {
      this.meLoadPromise = this.refreshMe().finally(() => {
        this.meLoadPromise = null;
      });
    }

    await Promise.race([
      this.meLoadPromise,
      new Promise<void>(resolve => setTimeout(resolve, 7000)),
    ]);
  }

  userName(): string | null {
    // elsődleges: backend /debug/me
    const me = this.meSubject.value;
    if (me?.name) return me.name;

    // fallback (ha még nem futott le a refreshMe)
    const claims: any = this.oauth.getIdentityClaims() ?? {};
    return claims?.name ?? claims?.preferred_username ?? claims?.email ?? claims?.sub ?? null;
  }

  roles(): string[] {
    // kizárólag backend /api/auth/me alapján
    const me = this.meSubject.value;
    if (me?.roles?.length) return me.roles;

    return [];
  }

  // frontend jogosultság-ellenőrzés: backend role policy-kkel 1:1-ben
  effectiveRoles(): string[] {
    return this.roles();
  }

  hasAnyRole(required: string[]): boolean {
    const effective = this.effectiveRoles().map(r => r.toLocaleLowerCase('hu-HU'));
    return required.some(r => effective.includes(r.toLocaleLowerCase('hu-HU')));
  }
}