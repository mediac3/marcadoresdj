'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiPut } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { TOURNAMENT_PHASES } from '@/lib/constants';
import { LocationSelector } from '@/components/locations/location-selector';
import type { SportEvent } from '@/lib/store';

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function toDatetimeLocal(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface EditEventModalProps {
  event: SportEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  location: string;
  countryId: string | null;
  departmentId: string | null;
  cityId: string | null;
  scheduledAt: string;
  isPublic: boolean;
  tournamentName: string;
  phase: string;
  streamingUrl: string;
  streamingKey: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  location: '',
  countryId: null,
  departmentId: null,
  cityId: null,
  scheduledAt: '',
  isPublic: true,
  tournamentName: '',
  phase: '',
  streamingUrl: '',
  streamingKey: '',
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function EditEventModal({
  event,
  open,
  onOpenChange,
  onSuccess,
}: EditEventModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // Pre-fill form when event changes
  useEffect(() => {
    if (event) {
      setForm({
        name: event.name || '',
        location: event.location || '',
        countryId: (event as unknown as Record<string, unknown>).countryId as string | null || null,
        departmentId: (event as unknown as Record<string, unknown>).departmentId as string | null || null,
        cityId: (event as unknown as Record<string, unknown>).cityId as string | null || null,
        scheduledAt: toDatetimeLocal(event.scheduledAt),
        isPublic: event.isPublic,
        tournamentName: (event as unknown as Record<string, unknown>).tournamentName as string || '',
        phase: (event as unknown as Record<string, unknown>).phase as string || '',
        streamingUrl: event.streamingUrl || '',
        streamingKey: event.streamingKey || '',
      });
    }
  }, [event]);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!event) return;

    setSaving(true);
    try {
      await apiPut(`/api/events/${event.id}`, {
        name: form.name.trim() || null,
        location: form.location.trim() || null,
        countryId: form.countryId,
        departmentId: form.departmentId,
        cityId: form.cityId,
        scheduledAt: form.scheduledAt || null,
        isPublic: form.isPublic,
        tournamentName: form.tournamentName.trim() || null,
        phase: form.phase || null,
        streamingUrl: form.streamingUrl.trim() || null,
        streamingKey: form.streamingKey.trim() || null,
      });

      toast({
        title: 'Evento actualizado',
        description: 'Los cambios se guardaron correctamente.',
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al actualizar el evento',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!event) return null;

  const inputStyle = {
    background: 'var(--bg-card)',
    borderColor: 'var(--border-custom)',
    color: 'var(--text-primary)',
  };

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
            className="text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Editar Evento
          </DialogTitle>
          <DialogDescription
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {event.teamA?.name} vs {event.teamB?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre del Evento
            </Label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={`${event.teamA?.name} vs ${event.teamB?.name}`}
              className="h-10"
              style={inputStyle}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Ubicación
            </Label>
            <LocationSelector
              countryId={form.countryId}
              departmentId={form.departmentId}
              cityId={form.cityId}
              onCountryChange={(v) => { updateField('countryId', v); updateField('departmentId', null); updateField('cityId', null); }}
              onDepartmentChange={(v) => { updateField('departmentId', v); updateField('cityId', null); }}
              onCityChange={(v) => updateField('cityId', v)}
            />
          </div>

          {/* Venue name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre del Lugar / Cancha
              <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
            </Label>
            <Input
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="Ej: Estadio Municipal"
              className="h-10"
              style={inputStyle}
            />
          </div>

          {/* Scheduled At */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Fecha y Hora Programada
            </Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => updateField('scheduledAt', e.target.value)}
              className="h-10"
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          {/* Public toggle */}
          <div
            className="flex items-center justify-between rounded-lg border p-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-custom)',
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Evento Público
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {form.isPublic
                  ? 'Visible para todos los usuarios'
                  : 'Solo visible para creadores y administradores'}
              </p>
            </div>
            <Switch
              checked={form.isPublic}
              onCheckedChange={(v) => updateField('isPublic', v)}
            />
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          {/* Tournament Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre del Torneo
            </Label>
            <Input
              value={form.tournamentName}
              onChange={(e) => updateField('tournamentName', e.target.value)}
              placeholder="Ej: Copa DJ 2026"
              className="h-10"
              style={inputStyle}
            />
          </div>

          {/* Phase */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Fase del Torneo
            </Label>
            <Select
              value={form.phase}
              onValueChange={(v) => updateField('phase', v)}
            >
              <SelectTrigger
                className="h-10"
                style={inputStyle}
              >
                <SelectValue placeholder="Seleccionar fase..." />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-custom)',
                }}
              >
                <SelectItem value="__none__">Sin fase</SelectItem>
                {TOURNAMENT_PHASES.map((phase) => (
                  <SelectItem key={phase.value} value={phase.value}>
                    {phase.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          {/* Streaming section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Video className="size-4" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Transmisión en Vivo
              </p>
            </div>

            {/* Streaming URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                URL de Streaming
              </Label>
              <Input
                value={form.streamingUrl}
                onChange={(e) => updateField('streamingUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... o URL de embebido"
                className="h-10 text-sm"
                style={inputStyle}
              />
            </div>

            {/* Help text */}
            <div
              className="flex items-start gap-2 rounded-lg p-3"
              style={{
                background: 'rgba(225, 29, 72, 0.08)',
                border: '1px solid rgba(225, 29, 72, 0.2)',
              }}
            >
              <Info className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Pega la URL del video de YouTube, Twitch, Vimeo u otro servicio de streaming.
                El reproductor se mostrará embebido en la vista pública del evento.
              </p>
            </div>
          </div>

          <Separator style={{ background: 'var(--border-custom)' }} />

          {/* Save button */}
          <Button
            className="w-full h-10 text-sm font-semibold"
            disabled={saving}
            style={{
              background: saving ? 'var(--bg-card)' : 'var(--accent)',
              color: saving ? 'var(--text-muted)' : '#fff',
            }}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}