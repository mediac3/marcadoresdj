'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trophy,
  Radio,
  Users,
  Dumbbell,
  Plus,
  Settings2,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore, type SportEvent } from '@/lib/store';
import { apiGet } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface DashboardStats {
  totalEvents: number;
  liveNow: number;
  teamsRegistered: number;
  activeSports: number;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'LIVE':
      return { label: 'En Vivo', color: '#ef4444' };
    case 'PAUSED':
      return { label: 'Pausado', color: '#f59e0b' };
    case 'FINISHED':
      return { label: 'Finalizado', color: '#22c55e' };
    case 'SCHEDULED':
      return { label: 'Programado', color: '#6b7280' };
    default:
      return { label: status, color: '#6b7280' };
  }
}

function roleBadgeLabel(role: string): { label: string; className: string } {
  switch (role) {
    case 'ADMIN':
      return { label: 'Administrador', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
    case 'CREATOR':
      return { label: 'Creador', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    case 'INITIATOR':
      return { label: 'Iniciador', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    default:
      return { label: role, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
}

/* ── Stat Card Skeleton ────────────────────────────────────────────────────── */

function StatCardSkeleton() {
  return (
    <Card
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accentColor: string;
}) {
  return (
    <Card
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${accentColor}20` }}
          >
            <Icon className="size-5" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-medium truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {label}
            </p>
            <p
              className="text-2xl font-bold leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Event Row (Live) ──────────────────────────────────────────────────────── */

function LiveEventCard({ event, onGoToScoring }: { event: SportEvent; onGoToScoring: (id: string) => void }) {
  const st = statusLabel(event.status);

  return (
    <Card
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
      className="overflow-hidden"
    >
      <div className="flex items-stretch">
        {/* Live indicator strip */}
        <div
          className="w-1 shrink-0"
          style={{ background: st.color }}
        />
        <CardContent className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg" aria-hidden="true">{event.sport?.icon}</span>
            <Badge
              variant="outline"
              className="text-[10px] font-bold px-1.5 py-0 animate-pulse"
              style={{
                borderColor: st.color,
                color: st.color,
                background: `${st.color}15`,
              }}
            >
              {st.label}
            </Badge>
            <span
              className="ml-auto text-xs flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Clock className="size-3" />
              {formatElapsed(event.elapsedSeconds)}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="text-right min-w-0 flex-1">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.teamA?.name}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.scoreA}
              </span>
              <span
                className="text-lg font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                -
              </span>
              <span
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.scoreB}
              </span>
            </div>
            <div className="text-left min-w-0 flex-1">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.teamB?.name}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full text-xs font-semibold"
            style={{
              background: 'var(--accent)',
              color: '#fff',
            }}
            onClick={() => onGoToScoring(event.id)}
          >
            <Radio className="size-3.5 mr-1.5" />
            Ir al Marcador
            <ChevronRight className="size-3.5 ml-auto" />
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}

/* ── Recent Event Row ──────────────────────────────────────────────────────── */

function RecentEventCard({ event }: { event: SportEvent }) {
  const st = statusLabel(event.status);

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="text-base shrink-0" aria-hidden="true">{event.sport?.icon}</span>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.teamA?.name} vs {event.teamB?.name}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {formatDate(event.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.scoreA} - {event.scoreB}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] font-semibold px-1.5 py-0"
          style={{
            borderColor: st.color,
            color: st.color,
            background: `${st.color}15`,
          }}
        >
          {st.label}
        </Badge>
      </div>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <p className="text-3xl mb-2" aria-hidden="true">📭</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {message}
      </p>
    </div>
  );
}

/* ── Main Dashboard View ───────────────────────────────────────────────────── */

export function DashboardView() {
  const user = useAppStore((s) => s.user);
  const navigate = useAppStore((s) => s.navigate);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [liveEvents, setLiveEvents] = useState<SportEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, liveRes, teamsRes, sportsRes] = await Promise.allSettled([
        apiGet<{ success: boolean; events: SportEvent[] }>('/api/events'),
        apiGet<{ success: boolean; events: SportEvent[] }>('/api/events?status=LIVE'),
        apiGet<{ success: boolean; teams: unknown[] }>('/api/teams'),
        apiGet<{ success: boolean; sports: unknown[] }>('/api/sports'),
      ]);

      const events = eventsRes.status === 'fulfilled' ? eventsRes.value.events : [];
      const live = liveRes.status === 'fulfilled' ? liveRes.value.events : [];
      const teamCount = teamsRes.status === 'fulfilled' ? teamsRes.value.teams.length : 0;
      const sportCount = sportsRes.status === 'fulfilled' ? sportsRes.value.sports.length : 0;

      setStats({
        totalEvents: events.length,
        liveNow: live.length,
        teamsRegistered: teamCount,
        activeSports: sportCount,
      });
      setLiveEvents(live);
      setRecentEvents(events.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleGoToScoring = useCallback(
    (eventId: string) => {
      navigate({ page: 'SCORING', eventId });
    },
    [navigate],
  );

  const roleBadge = roleBadgeLabel(user?.role || 'INITIATOR');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* ── Welcome ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            ¡Bienvenido, {user?.name || user?.username}!
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Panel de control de MarcadoresDJ
          </p>
        </div>
        <Badge
          variant="outline"
          className={`self-start text-xs font-semibold px-2.5 py-1 border ${roleBadge.className}`}
        >
          {roleBadge.label}
        </Badge>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : error && !stats ? (
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-5 text-red-400 shrink-0" />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
              onClick={fetchDashboard}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            icon={Trophy}
            label="Total Eventos"
            value={stats?.totalEvents ?? 0}
            accentColor="#f59e0b"
          />
          <StatCard
            icon={Radio}
            label="En Vivo Ahora"
            value={stats?.liveNow ?? 0}
            accentColor="#ef4444"
          />
          <StatCard
            icon={Users}
            label="Equipos Registrados"
            value={stats?.teamsRegistered ?? 0}
            accentColor="#3b82f6"
          />
          <StatCard
            icon={Dumbbell}
            label="Deportes Activos"
            value={stats?.activeSports ?? 0}
            accentColor="#22c55e"
          />
        </div>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="text-xs font-semibold"
          style={{
            background: 'var(--accent)',
            color: '#fff',
          }}
          onClick={() => navigate({ page: 'CREATE_EVENT' })}
        >
          <Plus className="size-3.5 mr-1.5" />
          Crear Evento
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-semibold"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          onClick={() => navigate({ page: 'TEAMS' })}
        >
          <Settings2 className="size-3.5 mr-1.5" />
          Gestionar Equipos
        </Button>
      </div>

      {/* ── Live Events ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Radio className="size-4 text-red-400" />
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Eventos en Vivo
          </h2>
          {liveEvents.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] font-bold px-1.5 py-0"
              style={{
                borderColor: '#ef4444',
                color: '#ef4444',
                background: '#ef444415',
              }}
            >
              {liveEvents.length}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-44 rounded-lg hidden sm:block" />
          </div>
        ) : liveEvents.length === 0 ? (
          <EmptyState message="No hay eventos en vivo en este momento" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {liveEvents.map((evt) => (
              <LiveEventCard
                key={evt.id}
                event={evt}
                onGoToScoring={handleGoToScoring}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Events ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="size-4" style={{ color: 'var(--text-secondary)' }} />
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Eventos Recientes
          </h2>
          <Badge
            variant="outline"
            className="text-[10px] font-bold px-1.5 py-0"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            {recentEvents.length}
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <EmptyState message="No hay eventos registrados aún" />
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {recentEvents.map((evt) => (
              <RecentEventCard key={evt.id} event={evt} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}