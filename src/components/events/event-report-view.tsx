'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useAppStore, type SportEvent } from '@/lib/store';
import { apiGet } from '@/lib/api';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatTimer(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── Excel Export ─────────────────────────────────────────────────────────── */

async function exportToExcel(event: SportEvent) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const teamAName = event.teamA?.name ?? 'Equipo A';
  const teamBName = event.teamB?.name ?? 'Equipo B';
  const sportName = event.sport?.name ?? '';

  // ── Sheet 1: Resumen ──
  const summaryData = [
    ['REPORTE DE PARTIDO — MarcadoresDJ'],
    [],
    ['Deporte', sportName],
    ['Equipo A', teamAName],
    ['Equipo B', teamBName],
    ['Marcador Final', `${event.scoreA} - ${event.scoreB}`],
    ['Estado', event.status === 'FINISHED' ? 'Finalizado' : event.status],
    ['Fecha', formatDateTime(event.scheduledAt)],
    ['Ubicacion', event.location ?? '—'],
    ['Torneo', event.tournamentName ?? '—'],
    ['Fase', event.phase ?? '—'],
    ['Duracion', formatTimer(event.elapsedSeconds)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 20 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // ── Sheet 2: Acciones Equipo A ──
  const actionsA = (event.actions ?? [])
    .filter((a) => a.player && event.teamA?.players?.some((p) => p.id === a.playerId))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  const actionsB = (event.actions ?? [])
    .filter((a) => a.player && event.teamB?.players?.some((p) => p.id === a.playerId))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  function actionsToAoa(actions: NonNullable<typeof event.actions>, teamLabel: string) {
    const header: (string | number)[][] = [
      [`Acciones — ${teamLabel}`],
      [],
      ['Minuto', 'Tiempo', 'Jugador', 'Numero', 'Accion', 'Valor', 'Fecha/Hora'],
    ];
    const rows: (string | number)[][] = actions.map((a) => [
      a.minute ?? '—',
      a.half ?? '—',
      a.player?.name ?? '—',
      a.player?.number ?? '—',
      a.actionLabel ?? a.actionType,
      a.value ?? 1,
      a.createdAt ? new Date(a.createdAt).toLocaleString('es-ES') : '—',
    ]);
    return [...header, ...rows];
  }

  if (actionsA && actionsA.length > 0) {
    const wsA = XLSX.utils.aoa_to_sheet(actionsToAoa(actionsA, teamAName));
    wsA['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsA, teamAName.slice(0, 31));
  }

  if (actionsB && actionsB.length > 0) {
    const wsB = XLSX.utils.aoa_to_sheet(actionsToAoa(actionsB, teamBName));
    wsB['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsB, teamBName.slice(0, 31));
  }

  // ── Sheet 3: Comentarios ──
  const comments = [...(event.comments ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  if (comments.length > 0) {
    const cHeader = [
      'Comentarios en Vivo',
      [],
      ['Fecha/Hora', 'Tipo', 'Contenido'],
    ];
    const cRows: string[][] = comments.map((c) => [
      new Date(c.createdAt).toLocaleString('es-ES'),
      c.isAI ? 'IA' : 'Manual',
      c.content,
    ]);
    const wsC = XLSX.utils.aoa_to_sheet([...cHeader, ...cRows] as (string | number)[][]);
    wsC['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsC, 'Comentarios');
  }

  const fileName = `${teamAName}_vs_${teamBName}_${formatDate(event.scheduledAt).replace(/\s/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/* ── PDF Export ───────────────────────────────────────────────────────────── */

async function exportToPDF(event: SportEvent) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Use Noto Sans SC for CJK if available, fallback to helvetica
  const fontBase = 'helvetica';

  const teamAName = event.teamA?.name ?? 'Equipo A';
  const teamBName = event.teamB?.name ?? 'Equipo B';
  const sportName = event.sport?.name ?? '';
  const eventName = event.name || `${teamAName} vs ${teamBName}`;

  // ── Header ──
  doc.setFontSize(10);
  doc.setTextColor(130);
  doc.text('MarcadoresDJ - Reporte de Partido', 14, 15);

  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text(eventName, 14, 25);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Deporte: ${sportName}`, 14, 33);

  // Score box
  doc.setFillColor(30, 30, 30);
  doc.roundedRect(pageW / 2 - 30, 12, 60, 18, 3, 3, 'F');
  doc.setFontSize(20);
  doc.setTextColor(255);
  doc.text(`${event.scoreA}  -  ${event.scoreB}`, pageW / 2, 24.5, { align: 'center' });

  // ── Event details ──
  doc.setFontSize(9);
  doc.setTextColor(60);
  let y = 42;
  const details = [
    ['Fecha', formatDateTime(event.scheduledAt)],
    ['Ubicacion', event.location ?? '—'],
    ['Torneo', event.tournamentName ?? '—'],
    ['Fase', event.phase ?? '—'],
    ['Duracion', formatTimer(event.elapsedSeconds)],
  ];
  for (const [label, value] of details) {
    doc.setFont(fontBase, 'bold');
    doc.text(`${label}: `, 14, y);
    doc.setFont(fontBase, 'normal');
    doc.text(String(value), 14 + doc.getTextWidth(`${label}: `), y);
    y += 5;
  }

  y += 3;
  doc.setDrawColor(200);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  // ── Helper to render team actions table ──
  function renderTeamTable(
    teamLabel: string,
    actions: typeof event.actions,
  ) {
    if (!actions || actions.length === 0) return y;

    const sorted = [...actions].sort(
      (a, b) => (a.minute ?? 0) - (b.minute ?? 0),
    );

    // Check if we need a new page
    if (y + 20 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont(fontBase, 'bold');
    doc.setTextColor(30);
    doc.text(teamLabel, 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Min', 'Tiempo', 'Jugador', 'Num', 'Accion', 'Valor']],
      body: sorted.map((a) => [
        String(a.minute ?? '—'),
        a.half ?? '—',
        a.player?.name ?? '—',
        String(a.player?.number ?? '—'),
        a.actionLabel ?? a.actionType,
        String(a.value ?? 1),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 14 },
        2: { cellWidth: 45 },
        3: { cellWidth: 12 },
        4: { cellWidth: 35 },
        5: { cellWidth: 15 },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
    return y;
  }

  const actionsA = (event.actions ?? []).filter(
    (a) => a.player && event.teamA?.players?.some((p) => p.id === a.playerId),
  );
  const actionsB = (event.actions ?? []).filter(
    (a) => a.player && event.teamB?.players?.some((p) => p.id === a.playerId),
  );

  y = renderTeamTable(teamAName, actionsA);
  y = renderTeamTable(teamBName, actionsB);

  // ── Comments section ──
  const comments = [...(event.comments ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  if (comments.length > 0) {
    if (y + 20 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont(fontBase, 'bold');
    doc.setTextColor(30);
    doc.text('Comentarios en Vivo', 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Tipo', 'Comentario']],
      body: comments.map((c) => [
        new Date(c.createdAt).toLocaleTimeString('es-ES'),
        c.isAI ? 'IA' : 'Manual',
        c.content,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 15 },
        2: { cellWidth: pageW - 28 - 35 },
      },
    });
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `CopyExpress - 3226575422 · Eventos deportivos gratis`,
      pageW / 2,
      ph - 8,
      { align: 'center' },
    );
    doc.text(`Pagina ${i} de ${pageCount}`, pageW - 14, ph - 8, { align: 'right' });
  }

  doc.save(
    `${teamAName}_vs_${teamBName}_${formatDate(event.scheduledAt).replace(/\s/g, '_')}.pdf`,
  );
}

/* ── Stat helpers ─────────────────────────────────────────────────────────── */

interface PlayerStat {
  playerId: string;
  playerName: string;
  playerNumber: number;
  actions: Record<string, number>; // actionType -> count
}

function buildPlayerStats(
  actions: SportEvent['actions'],
  teamId: string,
): PlayerStat[] {
  const map = new Map<string, PlayerStat>();
  for (const a of actions ?? []) {
    if (!a.playerId || !a.player || a.player.teamId !== teamId) continue;
    let stat = map.get(a.playerId);
    if (!stat) {
      stat = {
        playerId: a.playerId,
        playerName: a.player.name,
        playerNumber: a.player.number,
        actions: {},
      };
      map.set(a.playerId, stat);
    }
    const key = a.actionLabel || a.actionType;
    stat.actions[key] = (stat.actions[key] || 0) + 1;
  }
  return Array.from(map.values()).sort((a, b) => a.playerNumber - b.playerNumber);
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function EventReportView() {
  const navigate = useAppStore((s) => s.navigate);
  const currentView = useAppStore((s) => s.currentView);
  const eventId = currentView.page === 'EVENT_REPORT' ? currentView.eventId : '';

  const [event, setEvent] = useState<SportEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; event: SportEvent }>(
        `/api/events/${eventId}`,
      );
      setEvent(data.event);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleExport = useCallback(
    async (format: 'excel' | 'pdf') => {
      if (!event) return;
      setExporting(format);
      try {
        if (format === 'excel') await exportToExcel(event);
        else await exportToPDF(event);
      } catch (err) {
        console.error('Export failed', err);
      } finally {
        setExporting(null);
      }
    },
    [event],
  );

  const statsA = useMemo(
    () => buildPlayerStats(event?.actions, event?.teamAId ?? ''),
    [event?.actions, event?.teamAId],
  );
  const statsB = useMemo(
    () => buildPlayerStats(event?.actions, event?.teamBId ?? ''),
    [event?.actions, event?.teamBId],
  );

  const allActionLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const a of event?.actions ?? []) {
      labels.add(a.actionLabel || a.actionType);
    }
    return Array.from(labels);
  }, [event?.actions]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--text-muted)' }}>Evento no encontrado</p>
      </div>
    );
  }

  const teamAName = event.teamA?.name ?? 'Equipo A';
  const teamBName = event.teamB?.name ?? 'Equipo B';

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Back + export buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button
          variant="ghost"
          className="w-fit h-8 gap-1.5 text-sm"
          onClick={() => navigate({ page: 'EVENT_LIST' })}
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="size-4" />
          Volver a Eventos
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-medium h-8"
            disabled={!!exporting}
            onClick={() => handleExport('excel')}
            style={{
              borderColor: 'var(--border-custom)',
              color: 'var(--text-secondary)',
            }}
          >
            {exporting === 'excel' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5" />
            )}
            Exportar Excel
          </Button>
          <Button
            size="sm"
            className="text-xs font-semibold h-8"
            disabled={!!exporting}
            onClick={() => handleExport('pdf')}
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* ── Event Header Card ── */}
      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        {/* Sport + event name */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{event.sport?.icon ?? '🏆'}</span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {event.sport?.name}
          </span>
          {(event.tournamentName || event.phase) && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <Trophy className="size-3" style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                {[event.tournamentName, event.phase].filter(Boolean).join(' — ')}
              </span>
            </>
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
          <div className="text-right min-w-0 flex-1">
            <p
              className="text-base sm:text-lg font-bold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {teamAName}
            </p>
          </div>
          <div className="text-center shrink-0">
            <p
              className="text-4xl sm:text-5xl font-black tabular-nums leading-none"
              style={{ color: 'var(--score-green, var(--accent))' }}
            >
              {event.scoreA} - {event.scoreB}
            </p>
            <p
              className="text-xs font-bold mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              FINAL
            </p>
          </div>
          <div className="text-left min-w-0 flex-1">
            <p
              className="text-base sm:text-lg font-bold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {teamBName}
            </p>
          </div>
        </div>

        {/* Meta info */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDateTime(event.scheduledAt)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {event.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatTimer(event.elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* ── Player Stats Tables ── */}
      {statsA.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
        >
          <div className="px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Estadisticas — {teamAName}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                  <TableHead style={{ color: 'var(--text-muted)', width: '50px' }}>N.</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Jugador</TableHead>
                  {allActionLabels.map((label) => (
                    <TableHead key={label} style={{ color: 'var(--text-muted)' }} className="text-center">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsA.map((stat) => (
                  <TableRow key={stat.playerId} style={{ borderColor: 'var(--border-custom)' }}>
                    <TableCell>
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>
                        {stat.playerNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {stat.playerName}
                      </span>
                    </TableCell>
                    {allActionLabels.map((label) => (
                      <TableCell key={label} className="text-center">
                        <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {stat.actions[label] || 0}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {statsB.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
        >
          <div className="px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Estadisticas — {teamBName}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                  <TableHead style={{ color: 'var(--text-muted)', width: '50px' }}>N.</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Jugador</TableHead>
                  {allActionLabels.map((label) => (
                    <TableHead key={label} style={{ color: 'var(--text-muted)' }} className="text-center">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsB.map((stat) => (
                  <TableRow key={stat.playerId} style={{ borderColor: 'var(--border-custom)' }}>
                    <TableCell>
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>
                        {stat.playerNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {stat.playerName}
                      </span>
                    </TableCell>
                    {allActionLabels.map((label) => (
                      <TableCell key={label} className="text-center">
                        <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {stat.actions[label] || 0}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Action Timeline ── */}
      {(event.actions?.length ?? 0) > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
        >
          <div className="px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Cronologia de Acciones ({(event.actions?.length ?? 0)})
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                  <TableHead style={{ color: 'var(--text-muted)', width: '55px' }}>Min</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)', width: '55px' }}>Tiempo</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Equipo</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Jugador</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Accion</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)', width: '45px' }}>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...(event.actions ?? [])]
                  .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
                  .map((a) => {
                    const isTeamA = a.player && event.teamA?.players?.some((p) => p.id === a.playerId);
                    return (
                      <TableRow key={a.id} style={{ borderColor: 'var(--border-custom)' }}>
                        <TableCell>
                          <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                            {a.minute ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ borderColor: 'var(--border-custom)', color: 'var(--text-muted)' }}
                          >
                            {a.half ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs font-medium"
                            style={{ color: isTeamA ? 'var(--accent)' : 'var(--accent-yellow, var(--accent))' }}
                          >
                            {isTeamA ? teamAName : teamBName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {a.player?.name ?? '—'}
                            {a.player?.number != null && (
                              <span style={{ color: 'var(--text-muted)' }}> (#{a.player.number})</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            {a.actionIcon && <span>{a.actionIcon}</span>}
                            {a.actionLabel ?? a.actionType}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>
                            {a.value ?? 1}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Comments ── */}
      {(event.comments?.length ?? 0) > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
        >
          <div className="px-4 py-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Comentarios en Vivo ({event.comments?.length})
            </p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2 max-h-96 overflow-y-auto">
            {[...(event.comments ?? [])]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2"
                >
                  <span
                    className="text-[10px] font-mono shrink-0 pt-0.5 min-w-[45px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {new Date(c.createdAt).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {c.isAI && (
                    <Badge
                      variant="outline"
                      className="text-[9px] shrink-0 mt-0.5"
                      style={{ borderColor: '#6366f140', color: '#6366f1' }}
                    >
                      IA
                    </Badge>
                  )}
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {c.content}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}