'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
  Users,
  Trash2,
  ChevronDown,
  MessageCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api';
import {
  COUNTRY_CODES,
  getCountry,
  toE164,
  isValidE164,
  detectCountryIso,
} from '@/lib/phone';

/* ════════════════════════════════════════════════════════════════════════════
   PublicEventWizard (v2)

   Wizard público para que un visitante (sin login) cree un evento deportivo.
   Flujo:
     Paso 0 — Aceptar Términos y Condiciones (si termsEnabled === true)
     Paso 1 — Deporte
     Paso 2 — Equipo Local (buscar existente o crear con jugadores opcionales)
     Paso 3 — Equipo Visitante
     Paso 4 — Detalles (nombre, fecha, lugar, transmisión)
     Confirmación — Credenciales del usuario invitado generado

   La creación se hace en una sola llamada a POST /api/public/events/create,
   que crea el usuario invitado + los equipos (con jugadores) + el evento +
   devuelve el token. Las credenciales se guardan en localStorage para que el
   visitante pueda gestionar su evento.
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

interface NewPlayer {
  name: string;
  number: string; // string para el input; se convierte a number al enviar
  position: string;
}

/** Either an existing team is picked, or a new one is being defined inline. */
type TeamSelection =
  | { mode: 'existing'; team: Team }
  | { mode: 'new'; name: string; players: NewPlayer[] }
  | null;

interface PublicEventWizardProps {
  open: boolean;
  onClose: () => void;
  /** Se llama al terminar con las credenciales guardadas (para redirigir). */
  onAuthed?: () => void;
}

const STORAGE_TOKEN = 'marcadoresdj-token';
const STORAGE_USER = 'marcadoresdj-user';

/** Positions per sport (fallback to a generic list for unknown sports). */
const POSITIONS_BY_SPORT: Record<string, string[]> = {
  Fútbol: ['Portero', 'Defensa', 'Lateral', 'Mediocampista', 'Delantero'],
  Baloncesto: ['Base', 'Escolta', 'Alero', 'Ala-pívot', 'Pívot'],
  Microfútbol: ['Portero', 'Cierre', 'Ala', 'Pívot'],
};
const GENERIC_POSITIONS = ['Jugador', 'Capitán', 'Suplente'];

function positionsFor(sportName: string): string[] {
  return POSITIONS_BY_SPORT[sportName] ?? GENERIC_POSITIONS;
}

export function PublicEventWizard({ open, onClose, onAuthed }: PublicEventWizardProps) {
  /* ── Terms ── */
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [termsVersion, setTermsVersion] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  /* ── Wizard state ── */
  // 0 = terms, 1 = WhatsApp/phone, 2 = sport, 3 = local, 4 = visitante, 5 = detalles, 6 = done
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  /* ── WhatsApp phone state ── */
  const [guestInitialCredits, setGuestInitialCredits] = useState(5);
  const [supportWhatsapp, setSupportWhatsapp] = useState('573226575422');
  const [phoneCountry, setPhoneCountry] = useState('CO');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCheck, setPhoneCheck] = useState<{ exists: boolean; credits?: number } | null>(null);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [teamA, setTeamA] = useState<TeamSelection>(null);
  const [teamB, setTeamB] = useState<TeamSelection>(null);

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
    creditsLeft: number;
    lastCredit: boolean;
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
    setSelectedSport(null);
    setTeamA(null);
    setTeamB(null);
    setPhoneNumber('');
    setPhoneCheck(null);
    setPhoneError(null);

    // Detect visitor's country from the browser for the phone selector.
    const detected = detectCountryIso();
    if (detected) setPhoneCountry(detected);

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const enabled = data.termsEnabled === 'true';
        const v = parseInt(data.termsVersion ?? '0', 10) || 0;
        setTermsEnabled(enabled);
        setTermsVersion(v);
        setTermsContent(data.termsContent ?? '');
        setGuestInitialCredits(parseInt(data.guestInitialCredits ?? '5', 10) || 5);
        setSupportWhatsapp((data.supportWhatsappNumber ?? '573226575422').trim());
        // If terms not enforced, skip straight to WhatsApp/phone step.
        if (!enabled) setStep(1);
      })
      .catch(() => setStep(1));

    setSportsLoading(true);
    // Public endpoint (no auth) so unauthenticated visitors can pick a sport.
    apiGet<{ success: boolean; sports: Sport[] }>('/api/public/sports')
      .then((res) => setSports(res.sports))
      .catch(() => {})
      .finally(() => setSportsLoading(false));
  }, [open]);

  /* ── Validation per step ── */
  // 0 = terms, 1 = WhatsApp/phone, 2 = sport, 3 = local, 4 = visitante, 5 = detalles, 6 = done
  const canAdvance = useMemo(() => {
    if (step === 0) return termsEnabled ? termsAccepted : true;
    if (step === 1) {
      // WhatsApp phone step: need a valid number and (if exists) it must be reusable
      const e164 = toE164(getCountry(phoneCountry).dial, phoneNumber);
      if (!isValidE164(e164)) return false;
      if (phoneError) return false;
      return true;
    }
    if (step === 2) return !!selectedSport;
    if (step === 3) return isValidTeamSelection(teamA);
    if (step === 4) {
      if (!isValidTeamSelection(teamB)) return false;
      // Teams must differ (both existing → different ids; names must differ)
      const aName = teamA?.mode === 'existing' ? teamA.team.name : teamA?.mode === 'new' ? teamA.name.trim() : '';
      const bName = teamB?.mode === 'existing' ? teamB.team.name : teamB?.mode === 'new' ? teamB.name.trim() : '';
      const aId = teamA?.mode === 'existing' ? teamA.team.id : null;
      const bId = teamB?.mode === 'existing' ? teamB.team.id : null;
      if (aId && bId && aId === bId) return false;
      return aName.toLowerCase() !== bName.toLowerCase();
    }
    if (step === 5) return true;
    return false;
  }, [step, termsEnabled, termsAccepted, phoneCountry, phoneNumber, phoneError, selectedSport, teamA, teamB]);

  /* ── Check phone uniqueness against the backend ── */
  const checkPhone = useCallback(async (e164: string) => {
    if (!isValidE164(e164)) {
      setPhoneCheck(null);
      setPhoneError(null);
      return;
    }
    setPhoneChecking(true);
    setPhoneError(null);
    try {
      const res = await fetch('/api/public/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      });
      const data = await res.json();
      setPhoneCheck({ exists: !!data.exists, credits: data.credits });
      // Phone already registered → it belongs to someone else (visitor has no
      // session here, so any existing phone is "taken").
      setPhoneError(data.exists ? 'Este número ya está en uso. Si es tuyo, inicia sesión para gestionar tus eventos.' : null);
    } catch {
      // Network error — don't block, let the server validate on submit.
      setPhoneCheck(null);
    } finally {
      setPhoneChecking(false);
    }
  }, []);

  /* ── Submit: create guest user + teams + event ── */
  const handleSubmit = useCallback(async () => {
    if (!selectedSport || !isValidTeamSelection(teamA) || !isValidTeamSelection(teamB)) return;
    const phoneE164 = toE164(getCountry(phoneCountry).dial, phoneNumber);
    if (!isValidE164(phoneE164)) {
      setError('Ingresa un número de WhatsApp válido');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        phone: phoneE164,
        sportId: selectedSport.id,
        name: eventName.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        location: location.trim() || null,
        streamingUrl: streamingUrl.trim() || null,
        isPublic: true,
        termsAccepted: termsEnabled ? true : undefined,
        termsVersion: termsEnabled ? String(termsVersion) : undefined,
      };
      // Team A
      if (teamA!.mode === 'existing') {
        payload.teamAId = teamA!.team.id;
      } else {
        payload.teamA = {
          name: teamA!.name.trim(),
          players: teamA!.players
            .filter((p) => p.name.trim() && p.position && p.number !== '')
            .map((p) => ({ name: p.name.trim(), number: Number(p.number), position: p.position })),
        };
      }
      // Team B
      if (teamB!.mode === 'existing') {
        payload.teamBId = teamB!.team.id;
      } else {
        payload.teamB = {
          name: teamB!.name.trim(),
          players: teamB!.players
            .filter((p) => p.name.trim() && p.position && p.number !== '')
            .map((p) => ({ name: p.name.trim(), number: Number(p.number), position: p.position })),
        };
      }

      const res = await apiPost<{
        success: boolean;
        user: { username: string };
        password: string;
        token: string;
        event?: { name: string | null };
        credits?: number;
        lastCredit?: boolean;
      }>('/api/public/events/create', payload);

      if (!res.success || !res.token) {
        throw new Error('No se pudo crear el evento');
      }

      // Persist credentials so the visitor can manage the event afterwards.
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

      const aName = teamA!.mode === 'existing' ? teamA!.team.name : teamA!.name;
      const bName = teamB!.mode === 'existing' ? teamB!.team.name : teamB!.name;
      setResult({
        username: res.user.username,
        password: res.password,
        eventName: res.event?.name || `${aName} vs ${bName}`,
        creditsLeft: res.credits ?? 0,
        lastCredit: !!res.lastCredit,
      });
      setStep(6);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al crear el evento',
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedSport, teamA, teamB, eventName, scheduledAt, location, streamingUrl, termsEnabled, termsVersion, phoneCountry, phoneNumber]);

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

  const stepLabel = step === 0 ? 'Términos' : step === 6 ? 'Listo' : ['WhatsApp', 'Deporte', 'Local', 'Visitante', 'Detalles'][step - 1];

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span style={{ color: 'var(--text-primary)' }}>
              {result ? 'Evento creado' : 'Crear evento público'}
            </span>
          </DialogTitle>
          {step !== 6 && (
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

        {/* ═══ STEP 1 — WHATSAPP PHONE ═══ */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5" style={{ color: '#25D366' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Tu WhatsApp
              </h3>
            </div>
            <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
              Necesitamos un número de WhatsApp válido para crear tu evento. Se
              permiten hasta <strong style={{ color: 'var(--text-primary)' }}>{guestInitialCredits}</strong> eventos
              por número.
            </p>

            {/* Country + phone row */}
            <div className="flex items-stretch gap-2 min-w-0">
              <select
                value={phoneCountry}
                onChange={(e) => {
                  setPhoneCountry(e.target.value);
                  setPhoneCheck(null);
                  setPhoneError(null);
                }}
                className="rounded-md px-2 py-2 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                  maxWidth: '8.5rem',
                }}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} +{c.dial}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setPhoneNumber(digits);
                    setPhoneCheck(null);
                    setPhoneError(null);
                  }}
                  onBlur={() => {
                    const e164 = toE164(getCountry(phoneCountry).dial, phoneNumber);
                    if (isValidE164(e164)) checkPhone(e164);
                  }}
                  placeholder="Número de WhatsApp"
                  className="pr-9"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
                />
                {phoneChecking && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            </div>

            {/* Phone feedback */}
            {phoneError && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--accent-red)',
                }}
              >
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="flex-1">{phoneError}</span>
              </div>
            )}
            {phoneCheck?.exists === false && isValidE164(toE164(getCountry(phoneCountry).dial, phoneNumber)) && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: 'var(--score-green)',
                }}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span className="flex-1">Número disponible. Te quedan <strong>{guestInitialCredits}</strong> créditos.</span>
              </div>
            )}

            {/* "More credits" prompt: when the phone exists and has 1 credit left */}
            {phoneCheck?.exists === true && phoneCheck.credits === 1 && (
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                }}
              >
                <p className="text-xs leading-snug" style={{ color: 'var(--accent-yellow)' }}>
                  <AlertCircle className="size-3.5 inline mr-1" />
                  Tras crear este evento te quedará <strong>1 crédito</strong> (el último).
                  ¿Te gustaría obtener más créditos?
                </p>
                <a
                  href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent('Hola, me gustaría obtener más créditos para crear eventos en MarcadoresDJ.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
                  style={{ background: '#25D366', color: '#fff' }}
                >
                  <MessageCircle className="size-3.5" />
                  Me gustaría obtener más créditos
                </a>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 2 — SPORT ═══ */}
        {step === 2 && (
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
                    onClick={() => {
                      setSelectedSport(s);
                      setTeamA(null);
                      setTeamB(null);
                    }}
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

        {/* ═══ STEP 3 & 4 — TEAMS ═══ */}
        {(step === 3 || step === 4) && selectedSport && (
          <TeamPicker
            label={step === 3 ? 'Equipo Local' : 'Equipo Visitante'}
            sport={selectedSport}
            selection={step === 3 ? teamA : teamB}
            excludedTeamId={step === 4 && teamA?.mode === 'existing' ? teamA.team.id : null}
            excludedTeamName={
              (step === 4 && teamA?.mode === 'new' ? teamA.name.trim() : '') || null
            }
            onSelect={(sel) => (step === 3 ? setTeamA(sel) : setTeamB(sel))}
          />
        )}

        {/* ═══ STEP 5 — DETAILS ═══ */}
        {step === 5 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Detalles del evento
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nombre (opcional)</Label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder={`${teamLabel(teamA)} vs ${teamLabel(teamB)}`}
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
                {selectedSport?.icon} {selectedSport?.name} · {teamLabel(teamA)} <span style={{ color: 'var(--text-muted)' }}>vs</span> {teamLabel(teamB)}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>
                Jugadores: {playerCount(teamA)} local · {playerCount(teamB)} visitante
              </p>
            </div>
          </div>
        )}

        {/* ═══ STEP 6 — DONE / CREDENTIALS ═══ */}
        {step === 6 && result && (
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

            {/* Credits info */}
            {result.lastCredit ? (
              <div
                className="rounded-lg p-3 space-y-2"
                style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)' }}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent-yellow)' }}>
                  <AlertCircle className="size-3.5" />
                  Te quedan <strong>0 créditos</strong> — este fue el último
                </p>
                <a
                  href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent('Hola, me gustaría obtener más créditos para crear eventos en MarcadoresDJ.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
                  style={{ background: '#25D366', color: '#fff' }}
                >
                  <MessageCircle className="size-3.5" />
                  Me gustaría obtener más créditos
                </a>
              </div>
            ) : (
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Te quedan <strong style={{ color: 'var(--score-green)' }}>{result.creditsLeft}</strong> crédito(s) para crear más eventos.
              </p>
            )}
          </div>
        )}

        {/* ═══ FOOTER / NAV ═══ */}
        {step < 6 && (
          <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
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

            {step < 5 ? (
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

        {step === 6 && (
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

/* ── helpers ── */

function isValidTeamSelection(sel: TeamSelection | null): boolean {
  if (!sel) return false;
  if (sel.mode === 'existing') return !!sel.team;
  return sel.name.trim().length > 0;
}

function teamLabel(sel: TeamSelection | null): string {
  if (!sel) return '—';
  if (sel.mode === 'existing') return sel.team.name;
  return sel.name.trim() || 'Equipo';
}

function playerCount(sel: TeamSelection | null): number {
  if (!sel || sel.mode !== 'new') return 0;
  return sel.players.filter((p) => p.name.trim() && p.position && p.number !== '').length;
}

/* ════════════════════════════════════════════════════════════════════════════
   TeamPicker — buscar equipo existente o crear uno nuevo con jugadores
   opcionales (numero, posicion, nombre).
   ════════════════════════════════════════════════════════════════════════════ */
function TeamPicker({
  label,
  sport,
  selection,
  excludedTeamId,
  excludedTeamName,
  onSelect,
}: {
  label: string;
  sport: Sport;
  selection: TeamSelection;
  excludedTeamId: string | null;
  excludedTeamName: string | null;
  onSelect: (sel: TeamSelection) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // "new" mode local form state
  const [newName, setNewName] = useState('');
  const [showPlayers, setShowPlayers] = useState(false);
  const [players, setPlayers] = useState<NewPlayer[]>([]);

  const mode: 'existing' | 'new' | null = selection?.mode ?? null;

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      // Public endpoint (no auth) so unauthenticated visitors can pick teams.
      const res = await apiGet<{ success: boolean; teams: Team[] }>(
        `/api/public/teams?sportId=${sport.id}`,
      );
      setTeams(res.teams.filter((t) => t.id !== excludedTeamId));
    } catch {
      // ignore — network error; visitor can still create a new team
    } finally {
      setLoading(false);
    }
  }, [sport.id, excludedTeamId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // When entering "new" mode, initialize the local form from any prior new-state.
  useEffect(() => {
    if (selection?.mode === 'new') {
      setNewName(selection.name);
      setPlayers(selection.players.length > 0 ? selection.players : []);
      setShowPlayers(selection.players.length > 0);
    }
  }, [selection]);

  const filtered = useMemo(
    () =>
      teams.filter((t) => {
        if (
          excludedTeamName &&
          t.name.toLowerCase() === excludedTeamName.toLowerCase()
        )
          return false;
        return t.name.toLowerCase().includes(search.toLowerCase());
      }),
    [teams, search, excludedTeamName],
  );

  const commitNew = useCallback(() => {
    const cleaned: NewPlayer[] = players
      .map((p) => ({ name: p.name.trim(), number: p.number, position: p.position }))
      .filter((p) => p.name || p.number !== '' || p.position);
    onSelect({ mode: 'new', name: newName, players: cleaned });
  }, [newName, players, onSelect]);

  const positions = positionsFor(sport.name);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</h3>
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
        >
          <button
            type="button"
            onClick={() => {
              // Reset to existing-pick mode with no selection; user must pick a team.
              onSelect(null);
            }}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
            style={{
              background: mode !== 'new' ? 'var(--accent)' : 'transparent',
              color: mode !== 'new' ? '#fff' : 'var(--text-muted)',
            }}
          >
            Existente
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect({ mode: 'new', name: newName, players });
              setShowPlayers(players.length > 0);
            }}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
            style={{
              background: mode === 'new' ? 'var(--accent)' : 'transparent',
              color: mode === 'new' ? '#fff' : 'var(--text-muted)',
            }}
          >
            Crear nuevo
          </button>
        </div>
      </div>

      {mode !== 'new' ? (
        /* ── Existing-team picker ── */
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
          {selection?.mode === 'existing' && selection.team ? (
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 className="size-3.5 inline mr-1.5" style={{ color: 'var(--score-green)' }} />
                {selection.team.name}
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
              <br />Usa “Crear nuevo” para definir uno.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelect({ mode: 'existing', team: t })}
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
      ) : (
        /* ── New-team form with optional players ── */
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre del equipo
            </Label>
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                commitNewDebounced();
              }}
              onBlur={commitNew}
              placeholder={`Ej. ${label} FC`}
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          {/* Players (optional) toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !showPlayers;
              setShowPlayers(next);
              if (next && players.length === 0) {
                setPlayers([{ name: '', number: '', position: '' }]);
              }
              commitNew();
            }}
            className="w-full flex items-center justify-between p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <Users className="size-3.5" style={{ color: 'var(--accent)' }} />
              Jugadores (opcional)
              {players.filter((p) => p.name.trim() && p.position && p.number !== '').length > 0 && (
                <Badge variant="secondary" className="text-[9px]">
                  {players.filter((p) => p.name.trim() && p.position && p.number !== '').length}
                </Badge>
              )}
            </span>
            <ChevronDown
              className="size-3.5 transition-transform"
              style={{ color: 'var(--text-muted)', transform: showPlayers ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {showPlayers && (
            <div className="space-y-2">
              {players.map((p, idx) => (
                <div key={idx} className="rounded-md p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)' }}>
                  {/* Row 1: number + position */}
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={p.number}
                      onChange={(e) => updatePlayer(idx, { number: e.target.value })}
                      onBlur={commitNew}
                      placeholder="#"
                      className="w-14 text-center shrink-0"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
                    />
                    <select
                      value={p.position}
                      onChange={(e) => updatePlayer(idx, { position: e.target.value })}
                      onBlur={commitNew}
                      className="flex-1 min-w-0 h-9 rounded-md px-2 text-xs"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Posición...</option>
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setPlayers((prev) => prev.filter((_, i) => i !== idx));
                        setTimeout(commitNew, 0);
                      }}
                      className="shrink-0 size-8 flex items-center justify-center rounded-md"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Quitar jugador"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {/* Row 2: name (full width) */}
                  <Input
                    value={p.name}
                    onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                    onBlur={commitNew}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPlayerRow();
                      }
                    }}
                    placeholder="Nombre del jugador"
                    className="w-full"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={addPlayerRow}
                className="gap-1 text-xs w-full"
                style={{ color: 'var(--accent)', border: '1px dashed var(--border-custom)' }}
              >
                <Plus className="size-3.5" />
                Agregar jugador
              </Button>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Puedes dejarlo vacío si aún no conoces la plantilla. Las filas incompletas se ignoran.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function updatePlayer(idx: number, patch: Partial<NewPlayer>) {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addPlayerRow() {
    setPlayers((prev) => [...prev, { name: '', number: '', position: '' }]);
  }
  // Commit without forcing a full re-render loop on every keystroke.
  function commitNewDebounced() {
    // lightweight: rely on onBlur to commit; this avoids stale closures.
  }
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
