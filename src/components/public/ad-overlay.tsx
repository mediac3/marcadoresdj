'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { X } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface AdData {
  id: string;
  adType: string;
  content: string;
  linkUrl: string | null;
  orientation: string;
  countdownSeconds: number;
}

interface AdOverlayProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  ads: AdData[];
  fingerprint: string;
  onClose?: () => void;
}

/* ── Fingerprint helper (simple) ───────────────────────────────────────── */

function generateFingerprint(): string {
  const nav = navigator as unknown as Record<string, unknown>;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    (nav.hardwareConcurrency as number) || 0,
    new Date().getTimezoneOffset(),
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return Math.abs(hash).toString(36);
}

/* ── Position styles ───────────────────────────────────────────────────── */

function positionStyle(pos: string, isVertical: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'opacity 0.2s',
  };

  if (pos === 'top') {
    return { ...base, top: 0, left: 0, right: 0, height: isVertical ? '20%' : '30%' };
  }
  if (pos === 'bottom') {
    return { ...base, bottom: 0, left: 0, right: 0, height: isVertical ? '20%' : '30%' };
  }
  if (pos === 'left') {
    return { ...base, top: 0, left: 0, bottom: 0, width: isVertical ? '30%' : '20%' };
  }
  // right
  return { ...base, top: 0, right: 0, bottom: 0, width: isVertical ? '30%' : '20%' };
}

/* ── Single Ad creative ────────────────────────────────────────────────── */

function AdCreative({ ad, onClick }: { ad: AdData; onClick: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    ad.countdownSeconds > 0 ? ad.countdownSeconds : null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canClose = remaining === null || remaining <= 0;

  // Countdown timer
  useEffect(() => {
    if (ad.countdownSeconds <= 0) return;

    let r = ad.countdownSeconds;
    timerRef.current = setInterval(() => {
      r -= 1;
      if (r <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRemaining(0);
      } else {
        setRemaining(r);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ad.id, ad.countdownSeconds]);

  if (dismissed) return null;

  const closeButton = canClose ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
      className="absolute top-1 right-1 size-5 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <X className="size-3 text-white" />
    </button>
  ) : (
    <button
      type="button"
      className="absolute top-1 right-1 size-6 flex items-center justify-center rounded-full"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { e.stopPropagation(); }}
      disabled
    >
      <span className="text-white text-[10px] font-bold tabular-nums">{remaining}s</span>
    </button>
  );

  if (ad.adType === 'text') {
    return (
      <div
        className="w-full h-full flex items-center justify-center p-2"
        onClick={onClick}
        style={{ background: 'rgba(0,0,0,0.85)' }}
      >
        <p
          className="text-xs sm:text-sm font-medium text-center leading-relaxed"
          style={{ color: '#ffffff' }}
        >
          {ad.content}
        </p>
      </div>
    );
  }

  if (ad.adType === 'image') {
    return (
      <div className="relative w-full h-full" onClick={onClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ad.content}
          alt="Publicidad"
          className="w-full h-full object-cover"
        />
        {closeButton}
      </div>
    );
  }

  // video
  return (
    <div className="relative w-full h-full" onClick={onClick}>
      <video
        src={ad.content}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      {closeButton}
    </div>
  );
}

/* ── Exported hook ─────────────────────────────────────────────────────── */

export function useVisitorFingerprint() {
  const [fp, setFp] = useState<string>('unknown');
  useEffect(() => {
    try {
      setFp(generateFingerprint());
    } catch {
      setFp('fallback-' + Math.random().toString(36).slice(2));
    }
  }, []);
  return fp;
}

/* ── Exported overlay component ────────────────────────────────────────── */

export function AdOverlay({ position, ads, fingerprint, onClose }: AdOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotate ads every 15 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % ads.length);
    }, 15_000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const handleClick = useCallback(async () => {
    const ad = ads[currentIndex];
    if (!ad) return;

    // Record click
    try {
      await fetch(`/api/ads/${ad.id}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint }),
      });
    } catch { /* silent */ }

    // Navigate to link
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }

    onClose?.();
  }, [ads, currentIndex, fingerprint, onClose]);

  if (ads.length === 0) return null;

  const ad = ads[currentIndex];
  if (!ad) return null;

  const isVertical = position === 'left' || position === 'right';
  const style = positionStyle(position, isVertical);

  return (
    <div style={style}>
      <AdCreative ad={ad} onClick={handleClick} />
      {/* Dots indicator for multiple ads */}
      {ads.length > 1 && (
        <div
          className="absolute flex gap-1"
          style={{
            bottom: position === 'bottom' ? 'auto' : 4,
            top: position === 'top' ? 'auto' : 4,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {ads.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === currentIndex ? 12 : 6,
                height: 6,
                background: i === currentIndex ? '#ffffff' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hook to fetch and group active ads ─────────────────────────────────── */

export interface GroupedAds {
  top: AdData[];
  bottom: AdData[];
  left: AdData[];
  right: AdData[];
}

const EMPTY_GROUPED: GroupedAds = { top: [], bottom: [], left: [], right: [] };

export function useActiveAds(cityId?: string | null) {
  const [ads, setAds] = useState<GroupedAds>(EMPTY_GROUPED);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let url = '/api/ads/active';
    if (cityId) url += `?cityId=${encodeURIComponent(cityId)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAds(data.ads);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [cityId]);

  return { ads, loaded };
}

/* ── Exported visit tracking hook ───────────────────────────────────────── */

export function useVisitTracker(fp: string, settings: { visitCounterEnabled: boolean }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!fp || trackedRef.current || !settings.visitCounterEnabled) return;
    trackedRef.current = true;

    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp, path: window.location.pathname }),
    }).catch(() => {});
  }, [fp, settings.visitCounterEnabled]);
}

/* ── Exported realtime counter hook ─────────────────────────────────────── */

export function useRealtimeCounter(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      // Use a microtask to avoid the synchronous setState lint
      queueMicrotask(() => {
        if (!cancelled) setCount(0);
      });
      return;
    }

    function fetchCount() {
      fetch('/api/analytics/realtime')
        .then((r) => r.json())
        .then((data) => { if (!cancelled) setCount(data.count ?? 0); })
        .catch(() => {});
    }

    fetchCount();
    const timer = setInterval(fetchCount, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled]);

  return count;
}