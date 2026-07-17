'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Users,
  X,
  AlertCircle,
  Video,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  Trophy,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, type Sport, type Team } from '@/lib/store';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { TOURNAMENT_PHASES, PHASE_ORDER } from '@/lib/constants';
import { LocationSelector } from '@/components/locations/location-selector';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface NewPlayer {
  name: string;
  number: number | '';
  position: string;
}

interface TournamentOption {
  id: string;
  name: string;
  logo: string | null;
  phases: Array<{ id: string; name: string; type: string; order: number }>;
}

interface PlayerFormData {
  name: string;
  number: string;
  position: string;
}

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  selectedSport: Sport | null;
  teamA: Team | null;
  teamB: Team | null;
  eventName: string;
  location: string;
  countryId: string | null;
  departmentId: string | null;
  cityId: string | null;
  scheduledAt: string;
  isPublic: boolean;
  tournamentName: string;          // legacy / manual fallback
  phase: string;                   // legacy / manual fallback
  tournamentId: string | null;      // relational: selected tournament
  tournamentPhaseId: string | null; // relational: selected phase
  useManualTournament: boolean;     // true = manual input fallback
  creatingTeamA: boolean;
  creatingTeamB: boolean;
  newTeamAName: string;
  newTeamAShortName: string;
  newTeamALogo: string;
  newTeamAPlayers: NewPlayer[];
  showTeamAPlayers: boolean;
  newTeamBName: string;
  newTeamBShortName: string;
  newTeamBLogo: string;
  newTeamBPlayers: NewPlayer[];
  showTeamBPlayers: boolean;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  searchTeamA: string;
  searchTeamB: string;
  streamingUrl: string;
}

const POSITIONS_BY_SPORT: Record<string, string[]> = {
  Fútbol: ['Portero', 'Defensa', 'Lateral', 'Mediocampista', 'Delantero'],
  Baloncesto: ['Base', 'Escolta', 'Alero', 'Ala-pívot', 'Pívot'],
  Microfútbol: ['Portero', 'Cierre', 'Ala', 'Pívot'],
};

const STEP_LABELS = ['Deporte', 'Equipo Local', 'Equipo Visitante', 'Detalles', 'Resumen'];

const INITIAL_STATE: WizardState = {
  step: 1,
  selectedSport: null,
  teamA: null,
  teamB: null,
  eventName: '',
  location: '',
  countryId: null,
  departmentId: null,
  cityId: null,
  scheduledAt: '',
  isPublic: true,
  tournamentName: '',
  phase: '',
  tournamentId: null,
  tournamentPhaseId: null,
  useManualTournament: false,
  creatingTeamA: false,
  creatingTeamB: false,
  newTeamAName: '',
  newTeamAShortName: '',
  newTeamALogo: '',
  newTeamAPlayers: [],
  showTeamAPlayers: false,
  newTeamBName: '',
  newTeamBShortName: '',
  newTeamBLogo: '',
  newTeamBPlayers: [],
  showTeamBPlayers: false,
  loading: true,
  submitting: false,
  error: null,
  searchTeamA: '',
  searchTeamB: '',
  streamingUrl: '',
};

/* ── Progress Indicator ────────────────────────────────────────────────────── */

function ProgressIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-lg mx-auto mb-6">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = completedSteps.has(stepNum);
        const isCurrent = stepNum === currentStep;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 shrink-0"
                style={{
                  background: isCurrent || isCompleted ? 'var(--accent)' : 'var(--bg-card)',
                  color: isCurrent || isCompleted ? '#fff' : 'var(--text-muted)',
                  border: !isCurrent && !isCompleted ? '2px solid var(--border-custom)' : 'none',
                }}
              >
                {isCompleted ? <Check className="size-4" /> : stepNum}
              </div>
              <span
                className="text-[10px] font-medium hidden sm:block text-center leading-tight max-w-[70px]"
                style={{
                  color: isCurrent
                    ? 'var(--accent)'
                    : stepNum < currentStep
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                }}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 sm:mx-2 rounded-full transition-colors duration-200"
                style={{
                  background: stepNum < currentStep ? 'var(--accent)' : 'var(--border-custom)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sport Card ────────────────────────────────────────────────────────────── */

function SportCard({
  sport,
  selected,
  onClick,
}: {
  sport: Sport;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all duration-150 min-h-[100px] cursor-pointer"
      style={{
        background: selected ? 'var(--accent)' : 'var(--bg-card)',
        borderColor: selected ? 'var(--accent)' : 'var(--border-custom)',
        color: selected ? '#fff' : 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.background = 'var(--bg-card-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--border-custom)';
          e.currentTarget.style.background = 'var(--bg-card)';
        }
      }}
    >
      <span className="text-3xl" aria-hidden="true">{sport.icon}</span>
      <span className="text-sm font-semibold">{sport.name}</span>
    </button>
  );
}

/* ── Inline Player Form (controlled) ───────────────────────────────────────── */

function InlinePlayerForm({
  positions,
  form,
  onFormChange,
  onAdd,
}: {
  positions: string[];
  form: PlayerFormData;
  onFormChange: (form: PlayerFormData) => void;
  onAdd: (player: NewPlayer) => void;
}) {
  const canAdd = form.name.trim() && form.number !== '' && !isNaN(Number(form.number)) && form.position;

  function handleAdd() {
    if (!canAdd) return;
    onAdd({
      name: form.name.trim(),
      number: Number(form.number),
      position: form.position,
    });
    onFormChange({ name: '', number: '', position: positions[0] || '' });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && canAdd) {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div
      className="rounded-lg border p-3 space-y-3"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-custom)',
      }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Nuevo Jugador
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          onKeyDown={handleKeyDown}
          className="h-9 text-sm"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        />
        <Input
          placeholder="#"
          value={form.number}
          onChange={(e) => onFormChange({ ...form, number: e.target.value })}
          onKeyDown={handleKeyDown}
          className="h-9 text-sm"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="flex gap-2">
          <select
            value={form.position}
            onChange={(e) => onFormChange({ ...form, position: e.target.value })}
            className="flex-1 h-9 rounded-md text-sm px-2"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-custom)',
            }}
          >
            {positions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Button
            size="icon"
            disabled={!canAdd}
            className="h-9 w-9 shrink-0"
            style={{
              background: canAdd ? 'var(--accent)' : 'var(--bg-card)',
              color: canAdd ? '#fff' : 'var(--text-muted)',
            }}
            onClick={handleAdd}
            type="button"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Team Selection Step ───────────────────────────────────────────────────── */

function TeamSelectionStep({
  label,
  sport,
  selectedTeam,
  excludedTeamId,
  search,
  onSearchChange,
  onSelectTeam,
  creating,
  onCreateToggle,
  newTeamName,
  onNewTeamNameChange,
  newTeamShortName,
  onNewTeamShortNameChange,
  newTeamLogo,
  onNewTeamLogoChange,
  newPlayers,
  showPlayers,
  onShowPlayersToggle,
  onAddPlayer,
  onRemovePlayer,
  onCreateTeam,
  creatingLoading,
  playerForm,
  onPlayerFormChange,
}: {
  label: string;
  sport: Sport | null;
  selectedTeam: Team | null;
  excludedTeamId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectTeam: (team: Team) => void;
  creating: boolean;
  onCreateToggle: () => void;
  newTeamName: string;
  onNewTeamNameChange: (v: string) => void;
  newTeamShortName: string;
  onNewTeamShortNameChange: (v: string) => void;
  newTeamLogo: string;
  onNewTeamLogoChange: (v: string) => void;
  newPlayers: NewPlayer[];
  showPlayers: boolean;
  onShowPlayersToggle: () => void;
  onAddPlayer: (player: NewPlayer) => void;
  onRemovePlayer: (idx: number) => void;
  onCreateTeam: () => void;
  creatingLoading: boolean;
  playerForm: PlayerFormData;
  onPlayerFormChange: (form: PlayerFormData) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const positions = useMemo(() => {
    if (!sport) return POSITIONS_BY_SPORT['Fútbol'];
    return POSITIONS_BY_SPORT[sport.name] || POSITIONS_BY_SPORT['Fútbol'];
  }, [sport]);

  const fetchTeams = useCallback(async () => {
    if (!sport) return;
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const res = await apiGet<{ success: boolean; teams: Team[] }>(
        `/api/teams?sportId=${sport.id}`
      );
      setTeams(res.teams);
    } catch {
      setTeamsError('Error al cargar equipos');
    } finally {
      setTeamsLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.toLowerCase().trim();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.shortName && t.shortName.toLowerCase().includes(q))
    );
  }, [teams, search]);

  const availableTeams = useMemo(() => {
    if (!excludedTeamId) return filteredTeams;
    return filteredTeams.filter((t) => t.id !== excludedTeamId);
  }, [filteredTeams, excludedTeamId]);

  /* ── Creating mode ─────────────────────────────────────────────────────── */
  if (creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Crear Nuevo Equipo
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateToggle}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre del Equipo *
            </Label>
            <Input
              value={newTeamName}
              onChange={(e) => onNewTeamNameChange(e.target.value)}
              placeholder="Ej: Los Tiburones"
              className="h-10"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre Corto
            </Label>
            <Input
              value={newTeamShortName}
              onChange={(e) => onNewTeamShortNameChange(e.target.value)}
              placeholder="Ej: TIB"
              maxLength={5}
              className="h-10"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            URL del Logo (opcional)
          </Label>
          <Input
            value={newTeamLogo}
            onChange={(e) => onNewTeamLogoChange(e.target.value)}
            placeholder="https://ejemplo.com/logo.png"
            className="h-10"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <Button
          onClick={onCreateTeam}
          disabled={!newTeamName.trim() || creatingLoading}
          className="h-10 text-sm font-semibold"
          style={{
            background: newTeamName.trim() && !creatingLoading ? 'var(--accent)' : 'var(--bg-card)',
            color: newTeamName.trim() && !creatingLoading ? '#fff' : 'var(--text-muted)',
          }}
        >
          {creatingLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {creatingLoading ? 'Creando...' : 'Crear Equipo'}
        </Button>

        {/* Player addition after team creation */}
        {selectedTeam && (
          <div className="mt-4 space-y-3">
            <Separator style={{ background: 'var(--border-custom)' }} />
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={onShowPlayersToggle}
                className="text-xs font-semibold"
                style={{
                  borderColor: 'var(--border-custom)',
                  color: showPlayers ? 'var(--accent)' : 'var(--text-secondary)',
                  background: showPlayers ? 'rgba(225, 29, 72, 0.1)' : 'transparent',
                }}
              >
                <Users className="size-3.5" />
                {showPlayers ? 'Ocultar Jugadores' : 'Agregar Jugadores'}
              </Button>
              {newPlayers.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                    background: 'rgba(225, 29, 72, 0.15)',
                  }}
                >
                  {newPlayers.length} jugador{newPlayers.length !== 1 ? 'es' : ''}
                </Badge>
              )}
            </div>

            {showPlayers && (
              <div className="space-y-3">
                <InlinePlayerForm
                  positions={positions}
                  form={playerForm}
                  onFormChange={onPlayerFormChange}
                  onAdd={onAddPlayer}
                />
                {newPlayers.length > 0 && (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {newPlayers.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-custom)',
                        }}
                      >
                        <span
                          className="text-sm font-bold tabular-nums w-6 text-center shrink-0"
                          style={{ color: 'var(--accent)' }}
                        >
                          {p.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {p.name}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {p.position}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          style={{ color: 'var(--accent-red)' }}
                          onClick={() => onRemovePlayer(idx)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Selection mode ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Seleccionar {label}
      </h2>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <Input
          placeholder="Buscar equipo..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-10"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {teamsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : teamsError ? (
        <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
          <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{teamsError}</p>
        </div>
      ) : availableTeams.length === 0 ? (
        <div className="text-center py-8">
          <Users className="size-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay equipos disponibles para {sport?.name}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
          {availableTeams.map((team) => {
            const isSelected = selectedTeam?.id === team.id;
            const playerCount = team._count?.players ?? 0;
            const showGender = team.gender && team.gender !== 'Mixto';
            const showAge = team.ageCategory && team.ageCategory !== 'Libre';
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelectTeam(team)}
                className="flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all duration-150 cursor-pointer"
                style={{
                  background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border-custom)',
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-custom)';
                }}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.15)' : 'var(--bg-secondary)',
                    color: isSelected ? '#fff' : 'var(--accent)',
                  }}
                >
                  {team.shortName?.toUpperCase().slice(0, 3) || team.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{team.name}</p>
                  <p
                    className="text-[11px]"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                  >
                    {playerCount} jugador{playerCount !== 1 ? 'es' : ''}
                    {showGender && <> · {team.gender}</>}
                    {showAge && <> · {team.ageCategory}</>}
                  </p>
                </div>
                {isSelected && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-10 text-sm font-semibold"
        style={{
          borderColor: 'var(--border-custom)',
          color: 'var(--accent)',
        }}
        onClick={onCreateToggle}
      >
        <Plus className="size-4" />
        Crear Nuevo Equipo
      </Button>
    </div>
  );
}

/* ── Step 4: Event Details ─────────────────────────────────────────────────── */

function EventDetailsStep({
  teamAName,
  teamBName,
  eventName,
  onEventNameChange,
  location,
  onLocationChange,
  countryId,
  departmentId,
  cityId,
  onCountryChange,
  onDepartmentChange,
  onCityChange,
  scheduledAt,
  onScheduledAtChange,
  isPublic,
  onIsPublicChange,
  // Tournament relational
  tournamentId,
  tournamentPhaseId,
  onTournamentChange,
  onPhaseChange,
  // Tournament manual fallback
  useManualTournament,
  onToggleManual,
  tournamentName,
  onTournamentNameChange,
  phase,
  onLegacyPhaseChange,
  // Data
  tournamentOptions,
  sportName,
  streamingUrl,
  onStreamingUrlChange,
}: {
  teamAName: string;
  teamBName: string;
  eventName: string;
  onEventNameChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  countryId: string | null;
  departmentId: string | null;
  cityId: string | null;
  onCountryChange: (v: string | null) => void;
  onDepartmentChange: (v: string | null) => void;
  onCityChange: (v: string | null) => void;
  scheduledAt: string;
  onScheduledAtChange: (v: string) => void;
  isPublic: boolean;
  onIsPublicChange: (v: boolean) => void;
  tournamentId: string | null;
  tournamentPhaseId: string | null;
  onTournamentChange: (id: string | null) => void;
  onPhaseChange: (id: string | null) => void;
  useManualTournament: boolean;
  onToggleManual: (v: boolean) => void;
  tournamentName: string;
  onTournamentNameChange: (v: string) => void;
  phase: string;
  onLegacyPhaseChange: (v: string) => void;
  tournamentOptions: TournamentOption[];
  sportName: string;
  streamingUrl: string;
  onStreamingUrlChange: (v: string) => void;
}) {
  const autoName = `${teamAName} vs ${teamBName}`;

  const selectedTournament = tournamentOptions.find((t) => t.id === tournamentId);
  const phaseOptions = selectedTournament?.phases || [];
  const selectedPhase = phaseOptions.find((p) => p.id === tournamentPhaseId);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Detalles del Evento
      </h2>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Nombre del Evento
        </Label>
        <Input
          value={eventName}
          onChange={(e) => onEventNameChange(e.target.value)}
          placeholder={autoName}
          className="h-10"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        />
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Si lo dejas vacío, se usará: &quot;{autoName}&quot;
        </p>
      </div>

      {/* Location: Country → Department → City */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <MapPin className="size-3.5" />
          Ubicación
        </Label>
        <LocationSelector
          countryId={countryId}
          departmentId={departmentId}
          cityId={cityId}
          onCountryChange={onCountryChange}
          onDepartmentChange={onDepartmentChange}
          onCityChange={onCityChange}
          defaultCountryCode="CO"
        />
      </div>

      {/* Venue name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Nombre del Lugar / Cancha
          <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
        </Label>
        <Input
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="Ej: Estadio Municipal, Cancha Sintética #3"
          className="h-10"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Calendar className="size-3.5" />
          Fecha y Hora
        </Label>
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          className="h-10"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
            colorScheme: 'dark',
          }}
        />
      </div>

      <div
        className="flex items-center justify-between rounded-lg border p-4"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <div className="flex items-center gap-3">
          {isPublic ? (
            <Eye className="size-5" style={{ color: 'var(--accent)' }} />
          ) : (
            <EyeOff className="size-5" style={{ color: 'var(--text-muted)' }} />
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Evento Público
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {isPublic
                ? 'Visible para todos los usuarios'
                : 'Solo visible para creadores y administradores'}
            </p>
          </div>
        </div>
        <Switch checked={isPublic} onCheckedChange={onIsPublicChange} />
      </div>

      {/* Tournament fields */}
      <Separator style={{ background: 'var(--border-custom)' }} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Trophy className="size-3.5" />
            Torneo
            <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
          </Label>
          {tournamentOptions.length > 0 && (
            <button
              type="button"
              onClick={() => onToggleManual(!useManualTournament)}
              className="text-[11px] underline"
              style={{ color: 'var(--accent)' }}
            >
              {useManualTournament ? 'Seleccionar de la lista' : 'Escribir manualmente'}
            </button>
          )}
        </div>

        {useManualTournament || tournamentOptions.length === 0 ? (
          /* ── Manual fallback: free-text inputs ── */
          <div className="space-y-3">
            <Input
              value={tournamentName}
              onChange={(e) => onTournamentNameChange(e.target.value)}
              placeholder="Ej: Copa DJ 2026, Liga Municipal..."
              className="h-10"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
            {tournamentName.trim() && (
              <Badge variant="outline" className="text-xs font-semibold" style={{ borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)', background: 'rgba(245, 158, 11, 0.15)' }}>
                🏆 {tournamentName.trim()}
              </Badge>
            )}
            {tournamentName.trim() && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Fase del Torneo
                </Label>
                <Select value={phase} onValueChange={onLegacyPhaseChange}>
                  <SelectTrigger className="w-full h-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}>
                    <SelectValue placeholder="Seleccionar fase (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOURNAMENT_PHASES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          /* ── Relational selector: Tournament → Phase ── */
          <div className="space-y-3">
            <Select
              value={tournamentId || '__none__'}
              onValueChange={(v) => onTournamentChange(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="w-full h-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}>
                <SelectValue placeholder="Seleccionar torneo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin torneo</SelectItem>
                {tournamentOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.logo && <span className="mr-1.5 inline-block">{t.logo.includes('://') ? '🏆' : t.logo}</span>}
                    {t.name}
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ({t.phases.length} fase{t.phases.length !== 1 ? 's' : ''})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tournament preview badge */}
            {selectedTournament && (
              <Badge variant="outline" className="text-xs font-semibold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(225, 29, 72, 0.1)' }}>
                🏆 {selectedTournament.name}
              </Badge>
            )}

            {/* Phase selector (dynamic based on tournament) */}
            {tournamentId && phaseOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Fase
                </Label>
                <Select
                  value={tournamentPhaseId || '__none__'}
                  onValueChange={(v) => onPhaseChange(v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="w-full h-10" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}>
                    <SelectValue placeholder="Seleccionar fase..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin fase</SelectItem>
                    {phaseOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Phase preview badge */}
            {selectedPhase && (
              <Badge variant="outline" className="text-xs" style={{ borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}>
                {selectedPhase.name}
              </Badge>
            )}

            {tournamentId && phaseOptions.length === 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Este torneo no tiene fases activas. Ve al módulo de Torneos para agregarlas.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Streaming URL */}
      <div
        className="rounded-lg border p-4 space-y-3"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <div className="flex items-center gap-2">
          <Video className="size-4" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Transmisión en Vivo
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            URL de Streaming
            <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
          </Label>
          <Input
            value={streamingUrl}
            onChange={(e) => onStreamingUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... o URL de embebido"
            className="h-10 text-sm"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div
          className="flex items-start gap-2 rounded-lg p-3"
          style={{
            background: 'rgba(225, 29, 72, 0.08)',
            border: '1px solid rgba(225, 29, 72, 0.2)',
          }}
        >
          <Info className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Ingresa la URL de un video de YouTube, Twitch, Vimeo u otro servicio de streaming.
            El video se mostrará embebido en la vista pública del evento. También puedes
            configurarlo después desde la edición del evento.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Step 5: Summary ───────────────────────────────────────────────────────── */

function SummaryStep({
  sport,
  teamA,
  teamB,
  teamAPlayerCount,
  teamBPlayerCount,
  eventName,
  autoEventName,
  location,
  locationLabel,
  scheduledAt,
  isPublic,
  tournamentName,
  phase,
  tournamentLabel,
  phaseLabel,
}: {
  sport: Sport | null;
  teamA: Team | null;
  teamB: Team | null;
  teamAPlayerCount: number;
  teamBPlayerCount: number;
  eventName: string;
  autoEventName: string;
  location: string;
  locationLabel: string;
  scheduledAt: string;
  isPublic: boolean;
  tournamentName: string;
  phase: string;
  tournamentLabel?: string;
  phaseLabel?: string;
}) {
  const displayName = eventName.trim() || autoEventName;

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'No definida';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Resumen del Evento
      </h2>

      <Card
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <CardContent className="p-4 md:p-6 space-y-5">
          {/* Tournament header */}
          {(tournamentLabel || tournamentName.trim()) && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-lg px-4 py-2" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                <Trophy className="size-5" style={{ color: 'var(--accent-yellow)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--accent-yellow)' }}>
                  {tournamentLabel || tournamentName.trim()}
                </span>
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Evento
            </p>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {displayName}
            </h3>
            {(phaseLabel || phase) && (
              <Badge
                variant="outline"
                className="text-xs font-semibold mt-2"
                style={{
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  background: 'rgba(225, 29, 72, 0.1)',
                }}
              >
                Fase: {phaseLabel || phase}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">{sport?.icon}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {sport?.name}
            </span>
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          <div className="flex items-center justify-center gap-4 md:gap-8">
            <div className="text-center flex-1 min-w-0">
              <div
                className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl text-lg font-bold"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--accent)',
                }}
              >
                {teamA?.shortName?.toUpperCase().slice(0, 3) || teamA?.name.slice(0, 2).toUpperCase() || '?'}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {teamA?.name || '—'}
              </p>
              {(teamA?.gender && teamA.gender !== 'Mixto') && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{teamA.gender}</p>
              )}
              {(teamA?.ageCategory && teamA.ageCategory !== 'Libre') && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{teamA.ageCategory}</p>
              )}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <Users className="size-3 inline" /> {teamAPlayerCount} jugador{teamAPlayerCount !== 1 ? 'es' : ''}
              </p>
            </div>

            <span className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>VS</span>

            <div className="text-center flex-1 min-w-0">
              <div
                className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl text-lg font-bold"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--accent)',
                }}
              >
                {teamB?.shortName?.toUpperCase().slice(0, 3) || teamB?.name.slice(0, 2).toUpperCase() || '?'}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {teamB?.name || '—'}
              </p>
              {(teamB?.gender && teamB.gender !== 'Mixto') && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{teamB.gender}</p>
              )}
              {(teamB?.ageCategory && teamB.ageCategory !== 'Libre') && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{teamB.ageCategory}</p>
              )}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <Users className="size-3 inline" /> {teamBPlayerCount} jugador{teamBPlayerCount !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          <div className="space-y-2.5">
            {(locationLabel || location) && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {locationLabel}{location && locationLabel ? ` · ${location}` : location || ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatDate(scheduledAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Eye className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />
              ) : (
                <EyeOff className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              )}
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {isPublic ? 'Evento Público' : 'Evento Privado'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Event Wizard ─────────────────────────────────────────────────────── */

export function EventWizard() {
  const navigate = useAppStore((s) => s.navigate);
  const { toast } = useToast();

  const [state, setState] = useState<WizardState>({ ...INITIAL_STATE });
  const [sports, setSports] = useState<Sport[]>([]);
  const [tournamentOptions, setTournamentOptions] = useState<TournamentOption[]>([]);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [playerFormA, setPlayerFormA] = useState<PlayerFormData>({ name: '', number: '', position: '' });
  const [playerFormB, setPlayerFormB] = useState<PlayerFormData>({ name: '', number: '', position: '' });

  /* ── Fetch sports ──────────────────────────────────────────────────────── */
  useEffect(() => {
    async function fetchSports() {
      try {
        const res = await apiGet<{ success: boolean; sports: Sport[] }>('/api/sports');
        setSports(res.sports);
      } catch {
        setState((s) => ({ ...s, error: 'Error al cargar deportes' }));
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    }
    fetchSports();
  }, []);

  /* ── Fetch tournaments when sport changes ─────────────────────────────── */
  useEffect(() => {
    if (!state.selectedSport) {
      setTournamentOptions([]);
      return;
    }
    let cancelled = false;
    async function fetchTournaments() {
      try {
        const res = await apiGet<{ success: boolean; tournaments: TournamentOption[] }>(
          `/api/tournaments?sportId=${state.selectedSport.id}&minimal=true`
        );
        if (!cancelled) {
          setTournamentOptions(res.tournaments || []);
          // Auto-reset tournament selection when sport changes
          setState((s) => ({ ...s, tournamentId: null, tournamentPhaseId: null }));
        }
      } catch {
        if (!cancelled) setTournamentOptions([]);
      }
    }
    fetchTournaments();
    return () => { cancelled = true; };
  }, [state.selectedSport]);

  /* ── Navigation ────────────────────────────────────────────────────────── */
  const canAdvance = useMemo(() => {
    switch (state.step) {
      case 1: return !!state.selectedSport;
      case 2: return !!state.teamA;
      case 3: return !!state.teamB;
      case 4: return true;
      case 5: return false;
      default: return false;
    }
  }, [state.step, state.selectedSport, state.teamA, state.teamB]);

  function goNext() {
    if (!canAdvance) return;
    setCompletedSteps((prev) => new Set([...prev, state.step]));
    setState((s) => ({ ...s, step: (s.step + 1) as WizardState['step'] }));
  }

  function goPrev() {
    if (state.step <= 1) return;
    setState((s) => ({ ...s, step: (s.step - 1) as WizardState['step'] }));
  }

  function handleCancel() {
    navigate({ page: 'DASHBOARD' });
  }

  /* ── Positions for current sport ───────────────────────────────────────── */
  const positions = useMemo(() => {
    if (!state.selectedSport) return POSITIONS_BY_SPORT['Fútbol'];
    return POSITIONS_BY_SPORT[state.selectedSport.name] || POSITIONS_BY_SPORT['Fútbol'];
  }, [state.selectedSport]);

  /* ── Team creation ─────────────────────────────────────────────────────── */
  async function handleCreateTeam(side: 'A' | 'B') {
    const name = side === 'A' ? state.newTeamAName : state.newTeamBName;
    const shortName = side === 'A' ? state.newTeamAShortName : state.newTeamBShortName;
    const logo = side === 'A' ? state.newTeamALogo : state.newTeamBLogo;
    const players = side === 'A' ? state.newTeamAPlayers : state.newTeamBPlayers;

    if (!name.trim() || !state.selectedSport) return;

    setState((s) => ({ ...s, submitting: true }));

    try {
      const res = await apiPost<{ success: boolean; team: Team }>('/api/teams', {
        name: name.trim(),
        shortName: shortName.trim() || null,
        logo: logo.trim() || null,
        sportId: state.selectedSport.id,
      });

      const team = res.team;

      // Add players in parallel
      if (players.length > 0) {
        await Promise.all(
          players.map((p) =>
            apiPost(`/api/teams/${team.id}/players`, {
              name: p.name,
              number: Number(p.number),
              position: p.position,
            })
          )
        );
      }

      if (side === 'A') {
        setState((s) => ({
          ...s,
          teamA: { ...team, _count: { players: players.length } },
          creatingTeamA: false,
          submitting: false,
          showTeamAPlayers: false,
          newTeamAName: '',
          newTeamAShortName: '',
          newTeamALogo: '',
          newTeamAPlayers: [],
        }));
      } else {
        setState((s) => ({
          ...s,
          teamB: { ...team, _count: { players: players.length } },
          creatingTeamB: false,
          submitting: false,
          showTeamBPlayers: false,
          newTeamBName: '',
          newTeamBShortName: '',
          newTeamBLogo: '',
          newTeamBPlayers: [],
        }));
      }

      toast({
        title: 'Equipo creado',
        description: `"${team.name}" creado exitosamente${players.length > 0 ? ` con ${players.length} jugador${players.length > 1 ? 'es' : ''}` : ''}`,
      });
    } catch (err) {
      setState((s) => ({ ...s, submitting: false }));
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear el equipo',
        variant: 'destructive',
      });
    }
  }

  /* ── Player management ─────────────────────────────────────────────────── */
  function handleAddPlayer(side: 'A' | 'B', player: NewPlayer) {
    if (side === 'A') {
      setState((s) => ({
        ...s,
        newTeamAPlayers: [...s.newTeamAPlayers, player],
      }));
    } else {
      setState((s) => ({
        ...s,
        newTeamBPlayers: [...s.newTeamBPlayers, player],
      }));
    }
  }

  function handleRemovePlayer(side: 'A' | 'B', idx: number) {
    if (side === 'A') {
      setState((s) => ({
        ...s,
        newTeamAPlayers: s.newTeamAPlayers.filter((_, i) => i !== idx),
      }));
    } else {
      setState((s) => ({
        ...s,
        newTeamBPlayers: s.newTeamBPlayers.filter((_, i) => i !== idx),
      }));
    }
  }

  /* ── Submit event ──────────────────────────────────────────────────────── */
  async function handleSubmit() {
    if (!state.selectedSport || !state.teamA || !state.teamB) return;

    setState((s) => ({ ...s, submitting: true, error: null }));

    try {
      // Determine what to send: relational or legacy
      const payload: Record<string, unknown> = {
        name: state.eventName.trim() || null,
        sportId: state.selectedSport.id,
        teamAId: state.teamA.id,
        teamBId: state.teamB.id,
        location: state.location.trim() || null,
        countryId: state.countryId,
        departmentId: state.departmentId,
        cityId: state.cityId,
        scheduledAt: state.scheduledAt ? new Date(state.scheduledAt).toISOString() : null,
        isPublic: state.isPublic,
        streamingUrl: state.streamingUrl.trim() || null,
      };

      if (state.tournamentPhaseId) {
        // Relational path: server syncs legacy fields automatically
        payload.tournamentPhaseId = state.tournamentPhaseId;
      } else if (state.tournamentName.trim()) {
        // Manual fallback: use legacy fields directly
        const phaseOrder = state.phase ? (PHASE_ORDER[state.phase] ?? 0) : 0;
        payload.tournamentName = state.tournamentName.trim();
        payload.phase = state.phase || null;
        payload.phaseOrder = phaseOrder;
      }

      await apiPost('/api/events', payload);

      toast({
        title: 'Evento Creado',
        description: 'El evento se ha creado exitosamente',
      });

      navigate({ page: 'EVENT_LIST' });
    } catch (err) {
      setState((s) => ({
        ...s,
        submitting: false,
        error: err instanceof Error ? err.message : 'Error al crear el evento',
      }));
    }
  }

  /* ── Location label for summary (must be before any conditional return) ── */
  const [locationLabel, setLocationLabel] = useState('');

  useEffect(() => {
    if (!state.countryId) { setLocationLabel(''); return; }
    let cancelled = false;
    async function fetchLabels() {
      try {
        const parts: string[] = [];
        const [countriesRes, deptRes, cityRes] = await Promise.all([
          fetch(`/api/locations?type=countries`).then(r => r.json()),
          state.departmentId ? fetch(`/api/locations?type=departments&countryId=${state.countryId}`).then(r => r.json()) : null,
          state.cityId ? fetch(`/api/locations?type=cities&departmentId=${state.departmentId}`).then(r => r.json()) : null,
        ]);
        const country = (countriesRes.countries || []).find((c: { id: string }) => c.id === state.countryId);
        if (country) parts.push(country.name);
        if (deptRes) {
          const dept = (deptRes.departments || []).find((d: { id: string }) => d.id === state.departmentId);
          if (dept) parts.push(dept.name);
        }
        if (cityRes) {
          const city = (cityRes.cities || []).find((c: { id: string }) => c.id === state.cityId);
          if (city) parts.push(city.name);
        }
        if (!cancelled) setLocationLabel(parts.join(' / '));
      } catch { /* ignore */ }
    }
    fetchLabels();
    return () => { cancelled = true; };
  }, [state.countryId, state.departmentId, state.cityId]);

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (state.loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full max-w-lg mx-auto" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const autoEventName = `${state.teamA?.name || '?'} vs ${state.teamB?.name || '?'}`;
  const teamAPlayerCount = state.teamA?._count?.players ?? 0;
  const teamBPlayerCount = state.teamB?._count?.players ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Crear Evento
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Paso {state.step} de 5
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold"
          style={{ color: 'var(--text-muted)' }}
          onClick={handleCancel}
        >
          Cancelar
        </Button>
      </div>

      {/* Progress */}
      <ProgressIndicator currentStep={state.step} completedSteps={completedSteps} />

      {/* Error banner */}
      {state.error && (
        <div
          className="flex items-center gap-2 rounded-lg p-3"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
          <p className="text-sm flex-1" style={{ color: 'var(--accent-red)' }}>{state.error}</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            style={{ color: 'var(--accent-red)' }}
            onClick={() => setState((s) => ({ ...s, error: null }))}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[300px]">
        {state.step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Selecciona el Deporte
            </h2>
            {sports.length === 0 ? (
              <div className="text-center py-10">
                <Trophy className="size-10 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No hay deportes activos disponibles
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sports.map((sport) => (
                  <SportCard
                    key={sport.id}
                    sport={sport}
                    selected={state.selectedSport?.id === sport.id}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        selectedSport: sport,
                        teamA: null,
                        teamB: null,
                        creatingTeamA: false,
                        creatingTeamB: false,
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {state.step === 2 && (
          <TeamSelectionStep
            label="Equipo Local"
            sport={state.selectedSport}
            selectedTeam={state.teamA}
            excludedTeamId={state.teamB?.id ?? null}
            search={state.searchTeamA}
            onSearchChange={(v) => setState((s) => ({ ...s, searchTeamA: v }))}
            onSelectTeam={(team) => setState((s) => ({ ...s, teamA: team, creatingTeamA: false }))}
            creating={state.creatingTeamA}
            onCreateToggle={() => setState((s) => ({ ...s, creatingTeamA: !s.creatingTeamA }))}
            newTeamName={state.newTeamAName}
            onNewTeamNameChange={(v) => setState((s) => ({ ...s, newTeamAName: v }))}
            newTeamShortName={state.newTeamAShortName}
            onNewTeamShortNameChange={(v) => setState((s) => ({ ...s, newTeamAShortName: v }))}
            newTeamLogo={state.newTeamALogo}
            onNewTeamLogoChange={(v) => setState((s) => ({ ...s, newTeamALogo: v }))}
            newPlayers={state.newTeamAPlayers}
            showPlayers={state.showTeamAPlayers}
            onShowPlayersToggle={() => setState((s) => ({ ...s, showTeamAPlayers: !s.showTeamAPlayers }))}
            onAddPlayer={(p) => handleAddPlayer('A', p)}
            onRemovePlayer={(idx) => handleRemovePlayer('A', idx)}
            onCreateTeam={() => handleCreateTeam('A')}
            creatingLoading={state.submitting}
            playerForm={playerFormA}
            onPlayerFormChange={setPlayerFormA}
          />
        )}

        {state.step === 3 && (
          <TeamSelectionStep
            label="Equipo Visitante"
            sport={state.selectedSport}
            selectedTeam={state.teamB}
            excludedTeamId={state.teamA?.id ?? null}
            search={state.searchTeamB}
            onSearchChange={(v) => setState((s) => ({ ...s, searchTeamB: v }))}
            onSelectTeam={(team) => setState((s) => ({ ...s, teamB: team, creatingTeamB: false }))}
            creating={state.creatingTeamB}
            onCreateToggle={() => setState((s) => ({ ...s, creatingTeamB: !s.creatingTeamB }))}
            newTeamName={state.newTeamBName}
            onNewTeamNameChange={(v) => setState((s) => ({ ...s, newTeamBName: v }))}
            newTeamShortName={state.newTeamBShortName}
            onNewTeamShortNameChange={(v) => setState((s) => ({ ...s, newTeamBShortName: v }))}
            newTeamLogo={state.newTeamBLogo}
            onNewTeamLogoChange={(v) => setState((s) => ({ ...s, newTeamBLogo: v }))}
            newPlayers={state.newTeamBPlayers}
            showPlayers={state.showTeamBPlayers}
            onShowPlayersToggle={() => setState((s) => ({ ...s, showTeamBPlayers: !s.showTeamBPlayers }))}
            onAddPlayer={(p) => handleAddPlayer('B', p)}
            onRemovePlayer={(idx) => handleRemovePlayer('B', idx)}
            onCreateTeam={() => handleCreateTeam('B')}
            creatingLoading={state.submitting}
            playerForm={playerFormB}
            onPlayerFormChange={setPlayerFormB}
          />
        )}

        {state.step === 4 && (
          <EventDetailsStep
            teamAName={state.teamA?.name || 'Equipo A'}
            teamBName={state.teamB?.name || 'Equipo B'}
            eventName={state.eventName}
            onEventNameChange={(v) => setState((s) => ({ ...s, eventName: v }))}
            location={state.location}
            onLocationChange={(v) => setState((s) => ({ ...s, location: v }))}
            countryId={state.countryId}
            departmentId={state.departmentId}
            cityId={state.cityId}
            onCountryChange={(v) => setState((s) => ({ ...s, countryId: v, departmentId: null, cityId: null }))}
            onDepartmentChange={(v) => setState((s) => ({ ...s, departmentId: v, cityId: null }))}
            onCityChange={(v) => setState((s) => ({ ...s, cityId: v }))}
            scheduledAt={state.scheduledAt}
            onScheduledAtChange={(v) => setState((s) => ({ ...s, scheduledAt: v }))}
            isPublic={state.isPublic}
            onIsPublicChange={(v) => setState((s) => ({ ...s, isPublic: v }))}
            tournamentId={state.tournamentId}
            tournamentPhaseId={state.tournamentPhaseId}
            onTournamentChange={(id) => setState((s) => ({ ...s, tournamentId: id, tournamentPhaseId: null }))}
            onPhaseChange={(id) => setState((s) => ({ ...s, tournamentPhaseId: id }))}
            useManualTournament={state.useManualTournament}
            onToggleManual={(v) => setState((s) => ({ ...s, useManualTournament: v, tournamentId: null, tournamentPhaseId: null }))}
            tournamentName={state.tournamentName}
            onTournamentNameChange={(v) => setState((s) => ({ ...s, tournamentName: v }))}
            phase={state.phase}
            onLegacyPhaseChange={(v) => setState((s) => ({ ...s, phase: v }))}
            tournamentOptions={tournamentOptions}
            sportName={state.selectedSport?.name || ''}
            streamingUrl={state.streamingUrl}
            onStreamingUrlChange={(v) => setState((s) => ({ ...s, streamingUrl: v }))}
          />
        )}

        {state.step === 5 && (
          <SummaryStep
            sport={state.selectedSport}
            teamA={state.teamA}
            teamB={state.teamB}
            teamAPlayerCount={teamAPlayerCount}
            teamBPlayerCount={teamBPlayerCount}
            eventName={state.eventName}
            autoEventName={autoEventName}
            location={state.location}
            locationLabel={locationLabel}
            scheduledAt={state.scheduledAt}
            isPublic={state.isPublic}
            tournamentName={state.tournamentName}
            phase={state.phase}
            tournamentLabel={(() => {
              if (state.tournamentPhaseId) {
                const t = tournamentOptions.find((t) => t.id === state.tournamentId);
                return t?.name || null;
              }
              return null;
            })()}
            phaseLabel={(() => {
              if (state.tournamentPhaseId) {
                const t = tournamentOptions.find((t) => t.id === state.tournamentId);
                const p = t?.phases.find((p) => p.id === state.tournamentPhaseId);
                return p?.name || null;
              }
              return null;
            })()}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <Separator style={{ background: 'var(--border-custom)' }} />
      <div className="flex items-center justify-between gap-3">
        <div>
          {state.step > 1 ? (
            <Button
              variant="outline"
              className="h-10 text-sm font-semibold"
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
              onClick={goPrev}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="h-10 text-sm font-semibold"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleCancel}
            >
              Cancelar
            </Button>
          )}
        </div>

        {state.step < 5 ? (
          <Button
            className="h-10 text-sm font-semibold px-6"
            disabled={!canAdvance}
            style={{
              background: canAdvance ? 'var(--accent)' : 'var(--bg-card)',
              color: canAdvance ? '#fff' : 'var(--text-muted)',
            }}
            onClick={goNext}
          >
            Siguiente
            <ChevronRight className="size-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="h-10 text-sm font-semibold px-6"
            disabled={state.submitting}
            style={{
              background: state.submitting ? 'var(--bg-card)' : 'var(--accent)',
              color: state.submitting ? 'var(--text-muted)' : '#fff',
            }}
            onClick={handleSubmit}
          >
            {state.submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Trophy className="size-4" />
                Crear Evento
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}