'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Search,
  Plus,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  MapPin,
  Video,
  ShieldCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api';

/* ════════════════════════════════════════════════════════════════════════════
   PublicEventWizard

   Wizard público para que un visitante (sin login) cree un evento deportivo.
   Flujo:
     Paso 0 — Aceptar Términos y Condiciones (si termsEnabled === true)
     Paso 1 — Deporte
     Paso 2 — Equipo Local (buscar existente o crear)
     Paso 3 — Equipo Visitante
     Paso 4 — Detalles (nombre, fecha, lugar, transmisión)
     Confirmación — Credenciales del usuario invitado generado

   La creación se hace en una sola llamada a POST /api/public/events/create,
   que crea el usuario invitado + el evento + devuelve el token. Las
   credenciales se guardan en localStorage para que el visitante pueda
   gestionar su evento (igual que el login público en public-view.tsx).
   ════════════════════════════════════════════════════════════════════════════ */

interface Sport {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
}
interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  sportId: string;
}

interface PublicEventWizardProps {
  open: boolean;
  onClose: () => void;
  /** Se llama al terminar con las credenciales guardadas (para redirigir). */
  onAuthed?: () => void;
}

const STORAGE_TOKEN = 'marcadoresdj-token';
const STORAGE_USER = 'marcadoresdj-user';

export function PublicEventWizard({ open, onClose, onAuthed }: PublicEventWizardProps) {
  /* ── Terms ── */
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [termsVersion, setTermsVersion] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  /* ── Wizard state ── */
  const [step, setStep] = useState(0); // 0 = terms, 1..4 = steps, 5 = done
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);

  const [eventName, setEventName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [location, setLocation] = useState('');
  const [streamingUrl, setStreamingUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Result (credentials) ── */
  const [result, setResult] = useState<{
    username: string;
    password: string;
    eventName: string;
  } | null>(null);
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null);

  /* ── Load terms + sports on open ── */
  useEffect(() => {
    if (!open) return;
    // Reset
    setStep(0);
    setTermsAccepted(false);
    setError(null);
    setResult(null);

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const enabled = data.termsEnabled === 'true';
        const v = parseInt(data.termsVersion ?? '0', 10) || 0;
        setTermsEnabled(enabled);
        setTermsVersion(v);
        setTermsContent(data.termsContent ?? '');
        // If terms not enforced, skip straight to sport selection.
        if (!enabled) setStep(1);
      })
      .catch(() => setStep(1));

    setSportsLoading(true);
    apiGet<{ success: boolean; sports: Sport[] }>('/api/sports')
      .then((res) => setSports(res.sports.filter((s) => s.isActive)))
      .catch(() => {})
      .finally(() => setSportsLoading(false));
  }, [open]);

  /* ── Validation per step ── */
  const canAdvance = useMemo(() => {
    if (step === 0) return termsEnabled ? termsAccepted : true;
    if (step === 1) return !!selectedSport;
    if (step === 2) return !!teamA;
    if (step === 3) return !!teamB && teamA?.id !== teamB?.id;
    if (step === 4) return true;
    return false;
  }, [step, termsEnabled, termsAccepted, selectedSport, teamA, teamB]);

  /* ── Submit: create guest user + event ── */
  const handleSubmit = useCallback(async () => {
    if (!selectedSport || !teamA || !teamB) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        sportId: selectedSport.id,
        teamAId: teamA.id,
        teamBId: teamB.id,
        name: eventName.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        location: location.trim() || null,
        streamingUrl: streamingUrl.trim() || null,
        isPublic: true,
        termsAccepted: termsEnabled ? true : undefined,
        termsVersion: termsEnabled ? String(termsVersion) : undefined,
      };
      const res = await apiPost<{
        success: boolean;
        user: { username: string };
        password: string;
        token: string;
        event?: { name: string | null };
      }>('/api/public/events/create', payload);

      if (!res.success || !res.token) {
        throw new Error('No se pudo crear el evento');
      }

      // Persist credentials so the visitor can manage the event afterwards.
      // The guest user object mirrors what the store expects on hydration.
      localStorage.setItem(STORAGE_TOKEN, res.token);
      localStorage.setItem(
        STORAGE_USER,
        JSON.stringify({
          id: '',
          username: res.user.username,
          name: 'Visitante',
          role: 'CREATOR',
        }),
      );

      setResult({
        username: res.user.username,
        password: res.password,
        eventName: res.event?.name || `${teamA.name} vs ${teamB.name}`,
      });
      setStep(5);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al crear el evento',
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedSport, teamA, teamB, eventName, scheduledAt, location, streamingUrl, termsEnabled, termsVersion]);

  /* ── Finish: reload so the store hydrates with the guest identity ── */
  const handleFinish = useCallback(() => {
    onAuthed?.();
    // Full reload so useAppStore rehydrates from localStorage with the guest.
    window.location.reload();
  }, [onAuthed]);

  const copy = (text: string, which: 'user' | 'pass') => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const stepLabel = step === 0 ? 'Términos' : step === 5 ? 'Listo' : ['Deporte', 'Local', 'Visitante', 'Detalles'][step - 1];

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span style={{ color: 'var(--text-primary)' }}>
              {result ? 'Evento creado' : 'Crear evento público'}
            </span>
          </DialogTitle>
          {step !== 5 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Paso {step === 0 ? 0 : step} · {stepLabel}
            </p>
          )}
        </DialogHeader>

        {/* ── Error ── */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--accent-red)',
            }}
          >
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* ═══ STEP 0 — TERMS ═══ */}
        {step === 0 && termsEnabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Términos y Condiciones
              </h3>
            </div>
            <div
              className="rounded-lg p-3 max-h-64 overflow-y-auto text-xs leading-relaxed"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
            >
              {termsContent ? (
                <ReactMarkdown>{termsContent}</ReactMarkdown>
              ) : (
                <p>No hay términos definidos.</p>
              )}
            </div>
            <label
              className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg transition-colors"
              style={{ background: termsAccepted ? 'rgba(34, 197, 94, 0.06)' : 'var(--bg-secondary)' }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
                He leído y acepto los Términos y Condiciones del servicio para crear
                un evento público.
              </span>
            </label>
          </div>
        )}

        {/* ═══ STEP 1 — SPORT ═══ */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Selecciona el deporte
            </h3>
            {sportsLoading ? (
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sports.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedSport(s); setTeamA(null); setTeamB(null); }}
                    className="flex items-center gap-2 p-3 rounded-lg text-left transition-colors"
                    style={{
                      background: selectedSport?.id === s.id ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: selectedSport?.id === s.id ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${selectedSport?.id === s.id ? 'var(--accent)' : 'var(--border-custom)'}`,
                    }}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-sm font-semibold truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 2 & 3 — TEAMS ═══ */}
        {(step === 2 || step === 3) && selectedSport && (
          <TeamPicker
            label={step === 2 ? 'Equipo Local' : 'Equipo Visitante'}
            sport={selectedSport}
            selected={step === 2 ? teamA : teamB}
            excludedTeamId={step === 2 ? null : teamA?.id ?? null}
            onSelect={(t) => (step === 2 ? setTeamA(t) : setTeamB(t))}
          />
        )}

        {/* ═══ STEP 4 — DETAILS ═══ */}
        {step === 4 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Detalles del evento
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nombre (opcional)</Label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder={`${teamA?.name ?? ''} vs ${teamB?.name ?? ''}`}
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Calendar className="size-3 inline mr-1" />Fecha y hora (opcional)
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <MapPin className="size-3 inline mr-1" />Lugar (opcional)
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Estadio, cancha, sede..."
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Video className="size-3 inline mr-1" />URL de transmisión (opcional)
              </Label>
              <Input
                value={streamingUrl}
                onChange={(e) => setStreamingUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>
            {/* Summary */}
            <div className="rounded-lg p-3 space-y-1 text-xs" style={{ background: 'var(--bg-secondary)' }}>
              <p style={{ color: 'var(--text-muted)' }}>Resumen</p>
              <p style={{ color: 'var(--text-primary)' }}>
                {selectedSport?.icon} {selectedSport?.name} · {teamA?.name} <span style={{ color: 'var(--text-muted)' }}>vs</span> {teamB?.name}
              </p>
            </div>
          </div>
        )}

        {/* ═══ STEP 5 — DONE / CREDENTIALS ═══ */}
        {step === 5 && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-2">
              <div className="size-12 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
                <CheckCircle2 className="size-7" style={{ color: 'var(--score-green)' }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                ¡Evento creado!
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                <Trophy className="size-3 inline mr-1" />{result.eventName}
              </p>
            </div>

            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}
            >
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent-yellow)' }}>
                <AlertCircle className="size-3.5" />
                Guarda estas credenciales — no se volverán a mostrar
              </p>
              <div className="space-y-1.5">
                <CredField label="Usuario" value={result.username} copied={copied === 'user'} onCopy={() => copy(result.username, 'user')} />
                <CredField label="Contraseña" value={result.password} copied={copied === 'pass'} onCopy={() => copy(result.password, 'pass')} />
              </div>
              <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                Con ellas puedes iniciar sesión para gestionar tu evento (marcador,
                acciones, equipos). También las guardamos en este navegador.
              </p>
            </div>
          </div>
        )}

        {/* ═══ FOOTER / NAV ═══ */}
        {step < 5 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step === 0 ? onClose() : (step === 1 && !termsEnabled ? onClose() : setStep(step - 1)))}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft className="size-4" />
              {step === 0 ? 'Cancelar' : 'Atrás'}
            </Button>

            {step < 4 ? (
              <Button
                size="sm"
                disabled={!canAdvance}
                onClick={() => setStep(step + 1)}
                className="gap-1 text-xs font-semibold"
                style={{
                  background: canAdvance ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: canAdvance ? '#fff' : 'var(--text-muted)',
                }}
              >
                Continuar
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canAdvance || submitting}
                onClick={handleSubmit}
                className="gap-1.5 text-xs font-semibold"
                style={{
                  background: canAdvance ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: canAdvance ? '#fff' : 'var(--text-muted)',
                }}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
                {submitting ? 'Creando...' : 'Crear evento'}
              </Button>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleFinish}
              className="gap-1.5 text-xs font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Gestionar mi evento
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TeamPicker — buscar equipo existente o crear uno nuevo simple
   ════════════════════════════════════════════════════════════════════════════ */
function TeamPicker({
  label,
  sport,
  selected,
  excludedTeamId,
  onSelect,
}: {
  label: string;
  sport: Sport;
  selected: Team | null;
  excludedTeamId: string | null;
  onSelect: (t: Team) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ success: boolean; teams: Team[] }>(
        `/api/teams?sportId=${sport.id}`,
      );
      setTeams(res.teams.filter((t) => t.id !== excludedTeamId));
    } catch {
      // ignore — visitor may have no token yet; creation still works via public endpoint
    } finally {
      setLoading(false);
    }
  }, [sport.id, excludedTeamId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const filtered = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [teams, search],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreatingLoading(true);
    try {
      // Note: POST /api/teams requires auth (CREATOR+). If the visitor has no
      // token yet (first event), team creation will fail here — the visitor
      // must pick an existing team. Once they have a guest token (after first
      // event), they can create teams. This is acceptable for v1.
      const res = await apiPost<{ success: boolean; team: Team }>('/api/teams', {
        name: newName.trim(),
        sportId: sport.id,
      });
      if (res.success) {
        onSelect(res.team);
        setCreating(false);
        setNewName('');
      }
    } catch {
      // Silently fall back to existing-team selection.
      setCreating(false);
    } finally {
      setCreatingLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => setCreating((c) => !c)}
          style={{ color: 'var(--accent)' }}
        >
          <Plus className="size-3.5" />
          {creating ? 'Cancelar' : 'Crear nuevo'}
        </Button>
      </div>

      {creating ? (
        <div className="space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del equipo"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <Button
            size="sm"
            disabled={!newName.trim() || creatingLoading}
            onClick={handleCreate}
            className="w-full gap-1.5 text-xs"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {creatingLoading && <Loader2 className="size-3.5 animate-spin" />}
            Crear equipo
          </Button>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Requiere sesión iniciada. Si es tu primer evento, selecciona un equipo existente.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: 'var(--text-muted)' }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar equipo..."
              className="pl-8"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
          </div>
          {selected ? (
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 className="size-3.5 inline mr-1.5" style={{ color: 'var(--score-green)' }} />
                {selected.name}
              </span>
              <Badge variant="secondary" className="text-[10px]">Seleccionado</Badge>
            </div>
          ) : loading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No hay equipos {search ? 'que coincidan' : 'registrados'} para {sport.name}.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect(t)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-colors"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
                >
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt="" className="size-6 object-contain rounded" />
                  ) : (
                    <div className="size-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                      {t.name[0]}
                    </div>
                  )}
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CredField — credential row with copy button
   ════════════════════════════════════════════════════════════════════════════ */
function CredField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md p-2" style={{ background: 'var(--bg-card)' }}>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 size-7 flex items-center justify-center rounded-md transition-colors"
        style={{ background: 'var(--bg-secondary)', color: copied ? 'var(--score-green)' : 'var(--text-muted)' }}
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
