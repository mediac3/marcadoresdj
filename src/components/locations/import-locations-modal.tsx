'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  Check,
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

interface LocationRow {
  pais: string;
  codigoPais?: string;
  departamento: string;
  ciudad: string;
}

const COLUMNS = [
  { key: 'pais', label: 'País', required: true },
  { key: 'codigoPais', label: 'Código País', required: false },
  { key: 'departamento', label: 'Departamento / Estado', required: true },
  { key: 'ciudad', label: 'Ciudad', required: true },
];

/* ── Template generation (client-side) ──────────────────────────────────── */

function downloadTemplate() {
  import('xlsx').then((XLSX) => {
    const headers = COLUMNS.map((c) => c.label);
    const exampleRows: (string | undefined)[][] = [
      ['Colombia', 'CO', 'Antioquia', 'Medellín'],
      ['Colombia', 'CO', 'Atlántico', 'Barranquilla'],
      ['Colombia', 'CO', 'Bogotá D.C.', 'Bogotá'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    ws['!cols'] = [
      { wch: 20 }, // País
      { wch: 16 }, // Código País
      { wch: 24 }, // Departamento / Estado
      { wch: 20 }, // Ciudad
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ubicaciones');
    XLSX.writeFile(wb, 'plantilla_ubicaciones.xlsx');
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

/* ── Map raw row to location data ────────────────────────────────────────── */

function mapRow(row: Record<string, unknown>): LocationRow | null {
  const mapped: Partial<LocationRow> = {};
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
      const str = String(value).trim();
      if (col.key === 'codigoPais') {
        mapped[col.key] = str === '' ? undefined : str;
      } else {
        mapped[col.key as keyof LocationRow] = str as LocationRow[keyof LocationRow];
      }
    }
  }

  if (errors.length > 0) return null;
  return mapped as LocationRow;
}

/* ── Component ──────────────────────────────────────────────────────────── */

interface ImportLocationsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  created: {
    countries: number;
    departments: number;
    cities: number;
  };
  total: number;
  errors?: { row: number; error: string }[];
}

export function ImportLocationsModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportLocationsModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<{ row: number; error: string }[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setImportErrors([]);
    setServerErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  /* Compute unique counts for preview */
  const uniqueCountries = new Set(rows.map((r) => r.pais)).size;
  const uniqueDepartments = new Set(rows.map((r) => `${r.pais}|${r.departamento}`)).size;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setImportErrors([]);

      try {
        const rawRows = await parseExcelFile(file);
        if (rawRows.length === 0) {
          setImportErrors(['El archivo está vacío']);
          return;
        }

        const mapped: LocationRow[] = [];
        const errors: string[] = [];

        for (let i = 0; i < rawRows.length; i++) {
          const result = mapRow(rawRows[i]);
          if (result) {
            mapped.push(result);
          } else {
            errors.push(`Fila ${i + 2}: datos incompletos o inválidos`);
          }
        }

        if (mapped.length === 0) {
          setImportErrors(
            errors.length > 0
              ? errors
              : ['No se pudieron leer ubicaciones del archivo'],
          );
          return;
        }

        setRows(mapped);
        setImportErrors(errors);
        setStep('preview');
      } catch {
        setImportErrors([
          'Error al procesar el archivo. Asegúrate de que sea un archivo .xlsx o .xls válido.',
        ]);
      }
    },
    [],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setServerErrors([]);
    setImportResult(null);
    try {
      const res = await apiPost<ImportResult>('/api/locations/batch', {
        rows,
      });

      if (res.errors && res.errors.length > 0) {
        setServerErrors(res.errors);
      }

      setImportResult(res);

      toast({
        title: 'Importación completada',
        description: `${res.total} registro${res.total !== 1 ? 's' : ''} procesado${res.total !== 1 ? 's' : ''}: ${res.created.countries} país${res.created.countries !== 1 ? 'es' : ''}, ${res.created.departments} departamento${res.created.departments !== 1 ? 's' : ''}, ${res.created.cities} ciudad${res.created.cities !== 1 ? 'es' : ''}${res.errors && res.errors.length > 0 ? `, ${res.errors.length} con error` : ''}.`,
        variant: res.errors && res.errors.length > 0 && res.total === res.errors.length ? 'destructive' : undefined,
      });

      setStep('done');
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al importar ubicaciones';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [rows, onSuccess, toast]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            Importar Ubicaciones
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Importa países, departamentos/estados y ciudades desde un archivo Excel.
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
                  Formatos aceptados: .xlsx, .xls, .csv &middot; Máximo 5 MB
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
                * Países, departamentos y ciudades se crearán automáticamente si no existen.
                La columna &quot;Código País&quot; acepta códigos ISO como &quot;CO&quot;.
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

            {/* Summary counts */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center size-6 rounded-md text-[11px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {uniqueCountries}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  país{uniqueCountries !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center size-6 rounded-md text-[11px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {uniqueDepartments}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  departamento{uniqueDepartments !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center justify-center size-6 rounded-md text-[11px] font-bold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {rows.length}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  ciudad{rows.length !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {rows.length} fila{rows.length !== 1 ? 's' : ''} lista{rows.length !== 1 ? 's' : ''} para importar
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
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>País</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)', width: '70px' }}>Código</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Departamento / Estado</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Ciudad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} style={{ borderColor: 'var(--border-custom)' }}>
                      <TableCell className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {row.pais}
                      </TableCell>
                      <TableCell className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {row.codigoPais || '—'}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {row.departamento}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-primary)' }}>
                        {row.ciudad}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && importResult && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div
              className="flex size-16 items-center justify-center rounded-full text-3xl"
              style={{
                background:
                  serverErrors.length > 0 && importResult.total === serverErrors.length
                    ? '#fef2f2'
                    : '#dcfce7',
              }}
            >
              {serverErrors.length > 0 && importResult.total === serverErrors.length
                ? '⚠️'
                : '✅'}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {serverErrors.length > 0 && importResult.total === serverErrors.length
                  ? 'Importación con errores'
                  : 'Importación completada'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {importResult.total} registro{importResult.total !== 1 ? 's' : ''} procesado{importResult.total !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Success breakdown */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5" style={{ color: '#16a34a' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {importResult.created.countries} país{importResult.created.countries !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5" style={{ color: '#16a34a' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {importResult.created.departments} departamento{importResult.created.departments !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="size-3.5" style={{ color: '#16a34a' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {importResult.created.cities} ciudad{importResult.created.cities !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>

            {/* Show server errors if any */}
            {serverErrors.length > 0 && (
              <div
                className="w-full rounded-lg border p-3 max-h-48 overflow-y-auto text-left"
                style={{ borderColor: '#fca5a5', background: '#fef2f2' }}
              >
                <p className="text-xs font-bold mb-2 text-red-700">Errores por fila:</p>
                {serverErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-600 flex items-start gap-1">
                    <X className="size-3 shrink-0 mt-0.5" />
                    <span>
                      <strong>Fila {err.row}:</strong> {err.error}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {serverErrors.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#16a34a' }}>
                <Check className="size-3.5" />
                Todas las ubicaciones se crearon correctamente
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          {step !== 'done' && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
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
                  Importar {rows.length} fila{rows.length !== 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}
          {step === 'done' && (
            <Button
              onClick={handleClose}
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