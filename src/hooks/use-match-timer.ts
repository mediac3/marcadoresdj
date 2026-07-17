'use client';

import { useState, useEffect, useRef } from 'react';
import {
  registerTimer,
  syncTimer,
  getTimerElapsed,
  hasTimer,
  subscribeToTimer,
} from '@/lib/global-timer';

interface MatchTimerResult {
  /** Whole minutes of the elapsed time. */
  minutes: number;
  /** Remaining seconds within the current minute (0-59). */
  seconds: number;
  /** Formatted string, e.g. "07:32". */
  display: string;
  /** Whether the timer is actively counting. */
  isRunning: boolean;
  /** Total seconds elapsed since the match started. */
  totalSeconds: number;
}

/**
 * Hook that drives a visual match clock.
 *
 * Uses a **global timer service** (`global-timer.ts`) so the clock keeps
 * ticking even when the ScoringView component unmounts.
 *
 * The `loaded` parameter is critical: before the event has loaded from the
 * server, `isRunning` is `false` and `elapsedSeconds` is `0` (initial
 * state in ScoringView). If the effects ran during this phase they would
 * overwrite a perfectly good running global timer. By gating every effect
 * behind `loaded`, we prevent that race condition.
 */
export function useMatchTimer(
  eventId: string,
  elapsedSeconds: number,
  isRunning: boolean,
  loaded: boolean,
): MatchTimerResult {
  const [totalSeconds, setTotalSeconds] = useState(() => {
    // On first render, check if a global timer already exists for this event
    if (typeof window !== 'undefined' && eventId && hasTimer(eventId)) {
      return getTimerElapsed(eventId);
    }
    return elapsedSeconds;
  });

  // Keep a ref to the latest value for the cleanup callback
  const totalRef = useRef(totalSeconds);
  totalRef.current = totalSeconds;

  // Also keep a ref for isRunning so cleanup always uses the freshest value
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  /* ── Register / sync with the global service ── */

  useEffect(() => {
    if (!eventId || !loaded) return;

    if (hasTimer(eventId)) {
      // Timer already exists (user navigated away and came back)
      // Resume from the global elapsed time
      const currentElapsed = getTimerElapsed(eventId);
      setTotalSeconds(currentElapsed);
      syncTimer(eventId, currentElapsed, isRunningRef.current);
    } else {
      // First time seeing this event — register with the server value
      registerTimer(eventId, elapsedSeconds, isRunningRef.current);
    }

    // On unmount, save the current displayed time back to the global service
    // so the timer continues ticking in the background
    return () => {
      syncTimer(eventId, totalRef.current, isRunningRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isRunning, loaded]);

  // Snap to server value when the event is NOT live (paused/scheduled/finished)
  // or when there's no global timer yet
  useEffect(() => {
    if (!eventId || !loaded) return;
    if (!hasTimer(eventId) || !isRunning) {
      setTotalSeconds(elapsedSeconds);
      registerTimer(eventId, elapsedSeconds, isRunning);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, eventId, isRunning, loaded]);

  /* ── Listen to global ticks ── */

  useEffect(() => {
    if (!eventId) return;

    const unsub = subscribeToTimer((eid, elapsed) => {
      if (eid === eventId) {
        setTotalSeconds(elapsed);
      }
    });

    return unsub;
  }, [eventId]);

  /* ── Derived values ── */

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { minutes, seconds, display, isRunning, totalSeconds };
}