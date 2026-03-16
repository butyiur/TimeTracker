import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { OnInit } from '@angular/core';
import { AuthStateService } from '../../auth/auth-state.service';

@Component({
  selector: 'tt-app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  styles: [
    `
      .shell {
        display: flex;
        width: 100%;
        min-height: 100vh;
        background:
          radial-gradient(980px 360px at 10% -12%, rgba(112, 88, 230, 0.38), rgba(112, 88, 230, 0) 62%),
          radial-gradient(860px 340px at 100% 116%, rgba(106, 145, 255, 0.24), rgba(106, 145, 255, 0) 64%),
          linear-gradient(170deg, #dcd6fb 0%, #d6ddf8 52%, #d1d8ef 100%);
      }
      .sidebar {
        width: 280px;
        flex: 0 0 280px;
        height: auto;
        min-height: 100%;
        position: relative;
        top: auto;
        align-self: stretch;
      }
      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .topbar {
        display: flex;
        align-items: center;
        padding: 12px 16px 10px;
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
      }
      .content {
        padding: 0 16px 16px;
        width: 100%;
        box-sizing: border-box;
        min-width: 0;
        color: #1f1a4d;
      }

      @media (max-width: 1024px) {
        .shell { flex-direction: column; }
        .sidebar {
          width: 100%;
          flex: 0 0 auto;
          height: auto;
          min-height: auto;
          position: static;
          align-self: stretch;
        }
        .topbar { padding: 8px 12px 8px; }
        .content { padding: 0 12px 12px; }
      }
    `,
  ],
  template: `
    <div class="shell">
      <tt-sidebar class="sidebar"></tt-sidebar>

      <div class="main">
        <tt-topbar class="topbar"></tt-topbar>

        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
})

export class AppShellComponent implements OnInit {
  private auth = inject(AuthStateService);

  async ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.auth.ensureMeLoaded().catch(() => {
      });
    }
  }
}