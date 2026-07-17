'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook for counter-button behaviour used in the scoring panel.
 *
 * - **Short tap (< 2 s):** increments the counter.
 * - **Long press (≥ 2 s):** decrements the counter (minimum 0).
 *
 * Returns `startPress` / `endPress` handlers that should be bound to
 * `onPointerDown` and `onPointerUp` (or `onTouchStart` / `onTouchEnd`)
 * on the target element.
 */
export function useCounterButton(
  initialValue: number,
  onChange: (value: number) => void,
) {
  const [value, setValue] = useState(initialValue);
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const startPress = useCallback(() => {
    isHoldingRef.current = false;
    setIsHolding(false);

    timerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsHolding(true);
      setValue((prev) => {
        const newVal = Math.max(0, prev - 1);
        onChange(newVal);
        return newVal;
      });
    }, 2000);
  }, [onChange]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isHoldingRef.current) {
      // Short tap — increment
      setValue((prev) => {
        const newVal = prev + 1;
        onChange(newVal);
        return newVal;
      });
    }

    isHoldingRef.current = false;
    setIsHolding(false);
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { value, setValue, startPress, endPress, isHolding };
}