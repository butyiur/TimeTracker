export type Role = 'Employee' | 'HR' | 'Admin';

export type AppNavItem = {
  label: string;
  path: string;
  roles?: Role[];       // ha nincs, mindenki látja
  disabled?: boolean;   // ha még nincs kész
};

export type AppNavSection = {
  label: string;
  items: AppNavItem[];
};

export const APP_NAV: AppNavSection[] = [
  {
    label: 'Áttekintés',
    items: [
      // ide az a route kerül, ami role alapján továbbdob (lásd lent /home)
      { label: 'Áttekintés', path: '/overview', roles: ['Employee', 'HR', 'Admin'] },
    ],
  },

  {
    label: 'Időnyilvántartás',
    items: [
      { label: 'Időnyilvántartás', path: '/calendar', roles: ['Employee'] },
    ],
  },

  {
    label: 'Jelentések',
    items: [
      { label: 'Jelentések', path: '/reports', roles: ['HR', 'Admin'] },
    ],
  },

  {
    label: 'HR',
    items: [
      { label: 'Projektek és feladatok', path: '/hr/projects', roles: ['HR', 'Admin'] },
    ],
  },

  {
    label: 'Fiók',
    items: [
      { label: 'Profilom', path: '/profile', roles: ['Employee', 'HR', 'Admin'] },
      { label: 'Beállítások', path: '/settings', roles: ['Employee', 'HR', 'Admin'] },
    ],
  },

  {
    label: 'Admin',
    items: [
      { label: 'Felhasználók', path: '/admin/users', roles: ['Admin', 'HR'] },

      { label: 'Rendszerlogok', path: '/admin/system-logs', roles: ['Admin'] },
      { label: 'Biztonság', path: '/admin/security', roles: ['Admin'] },
    ],
  },
];