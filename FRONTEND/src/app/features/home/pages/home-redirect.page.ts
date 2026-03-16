import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStateService } from '../../../core/auth/auth-state.service';

@Component({
  standalone: true,
  template: `<p style="padding:16px;">Betöltés...</p>`,
})
export class HomeRedirectPage {
  private auth = inject(AuthStateService);
  private router = inject(Router);

  async ngOnInit() {
    const roles = this.auth.effectiveRoles();

    if (roles.includes('Admin')) {
      await this.router.navigateByUrl('/home/admin');
      return;
    }
    if (roles.includes('HR')) {
      await this.router.navigateByUrl('/home/hr');
      return;
    }
    await this.router.navigateByUrl('/home/employee');
  }
}