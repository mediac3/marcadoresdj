import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  username: string;
  name: string | null;
  role: 'ADMIN' | 'CREATOR' | 'INITIATOR';
}

interface SportAction {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  defaultValue: number;
  sportId: string;
}

interface Sport {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  actions: SportAction[];
}

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  photo: string | null;
  nickname: string | null;
  birthDate: string | null;
  nationality: string | null;
  height: string | null;
  weight: string | null;
  teamId: string;
}

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  sportId: string;
  gender: string;
  ageCategory: string;
  sport?: Sport;
  players?: Player[];
  _count?: { players: number };
}

interface EventAction {
  id: string;
  eventId: string;
  playerId: string | null;
  player?: Player;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionColor: string;
  minute: number | null;
  value: number;
  half: string | null;
  userId: string;
  createdAt: string;
}

interface Comment {
  id: string;
  eventId: string;
  content: string;
  isAI: boolean;
  actionId: string | null;
  userId: string | null;
  user?: { id: string; username: string; name: string | null } | null;
  createdAt: string;
}

interface SportEvent {
  id: string;
  name: string | null;
  sportId: string;
  sport?: Sport;
  teamAId: string;
  teamA?: Team;
  teamBId: string;
  teamB?: Team;
  location: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  currentHalf: string | null;
  elapsedSeconds: number;
  scoreA: number;
  scoreB: number;
  streamingUrl: string | null;
  streamingKey: string | null;
  isPublic: boolean;
  createdById: string;
  tournamentName: string | null;
  phase: string | null;
  phaseOrder: number;
  actions?: EventAction[];
  comments?: Comment[];
  createdAt: string;
}

// ── App View types for SPA routing ──────────────────────────────────────────

type AppView =
  | { page: 'LOGIN' }
  | { page: 'DASHBOARD' }
  | { page: 'ADMIN_USERS' }
  | { page: 'ADMIN_SPORTS' }
  | { page: 'ADMIN_LOCATIONS' }
  | { page: 'ADMIN_ADS' }
  | { page: 'ADMIN_ANALYTICS' }
  | { page: 'ADMIN_PUBLICATIONS' }
  | { page: 'ADMIN_SETTINGS' }
  | { page: 'ADMIN_PERMISSIONS' }
  | { page: 'ADMIN_TOURNAMENTS' }
  | { page: 'ADMIN_TERMS' }
  | { page: 'TEAMS' }
  | { page: 'TEAM_DETAIL'; teamId: string }
  | { page: 'CREATE_EVENT' }
  | { page: 'EVENT_LIST' }
  | { page: 'SCORING'; eventId: string }
  | { page: 'EVENT_REPORT'; eventId: string }
  | { page: 'PUBLIC_VIEW' };

type ThemeName = 'flashscore-dark' | 'light' | 'green-field';

// ── Store interface ──────────────────────────────────────────────────────────

interface AppState {
  // Auth
  user: User | null;
  token: string | null;

  // Navigation
  currentView: AppView;

  // Theme
  theme: ThemeName;

  // Data caches
  sports: Sport[];
  events: SportEvent[];
  currentEvent: SportEvent | null;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  navigate: (view: AppView) => void;
  setTheme: (theme: ThemeName) => void;
  setSports: (sports: Sport[]) => void;
  setEvents: (events: SportEvent[]) => void;
  setCurrentEvent: (event: SportEvent | null) => void;

  // Helpers
  isAdmin: () => boolean;
  isCreatorOrAdmin: () => boolean;
  canCreateUsers: () => boolean;
}

// ── Hydrate from localStorage ────────────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

const TOKEN_KEY = 'marcadoresdj-token';
const USER_KEY = 'marcadoresdj-user';
const THEME_KEY = 'marcadoresdj-theme';

// ── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  user: null,
  token: null,

  // Navigation
  currentView: { page: 'PUBLIC_VIEW' },

  // Theme
  theme: 'flashscore-dark',

  // Data caches
  sports: [],
  events: [],
  currentEvent: null,

  // ── Actions ──────────────────────────────────────────────────────────────

  setAuth: (user: User, token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ user, token, currentView: { page: 'DASHBOARD' } });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    set({
      user: null,
      token: null,
      currentView: { page: 'LOGIN' },
      currentEvent: null,
      events: [],
    });
  },

  navigate: (view: AppView) => {
    set({ currentView: view });
  },

  setTheme: (theme: ThemeName) => {
    saveToStorage(THEME_KEY, theme);
    set({ theme });
  },

  setSports: (sports: Sport[]) => {
    set({ sports });
  },

  setEvents: (events: SportEvent[]) => {
    set({ events });
  },

  setCurrentEvent: (event: SportEvent | null) => {
    set({ currentEvent: event });
  },

  // ── Helpers ──────────────────────────────────────────────────────────────

  isAdmin: () => {
    return get().user?.role === 'ADMIN';
  },

  isCreatorOrAdmin: () => {
    const role = get().user?.role;
    return role === 'ADMIN' || role === 'CREATOR';
  },

  canCreateUsers: () => {
    return get().user?.role === 'ADMIN';
  },
}));

// ── Hydration: restore persisted state on client side ────────────────────────

if (typeof window !== 'undefined') {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = loadFromStorage<User | null>(USER_KEY, null);
  const theme = loadFromStorage<ThemeName>(THEME_KEY, 'flashscore-dark');

  useAppStore.setState({
    ...(token && user
      ? { user, token, currentView: { page: 'DASHBOARD' } as AppView }
      : {}),
    theme,
  });
}

// ── Re-export types ──────────────────────────────────────────────────────────

export type {
  User,
  Sport,
  SportAction,
  Team,
  Player,
  EventAction,
  Comment,
  SportEvent,
  AppView,
  ThemeName,
};