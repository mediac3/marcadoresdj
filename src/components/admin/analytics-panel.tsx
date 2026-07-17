'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  BarChart3,
  Globe,
  Monitor,
  MousePointer,
  Calendar,
  TrendingUp,
  Eye,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AnalyticsStats {
  totalVisits: number;
  uniqueVisitors: number;
  totalAdClicks: number;
  visitsByDay: { date: string; count: number }[];
  visitsByCountry: { country: string; count: number }[];
  visitsByBrowser: { browser: string; count: number }[];
  visitsByDevice: { deviceType: string; count: number }[];
  adClicksByAd: { adId: string; title: string; clicks: number }[];
}

type DateRange = '7' | '30' | '90';

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const COUNTRY_FLAGS: Record<string, string> = {
  CO: '🇨🇴',
  MX: '🇲🇽',
  AR: '🇦🇷',
  PE: '🇵🇪',
  EC: '🇪🇨',
  CL: '🇨🇱',
  VE: '🇻🇪',
  US: '🇺🇸',
  ES: '🇪🇸',
  BR: '🇧🇷',
};

function getCountryFlag(code: string): string {
  return COUNTRY_FLAGS[code] || '🌍';
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(from), to: fmt(to) };
}

function shortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

function getCSS(prop: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
}

/* ── Canvas bar chart drawer ───────────────────────────────────────────────── */

function drawBarChart(
  canvas: HTMLCanvasElement,
  data: { date: string; count: number }[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  // Read CSS custom properties for colors
  const accentColor = getCSS('--accent') || '#6366f1';
  const mutedColor = getCSS('--text-muted') || '#6b7280';
  const borderColor = getCSS('--border-custom') || '#374151';
  const textColor = getCSS('--text-secondary') || '#9ca3af';

  // Clear
  ctx.clearRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = mutedColor;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos', w / 2, h / 2);
    return;
  }

  const maxBars = 30;
  const visibleData = data.slice(-maxBars);
  const maxCount = Math.max(...visibleData.map((d) => d.count), 1);

  const paddingTop = 8;
  const paddingBottom = 32;
  const paddingLeft = 4;
  const paddingRight = 4;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  const barCount = visibleData.length;
  const gap = Math.max(2, Math.min(6, chartW / barCount * 0.2));
  const barWidth = Math.max(2, (chartW - gap * (barCount + 1)) / barCount);

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingTop + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Bars
  for (let i = 0; i < barCount; i++) {
    const x = paddingLeft + gap + i * (barWidth + gap);
    const barH = (visibleData[i].count / maxCount) * chartH;
    const y = paddingTop + chartH - barH;

    // Bar fill
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    const radius = Math.min(3, barWidth / 2);
    if (barH > radius * 2) {
      ctx.moveTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      ctx.lineTo(x + barWidth, paddingTop + chartH);
      ctx.lineTo(x, paddingTop + chartH);
    } else {
      ctx.rect(x, y, barWidth, barH);
    }
    ctx.fill();

    // Date label below
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // Only show label if there's enough space
    const labelInterval = Math.ceil(barCount / 15);
    if (i % labelInterval === 0 || i === barCount - 1) {
      ctx.fillText(shortDate(visibleData[i].date), x + barWidth / 2, h - 8);
    }
  }
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function AnalyticsPanel() {
  const [range, setRange] = useState<DateRange>('30');
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const fetchStats = useCallback(async (days: DateRange) => {
    setLoading(true);
    try {
      const { from, to } = formatDateRange(Number(days));
      const data = await apiGet<AnalyticsStats>(
        `/api/analytics/stats?from=${from}&to=${to}`
      );
      setStats(data);
    } catch (err) {
      toast({
        title: 'Error al cargar analíticas',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats(range);
  }, [range, fetchStats]);

  // Draw canvas chart when data changes
  useEffect(() => {
    if (!stats || !chartCanvasRef.current) return;
    drawBarChart(chartCanvasRef.current, stats.visitsByDay);

    // Redraw on resize
    const handleResize = () => {
      if (chartCanvasRef.current) {
        drawBarChart(chartCanvasRef.current, stats.visitsByDay);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [stats]);

  const todayVisits = stats?.visitsByDay.find((d) => d.date === todayISO())?.count ?? 0;

  const todayLabel = todayISO();

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ background: 'var(--accent)', color: 'var(--bg-card)' }}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Analíticas</h2>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Estadísticas de tráfico y publicidad
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar
            className="w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <Select
            value={range}
            onValueChange={(v) => setRange(v as DateRange)}
          >
            <SelectTrigger className="w-[180px]" style={{ borderColor: 'var(--border-custom)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Visitas */}
        <Card
          className="relative overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Total Visitas
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatNumber(stats?.totalVisits ?? 0)}
                  </p>
                )}
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visitantes Únicos */}
        <Card
          className="relative overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Visitantes Únicos
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatNumber(stats?.uniqueVisitors ?? 0)}
                  </p>
                )}
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clics en Publicidad */}
        <Card
          className="relative overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clics en Publicidad
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatNumber(stats?.totalAdClicks ?? 0)}
                  </p>
                )}
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <MousePointer className="w-5 h-5" style={{ color: 'var(--accent-yellow)' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visitas Hoy */}
        <Card
          className="relative overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wider mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Visitas Hoy
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatNumber(todayVisits)}
                  </p>
                )}
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <Eye className="w-5 h-5" style={{ color: 'var(--accent-red)' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart: Visitas por Día */}
      <Card
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Visitas por Día
            </h3>
          </div>
          {loading ? (
            <Skeleton className="w-full h-[200px] rounded-md" />
          ) : (
            <canvas
              ref={chartCanvasRef}
              style={{
                width: '100%',
                height: '200px',
                display: 'block',
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Breakdown sections: 2-column on desktop, 1-column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Por País */}
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Por País
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(() => {
                  const sorted = [...(stats?.visitsByCountry ?? [])].sort(
                    (a, b) => b.count - a.count
                  );
                  const top10 = sorted.slice(0, 10);
                  const maxCount = top10.length > 0 ? top10[0].count : 1;
                  return top10.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Sin datos de países
                    </p>
                  ) : (
                    top10.map((item) => (
                      <div key={item.country} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span className="text-base">{getCountryFlag(item.country)}</span>
                            <span className="font-medium">{item.country}</span>
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {formatNumber(item.count)}
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden"
                          style={{ background: 'var(--bg-secondary)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(item.count / maxCount) * 100}%`,
                              background: 'var(--accent)',
                              minWidth: item.count > 0 ? '4px' : '0',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Por Navegador */}
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Por Navegador
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {(() => {
                  const browsers = [...(stats?.visitsByBrowser ?? [])].sort(
                    (a, b) => b.count - a.count
                  );
                  const total = browsers.reduce((s, b) => s + b.count, 0) || 1;
                  return browsers.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Sin datos de navegadores
                    </p>
                  ) : (
                    browsers.map((item) => {
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.browser} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {item.browser}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {pct}% · {formatNumber(item.count)}
                            </span>
                          </div>
                          <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ background: 'var(--bg-secondary)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: 'var(--accent)',
                                minWidth: item.count > 0 ? '4px' : '0',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Por Dispositivo */}
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Por Dispositivo
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const devices = [...(stats?.visitsByDevice ?? [])].sort(
                    (a, b) => b.count - a.count
                  );
                  const total = devices.reduce((s, d) => s + d.count, 0) || 1;

                  const deviceMeta: Record<string, { emoji: string; label: string; color: string }> = {
                    desktop: { emoji: '🖥️', label: 'Escritorio', color: 'var(--accent)' },
                    mobile: { emoji: '📱', label: 'Móvil', color: 'var(--accent-red)' },
                    tablet: { emoji: '📋', label: 'Tablet', color: 'var(--accent-yellow)' },
                  };

                  if (devices.length === 0) {
                    return (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Sin datos de dispositivos
                      </p>
                    );
                  }

                  // Pie-like visual: stacked horizontal bar
                  return (
                    <>
                      {/* Stacked bar representing the pie */}
                      <div
                        className="h-6 rounded-full overflow-hidden flex"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        {devices.map((item) => {
                          const meta = deviceMeta[item.deviceType] || {
                            emoji: '❓',
                            label: item.deviceType,
                            color: 'var(--text-muted)',
                          };
                          const pct = (item.count / total) * 100;
                          return (
                            <div
                              key={item.deviceType}
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: meta.color,
                                minWidth: pct > 0 ? '4px' : '0',
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Legend items */}
                      {devices.map((item) => {
                        const meta = deviceMeta[item.deviceType] || {
                          emoji: '❓',
                          label: item.deviceType,
                          color: 'var(--text-muted)',
                        };
                        const pct = Math.round((item.count / total) * 100);
                        return (
                          <div
                            key={item.deviceType}
                            className="flex items-center justify-between py-2 px-3 rounded-lg"
                            style={{ background: 'var(--bg-secondary)' }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{meta.emoji}</span>
                              <span
                                className="text-sm font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  background: meta.color,
                                  color: 'var(--bg-card)',
                                }}
                              >
                                {pct}%
                              </span>
                              <span
                                className="text-sm"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {formatNumber(item.count)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clics por Anuncio */}
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <MousePointer className="w-4 h-4" style={{ color: 'var(--accent-yellow)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Clics por Anuncio
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(!stats?.adClicksByAd || stats.adClicksByAd.length === 0) ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Sin clics en anuncios
                  </p>
                ) : (
                  [...stats.adClicksByAd]
                    .sort((a, b) => b.clicks - a.clicks)
                    .map((ad) => (
                      <div
                        key={ad.adId}
                        className="flex items-center justify-between py-3 px-3 rounded-lg"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ad.title || 'Sin título'}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            ID: {ad.adId}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-1 shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: 'var(--accent-yellow)',
                            color: 'var(--bg-card)',
                          }}
                        >
                          <MousePointer className="w-3 h-3" />
                          {formatNumber(ad.clicks)}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}