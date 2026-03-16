import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/shell/app-shell.component';
import { LoginComponent } from './core/auth/login.component';
import { RegisterComponent } from './core/auth/register.component';
import { ForgotPasswordComponent } from './core/auth/forgot-password.component';
import { ResetPasswordComponent } from './core/auth/reset-password.component';
import { ConfirmEmailComponent } from './core/auth/confirm-email.component';
import { AuthCallbackComponent } from './core/auth/auth-callback.component';
import { ForbiddenPage } from './core/auth/forbidden.page';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

const ROLES_ALL = ['Employee', 'HR', 'Admin'];
const ROLES_EMPLOYEE = ['Employee'];
const ROLES_HR_ADMIN = ['HR', 'Admin'];
const ROLES_ADMIN = ['Admin'];

export const routes: Routes = [
  // Public
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'confirm-email', component: ConfirmEmailComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'forbidden', component: ForbiddenPage },

  // Protected shell
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard], // csak azt garantálja, hogy van token
    children: [
      // Role-alapú belépési pont (Figma: Áttekintés)
      {
        path: 'overview',
        loadComponent: () =>
          import('./core/auth/overview-redirect.page').then(m => m.OverviewRedirectPage),
        canActivate: [roleGuard], // itt már tudunk role szerint dönteni
        data: { roles: ROLES_ALL },
      },

      // EMPLOYEE dashboard (külön, figma alapján)
      {
        path: 'employee/overview',
        canActivate: [roleGuard],
        data: { roles: ROLES_ALL },
        loadComponent: () =>
          import('./features/employee/pages/employee-overview.page').then(m => m.EmployeeOverviewPage),
      },

      // HR dashboard
      {
        path: 'hr/overview',
        canActivate: [roleGuard],
        data: { roles: ROLES_HR_ADMIN },
        loadComponent: () =>
          import('./features/hr/pages/hr-overview.page').then(m => m.HrOverviewPage),
      },
      {
        path: 'hr/projects',
        canActivate: [roleGuard],
        data: { roles: ROLES_HR_ADMIN },
        loadComponent: () =>
          import('./features/hr/pages/hr-projects.page').then(m => m.HrProjectsPage),
      },

      // ADMIN dashboard
      {
        path: 'admin/overview',
        canActivate: [roleGuard],
        data: { roles: ROLES_ADMIN },
        loadComponent: () =>
          import('./features/admin/pages/admin-overview.page').then(m => m.AdminOverviewPage),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: ROLES_HR_ADMIN },
        loadComponent: () =>
          import('./features/admin/pages/admin-users.page').then(m => m.AdminUsersPage),
      },

      // Shared pages
      {
        path: 'time',
        redirectTo: 'calendar',
        pathMatch: 'full',
      },
      {
        path: 'calendar',
        canActivate: [roleGuard],
        data: { roles: ROLES_EMPLOYEE },
        loadComponent: () =>
          import('./features/calendar/pages/calendar.page').then(m => m.CalendarPage),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: ROLES_HR_ADMIN },
        loadComponent: () =>
          import('./features/reports/pages/reports.page').then(m => m.ReportsPage),
      },
      {
        path: 'reports/employees',
        canActivate: [roleGuard],
        data: { roles: ROLES_HR_ADMIN },
        loadComponent: () =>
          import('./features/reports/pages/employee-reports.page').then(m => m.EmployeeReportsPage),
      },
      {
        path: 'profile',
        canActivate: [roleGuard],
        data: { roles: ROLES_ALL },
        loadComponent: () =>
          import('./features/profile/pages/profile.page').then(m => m.ProfilePage),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ROLES_ALL },
        loadComponent: () =>
          import('./features/settings/pages/settings.page').then(m => m.SettingsPage),
      },
      {
        path: 'admin/security',
        canActivate: [roleGuard],
        data: { roles: ROLES_ADMIN },
        loadComponent: () =>
          import('./features/settings/pages/admin-security.page').then(m => m.AdminSecurityPage),
      },
      {
        path: 'admin/system-logs',
        canActivate: [roleGuard],
        data: { roles: ROLES_ADMIN },
        loadComponent: () =>
          import('./features/admin/pages/admin-system-logs.page').then(m => m.AdminSystemLogsPage),
      },

      // Default
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: '**', redirectTo: 'overview' },
    ],
  },
];