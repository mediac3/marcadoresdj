'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calendar,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal as SlidersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, type CardPayment } from '@/lib/store';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface PlayerActionRow {
  id: string;
  eventId: string;
  playerId: string | null;
  player: {
    id: string;
    name: string;
    number: number;
    nickname: string | null;
    teamId: string;
    team: { id: string; name: string } | null;
  } | null;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionColor: string;
  minute: number | null;
  value: number;
  half: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string | null;
    sportId: string;
    status: string;
    scheduledAt: string | null;
    teamA: { id: string; name: string } | null;
    teamB: { id: string; name: string } | null;
  } | null;
  cardPayment: CardPayment | null;
}

interface SportWithActions {
  id: string;
  name: string;
  icon: string;
  actions: {
    id: string;
    name: string;
    label: string;
    icon: string;
    color: string;
    isCard: boolean;
    cardAmount: number;
  }[];
}

interface FilterOptions {
  sports: SportWithActions[];
  events: {
    id: string;
    name: string | null;
    sportId: string;
    scheduledAt: string | null;
    teamA: { name: string } | null;
    teamB: { name: string } | null;
  }[];
  teams: { id: string; name: string; sportId: string }[];
  actionTypes: { actionType: string; actionLabel: string; actionIcon: string }[];
}

type PaymentStatusFilter = 'ALL' | 'CARDS_ONLY' | 'PENDING' | 'PAID';

interface PlayerSummary {
  playerId: string;
  playerName: string;
  playerNumber: number;
  teamName: string;
  totalActions: number;
  cards: number;
  pendingAmount: number;
  paidAmount: number;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTimeShort(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventLabel(row: PlayerActionRow): string {
  const e = row.event;
  if (!e) return '—';
  const base = e.name || [e.teamA?.name, e.teamB?.name].filter(Boolean).join(' vs ');
  return base || 'Evento';
}

function playerTeamName(row: PlayerActionRow): string {
  return row.player?.team?.name ?? '—';
}

function buildSummary(rows: PlayerActionRow[]): PlayerSummary[] {
  const map = new Map<string, PlayerSummary>();
  for (const row of rows) {
    if (!row.player) continue;
    let s = map.get(row.player.id);
    if (!s) {
      s = {
        playerId: row.player.id,
        playerName: row.player.name,
        playerNumber: row.player.number,
        teamName: playerTeamName(row),
        totalActions: 0,
        cards: 0,
        pendingAmount: 0,
        paidAmount: 0,
      };
      map.set(row.player.id, s);
    }
    s.totalActions += 1;
    if (row.cardPayment) {
      s.cards += 1;
      if (row.cardPayment.status === 'PAID') s.paidAmount += row.cardPayment.amount;
      else s.pendingAmount += row.cardPayment.amount;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.pendingAmount - a.pendingAmount || a.playerNumber - b.playerNumber,
  );
}

/* ── Excel Export ─────────────────────────────────────────────────────────── */

async function exportToExcel(
  rows: PlayerActionRow[],
  summary: PlayerSummary[],
  filterDescription: string[],
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Acciones (detalle) ──
  const header: (string | number)[][] = [
    ['ACCIONES DE JUGADORES — MarcadoresDJ'],
    ['Generado', new Date().toLocaleString('es-CO')],
    ...(filterDescription.length > 0 ? [['Filtros', filterDescription.join(' · ')]] : []),
    [],
    ['Fecha', 'Evento', 'Equipo', 'N.', 'Jugador', 'Accion', 'Minuto', 'Tarjeta', 'Monto', 'Estado Pago', 'Fecha Pago', 'Nota'],
  ];
  const detail: (string | number)[][] = rows.map((r) => [
    formatDateTimeShort(r.createdAt),
    eventLabel(r),
    playerTeamName(r),
    r.player?.number ?? '—',
    r.player?.name ?? '—',
    r.actionLabel || r.actionType,
    r.minute ?? '—',
    r.cardPayment ? 'Sí' : '—',
    r.cardPayment ? r.cardPayment.amount : '—',
    r.cardPayment ? (r.cardPayment.status === 'PAID' ? 'Pagado' : 'Pendiente') : '—',
    r.cardPayment?.paidAt ? formatDate(r.cardPayment.paidAt) : '—',
    r.cardPayment?.note ?? '',
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([...header, ...detail]);
  ws1['!cols'] = [
    { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 5 }, { wch: 25 },
    { wch: 16 }, { wch: 7 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Acciones');

  // ── Sheet 2: Resumen por jugador ──
  const pendingTotal = summary.reduce((acc, s) => acc + s.pendingAmount, 0);
  const paidTotal = summary.reduce((acc, s) => acc + s.paidAmount, 0);
  const summaryHeader: (string | number)[][] = [
    ['RESUMEN POR JUGADOR — Pagos de Tarjetas'],
    [],
    ['N.', 'Jugador', 'Equipo', 'Acciones', 'Tarjetas', 'Pendiente', 'Pagado', 'Total'],
  ];
  const summaryRows: (string | number)[][] = summary.map((s) => [
    s.playerNumber,
    s.playerName,
    s.teamName,
    s.totalActions,
    s.cards,
    s.pendingAmount,
    s.paidAmount,
    s.pendingAmount + s.paidAmount,
  ]);
  summaryRows.push([
    '', 'TOTAL', '', rows.length, summary.reduce((acc, s) => acc + s.cards, 0),
    pendingTotal, paidTotal, pendingTotal + paidTotal,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryRows]);
  ws2['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 9 }, { wch: 9 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Jugador');

  const fileName = `acciones_pagos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/* ── PDF Export ───────────────────────────────────────────────────────────── */

async function exportToPDF(
  rows: PlayerActionRow[],
  summary: PlayerSummary[],
  filterDescription: string[],
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Header ──
  doc.setFontSize(10);
  doc.setTextColor(130);
  doc.text('MarcadoresDJ - Acciones de Jugadores y Pagos de Tarjetas', 14, 12);

  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text('Acciones y Pagos', 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 28);
  if (filterDescription.length > 0) {
    doc.text(`Filtros: ${filterDescription.join(' · ')}`, 14, 33);
  }

  const pendingTotal = summary.reduce((acc, s) => acc + s.pendingAmount, 0);
  const paidTotal = summary.reduce((acc, s) => acc + s.paidAmount, 0);

  // Totals box (top-right)
  doc.setFillColor(30, 30, 30);
  doc.roundedRect(pageW - 92, 10, 80, 24, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.text(`Acciones: ${rows.length}   Tarjetas: ${summary.reduce((a, s) => a + s.cards, 0)}`, pageW - 52, 17, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Por cobrar: ${formatCOP(pendingTotal)}`, pageW - 52, 23.5, { align: 'center' });
  doc.text(`Recaudado: ${formatCOP(paidTotal)}`, pageW - 52, 30, { align: 'center' });

  // ── Detail table ──
  autoTable(doc, {
    startY: 38,
    head: [['Fecha', 'Evento', 'Equipo', 'N.', 'Jugador', 'Acción', 'Min', 'Tarjeta', 'Monto', 'Estado']],
    body: rows.map((r) => [
      formatDate(r.createdAt),
      eventLabel(r),
      playerTeamName(r),
      String(r.player?.number ?? '—'),
      r.player?.name ?? '—',
      `${r.actionIcon ?? ''} ${r.actionLabel || r.actionType}`.trim(),
      r.minute != null ? String(r.minute) : '—',
      r.cardPayment ? 'Sí' : '—',
      r.cardPayment ? formatCOP(r.cardPayment.amount) : '—',
      r.cardPayment ? (r.cardPayment.status === 'PAID' ? 'Pagado' : 'Pendiente') : '—',
    ]),
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 7.5 },
    margin: { left: 14, right: 14 },
  });

  // ── Summary table per player ──
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (y + 30 > pageH) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Resumen por Jugador', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['N.', 'Jugador', 'Equipo', 'Acciones', 'Tarjetas', 'Pendiente', 'Pagado', 'Total']],
    body: [
      ...summary.map((s) => [
        String(s.playerNumber),
        s.playerName,
        s.teamName,
        String(s.totalActions),
        String(s.cards),
        formatCOP(s.pendingAmount),
        formatCOP(s.paidAmount),
        formatCOP(s.pendingAmount + s.paidAmount),
      ]),
      ['', 'TOTAL', '', String(rows.length), String(summary.reduce((a, s) => a + s.cards, 0)), formatCOP(pendingTotal), formatCOP(paidTotal), formatCOP(pendingTotal + paidTotal)],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text('MarcadoresDJ · Acciones y Pagos', pageW / 2, pageH - 8, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
  }

  doc.save(`acciones_pagos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function PlayerActionsView() {
  const user = useAppStore((s) => s.user);
  const { toast } = useToast();

  // ── Filters ──
  const [sportId, setSportId] = useState('ALL');
  const [eventId, setEventId] = useState('ALL');
  const [teamId, setTeamId] = useState('ALL');
  const [actionType, setActionType] = useState('ALL');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Data ──
  const [rows, setRows] = useState<PlayerActionRow[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [tab, setTab] = useState<'detail' | 'summary'>('detail');

  // ── Permissions (client-side UX only; API enforces real access) ──
  const [canEdit, setCanEdit] = useState(false);

  // ── Payment dialog ──
  const [paymentRow, setPaymentRow] = useState<PlayerActionRow | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // ── Tariffs dialog ──
  const [tariffsOpen, setTariffsOpen] = useState(false);
  const [tariffSportId, setTariffSportId] = useState<string>('');
  const [tariffDraft, setTariffDraft] = useState<Record<string, { isCard: boolean; cardAmount: number }>>({});
  const [savingTariffs, setSavingTariffs] = useState(false);

  const syncedRef = useRef(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load permissions for UX (ADMIN → always edit)
  useEffect(() => {
    if (!user) return;
    if (user.role === 'ADMIN') {
      setCanEdit(true);
      return;
    }
    fetch('/api/my-permissions', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('marcadoresdj-token') ?? ''}`,
      },
    })
      .then((r) => r.json())
      .then((data: { success: boolean; permissions: { section: string; canEdit: boolean }[] }) => {
        if (data.success && Array.isArray(data.permissions)) {
          setCanEdit(data.permissions.some((p) => p.section === 'payments' && p.canEdit));
        }
      })
      .catch(() => {});
  }, [user]);

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (sportId !== 'ALL') params.set('sportId', sportId);
    if (eventId !== 'ALL') params.set('eventId', eventId);
    if (teamId !== 'ALL') params.set('teamId', teamId);
    if (actionType !== 'ALL') params.set('actionType', actionType);
    if (paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (dateFrom) params.set('dateFrom', new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) params.set('dateTo', new Date(`${dateTo}T23:59:59`).toISOString());
    return params.toString();
  }, [sportId, eventId, teamId, actionType, paymentStatus, debouncedSearch, dateFrom, dateTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString ? `?${queryString}` : '';
      const data = await apiGet<{ success: boolean; actions: PlayerActionRow[]; filterOptions: FilterOptions }>(
        `/api/player-actions${qs}`,
      );
      setRows(data.actions);
      setFilterOptions(data.filterOptions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar acciones';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // One-time silent backfill so pre-existing cards get their pending payments
  useEffect(() => {
    if (syncedRef.current || !user) return;
    syncedRef.current = true;
    if (user.role !== 'ADMIN') {
      // Only sync when the user can edit payments (avoid 403 noise)
      fetch('/api/my-permissions', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('marcadoresdj-token') ?? ''}`,
        },
      })
        .then((r) => r.json())
        .then(async (data: { success: boolean; permissions: { section: string; canEdit: boolean }[] }) => {
          const canSync =
            user.role === 'ADMIN' ||
            (data.success && data.permissions?.some((p) => p.section === 'payments' && p.canEdit));
          if (!canSync) return;
          await apiPost('/api/player-actions/sync');
        })
        .catch(() => {});
    } else {
      apiPost('/api/player-actions/sync').catch(() => {});
    }
  }, [user]);

  // ── Derived data ──
  const summary = useMemo(() => buildSummary(rows), [rows]);
  const totals = useMemo(() => {
    const cards = rows.filter((r) => r.cardPayment).length;
    const pending = rows.reduce((acc, r) => acc + (r.cardPayment?.status === 'PENDING' ? r.cardPayment.amount : 0), 0);
    const paid = rows.reduce((acc, r) => acc + (r.cardPayment?.status === 'PAID' ? r.cardPayment.amount : 0), 0);
    return { actions: rows.length, cards, pending, paid };
  }, [rows]);

  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (sportId !== 'ALL') parts.push(`Deporte: ${filterOptions?.sports.find((s) => s.id === sportId)?.name ?? ''}`);
    if (eventId !== 'ALL') parts.push(`Evento: ${filterOptions?.events.find((e) => e.id === eventId)?.name ?? ''}`);
    if (teamId !== 'ALL') parts.push(`Equipo: ${filterOptions?.teams.find((t) => t.id === teamId)?.name ?? ''}`);
    if (actionType !== 'ALL') parts.push(`Acción: ${filterOptions?.actionTypes.find((a) => a.actionType === actionType)?.actionLabel ?? ''}`);
    if (paymentStatus !== 'ALL') {
      const label = { CARDS_ONLY: 'Solo tarjetas', PENDING: 'Pago pendiente', PAID: 'Pagadas' }[paymentStatus];
      if (label) parts.push(`Estado: ${label}`);
    }
    if (debouncedSearch.trim()) parts.push(`Búsqueda: "${debouncedSearch.trim()}"`);
    if (dateFrom) parts.push(`Desde: ${dateFrom}`);
    if (dateTo) parts.push(`Hasta: ${dateTo}`);
    return parts;
  }, [sportId, eventId, teamId, actionType, paymentStatus, debouncedSearch, dateFrom, dateTo, filterOptions]);

  const hasActiveFilters = queryString.length > 0;

  function clearFilters() {
    setSportId('ALL');
    setEventId('ALL');
    setTeamId('ALL');
    setActionType('ALL');
    setPaymentStatus('ALL');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

  // ── Export handlers ──
  async function handleExport(format: 'excel' | 'pdf') {
    if (rows.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay acciones para exportar con los filtros actuales.' });
      return;
    }
    setExporting(format);
    try {
      if (format === 'excel') await exportToExcel(rows, summary, filterDescription);
      else await exportToPDF(rows, summary, filterDescription);
    } catch (err) {
      console.error('Export failed', err);
      toast({ title: 'Error al exportar', description: 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  // ── Payment dialog handlers ──
  function openPaymentDialog(row: PlayerActionRow) {
    setPaymentRow(row);
    setPayAmount(String(row.cardPayment?.amount ?? 0));
    setPayNote(row.cardPayment?.note ?? '');
  }

  async function savePayment(status?: 'PAID' | 'PENDING') {
    if (!paymentRow?.cardPayment) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Monto inválido', description: 'Ingresa un monto mayor o igual a 0.', variant: 'destructive' });
      return;
    }
    setSavingPayment(true);
    try {
      await apiPut(`/api/card-payments/${paymentRow.cardPayment.id}`, {
        ...(status ? { status } : {}),
        amount,
        note: payNote.trim() || null,
      });
      toast({
        title: status === 'PAID' ? 'Pago registrado' : status === 'PENDING' ? 'Marcado como pendiente' : 'Pago actualizado',
        description: `${paymentRow.player?.name}: ${formatCOP(amount)}`,
      });
      setPaymentRow(null);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el pago';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSavingPayment(false);
    }
  }

  // ── Tariffs dialog handlers ──
  function openTariffs() {
    const first = filterOptions?.sports[0];
    if (!first) return;
    setTariffSportId(first.id);
    initTariffDraft(first);
    setTariffsOpen(true);
  }

  function initTariffDraft(sport: SportWithActions) {
    const draft: Record<string, { isCard: boolean; cardAmount: number }> = {};
    for (const a of sport.actions) {
      draft[a.id] = { isCard: a.isCard, cardAmount: a.cardAmount };
    }
    setTariffDraft(draft);
  }

  function changeTariffSport(sportIdSelected: string) {
    const sport = filterOptions?.sports.find((s) => s.id === sportIdSelected);
    if (!sport) return;
    setTariffSportId(sportIdSelected);
    initTariffDraft(sport);
  }

  async function saveTariffs() {
    const sport = filterOptions?.sports.find((s) => s.id === tariffSportId);
    if (!sport) return;
    setSavingTariffs(true);
    try {
      for (const a of sport.actions) {
        const draft = tariffDraft[a.id];
        if (!draft) continue;
        // Only save rows that changed
        if (draft.isCard === a.isCard && draft.cardAmount === a.cardAmount) continue;
        await apiPut(`/api/sports/${sport.id}/actions`, {
          actionId: a.id,
          isCard: draft.isCard,
          cardAmount: draft.cardAmount,
        });
      }
      toast({ title: 'Tarifas guardadas', description: `Tarjetas de ${sport.name} actualizadas.` });
      setTariffsOpen(false);
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar tarifas';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSavingTariffs(false);
    }
  }

  const tariffSport = filterOptions?.sports.find((s) => s.id === tariffSportId) ?? null;

  /* ── Shared row renderer bits ── */

  function paymentBadge(row: PlayerActionRow) {
    if (!row.cardPayment) return null;
    const paid = row.cardPayment.status === 'PAID';
    return (
      <Badge
        variant="outline"
        className="text-[10px] whitespace-nowrap"
        style={{
          borderColor: paid ? '#22c55e60' : '#eab30860',
          color: paid ? '#22c55e' : '#eab308',
        }}
      >
        {paid ? 'Pagado' : 'Pendiente'}
      </Badge>
    );
  }

  /* ── Render ── */

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <ClipboardList className="size-5" style={{ color: 'var(--accent)' }} />
            Acciones y Pagos
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Acciones de cada jugador · pagos de tarjetas
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-medium h-8"
              onClick={openTariffs}
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
            >
              <SlidersIcon className="size-3.5" />
              Tarifas
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-medium h-8"
            disabled={!!exporting}
            onClick={() => handleExport('excel')}
            style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
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

      {/* ── Filters ── */}
      <div
        className="rounded-xl border p-3 sm:p-4"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {/* Search */}
          <div className="relative col-span-2 md:col-span-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--text-muted)' }} />
            <Input
              placeholder="Buscar jugador o dorsal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-10"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Sport */}
          <Select value={sportId} onValueChange={setSportId}>
            <SelectTrigger
              className="h-10 w-full"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Deporte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los deportes</SelectItem>
              {filterOptions?.sports.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Event */}
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger
              className="h-10 w-full"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los eventos</SelectItem>
              {filterOptions?.events
                .filter((e) => sportId === 'ALL' || e.sportId === sportId)
                .map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name || `${e.teamA?.name ?? '?'} vs ${e.teamB?.name ?? '?'}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Team */}
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger
              className="h-10 w-full"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Equipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los equipos</SelectItem>
              {filterOptions?.teams
                .filter((t) => sportId === 'ALL' || t.sportId === sportId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Action type */}
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger
              className="h-10 w-full"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las acciones</SelectItem>
              {filterOptions?.actionTypes.map((a) => (
                <SelectItem key={a.actionType} value={a.actionType}>
                  {a.actionIcon} {a.actionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment status */}
          <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatusFilter)}>
            <SelectTrigger
              className="h-10 w-full"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            >
              <SelectValue placeholder="Estado pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="CARDS_ONLY">Solo tarjetas</SelectItem>
              <SelectItem value="PENDING">Pago pendiente</SelectItem>
              <SelectItem value="PAID">Tarjetas pagadas</SelectItem>
            </SelectContent>
          </Select>

          {/* Dates */}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
          />

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 text-xs w-full"
              disabled={!hasActiveFilters && !search}
              onClick={clearFilters}
              style={{ color: 'var(--text-muted)' }}
            >
              <RefreshCw className="size-3.5" />
              Limpiar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl border px-3 py-2.5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Acciones</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{totals.actions}</p>
        </div>
        <div className="rounded-xl border px-3 py-2.5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tarjetas</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{totals.cards}</p>
        </div>
        <div className="rounded-xl border px-3 py-2.5" style={{ background: 'var(--bg-card)', borderColor: '#eab30850' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Por cobrar</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#eab308' }}>{formatCOP(totals.pending)}</p>
        </div>
        <div className="rounded-xl border px-3 py-2.5" style={{ background: 'var(--bg-card)', borderColor: '#22c55e50' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Recaudado</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#22c55e' }}>{formatCOP(totals.paid)}</p>
        </div>
      </div>

      {/* ── Tabs: Detail / Summary ── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'detail' | 'summary')}>
        <TabsList className="w-fit" style={{ background: 'var(--bg-card)' }}>
          <TabsTrigger value="detail" style={{ color: 'var(--text-secondary)' }}>Detalle</TabsTrigger>
          <TabsTrigger value="summary" style={{ color: 'var(--text-secondary)' }}>Resumen por jugador</TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="mt-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div
              className="rounded-xl border p-10 text-center"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
            >
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sin acciones</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                No hay acciones que coincidan con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div
                className="rounded-xl border overflow-hidden hidden md:block"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
              >
                <div className="overflow-x-auto max-h-[65vh]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10" style={{ background: 'var(--bg-secondary)' }}>
                      <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Fecha</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Evento</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Equipo</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)', width: '45px' }}>N.</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Jugador</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Acción</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)', width: '55px' }}>Min</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)' }}>Tarjeta</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)', width: '110px' }}>Monto</TableHead>
                        <TableHead style={{ color: 'var(--text-muted)', width: '110px' }}>Estado</TableHead>
                        {canEdit && <TableHead style={{ color: 'var(--text-muted)', width: '90px' }} />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id} style={{ borderColor: 'var(--border-custom)' }}>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(r.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs max-w-[220px] truncate block" style={{ color: 'var(--text-secondary)' }}>
                              {eventLabel(r)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {playerTeamName(r)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
                              {r.player?.number ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {r.player?.name ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm">
                              {r.actionIcon && <span>{r.actionIcon}</span>}
                              <span style={{ color: 'var(--text-primary)' }}>{r.actionLabel || r.actionType}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                              {r.minute ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {r.cardPayment ? (
                              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                Sí
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                              {r.cardPayment ? formatCOP(r.cardPayment.amount) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>{paymentBadge(r)}</TableCell>
                          {canEdit && (
                            <TableCell>
                              {r.cardPayment && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2"
                                  onClick={() => openPaymentDialog(r)}
                                  style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                                >
                                  <CreditCard className="size-3" />
                                  Gestionar
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-2 md:hidden">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border p-3 flex flex-col gap-2"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-sm shrink-0" style={{ color: 'var(--accent)' }}>
                          #{r.player?.number ?? '—'}
                        </span>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {r.player?.name ?? '—'}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm shrink-0">
                        {r.actionIcon && <span>{r.actionIcon}</span>}
                        <span style={{ color: 'var(--text-primary)' }}>{r.actionLabel || r.actionType}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="truncate">{eventLabel(r)} · {playerTeamName(r)}</span>
                      <span className="shrink-0 flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.cardPayment && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t" style={{ borderColor: 'var(--border-custom)' }}>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {formatCOP(r.cardPayment.amount)}
                        </span>
                        <div className="flex items-center gap-2">
                          {paymentBadge(r)}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2"
                              onClick={() => openPaymentDialog(r)}
                              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                            >
                              Gestionar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : summary.length === 0 ? (
            <div
              className="rounded-xl border p-10 text-center"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
            >
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Sin datos</p>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader style={{ background: 'var(--bg-secondary)' }}>
                    <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                      <TableHead style={{ color: 'var(--text-muted)', width: '45px' }}>N.</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }}>Jugador</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }}>Equipo</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }} className="text-center">Acciones</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }} className="text-center">Tarjetas</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }} className="text-right">Pendiente</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }} className="text-right">Pagado</TableHead>
                      <TableHead style={{ color: 'var(--text-muted)' }} className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((s) => (
                      <TableRow key={s.playerId} style={{ borderColor: 'var(--border-custom)' }}>
                        <TableCell>
                          <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{s.playerNumber}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.playerName}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.teamName}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.totalActions}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.cards}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm tabular-nums font-medium" style={{ color: s.pendingAmount > 0 ? '#eab308' : 'var(--text-muted)' }}>
                            {formatCOP(s.pendingAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm tabular-nums font-medium" style={{ color: s.paidAmount > 0 ? '#22c55e' : 'var(--text-muted)' }}>
                            {formatCOP(s.paidAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm tabular-nums font-bold" style={{ color: 'var(--text-primary)' }}>
                            {formatCOP(s.pendingAmount + s.paidAmount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Payment Dialog ── */}
      <Dialog open={!!paymentRow} onOpenChange={(open) => !open && setPaymentRow(null)}>
        <DialogContent style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>Pago de tarjeta</DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              {paymentRow && (
                <>
                  {paymentRow.actionIcon} {paymentRow.actionLabel || paymentRow.actionType} —{' '}
                  <span className="font-medium">{paymentRow.player?.name}</span> (#{paymentRow.player?.number}) ·{' '}
                  {eventLabel(paymentRow)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-amount" style={{ color: 'var(--text-secondary)' }}>Monto (COP)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step={500}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-note" style={{ color: 'var(--text-secondary)' }}>Nota (opcional)</Label>
              <Textarea
                id="pay-note"
                placeholder="Ej. pagó en efectivo tras el partido"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                rows={2}
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              />
            </div>

            {paymentRow?.cardPayment?.status === 'PAID' && (
              <div
                className="rounded-lg border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--border-custom)', color: 'var(--text-muted)' }}
              >
                Pagado el {formatDate(paymentRow.cardPayment.paidAt)}
                {paymentRow.cardPayment.paidBy && (
                  <> · registrado por {paymentRow.cardPayment.paidBy.name || paymentRow.cardPayment.paidBy.username}</>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between">
            {paymentRow?.cardPayment?.status === 'PAID' ? (
              <Button
                variant="outline"
                disabled={savingPayment}
                onClick={() => savePayment('PENDING')}
                style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
              >
                Volver a pendiente
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={savingPayment}
                onClick={() => savePayment()}
                style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
              >
                {savingPayment ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar cambios
              </Button>
              <Button
                disabled={savingPayment}
                onClick={() => savePayment('PAID')}
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {savingPayment ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {paymentRow?.cardPayment?.status === 'PAID' ? 'Guardar y mantener pagado' : 'Marcar como pagado'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tariffs Dialog ── */}
      <Dialog open={tariffsOpen} onOpenChange={setTariffsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>Tarifas de tarjetas</DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              Define qué acciones son tarjetas pagables y el valor por cada una. Los cambios aplican a los pagos nuevos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Select value={tariffSportId} onValueChange={changeTariffSport}>
              <SelectTrigger
                className="h-10 w-full"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
              >
                <SelectValue placeholder="Deporte" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.sports.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-2">
              {tariffSport?.actions.map((a) => {
                const draft = tariffDraft[a.id] ?? { isCard: a.isCard, cardAmount: a.cardAmount };
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: 'var(--border-custom)' }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>{a.icon}</span>
                      <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
                    </div>
                    <Switch
                      checked={draft.isCard}
                      onCheckedChange={(checked) =>
                        setTariffDraft((prev) => ({ ...prev, [a.id]: { ...draft, isCard: checked } }))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      disabled={!draft.isCard}
                      value={draft.cardAmount}
                      onChange={(e) =>
                        setTariffDraft((prev) => ({
                          ...prev,
                          [a.id]: { ...draft, cardAmount: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-28 h-9 text-right tabular-nums"
                      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={savingTariffs}
              onClick={saveTariffs}
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {savingTariffs ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar tarifas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
