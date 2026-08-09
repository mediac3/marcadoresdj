'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Globe,
  UserCog,
  Settings,
  LogOut,
  KeyRound,
  Moon,
  Sun,
  Leaf,
  MapPin,
  Megaphone,
  BarChart3,
  Newspaper,
  Shield,
  SlidersHorizontal as SlidersIcon,
  FileText,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoginForm } from '@/components/auth/login-form';
import { ChangePasswordModal } from '@/components/layout/change-password-modal';
import { ScoringView } from '@/components/scoring/scoring-view';
import { TeamsView } from '@/components/teams/teams-view';
import { TeamDetailView } from '@/components/teams/team-detail-view';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { UsersPanel } from '@/components/admin/users-panel';
import { SportsPanel } from '@/components/admin/sports-panel';
import { LocationsPanel } from '@/components/admin/locations-panel';
import { AdsPanel } from '@/components/admin/ads-panel';
import { AnalyticsPanel } from '@/components/admin/analytics-panel';
import { SettingsPanel } from '@/components/admin/settings-panel';
import { PublicationsPanel } from '@/components/admin/publications-panel';
import { PermissionsPanel } from '@/components/admin/permissions-panel';
import { TermsPanel } from '@/components/admin/terms-panel';
import { TournamentsPanel } from '@/components/admin/tournaments-panel';
import { EventWizard } from '@/components/events/event-wizard';
import { EventListView } from '@/components/events/event-list-view';
import { EventReportView } from '@/components/events/event-report-view';
import { PublicView } from '@/components/public/public-view';
import { useAppStore, type ThemeName, type AppView } from '@/lib/store';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface NavItem {
  label: string;
  icon: React.ElementType;
  view: AppView;
  adminOnly?: boolean;
  sectionKey?: string; // maps to RoleSectionPermission.section
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: { page: 'DASHBOARD' } },
  { label: 'Eventos', icon: Trophy, view: { page: 'EVENT_LIST' }, sectionKey: 'events' },
  { label: 'Equipos', icon: Users, view: { page: 'TEAMS' }, sectionKey: 'teams' },
  { label: 'Público', icon: Globe, view: { page: 'PUBLIC_VIEW' } },
  { label: 'Usuarios', icon: UserCog, view: { page: 'ADMIN_USERS' }, adminOnly: true, sectionKey: 'users' },
  { label: 'Deportes', icon: Settings, view: { page: 'ADMIN_SPORTS' }, adminOnly: true, sectionKey: 'sports' },
  { label: 'Ubicaciones', icon: MapPin, view: { page: 'ADMIN_LOCATIONS' }, adminOnly: true, sectionKey: 'locations' },
  { label: 'Publicidad', icon: Megaphone, view: { page: 'ADMIN_ADS' }, adminOnly: true, sectionKey: 'ads' },
  { label: 'Analíticas', icon: BarChart3, view: { page: 'ADMIN_ANALYTICS' }, adminOnly: true, sectionKey: 'analytics' },
  { label: 'Publicaciones', icon: Newspaper, view: { page: 'ADMIN_PUBLICATIONS' }, adminOnly: true, sectionKey: 'publications' },
  { label: 'Ajustes', icon: SlidersIcon, view: { page: 'ADMIN_SETTINGS' }, adminOnly: true, sectionKey: 'settings' },
  { label: 'Torneos', icon: Trophy, view: { page: 'ADMIN_TOURNAMENTS' }, adminOnly: true, sectionKey: 'tournaments' },
  { label: 'Términos', icon: FileText, view: { page: 'ADMIN_TERMS' }, adminOnly: true, sectionKey: 'terms' },
  { label: 'Permisos', icon: Shield, view: { page: 'ADMIN_PERMISSIONS' }, adminOnly: true, sectionKey: 'permissions' },
];

const THEME_OPTIONS: { value: ThemeName; icon: React.ReactNode; label: string }[] = [
  { value: 'flashscore-dark', icon: <Moon className="size-4" />, label: 'Oscuro' },
  { value: 'light', icon: <Sun className="size-4" />, label: 'Claro' },
  { value: 'green-field', icon: <Leaf className="size-4" />, label: 'Cancha Verde' },
];

/* ── Placeholder View ──────────────────────────────────────────────────────── */

function PlaceholderView({ title }: { title: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-6"
      style={{ color: 'var(--text-muted)' }}
    >
      <div className="text-center">
        <p className="text-4xl mb-3">🏆</p>
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Próximamente
        </p>
      </div>
    </div>
  );
}

/* ── View Router ───────────────────────────────────────────────────────────── */

function ViewRouter() {
  const currentView = useAppStore((s) => s.currentView);

  switch (currentView.page) {
    case 'DASHBOARD':
      return <DashboardView />;
    case 'EVENT_LIST':
      return <EventListView />;
    case 'TEAMS':
      return <TeamsView />;
    case 'TEAM_DETAIL':
      return <TeamDetailView />;
    case 'CREATE_EVENT':
      return <EventWizard />;
    case 'SCORING':
      return <ScoringView />;
    case 'EVENT_REPORT':
      return <EventReportView />;
    case 'PUBLIC_VIEW':
      return <PublicView />;
    case 'ADMIN_USERS':
      return <UsersPanel />;
    case 'ADMIN_SPORTS':
      return <SportsPanel />;
    case 'ADMIN_LOCATIONS':
      return <LocationsPanel />;
    case 'ADMIN_ADS':
      return <AdsPanel />;
    case 'ADMIN_ANALYTICS':
      return <AnalyticsPanel />;
    case 'ADMIN_PUBLICATIONS':
      return <PublicationsPanel />;
    case 'ADMIN_SETTINGS':
      return <SettingsPanel />;
    case 'ADMIN_PERMISSIONS':
      return <PermissionsPanel />;
    case 'ADMIN_TOURNAMENTS':
      return <TournamentsPanel />;
    case 'ADMIN_TERMS':
      return <TermsPanel />;
    default:
      return <PlaceholderView title="Página no encontrada" />;
  }
}

/* ── Main Shell ────────────────────────────────────────────────────────────── */

export function AppShell() {
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const currentView = useAppStore((s) => s.currentView);
  const setTheme = useAppStore((s) => s.setTheme);
  const logout = useAppStore((s) => s.logout);
  const navigate = useAppStore((s) => s.navigate);
  const isAdmin = useAppStore((s) => s.isAdmin);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());

  // Fetch user permissions on mount for non-admin users
  useEffect(() => {
    if (!user || user.role === 'ADMIN') return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('marcadoresdj-token') : null;
    if (!token) return;
    fetch('/api/my-permissions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.permissions)) {
          // Collect sections where canView is true
          const sections = new Set<string>();
          for (const p of data.permissions) {
            if (p.canView) sections.add(p.section);
          }
          setUserPermissions(sections);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // Admin-only items: only ADMIN sees them (unless permission-based)
    if (item.adminOnly) {
      if (!isAdmin()) return false;
      // ADMIN sees everything, including adminOnly items
      return true;
    }
    // Non-admin items with a sectionKey: check dynamic permissions for non-admin
    if (item.sectionKey && !isAdmin()) {
      return userPermissions.has(item.sectionKey);
    }
    // Items without sectionKey (Dashboard, Público) are always visible to authenticated users
    return true;
  });

  const initials = user
    ? (user.name || user.username)
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  // Not authenticated → show public view or login
  // Check for login flag (set by public view's "Iniciar Sesión" button)
  const showLogin = typeof window !== 'undefined' && localStorage.getItem('marcadoresdj-show-login') === '1';

  if (showLogin && typeof window !== 'undefined') {
    localStorage.removeItem('marcadoresdj-show-login');
  }

  if (!user) {
    if (showLogin || currentView.page === 'LOGIN') {
      return <LoginForm />;
    }
    return <PublicView />;
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate({ page: 'DASHBOARD' })}
          className="flex items-center gap-2"
        >
          <span className="text-xl" aria-hidden="true">🏆</span>
          <span
            className="text-base font-bold tracking-tight hidden sm:inline"
            style={{ color: 'var(--text-primary)' }}
          >
            MarcadoresDJ
          </span>
        </button>

        {/* Right side: Theme switcher + User */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <div
            className="flex items-center gap-0.5 rounded-lg p-1"
            style={{ background: 'var(--bg-card)' }}
          >
            {THEME_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setTheme(opt.value)}
                style={{
                  background: theme === opt.value ? 'var(--accent)' : 'transparent',
                  color: theme === opt.value ? '#fff' : 'var(--text-secondary)',
                  borderRadius: '6px',
                }}
                title={opt.label}
                aria-label={`Tema: ${opt.label}`}
              >
                {opt.icon}
              </Button>
            ))}
          </div>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 h-10"
              >
                <Avatar className="size-7">
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{
                      background: 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="hidden sm:inline text-sm max-w-[120px] truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {user.name || user.username}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user.name || user.username}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    @{user.username} · {user.role}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="size-4" />
                Cambiar Contraseña
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body: Sidebar (desktop) + Content + Bottom Nav (mobile) ──────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className="hidden lg:flex flex-col w-56 shrink-0 border-r overflow-y-auto"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <nav className="flex flex-col gap-1 p-3">
            {visibleNavItems.map((item) => {
              const active = currentView.page === item.view.page;
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.view)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]"
                  style={{
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          <ViewRouter />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t lg:hidden"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
          // Safe area for iOS
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {visibleNavItems.slice(0, 4).map((item) => {
          const active = currentView.page === item.view.page;
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.view)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] pt-1 transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}