'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  { key: 'name', label: 'Nombre', required: true },
  { key: 'number', label: 'Numero', required: true },
  { key: 'position', label: 'Posicion', required: true },
  { key: 'nickname', label: 'Apodo', required: false },
  { key: 'nationality', label: 'Nacionalidad', required: false },
  { key: 'birthDate', label: 'Fecha Nacimiento', required: false },
  { key: 'height', label: 'Estatura', required: false },
  { key: 'weight', label: 'Peso', required: false },
  { key: 'photo', label: 'URL Foto', required: false },
];

/* ── Template generation (client-side) ──────────────────────────────────── */

function downloadTemplate(sportName: string) {
  import('xlsx').then((XLSX) => {
    const headers = COLUMNS.map((c) => c.label);
    const exampleRow = [
      'Juan Perez',
      10,
      'Portero',
      'Juanpi',
      'Colombiano',
      '1995-03-15',
      '1.82',
      '78',
      '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    ws['!cols'] = COLUMNS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
    XLSX.writeFile(wb, `plantilla_jugadores_${sportName.replace(/\s/g, '_')}.xlsx`);
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

/* ── Map raw row to player data ──────────────────────────────────────────── */

function mapRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const col of COLUMNS) {
    // Try to find the column by label (case-insensitive, trimmed)
    let value: unknown = '';
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === col.label.toLowerCase()) {
        value = row[key];
        break;
      }
    }

    if (col.key === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        if (col.required) errors.push(`${col.label} no es un numero valido`);
        else mapped[col.key] = 0;
      } else {
        mapped[col.key] = Math.floor(num);
      }
    } else if (col.required && (value === '' || value === null || value === undefined)) {
      errors.push(`${col.label} es requerido`);
    } else {
      mapped[col.key] = value === '' ? null : String(value).trim();
    }
  }

  if (errors.length > 0) return null;
  return mapped;
}

/* ── Component ──────────────────────────────────────────────────────────── */

interface ImportPlayersModalProps {
  teamId: string;
  teamName: string;
  sportName: string;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportPlayersModal({
  teamId,
  teamName,
  sportName,
  isOpen,
  onClose,
  onImported,
}: ImportPlayersModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setImportErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

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
          setImportErrors(errors.length > 0 ? errors : ['No se pudieron leer jugadores del archivo']);
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
    try {
      await apiPost(`/api/teams/${teamId}/players/batch`, { players: rows });
      toast({
        title: 'Jugadores importados',
        description: `${rows.length} jugador${rows.length !== 1 ? 'es' : ''} agregado${rows.length !== 1 ? 's' : ''} a ${teamName}.`,
      });
      setStep('done');
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al importar jugadores';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [teamId, teamName, rows, onImported, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            Importar Jugadores
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            {teamName} ({sportName})
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
              onClick={() => downloadTemplate(sportName)}
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
              {rows.length} jugador{rows.length !== 1 ? 'es' : ''} listo{rows.length !== 1 ? 's' : ''} para importar
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
              className="rounded-lg border overflow-x-auto max-h-64"
              style={{ borderColor: 'var(--border-custom)' }}
            >
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)', width: '40px' }}>#</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Nombre</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)', width: '50px' }}>Num</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Posicion</TableHead>
                    <TableHead className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Apodo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} style={{ borderColor: 'var(--border-custom)' }}>
                      <TableCell className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-primary)' }}>
                        {String(row.name)}
                      </TableCell>
                      <TableCell className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                        {String(row.number)}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {String(row.position)}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {row.nickname ? String(row.nickname) : '—'}
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
                {rows.length} jugador{rows.length !== 1 ? 'es' : ''} agregado{rows.length !== 1 ? 's' : ''} a {teamName}
              </p>
            </div>
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
                  Importar {rows.length} jugador{rows.length !== 1 ? 'es' : ''}
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