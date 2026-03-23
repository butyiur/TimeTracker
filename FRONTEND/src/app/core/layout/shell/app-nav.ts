export type Role = 'Employee' | 'HR' | 'Admin';

export type AppNavItem = {
  label: string;
  path: string;
  roles?: Role[];
  disabled?: boolean;
};

export type AppNavSection = {
  label: string;
  items: AppNavItem[];
};

export const APP_NAV: AppNavSection[] = [
  {
    label: 'ÁTTEKINTÉS',
    items: [{ label: 'Áttekintés', path: '/overview', roles: ['Employee', 'HR', 'Admin'] }],
  },
  {
    label: 'IDŐNYILVÁNTARTÁS',
    items: [{ label: 'Időnyilvántartás', path: '/calendar', roles: ['Employee'] }],
  },
  {
    label: 'HR',
    items: [
      { label: 'Felhasználók', path: '/admin/users', roles: ['HR'] },
      { label: 'Projektek és feladatok', path: '/hr/projects', roles: ['HR', 'Admin'] },
      { label: 'Jelentések', path: '/reports', roles: ['HR', 'Admin'] },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { label: 'Felhasználók', path: '/admin/users', roles: ['Admin'] },
      { label: 'Rendszerlogok', path: '/admin/system-logs', roles: ['Admin'] },
      { label: 'Biztonság', path: '/admin/security', roles: ['Admin'] },
    ],
  },
  {
    label: 'FIÓK',
    items: [
      { label: 'Profilom', path: '/profile', roles: ['Employee', 'HR', 'Admin'] },
      { label: 'Beállítások', path: '/settings', roles: ['Employee', 'HR', 'Admin'] },
    ],
  },
];
