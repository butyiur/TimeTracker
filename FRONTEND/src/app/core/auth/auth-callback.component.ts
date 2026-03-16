import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthStateService } from './auth-state.service';

@Component({
  standalone: true,
  template: `<p style="padding:16px">Finishing login...</p>`,
})
export class AuthCallbackComponent implements OnInit {
  private oauth = inject(OAuthService);
  private router = inject(Router);
  private authState = inject(AuthStateService);

  async ngOnInit() {
    try {
      await this.oauth.loadDiscoveryDocumentAndTryLogin();

      const hasAT = this.oauth.hasValidAccessToken();
      const raw = this.oauth.state || '/overview';
      const target = raw.includes('%') ? decodeURIComponent(raw) : raw;

      if (!hasAT) {
        await this.router.navigateByUrl('/login');
        return;
      }

      // ✅ itt töltjük be a user infót, ha már van token
      await this.authState.refreshMe();

      await this.router.navigateByUrl(target.startsWith('/') ? target : '/' + target);
    } catch (e) {
      console.error('Callback login failed', e);
      await this.router.navigateByUrl('/login');
    }
  }
}