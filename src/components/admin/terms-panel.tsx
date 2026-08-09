'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { FileText, Loader2, Check, Eye, Code, AlertCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPut } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ════════════════════════════════════════════════════════════════════════════
   TermsPanel — gestión de Términos y Condiciones del servicio

   Persiste tres claves en el store genérico SiteSetting (key/value):
     - termsContent   (markdown/texto del documento)
     - termsVersion   (int como string; incrementa en cada guardado)
     - termsEnabled   ("true"/"false" — si el wizard público exige aceptación)

   El GET /api/admin/settings es público (lo lee el wizard público sin auth);
   el PUT requiere CREATOR+ADMIN. Como este panel es adminOnly, se alcanza
   solo desde el sidebar de ADMIN.
   ════════════════════════════════════════════════════════════════════════════ */

const DEFAULT_TERMS = `# Términos y Condiciones del Servicio

## 1. Aceptación
Al crear un evento en esta plataforma aceptas estos términos.

## 2. Responsabilidad del contenido
Eres responsable de la veracidad de la información del evento (equipos,
horarios, resultados) y del contenido que publiques.

## 3. Uso aceptable
No está permitido publicar contenido ofensivo, spam o que infrinja derechos
de terceros. El administrador puede eliminar eventos que incumplan estas
normas.

## 4. Cuenta de acceso
Al crear un evento público se genera una cuenta con la cual puedes gestionar
tu evento. Eres responsable de mantener la confidencialidad de tus
credenciales.

## 5. Modificaciones
Los términos pueden actualizarse; la versión vigente es la que se muestra al
crear un evento.
`;

interface TermsSettings {
  termsContent: string;
  termsVersion: string;
  termsEnabled: string;
}

function parseBool(value: string | undefined): boolean {
  return value === 'true';
}

function toBoolString(value: boolean): string {
  return value ? 'true' : 'false';
}

export function TermsPanel() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Working copy ── */
  const [content, setContent] = useState(DEFAULT_TERMS);
  const [enabled, setEnabled] = useState(true);
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  /* ── Acceptance audit history ── */
  const [acceptances, setAcceptances] = useState<Array<{
    id: string;
    termsVersion: number;
    acceptedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    event: { id: string; name: string | null; sport: { name: string; icon: string } | null; teamA: { name: string } | null; teamB: { name: string } | null } | null;
    guestUser: { id: string; username: string } | null;
  }>>([]);
  const [acceptancesLoading, setAcceptancesLoading] = useState(false);

  const hasContentChanged = useMemo(
    () => content.trim() !== DEFAULT_TERMS.trim() || loadedVersion > 0,
    [content, loadedVersion],
  );
  // El botón Guardar se habilita cuando hay cambios reales respecto a lo cargado.
  const [initialContent, setInitialContent] = useState(DEFAULT_TERMS);
  const [initialEnabled, setInitialEnabled] = useState(true);
  const hasChanges = content !== initialContent || enabled !== initialEnabled;

  /* ── Load ── */
  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Record<string, string>>('/api/admin/settings');
      const c = res.termsContent ?? DEFAULT_TERMS;
      const e = parseBool(res.termsEnabled);
      const v = parseInt(res.termsVersion ?? '0', 10) || 0;
      setContent(c);
      setEnabled(e);
      setLoadedVersion(v);
      setInitialContent(c);
      setInitialEnabled(e);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los términos',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Load acceptance audit history ── */
  const fetchAcceptances = useCallback(async () => {
    setAcceptancesLoading(true);
    try {
      const res = await apiGet<{ success: boolean; acceptances: typeof acceptances }>(
        '/api/admin/terms/acceptances',
      );
      setAcceptances(res.acceptances ?? []);
    } catch {
      // non-fatal — history is informational
    } finally {
      setAcceptancesLoading(false);
    }
  }, [acceptances]);

  useEffect(() => {
    fetchTerms();
    fetchAcceptances();
  }, [fetchTerms, fetchAcceptances]);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const nextVersion = loadedVersion + 1;
      const body: TermsSettings = {
        termsContent: content,
        termsVersion: String(nextVersion),
        termsEnabled: toBoolString(enabled),
      };
      await apiPut('/api/admin/settings', body);
      setLoadedVersion(nextVersion);
      setInitialContent(content);
      setInitialEnabled(enabled);
      toast({
        title: 'Términos guardados',
        description: `Versión ${nextVersion} publicada correctamente.`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar los términos',
      );
      toast({
        title: 'Error',
        description:
          err instanceof Error
            ? err.message
            : 'No se pudieron guardar los términos.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [content, enabled, loadedVersion, toast]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto w-full">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center size-8 rounded-lg"
            style={{ background: 'var(--accent)20' }}
          >
            <FileText className="size-4.5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1
              className="text-xl md:text-2xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              Términos y Condiciones
            </h1>
            <p
              className="text-sm mt-0.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Documento que los visitantes deben aceptar al crear un evento público
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div
        className="h-px w-full"
        style={{ background: 'var(--border-custom)' }}
      />

      {/* ── Error banner ── */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--accent-red)',
          }}
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* ── Enabled switch ── */}
      <div
        className="flex items-start justify-between gap-4 rounded-xl p-5"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-custom)',
        }}
      >
        <div className="min-w-0">
          <Label
            className="text-sm font-semibold block mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Exigir aceptación al crear evento
          </Label>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Cuando está activo, el wizard público muestra estos términos y exige
            marcar la casilla antes de crear un evento.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          className="shrink-0 mt-1"
        />
      </div>

      {/* ── Editor ── */}
      <div className="flex items-center justify-between">
        <Label
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Contenido {loadedVersion > 0 && `(versión actual: ${loadedVersion})`}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowPreview((s) => !s)}
          style={{ color: 'var(--text-secondary)' }}
        >
          {showPreview ? <Code className="size-3.5" /> : <Eye className="size-3.5" />}
          {showPreview ? 'Editar' : 'Vista previa'}
        </Button>
      </div>

      {showPreview ? (
        <div
          className="rounded-lg p-4 min-h-[300px] prose-sm max-w-none overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-custom)',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {content || '— Sin contenido —'}
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          placeholder="Escribe los términos en formato Markdown..."
          className="font-mono text-xs"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            minHeight: '300px',
          }}
        />
      )}

      {/* ── Save ── */}
      <div className="flex items-center justify-end pt-2 gap-3">
        {hasContentChanged && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Guardar generará una nueva versión que exigirá re-aceptación
          </span>
        )}
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
          {saving ? 'Guardando...' : 'Guardar y publicar'}
        </Button>
      </div>

      {/* ── Acceptance audit history ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-custom)',
        }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3 border-b"
          style={{ borderColor: 'var(--border-custom)' }}
        >
          <History className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Historial de aceptaciones
          </h2>
          {acceptances.length > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              {acceptances.length}
            </span>
          )}
          <button
            type="button"
            onClick={fetchAcceptances}
            disabled={acceptancesLoading}
            className="ml-auto text-[10px] font-semibold transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            {acceptancesLoading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {acceptancesLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : acceptances.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
            Aún no hay aceptaciones registradas. Aparecerán aquí cuando los visitantes
            creen eventos públicos aceptando los términos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left font-semibold px-3 py-2">Evento</th>
                  <th className="text-left font-semibold px-3 py-2">Usuario</th>
                  <th className="text-left font-semibold px-3 py-2">Versión</th>
                  <th className="text-left font-semibold px-3 py-2">Fecha</th>
                  <th className="text-left font-semibold px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {acceptances.map((a) => {
                  const ev = a.event;
                  const evLabel = ev?.name || (ev?.teamA && ev?.teamB ? `${ev.teamA.name} vs ${ev.teamB.name}` : '—');
                  return (
                    <tr
                      key={a.id}
                      className="border-t"
                      style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                    >
                      <td className="px-3 py-2">
                        <span className="mr-1">{ev?.sport?.icon}</span>
                        {evLabel}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{a.guestUser?.username ?? '—'}</td>
                      <td className="px-3 py-2">v{a.termsVersion}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(a.acceptedAt).toLocaleString('es-CO')}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{a.ipAddress ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
