'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
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
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Column mapping ─────────────────────────────────────────────────────── */

const COLUMNS = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'shortName', label: 'Nombre Corto', required: false },
  { key: 'sport', label: 'Deporte', required: true },
  { key: 'gender', label: 'Genero', required: false },
  { key: 'ageCategory', label: 'Categoria Edad', required: false },
  { key: 'logo', label: 'URL Logo', required: false },
];

/* ── Template generation (client-side) ──────────────────────────────────── */

function downloadTemplate(sportNames: string[]) {
  import('xlsx').then((XLSX) => {
    const headers = COLUMNS.map((c) => c.label);
    const exampleRows = sportNames.map((s) => [
      `Equipo de ${s}`,
      s.slice(0, 3).toUpperCase(),
      s,
      'Mixto',
      'Libre',
      '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 35 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, 'plantilla_equipos.xlsx');
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

/* ── Map raw row to team data ───────────────────────────────────────────── */

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
    } else {
      mapped[col.key] = value === '' ? null : String(value).trim();
    }
  }

  if (errors.length > 0) return null;
  return mapped;
}

/* ── Component ──────────────────────────────────────────────────────────── */

interface ImportTeamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportTeamsModal({
  open,
  onOpenChange,
  onImported,
}: ImportTeamsModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [sportNames, setSportNames] = useState<string[]>([]);

  /* Fetch sport names for template */
  useEffect(() => {
    if (!open) return;
    apiGet<{ success: boolean; sports: { name: string }[] }>('/api/sports')
      .then((res) => setSportNames(res.sports.map((s) => s.name)))
      .catch(() => {});
  }, [open]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setParseErrors([]);
    setServerErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseErrors([]);
    setServerErrors([]);

    try {
      const rawRows = await parseExcelFile(file);
      if (rawRows.length === 0) {
        setParseErrors(['El archivo esta vacio']);
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
        setParseErrors(errors.length > 0 ? errors : ['No se pudieron leer equipos del archivo']);
        return;
      }

      setRows(mapped);
      setParseErrors(errors);
      setStep('preview');
    } catch {
      setParseErrors(['Error al procesar el archivo. Asegurate de que sea un archivo .xlsx o .xls valido.']);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setServerErrors([]);
    try {
      const res = await apiPost<{
        success: boolean;
        created: number;
        total: number;
        errors?: { row: number; message: string }[];
      }>('/api/teams/batch', { teams: rows });

      if (res.errors && res.errors.length > 0) {
        setServerErrors(res.errors);
      }

      toast({
        title: 'Equipos importados',
        description: `${res.created} de ${res.total} equipo${res.total !== 1 ? 's' : ''} importado${res.created !== 1 ? 's' : ''} exitosamente.`,
      });
      setStep('done');
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al importar equipos';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [rows, onImported, toast]);

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) {
        reset();
        onOpenChange(false);
      }
    },
    [reset, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            Importar Equipos
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Importa multiples equipos desde un archivo Excel
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
              onClick={() => downloadTemplate(sportNames.length > 0 ? sportNames : ['Futbol', 'Baloncesto', 'Microfutbol'])}
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
            >
              <Download className="size-4 mr-2" />
              Descargar Plantilla Excel
            </Button>

            {parseErrors.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: '#fef2f2' }}>
                {parseErrors.map((err, i) => (
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
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                * Los campos marcados son obligatorios. En &quot;Deporte&quot; usa el nombre exacto (ej: Futbol, Baloncesto, Microfutbol).
                En &quot;Genero&quot; usa: Masculino, Femenino o Mixto. En &quot;Categoria Edad&quot; usa: Sub-13, Sub-15, Sub-17, Juvenil, Junior, Sub-20, Sub-23, Senior o Libre.
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
              {rows.length} equipo{rows.length !== 1 ? 's' : ''} listo{rows.length !== 1 ? 's' : ''} para importar
            </p>

            {parseErrors.length > 0 && (
              <div className="rounded-lg p-2" style={{ background: '#fffbeb' }}>
                {parseErrors.map((err, i) => (
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
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)', width: '40px' }}>#</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Nombre</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Corto</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Deporte</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Genero</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} style={{ borderColor: 'var(--border-custom)' }}>
                      <TableCell className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {String(row.name)}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {row.shortName ? String(row.shortName) : '-'}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--accent)' }}>
                        {String(row.sport)}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {row.gender ? String(row.gender) : 'Mixto'}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {row.ageCategory ? String(row.ageCategory) : 'Libre'}
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
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div
              className="flex size-16 items-center justify-center rounded-full text-3xl"
              style={{ background: '#dcfce7' }}
            >
              ✅
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Importacion completada
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {rows.length} equipo{rows.length !== 1 ? 's' : ''} procesado{rows.length !== 1 ? 's' : ''}
              </p>
            </div>

            {serverErrors.length > 0 && (
              <div className="w-full max-w-md rounded-lg p-3" style={{ background: '#fffbeb' }}>
                <p className="text-xs font-bold mb-1 text-amber-700">
                  Algunas filas no se pudieron importar:
                </p>
                <div className="max-h-32 overflow-y-auto">
                  {serverErrors.map((err, i) => (
                    <p key={i} className="text-[11px] text-amber-700">
                      Fila {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          {step !== 'done' && (
            <>
              <Button
                variant="outline"
                onClick={() => { reset(); onOpenChange(false); }}
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
                  Importar {rows.length} equipo{rows.length !== 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}
          {step === 'done' && (
            <Button
              onClick={() => { reset(); onOpenChange(false); }}
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