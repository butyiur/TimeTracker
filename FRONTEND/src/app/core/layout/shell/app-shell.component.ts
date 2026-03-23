import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
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
        background: var(--tt-app-bg);
      }

      .sidebar {
        width: 280px;
        flex: 0 0 280px;
        align-self: flex-start;
        position: sticky;
        top: 0;
        height: 100vh;
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
        color: var(--tt-text);
      }

      @media (max-width: 1024px) {
        .shell {
          flex-direction: column;
        }

        .sidebar {
          width: 100%;
          flex: 0 0 auto;
          height: auto;
          min-height: auto;
          position: static;
          align-self: stretch;
        }

        .topbar {
          padding: 8px 12px 8px;
        }

        .content {
          padding: 0 12px 12px;
        }
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
      this.auth.ensureMeLoaded().catch(() => {});
    }
  }
}