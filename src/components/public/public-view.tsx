'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Trophy,
  User,
  Moon,
  Sun,
  Leaf,
  LogIn,
  Calendar,
  Video,
  SlidersHorizontal,
  X,
  Eye,
  CheckSquare,
  Square,
  UserPlus,
  MessageCircle,
  Table2,
  GitBranch,
  Target,
  Plus,
  Crown,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { LocationSelector } from '@/components/locations/location-selector';
import {
  useVisitorFingerprint,
  useVisitTracker,
  useRealtimeCounter,
  AdOverlay,
  type AdData,
  type GroupedAds,
} from '@/components/public/ad-overlay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { useAppStore, type ThemeName } from '@/lib/store';
import { GOAL_ACTION_TYPES, normalizeSportKey } from '@/lib/constants';
import { sportHasDraws, type PredictionResult } from '@/lib/prediction';
import type { MvpResult, MvpEntry } from '@/lib/mvp';
import { PublicEventWizard } from '@/components/public/public-event-wizard';

/* ════════════════════════════════════════════════════════════════════════════
   STREAMING IFRAME (memoised — only re-renders when URL changes)
   ════════════════════════════════════════════════════════════════════════════ */

interface StreamingEmbedProps {
  streamingUrl: string;
}

const StreamingEmbed = memo(function StreamingEmbed({ streamingUrl }: StreamingEmbedProps) {
  const embedSrc = toEmbedUrl(streamingUrl);
  if (!embedSrc) return null;
  return (
    <iframe
      src={embedSrc}
      className="absolute inset-0 w-full h-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Transmisión en vivo"
      style={{ border: 'none' }}
    />
  );
});

/* ════════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════════ */

interface PublicTeam {
  id: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  gender: string;
  ageCategory: string;
}

interface PublicActionPlayer {
  id: string;
  name: string;
  number: number;
  nickname: string | null;
  teamId: string;
}

interface PublicEventAction {
  id: string;
  eventId: string;
  playerId: string | null;
  player: PublicActionPlayer | null;
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

export interface PublicEvent {
  id: string;
  name: string | null;
  sportId: string;
  sport: { id: string; name: string; icon: string } | null;
  teamAId: string;
  teamA: PublicTeam | null;
  teamBId: string;
  teamB: PublicTeam | null;
  location: string | null;
  country: { id: string; name: string; code: string | null } | null;
  department: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  currentHalf: string | null;
  elapsedSeconds: number;
  scoreA: number;
  scoreB: number;
  isPublic: boolean;
  tournamentName: string | null;
  phase: string | null;
  phaseOrder: number;
  actions: PublicEventAction[];
  streamingUrl: string | null;
  createdAt: string;
}

interface PlayerDetail {
  id: string;
  name: string;
  number: number;
  position: string;
  nickname: string | null;
  photo: string | null;
  birthDate: string | null;
  nationality: string | null;
  height: string | null;
  weight: string | null;
  teamId: string;
}

interface DetailAction {
  id: string;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionColor: string;
  minute: number | null;
  playerId: string | null;
  player: PlayerDetail | null;
}

interface CommentData {
  id: string;
  eventId: string;
  content: string;
  isAI: boolean;
  actionId: string | null;
  userId: string | null;
  createdAt: string;
  user: { id: string; username: string; name: string } | null;
}

interface ExpandedData {
  actions: DetailAction[];
  comments: CommentData[];
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  sportName: string;
  streamingUrl: string | null;
  mvp: MvpResult | null;
}

/* ── Win/Draw/Win (1X2) visitor pick ── */
type WinDrawWinPick = 'A' | 'DRAW' | 'B';
const PICKS_STORAGE_KEY = 'marcadoresdj-picks';

/* ════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════════════ */

const REFRESH_MS = 10_000;
const TIMER_TICK_MS = 1_000;
const GRID_PAGE_SIZE = 9; // 3x3 grid

/* ── Streaming URL helpers ─────────────────────────────────────────────────── */

/**
 * Converts a streaming URL to an embeddable iframe `src`.
 * Supports YouTube (watch, shorts, embed, live), Twitch, Vimeo,
 * and generic embed URLs.
 * Returns `null` if the URL cannot be converted.
 */
function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Already an embed URL
  if (
    trimmed.includes('/embed/') ||
    trimmed.includes('player.twitch.tv') ||
    trimmed.includes('player.vimeo.com')
  ) {
    return trimmed;
  }

  // YouTube: https://www.youtube.com/watch?v=XXXXX
  let m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  );
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;

  // YouTube Shorts: https://www.youtube.com/shorts/XXXXX
  m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  );
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;

  // YouTube Live: https://www.youtube.com/live/XXXXX
  m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  );
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;

  // YouTube: youtu.be/XXXXX
  m = trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1`;

  // Twitch: https://www.twitch.tv/channelname
  m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/,
  );
  if (m)
    return `https://player.twitch.tv/?channel=${m[1]}&parent=${typeof window !== 'undefined' ? window.location.hostname : ''}&muted=true`;

  // Vimeo: https://vimeo.com/XXXXX
  m = trimmed.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1`;

  // Generic: if it looks like a URL, just use it directly (iframe may or may not work)
  if (/^https?:\/\//.test(trimmed)) return trimmed;

  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════════════ */

const THEME_OPTIONS: {
  value: ThemeName;
  icon: React.ReactNode;
  label: string;
}[] = [
  { value: 'flashscore-dark', icon: <Moon className="size-4" />, label: 'Oscuro' },
  { value: 'light', icon: <Sun className="size-4" />, label: 'Claro' },
  { value: 'green-field', icon: <Leaf className="size-4" />, label: 'Cancha Verde' },
];

/* ════════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ════════════════════════════════════════════════════════════════════════════ */

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatScheduledDate(dateStr: string | null): string {
  if (!dateStr) return 'Por definir';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  if (isToday) return `Hoy, ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();
  if (isTomorrow) return `Mañana, ${time}`;
  return (
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) +
    ', ' +
    time
  );
}

function formatCommentTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function teamSubInfo(gender: string, ageCategory: string): string | null {
  const parts: string[] = [];
  if (gender && gender !== 'Mixto') parts.push(gender);
  if (ageCategory && ageCategory !== 'Libre') parts.push(ageCategory);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function isGoalAction(sportName: string, actionType: string): boolean {
  const key = normalizeSportKey(sportName);
  const types = GOAL_ACTION_TYPES[key];
  if (!types) return false;
  const upper = actionType.toUpperCase();
  return types.some((t) => t.toUpperCase() === upper);
}

// Card action types that should appear in the action summary alongside goals.
const CARD_ACTION_TYPES = ['YELLOW_CARD', 'RED_CARD', 'SECOND_YELLOW_CARD'];

function isGoalOrCard(action: DetailAction, sportName: string): boolean {
  if (isGoalAction(sportName, action.actionType)) return true;
  const type = action.actionType.toUpperCase();
  if (CARD_ACTION_TYPES.includes(type)) return true;
  // Fallback: detect cards by localized label (covers custom actions).
  const label = action.actionLabel.toLowerCase();
  return (
    label.includes('amarilla') ||
    label.includes('roja') ||
    label.includes('tarjeta')
  );
}

function getTeamLabel(
  team: PublicTeam | null | undefined,
): string {
  if (!team) return '—';
  return team.name;
}

/**
 * Short team label for the 1X2 odds buttons: the meaningful part of the name
 * (before a "-" or "(" marker, e.g. "España-Mas(7A)" → "España"). The stored
 * shortName is ignored because legacy data contains truncated values.
 */
function oddsShortLabel(name: string): string {
  const base = name.split(/[-(]/)[0]?.trim() || name;
  return base.length > 12 ? `${base.slice(0, 12)}…` : base;
}

/* ════════════════════════════════════════════════════════════════════════════
   PLAYER POPOVER
   ════════════════════════════════════════════════════════════════════════════ */

function PlayerPopover({
  player,
  teamName,
  avatarSize = 36,
}: {
  player: PlayerDetail;
  teamName: string;
  avatarSize?: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-[var(--accent)] transition-all focus:outline-none focus:ring-[var(--accent)]"
          aria-label={`Ver perfil de ${player.name}`}
        >
          <Avatar style={{ width: avatarSize, height: avatarSize }}>
            {player.photo ? (
              <AvatarImage src={player.photo} alt={player.name} />
            ) : null}
            <AvatarFallback className="text-[11px] font-semibold bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {getInitials(player.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-2"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
        side="bottom"
        align="start"
      >
        <div className="flex items-center gap-3">
          <Avatar className="size-16">
            {player.photo ? (
              <AvatarImage src={player.photo} alt={player.name} />
            ) : null}
            <AvatarFallback className="text-sm font-bold bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {getInitials(player.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p
              className="font-semibold text-sm truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {player.name}
            </p>
            {player.nickname && (
              <p
                className="text-xs truncate"
                style={{ color: 'var(--text-secondary)' }}
              >
                &ldquo;{player.nickname}&rdquo;
              </p>
            )}
            <p
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              {teamName}
            </p>
          </div>
        </div>
        <Separator style={{ background: 'var(--border-custom)' }} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="text-[var(--text-muted)]">Número</span>
          <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
            #{player.number}
          </span>
          <span className="text-[var(--text-muted)]">Posición</span>
          <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
            {player.position || '—'}
          </span>
          {player.nationality && (
            <>
              <span className="text-[var(--text-muted)]">Nacionalidad</span>
              <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                {player.nationality}
              </span>
            </>
          )}
          {player.birthDate && (
            <>
              <span className="text-[var(--text-muted)]">Nacimiento</span>
              <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                {player.birthDate}
              </span>
            </>
          )}
          {player.height && (
            <>
              <span className="text-[var(--text-muted)]">Estatura</span>
              <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                {player.height}
              </span>
            </>
          )}
          {player.weight && (
            <>
              <span className="text-[var(--text-muted)]">Peso</span>
              <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                {player.weight}
              </span>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   WIN / DRAW / WIN ODDS ROW (Gana – Empata – Gana)
   ════════════════════════════════════════════════════════════════════════════ */

function OddsRow({
  teamALabel,
  teamBLabel,
  hasDraws,
  prediction,
  loading,
  picked,
  onPick,
}: {
  teamALabel: string;
  teamBLabel: string;
  hasDraws: boolean;
  prediction: PredictionResult | null;
  loading: boolean;
  picked?: WinDrawWinPick;
  onPick: (outcome: WinDrawWinPick) => void;
}) {
  const outcomes: Array<{ key: WinDrawWinPick; label: string; prob: number | null }> = [
    { key: 'A', label: `Gana ${teamALabel}`, prob: prediction ? prediction.probA : null },
    ...(hasDraws
      ? [{ key: 'DRAW' as const, label: 'Empata', prob: prediction ? prediction.probDraw : null }]
      : []),
    { key: 'B', label: `Gana ${teamBLabel}`, prob: prediction ? prediction.probB : null },
  ];

  return (
    <div className="flex gap-1.5 w-full" role="group" aria-label="Probabilidades del partido">
      {outcomes.map((o) => {
        const isSelected = picked === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(o.key);
            }}
            aria-pressed={isSelected}
            className="flex-1 min-h-[44px] rounded-lg flex flex-col items-center justify-center gap-1 px-1.5 py-1.5 transition-all cursor-pointer border"
            style={{
              background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
              color: isSelected ? '#fff' : 'var(--text-secondary)',
              borderColor: isSelected ? 'var(--accent)' : 'var(--border-custom)',
            }}
          >
            <span className="text-[10px] font-bold leading-none truncate max-w-full">
              {o.label}
            </span>
            {loading && !prediction ? (
              <Loader2 className="size-3 animate-spin" aria-label="Analizando" />
            ) : o.prob != null ? (
              <span
                className={`text-xs font-black tabular-nums leading-none ${isSelected ? 'text-white' : ''}`}
                style={isSelected ? undefined : { color: 'var(--text-primary)' }}
              >
                {Math.round(o.prob * 100)}%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MVP SECTION — Jugador del Partido
   ════════════════════════════════════════════════════════════════════════════ */

/** Maps an MVP entry to the PlayerDetail shape required by PlayerPopover. */
function mvpEntryToPlayerDetail(entry: MvpEntry): PlayerDetail {
  return {
    id: entry.playerId,
    name: entry.playerName,
    number: entry.playerNumber ?? 0,
    position: entry.playerPosition ?? '',
    nickname: entry.playerNickname,
    photo: entry.playerPhoto,
    birthDate: entry.playerBirthDate,
    nationality: entry.playerNationality,
    height: entry.playerHeight,
    weight: entry.playerWeight,
    teamId: entry.teamId,
  };
}

function MvpBreakdownChips({ breakdown }: { breakdown: MvpEntry['breakdown'] }) {
  const chips: string[] = [];
  if (breakdown.goals > 0) chips.push(`⚽ ${breakdown.goals}`);
  if (breakdown.ownGoals > 0) chips.push(`🎬 ${breakdown.ownGoals} autogol${breakdown.ownGoals > 1 ? 'es' : ''}`);
  if (breakdown.yellowCards > 0) chips.push(`🟨 ${breakdown.yellowCards}`);
  if (breakdown.blueCards > 0) chips.push(`🟦 ${breakdown.blueCards}`);
  if (breakdown.redCards > 0) chips.push(`🟥 ${breakdown.redCards}`);
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((c) => (
        <span
          key={c}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function MvpSection({
  mvp,
  teamAId,
  teamAName,
  teamBName,
}: {
  mvp: MvpResult;
  teamAId: string;
  teamAName: string;
  teamBName: string;
}) {
  const teamNameOf = (teamId: string) =>
    teamId === teamAId ? teamAName : teamBName;
  const runnersUp = mvp.podium.filter((p) => p.playerId !== mvp.mvp.playerId);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}>
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-custom)' }}>
        <div className="flex items-center gap-2">
          <Crown className="size-4" style={{ color: '#fbbf24' }} aria-hidden="true" />
          <h4 className="text-xs font-bold uppercase tracking-wider m-0" style={{ color: 'var(--text-muted)' }}>
            Jugador del Partido
          </h4>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
          style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}
        >
          ★ {mvp.mvp.rating.toFixed(1)}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Hero */}
        <div className="flex items-center gap-3">
          <PlayerPopover
            player={mvpEntryToPlayerDetail(mvp.mvp)}
            teamName={teamNameOf(mvp.mvp.teamId)}
            avatarSize={56}
          />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-sm sm:text-base truncate m-0" style={{ color: 'var(--text-primary)' }}>
              {mvp.mvp.playerName}
            </p>
            <p className="text-xs font-medium truncate m-0 mt-0.5" style={{ color: 'var(--accent)' }}>
              {teamNameOf(mvp.mvp.teamId)}
              {mvp.mvp.playerNumber != null && ` · #${mvp.mvp.playerNumber}`}
            </p>
            <div className="mt-1.5">
              <MvpBreakdownChips breakdown={mvp.mvp.breakdown} />
            </div>
          </div>
        </div>
        {/* Podium runners-up */}
        {runnersUp.length > 0 && (
          <div className="space-y-1 pt-1" style={{ borderTop: '1px dashed var(--border-custom)' }}>
            {runnersUp.map((p, idx) => (
              <div key={p.playerId} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true">{idx === 0 ? '🥈' : '🥉'}</span>
                <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {p.playerName}
                </span>
                <span className="truncate" style={{ color: 'var(--text-muted)' }}>
                  {teamNameOf(p.teamId)}
                </span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  ★ {p.rating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PREDICTION SECTION — Análisis de probabilidades (Dixon-Coles)
   ════════════════════════════════════════════════════════════════════════════ */

const FORM_LABELS: Record<'W' | 'D' | 'L', string> = { W: 'V', D: 'E', L: 'D' };
const FORM_STYLES: Record<'W' | 'D' | 'L', { background: string; color: string }> = {
  W: { background: 'rgba(34, 197, 94, 0.18)', color: '#22c55e' },
  D: { background: 'rgba(148, 163, 184, 0.18)', color: '#94a3b8' },
  L: { background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444' },
};

function FormChips({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) {
    return (
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Sin historial
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center size-[18px] rounded text-[9px] font-black"
          style={FORM_STYLES[f]}
          title={f === 'W' ? 'Victoria' : f === 'D' ? 'Empate' : 'Derrota'}
        >
          {FORM_LABELS[f]}
        </span>
      ))}
    </div>
  );
}

function ProbabilityBar({ label, prob, highlight }: { label: string; prob: number; highlight: boolean }) {
  const pct = Math.round(prob * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold w-[38%] truncate text-right" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: highlight ? 'var(--accent)' : 'rgba(148, 163, 184, 0.55)' }}
        />
      </div>
      <span className="text-xs font-black tabular-nums w-9 text-right" style={{ color: highlight ? 'var(--accent)' : 'var(--text-primary)' }}>
        {pct}%
      </span>
    </div>
  );
}

function TeamStatsMini({
  teamName,
  stats,
}: {
  teamName: string;
  stats: PredictionResult['teamA'];
}) {
  return (
    <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'var(--bg-card)' }}>
      <p className="text-[10px] font-bold uppercase truncate m-0" style={{ color: 'var(--accent)' }}>
        {teamName}
      </p>
      <FormChips form={stats.form} />
      <div className="grid grid-cols-4 gap-x-2 text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
        <span title="Partidos jugados">PJ {stats.played}</span>
        <span title="Victorias" style={{ color: 'var(--score-green)' }}>V {stats.won}</span>
        <span title="Empates">E {stats.drawn}</span>
        <span title="Derrotas" style={{ color: 'var(--accent-red)' }}>D {stats.lost}</span>
      </div>
      <p className="text-[10px] tabular-nums m-0" style={{ color: 'var(--text-muted)' }}>
        GF/GC {stats.goalsFor}/{stats.goalsAgainst} · prom {stats.avgGoalsFor.toFixed(1)}/{stats.avgGoalsAgainst.toFixed(1)}
      </p>
    </div>
  );
}

function PredictionSection({
  sportName,
  teamAName,
  teamBName,
  prediction,
  loading,
  pick,
  onPick,
}: {
  sportName: string;
  teamAName: string;
  teamBName: string;
  prediction: PredictionResult | null;
  loading: boolean;
  pick?: WinDrawWinPick;
  onPick: (outcome: WinDrawWinPick) => void;
}) {
  const hasDraws = sportHasDraws(sportName);
  const pickLabel =
    pick === 'A' ? `Gana ${teamAName}` : pick === 'B' ? `Gana ${teamBName}` : pick === 'DRAW' ? 'Empate' : null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}>
      <div className="px-4 py-2 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-custom)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="size-4 shrink-0" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <h4 className="text-xs font-bold uppercase tracking-wider m-0 truncate" style={{ color: 'var(--text-muted)' }}>
            ¿Quién gana?
          </h4>
        </div>
        {prediction && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            title="Modelo estadístico aplicado"
          >
            {prediction.model === 'dixon-coles' ? 'Dixon-Coles' : 'Dif. Normal'}
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <OddsRow
          teamALabel={oddsShortLabel(teamAName)}
          teamBLabel={oddsShortLabel(teamBName)}
          hasDraws={hasDraws}
          prediction={prediction}
          loading={loading}
          picked={pick}
          onPick={onPick}
        />
        {loading && !prediction ? (
          <div className="flex items-center justify-center gap-2 py-3" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs">Analizando el historial de ambos equipos…</span>
          </div>
        ) : prediction ? (
          <>
            {/* Probability bars */}
            <div className="space-y-1.5">
              <ProbabilityBar label={teamAName} prob={prediction.probA} highlight={pick === 'A'} />
              {hasDraws && <ProbabilityBar label="Empate" prob={prediction.probDraw} highlight={pick === 'DRAW'} />}
              <ProbabilityBar label={teamBName} prob={prediction.probB} highlight={pick === 'B'} />
            </div>

            {/* Expected score + live badge */}
            <div className="flex items-center justify-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="tabular-nums">
                Marcador esperado{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {prediction.expectedGoalsA} – {prediction.expectedGoalsB}
                </strong>
              </span>
              {prediction.live && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)' }}
                >
                  <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: 'var(--live-dot)' }} />
                  Ajustado al marcador y tiempo
                </span>
              )}
            </div>

            {/* Team stats */}
            <div className="grid grid-cols-2 gap-2">
              <TeamStatsMini teamName={teamAName} stats={prediction.teamA} />
              <TeamStatsMini teamName={teamBName} stats={prediction.teamB} />
            </div>

            {/* Footer */}
            <div className="space-y-1">
              {pickLabel && (
                <p className="text-[10px] font-semibold m-0" style={{ color: 'var(--accent)' }}>
                  Tu pronóstico: {pickLabel}
                </p>
              )}
              {prediction.insufficientData ? (
                <p className="text-[10px] m-0" style={{ color: 'var(--accent-yellow)' }}>
                  Sin historial registrado: probabilidades neutras basadas en el promedio del deporte.
                </p>
              ) : (
                <p className="text-[10px] m-0" style={{ color: 'var(--text-muted)' }}>
                  Basado en {prediction.teamA.played + prediction.teamB.played} partidos previos · Confiabilidad{' '}
                  {prediction.confidence === 'ALTA' ? 'alta' : prediction.confidence === 'MEDIA' ? 'media' : 'baja'}.
                </p>
              )}
              <p className="text-[9px] m-0" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                Modelo estadístico Dixon-Coles sobre partidos finalizados (ponderado por recencia). Solo con fines informativos.
              </p>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-center m-0" style={{ color: 'var(--text-muted)' }}>
            Elige un resultado para analizar las probabilidades según el historial de cada equipo.
          </p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMMENT ROW
   ════════════════════════════════════════════════════════════════════════════ */

function CommentRow({
  comment,
  actionMap,
  sportName,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
}: {
  comment: CommentData;
  actionMap: Map<string, DetailAction>;
  sportName: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
}) {
  const action = comment.actionId ? actionMap.get(comment.actionId) : undefined;
  const showPlayerPhoto =
    action?.player && isGoalAction(sportName, action.actionType);

  // Determine which team the player belongs to
  const playerTeamName = action?.player
    ? action.player.teamId === teamAId
      ? teamAName
      : action.player.teamId === teamBId
        ? teamBName
        : ''
    : '';

  return (
    <div
      className="flex items-start gap-2 py-2 px-1"
      style={{ color: 'var(--text-primary)' }}
    >
      {/* Player photo (only for goal actions with player) */}
      <div className="shrink-0 mt-0.5">
        {showPlayerPhoto && action?.player ? (
          <PlayerPopover player={action.player} teamName={playerTeamName} />
        ) : (
          <div
            className="size-9 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {comment.isAI ? '🤖' : <User className="size-4" style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          {/* Action icon */}
          {action && (
            <span className="text-sm shrink-0" aria-hidden="true">
              {action.actionIcon || '•'}
            </span>
          )}
          {/* Comment text */}
          <p className="text-sm leading-snug break-words">{comment.content}</p>
        </div>
        {/* Meta: minute badge + AI indicator */}
        <div className="flex items-center gap-2 mt-1">
          {action?.minute != null && (
            <span
              className="inline-flex items-center text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--accent)',
              }}
            >
              {action.minute}&apos;
            </span>
          )}
          <span
            className="text-[10px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatCommentTime(comment.createdAt)}
          </span>
          {comment.isAI && (
            <span className="text-[10px]" title="Comentario generado por IA">
              🤖 IA
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   EVENT CARD
   ════════════════════════════════════════════════════════════════════════════ */

function useLocationAds(cityId: string | null | undefined, enabled: boolean) {
  const [ads, setAds] = useState<GroupedAds>({ top: [], bottom: [], left: [], right: [] });

  useEffect(() => {
    if (!enabled) return;
    let url = '/api/ads/active';
    if (cityId) url += `?cityId=${encodeURIComponent(cityId)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAds(data.ads);
      })
      .catch(() => {});
  }, [cityId, enabled]);

  return ads;
}

function EventCard({
  event,
  isExpanded,
  liveElapsed,
  onClick,
  selectionMode,
  selected,
  onToggleSelect,
  prediction,
  predictionLoading,
  pick,
  onOddsPick,
}: {
  event: PublicEvent;
  isExpanded: boolean;
  liveElapsed: number | null;
  onClick: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  prediction?: PredictionResult | null;
  predictionLoading?: boolean;
  pick?: WinDrawWinPick;
  onOddsPick?: (eventId: string, outcome: WinDrawWinPick) => void;
}) {
  const isLive = event.status === 'LIVE';
  const isPaused = event.status === 'PAUSED';
  const showScore = isLive || isPaused;

  const teamA = event.teamA;
  const teamB = event.teamB;

  // 1X2 row: visible for upcoming/live events outside selection mode and
  // hidden while the card is expanded (the panel shows the full analysis).
  const showOdds =
    !selectionMode &&
    !isExpanded &&
    !!onOddsPick &&
    (event.status === 'SCHEDULED' || isLive || isPaused);

  return (
    <div
      className="rounded-lg transition-colors"
      style={{
        background: isExpanded ? 'var(--accent)' : (selectionMode && selected ? 'rgba(225, 29, 72, 0.06)' : 'var(--bg-card)'),
        border: isExpanded ? '2px solid var(--accent)' : (selectionMode && selected ? '2px solid var(--accent)' : '1px solid var(--border-custom)'),
        boxShadow: isExpanded ? '0 0 0 1px var(--accent)' : 'var(--shadow)',
      }}
    >
      {selectionMode && (
        <div
          className="flex items-center px-3 py-2 border-b"
          style={{ borderColor: selected ? 'transparent' : 'var(--border-custom)' }}
        >
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(event.id); }}
          >
            {selected ? (
              <CheckSquare className="size-5" style={{ color: 'var(--accent)' }} />
            ) : (
              <Square className="size-5" style={{ color: 'var(--text-muted)' }} />
            )}
            <span className="text-xs font-medium" style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>
              {selected ? 'Seleccionado' : 'Seleccionar'}
            </span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="w-full text-left p-4 gap-3 flex flex-col"
        onClick={selectionMode ? () => onToggleSelect?.(event.id) : onClick}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg" aria-hidden="true">{event.sport?.icon ?? '\U0001f3c6'}</span>
          {event.tournamentName && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-semibold"
              style={{ borderColor: isExpanded ? 'rgba(255,255,255,0.5)' : 'var(--accent)', color: isExpanded ? '#fff' : 'var(--accent)' }}>
              <Trophy className="size-3 mr-1" />{event.tournamentName}
            </Badge>
          )}
          {event.phase && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5"
              style={{ background: isExpanded ? 'rgba(255,255,255,0.2)' : undefined, color: isExpanded ? '#fff' : undefined }}>
              {event.phase}
            </Badge>
          )}
          {isLive && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
              style={{ color: isExpanded ? '#fff' : 'var(--accent-red)' }}>
              <span className="live-dot inline-block size-2 rounded-full" style={{ background: isExpanded ? '#fff' : 'var(--live-dot)' }} />
              En Vivo
            </span>
          )}
          {isPaused && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: isExpanded ? '#fff' : 'var(--accent-yellow)' }}>
              <span className="inline-block size-2 rounded-full" style={{ background: isExpanded ? '#fff' : 'var(--accent-yellow)' }} />
              Pausado
            </span>
          )}
          {event.streamingUrl && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold ml-1"
              style={{ color: isExpanded ? '#fff' : 'var(--accent)' }} title="Transmision disponible">
              <Video className="size-3" />
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex-1 min-w-0 text-right">
            <p className="font-bold text-sm sm:text-base"
              style={{ color: isExpanded ? '#fff' : 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}
              title={teamA?.name || ''}>{getTeamLabel(teamA)}</p>
          </div>
          {showScore ? (
            <div className="flex flex-col items-center px-3 shrink-0">
              <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none"
                style={{ color: isExpanded ? '#fff' : 'var(--score-green)' }}>{event.scoreA} - {event.scoreB}</p>
              {(isLive || isPaused) && (
                <p className="text-xs font-bold tabular-nums mt-1 flex items-center gap-1"
                  style={{ color: isExpanded ? 'rgba(255,255,255,0.9)' : (isLive ? 'var(--accent-red)' : 'var(--accent-yellow)') }}>
                  <Clock className="size-3" />
                  {formatTimer(isLive && liveElapsed != null ? liveElapsed : event.elapsedSeconds)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center px-3 shrink-0">
              <p className="text-xs flex items-center gap-1"
                style={{ color: isExpanded ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)' }}>
                <Calendar className="size-3" />{formatScheduledDate(event.scheduledAt)}
              </p>
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="font-bold text-sm sm:text-base"
              style={{ color: isExpanded ? '#fff' : 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}
              title={teamB?.name || ''}>{getTeamLabel(teamB)}</p>
          </div>
        </div>
        <div className="flex items-center mt-2"
          style={{ color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
          {(event.city || event.department || event.country || event.location) && (
            <span className="text-xs flex items-center gap-1 truncate"
              style={{ color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
              <MapPin className="size-3 shrink-0" />
              {[event.city?.name, event.department?.name, event.country?.name, event.location].filter(Boolean).join(' \u00b7 ')}
            </span>
          )}
        </div>
      </button>
      {showOdds && (
        <div className="px-3 pb-3 pt-1">
          <OddsRow
            teamALabel={oddsShortLabel(teamA?.name ?? '')}
            teamBLabel={oddsShortLabel(teamB?.name ?? '')}
            hasDraws={sportHasDraws(event.sport?.name ?? '')}
            prediction={prediction ?? null}
            loading={!!predictionLoading}
            picked={pick}
            onPick={(outcome) => onOddsPick?.(event.id, outcome)}
          />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   EXPANDED EVENT PANEL (below tabs, full width)
   ════════════════════════════════════════════════════════════════════════════ */

function ExpandedEventPanel({
  event, expandedData, expandedLoading, liveElapsed, onClose, fingerprint,
  prediction, predictionLoading, pick, onOddsPick,
}: {
  event: PublicEvent; expandedData: ExpandedData | null; expandedLoading: boolean;
  liveElapsed: number | null; onClose: () => void; fingerprint: string;
  prediction?: PredictionResult | null; predictionLoading?: boolean;
  pick?: WinDrawWinPick; onOddsPick?: (eventId: string, outcome: WinDrawWinPick) => void;
}) {
  const eventAds = useLocationAds(event.city?.id, !!expandedData?.streamingUrl);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const isLive = event.status === 'LIVE';
  const isPaused = event.status === 'PAUSED';
  const showScore = isLive || isPaused;

  const actionMap = useMemo(() => {
    const map = new Map<string, DetailAction>();
    if (expandedData) { for (const a of expandedData.actions) map.set(a.id, a); }
    return map;
  }, [expandedData]);

  useEffect(() => {
    if (expandedData?.comments.length) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [expandedData?.comments.length]);

  const summaryA = useMemo(() => {
    if (!expandedData) return [];
    return expandedData.actions
      .filter((a) => isGoalOrCard(a, expandedData.sportName) && a.player?.teamId === event.teamAId)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [expandedData, event.teamAId]);

  const summaryB = useMemo(() => {
    if (!expandedData) return [];
    return expandedData.actions
      .filter((a) => isGoalOrCard(a, expandedData.sportName) && a.player?.teamId === event.teamBId)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [expandedData, event.teamBId]);

  const commentsChronological = useMemo(() => {
    if (!expandedData) return [];
    return [...expandedData.comments].reverse();
  }, [expandedData]);

  const eventName = event.name || (event.teamA && event.teamB ? `${event.teamA.name} vs ${event.teamB.name}` : '\u2014');

  // 1X2 analysis is meaningful before/during the match only.
  const showPredictionSection =
    !!onOddsPick &&
    (event.status === 'SCHEDULED' || event.status === 'LIVE' || event.status === 'PAUSED');

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)', boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b" style={{ borderColor: 'var(--border-custom)' }}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', margin: 0 }}>{eventName}</h3>
          {(event.tournamentName || event.phase) && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)', margin: 0 }}>
              {[event.tournamentName, event.phase].filter(Boolean).join(' \u00b7 ')}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="size-8 ml-3 shrink-0 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }} aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {expandedLoading ? (
          <div className="py-8 space-y-4">
            <Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ) : expandedData ? (
          <>
            <div className="rounded-lg p-4 sm:p-5 text-center" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-extrabold text-lg sm:text-2xl truncate" style={{ color: 'var(--text-primary)' }}>{expandedData.teamAName}</p>
                </div>
                <div className="shrink-0 text-center">
                  {showScore ? (
                    <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none" style={{ color: 'var(--score-green)' }}>
                      {event.scoreA} - {event.scoreB}
                    </p>
                  ) : null}
                  {(isLive || isPaused) && (
                    <p className="text-sm font-bold tabular-nums mt-2 flex items-center justify-center gap-1"
                      style={{ color: isLive ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
                      <Clock className="size-3.5" />
                      {formatTimer(isLive && liveElapsed != null ? liveElapsed : event.elapsedSeconds)}
                      {event.currentHalf && (
                        <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                          {event.currentHalf === '1' && '1er Tiempo'}{event.currentHalf === '2' && '2do Tiempo'}
                          {event.currentHalf === '1Q' && '1er Cuarto'}{event.currentHalf === '2Q' && '2do Cuarto'}
                          {event.currentHalf === '3Q' && '3er Cuarto'}{event.currentHalf === '4Q' && '4to Cuarto'}
                          {event.currentHalf === 'OT' && 'Tiempo Extra'}{event.currentHalf === 'PT' && 'Penales'}
                          {!['1','2','1Q','2Q','3Q','4Q','OT','PT'].includes(event.currentHalf) && event.currentHalf}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-extrabold text-lg sm:text-2xl truncate" style={{ color: 'var(--text-primary)' }}>{expandedData.teamBName}</p>
                </div>
              </div>
            </div>
            {expandedData.mvp && (
              <MvpSection
                mvp={expandedData.mvp}
                teamAId={expandedData.teamAId}
                teamAName={expandedData.teamAName}
                teamBName={expandedData.teamBName}
              />
            )}
            {showPredictionSection && (
              <PredictionSection
                sportName={expandedData.sportName}
                teamAName={expandedData.teamAName}
                teamBName={expandedData.teamBName}
                prediction={prediction ?? null}
                loading={!!predictionLoading}
                pick={pick}
                onPick={(outcome) => onOddsPick?.(event.id, outcome)}
              />
            )}
            {expandedData.streamingUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="size-4" style={{ color: 'var(--accent)' }} />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Transmision en Vivo</h4>
                </div>
                <div className="relative w-full overflow-hidden rounded-lg" style={{ background: '#000', aspectRatio: '16 / 9' }}>
                  <StreamingEmbed streamingUrl={expandedData.streamingUrl} />
                  <AdOverlay position="top" ads={eventAds.top} fingerprint={fingerprint} />
                  <AdOverlay position="bottom" ads={eventAds.bottom} fingerprint={fingerprint} />
                  <AdOverlay position="left" ads={eventAds.left} fingerprint={fingerprint} />
                  <AdOverlay position="right" ads={eventAds.right} fingerprint={fingerprint} />
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <span>💬 Comentarios en vivo</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{commentsChronological.length}</span>
              </h4>
              <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-lg p-2" style={{ background: 'var(--bg-secondary)' }}>
                {commentsChronological.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No hay comentarios aún</p>
                ) : commentsChronological.map((c) => (
                  <CommentRow key={c.id} comment={c} actionMap={actionMap} sportName={expandedData.sportName}
                    teamAId={expandedData.teamAId} teamBId={expandedData.teamBId}
                    teamAName={expandedData.teamAName} teamBName={expandedData.teamBName} />
                ))}
                <div ref={commentsEndRef} />
              </div>
            </div>
            {(summaryA.length > 0 || summaryB.length > 0) && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>📋 Resumen de acciones</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--accent)' }}>{expandedData.teamAName}</p>
                    {summaryA.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm" aria-hidden="true">{a.actionIcon}</span>
                        <span className="font-bold tabular-nums min-w-[24px]">{a.minute != null ? `${a.minute}'` : ''}</span>
                        <span className="truncate">{a.player?.name ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--accent)' }}>{expandedData.teamBName}</p>
                    {summaryB.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm" aria-hidden="true">{a.actionIcon}</span>
                        <span className="font-bold tabular-nums min-w-[24px]">{a.minute != null ? `${a.minute}'` : ''}</span>
                        <span className="truncate">{a.player?.name ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════════════
   TOURNAMENT GROUPING TYPES
   ════════════════════════════════════════════════════════════════════════════ */

interface TournamentPhaseGroup {
  id: string;
  name: string;
  type: string;
  order: number;
  events: PublicEvent[];
}

interface TournamentGroup {
  id: string;
  name: string;
  logo: string | null;
  sport: { id: string; name: string; icon: string } | null;
  phases: TournamentPhaseGroup[];
}

/* ════════════════════════════════════════════════════════════════════════════
   STANDINGS TABLE
   ════════════════════════════════════════════════════════════════════════════ */

interface StandingRow {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (standings.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-custom)' }}>
      <table className="w-full text-xs" style={{ minWidth: '380px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            <th className="text-left px-2 py-1.5 font-bold" style={{ color: 'var(--text-muted)', width: '6%' }}>#</th>
            <th className="text-left px-2 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>Equipo</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>PJ</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>G</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>E</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>P</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>GF</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>GC</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>DG</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--accent)', width: '10%' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, idx) => (
            <tr
              key={row.teamId}
              className="transition-colors"
              style={{
                borderTop: '1px solid var(--border-custom)',
                background: idx < 2 ? 'rgba(225, 29, 72, 0.04)' : 'transparent',
              }}
            >
              <td className="px-2 py-1.5 font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {idx + 1}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  {row.teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.teamLogo} alt="" className="size-5 object-contain rounded shrink-0" />
                  ) : (
                    <div className="size-5 rounded shrink-0 flex items-center justify-center text-[8px] font-bold"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {row.teamName[0]}
                    </div>
                  )}
                  <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: '120px' }}>
                    {row.teamShortName || row.teamName}
                  </span>
                </div>
              </td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.played}</td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--score-green)' }}>{row.won}</td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.drawn}</td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--accent-red)' }}>{row.lost}</td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.goalsFor}</td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.goalsAgainst}</td>
              <td className="text-center px-1 py-1.5 tabular-nums font-semibold"
                style={{ color: row.goalDifference > 0 ? 'var(--score-green)' : row.goalDifference < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
              </td>
              <td className="text-center px-1 py-1.5 tabular-nums font-extrabold" style={{ color: 'var(--accent)' }}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCORERS TABLE (Goleadores / Anotadores / Carreras)
   ════════════════════════════════════════════════════════════════════════════ */

interface ScorerRow {
  playerId: string;
  playerName: string;
  playerNumber: number | null;
  playerPhoto: string | null;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogo: string | null;
  total: number;
  matchesPlayed: number;
  breakdown: Record<string, number>;
}

const SCORER_MEDALS = ['🥇', '🥈', '🥉'];

function ScorersTable({ scorers }: { scorers: ScorerRow[] }) {
  if (scorers.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-custom)' }}>
      <table className="w-full text-xs" style={{ minWidth: '340px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            <th className="text-left px-2 py-1.5 font-bold" style={{ color: 'var(--text-muted)', width: '6%' }}>#</th>
            <th className="text-left px-2 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>Jugador</th>
            <th className="text-left px-2 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>Equipo</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>PJ</th>
            <th className="text-center px-1 py-1.5 font-bold" style={{ color: 'var(--accent)', width: '10%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((row, idx) => (
            <tr
              key={row.playerId}
              className="transition-colors"
              style={{
                borderTop: '1px solid var(--border-custom)',
                background: idx < 3 ? 'rgba(225, 29, 72, 0.04)' : 'transparent',
              }}
            >
              <td className="px-2 py-1.5 font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {idx < 3 ? SCORER_MEDALS[idx] : idx + 1}
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  {row.playerPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.playerPhoto} alt="" className="size-5 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="size-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {row.playerName[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold truncate block" style={{ color: 'var(--text-primary)', maxWidth: '120px' }}>
                      {row.playerName}
                    </span>
                    {row.playerNumber != null && (
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>#{row.playerNumber}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  {row.teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.teamLogo} alt="" className="size-4 object-contain rounded shrink-0" />
                  ) : (
                    <div className="size-4 rounded shrink-0 flex items-center justify-center text-[7px] font-bold"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {row.teamName[0]}
                    </div>
                  )}
                  <span className="font-medium truncate" style={{ color: 'var(--text-secondary)', maxWidth: '100px' }}>
                    {row.teamShortName || row.teamName}
                  </span>
                </div>
              </td>
              <td className="text-center px-1 py-1.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.matchesPlayed}</td>
              <td className="text-center px-1 py-1.5 tabular-nums font-extrabold" style={{ color: 'var(--accent)' }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BRACKET VIEW (Elimination Tree)
   ════════════════════════════════════════════════════════════════════════════ */

interface BracketMatchData {
  id: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  scoreA: number;
  scoreB: number;
  status: string;
  scheduledAt: string | null;
  round: number;
}

interface BracketRoundData {
  phaseId: string;
  phaseName: string;
  phaseType: string;
  order: number;
  matches: BracketMatchData[];
}

function BracketView({
  rounds,
  thirdPlaceMatch,
  onEventClick,
}: {
  rounds: BracketRoundData[];
  thirdPlaceMatch: BracketMatchData | null;
  onEventClick?: (eventId: string) => void;
}) {
  if (rounds.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Mobile-friendly: vertical bracket (round by round) */}
      <div className="space-y-4">
        {rounds.map((round) => (
          <div key={round.phaseId}>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="size-3.5" style={{ color: 'var(--accent)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {round.phaseName}
              </h4>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(round.matches.length, 4)}, minmax(0, 1fr))` }}>
              {round.matches.map((match) => (
                <BracketMatchCard key={match.id} match={match} onClick={() => onEventClick?.(match.id)} />
              ))}
            </div>
            {round.matches.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                Por definir
              </p>
            )}
          </div>
        ))}

        {/* Third place match */}
        {thirdPlaceMatch && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-3.5" style={{ color: 'var(--accent-yellow)' }} />
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Tercer Puesto
              </h4>
            </div>
            <div className="max-w-xs mx-auto">
              <BracketMatchCard match={thirdPlaceMatch} onClick={() => onEventClick?.(thirdPlaceMatch.id)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatchCard({ match, onClick }: { match: BracketMatchData; onClick?: () => void }) {
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE' || match.status === 'PAUSED';
  const hasTeams = match.teamAName && match.teamBName;
  const winnerSide = isFinished
    ? match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : null
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg p-2 text-left transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isLive ? 'var(--accent-red)' : 'var(--border-custom)'}`,
        opacity: hasTeams ? 1 : 0.5,
      }}
    >
      {/* Team A */}
      <div className="flex items-center justify-between gap-1 py-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {match.teamALogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.teamALogo} alt="" className="size-4 object-contain rounded shrink-0" />
          ) : null}
          <span
            className="text-[11px] font-semibold truncate"
            style={{
              color: winnerSide === 'A' ? 'var(--score-green)' : 'var(--text-primary)',
              fontWeight: winnerSide === 'A' ? 800 : 600,
            }}
          >
            {match.teamAName || 'TBD'}
          </span>
        </div>
        {hasTeams && (
          <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>
            {match.scoreA}
          </span>
        )}
      </div>
      {/* Divider */}
      <div className="my-0.5" style={{ borderTop: '1px solid var(--border-custom)' }} />
      {/* Team B */}
      <div className="flex items-center justify-between gap-1 py-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {match.teamBLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.teamBLogo} alt="" className="size-4 object-contain rounded shrink-0" />
          ) : null}
          <span
            className="text-[11px] font-semibold truncate"
            style={{
              color: winnerSide === 'B' ? 'var(--score-green)' : 'var(--text-primary)',
              fontWeight: winnerSide === 'B' ? 800 : 600,
            }}
          >
            {match.teamBName || 'TBD'}
          </span>
        </div>
        {hasTeams && (
          <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>
            {match.scoreB}
          </span>
        )}
      </div>
      {/* Status */}
      {isLive && (
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: 'var(--live-dot)' }} />
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--accent-red)' }}>En Vivo</span>
        </div>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TOURNAMENT SECTION
   ════════════════════════════════════════════════════════════════════════════ */

const ELIMINATION_TYPES = ['ELIMINATORIA', 'OCTAVOS', 'CUARTOS', 'SEMIFINAL', 'FINAL', 'TERCER_PUESTO'];

function TournamentSection({
  tournament,
  onEventClick,
  liveElapsedFn,
  hideHeader = false,
}: {
  tournament: TournamentGroup;
  onEventClick: (eventId: string) => void;
  liveElapsedFn: (event: PublicEvent) => number | null;
  hideHeader?: boolean;
}) {
  const [activeView, setActiveView] = useState<'matches' | 'standings' | 'bracket' | 'scorers'>('matches');
  const [standings, setStandings] = useState<Array<{ phaseId: string; phaseName: string; phaseOrder: number; standings: StandingRow[] }>>([]);
  const [bracketData, setBracketData] = useState<{ rounds: BracketRoundData[]; thirdPlaceMatch: BracketMatchData | null } | null>(null);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [scorersTabLabel, setScorersTabLabel] = useState<string>('Goleadores');
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [scorersLoading, setScorersLoading] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const hasGrupos = tournament.phases.some((p) => p.type === 'GRUPOS');
  const hasElimination = tournament.phases.some((p) => ELIMINATION_TYPES.includes(p.type));
  const tournamentId = tournament.id.startsWith('legacy:') ? null : tournament.id;

  // Fetch standings
  useEffect(() => {
    if (!tournamentId || !hasGrupos) return;
    setStandingsLoading(true);
    fetch(`/api/public/tournaments/${tournamentId}/standings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStandings(data.standings ?? []);
      })
      .catch(() => {})
      .finally(() => setStandingsLoading(false));
  }, [tournamentId, hasGrupos]);

  // Fetch bracket
  useEffect(() => {
    if (!tournamentId || !hasElimination) return;
    setBracketLoading(true);
    fetch(`/api/public/tournaments/${tournamentId}/bracket`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setBracketData({
            rounds: data.rounds ?? [],
            thirdPlaceMatch: data.thirdPlaceMatch ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setBracketLoading(false));
  }, [tournamentId, hasElimination]);

  // Fetch scorers
  useEffect(() => {
    if (!tournamentId) return;
    setScorersLoading(true);
    fetch(`/api/public/tournaments/${tournamentId}/scorers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setScorers(data.scorers ?? []);
          setScorersTabLabel(data.tabLabel ?? 'Goleadores');
        }
      })
      .catch(() => {})
      .finally(() => setScorersLoading(false));
  }, [tournamentId]);

  // Determine default view
  useEffect(() => {
    if (hasGrupos) setActiveView('standings');
    else if (hasElimination) setActiveView('bracket');
    else setActiveView('matches');
  }, [hasGrupos, hasElimination]);

  // Group all events across phases for flat matches view
  const allEvents = useMemo(
    () => tournament.phases.flatMap((p) => p.events),
    [tournament.phases],
  );
  const liveInTournament = allEvents.filter((e) => e.status === 'LIVE' || e.status === 'PAUSED');

  return (
    <div className="space-y-3">
      {/* Tournament header (hidden when rendered inside a collapsible wrapper that already shows it) */}
      {!hideHeader && (
      <div className="flex items-center gap-3">        {tournament.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tournament.logo} alt="" className="size-8 object-contain rounded" />
        ) : (
          <div className="size-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)', color: '#fff' }}>
            <Trophy className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
            {tournament.name}
          </h3>
          {tournament.sport && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {tournament.sport.icon} {tournament.sport.name}
            </p>
          )}
        </div>
        {liveInTournament.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: 'var(--accent-red)' }}>
            <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: 'var(--live-dot)' }} />
            {liveInTournament.length} en vivo
          </span>
        )}
      </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1">
        {hasGrupos && (
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{
              background: activeView === 'standings' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeView === 'standings' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeView === 'standings' ? 'var(--accent)' : 'var(--border-custom)'}`,
            }}
            onClick={() => setActiveView('standings')}
          >
            <Table2 className="size-3" /> Posiciones
          </button>
        )}
        {hasElimination && (
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{
              background: activeView === 'bracket' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeView === 'bracket' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeView === 'bracket' ? 'var(--accent)' : 'var(--border-custom)'}`,
            }}
            onClick={() => setActiveView('bracket')}
          >
            <GitBranch className="size-3" /> Cuadro
          </button>
        )}
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
          style={{
            background: activeView === 'matches' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeView === 'matches' ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${activeView === 'matches' ? 'var(--accent)' : 'var(--border-custom)'}`,
          }}
          onClick={() => setActiveView('matches')}
        >
          <Calendar className="size-3" /> Partidos
        </button>
        {tournamentId && (
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{
              background: activeView === 'scorers' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeView === 'scorers' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeView === 'scorers' ? 'var(--accent)' : 'var(--border-custom)'}`,
            }}
            onClick={() => setActiveView('scorers')}
          >
            <Target className="size-3" /> {scorersTabLabel}
          </button>
        )}
      </div>

      {/* Content area */}
      {activeView === 'standings' && (
        <div className="space-y-4">
          {standingsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : standings.length > 0 ? (
            standings.map((group) => (
              <div key={group.phaseId} className="space-y-1.5">
                <h5 className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-secondary)' }}>
                  {group.phaseName}
                </h5>
                <StandingsTable standings={group.standings} />
                {/* Show phase events below standings */}
                <PhaseEventsList
                  events={tournament.phases.find(p => p.id === group.phaseId)?.events ?? []}
                  onEventClick={onEventClick}
                  liveElapsedFn={liveElapsedFn}
                />
              </div>
            ))
          ) : (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No hay datos de posiciones aun
            </p>
          )}
        </div>
      )}

      {activeView === 'bracket' && (
        <div>
          {bracketLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : bracketData ? (
            <BracketView
              rounds={bracketData.rounds}
              thirdPlaceMatch={bracketData.thirdPlaceMatch}
              onEventClick={onEventClick}
            />
          ) : (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No hay datos de cuadro eliminatorio
            </p>
          )}
          {/* Show finished matches from group phases if any */}
          {hasGrupos && (
            <div className="mt-4 space-y-2">
              <PhaseEventsList
                events={allEvents.filter(e => e.status === 'FINISHED')}
                onEventClick={onEventClick}
                liveElapsedFn={liveElapsedFn}
                title="Resultados"
              />
            </div>
          )}
        </div>
      )}

      {activeView === 'scorers' && (
        <div>
          {scorersLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : scorers.length > 0 ? (
            <ScorersTable scorers={scorers} />
          ) : (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No hay datos de {scorersTabLabel.toLowerCase()} aún
            </p>
          )}
        </div>
      )}

      {activeView === 'matches' && (
        <div className="space-y-2">
          {tournament.phases.map((phase) => (
            <div key={phase.id} className="space-y-1.5">
              <button
                type="button"
                className="flex items-center gap-2 w-full text-left px-1"
                onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              >
                <ChevronRight
                  className="size-3 transition-transform"
                  style={{
                    color: 'var(--text-muted)',
                    transform: expandedPhase === phase.id ? 'rotate(90deg)' : 'none',
                  }}
                />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {phase.name}
                </span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {phase.events.length} {phase.events.length === 1 ? 'partido' : 'partidos'}
                </span>
              </button>
              {(expandedPhase === phase.id || tournament.phases.length <= 1) && (
                <PhaseEventsList
                  events={phase.events}
                  onEventClick={onEventClick}
                  liveElapsedFn={liveElapsedFn}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PHASE EVENTS LIST
   ════════════════════════════════════════════════════════════════════════════ */

function PhaseEventsList({
  events,
  onEventClick,
  liveElapsedFn,
  title,
}: {
  events: PublicEvent[];
  onEventClick: (eventId: string) => void;
  liveElapsedFn: (event: PublicEvent) => number | null;
  title?: string;
}) {
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        // LIVE/PAUSED first, then SCHEDULED, then FINISHED
        const statusOrder = { LIVE: 0, PAUSED: 0, SCHEDULED: 1, FINISHED: 2, CANCELLED: 3 };
        const soA = statusOrder[a.status as keyof typeof statusOrder] ?? 9;
        const soB = statusOrder[b.status as keyof typeof statusOrder] ?? 9;
        if (soA !== soB) return soA - soB;
        return new Date(a.scheduledAt ?? '').getTime() - new Date(b.scheduledAt ?? '').getTime();
      }),
    [events],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {title && (
        <h5 className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-secondary)' }}>
          {title}
        </h5>
      )}
      {sorted.map((evt) => (
        <button
          key={evt.id}
          type="button"
          className="w-full text-left rounded-lg p-3 transition-colors"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-custom)',
            opacity: evt.status === 'FINISHED' ? 0.75 : 1,
          }}
          onClick={() => onEventClick(evt.id)}
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {evt.sport && <span className="text-xs">{evt.sport.icon}</span>}
            {evt.phase && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{evt.phase}</Badge>
            )}
            {evt.status === 'LIVE' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: 'var(--accent-red)' }}>
                <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: 'var(--live-dot)' }} />
                En Vivo
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {getTeamLabel(evt.teamA)}
              </p>
            </div>
            {(evt.status === 'LIVE' || evt.status === 'PAUSED' || evt.status === 'FINISHED') ? (
              <span className="text-sm font-black tabular-nums px-2 shrink-0" style={{ color: 'var(--score-green)' }}>
                {evt.scoreA} - {evt.scoreB}
              </span>
            ) : (
              <span className="text-[10px] flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="size-3" />{formatScheduledDate(evt.scheduledAt)}
              </span>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {getTeamLabel(evt.teamB)}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FINISHED SECTION
   ════════════════════════════════════════════════════════════════════════════ */

function FinishedSection({ events }: { events: PublicEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(b.endedAt ?? '').getTime() -
          new Date(a.endedAt ?? '').getTime(),
      ),
    [events],
  );
  if (sorted.length === 0) return null;

  const visible = showAll ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <section className="mt-8">
      <h3
        className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
        style={{ color: 'var(--text-muted)' }}
      >
        <Trophy className="size-4" />
        Finalizados
      </h3>
      <div className="space-y-2">
        {visible.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-custom)',
              opacity: 0.85,
            }}
          >
            <span className="text-base shrink-0" aria-hidden="true">
              {e.sport?.icon ?? '🏆'}
            </span>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span
                className="text-sm font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {getTeamLabel(e.teamA)}
              </span>
              <span
                className="text-sm font-bold tabular-nums shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                {e.scoreA} - {e.scoreB}
              </span>
              <span
                className="text-sm font-medium truncate text-right"
                style={{ color: 'var(--text-primary)' }}
              >
                {getTeamLabel(e.teamB)}
              </span>
            </div>
            <span
              className="text-[10px] uppercase font-semibold shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              Final
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs"
          style={{ color: 'var(--accent)' }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Ver menos' : `Ver más (${sorted.length - 5} restantes)`}
        </Button>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */

export function PublicView() {
  const navigate = useAppStore((s) => s.navigate);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  /* ── State ── */
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [tournaments, setTournaments] = useState<TournamentGroup[]>([]);
  const [nonTournamentEvents, setNonTournamentEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tournaments' | 'grid'>('tournaments');
  const [filterCountryId, setFilterCountryId] = useState<string | null>(null);
  const [filterDepartmentId, setFilterDepartmentId] = useState<string | null>(null);
  const [filterCityId, setFilterCityId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('live');
  const [gridPage, setGridPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<ExpandedData | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  // Tournaments are collapsed by default on the main view; the visitor expands
  // them by clicking the tournament header. We track which ones are OPEN to
  // keep new/refreshed tournaments collapsed unless explicitly toggled.
  const [openTournaments, setOpenTournaments] = useState<Set<string>>(new Set());
  const expandedDataRef = useRef<ExpandedData | null>(null);

  /* ── Win/Draw/Win predictions & visitor picks ── */
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({});
  const [predictionLoading, setPredictionLoading] = useState<Record<string, boolean>>({});
  const [picks, setPicks] = useState<Record<string, WinDrawWinPick>>({});
  const predictionsRef = useRef<Record<string, PredictionResult>>({});
  const predictionLoadingRef = useRef<Record<string, boolean>>({});
  const predictionFetchedAtRef = useRef<Record<string, number>>({});

  // Hydrate visitor picks from localStorage (favorites-like persistence).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PICKS_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setPicks(parsed as Record<string, WinDrawWinPick>);
    } catch {
      // corrupted storage — start fresh
    }
  }, []);

  /* ── Derived: expanded event from full events array (survives pagination) ── */
  const expandedEvent = useMemo(
    () => (expandedId ? events.find((e) => e.id === expandedId) ?? null : null),
    [expandedId, events],
  );
  useEffect(() => {
    if (expandedId && !expandedEvent) setExpandedId(null);
  }, [expandedId, expandedEvent]);

  /* ── Starter request state ── */
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNameForm, setShowNameForm] = useState(false);
  const [visitorName, setVisitorName] = useState('');

  /* ── Ads, fingerprint, site settings ── */
  const fingerprint = useVisitorFingerprint();
  const [siteSettings, setSiteSettings] = useState({ visitCounterEnabled: false, realtimeCounterEnabled: false, publicEventCreation: true });
  const realtimeCount = useRealtimeCounter(siteSettings.realtimeCounterEnabled);
  const [totalVisits, setTotalVisits] = useState(0);

  // Always track visits; the setting only controls the display counter
  useVisitTracker(fingerprint, { visitCounterEnabled: true });

  // Fetch site settings
  const [publications, setPublications] = useState<Array<{
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    type: string;
  }>>([]);
  const [expandedPub, setExpandedPub] = useState<string | null>(null);
  const [articleModal, setArticleModal] = useState<{ id: string; title: string; content: string; imageUrl: string | null } | null>(null);

  // Fetch site settings
  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSiteSettings({
          visitCounterEnabled: data.visitCounterEnabled === 'true',
          realtimeCounterEnabled: data.realtimeCounterEnabled === 'true',
          // Activado por defecto; solo se oculta si el admin lo desactiva explícitamente.
          publicEventCreation: data.publicEventCreationEnabled !== 'false',
        });
      })
      .catch(() => {});
  }, []);

  // Fetch total visit count (public endpoint, no auth needed)
  useEffect(() => {
    if (!siteSettings.visitCounterEnabled) return;
    fetch('/api/analytics/visits-count')
      .then((r) => r.json())
      .then((data) => setTotalVisits(data.totalVisits ?? 0))
      .catch(() => {});
  }, [siteSettings.visitCounterEnabled]);

  // Fetch active publications
  useEffect(() => {
    fetch('/api/publications/active')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPublications(data.publications);
      })
      .catch(() => {});
  }, []);

  /* ── Derived data ── */
  const liveEvents = useMemo(
    () => events.filter((e) => e.status === 'LIVE' || e.status === 'PAUSED'),
    [events],
  );

  const scheduledEvents = useMemo(
    () =>
      events
        .filter((e) => e.status === 'SCHEDULED')
        .sort(
          (a, b) =>
            new Date(a.scheduledAt ?? '').getTime() -
            new Date(b.scheduledAt ?? '').getTime(),
        ),
    [events],
  );

  const finishedEvents = useMemo(
    () => events.filter((e) => e.status === 'FINISHED'),
    [events],
  );

  // In tournaments mode, live/scheduled/finished come from non-tournament events only
  // (tournament events are displayed inside their tournament sections)
  const nonTournLive = useMemo(() => nonTournamentEvents.filter((e) => e.status === 'LIVE' || e.status === 'PAUSED'), [nonTournamentEvents]);
  const nonTournScheduled = useMemo(() => nonTournamentEvents.filter((e) => e.status === 'SCHEDULED').sort((a, b) => new Date(a.scheduledAt ?? '').getTime() - new Date(b.scheduledAt ?? '').getTime()), [nonTournamentEvents]);
  const nonTournFinished = useMemo(() => nonTournamentEvents.filter((e) => e.status === 'FINISHED'), [nonTournamentEvents]);

  // Determine which events to show in the tab/grid based on view mode
  const tabLiveEvents = viewMode === 'tournaments' ? nonTournLive : liveEvents;
  const tabScheduledEvents = viewMode === 'tournaments' ? nonTournScheduled : scheduledEvents;
  const tabFinishedEvents = viewMode === 'tournaments' ? nonTournFinished : finishedEvents;

  const displayedEvents = activeTab === 'live' ? tabLiveEvents : tabScheduledEvents;

  // Pagination for 3x3 grid
  const totalPages = Math.ceil(displayedEvents.length / GRID_PAGE_SIZE);
  const paginatedEvents = displayedEvents.slice(
    (gridPage - 1) * GRID_PAGE_SIZE,
    gridPage * GRID_PAGE_SIZE,
  );

  // Auto-switch tab: if no live events, go to scheduled
  useEffect(() => {
    if (tabLiveEvents.length === 0 && activeTab === 'live') {
      setActiveTab('scheduled');
    }
  }, [tabLiveEvents.length, activeTab]);

  // Reset page when tab or filters change
  useEffect(() => { setGridPage(1); }, [activeTab, filterCountryId, filterDepartmentId, filterCityId]);

  const activeFilterCount = [filterCountryId, filterDepartmentId, filterCityId].filter(Boolean).length;

  function clearFilters() {
    setFilterCountryId(null);
    setFilterDepartmentId(null);
    setFilterCityId(null);
  }

  /* ── Selection mode helpers ── */
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(displayedEvents.map((e) => e.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowNameForm(false);
    setVisitorName('');
  }

  const selectedCount = selectedIds.size;
  const selectedEvents = useMemo(
    () => displayedEvents.filter((e) => selectedIds.has(e.id)),
    [displayedEvents, selectedIds],
  );

  function buildWhatsAppLink() {
    const ADMIN_PHONE = '573226575422';
    let msg = '📋 *Solicitud de Iniciador*\n\n';
    if (visitorName.trim()) {
      msg += `👤 Nombre: ${visitorName.trim()}\n\n`;
    }
    msg += '🏆 *Eventos solicitados:*\n\n';

    selectedEvents.forEach((evt, i) => {
      const num = `${i + 1}️⃣`;
      const name = evt.name || `${evt.teamA?.name ?? '?'} vs ${evt.teamB?.name ?? '?'}`;
      msg += `${num} *${name}*\n`;
      if (evt.tournamentName) {
        let tourney = `   🏅 ${evt.tournamentName}`;
        if (evt.phase) tourney += ` · ${evt.phase}`;
        msg += `${tourney}\n`;
      }
      if (evt.scheduledAt) {
        const d = new Date(evt.scheduledAt);
        const dateStr = d.toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const timeStr = d.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        msg += `   📅 ${dateStr}, ${timeStr}\n`;
      }
      msg += '\n';
    });

    msg += 'Solicito iniciar estos eventos.';

    return `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(msg)}`;
  }

  /* ── Fetch events ── */
  const fetchEvents = useCallback(async () => {
    try {
      let url = '/api/public/events?';
      const params: string[] = [];
      if (filterCountryId) params.push(`countryId=${filterCountryId}`);
      if (filterDepartmentId) params.push(`departmentId=${filterDepartmentId}`);
      if (filterCityId) params.push(`cityId=${filterCityId}`);
      url += params.join('&');

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setEvents(data.events ?? []);
        setTournaments(data.tournaments ?? []);
        setNonTournamentEvents(data.nonTournamentEvents ?? []);
        setLastFetchTime(Date.now());
      }
    } catch {
      // silently ignore
    }
  }, [filterCountryId, filterDepartmentId, filterCityId]);

  /* ── Fetch expanded detail ── */
  const fetchExpanded = useCallback(async (eventId: string) => {
    // Only show loading skeleton on the very first load.
    // Subsequent refreshes update data silently so the iframe stays mounted.
    const isFirstLoad = !expandedDataRef.current;
    if (isFirstLoad) setExpandedLoading(true);
    try {
      const [detailRes, commentsRes] = await Promise.all([
        fetch(`/api/public/events/${eventId}`),
        fetch(`/api/public/events/${eventId}/comments`),
      ]);

      if (!detailRes.ok || !commentsRes.ok) {
        setExpandedLoading(false);
        return;
      }

      const detailData = await detailRes.json();
      const commentsData = await commentsRes.json();

      if (detailData.success && detailData.event) {
        const evt = detailData.event;
        const newExpanded = {
          actions: (evt.actions ?? []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            actionType: a.actionType as string,
            actionLabel: a.actionLabel as string,
            actionIcon: a.actionIcon as string,
            actionColor: a.actionColor as string,
            minute: a.minute as number | null,
            playerId: a.playerId as string | null,
            player: a.player
              ? {
                  id: (a.player as Record<string, unknown>).id as string,
                  name: (a.player as Record<string, unknown>).name as string,
                  number: (a.player as Record<string, unknown>).number as number,
                  position: (a.player as Record<string, unknown>).position as string,
                  nickname: (a.player as Record<string, unknown>).nickname as string | null,
                  photo: (a.player as Record<string, unknown>).photo as string | null,
                  birthDate: (a.player as Record<string, unknown>).birthDate as string | null,
                  nationality: (a.player as Record<string, unknown>).nationality as string | null,
                  height: (a.player as Record<string, unknown>).height as string | null,
                  weight: (a.player as Record<string, unknown>).weight as string | null,
                  teamId: (a.player as Record<string, unknown>).teamId as string,
                }
              : null,
          })),
          comments: commentsData.success
            ? (commentsData.comments ?? []).map((c: Record<string, unknown>) => ({
                id: c.id as string,
                eventId: c.eventId as string,
                content: c.content as string,
                isAI: c.isAI as boolean,
                actionId: c.actionId as string | null,
                userId: c.userId as string | null,
                createdAt: c.createdAt as string,
                user: c.user
                  ? {
                      id: (c.user as Record<string, unknown>).id as string,
                      username: (c.user as Record<string, unknown>).username as string,
                      name: (c.user as Record<string, unknown>).name as string,
                    }
                  : null,
              }))
            : [],
          streamingUrl: (evt.streamingUrl as string | null) ?? null,
          teamAId: evt.teamAId as string,
          teamBId: evt.teamBId as string,
          teamAName: (evt.teamA as Record<string, unknown>)?.name as string ?? '—',
          teamBName: (evt.teamB as Record<string, unknown>)?.name as string ?? '—',
          sportName: (evt.sport as Record<string, unknown>)?.name as string ?? '',
          mvp: (detailData.mvp as MvpResult | undefined) ?? null,
        };
        expandedDataRef.current = newExpanded;
        setExpandedData(newExpanded);
      }
    } catch {
      // silently ignore
    }
    setExpandedLoading(false);
  }, []);

  /* ── Geolocation-based country detection ── */
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`,
            { headers: { 'User-Agent': 'MarcadoresDJ/1.0' } }
          );
          const data = await res.json();
          const countryCode = data.address?.country_code?.toUpperCase();

          if (countryCode) {
            const countriesRes = await fetch('/api/locations?type=countries');
            const countriesData = await countriesRes.json();
            const match = (countriesData.countries || []).find(
              (c: { code: string | null }) => c.code === countryCode
            );
            if (match) {
              setFilterCountryId(match.id);
            }
          }
        } catch {
          // Silently fail - user will just see "Todos" selected
        }
      },
      () => { /* Permission denied or error - silent */ },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    fetchEvents().then(() => setLoading(false));
  }, [fetchEvents]);

  /* ── Auto-refresh events every 10s ── */
  useEffect(() => {
    const interval = setInterval(fetchEvents, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  /* ── Timer tick every second ── */
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TIMER_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  /* ── Refresh expanded detail every 10s ── */
  useEffect(() => {
    if (!expandedId) return;
    const interval = setInterval(() => fetchExpanded(expandedId), REFRESH_MS);
    return () => clearInterval(interval);
  }, [expandedId, fetchExpanded]);

  /* ── Toggle expand ── */
  const handleToggle = useCallback(
    (eventId: string) => {
      if (expandedId === eventId) {
        setExpandedId(null);
        setExpandedData(null);
        expandedDataRef.current = null;
      } else {
        setExpandedId(eventId);
        setExpandedData(null);
        expandedDataRef.current = null;
        fetchExpanded(eventId);
      }
    },
    [expandedId, fetchExpanded],
  );

  /* ── Fetch 1X2 prediction (cached; shorter TTL while live) ── */
  const fetchPrediction = useCallback(async (eventId: string, isLive: boolean) => {
    const ttl = isLive ? 60_000 : 5 * 60_000;
    const fresh =
      predictionsRef.current[eventId] != null &&
      Date.now() - (predictionFetchedAtRef.current[eventId] ?? 0) < ttl;
    if (fresh || predictionLoadingRef.current[eventId]) return;
    predictionLoadingRef.current[eventId] = true;
    setPredictionLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/public/events/${eventId}/prediction`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.prediction) {
          predictionsRef.current[eventId] = data.prediction;
          predictionFetchedAtRef.current[eventId] = Date.now();
          setPredictions((prev) => ({ ...prev, [eventId]: data.prediction }));
        }
      }
    } catch {
      // silently ignore (offline-tolerant)
    } finally {
      predictionLoadingRef.current[eventId] = false;
      setPredictionLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }, []);

  /* ── Odds click: pick + expand the event + fetch analysis ── */
  const handleOddsPick = useCallback(
    (eventId: string, outcome: WinDrawWinPick) => {
      setPicks((prev) => {
        const next = { ...prev, [eventId]: outcome };
        try {
          localStorage.setItem(PICKS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // storage unavailable — pick stays in memory
        }
        return next;
      });
      if (expandedId !== eventId) {
        setExpandedId(eventId);
        setExpandedData(null);
        expandedDataRef.current = null;
        fetchExpanded(eventId);
      }
      const evt = events.find((e) => e.id === eventId);
      fetchPrediction(eventId, evt?.status === 'LIVE' || evt?.status === 'PAUSED');
    },
    [expandedId, events, fetchExpanded, fetchPrediction],
  );

  /* ── Keep the prediction fresh while a live event panel is open ── */
  useEffect(() => {
    if (!expandedId) return;
    const evt = events.find((e) => e.id === expandedId);
    if (evt && (evt.status === 'LIVE' || evt.status === 'PAUSED')) {
      fetchPrediction(expandedId, true);
    }
  }, [expandedId, events, fetchPrediction]);

  /* ── Toggle tournament collapse (collapsed by default; click to open) ── */
  const toggleTournament = useCallback((tournamentId: string) => {
    setOpenTournaments((prev) => {
      const next = new Set(prev);
      if (next.has(tournamentId)) next.delete(tournamentId);
      else next.add(tournamentId);
      return next;
    });
  }, []);

  /* ── Count total events across all phases of a tournament ── */
  const countTournamentEvents = useCallback(
    (t: TournamentGroup) => t.phases.reduce((sum, p) => sum + p.events.length, 0),
    [],
  );

  /* ── Compute live elapsed seconds ── */
  const getLiveElapsed = useCallback(
    (event: PublicEvent): number | null => {
      if (event.status !== 'LIVE') return null;
      const added = Math.floor((now - lastFetchTime) / 1000);
      return Math.max(0, event.elapsedSeconds + added);
    },
    [now, lastFetchTime],
  );

  /* ── Login handler ── */
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Usuario y contraseña requeridos');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('marcadoresdj-token', data.token);
        localStorage.setItem('marcadoresdj-user', JSON.stringify(data.user));
        window.location.replace(window.location.pathname + '?logged=1&t=' + Date.now());
        return;
      } else {
        setLoginError(data.error || 'Error al iniciar sesión');
      }
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoginLoading(false);
    }
  }, [loginUsername, loginPassword]);

  // Check URL hash for login mode
  const [loginMode, setLoginMode] = useState(false);
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#login') {
        setLoginMode(true);
        history.replaceState(null, '', window.location.pathname);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  if (loginMode || showLoginForm) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mb-3 text-5xl" aria-hidden="true">🏆</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>MarcadoresDJ</h1>
          </div>
          <div className="rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input type="text" placeholder="Usuario" value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
                className="h-11 w-full rounded-lg border px-3 text-base" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} disabled={loginLoading} />
              <input type="password" placeholder="Contraseña" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                className="h-11 w-full rounded-lg border px-3 text-base" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} disabled={loginLoading} />
              {loginError && <p className="text-sm" style={{ color: '#ef4444' }}>{loginError}</p>}
              <button type="submit" disabled={loginLoading}
                className="h-11 w-full rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                {loginLoading ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>
              <button type="button" onClick={() => { setShowLoginForm(false); setLoginError(''); }}
                className="h-10 w-full rounded-lg text-sm" style={{ color: 'var(--text-secondary)' }}>
                ← Volver a marcadores
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <h1
            className="text-lg sm:text-xl font-extrabold tracking-tight"
            style={{ color: 'var(--accent)' }}
          >
            ⚡ MarcadoresDJ
          </h1>

          {/* Theme switcher + Login */}
          <div className="flex items-center gap-1.5">
            {THEME_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="icon"
                className="size-8"
                style={{
                  color:
                    theme === opt.value
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                  background:
                    theme === opt.value
                      ? 'var(--bg-card)'
                      : 'transparent',
                }}
                onClick={() => setTheme(opt.value)}
                aria-label={opt.label}
                title={opt.label}
              >
                {opt.icon}
              </Button>
            ))}
            <Separator orientation="vertical" className="h-5 mx-1" />
            {siteSettings.publicEventCreation && (
              <button
                type="button"
                onClick={() => setShowCreateWizard(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold min-h-[44px] transition-colors"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                }}
                title="Crea un evento público"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Crear evento</span>
                <span className="sm:hidden">Crear</span>
              </button>
            )}
            <a
              href="#login"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold min-h-[44px]"
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
                textDecoration: 'none',
              }}
            >
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
              <span className="sm:hidden">Login</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── TABS (show if there are live events OR tournaments) ── */}
      {(liveEvents.length > 0 || tournaments.length > 0) && (
        <div
          className="sticky top-[57px] z-40 border-b"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <div className="max-w-4xl mx-auto flex">
            <button
              type="button"
              className="flex-1 py-3 text-center text-sm font-bold uppercase tracking-wider transition-colors relative"
              style={{
                color: activeTab === 'live' ? 'var(--accent-red)' : 'var(--text-muted)',
                background: activeTab === 'live' ? 'var(--bg-card)' : 'transparent',
              }}
              onClick={() => { setActiveTab('live'); if (selectionMode) exitSelectionMode(); }}
            >
              <span className="inline-flex items-center gap-2">
                🔴 En Vivo
                {liveEvents.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center size-5 text-[10px] font-bold rounded-full"
                    style={{
                      background: 'var(--accent-red)',
                      color: '#ffffff',
                    }}
                  >
                    {liveEvents.length}
                  </span>
                )}
              </span>
              {activeTab === 'live' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--accent-red)' }}
                />
              )}
            </button>
            <button
              type="button"
              className="flex-1 py-3 text-center text-sm font-bold uppercase tracking-wider transition-colors relative"
              style={{
                color: activeTab === 'scheduled' ? 'var(--accent)' : 'var(--text-muted)',
                background: activeTab === 'scheduled' ? 'var(--bg-card)' : 'transparent',
              }}
              onClick={() => setActiveTab('scheduled')}
            >
              <span className="inline-flex items-center gap-2">
                📋 Programados
                {scheduledEvents.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center size-5 text-[10px] font-bold rounded-full"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    {scheduledEvents.length}
                  </span>
                )}
              </span>
              {activeTab === 'scheduled' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          </div>

          {/* ── View mode toggle (tournaments vs grid) ── */}
          {tournaments.length > 0 && (
            <div className="max-w-4xl mx-auto flex items-center gap-2 px-4 pb-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: viewMode === 'tournaments' ? 'var(--accent)' : 'var(--bg-card)',
                  color: viewMode === 'tournaments' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${viewMode === 'tournaments' ? 'var(--accent)' : 'var(--border-custom)'}`,
                }}
                onClick={() => setViewMode('tournaments')}
              >
                <Trophy className="size-3" /> Torneos
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: viewMode === 'grid' ? 'var(--accent)' : 'var(--bg-card)',
                  color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${viewMode === 'grid' ? 'var(--accent)' : 'var(--border-custom)'}`,
                }}
                onClick={() => setViewMode('grid')}
              >
                <Calendar className="size-3" /> Todos
              </button>
            </div>
          )}

          {/* ── Starter request button (scheduled tab only) ── */}
          {activeTab === 'scheduled' && !selectionMode && scheduledEvents.length > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors"
                style={{
                  background: '#25D366',
                  color: '#fff',
                }}
                onClick={() => setSelectionMode(true)}
                title="Solicitar como Iniciador"
              >
                <UserPlus className="size-3" />
                <span className="hidden sm:inline">Solicitar Iniciar</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LOCATION FILTERS (scheduled tab only) ── */}
      {activeTab === 'scheduled' && (
        <div
          className="sticky top-[99px] z-30 border-b"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <div className="max-w-2xl mx-auto px-4 py-2 space-y-2">
            {/* Filter toggle bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors min-h-[40px]"
                style={{
                  borderColor: showFilters ? 'var(--accent)' : 'var(--border-custom)',
                  color: showFilters ? 'var(--accent)' : 'var(--text-secondary)',
                  background: showFilters ? 'var(--bg-card)' : 'transparent',
                }}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="size-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center size-5 text-[10px] font-bold rounded-full"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg-primary)',
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors min-h-[40px]"
                  style={{
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-muted)',
                  }}
                  onClick={clearFilters}
                  aria-label="Limpiar filtros"
                >
                  <X className="size-3.5" />
                  <span className="hidden sm:inline">Limpiar</span>
                </button>
              )}
            </div>

            {/* Filter panel (collapsible) */}
            <div
              style={{
                maxHeight: showFilters ? '300px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out',
              }}
            >
              <div
                className="rounded-lg p-4 space-y-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-custom)',
                }}
              >
                <LocationSelector
                  countryId={filterCountryId}
                  departmentId={filterDepartmentId}
                  cityId={filterCityId}
                  onCountryChange={(id) => {
                    setFilterCountryId(id);
                    setFilterDepartmentId(null);
                    setFilterCityId(null);
                  }}
                  onDepartmentChange={(id) => {
                    setFilterDepartmentId(id);
                    setFilterCityId(null);
                  }}
                  onCityChange={setFilterCityId}
                />
                <button
                  type="button"
                  className="w-full text-xs font-medium py-1.5 rounded-md transition-colors"
                  style={{
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                  }}
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPANDED EVENT PANEL (below tabs, full width) ── */}
      {expandedEvent && (
        <div className="px-4 sm:px-6 py-3">
          <div className="max-w-4xl mx-auto">
            <ExpandedEventPanel
              event={expandedEvent}
              expandedData={expandedData}
              expandedLoading={expandedLoading}
              liveElapsed={expandedEvent.status === 'LIVE' ? getLiveElapsed(expandedEvent) : null}
              onClose={() => handleToggle(expandedEvent.id)}
              fingerprint={fingerprint}
              prediction={predictions[expandedEvent.id]}
              predictionLoading={!!predictionLoading[expandedEvent.id]}
              pick={picks[expandedEvent.id]}
              onOddsPick={handleOddsPick}
            />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-3">
        {loading ? (
          /* Loading skeletons — 3x3 grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-4 space-y-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-custom)',
                }}
              >
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : viewMode === 'tournaments' && tournaments.length > 0 ? (
          /* ── TOURNAMENT VIEW (collapsed by default, expand on click) ── */
          <div className="space-y-3">
            {tournaments.map((t) => {
              const eventCount = countTournamentEvents(t);
              const liveCount = t.phases
                .flatMap((p) => p.events)
                .filter((e) => e.status === 'LIVE' || e.status === 'PAUSED').length;
              const isOpen = openTournaments.has(t.id);
              return (
                <div
                  key={t.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-custom)',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  {/* Collapsible header (click to toggle) */}
                  <button
                    type="button"
                    onClick={() => toggleTournament(t.id)}
                    aria-expanded={isOpen}
                    aria-controls={`tournament-body-${t.id}`}
                    className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:opacity-90"
                  >
                    {t.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logo} alt="" className="size-8 object-contain rounded shrink-0" />
                    ) : (
                      <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
                        <Trophy className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>
                        {t.name}
                      </h3>
                      {t.sport && (
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {t.sport.icon} {t.sport.name}
                        </p>
                      )}
                    </div>
                    {liveCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase shrink-0" style={{ color: 'var(--accent-red)' }}>
                        <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: 'var(--live-dot)' }} />
                        {liveCount} en vivo
                      </span>
                    )}
                    <span
                      className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-custom)',
                      }}
                    >
                      {eventCount} {eventCount === 1 ? 'evento' : 'eventos'}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 transition-transform"
                      style={{
                        color: 'var(--text-muted)',
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                      }}
                    />
                  </button>

                  {/* Body: only render when open (keeps heavy TournamentSection work lazy) */}
                  {isOpen && (
                    <div id={`tournament-body-${t.id}`} className="px-4 pb-4 pt-1 space-y-1">
                      <TournamentSection
                        tournament={t}
                        onEventClick={(eventId) => handleToggle(eventId)}
                        liveElapsedFn={getLiveElapsed}
                        hideHeader
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Non-tournament events (grid) */}
            {displayedEvents.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"
                  style={{ color: 'var(--text-muted)' }}>
                  <Calendar className="size-3.5" />
                  Otros Eventos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginatedEvents.map((evt) => (
                    <EventCard
                      key={evt.id}
                      event={evt}
                      isExpanded={expandedId === evt.id}
                      liveElapsed={getLiveElapsed(evt)}
                      onClick={() => handleToggle(evt.id)}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(evt.id)}
                      onToggleSelect={toggleSelect}
                      prediction={predictions[evt.id]}
                      predictionLoading={!!predictionLoading[evt.id]}
                      pick={picks[evt.id]}
                      onOddsPick={handleOddsPick}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
                    <button type="button" disabled={gridPage <= 1} onClick={() => setGridPage((p) => p - 1)}
                      className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)', color: 'var(--text-secondary)' }}
                      aria-label="Pagina anterior"><ChevronLeft className="size-4" /></button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button key={page} type="button" onClick={() => setGridPage(page)}
                        className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-bold transition-colors"
                        style={{ background: gridPage === page ? 'var(--accent)' : 'var(--bg-card)', border: `1px solid ${gridPage === page ? 'var(--accent)' : 'var(--border-custom)'}`, color: gridPage === page ? '#fff' : 'var(--text-secondary)' }}>
                        {page}
                      </button>
                    ))}
                    <button type="button" disabled={gridPage >= totalPages} onClick={() => setGridPage((p) => p + 1)}
                      className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)', color: 'var(--text-secondary)' }}
                      aria-label="Pagina siguiente"><ChevronRight className="size-4" /></button>
                  </div>
                )}
              </div>
            )}

            {/* Fully empty in tournaments mode */}
            {tournaments.length === 0 && displayedEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <p className="text-4xl mb-3 opacity-40">📅</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No hay eventos programados</p>
              </div>
            )}
          </div>
        ) : displayedEvents.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-4xl mb-3 opacity-40">
              {activeTab === 'live' ? '📺' : '📅'}
            </p>
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              {activeTab === 'live'
                ? 'No hay eventos en vivo en este momento'
                : 'No hay eventos programados'}
            </p>
            <p
              className="text-xs mt-1 max-w-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {activeTab === 'live'
                ? 'Los eventos en vivo aparecerán aquí automáticamente cuando comiencen.'
                : 'Los próximos eventos programados se mostrarán en esta sección.'}
            </p>
          </div>
        ) : (
          /* ── 3x3 Grid ── */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  isExpanded={expandedId === evt.id}
                  liveElapsed={getLiveElapsed(evt)}
                  onClick={() => handleToggle(evt.id)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(evt.id)}
                  onToggleSelect={toggleSelect}
                  prediction={predictions[evt.id]}
                  predictionLoading={!!predictionLoading[evt.id]}
                  pick={picks[evt.id]}
                  onOddsPick={handleOddsPick}
                />
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-2 pb-1">
                <button
                  type="button"
                  disabled={gridPage <= 1}
                  onClick={() => setGridPage((p) => p - 1)}
                  className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-secondary)',
                  }}
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setGridPage(page)}
                    className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-bold transition-colors"
                    style={{
                      background: gridPage === page ? 'var(--accent)' : 'var(--bg-card)',
                      border: `1px solid ${gridPage === page ? 'var(--accent)' : 'var(--border-custom)'}`,
                      color: gridPage === page ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={gridPage >= totalPages}
                  onClick={() => setGridPage((p) => p + 1)}
                  className="inline-flex items-center justify-center size-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-secondary)',
                  }}
                  aria-label="Pagina siguiente"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Sticky selection bar ── */}
        {selectionMode && (
          <div
            className="sticky bottom-0 z-40 border-t"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {!showNameForm ? (
              /* ── Selection controls ── */
              <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
                    onClick={exitSelectionMode}
                  >
                    <X className="size-3.5" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium transition-colors"
                    style={{ color: 'var(--accent)' }}
                    onClick={selectedCount === displayedEvents.length ? deselectAll : selectAll}
                  >
                    {selectedCount === displayedEvents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                {selectedCount > 0 ? (
                  <Button
                    onClick={() => setShowNameForm(true)}
                    className="h-9 text-xs font-bold gap-1.5"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    <MessageCircle className="size-3.5" />
                    Enviar WhatsApp ({selectedCount})
                  </Button>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Selecciona eventos
                  </span>
                )}
              </div>
            ) : (
              /* ── Name form + send ── */
              <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Tu nombre (opcional)"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') window.open(buildWhatsAppLink(), '_blank');
                    }}
                    className="flex-1 h-9 rounded-lg px-3 text-sm outline-none"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-custom)',
                      color: 'var(--text-primary)',
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={() => setShowNameForm(false)}
                  >
                    Atras
                  </button>
                  <a
                    href={buildWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors no-underline"
                    style={{ background: '#25D366', color: '#fff' }}
                    onClick={exitSelectionMode}
                  >
                    <MessageCircle className="size-3.5" />
                    Enviar Solicitud
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Finished events ── */}
        {!loading && <FinishedSection events={tabFinishedEvents} />}
      </main>

      {/* ── PUBLICATIONS STRIP (above footer) ── */}
      {publications.length > 0 && (
        <div
          className="border-t"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
            padding: '10px 0',
          }}
        >
          <div
            className="flex gap-3 overflow-x-auto px-4 pb-1"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {publications.map((pub) => (
              <div
                key={pub.id}
                className="shrink-0 cursor-pointer rounded-lg overflow-hidden"
                style={{
                  width: '240px',
                  border: '1px solid var(--border-custom)',
                  background: 'var(--bg-card)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onClick={() => {
                  if (pub.type === 'article') {
                    setArticleModal({ id: pub.id, title: pub.title, content: pub.content, imageUrl: pub.imageUrl });
                  } else {
                    setExpandedPub(expandedPub === pub.id ? null : pub.id);
                  }
                }}
              >
                {/* Image */}
                {pub.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pub.imageUrl}
                    alt={pub.title}
                    className="w-full object-cover"
                    style={{ height: '100px' }}
                  />
                )}
                {/* Title + truncated content */}
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <p
                      className="text-xs font-semibold leading-tight"
                      style={{
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {pub.title}
                    </p>
                    {pub.type === 'article' && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--accent)', flexShrink: 0 }}>Leer mas</span>
                    )}
                  </div>
                  {pub.type !== 'article' && (
                    <>
                      {expandedPub !== pub.id ? (
                        <p
                          className="mt-1 leading-snug"
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {pub.content}
                        </p>
                      ) : (
                        <p
                          className="mt-1 leading-snug"
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '120px',
                            overflowY: 'auto',
                          }}
                        >
                          {pub.content}
                        </p>
                      )}
                    </>
                  )}
                  {pub.type === 'article' && (
                    <p
                      className="mt-1 leading-snug"
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {pub.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ARTICLE MODAL (lightbox) ── */}
      {articleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setArticleModal(null)}
        >
          <div
            className="rounded-xl overflow-hidden w-full max-w-lg max-h-[85vh] flex flex-col"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header image */}
            {articleModal.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={articleModal.imageUrl}
                alt={articleModal.title}
                className="w-full object-cover"
                style={{ maxHeight: '250px' }}
              />
            )}
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: 'var(--border-custom)' }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>
                {articleModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setArticleModal(null)}
                className="size-7 flex items-center justify-center rounded-full transition-colors"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p
                className="leading-relaxed whitespace-pre-wrap"
                style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}
              >
                {articleModal.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer
        className="border-t mt-auto py-3 text-center"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <div className="flex items-center justify-center gap-3 flex-wrap px-4">
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Potenciado por CopyExpress · 3226575422 · MarcadoresDJ - Eventos Deportivos Gratis
          </p>
          {(siteSettings.visitCounterEnabled || siteSettings.realtimeCounterEnabled) && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
          )}
          {siteSettings.visitCounterEnabled && (
            <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Eye className="size-3" />
              {totalVisits.toLocaleString('es-CO')} visitas
            </p>
          )}
          {siteSettings.realtimeCounterEnabled && (
            <p className="text-[10px] flex items-center gap-1" style={{ color: '#25D366' }}>
              <span className="inline-block size-1.5 rounded-full animate-pulse" style={{ background: '#25D366' }} />
              {realtimeCount} en linea
            </p>
          )}
        </div>
      </footer>

      {/* ── Public event creation wizard ── */}
      <PublicEventWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
      />
    </div>
  );
}