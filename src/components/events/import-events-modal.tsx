'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Column mapping ─────────────────────────────────────────────────────── */

const COLUMNS = [
  { key: 'name', label: 'Nombre Evento', required: false },
  { key: 'sportName', label: 'Deporte', required: true },
  { key: 'teamAName', label: 'Equipo Local', required: true },
  { key: 'teamBName', label: 'Equipo Visitante', required: true },
  { key: 'location', label: 'Ubicacion', required: false },
  { key: 'scheduledAt', label: 'Fecha y Hora', required: false },
  { key: 'tournamentName', label: 'Torneo', required: false },
  { key: 'phase', label: 'Fase', required: false },
  { key: 'isPublic', label: 'Publico', required: false },
];

/* ── Template generation (client-side) ──────────────────────────────────── */

function downloadTemplate() {
  import('xlsx').then((XLSX) => {
    const headers = COLUMNS.map((c) => c.label);
    const exampleRows = [
      [
        'Jornada 1 - Grupo A',
        'Fútbol',
        'Los Tiburones',
        'Las Águilas',
        'Cancha Sintética El Dorado',
        '2026-07-15 16:00',
        'Copa DJ 2026',
        'Fase de Grupos - Grupo A',
        'Si',
      ],
      [
        'Jornada 1 - Grupo B',
        'Baloncesto',
        'Leones FC',
        'Panteras BC',
        'Gimnasio Municipal',
        '2026-07-15 18:30',
        'Copa DJ 2026',
        'Fase de Grupos - Grupo B',
        'Si',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    ws['!cols'] = [
      { wch: 28 },  // Nombre Evento
      { wch: 16 },  // Deporte
      { wch: 22 },  // Equipo Local
      { wch: 22 },  // Equipo Visitante
      { wch: 28 },  // Ubicación
      { wch: 20 },  // Fecha y Hora
      { wch: 20 },  // Torneo
      { wch: 28 },  // Fase
      { wch: 10 },  // Público
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eventos');
    XLSX.writeFile(wb, 'plantilla_eventos_marcadoresdj.xlsx');
  });
}

/* ── Parse uploaded file ─────────────────────────────────────────────────── */

function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        import('xlsx').then((XLSX) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          resolve(rows as Record<string, unknown>[]);
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

/* ── Map raw row to event data ──────────────────────────────────────────── */

function mapRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const col of COLUMNS) {
    let value: unknown = '';
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === col.label.toLowerCase()) {
        value = row[key];
        break;
      }
    }

    if (col.required && (value === '' || value === null || value === undefined)) {
      errors.push(`${col.label} es requerido`);
    } else if (col.key === 'isPublic') {
      // Normalize public field
      const str = String(value).trim().toLowerCase();
      mapped[col.key] = str === 'no' || str === 'false' || str === '0' ? false : true;
    } else if (col.key === 'scheduledAt') {
      // Keep as string, the API will parse it
      mapped[col.key] = value === '' ? null : String(value).trim();
    } else {
      mapped[col.key] = value === '' ? null : String(value).trim();
    }
  }

  if (errors.length > 0) return null;
  return mapped;
}

/* ── Component ──────────────────────────────────────────────────────────── */

interface ImportEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportEventsModal({
  isOpen,
  onClose,
  onImported,
}: ImportEventsModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<{ row: number; error: string }[]>([]);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setImportErrors([]);
    setServerErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setImportErrors([]);

      try {
        const rawRows = await parseExcelFile(file);
        if (rawRows.length === 0) {
          setImportErrors(['El archivo esta vacio']);
          return;
        }

        const mapped: Record<string, unknown>[] = [];
        const errors: string[] = [];

        for (let i = 0; i < rawRows.length; i++) {
          const result = mapRow(rawRows[i]);
          if (result) {
            mapped.push(result);
          } else {
            errors.push(`Fila ${i + 2}: datos incompletos o invalidos`);
          }
        }

        if (mapped.length === 0) {
          setImportErrors(errors.length > 0 ? errors : ['No se pudieron leer eventos del archivo']);
          return;
        }

        setRows(mapped);
        setImportErrors(errors);
        setStep('preview');
      } catch {
        setImportErrors(['Error al procesar el archivo. Asegurate de que sea un archivo .xlsx o .xls valido.']);
      }
    },
    [],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setServerErrors([]);
    try {
      const res = await apiPost<{
        success: boolean;
        created: number;
        errors: number;
        results: { row: number; error: string }[];
      }>('/api/events/batch', { events: rows });

      if (res.errors > 0) {
        setServerErrors(res.results || []);
      }

      toast({
        title: 'Importacion completada',
        description: `${res.created} evento${res.created !== 1 ? 's' : ''} creado${res.created !== 1 ? 's' : ''}${res.errors > 0 ? `, ${res.errors} con error` : ''}.`,
        variant: res.errors > 0 && res.created === 0 ? 'destructive' : undefined,
      });

      setStep('done');
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al importar eventos';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [rows, onImported, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            Importar Eventos
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Importa multiples eventos desde un archivo Excel. Los equipos y deportes deben existir previamente.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: Upload ── */}
        {step === 'upload' && (
          <div className="flex flex-col gap-4 py-2">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border-custom)' }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-custom)';
              }}
            >
              <Upload className="size-10" style={{ color: 'var(--text-muted)' }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Haz clic para seleccionar un archivo Excel
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Formatos aceptados: .xlsx, .xls, .csv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Button
              variant="outline"
              className="w-fit mx-auto text-sm"
              onClick={downloadTemplate}
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
            >
              <Download className="size-4 mr-2" />
              Descargar Plantilla Excel
            </Button>

            {importErrors.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: '#fef2f2' }}>
                {importErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Column reference */}
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
              <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Columnas de la plantilla:
              </p>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((col) => (
                  <span
                    key={col.key}
                    className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{
                      background: col.required ? 'var(--accent)' : 'var(--bg-card)',
                      color: col.required ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {col.label} {col.required ? '*' : ''}
                  </span>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                * Los equipos y deportes deben estar creados previamente en el sistema.
                La columna &quot;Publico&quot; acepta: Si/No.
                La columna &quot;Fecha y Hora&quot; acepta formatos como: 2026-07-15 16:00
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === 'preview' && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {fileName}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={reset}
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="size-3.5" />
                Cambiar archivo
              </Button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {rows.length} evento{rows.length !== 1 ? 's' : ''} listo{rows.length !== 1 ? 's' : ''} para importar
            </p>

            {importErrors.length > 0 && (
              <div className="rounded-lg p-2" style={{ background: '#fffbeb' }}>
                {importErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-amber-700">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Preview table */}
            <div
              className="rounded-lg border overflow-x-auto max-h-72"
              style={{ borderColor: 'var(--border-custom)' }}
            >
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)', width: '32px' }}>#</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Deporte</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Equipo Local</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>VS</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Equipo Visitante</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Fecha</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Torneo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} style={{ borderColor: 'var(--border-custom)' }}>
                      <TableCell className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {String(row.sportName)}
                      </TableCell>
                      <TableCell
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {String(row.teamAName)}
                      </TableCell>
                      <TableCell className="text-[11px] font-bold text-center" style={{ color: 'var(--accent)' }}>
                        VS
                      </TableCell>
                      <TableCell
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {String(row.teamBName)}
                      </TableCell>
                      <TableCell className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {row.scheduledAt ? String(row.scheduledAt) : '—'}
                      </TableCell>
                      <TableCell className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {row.tournamentName ? String(row.tournamentName) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div
              className="flex size-16 items-center justify-center rounded-full text-3xl"
              style={{ background: serverErrors.length > 0 && rows.length === serverErrors.length ? '#fef2f2' : '#dcfce7' }}
            >
              {serverErrors.length > 0 && rows.length === serverErrors.length ? '⚠️' : '✅'}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {serverErrors.length > 0 && rows.length === serverErrors.length
                  ? 'Importacion con errores'
                  : 'Importacion completada'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {rows.length - serverErrors.length} de {rows.length} evento{rows.length !== 1 ? 's' : ''} importado{rows.length !== 1 ? 's' : ''} correctamente
              </p>
            </div>

            {/* Show server errors if any */}
            {serverErrors.length > 0 && (
              <div className="w-full rounded-lg border p-3 max-h-48 overflow-y-auto text-left" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
                <p className="text-xs font-bold mb-2 text-red-700">Errores por fila:</p>
                {serverErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-600 flex items-start gap-1">
                    <AlertCircle className="size-3 shrink-0 mt-0.5" />
                    <span><strong>Fila {err.row}:</strong> {err.error}</span>
                  </p>
                ))}
              </div>
            )}

            {serverErrors.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#16a34a' }}>
                <CheckCircle2 className="size-3.5" />
                Todos los eventos se crearon correctamente como programados
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          {step !== 'done' && (
            <>
              <Button
                variant="outline"
                onClick={() => { reset(); onClose(); }}
                style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </Button>
              {step === 'preview' && (
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {importing && <Loader2 className="size-4 animate-spin" />}
                  Importar {rows.length} evento{rows.length !== 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}
          {step === 'done' && (
            <Button
              onClick={() => { reset(); onClose(); }}
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Listo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}