import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';

@Component({
  standalone: true,
  template: `<p style="padding:16px">Betöltés...</p>`,
})
export class OverviewRedirectPage implements OnInit {
  private auth = inject(AuthStateService);
  private router = inject(Router);

  async ngOnInit() {
    await this.auth.ensureMeLoaded();
    let roles = this.auth.effectiveRoles();

    // One extra refresh helps avoid transient empty-role state right after callback.
    if (!roles.length) {
      await this.auth.refreshMe();
      roles = this.auth.effectiveRoles();
    }

    if (!roles.length) {
      await this.router.navigateByUrl('/login?returnUrl=' + encodeURIComponent('/overview'));
      return;
    }

    if (roles.includes('Admin')) {
      await this.router.navigateByUrl('/admin/overview');
      return;
    }

    if (roles.includes('HR')) {
      await this.router.navigateByUrl('/hr/overview');
      return;
    }

    await this.router.navigateByUrl('/employee/overview');
  }
}