'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Radio,
  Clock,
  MapPin,
  Eye,
  Calendar,
  X,
  Users,
  Pencil,
  Trash2,
  Trophy,
  FileText,
  Upload,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAppStore, type SportEvent, type Player } from '@/lib/store';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { calculateMVP, type MVPResult } from '@/lib/mvp-utils';
import { useToast } from '@/hooks/use-toast';
import { EditEventModal } from '@/components/events/edit-event-modal';
import { ImportEventsModal } from '@/components/events/import-events-modal';

/* ── Constants ──────────────────────────────────────────────────────────────── */

type StatusFilter = 'ALL' | 'LIVE' | 'PAUSED' | 'SCHEDULED' | 'FINISHED';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SCHEDULED', label: 'Programados' },
  { value: 'LIVE', label: 'En Vivo' },
  { value: 'PAUSED', label: 'Pausados' },
  { value: 'FINISHED', label: 'Finalizados' },
];

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function statusConfig(status: string) {
  switch (status) {
    case 'LIVE':
      return { label: 'En Vivo', color: '#ef4444', dot: true };
    case 'PAUSED':
      return { label: 'Pausado', color: '#eab308', dot: false };
    case 'FINISHED':
      return { label: 'Finalizado', color: '#22c55e', dot: false };
    case 'SCHEDULED':
    default:
      return { label: 'Programado', color: '#6b7280', dot: false };
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDate(dateStr: string | null): string {
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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ── Status Badge ───────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status);

  return (
    <Badge
      variant="outline"
      className="text-[10px] font-bold px-1.5 py-0 shrink-0"
      style={{
        borderColor: cfg.color,
        color: cfg.color,
        background: `${cfg.color}15`,
      }}
    >
      {cfg.dot && (
        <span
          className="live-dot inline-block size-1.5 rounded-full mr-1"
          style={{ background: cfg.color }}
        />
      )}
      {cfg.label}
    </Badge>
  );
}

/* ── MVP Badge ──────────────────────────────────────────────────────────────── */

function MVPBadgeMini({ mvp }: { mvp: MVPResult }) {
  const scoreLabel = Number.isInteger(mvp.score) ? `${mvp.score}` : mvp.score.toFixed(1);
  const initials = mvp.playerName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="inline-flex items-center gap-1 shrink-0"
      title={`Jugador del Partido: ${mvp.playerName} (#${mvp.playerNumber}) — ${scoreLabel}/10`}
    >
      <div className="relative shrink-0">
        <div
          className="flex items-center justify-center size-6 rounded-full overflow-hidden border-2"
          style={{ borderColor: '#fbbf24', background: 'rgba(251,191,36,0.12)' }}
        >
          {mvp.playerPhoto ? (
            <img src={mvp.playerPhoto} alt={mvp.playerName} className="size-full object-cover" />
          ) : (
            <span className="text-[8px] font-bold" style={{ color: 'var(--text-secondary)' }}>{initials || '?'}</span>
          )}
        </div>
        <span
          className="absolute -top-1 -right-1 flex items-center justify-center size-3.5 rounded-full"
          style={{ background: '#fbbf24' }}
        >
          <Star className="size-2" fill="#1a1a1a" color="#1a1a1a" />
        </span>
      </div>
      <span
        className="text-[10px] font-extrabold tabular-nums px-1 py-0.5 rounded-full leading-none"
        style={{ background: '#fbbf24', color: '#1a1a1a' }}
      >
        {scoreLabel}
      </span>
    </div>
  );
}

/* ── Event Card (mobile / default) ──────────────────────────────────────────── */

function EventCard({
  event,
  onClick,
  onGoLive,
  onResume,
  onEdit,
  onDelete,
  onReport,
  isCreatorOrAdmin,
  startingId,
  sportActions,
}: {
  event: SportEvent;
  onClick: () => void;
  onGoLive: () => void;
  onResume: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onReport: () => void;
  isCreatorOrAdmin: boolean;
  startingId: string | null;
  sportActions?: { name: string; mvpWeight: number }[];
}) {
  const cfg = statusConfig(event.status);
  const isLive = event.status === 'LIVE' || event.status === 'PAUSED';
  const isStarting = startingId === event.id;

  const showMVP = (isLive || event.status === 'FINISHED') && sportActions && sportActions.length > 0;
  const mvp = useMemo(
    () => (showMVP ? calculateMVP(event.actions ?? [], sportActions!) : null),
    [showMVP, event.actions, sportActions],
  );

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all duration-150 hover:scale-[1.005]"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-custom)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-custom)';
      }}
    >
      <div className="flex items-stretch">
        {/* Status strip */}
        <div className="w-1 shrink-0" style={{ background: cfg.color }} />
        <CardContent className="flex-1 p-4">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base" aria-hidden="true">{event.sport?.icon}</span>
            <StatusBadge status={event.status} />
            {isLive && (
              <span
                className="ml-auto text-xs flex items-center gap-1 tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Clock className="size-3" />
                {formatElapsed(event.elapsedSeconds)}
              </span>
            )}
            {!isLive && event.scheduledAt && (
              <span
                className="ml-auto text-[11px] flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <Calendar className="size-3" />
                {formatDate(event.scheduledAt)}
              </span>
            )}
          </div>

          {/* Score / Teams */}
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <div className="text-right min-w-0 flex-1 flex flex-col items-end gap-1">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.teamA?.name}
              </p>
              {mvp && <MVPBadgeMini mvp={mvp} />}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-2xl sm:text-3xl font-extrabold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.scoreA}
              </span>
              <span
                className="text-base font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                -
              </span>
              <span
                className="text-2xl sm:text-3xl font-extrabold tabular-nums"
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

          {/* Bottom info */}
          {event.location && (
            <div className="mt-2 flex items-center justify-center gap-1">
              <MapPin className="size-3" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {event.location}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {/* Go Live / Resume / Scoring / Finished */}
            {event.status === 'SCHEDULED' && isCreatorOrAdmin && (
              <Button
                size="sm"
                className="flex-1 text-xs font-bold h-8"
                disabled={isStarting}
                style={{
                  background: isStarting ? 'var(--bg-card)' : '#dc2626',
                  color: isStarting ? 'var(--text-muted)' : '#fff',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGoLive();
                }}
              >
                {isStarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span className="inline-block size-2 rounded-full bg-white mr-1.5 animate-pulse" />
                )}
                Ir en Vivo
              </Button>
            )}

            {event.status === 'PAUSED' && isCreatorOrAdmin && (
              <Button
                size="sm"
                className="flex-1 text-xs font-bold h-8"
                disabled={isStarting}
                style={{
                  background: isStarting ? 'var(--bg-card)' : '#16a34a',
                  color: isStarting ? 'var(--text-muted)' : '#fff',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onResume();
                }}
              >
                {isStarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span className="mr-1.5">▶️</span>
                )}
                Reanudar
              </Button>
            )}

            {isLive && (
              <Button
                size="sm"
                className="flex-1 text-xs font-semibold h-8"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
              >
                <Radio className="size-3.5 mr-1.5" />
                📊 Ir al Marcador
              </Button>
            )}

            {event.status === 'FINISHED' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-[11px] font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReport();
                  }}
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <FileText className="size-3 mr-1" />
                  Reporte
                </Button>
                <span
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md h-8 text-xs font-semibold"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  ✅ Finalizado
                </span>
              </div>
            )}

            {/* Edit button */}
            {isCreatorOrAdmin && event.status !== 'FINISHED' && (
              <Button
                size="icon"
                className="size-8 shrink-0"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(e);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}

            {/* Delete button */}
            {isCreatorOrAdmin && (
              <Button
                size="icon"
                className="size-8 shrink-0"
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

/* ── Event Table Row (desktop) ──────────────────────────────────────────────── */

function EventTableRow({
  event,
  onClick,
  onGoLive,
  onResume,
  onEdit,
  onDelete,
  onReport,
  isCreatorOrAdmin,
  startingId,
  sportActions,
}: {
  event: SportEvent;
  onClick: () => void;
  onGoLive: () => void;
  onResume: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onReport: () => void;
  isCreatorOrAdmin: boolean;
  startingId: string | null;
  sportActions?: { name: string; mvpWeight: number }[];
}) {
  const cfg = statusConfig(event.status);
  const isLive = event.status === 'LIVE' || event.status === 'PAUSED';
  const isStarting = startingId === event.id;

  const showMVP = (isLive || event.status === 'FINISHED') && sportActions && sportActions.length > 0;
  const mvp = useMemo(
    () => (showMVP ? calculateMVP(event.actions ?? [], sportActions!) : null),
    [showMVP, event.actions, sportActions],
  );

  return (
    <TableRow
      className="cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border-custom)' }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <TableCell className="py-3 px-3">
        <span className="text-base">{event.sport?.icon}</span>
      </TableCell>
      <TableCell className="py-3 px-3">
        <div className="flex flex-col gap-1">
          <p
            className="text-sm font-semibold truncate max-w-[140px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.teamA?.name}
          </p>
          {mvp && <MVPBadgeMini mvp={mvp} />}
        </div>
      </TableCell>
      <TableCell className="py-3 px-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className="text-lg font-extrabold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.scoreA}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>-</span>
          <span
            className="text-lg font-extrabold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.scoreB}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3 px-3">
        <p
          className="text-sm font-semibold truncate max-w-[140px]"
          style={{ color: 'var(--text-primary)' }}
        >
          {event.teamB?.name}
        </p>
      </TableCell>
      <TableCell className="py-3 px-3">
        <StatusBadge status={event.status} />
      </TableCell>
      <TableCell className="py-3 px-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {formatDate(event.scheduledAt || event.createdAt)}
        </span>
      </TableCell>
      <TableCell className="py-3 px-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* SCHEDULED: Go Live */}
          {event.status === 'SCHEDULED' && isCreatorOrAdmin && (
            <Button
              size="sm"
              className="text-[11px] font-bold h-7 px-2"
              disabled={isStarting}
              style={{
                background: isStarting ? 'var(--bg-card)' : '#dc2626',
                color: isStarting ? 'var(--text-muted)' : '#fff',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onGoLive();
              }}
            >
              {isStarting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className="inline-block size-1.5 rounded-full bg-white mr-1 animate-pulse" />
              )}
              Ir en Vivo
            </Button>
          )}

          {/* PAUSED: Resume */}
          {event.status === 'PAUSED' && isCreatorOrAdmin && (
            <Button
              size="sm"
              className="text-[11px] font-bold h-7 px-2"
              disabled={isStarting}
              style={{
                background: isStarting ? 'var(--bg-card)' : '#16a34a',
                color: isStarting ? 'var(--text-muted)' : '#fff',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onResume();
              }}
            >
              {isStarting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className="mr-1 text-[10px]">▶️</span>
              )}
              Reanudar
            </Button>
          )}

          {/* LIVE/PAUSED: Go to Scoring */}
          {isLive && (
            <Button
              size="sm"
              className="text-[11px] font-semibold h-7 px-2"
              style={{ background: 'var(--accent)', color: '#fff' }}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <Radio className="size-3 mr-1" />
              Marcador
            </Button>
          )}

          {/* FINISHED: report + label */}
          {event.status === 'FINISHED' && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-[11px] font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  onReport();
                }}
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <FileText className="size-3 mr-1" />
                Reporte
              </Button>
              <span
                className="text-[11px] font-semibold px-2"
                style={{ color: 'var(--text-muted)' }}
              >
                ✅ Finalizado
              </span>
            </div>
          )}

          {/* Edit */}
          {isCreatorOrAdmin && event.status !== 'FINISHED' && (
            <Button
              size="icon"
              className="size-7 shrink-0"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(e);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Pencil className="size-3" />
            </Button>
          )}

          {/* Delete */}
          {isCreatorOrAdmin && (
            <Button
              size="icon"
              className="size-7 shrink-0"
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ── Detail Modal ───────────────────────────────────────────────────────────── */

function EventDetailModal({
  event,
  open,
  onOpenChange,
}: {
  event: SportEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!event) return null;

  const cfg = statusConfig(event.status);
  const teamAPlayers: Player[] = event.teamA?.players ?? [];
  const teamBPlayers: Player[] = event.teamB?.players ?? [];
  const tournamentName = (event as unknown as Record<string, unknown>).tournamentName as string | null;
  const phase = (event as unknown as Record<string, unknown>).phase as string | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-full max-h-[85vh] overflow-y-auto custom-scrollbar"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <span>{event.sport?.icon}</span>
            {event.name || `${event.teamA?.name} vs ${event.teamB?.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Status & Score */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <StatusBadge status={event.status} />
            {(event.status === 'LIVE' || event.status === 'PAUSED') && (
              <span
                className="text-xs flex items-center gap-1 tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Clock className="size-3" />
                {formatElapsed(event.elapsedSeconds)}
              </span>
            )}
          </div>

          {/* Tournament / Phase badges */}
          {(tournamentName || phase) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tournamentName && (
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                    background: 'rgba(225, 29, 72, 0.1)',
                  }}
                >
                  <Trophy className="size-3 mr-1" />
                  {tournamentName}
                </Badge>
              )}
              {phase && (
                <Badge
                  variant="outline"
                  className="text-[11px] font-semibold"
                  style={{
                    borderColor: '#eab308',
                    color: '#eab308',
                    background: 'rgba(234, 179, 8, 0.1)',
                  }}
                >
                  {phase}
                </Badge>
              )}
            </div>
          )}

          {/* Score display */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center flex-1 min-w-0">
              <div
                className="mx-auto mb-1.5 flex size-12 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
              >
                {event.teamA?.shortName?.toUpperCase().slice(0, 3) || event.teamA?.name.slice(0, 2).toUpperCase() || '?'}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {event.teamA?.name}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {teamAPlayers.length} jugador{teamAPlayers.length !== 1 ? 'es' : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.scoreA}
              </span>
              <span className="text-xl" style={{ color: 'var(--text-muted)' }}>-</span>
              <span
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.scoreB}
              </span>
            </div>

            <div className="text-center flex-1 min-w-0">
              <div
                className="mx-auto mb-1.5 flex size-12 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}
              >
                {event.teamB?.shortName?.toUpperCase().slice(0, 3) || event.teamB?.name.slice(0, 2).toUpperCase() || '?'}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {event.teamB?.name}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {teamBPlayers.length} jugador{teamBPlayers.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          {/* Event details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatFullDate(event.scheduledAt || event.createdAt)}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {event.location}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Eye className="size-4 shrink-0" style={{ color: event.isPublic ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {event.isPublic ? 'Evento Público' : 'Evento Privado'}
              </span>
            </div>
          </div>

          {/* Players list (if available) */}
          {(teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
            <>
              <Separator style={{ background: 'var(--border-custom)' }} />
              <div className="grid grid-cols-2 gap-4">
                {/* Team A Players */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                    {event.teamA?.name}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {teamAPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded px-2 py-1"
                        style={{ background: 'var(--bg-card)' }}
                      >
                        <span
                          className="text-xs font-bold tabular-nums w-5 text-center shrink-0"
                          style={{ color: 'var(--accent)' }}
                        >
                          {p.number}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team B Players */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                    {event.teamB?.name}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {teamBPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded px-2 py-1"
                        style={{ background: 'var(--bg-card)' }}
                      >
                        <span
                          className="text-xs font-bold tabular-nums w-5 text-center shrink-0"
                          style={{ color: 'var(--accent)' }}
                        >
                          {p.number}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Empty State ────────────────────────────────────────────────────────────── */

function EmptyState({ message, hasFilter }: { message: string; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="mb-4 flex size-20 items-center justify-center rounded-full text-4xl"
        style={{ background: 'var(--bg-secondary)' }}
        aria-hidden="true"
      >
        {hasFilter ? '🔍' : '🏆'}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {hasFilter ? 'Sin resultados' : 'No hay eventos'}
      </h3>
      <p className="mt-1 text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
        {message}
      </p>
    </div>
  );
}

/* ── Main Event List View ───────────────────────────────────────────────────── */

export function EventListView() {
  const navigate = useAppStore((s) => s.navigate);
  const isCreatorOrAdmin = useAppStore((s) => s.isCreatorOrAdmin);
  const { toast } = useToast();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Go Live confirmation dialog
  const [goLiveEvent, setGoLiveEvent] = useState<SportEvent | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Edit modal
  const [editEvent, setEditEvent] = useState<SportEvent | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete confirmation
  const [deleteEvent, setDeleteEvent] = useState<SportEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import modal
  const [importOpen, setImportOpen] = useState(false);

  // Sport actions (for MVP calculation)
  const [sportActions, setSportActions] = useState<{ name: string; mvpWeight: number }[]>([]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'ALL'
        ? '/api/events'
        : `/api/events?status=${statusFilter}`;
      const res = await apiGet<{ success: boolean; events: SportEvent[] }>(url);
      setEvents(res.events);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar eventos';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch sport actions (once) for MVP (Jugador del Partido) calculation
  useEffect(() => {
    apiGet<{ success: boolean; sports: { id: string; actions: { name: string; mvpWeight: number }[] }[] }>(
      '/api/sports?all=true'
    )
      .then((data) => {
        if (data?.success && Array.isArray(data.sports)) {
          const allActions: { name: string; mvpWeight: number }[] = [];
          for (const sport of data.sports) {
            if (Array.isArray(sport.actions)) {
              for (const a of sport.actions) {
                allActions.push({ name: a.name, mvpWeight: a.mvpWeight ?? 0 });
              }
            }
          }
          setSportActions(allActions);
        }
      })
      .catch(() => {});
  }, []);

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase().trim();
    return events.filter(
      (e) =>
        e.teamA?.name.toLowerCase().includes(q) ||
        e.teamB?.name.toLowerCase().includes(q) ||
        e.sport?.name.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [events, search]);

  const canEdit = isCreatorOrAdmin();

  function handleEventClick(event: SportEvent) {
    const isLive = event.status === 'LIVE' || event.status === 'PAUSED';
    if (isLive) {
      navigate({ page: 'SCORING', eventId: event.id });
    } else {
      setSelectedEvent(event);
      setDetailOpen(true);
    }
  }

  function handleGoLiveRequest(event: SportEvent) {
    setGoLiveEvent(event);
  }

  async function confirmGoLive() {
    if (!goLiveEvent) return;

    setStartingId(goLiveEvent.id);
    try {
      await apiPost(`/api/events/${goLiveEvent.id}/start`);
      toast({
        title: 'Evento en vivo',
        description: `${goLiveEvent.teamA?.name} vs ${goLiveEvent.teamB?.name} ha comenzado.`,
      });
      // Navigate to scoring
      navigate({ page: 'SCORING', eventId: goLiveEvent.id });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al iniciar el evento',
        variant: 'destructive',
      });
    } finally {
      setStartingId(null);
      setGoLiveEvent(null);
    }
  }

  function handleResumeRequest(event: SportEvent) {
    setGoLiveEvent(event);
  }

  async function confirmResume() {
    if (!goLiveEvent) return;

    setStartingId(goLiveEvent.id);
    try {
      await apiPost(`/api/events/${goLiveEvent.id}/start`);
      toast({
        title: 'Evento reanudado',
        description: `${goLiveEvent.teamA?.name} vs ${goLiveEvent.teamB?.name} continúa en vivo.`,
      });
      navigate({ page: 'SCORING', eventId: goLiveEvent.id });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al reanudar el evento',
        variant: 'destructive',
      });
    } finally {
      setStartingId(null);
      setGoLiveEvent(null);
    }
  }

  function handleEditClick(event: SportEvent) {
    setEditEvent(event);
    setEditOpen(true);
  }

  function handleDeleteClick(event: SportEvent) {
    setDeleteEvent(event);
  }

  async function confirmDelete() {
    if (!deleteEvent) return;

    setDeleting(true);
    try {
      await apiDelete(`/api/events/${deleteEvent.id}`);
      toast({
        title: 'Evento eliminado',
        description: `${deleteEvent.teamA?.name} vs ${deleteEvent.teamB?.name} ha sido eliminado.`,
      });
      await fetchEvents();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar el evento',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteEvent(null);
    }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Eventos
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Gestiona y sigue todos tus eventos deportivos
          </p>
        </div>
        {isCreatorOrAdmin() && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-10 text-sm font-semibold"
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              onClick={() => navigate({ page: 'CREATE_EVENT' })}
              className="h-10 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus className="size-4" />
              Crear Evento
            </Button>
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <Input
            placeholder="Buscar eventos..."
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

        {/* Desktop view toggle */}
        <div className="hidden md:flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--bg-card)' }}>
          <button
            onClick={() => setViewMode('cards')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'cards' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Tarjetas
          </button>
          <button
            onClick={() => setViewMode('table')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Tabla
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
      >
        <TabsList
          className="h-9 w-full justify-start overflow-x-auto"
          style={{
            background: 'var(--bg-card)',
          }}
        >
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs font-semibold data-[state=active]:shadow-none px-3 h-8"
              style={{
                color: statusFilter === tab.value ? 'var(--accent)' : 'var(--text-muted)',
                background: statusFilter === tab.value ? 'rgba(225, 29, 72, 0.15)' : 'transparent',
              }}
            >
              {tab.value === 'LIVE' && (
                <span className="live-dot inline-block size-1.5 rounded-full mr-1.5" style={{ background: '#ef4444' }} />
              )}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {loading ? (
        viewMode === 'table' ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="size-10 mb-2" style={{ color: 'var(--accent-red)' }} />
          <p className="text-sm mb-3" style={{ color: 'var(--accent-red)' }}>{error}</p>
          <Button
            variant="outline"
            onClick={fetchEvents}
            style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
          >
            Reintentar
          </Button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          hasFilter={statusFilter !== 'ALL' || search.trim() !== ''}
          message={
            statusFilter !== 'ALL'
              ? 'No hay eventos con este estado. Intenta con otro filtro.'
              : 'Crea tu primer evento para comenzar.'
          }
        />
      ) : viewMode === 'table' ? (
        /* ── Desktop table view ──────────────────────────────────────────────── */
        <div className="hidden md:block rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-custom)' }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: 'var(--border-custom)', background: 'var(--bg-card)' }}>
                <TableHead className="py-3 px-3 w-12" style={{ color: 'var(--text-muted)' }}>Deporte</TableHead>
                <TableHead className="py-3 px-3" style={{ color: 'var(--text-muted)' }}>Local</TableHead>
                <TableHead className="py-3 px-2 text-center" style={{ color: 'var(--text-muted)' }}>Marcador</TableHead>
                <TableHead className="py-3 px-3" style={{ color: 'var(--text-muted)' }}>Visitante</TableHead>
                <TableHead className="py-3 px-3" style={{ color: 'var(--text-muted)' }}>Estado</TableHead>
                <TableHead className="py-3 px-3" style={{ color: 'var(--text-muted)' }}>Fecha</TableHead>
                <TableHead className="py-3 px-3 text-right" style={{ color: 'var(--text-muted)' }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((evt) => (
                <EventTableRow
                  key={evt.id}
                  event={evt}
                  onClick={() => handleEventClick(evt)}
                  onGoLive={() => handleGoLiveRequest(evt)}
                  onResume={() => handleResumeRequest(evt)}
                  onEdit={() => handleEditClick(evt)}
                  onDelete={() => handleDeleteClick(evt)}
                  onReport={() => navigate({ page: 'EVENT_REPORT', eventId: evt.id })}
                  isCreatorOrAdmin={canEdit}
                  startingId={startingId}
                  sportActions={sportActions}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ── Card view (default + mobile) ───────────────────────────────────── */
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredEvents.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              onClick={() => handleEventClick(evt)}
              onGoLive={() => handleGoLiveRequest(evt)}
              onResume={() => handleResumeRequest(evt)}
              onEdit={() => handleEditClick(evt)}
              onDelete={() => handleDeleteClick(evt)}
              onReport={() => navigate({ page: 'EVENT_REPORT', eventId: evt.id })}
              isCreatorOrAdmin={canEdit}
              startingId={startingId}
              sportActions={sportActions}
            />
          ))}
        </div>
      )}

      {/* Event detail modal */}
      <EventDetailModal
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Go Live / Resume confirmation dialog */}
      <AlertDialog open={!!goLiveEvent} onOpenChange={(v) => { if (!v) setGoLiveEvent(null); }}>
        <AlertDialogContent
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>
              {goLiveEvent?.status === 'PAUSED' ? 'Reanudar Evento' : 'Iniciar Evento en Vivo'}
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-secondary)' }}>
              {goLiveEvent?.status === 'PAUSED'
                ? `¿Reanudar el evento ${goLiveEvent?.teamA?.name} vs ${goLiveEvent?.teamB?.name}?`
                : `¿Iniciar el evento ${goLiveEvent?.teamA?.name} vs ${goLiveEvent?.teamB?.name} en vivo?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
              onClick={() => setGoLiveEvent(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={goLiveEvent?.status === 'PAUSED' ? confirmResume : confirmGoLive}
              style={{
                background: goLiveEvent?.status === 'PAUSED' ? '#16a34a' : '#dc2626',
                color: '#fff',
              }}
            >
              {goLiveEvent?.status === 'PAUSED' ? '▶️ Reanudar' : '🔴 Ir en Vivo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit event modal */}
      <EditEventModal
        event={editEvent}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={fetchEvents}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(v) => { if (!v || !deleting) setDeleteEvent(null); }}>
        <AlertDialogContent
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>
              Eliminar Evento
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-secondary)' }}>
              ¿Seguro que deseas eliminar el evento{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {deleteEvent?.teamA?.name} vs {deleteEvent?.teamB?.name}
              </span>
              ? Esta acción no se puede deshacer y se perderán todos sus datos (marcador, acciones, comentarios).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
              onClick={() => setDeleteEvent(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              style={{
                background: '#dc2626',
                color: '#fff',
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="size-4 mr-2" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import events modal */}
      <ImportEventsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchEvents}
      />
    </div>
  );
}