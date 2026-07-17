'use client';

import { Play, Pause, CloudUpload } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface MatchTimerProps {
  /** Formatted MM:SS from useMatchTimer. */
  display: string;
  /** Whether the clock is actively ticking. */
  isRunning: boolean;
  /** Toggle the timer start / stop. */
  onStartStop: () => void;
  /** Persist current elapsed seconds & half to the server. */
  onSync: () => void;
  /** Change the current half. */
  onHalfChange: (half: string) => void;
  /** Current half value stored in the event. */
  currentHalf: string;
  /** Available half options for the sport. */
  halves: { value: string; label: string }[];
  /** Whether an async operation is in progress. */
  syncing?: boolean;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function MatchTimer({
  display,
  isRunning,
  onStartStop,
  onSync,
  onHalfChange,
  currentHalf,
  halves,
  syncing = false,
}: MatchTimerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
      style={{ background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border-custom, rgba(128,128,128,0.15))' }}
    >
      {/* ── Start / Stop ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onStartStop}
        className="flex items-center justify-center size-10 rounded-lg transition-colors duration-150"
        style={{
          background: isRunning ? 'var(--accent, #e11d48)' : '#22c55e30',
          color: isRunning ? '#fff' : '#22c55e',
          border: isRunning
            ? '1px solid transparent'
            : '1px solid #22c55e50',
        }}
        aria-label={isRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
      >
        {isRunning ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>

      {/* ── Half selector ───────────────────────────────────────────────── */}
      <Select value={currentHalf} onValueChange={onHalfChange}>
        <SelectTrigger className="w-[140px] h-10 text-sm" size="sm">
          <SelectValue placeholder="Tiempo" />
        </SelectTrigger>
        <SelectContent>
          {halves.map((h) => (
            <SelectItem key={h.value} value={h.value}>
              {h.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Sync button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="flex items-center justify-center size-10 rounded-lg transition-colors duration-150 disabled:opacity-40"
        style={{
          background: 'var(--bg-card-hover, rgba(128,128,128,0.1))',
          color: 'var(--text-secondary, #aaa)',
          border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
        }}
        aria-label="Sincronizar cronómetro"
        title="Guardar tiempo en el servidor"
      >
        <CloudUpload className="size-4" />
      </button>
    </div>
  );
}