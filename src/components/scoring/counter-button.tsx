'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useCounterButton } from '@/hooks/use-counter-button';
import { AnimatePresence, motion } from 'framer-motion';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface CounterButtonProps {
  /** Current count (driven by parent from server data). */
  value: number;
  /** Action colour (e.g. "#eab308" for yellow card). */
  color: string;
  /** Emoji or icon string for the action type. */
  icon: string;
  /** Called on short tap (< 2 s). */
  onPress: () => void;
  /** Called on long press (≥ 2 s). */
  onLongPress: () => void;
  /** When true the button ignores all gestures. */
  disabled?: boolean;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function CounterButton({
  value,
  color,
  icon,
  onPress,
  onLongPress,
  disabled = false,
}: CounterButtonProps) {
  // Refs for gesture bookkeeping (stable across renders)
  const pressStartRef = useRef(0);
  const cancelledRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Keep latest callbacks in refs so the hook's onChange stays stable
  const onPressRef = useRef(onPress);
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onPressRef.current = onPress;
  });
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  // This callback is passed to the hook.  It distinguishes short‑tap from
  // long‑press by comparing elapsed time since pointer‑down.
  const handleChange = useCallback((_newValue: number) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const elapsed = Date.now() - pressStartRef.current;
    if (elapsed >= 1900) {
      onLongPressRef.current();
    } else {
      onPressRef.current();
    }
  }, []);

  // Use the existing hook purely for gesture (press‑hold) detection.
  // The hook's internal value is synced from the `value` prop below.
  const { startPress, endPress, setValue } = useCounterButton(value, handleChange);

  // Sync the hook's internal counter with the server‑driven prop
  useEffect(() => {
    setValue(value);
  }, [value, setValue]);

  /* ── Pointer handlers ─────────────────────────────────────────────────── */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      cancelledRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      pressStartRef.current = Date.now();
      startPress();
    },
    [startPress, disabled],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelledRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    endPress();
  }, [endPress]);

  const handlePointerLeave = useCallback(() => {
    // If the pointer left the element it was likely a scroll — cancel.
    cancelledRef.current = true;
    endPress();
  }, [endPress]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  /* ── Render ───────────────────────────────────────────────────────────── */

  const isActive = value > 0;

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      disabled={disabled}
      className="relative flex items-center justify-center min-w-[44px] min-h-[44px] w-full h-[44px] rounded-lg text-sm font-bold select-none transition-colors duration-150 cursor-pointer"
      style={{
        backgroundColor: disabled
          ? 'transparent'
          : isActive
            ? `${color}28`
            : 'var(--bg-card-hover, rgba(128,128,128,0.1))',
        color: disabled
          ? 'var(--text-muted, #666)'
          : isActive
            ? color
            : 'var(--text-muted, #666)',
        border: disabled
          ? '1px solid transparent'
          : isActive
            ? `1.5px solid ${color}50`
            : '1px solid var(--border-custom, rgba(128,128,128,0.15))',
        opacity: disabled ? 0.4 : 1,
      }}
      aria-label={`${icon} ${value}`}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ scale: 1.35, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="text-center leading-none tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}