'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings, Eye, EyeOff, BarChart3, Loader2, Globe, Check, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SiteSettings {
  visitCounterEnabled: string;
  realtimeCounterEnabled: string;
  publicEventCreationEnabled?: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function parseBool(value: string | undefined): boolean {
  return value === 'true';
}

/* Settings que vienen activadas por defecto (undefined = activado). */
function parseBoolDefaultTrue(value: string | undefined): boolean {
  return value !== 'false';
}

function toBoolString(value: boolean): string {
  return value ? 'true' : 'false';
}

/* ── Setting Card ──────────────────────────────────────────────────────────── */

function SettingCard({
  icon: Icon,
  iconColor,
  title,
  description,
  checked,
  onCheckedChange,
  preview,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  preview?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 transition-colors"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-custom)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: icon + text */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div
            className="flex items-center justify-center size-10 rounded-lg shrink-0 mt-0.5"
            style={{ background: `${iconColor}15` }}
          >
            <Icon className="size-5" style={{ color: iconColor }} />
          </div>
          <div className="min-w-0">
            <Label
              className="text-sm font-semibold block mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </Label>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              {description}
            </p>
            {/* Optional preview slot */}
            {checked && preview && (
              <div className="mt-3">{preview}</div>
            )}
          </div>
        </div>

        {/* Right: switch */}
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="shrink-0 mt-1"
        />
      </div>
    </div>
  );
}

/* ── Visit Counter Preview ─────────────────────────────────────────────────── */

function VisitCounterPreview() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-custom)',
        color: 'var(--text-secondary)',
      }}
    >
      <Eye className="size-3.5" style={{ color: 'var(--accent)' }} />
      <span className="font-mono">1,247</span>
      <span style={{ color: 'var(--text-muted)' }}>visitas totales</span>
    </div>
  );
}

/* ── Realtime Counter Preview ──────────────────────────────────────────────── */

function RealtimeCounterPreview() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-custom)',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        className="size-2 rounded-full animate-pulse"
        style={{ background: 'var(--accent)' }}
      />
      <span className="font-mono">3</span>
      <span style={{ color: 'var(--text-muted)' }}>visitantes ahora</span>
    </div>
  );
}

/* ── Main Settings Panel ───────────────────────────────────────────────────── */

export function SettingsPanel() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Local working copy ────────────────────────────────────────────────── */
  const [visitCounter, setVisitCounter] = useState(false);
  const [realtimeCounter, setRealtimeCounter] = useState(false);
  const [publicEventCreation, setPublicEventCreation] = useState(true);

  const hasChanges =
    settings !== null &&
    (parseBool(settings.visitCounterEnabled) !== visitCounter ||
      parseBool(settings.realtimeCounterEnabled) !== realtimeCounter ||
      parseBoolDefaultTrue(settings.publicEventCreationEnabled) !==
        publicEventCreation);

  /* ── Fetch settings on mount ───────────────────────────────────────────── */
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<SiteSettings>('/api/admin/settings');
      setSettings(res);
      setVisitCounter(parseBool(res.visitCounterEnabled));
      setRealtimeCounter(parseBool(res.realtimeCounterEnabled));
      setPublicEventCreation(
        parseBoolDefaultTrue(res.publicEventCreationEnabled),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar la configuración',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /* ── Save ──────────────────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const body: SiteSettings = {
        visitCounterEnabled: toBoolString(visitCounter),
        realtimeCounterEnabled: toBoolString(realtimeCounter),
        publicEventCreationEnabled: toBoolString(publicEventCreation),
      };
      await apiPut('/api/admin/settings', body);
      setSettings(body);
      toast({
        title: 'Configuración guardada',
        description: 'Los cambios han sido aplicados correctamente.',
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar la configuración',
      );
      toast({
        title: 'Error',
        description:
          err instanceof Error
            ? err.message
            : 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [visitCounter, realtimeCounter, publicEventCreation, toast]);

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-px w-full" />
        {/* Card skeletons */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-xl w-full" />
          <Skeleton className="h-28 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-2xl mx-auto w-full">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center size-8 rounded-lg"
            style={{ background: 'var(--accent)20' }}
          >
            <Settings className="size-4.5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1
              className="text-xl md:text-2xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              Configuración del Sitio
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Administra las funciones visibles del sitio público
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div
        className="h-px w-full"
        style={{ background: 'var(--border-custom)' }}
      />

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--accent-red)',
          }}
        >
          <Globe className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* ── Settings Cards ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <SettingCard
          icon={visitCounter ? Eye : EyeOff}
          iconColor={visitCounter ? 'var(--accent)' : 'var(--text-muted)'}
          title="Contador de Visitas"
          description="Muestra el total de visitas acumuladas en el pie de página del sitio público."
          checked={visitCounter}
          onCheckedChange={setVisitCounter}
          preview={<VisitCounterPreview />}
        />

        <SettingCard
          icon={BarChart3}
          iconColor={realtimeCounter ? 'var(--accent)' : 'var(--text-muted)'}
          title="Contador en Tiempo Real"
          description="Muestra cuántos visitantes están navegando el sitio en este momento."
          checked={realtimeCounter}
          onCheckedChange={setRealtimeCounter}
          preview={<RealtimeCounterPreview />}
        />

        <SettingCard
          icon={CalendarPlus}
          iconColor={publicEventCreation ? 'var(--accent)' : 'var(--text-muted)'}
          title="Botón Crear Evento (Público)"
          description="Activa o desactiva el botón «Crear evento» del sitio público. Al desactivarlo, los visitantes no pueden crear eventos desde el frontend."
          checked={publicEventCreation}
          onCheckedChange={setPublicEventCreation}
        />
      </div>

      {/* ── Save Button ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end pt-2">
        <Button
          disabled={!hasChanges || saving}
          className="gap-2 text-sm font-semibold"
          style={{
            background: hasChanges ? 'var(--accent)' : 'var(--bg-secondary)',
            color: hasChanges ? '#fff' : 'var(--text-muted)',
            borderColor: hasChanges ? 'var(--accent)' : 'var(--border-custom)',
            border: '1px solid',
            cursor: hasChanges ? 'pointer' : 'default',
            opacity: hasChanges ? 1 : 0.6,
          }}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : hasChanges ? (
            <Check className="size-4" />
          ) : null}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}