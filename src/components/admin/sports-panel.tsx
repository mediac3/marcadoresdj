'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShieldOff,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, type SportAction } from '@/lib/store';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SportRecord {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  actions: SportAction[];
  createdAt: string;
}

interface SportFormData {
  name: string;
  icon: string;
}

interface ActionFormData {
  name: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  defaultValue: number;
  mvpWeight: number;
}

const EMPTY_SPORT: SportFormData = { name: '', icon: '' };
const EMPTY_ACTION: ActionFormData = { name: '', label: '', icon: '', color: '#ffffff', sortOrder: 0, defaultValue: 1, mvpWeight: 0 };

/* ── Access Denied ─────────────────────────────────────────────────────────── */

function AccessDenied() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <ShieldOff className="size-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
          Acceso Denegado
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Solo los administradores pueden acceder a esta sección.
        </p>
      </div>
    </div>
  );
}

/* ── Sport Modal ───────────────────────────────────────────────────────────── */

function SportModal({
  editingSport,
  onSave,
  isSaving,
  onClose,
}: {
  editingSport: SportRecord | null;
  onSave: (data: SportFormData) => void;
  isSaving: boolean;
  onClose: () => void;
}) {
  const isEdit = !!editingSport;
  const [form, setForm] = useState<SportFormData>(
    editingSport ? { name: editingSport.name, icon: editingSport.icon } : { ...EMPTY_SPORT },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SportFormData, string>>>({});

  const handleChange = useCallback((field: keyof SportFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof SportFormData, string>> = {};
    if (!form.name.trim()) e.name = 'Nombre requerido';
    if (!form.icon.trim()) e.icon = 'Icono requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onSave(form);
  }, [validate, onSave, form]);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Editar Deporte' : 'Crear Deporte'}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            {isEdit ? `Editando: ${editingSport?.name}` : 'Agrega un nuevo deporte al sistema'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ej: Fútbol"
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.name ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Icono (emoji)</Label>
            <Input
              value={form.icon}
              onChange={(e) => handleChange('icon', e.target.value)}
              placeholder="⚽"
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.icon ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.icon && <p className="text-xs text-red-400">{errors.icon}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onClose()}
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isSaving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            {isEdit ? 'Guardar Cambios' : 'Crear Deporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Action Modal ──────────────────────────────────────────────────────────── */

function ActionModal({
  editingAction,
  sportName,
  onSave,
  isSaving,
  onClose,
}: {
  editingAction: SportAction | null;
  sportName: string;
  onSave: (data: ActionFormData) => void;
  isSaving: boolean;
  onClose: () => void;
}) {
  const isEdit = !!editingAction;
  const [form, setForm] = useState<ActionFormData>(
    editingAction
      ? {
          name: editingAction.name,
          label: editingAction.label,
          icon: editingAction.icon,
          color: editingAction.color,
          sortOrder: editingAction.sortOrder,
          defaultValue: editingAction.defaultValue ?? 1,
          mvpWeight: editingAction.mvpWeight ?? 0,
        }
      : { ...EMPTY_ACTION, sortOrder: 0, defaultValue: 1, mvpWeight: 0 },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ActionFormData, string>>>({});

  const handleChange = useCallback((field: keyof ActionFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof ActionFormData, string>> = {};
    if (!form.name.trim()) e.name = 'Nombre requerido';
    if (!form.label.trim()) e.label = 'Etiqueta requerida';
    if (!form.icon.trim()) e.icon = 'Icono requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onSave(form);
  }, [validate, onSave, form]);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Editar Acción' : 'Agregar Acción'}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Deporte: {sportName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Nombre (interno)</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ej: goal"
              disabled={isEdit}
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.name ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Etiqueta (visible)</Label>
            <Input
              value={form.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder="Ej: Gol"
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.label ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.label && <p className="text-xs text-red-400">{errors.label}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)' }}>Icono (emoji)</Label>
              <Input
                value={form.icon}
                onChange={(e) => handleChange('icon', e.target.value)}
                placeholder="⚽"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: errors.icon ? '#ef4444' : 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              {errors.icon && <p className="text-xs text-red-400">{errors.icon}</p>}
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)' }}>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="size-9 rounded border cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                />
                <Input
                  value={form.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Orden</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => handleChange('sortOrder', parseInt(e.target.value) || 0)}
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>
              Valor por clic <span style={{ color: 'var(--text-muted)' }}>(puntos)</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={form.defaultValue}
              onChange={(e) => handleChange('defaultValue', parseInt(e.target.value) || 0)}
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Cantidad de puntos que suma cada clic. Predeterminado: 1
            </p>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>
              Peso MVP <span style={{ color: 'var(--text-muted)' }}>(Jugador del Partido)</span>
            </Label>
            <Input
              type="number"
              min={-10}
              max={10}
              value={form.mvpWeight}
              onChange={(e) => handleChange('mvpWeight', parseInt(e.target.value) || 0)}
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Puntos que suma (+) o resta (-) al puntaje MVP del jugador. Base 10. Ej: Gol +2, Asistencia +1, Amarilla -1, Roja -3.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isSaving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            {isEdit ? 'Guardar Cambios' : 'Agregar Acción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sport Row with expandable actions ──────────────────────────────────────── */

function SportItem({
  sport,
  expanded,
  onToggle,
  onEditSport,
  onDeleteSport,
  onToggleActive,
  onAddAction,
  onEditAction,
  onDeleteAction,
  actionLoading,
}: {
  sport: SportRecord;
  expanded: boolean;
  onToggle: () => void;
  onEditSport: () => void;
  onDeleteSport: () => void;
  onToggleActive: () => void;
  onAddAction: () => void;
  onEditAction: (action: SportAction) => void;
  onDeleteAction: (action: SportAction) => void;
  actionLoading: string | null;
}) {
  return (
    <Card
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        opacity: sport.isActive ? 1 : 0.6,
      }}
      className="overflow-hidden"
    >
      {/* Sport header row */}
      <button
        className="flex items-center gap-3 w-full p-4 text-left transition-colors"
        onClick={onToggle}
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="text-xl shrink-0" aria-hidden="true">
          {sport.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{sport.name}</p>
            <Badge
              variant="outline"
              className="text-[10px] font-medium px-1.5 py-0 shrink-0"
              style={{
                borderColor: sport.isActive ? '#22c55e40' : '#ef444440',
                color: sport.isActive ? '#22c55e' : '#ef4444',
                background: sport.isActive ? '#22c55e15' : '#ef444415',
              }}
            >
              {sport.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sport.actions.length} accione{sport.actions.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onEditSport}
            title="Editar deporte"
          >
            <Pencil className="size-3.5" style={{ color: 'var(--text-secondary)' }} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggleActive}
            title={sport.isActive ? 'Desactivar' : 'Activar'}
          >
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0"
              style={{
                borderColor: sport.isActive ? '#f59e0b40' : '#22c55e40',
                color: sport.isActive ? '#f59e0b' : '#22c55e',
                background: 'transparent',
              }}
            >
              {sport.isActive ? 'OFF' : 'ON'}
            </Badge>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onDeleteSport}
            title="Eliminar deporte"
          >
            <Trash2 className="size-3.5 text-red-400" />
          </Button>
          {expanded ? (
            <ChevronDown className="size-4" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight className="size-4" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </button>

      {/* Expanded actions list */}
      {expanded && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Acciones
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] font-medium h-7 px-2"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onClick={onAddAction}
            >
              <Plus className="size-3 mr-1" />
              Agregar
            </Button>
          </div>

          {sport.actions.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Sin acciones configuradas
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sport.actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <GripVertical className="size-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-base shrink-0" aria-hidden="true">{action.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {action.label}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {action.name} · Orden: {action.sortOrder} · Valor: {action.defaultValue ?? 1} · MVP: {action.mvpWeight > 0 ? '+' : ''}{action.mvpWeight ?? 0}
                    </p>
                  </div>
                  {/* Color dot */}
                  <span
                    className="size-4 rounded-full shrink-0 border"
                    style={{ background: action.color, borderColor: 'var(--border)' }}
                    title={action.color}
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => onEditAction(action)}
                      title="Editar acción"
                      disabled={actionLoading === action.id}
                    >
                      <Pencil className="size-3" style={{ color: 'var(--text-secondary)' }} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => onDeleteAction(action)}
                      title="Eliminar acción"
                      disabled={actionLoading === action.id}
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Main Sports Panel ─────────────────────────────────────────────────────── */

export function SportsPanel() {
  const isAdmin = useAppStore((s) => s.isAdmin);

  const [sports, setSports] = useState<SportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Sport modal state
  const [sportModalOpen, setSportModalOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<SportRecord | null>(null);
  const [sportModalKey, setSportModalKey] = useState(0);
  const [sportSaving, setSportSaving] = useState(false);

  // Action modal state
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<SportAction | null>(null);
  const [actionSportId, setActionSportId] = useState<string | null>(null);
  const [actionModalKey, setActionModalKey] = useState(0);
  const [actionSaving, setActionSaving] = useState(false);

  const fetchSports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ success: boolean; sports: SportRecord[] }>(
        '/api/sports?all=true',
      );
      setSports(res.sports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar deportes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSports();
  }, [fetchSports]);

  // ── Sport CRUD ──────────────────────────────────────────────────────────

  const handleCreateSport = useCallback(() => {
    setEditingSport(null);
    setSportModalKey((k) => k + 1);
    setSportModalOpen(true);
  }, []);

  const handleEditSport = useCallback((sport: SportRecord) => {
    setEditingSport(sport);
    setSportModalKey((k) => k + 1);
    setSportModalOpen(true);
  }, []);

  const handleSaveSport = useCallback(
    async (data: SportFormData) => {
      setSportSaving(true);
      try {
        if (editingSport) {
          await apiPut<{ success: boolean }>(`/api/sports/${editingSport.id}`, data);
        } else {
          await apiPost<{ success: boolean }>('/api/sports', data);
        }
        setSportModalOpen(false);
        fetchSports();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar deporte');
      } finally {
        setSportSaving(false);
      }
    },
    [editingSport, fetchSports],
  );

  const handleDeleteSport = useCallback(
    async (sport: SportRecord) => {
      setActionLoading(sport.id);
      try {
        await apiDelete(`/api/sports/${sport.id}`);
        if (expandedId === sport.id) setExpandedId(null);
        fetchSports();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar deporte');
      } finally {
        setActionLoading(null);
      }
    },
    [expandedId, fetchSports],
  );

  const handleToggleSportActive = useCallback(
    async (sport: SportRecord) => {
      setActionLoading(sport.id);
      try {
        await apiPut(`/api/sports/${sport.id}`, { isActive: !sport.isActive });
        fetchSports();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cambiar estado');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchSports],
  );

  // ── Action CRUD ─────────────────────────────────────────────────────────

  const handleAddAction = useCallback((sportId: string) => {
    setEditingAction(null);
    setActionSportId(sportId);
    setActionModalKey((k) => k + 1);
    setActionModalOpen(true);
  }, []);

  const handleEditAction = useCallback((action: SportAction, sportId: string) => {
    setEditingAction(action);
    setActionSportId(sportId);
    setActionModalKey((k) => k + 1);
    setActionModalOpen(true);
  }, []);

  const handleSaveAction = useCallback(
    async (data: ActionFormData) => {
      if (!actionSportId) return;
      setActionSaving(true);
      try {
        if (editingAction) {
          await apiPut(`/api/sports/${actionSportId}/actions/${editingAction.id}`, data);
        } else {
          await apiPost(`/api/sports/${actionSportId}/actions`, data);
        }
        setActionModalOpen(false);
        fetchSports();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar acción');
      } finally {
        setActionSaving(false);
      }
    },
    [actionSportId, editingAction, fetchSports],
  );

  const handleDeleteAction = useCallback(
    async (action: SportAction, sportId: string) => {
      setActionLoading(action.id);
      try {
        await apiDelete(`/api/sports/${sportId}/actions/${action.id}`);
        fetchSports();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar acción');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchSports],
  );

  const currentSportName = actionSportId
    ? sports.find((s) => s.id === actionSportId)?.name ?? ''
    : '';

  if (!isAdmin()) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Gestión de Deportes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Configura deportes y sus acciones
          </p>
        </div>
        <Button
          size="sm"
          className="text-xs font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={handleCreateSport}
        >
          <Plus className="size-3.5 mr-1.5" />
          Crear Deporte
        </Button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <Card style={{ background: 'var(--bg-card)', borderColor: '#ef444440' }}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-5 text-red-400 shrink-0" />
            <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onClick={() => { setError(null); fetchSports(); }}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!loading && sports.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-3xl mb-3" aria-hidden="true">🏟️</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay deportes configurados
          </p>
        </div>
      )}

      {/* ── Sports List ──────────────────────────────────────────────────── */}
      {!loading && sports.length > 0 && (
        <div className="flex flex-col gap-3">
          {sports.map((sport) => (
            <SportItem
              key={sport.id}
              sport={sport}
              expanded={expandedId === sport.id}
              onToggle={() => setExpandedId((prev) => (prev === sport.id ? null : sport.id))}
              onEditSport={() => handleEditSport(sport)}
              onDeleteSport={() => handleDeleteSport(sport)}
              onToggleActive={() => handleToggleSportActive(sport)}
              onAddAction={() => handleAddAction(sport.id)}
              onEditAction={(action) => handleEditAction(action, sport.id)}
              onDeleteAction={(action) => handleDeleteAction(action, sport.id)}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* ── Sport Modal ──────────────────────────────────────────────────── */}
      {sportModalOpen && (
        <SportModal
          key={sportModalKey}
          editingSport={editingSport}
          onSave={handleSaveSport}
          isSaving={sportSaving}
          onClose={() => setSportModalOpen(false)}
        />
      )}

      {/* ── Action Modal ─────────────────────────────────────────────────── */}
      {actionModalOpen && (
        <ActionModal
          key={actionModalKey}
          editingAction={editingAction}
          sportName={currentSportName}
          onSave={handleSaveAction}
          isSaving={actionSaving}
          onClose={() => setActionModalOpen(false)}
        />
      )}
    </div>
  );
}