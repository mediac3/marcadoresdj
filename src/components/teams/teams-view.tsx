'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, UsersRound, ChevronDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, type Team, type Sport } from '@/lib/store';
import { apiGet } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { CreateTeamModal } from './create-team-modal';
import { ImportTeamsModal } from './import-teams-modal';
import { GENDER_OPTIONS, AGE_CATEGORY_OPTIONS } from '@/lib/constants';

/* ── Sport filter options ─────────────────────────────────────────────────── */

const SPORT_FILTERS = [
  { value: 'all', label: 'Todos los Deportes' },
  { value: 'Fútbol', label: '⚽ Fútbol' },
  { value: 'Baloncesto', label: '🏀 Baloncesto' },
  { value: 'Microfútbol', label: '⚽ Microfútbol' },
];

/* ── Helper: get initials from name ────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ── Team Card ────────────────────────────────────────────────────────────── */

function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  const sportName = team.sport?.name || '—';
  const sportIcon = team.sport?.icon || '🏆';
  const playerCount = team._count?.players ?? team.players?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border p-4 transition-all duration-150 hover:scale-[1.01] cursor-pointer"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-custom)',
        boxShadow: 'var(--shadow)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-custom)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
    >
      <div className="flex items-start gap-3">
        {/* Logo / Placeholder */}
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--accent)',
          }}
        >
          {team.logo ? (
            <img
              src={team.logo}
              alt={team.name}
              className="size-10 rounded-md object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.textContent = getInitials(team.name);
              }}
            />
          ) : (
            getInitials(team.name)
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {team.name}
          </h3>
          {team.shortName && (
            <p
              className="truncate text-xs mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              {team.shortName}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--accent)',
              }}
            >
              <span>{sportIcon}</span>
              {sportName}
            </span>
            {(team.gender && team.gender !== 'Mixto') && (
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'rgba(225, 29, 72, 0.15)',
                  color: 'var(--accent)',
                }}
              >
                {team.gender}
              </span>
            )}
            {(team.ageCategory && team.ageCategory !== 'Libre') && (
              <span
                className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {team.ageCategory}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <UsersRound className="size-3" />
              {playerCount} {playerCount === 1 ? 'jugador' : 'jugadores'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── Loading skeleton cards ───────────────────────────────────────────────── */

function TeamCardSkeleton() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-custom)',
      }}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────────── */

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="mb-4 flex size-20 items-center justify-center rounded-full text-4xl"
        style={{ background: 'var(--bg-secondary)' }}
        aria-hidden="true"
      >
        🏟️
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {hasFilter ? 'Sin resultados' : 'No hay equipos registrados'}
      </h3>
      <p className="mt-1 text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
        {hasFilter
          ? 'Intenta con otro filtro o término de búsqueda.'
          : 'Crea tu primer equipo para comenzar a gestionar tus marcadores.'}
      </p>
    </div>
  );
}

/* ── Main View ────────────────────────────────────────────────────────────── */

export function TeamsView() {
  const navigate = useAppStore((s) => s.navigate);
  const isCreatorOrAdmin = useAppStore((s) => s.isCreatorOrAdmin);

  const [teams, setTeams] = useState<Team[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [ageCategoryFilter, setAgeCategoryFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { toast } = useToast();

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ success: boolean; teams: Team[] }>('/api/teams');
      setTeams(res.teams);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar los equipos';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSports = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; sports: Sport[] }>('/api/sports');
      setSports(res.sports);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchSports();
  }, [fetchTeams, fetchSports]);

  /* Build dynamic sport filter from API data */
  const sportFilterOptions = useMemo(() => {
    if (sports.length === 0) return SPORT_FILTERS;
    return [
      { value: 'all', label: 'Todos los Deportes' },
      ...sports.map((s) => ({ value: s.id, label: `${s.icon} ${s.name}` })),
    ];
  }, [sports]);

  /* Filtered teams */
  const filteredTeams = useMemo(() => {
    let result = teams;

    // Filter by sport
    if (sportFilter !== 'all') {
      result = result.filter((t) => t.sportId === sportFilter || t.sport?.name === sportFilter);
    }

    // Filter by gender
    if (genderFilter !== 'all') {
      result = result.filter((t) => t.gender === genderFilter);
    }

    // Filter by age category
    if (ageCategoryFilter !== 'all') {
      result = result.filter((t) => t.ageCategory === ageCategoryFilter);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.shortName && t.shortName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [teams, sportFilter, genderFilter, ageCategoryFilter, search]);

  function handleTeamClick(team: Team) {
    navigate({ page: 'TEAM_DETAIL', teamId: team.id });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Equipos
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Gestiona los equipos y sus jugadores
          </p>
        </div>
        {isCreatorOrAdmin() && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setImportOpen(true)}
              variant="outline"
              className="h-10 text-sm font-semibold"
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
            >
              <Upload className="size-4" />
              Importar
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-10 text-sm font-semibold"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              <Plus className="size-4" />
              Crear Equipo
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <Input
            placeholder="Buscar equipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Sport Filter */}
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger
            className="h-10 w-full sm:w-[200px]"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          >
            <SelectValue placeholder="Filtrar por deporte" />
            <ChevronDown className="size-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            {sportFilterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Gender Filter */}
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger
            className="h-10 w-full sm:w-[160px]"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          >
            <SelectValue placeholder="Género" />
            <ChevronDown className="size-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Géneros</SelectItem>
            {GENDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Age Category Filter */}
        <Select value={ageCategoryFilter} onValueChange={setAgeCategoryFilter}>
          <SelectTrigger
            className="h-10 w-full sm:w-[180px]"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          >
            <SelectValue placeholder="Categoría" />
            <ChevronDown className="size-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Categorías</SelectItem>
            {AGE_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-sm" style={{ color: 'var(--accent-red)' }}>
            {error}
          </p>
          <Button
            variant="outline"
            onClick={fetchTeams}
            className="mt-3"
            style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
          >
            Reintentar
          </Button>
        </div>
      ) : filteredTeams.length === 0 ? (
        <EmptyState hasFilter={sportFilter !== 'all' || genderFilter !== 'all' || ageCategoryFilter !== 'all' || search.trim() !== ''} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => handleTeamClick(team)}
            />
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <CreateTeamModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchTeams}
      />

      {/* Import Teams Modal */}
      <ImportTeamsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchTeams}
      />
    </div>
  );
}