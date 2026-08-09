'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { FileText, Loader2, Check, Eye, Code, AlertCircle, History, RotateCcw, SplitSquareHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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

  // El botón Guardar se habilita cuando hay cambios reales respecto a lo cargado.
  const [initialContent, setInitialContent] = useState(DEFAULT_TERMS);
  const [initialEnabled, setInitialEnabled] = useState(true);
  const hasChanges = content !== initialContent || enabled !== initialEnabled;

  /* ── Editor view mode: edit | split | preview ── */
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');

  /* ── Transient "saved" confirmation ── */
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
      setSavedAt(Date.now());
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

  /* ── Reset / restore helpers ── */
  const handleReset = () => {
    setContent(initialContent);
    setEnabled(initialEnabled);
  };
  const handleRestoreDefault = () => {
    setContent(DEFAULT_TERMS);
  };

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
            style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}
          >
            <FileText className="size-[1.125rem]" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
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
          {loadedVersion > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              v{loadedVersion}
            </span>
          )}
          {savedAt && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold shrink-0"
              style={{ color: 'var(--score-green)' }}
            >
              <Check className="size-3" />
              Guardado
            </span>
          )}
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Contenido
          <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
            {hasChanges
              ? `borrador → v${loadedVersion + 1} al guardar`
              : loadedVersion > 0
                ? `publicado: v${loadedVersion}`
                : 'sin publicar'}
          </span>
        </Label>
        {/* View mode toggle: Editar | Dividido | Vista previa */}
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
        >
          {([
            { key: 'edit', label: 'Editar', icon: Code },
            { key: 'split', label: 'Dividido', icon: SplitSquareHorizontal },
            { key: 'preview', label: 'Preview', icon: Eye },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setViewMode(opt.key)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: viewMode === opt.key ? 'var(--accent)' : 'transparent',
                  color: viewMode === opt.key ? '#fff' : 'var(--text-muted)',
                }}
              >
                <Icon className="size-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor / Preview area */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        viewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
            <div
              className="rounded-lg p-4 min-h-[300px] prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            >
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>— Sin contenido —</span>
              )}
            </div>
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
        )
      )}

      {viewMode === 'preview' && (
        <div
          className="rounded-lg p-4 min-h-[300px] prose prose-sm dark:prose-invert max-w-none overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-custom)',
            color: 'var(--text-primary)',
          }}
        >
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>— Sin contenido —</span>
          )}
        </div>
      )}

      {/* ── Save / Reset / Restore ── */}
      <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasChanges || saving}
            onClick={handleReset}
            className="gap-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="size-3.5" />
            Restablecer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={handleRestoreDefault}
            className="gap-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <FileText className="size-3.5" />
            Restaurar predeterminado
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Guardar generará v{loadedVersion + 1} y exigirá re-aceptación
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
