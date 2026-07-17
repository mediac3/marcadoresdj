'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  Calendar,
  MapPin,
  Image as ImageIcon,
  Upload,
  Layers,
  Eye,
  EyeOff,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Sport {
  id: string;
  name: string;
  icon: string;
}

interface Tournament {
  id: string;
  name: string;
  sportId: string;
  sport: Sport;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  logo: string | null;
  description: string | null;
  isActive: boolean;
  createdById: string;
  createdBy: { id: string; username: string; name: string | null };
  _count: { phases: number };
  createdAt: string;
}

interface TournamentFull extends Tournament {
  phases: TournamentPhase[];
}

interface TournamentPhase {
  id: string;
  tournamentId: string;
  name: string;
  type: string;
  order: number;
  isActive: boolean;
  _count: { events: number };
  createdAt: string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const PHASE_TYPES = [
  { value: 'ELIMINATORIA', label: 'Eliminatoria' },
  { value: 'GRUPOS', label: 'Fase de Grupos' },
  { value: 'OCTAVOS', label: 'Octavos de Final' },
  { value: 'CUARTOS', label: 'Cuartos de Final' },
  { value: 'SEMIFINAL', label: 'Semifinal' },
  { value: 'FINAL', label: 'Final' },
  { value: 'TERCER_PUESTO', label: 'Tercer Puesto' },
] as const;

const PHASE_TYPE_COLORS: Record<string, string> = {
  ELIMINATORIA: '#ef4444',
  GRUPOS: '#3b82f6',
  OCTAVOS: '#8b5cf6',
  CUARTOS: '#f59e0b',
  SEMIFINAL: '#06b6d4',
  FINAL: '#22c55e',
  TERCER_PUESTO: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#f59e0b',
  LIVE: '#22c55e',
  PAUSED: '#f97316',
  FINISHED: '#6b7280',
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function TournamentsPanel() {
  /* ── State ── */
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentFull | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<TournamentFull | null>(null);

  /* ── Form state ── */
  const [formName, setFormName] = useState('');
  const [formSportId, setFormSportId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Phase form state ── */
  const [phaseName, setPhaseName] = useState('');
  const [phaseType, setPhaseType] = useState('GRUPOS');
  const [addingPhase, setAddingPhase] = useState(false);
  const [editingPhase, setEditingPhase] = useState<TournamentPhase | null>(null);

  /* ── Upload ── */
  const [uploading, setUploading] = useState(false);
  const fileInputRef = { current: null as HTMLInputElement | null };

  /* ── Fetch data ── */
  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/tournaments?all=true');
      if (res.success) setTournaments(res.tournaments || []);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  const fetchSports = useCallback(async () => {
    try {
      const res = await apiGet('/api/sports');
      if (res.success) setSports(res.sports || []);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchTournaments();
    fetchSports();
  }, [fetchTournaments, fetchSports]);

  /* ── Reset form ── */
  const resetForm = () => {
    setFormName('');
    setFormSportId('');
    setFormStartDate('');
    setFormEndDate('');
    setFormLocation('');
    setFormLogo('');
    setFormDescription('');
    setFormIsActive(true);
  };

  /* ── Open create ── */
  const openCreate = () => {
    resetForm();
    setShowCreateForm(true);
    setEditingTournament(null);
  };

  /* ── Open edit ── */
  const openEdit = (t: Tournament) => {
    setFormName(t.name);
    setFormSportId(t.sportId);
    setFormStartDate(t.startDate || '');
    setFormEndDate(t.endDate || '');
    setFormLocation(t.location || '');
    setFormLogo(t.logo || '');
    setFormDescription(t.description || '');
    setFormIsActive(t.isActive);
    setShowCreateForm(true);
    setEditingTournament(t as TournamentFull);
  };

  /* ── Save tournament ── */
  const handleSave = async () => {
    if (!formName.trim() || !formSportId) return;
    try {
      setSaving(true);
      const body = {
        name: formName.trim(),
        sportId: formSportId,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        location: formLocation.trim() || null,
        logo: formLogo || null,
        description: formDescription.trim() || null,
        isActive: formIsActive,
      };

      if (editingTournament) {
        await apiPut(`/api/tournaments/${editingTournament.id}`, body);
      } else {
        await apiPost('/api/tournaments', body);
      }
      setShowCreateForm(false);
      resetForm();
      fetchTournaments();
      if (selectedTournament) {
        const updated = await apiGet(`/api/tournaments/${selectedTournament.id}`);
        if (updated.success) setSelectedTournament(updated.tournament);
      }
    } catch { /* */ } finally {
      setSaving(false);
    }
  };

  /* ── Delete tournament ── */
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este torneo? Las fases se eliminarán pero los eventos se conservarán.')) return;
    try {
      await apiDelete(`/api/tournaments/${id}`);
      if (selectedTournament?.id === id) setSelectedTournament(null);
      fetchTournaments();
    } catch { /* */ }
  };

  /* ── Toggle active ── */
  const handleToggleActive = async (t: Tournament) => {
    try {
      await apiPut(`/api/tournaments/${t.id}`, { isActive: !t.isActive });
      fetchTournaments();
    } catch { /* */ }
  };

  /* ── Select tournament ── */
  const handleSelectTournament = async (t: Tournament) => {
    try {
      const res = await apiGet(`/api/tournaments/${t.id}`);
      if (res.success) {
        setSelectedTournament(res.tournament);
      }
    } catch { /* */ }
  };

  /* ── Back to list ── */
  const handleBack = () => {
    setSelectedTournament(null);
  };

  /* ── Add phase ── */
  const handleAddPhase = async () => {
    if (!selectedTournament || !phaseName.trim()) return;
    try {
      setAddingPhase(true);
      await apiPost(`/api/tournaments/${selectedTournament.id}/phases`, {
        name: phaseName.trim(),
        type: phaseType,
      });
      setPhaseName('');
      setPhaseType('GRUPOS');
      // Refresh
      const res = await apiGet(`/api/tournaments/${selectedTournament.id}`);
      if (res.success) setSelectedTournament(res.tournament);
    } catch { /* */ } finally {
      setAddingPhase(false);
    }
  };

  /* ── Delete phase ── */
  const handleDeletePhase = async (phaseId: string) => {
    if (!confirm('¿Eliminar esta fase? Los eventos de esta fase perderán la asociación.')) return;
    try {
      await apiDelete(`/api/tournaments/phases/${phaseId}`);
      if (selectedTournament) {
        const res = await apiGet(`/api/tournaments/${selectedTournament.id}`);
        if (res.success) setSelectedTournament(res.tournament);
      }
    } catch { /* */ }
  };

  /* ── Toggle phase active ── */
  const handleTogglePhaseActive = async (phase: TournamentPhase) => {
    try {
      await apiPut(`/api/tournaments/phases/${phase.id}`, { isActive: !phase.isActive });
      if (selectedTournament) {
        const res = await apiGet(`/api/tournaments/${selectedTournament.id}`);
        if (res.success) setSelectedTournament(res.tournament);
      }
    } catch { /* */ }
  };

  /* ── Upload logo ── */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('marcadoresdj-token')}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setFormLogo(data.url);
      }
    } catch { /* */ } finally {
      setUploading(false);
    }
  };

  /* ── Move phase order ── */
  const handleMovePhase = async (phase: TournamentPhase, direction: 'up' | 'down') => {
    if (!selectedTournament) return;
    const phases = [...selectedTournament.phases];
    const idx = phases.findIndex((p) => p.id === phase.id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= phases.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = phases[swapIdx].order;
    const oldOrder = phase.order;

    try {
      await apiPut(`/api/tournaments/phases/${phase.id}`, { order: newOrder });
      await apiPut(`/api/tournaments/phases/${phases[swapIdx].id}`, { order: oldOrder });
      const res = await apiGet(`/api/tournaments/${selectedTournament.id}`);
      if (res.success) setSelectedTournament(res.tournament);
    } catch { /* */ }
  };

  /* ── Edit phase inline ── */
  const startEditPhase = (phase: TournamentPhase) => {
    setEditingPhase(phase);
    setPhaseName(phase.name);
    setPhaseType(phase.type);
  };

  const cancelEditPhase = () => {
    setEditingPhase(null);
    setPhaseName('');
    setPhaseType('GRUPOS');
  };

  const handleSavePhase = async () => {
    if (!editingPhase || !phaseName.trim()) return;
    try {
      await apiPut(`/api/tournaments/phases/${editingPhase.id}`, {
        name: phaseName.trim(),
        type: phaseType,
      });
      setEditingPhase(null);
      setPhaseName('');
      if (selectedTournament) {
        const res = await apiGet(`/api/tournaments/${selectedTournament.id}`);
        if (res.success) setSelectedTournament(res.tournament);
      }
    } catch { /* */ }
  };

  /* ── Helper ── */
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO'); } catch { return d; }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */

  // ── DETAIL VIEW ──
  if (selectedTournament) {
    return (
      <div className="space-y-4 p-4 max-w-4xl mx-auto">
        {/* Back button + header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="size-8">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {selectedTournament.logo && (
                <img src={selectedTournament.logo} alt="" className="size-8 rounded object-contain" />
              )}
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedTournament.name}
              </h1>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0"
                style={{ borderColor: selectedTournament.isActive ? '#22c55e' : '#6b7280', color: selectedTournament.isActive ? '#22c55e' : '#6b7280' }}>
                {selectedTournament.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1">{selectedTournament.sport.icon} {selectedTournament.sport.name}</span>
              {selectedTournament.startDate && (
                <span className="flex items-center gap-1"><Calendar className="size-3" /> {formatDate(selectedTournament.startDate)} - {formatDate(selectedTournament.endDate)}</span>
              )}
              {selectedTournament.location && (
                <span className="flex items-center gap-1"><MapPin className="size-3" /> {selectedTournament.location}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(selectedTournament)} title="Editar torneo">
            <Pencil className="size-4" />
          </Button>
        </div>

        {selectedTournament.description && (
          <p className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>
            {selectedTournament.description}
          </p>
        )}

        {/* Phases section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Layers className="size-4" />
              Fases del Torneo
              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ color: 'var(--text-muted)' }}>
                {selectedTournament.phases.length}
              </Badge>
            </h2>
          </div>

          {/* Add phase form */}
          {!editingPhase && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  placeholder="Nombre de la fase (ej: Grupo A, Semifinal 1...)"
                  className="flex-1 rounded-md px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
                />
                <select
                  value={phaseType}
                  onChange={(e) => setPhaseType(e.target.value)}
                  className="rounded-md px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
                >
                  {PHASE_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
                <Button
                  onClick={editingPhase ? handleSavePhase : handleAddPhase}
                  disabled={!phaseName.trim() || (editingPhase ? false : addingPhase)}
                  className="flex items-center gap-2 shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Plus className="size-4" />
                  {addingPhase ? 'Agregando...' : 'Agregar Fase'}
                </Button>
              </div>
            </div>
          )}

          {/* Phases list */}
          {selectedTournament.phases.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <Layers className="size-8 mx-auto mb-2" />
              <p className="text-sm">No hay fases creadas</p>
              <p className="text-xs">Agrega fases para organizar los eventos del torneo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTournament.phases.map((phase, idx) => (
                <div
                  key={phase.id}
                  className="rounded-lg px-4 py-3 flex items-center gap-3 group"
                  style={{
                    background: phase.isActive ? 'var(--bg-card)' : 'var(--bg-primary)',
                    border: `1px solid ${phase.isActive ? PHASE_TYPE_COLORS[phase.type] || 'var(--border-custom)' : 'var(--border-custom)'}`,
                    opacity: phase.isActive ? 1 : 0.5,
                  }}
                >
                  {/* Order badge + arrows */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMovePhase(phase, 'up')}
                      disabled={idx === 0}
                      className="text-xs disabled:opacity-20 hover:opacity-80"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ▲
                    </button>
                    <span
                      className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: PHASE_TYPE_COLORS[phase.type] || 'var(--accent)', color: '#fff' }}
                    >
                      {phase.order + 1}
                    </span>
                    <button
                      onClick={() => handleMovePhase(phase, 'down')}
                      disabled={idx === selectedTournament.phases.length - 1}
                      className="text-xs disabled:opacity-20 hover:opacity-80"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Phase info */}
                  <div className="flex-1 min-w-0">
                    {editingPhase?.id === phase.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={phaseName}
                          onChange={(e) => setPhaseName(e.target.value)}
                          className="flex-1 rounded-md px-2 py-1 text-sm"
                          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSavePhase(); if (e.key === 'Escape') cancelEditPhase(); }}
                        />
                        <select
                          value={phaseType}
                          onChange={(e) => setPhaseType(e.target.value)}
                          className="rounded-md px-2 py-1 text-sm"
                          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                        >
                          {PHASE_TYPES.map((pt) => (
                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                          ))}
                        </select>
                        <Button size="sm" onClick={handleSavePhase} style={{ background: '#22c55e', color: '#fff' }}>
                          <Save className="size-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditPhase}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {phase.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                            style={{ borderColor: PHASE_TYPE_COLORS[phase.type] || '#666', color: PHASE_TYPE_COLORS[phase.type] || '#666' }}
                          >
                            {PHASE_TYPES.find((t) => t.value === phase.type)?.label || phase.type}
                          </Badge>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {phase._count.events} evento{phase._count.events !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingPhase?.id !== phase.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditPhase(phase)}
                        className="p-1.5 rounded hover:bg-blue-500/20"
                        title="Editar fase"
                      >
                        <Pencil className="size-3.5" style={{ color: 'var(--text-muted)' }} />
                      </button>
                      <button
                        onClick={() => handleTogglePhaseActive(phase)}
                        className="p-1.5 rounded hover:bg-yellow-500/20"
                        title={phase.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {phase.isActive
                          ? <Eye className="size-3.5 text-green-400" />
                          : <EyeOff className="size-3.5" style={{ color: 'var(--text-muted)' }} />}
                      </button>
                      <button
                        onClick={() => handleDeletePhase(phase.id)}
                        className="p-1.5 rounded hover:bg-red-500/20"
                        title="Eliminar fase"
                      >
                        <Trash2 className="size-3.5 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg" style={{ background: 'var(--accent)' }}>
            <Trophy className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Torneos</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Gestiona torneos y sus fases de competición
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="flex items-center gap-2"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo Torneo</span>
        </Button>
      </div>

      {/* Create/Edit Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full max-w-lg rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingTournament ? 'Editar Torneo' : 'Nuevo Torneo'}
              </h2>
              <button onClick={() => { setShowCreateForm(false); resetForm(); }} className="p-1">
                <X className="size-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Copa DJ 2026"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
              />
            </div>

            {/* Sport */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Deporte *</label>
              <select
                value={formSportId}
                onChange={(e) => setFormSportId(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
              >
                <option value="">Seleccionar deporte...</option>
                {sports.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                ))}
              </select>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha inicio</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha fin</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ubicación</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Ej: Estadio Municipal, Cali"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
              />
            </div>

            {/* Logo */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Logo URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formLogo}
                  onChange={(e) => setFormLogo(e.target.value)}
                  placeholder="https://... o subir desde PC"
                  className="flex-1 rounded-md px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0"
                  style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                >
                  <Upload className="size-4" />
                </Button>
              </div>
              {formLogo && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={formLogo} alt="Preview" className="size-10 rounded object-contain" style={{ background: 'var(--bg-primary)' }} />
                  <button onClick={() => setFormLogo('')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <X className="size-3 inline" /> Quitar
                  </button>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Descripción</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descripción del torneo..."
                rows={3}
                className="w-full rounded-md px-3 py-2 text-sm resize-none"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-custom)' }}
              />
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Torneo activo</span>
            </label>

            {/* Save */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowCreateForm(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formName.trim() || !formSportId || saving}
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Save className="size-4 mr-1" />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament list */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Cargando torneos...</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <Trophy className="size-12 mx-auto mb-3" />
          <p className="text-sm font-medium">No hay torneos creados</p>
          <p className="text-xs mt-1">Crea tu primer torneo para organizar fases y eventos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="rounded-lg p-4 cursor-pointer transition-colors group"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${t.isActive ? 'var(--border-custom)' : 'transparent'}`,
                opacity: t.isActive ? 1 : 0.5,
              }}
              onClick={() => handleSelectTournament(t)}
            >
              <div className="flex items-start gap-3">
                {t.logo ? (
                  <img src={t.logo} alt="" className="size-10 rounded object-contain shrink-0" />
                ) : (
                  <div
                    className="size-10 rounded flex items-center justify-center shrink-0 text-lg"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    {t.sport.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {t.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 shrink-0"
                      style={{ borderColor: t.isActive ? '#22c55e' : '#6b7280', color: t.isActive ? '#22c55e' : '#6b7280' }}
                    >
                      {t.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{t.sport.icon} {t.sport.name}</span>
                    <span>·</span>
                    <span>{t._count.phases} fase{t._count.phases !== 1 ? 's' : ''}</span>
                  </div>
                  {(t.startDate || t.location) && (
                    <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.startDate && <span className="flex items-center gap-1"><Calendar className="size-3" /> {formatDate(t.startDate)}</span>}
                      {t.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {t.location}</span>}
                    </div>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
              </div>
              {/* Hover actions */}
              <div
                className="flex items-center gap-1 mt-3 pt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ borderTop: '1px solid var(--border-custom)' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                >
                  <Pencil className="size-3 mr-1" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(t); }}
                >
                  {t.isActive ? <><EyeOff className="size-3 mr-1" /> Desactivar</> : <><Eye className="size-3 mr-1" /> Activar</>}
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-red-400 hover:bg-red-500/20"
                  onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                >
                  <Trash2 className="size-3 mr-1" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}