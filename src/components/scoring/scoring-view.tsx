'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  ArrowLeft,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  Square,
  Loader2,
  Video,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, type SportEvent, type SportAction, type Player } from '@/lib/store';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { useMatchTimer } from '@/hooks/use-match-timer';
import { removeTimer } from '@/lib/global-timer';
import { SPORT_HALVES } from '@/lib/constants';
import { CounterButton } from '@/components/scoring/counter-button';
import { MatchTimer } from '@/components/scoring/match-timer';
import { CommentsPanel } from '@/components/scoring/comments-panel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/* ── Streaming URL helper ────────────────────────────────────────────────── */

function toScoringEmbedUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.includes('/embed/') || trimmed.includes('player.twitch.tv') || trimmed.includes('player.vimeo.com')) return trimmed;
  let m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
  m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
  m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
  m = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;
  m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/);
  if (m) return `https://player.twitch.tv/?channel=${m[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : ''}&muted=true`;
  m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1`;
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return null;
}

/* ── Half display helpers ──────────────────────────────────────────────────── */

function getHalfDisplayLabel(
  half: string | null | undefined,
  sportName: string,
): string {
  if (!half) return '—';
  const key = sportName.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
  if (['futbol', 'microfutbol', 'handball'].includes(key)) {
    if (half === '1') return '1er Tiempo';
    if (half === '2') return '2do Tiempo';
  }
  if (key === 'baloncesto') {
    if (half === '1Q') return '1er Cuarto';
    if (half === '2Q') return '2do Cuarto';
    if (half === '3Q') return '3er Cuarto';
    if (half === '4Q') return '4to Cuarto';
  }
  if (key === 'voleibol' && half.startsWith('S')) {
    return `Set ${half.slice(1)}`;
  }
  if (key === 'beisbol') return `Inning ${half}`;
  return half;
}

function getHalfOptions(
  sportName: string,
): { value: string; label: string }[] {
  const key = sportName.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
  const halves = SPORT_HALVES[key] || ['1', '2'];
  return halves.map((h) => ({
    value: h,
    label: getHalfDisplayLabel(h, sportName),
  }));
}

/* ── Misc helpers ──────────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function shortName(p: Player): string {
  if (p.nickname) return p.nickname;
  const first = p.name.split(' ')[0];
  return first.length > 8 ? first.slice(0, 7) + '…' : first;
}

function abbrPos(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes('portero')) return 'POR';
  if (p.includes('defensa central')) return 'DFC';
  if (p.includes('lateral der')) return 'LD';
  if (p.includes('lateral izq')) return 'LI';
  if (p.includes('mediocentro def')) return 'MCD';
  if (p.includes('mediocentro') || p === 'central') return 'MC';
  if (p.includes('mediapunta')) return 'MPT';
  if (p.includes('extremo der')) return 'ED';
  if (p.includes('extremo izq')) return 'EI';
  if (p.includes('extremo') && !p.includes('der') && !p.includes('izq'))
    return 'EXT';
  if (p.includes('delantero cen')) return 'DC';
  if (p.includes('segundo del')) return 'SD';
  if (p.includes('delantero') || p.includes('pivot') && !p.includes('ala'))
    return 'DEL';
  if (p.includes('base')) return 'BASE';
  if (p.includes('escolta')) return 'ESC';
  if (p.includes('alero')) return 'AL';
  if (p.includes('ala-pivot') || p.includes('ala pivot')) return 'AP';
  if (p.includes('pivot (c)')) return 'PIV';
  if (p.includes('colocador')) return 'COL';
  if (p.includes('opuesto')) return 'OPL';
  if (p.includes('libero')) return 'LIB';
  if (p.includes('cierre')) return 'CIE';
  if (p.includes('lanzador')) return 'LAN';
  if (p.includes('receptor')) return 'REC';
  if (p.includes('primera base')) return '1B';
  if (p.includes('segunda base')) return '2B';
  if (p.includes('tercera base')) return '3B';
  if (p.includes('campo corto')) return 'CS';
  if (p.includes('jardinero')) return 'JAR';
  if (p.includes('falta')) return 'FAL';
  return pos.length > 4 ? pos.slice(0, 4).toUpperCase() : pos.toUpperCase();
}

/* ── Main component ────────────────────────────────────────────────────────── */

export function ScoringView() {
  const navigate = useAppStore((s) => s.navigate);
  const currentView = useAppStore((s) => s.currentView);
  const eventId =
    currentView.page === 'SCORING' ? currentView.eventId : '';

  /* ── Local state ─────────────────────────────────────────────────────── */

  const [event, setEvent] = useState<SportEvent | null>(null);
  const [sportActions, setSportActions] = useState<SportAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventLoaded, setEventLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  // Separate elapsed-seconds tracker so the timer doesn't jump on every
  // action re-fetch.
  const [serverElapsed, setServerElapsed] = useState(0);

  const eventRef = useRef(event);
  eventRef.current = event;

  const timerHookRef = useRef<{ totalSeconds: number }>({ totalSeconds: 0 });

  /* ── Timer ───────────────────────────────────────────────────────────── */

  const isRunning = event?.status === 'LIVE';
  // `eventLoaded` gates the timer effects so they don't fire while the
  // event is still null (which would overwrite a running global timer).
  const timer = useMatchTimer(eventId, serverElapsed, isRunning, eventLoaded);
  timerHookRef.current = timer;

  /* ── Derived data ────────────────────────────────────────────────────── */

  const playersA = useMemo(
    () => event?.teamA?.players ?? [],
    [event?.teamA?.players],
  );
  const playersB = useMemo(
    () => event?.teamB?.players ?? [],
    [event?.teamB?.players],
  );

  const actionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of event?.actions ?? []) {
      if (a.playerId) {
        const k = `${a.playerId}:${a.actionType}`;
        c[k] = (c[k] || 0) + 1;
      }
    }
    return c;
  }, [event?.actions]);

  const canScore = event?.status === 'LIVE' || event?.status === 'PAUSED';
  const canControl =
    event?.status === 'LIVE' || event?.status === 'PAUSED';
  const isScheduled = event?.status === 'SCHEDULED';
  const isFinished = event?.status === 'FINISHED';
  const sportName = event?.sport?.name ?? '';
  const halfOptions = useMemo(
    () => getHalfOptions(sportName),
    [sportName],
  );
  const eventName = useMemo(() => {
    if (!event) return 'Cargando…';
    if (event.name) return event.name;
    return `${event.teamA?.name ?? 'Equipo A'} vs ${event.teamB?.name ?? 'Equipo B'}`;
  }, [event]);

  /* ── Data fetching ───────────────────────────────────────────────────── */

  /** Full fetch (initial load, explicit sync). Resets serverElapsed. */
  const fetchEventFull = useCallback(async () => {
    try {
      const data = await apiGet<{
        success: boolean;
        event: SportEvent;
      }>(`/api/events/${eventId}`);
      setEvent(data.event);
      setServerElapsed(data.event.elapsedSeconds);
      return data.event;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al cargar el evento',
      );
      return null;
    }
  }, [eventId]);

  /** Lightweight fetch (after actions/comments). Preserves serverElapsed. */
  const refreshActions = useCallback(async () => {
    try {
      const data = await apiGet<{
        success: boolean;
        event: SportEvent;
      }>(`/api/events/${eventId}`);
      setEvent((prev) => {
        if (!prev) return data.event;
        return { ...data.event, elapsedSeconds: prev.elapsedSeconds };
      });
    } catch {
      // silent — the main data is still valid
    }
  }, [eventId]);

  const fetchSportActions = useCallback(
    async (sportId: string) => {
      try {
        const data = await apiGet<{
          success: boolean;
          actions: SportAction[];
        }>(`/api/sports/${sportId}/actions`);
        setSportActions(data.actions);
      } catch {
        toast.error('Error al cargar las acciones del deporte');
      }
    },
    [],
  );

  /* ── Initial load ────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEventLoaded(false);
    (async () => {
      const ev = await fetchEventFull();
      if (!ev || cancelled) { setLoading(false); return; }
      await fetchSportActions(ev.sportId);
      if (!cancelled) {
        setEventLoaded(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchEventFull, fetchSportActions]);

  /* ── Periodic timer sync (every 10 s while LIVE) ────────────────────── */

  const syncTimerToServer = useCallback(async () => {
    const ev = eventRef.current;
    const t = timerHookRef.current;
    if (!ev || ev.status === 'SCHEDULED' || ev.status === 'FINISHED') return;
    try {
      await apiPost(`/api/events/${eventId}/timer`, {
        elapsedSeconds: t.totalSeconds,
        half: ev.currentHalf,
      });
      setServerElapsed(t.totalSeconds);
    } catch {
      /* silent for periodic sync */
    }
  }, [eventId]);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (isRunning) {
      syncIntervalRef.current = setInterval(syncTimerToServer, 10_000);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isRunning, syncTimerToServer]);

  /* ── Event lifecycle handlers ────────────────────────────────────────── */

  const handleTimerToggle = useCallback(async () => {
    const ev = eventRef.current;
    if (!ev || busy) return;
    setBusy(true);
    try {
      // Sync elapsed before changing state
      await apiPost(`/api/events/${eventId}/timer`, {
        elapsedSeconds: timerHookRef.current.totalSeconds,
        half: ev.currentHalf,
      });
      setServerElapsed(timerHookRef.current.totalSeconds);

      if (ev.status === 'SCHEDULED') {
        await apiPost(`/api/events/${eventId}/start`);
      } else {
        await apiPost(`/api/events/${eventId}/pause`);
      }
      await fetchEventFull();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error en la operación',
      );
    } finally {
      setBusy(false);
    }
  }, [eventId, busy, fetchEventFull]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncTimerToServer();
      toast.success('Tiempo sincronizado');
    } catch {
      toast.error('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  }, [syncTimerToServer]);

  const handleHalfChange = useCallback(
    async (half: string) => {
      setBusy(true);
      try {
        await apiPost(`/api/events/${eventId}/timer`, {
          elapsedSeconds: timerHookRef.current.totalSeconds,
          half,
        });
        setServerElapsed(timerHookRef.current.totalSeconds);
        await refreshActions();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Error al cambiar el tiempo',
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId, refreshActions],
  );

  const handleEndEvent = useCallback(async () => {
    setBusy(true);
    try {
      await apiPost(`/api/events/${eventId}/timer`, {
        elapsedSeconds: timerHookRef.current.totalSeconds,
        half: eventRef.current?.currentHalf,
      });
      setServerElapsed(timerHookRef.current.totalSeconds);
      await apiPost(`/api/events/${eventId}/end`);
      removeTimer(eventId);
      toast.success('Evento finalizado');
      navigate({ page: 'EVENT_LIST' });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al finalizar',
      );
    } finally {
      setBusy(false);
    }
  }, [eventId, navigate]);

  /* ── Advance winner to next phase ── */
  const [advancing, setAdvancing] = useState(false);
  const handleAdvanceWinner = useCallback(async () => {
    setAdvancing(true);
    try {
      const res = await apiPost(`/api/events/${eventId}/advance`, {});
      if ((res as Record<string, unknown>).advanced) {
        toast.success((res as Record<string, unknown>).message as string || 'Ganador avanzado correctamente');
      } else {
        toast.info((res as Record<string, unknown>).message as string || 'No hay eventos vinculados en la siguiente fase');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al avanzar ganador');
    } finally {
      setAdvancing(false);
    }
  }, [eventId]);

  /* ── Action (grid) handlers ──────────────────────────────────────────── */

  const handleIncrement = useCallback(
    async (playerId: string, action: SportAction) => {
      if (!canScore || busy) return;
      setBusy(true);
      try {
        const minute = Math.floor(timerHookRef.current.totalSeconds / 60);
        const half = eventRef.current?.currentHalf;

        // 1. Create action
        await apiPost(`/api/events/${eventId}/actions`, {
          playerId,
          actionType: action.name,
          actionLabel: action.label,
          actionIcon: action.icon,
          actionColor: action.color,
          minute,
          half,
          value: action.defaultValue ?? 1,
        });

        // 2. Generate AI comment (non-critical)
        const ev = eventRef.current;
        const player =
          ev?.teamA?.players?.find((p) => p.id === playerId) ??
          ev?.teamB?.players?.find((p) => p.id === playerId);
        const teamName =
          player && ev
            ? player.id === ev.teamA?.players?.find((p) => p.id === playerId)?.id
              ? ev.teamA?.name
              : ev.teamB?.name
            : undefined;
        try {
          await apiPost(`/api/events/${eventId}/ai-comment`, {
            actionType: action.name,
            actionLabel: action.label,
            playerName: player?.name,
            teamName,
            minute,
            half,
          });
        } catch {
          /* AI comment failure is non-critical */
        }

        // 3. Refresh (preserving timer)
        await refreshActions();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Error al registrar la acción',
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId, canScore, busy, refreshActions],
  );

  const handleDecrement = useCallback(
    async (playerId: string, actionType: string) => {
      if (!canScore || busy) return;
      setBusy(true);
      try {
        // Find most recent action (actions are ordered desc by createdAt)
        const mostRecent = eventRef.current?.actions?.find(
          (a) => a.playerId === playerId && a.actionType === actionType,
        );
        if (!mostRecent) {
          toast.error('No hay acción para eliminar');
          return;
        }
        await apiDelete(
          `/api/events/${eventId}/actions/${mostRecent.id}`,
        );
        await refreshActions();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Error al eliminar la acción',
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId, canScore, busy, refreshActions],
  );

  /* ── Comment handler ─────────────────────────────────────────────────── */

  const handleAddComment = useCallback(
    async (content: string) => {
      await apiPost(`/api/events/${eventId}/comments`, { content });
      await refreshActions();
    },
    [eventId, refreshActions],
  );

  /* ── Loading state ───────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center gap-3"
        style={{ color: 'var(--text-muted, #888)' }}
      >
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Cargando evento…</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ color: 'var(--text-muted, #888)' }}
      >
        <p className="text-sm">Evento no encontrado</p>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-3 pb-24 lg:pb-4">
      {/* ━━━ 1. HEADER BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 backdrop-blur-md"
        style={{
          background: 'rgba(17, 17, 17, 0.85)',
          borderBottom: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
        }}
      >
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate({ page: 'EVENT_LIST' })}
          className="flex items-center justify-center size-9 rounded-lg transition-colors"
          style={{
            color: 'var(--text-secondary, #aaa)',
            background: 'var(--bg-card-hover, rgba(128,128,128,0.1))',
          }}
          aria-label="Volver"
        >
          <ArrowLeft className="size-5" />
        </button>

        {/* Event name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {event.sport && (
            <span className="text-lg shrink-0" aria-hidden="true">
              {event.sport.icon}
            </span>
          )}
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary, #eee)' }}
          >
            {eventName}
          </span>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live / Paused indicator */}
          {event.status === 'LIVE' && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative size-2 rounded-full bg-red-500" />
              </span>
              En vivo
            </span>
          )}
          {event.status === 'PAUSED' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
              <Pause className="size-3" />
              Pausado
            </span>
          )}

          {/* Pause / Resume */}
          {canControl && (
            <button
              type="button"
              onClick={handleTimerToggle}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              style={{
                background:
                  event.status === 'LIVE'
                    ? 'rgba(251,191,36,0.15)'
                    : 'rgba(34,197,94,0.15)',
                color:
                  event.status === 'LIVE' ? '#fbbf24' : '#22c55e',
                border: `1px solid ${event.status === 'LIVE' ? 'rgba(251,191,36,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {event.status === 'LIVE' ? (
                <>
                  <Pause className="size-3.5" /> Pausar
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> Reanudar
                </>
              )}
            </button>
          )}

          {/* End Event */}
          {canControl && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  <Square className="size-3" /> Finalizar
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Finalizar el evento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción marcará el evento como finalizado. El cronómetro
                    se detendrá y no se podrán registrar más acciones.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEndEvent}
                    style={{
                      background: '#ef4444',
                      color: '#fff',
                    }}
                  >
                    Sí, finalizar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Advance Winner (only for finished events with score difference) */}
          {isFinished && event && event.scoreA !== event.scoreB && (
            <button
              type="button"
              disabled={advancing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
              onClick={handleAdvanceWinner}
            >
              {advancing ? <Loader2 className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
              Avanzar Ganador
            </button>
          )}
        </div>
      </header>

      {/* ━━━ 2. SCOREBOARD BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 rounded-xl"
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
        }}
      >
        {/* Team A */}
        <div className="text-center">
          <p
            className="text-[11px] font-medium truncate mb-1"
            style={{ color: 'var(--text-muted, #888)' }}
          >
            {event.teamA?.shortName || event.teamA?.name || 'Equipo A'}
          </p>
          <p
            className="text-4xl sm:text-5xl font-black tabular-nums leading-none"
            style={{ color: 'var(--text-primary, #fff)' }}
          >
            {event.scoreA}
          </p>
        </div>

        {/* Center: timer + half */}
        <div className="flex flex-col items-center gap-1.5 px-3">
          <p
            className="font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-wider"
            style={{ color: 'var(--text-primary, #fff)' }}
          >
            {timer.display}
          </p>
          {event.currentHalf && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--accent, #e11d48)25',
                color: 'var(--accent, #e11d48)',
              }}
            >
              {getHalfDisplayLabel(event.currentHalf, sportName)}
            </span>
          )}
          {isScheduled && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(128,128,128,0.15)',
                color: 'var(--text-muted, #888)',
              }}
            >
              Sin iniciar
            </span>
          )}
        </div>

        {/* Team B */}
        <div className="text-center">
          <p
            className="text-[11px] font-medium truncate mb-1"
            style={{ color: 'var(--text-muted, #888)' }}
          >
            {event.teamB?.shortName || event.teamB?.name || 'Equipo B'}
          </p>
          <p
            className="text-4xl sm:text-5xl font-black tabular-nums leading-none"
            style={{ color: 'var(--text-primary, #fff)' }}
          >
            {event.scoreB}
          </p>
        </div>
      </div>

      {/* ━━━ 3. MATCH CONTROLS (collapsible) ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div>
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          className="flex items-center gap-1.5 px-1 text-xs font-medium transition-colors w-full"
          style={{ color: 'var(--text-muted, #888)' }}
        >
          {controlsOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
          Controles del Partido
        </button>

        {controlsOpen && (
          <div className="mt-1">
            <MatchTimer
              display={timer.display}
              isRunning={isRunning}
              onStartStop={handleTimerToggle}
              onSync={handleSync}
              onHalfChange={handleHalfChange}
              currentHalf={event.currentHalf || ''}
              halves={halfOptions}
              syncing={syncing}
            />
          </div>
        )}
      </div>

      {/* ━━━ Scheduled banner ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isScheduled && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: 'rgba(59,130,246,0.1)',
            color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.2)',
          }}
        >
          <Play className="size-4" />
          Inicia el evento para comenzar a registrar acciones
        </div>
      )}

      {/* ━━━ Streaming embed (if configured) ━━━━━━━━━━━━━━━━━━━━━━━ */}
      {event.streamingUrl && (() => {
        const embedSrc = toScoringEmbedUrl(event.streamingUrl);
        if (!embedSrc) return null;
        return (
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-card, #1a1a2e)' }}>
              <Video className="size-4" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Transmisión
              </span>
            </div>
            <div
              className="relative w-full overflow-hidden"
              style={{ background: '#000', aspectRatio: '16 / 9' }}
            >
              <iframe
                src={embedSrc}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Transmisión en vivo"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        );
      })()}

      {/* ━━━ 4. THE SCORING GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {sportActions.length > 0 && playersA.length + playersB.length > 0 ? (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--bg-card, #1a1a2e)',
            border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
          }}
        >
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{
              maxHeight: '55vh',
              minHeight: '200px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              className="border-separate"
              style={{
                borderSpacing: 0,
                minWidth: `${
                  120 +
                  (playersA.length + playersB.length) * 64 +
                  8
                }px`,
              }}
            >
              {/* ── Column headers ──────────────────────────────────────── */}
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-secondary, #111)',
                  }}
                >
                  {/* Sticky action label header */}
                  <th
                    className="sticky left-0 z-20 text-left text-[11px] font-semibold px-3 py-2"
                    style={{
                      background: 'var(--bg-secondary, #111)',
                      borderBottom: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
                      minWidth: 120,
                      color: 'var(--text-muted, #888)',
                    }}
                  >
                    Acción
                  </th>

                  {/* Team A players */}
                  {playersA.map((p) => (
                    <PlayerHeader key={p.id} player={p} />
                  ))}

                  {/* Separator */}
                  <th
                    style={{
                      width: 8,
                      background: 'var(--accent, #e11d48)',
                      borderBottom: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
                    }}
                  />

                  {/* Team B players */}
                  {playersB.map((p) => (
                    <PlayerHeader key={p.id} player={p} />
                  ))}
                </tr>
              </thead>

              {/* ── Action rows ─────────────────────────────────────────── */}
              <tbody>
                {sportActions.map((action, rowIdx) => (
                  <tr
                    key={action.name}
                    style={{
                      background:
                        rowIdx % 2 === 0
                          ? 'transparent'
                          : 'var(--bg-card-hover, rgba(128,128,128,0.04))',
                    }}
                  >
                    {/* Sticky action label */}
                    <td
                      className="sticky left-0 z-10 whitespace-nowrap"
                      style={{
                        background:
                          rowIdx % 2 === 0
                            ? 'var(--bg-card, #1a1a2e)'
                            : 'rgba(128, 128, 128, 0.04)',
                        borderBottom:
                          '1px solid var(--border-custom, rgba(128,128,128,0.08))',
                        borderRight:
                          '2px solid var(--border-custom, rgba(128,128,128,0.15))',
                      }}
                    >
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
                        style={{ color: 'var(--text-primary, #eee)' }}
                      >
                        <span className="text-sm">{action.icon}</span>
                        <span>{action.label}</span>
                      </div>
                    </td>

                    {/* Team A cells */}
                    {playersA.map((p) => (
                      <td
                        key={p.id}
                        className="p-0.5"
                        style={{
                          borderBottom:
                            '1px solid var(--border-custom, rgba(128,128,128,0.05))',
                          width: 64,
                        }}
                      >
                        <CounterButton
                          value={
                            actionCounts[`${p.id}:${action.name}`] || 0
                          }
                          color={action.color}
                          icon={action.icon}
                          onPress={() => handleIncrement(p.id, action)}
                          onLongPress={() =>
                            handleDecrement(p.id, action.name)
                          }
                          disabled={!canScore || busy || isFinished}
                        />
                      </td>
                    ))}

                    {/* Separator */}
                    <td
                      style={{
                        width: 8,
                        background: 'var(--accent, #e11d48)',
                        borderBottom:
                          '1px solid var(--border-custom, rgba(128,128,128,0.08))',
                      }}
                    />

                    {/* Team B cells */}
                    {playersB.map((p) => (
                      <td
                        key={p.id}
                        className="p-0.5"
                        style={{
                          borderBottom:
                            '1px solid var(--border-custom, rgba(128,128,128,0.05))',
                          width: 64,
                        }}
                      >
                        <CounterButton
                          value={
                            actionCounts[`${p.id}:${action.name}`] || 0
                          }
                          color={action.color}
                          icon={action.icon}
                          onPress={() => handleIncrement(p.id, action)}
                          onLongPress={() =>
                            handleDecrement(p.id, action.name)
                          }
                          disabled={!canScore || busy || isFinished}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid footer hint */}
          <div
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10px]"
            style={{
              color: 'var(--text-muted, #666)',
              borderTop: '1px solid var(--border-custom, rgba(128,128,128,0.1))',
            }}
          >
            <span>Toca para sumar</span>
            <span style={{ color: 'var(--border-custom, rgba(128,128,128,0.4))' }}>
              │
            </span>
            <span>Mantén presionado 2s para restar</span>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-xl px-4 py-10 text-sm"
          style={{
            background: 'var(--bg-card, #1a1a2e)',
            color: 'var(--text-muted, #888)',
            border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
          }}
        >
          {sportActions.length === 0
            ? 'No hay acciones configuradas para este deporte'
            : 'No hay jugadores en los equipos'}
        </div>
      )}

      {/* ━━━ 5. COMMENTS PANEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <CommentsPanel
        eventId={eventId}
        comments={event?.comments ?? []}
        onNewComment={handleAddComment}
      />
    </div>
  );
}

/* ── Player column header ──────────────────────────────────────────────────── */

function PlayerHeader({ player }: { player: Player }) {
  return (
    <th
      className="p-1 text-center"
      style={{
        width: 64,
        borderBottom: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
      }}
    >
      <div className="flex flex-col items-center gap-0.5 py-1.5">
        {/* Photo / initials */}
        <div className="relative">
          {player.photo ? (
            <img
              src={player.photo}
              alt=""
              className="size-10 rounded-full object-cover"
              style={{
                border: '2px solid var(--border-custom, rgba(128,128,128,0.3))',
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center size-10 rounded-full text-[11px] font-bold"
              style={{
                background: 'var(--accent, #e11d48)20',
                color: 'var(--accent, #e11d48)',
                border: '2px solid var(--accent, #e11d48)40',
              }}
            >
              {getInitials(player.name)}
            </div>
          )}
          {/* Number badge */}
          <span
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full text-[9px] font-bold"
            style={{
              background: 'var(--bg-secondary, #111)',
              color: 'var(--text-primary, #eee)',
              border: '1.5px solid var(--border-custom, rgba(128,128,128,0.3))',
            }}
          >
            {player.number}
          </span>
        </div>

        {/* Name */}
        <span
          className="text-[10px] font-semibold leading-tight truncate w-full text-center px-0.5"
          style={{ color: 'var(--text-primary, #eee)' }}
        >
          {shortName(player)}
        </span>

        {/* Position abbreviation */}
        <span
          className="text-[9px] leading-tight"
          style={{ color: 'var(--text-muted, #888)' }}
        >
          ({abbrPos(player.position)})
        </span>
      </div>
    </th>
  );
}