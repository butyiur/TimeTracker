import { Component, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { APP_NAV, AppNavSection } from './app-nav';

@Component({
  selector: 'tt-sidebar',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display:block;
        height: auto;
        min-height: 100%;
        background:
          radial-gradient(520px 210px at 0% -6%, rgba(166, 149, 250, 0.2), rgba(166, 149, 250, 0) 70%),
          linear-gradient(170deg, rgba(37, 22, 97, 0.985), rgba(29, 17, 80, 0.985));
        background-size: cover;
        background-position: center;
        border-right: 1px solid rgba(221, 212, 255, 0.4);
        border-top-right-radius: 18px;
        border-bottom-right-radius: 18px;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        box-shadow: 8px 0 18px rgba(14, 9, 46, 0.28);
      }
      .wrap {
        padding:14px;
        display:flex;
        flex-direction:column;
        gap:12px;
        backdrop-filter: blur(5px);
        min-height: 100%;
      }

      .brand {
        display:flex;
        align-items:center;
        gap:10px;
        padding:10px;
        border-radius:12px;
        background: rgba(255,255,255,0.1);
        border:1px solid rgba(234,225,255,0.38);
      }
      .logo {
        width:34px;
        height:34px;
        border-radius:12px;
        background: linear-gradient(135deg, #8a73ff, #5b3df5);
        box-shadow: 0 8px 18px rgba(42, 25, 112, 0.36);
      }
      .brandTitle { font-weight:800; line-height:1.1; color: #fff; font-size: 1.04rem; }
      .brandSub { font-size:12px; color: rgba(228, 219, 255, 0.82); }

      .sectionLabel {
        font-size:11px;
        letter-spacing:.11em;
        text-transform:uppercase;
        color: rgba(209, 197, 255, 0.75);
        padding:0 6px;
        margin-top:6px;
      }
      nav { display:flex; flex-direction:column; gap:4px; margin-bottom:6px; }

      a {
        display:flex;
        align-items:center;
        gap:10px;
        padding:8px 10px;
        border-radius:10px;
        text-decoration:none;
        color:#efeaff;
        border: 1px solid transparent;
        transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
      }
      a:hover {
        background: rgba(255,255,255,0.16);
        border-color: rgba(234,224,255,0.32);
        transform: translateX(2px);
      }
      a.active {
        background: linear-gradient(135deg, rgba(163, 145, 252, 0.4), rgba(122, 97, 238, 0.36));
        border:1px solid rgba(239,231,255,0.66);
        box-shadow:0 6px 14px rgba(12, 8, 40, 0.3);
        font-weight:700;
      }

      .dot {
        width:8px;
        height:8px;
        border-radius:999px;
        background: rgba(190, 173, 255, 0.66);
      }
      a.active .dot { background:#ffffff; }

      a.disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
}

      @media (max-width: 1024px) {
        :host {
          height: auto;
          min-height: auto;
          overflow-y: visible;
          overscroll-behavior: auto;
          border-right: none;
          border-bottom: 1px solid rgba(230, 222, 255, 0.28);
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
          box-shadow: none;
        }
        .wrap { min-height: auto; }
      }
    `,
  ],
  template: `
    <div class="wrap">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <div class="brandTitle">TimeTracker</div>
          <div class="brandSub">Munkaidő nyilvántartó</div>
        </div>
      </div>

      <ng-container *ngFor="let section of (sections$ | async)">
        <div class="sectionLabel">{{ section.label }}</div>

        <nav>
          <a
              *ngFor="let item of section.items"
              [href]="item.disabled ? null : item.path"
              (click)="onNavigate($event, item.path, item.disabled)"
              [class.active]="isActive(item.path)"
              [class.disabled]="item.disabled"
              [attr.aria-disabled]="item.disabled ? 'true' : null"
              [attr.tabindex]="item.disabled ? -1 : 0"
            >
              <span class="dot"></span>
              <span>{{ item.label }}</span>
          </a>
        </nav>
      </ng-container>
    </div>
  `,
})
export class SidebarComponent {
  private auth = inject(AuthStateService);
  private router = inject(Router);
  private currentUrl = this.normalizeUrl(this.router.url);

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl = this.normalizeUrl(this.router.url);
      });
  }

  // ✅ reaktív: amikor a me$ frissül (login/refresh), újraszámoljuk a menüt
  sections$ = this.auth.me$.pipe(
    startWith(null),
    map(() => this.buildVisibleSections())
  );

  private buildVisibleSections(): AppNavSection[] {
    const effective = this.auth.effectiveRoles();

    return APP_NAV
      .map(section => ({
        ...section,
        items: section.items.filter(i => !i.roles || i.roles.some(r => effective.includes(r))),
      }))
      .filter(section => section.items.length > 0);
  }

  onNavigate(event: MouseEvent, path: string, disabled?: boolean): void {
    event.preventDefault();
    if (disabled) return;

    if (this.currentUrl === path) return;
    void this.router.navigateByUrl(path);
  }

  isActive(path: string): boolean {
    const current = this.currentUrl;
    const candidateMatch = current === path || current.startsWith(path + '/');
    if (!candidateMatch) return false;

    const visiblePaths = this.buildVisibleSections()
      .flatMap(section => section.items.map(item => item.path));

    const hasMoreSpecificMatch = visiblePaths.some(other =>
      other.length > path.length
      && other.startsWith(path + '/')
      && (current === other || current.startsWith(other + '/'))
    );

    return !hasMoreSpecificMatch;
  }

  private normalizeUrl(url: string): string {
    return String(url ?? '').split('?')[0].split('#')[0] || '/';
  }
}