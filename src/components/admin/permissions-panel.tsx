'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Save,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  Users,
  AlertTriangle,
  Check,
  Trophy,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SectionDef {
  key: string;
  label: string;
}

interface PermissionRecord {
  id?: string;
  role: string;
  section: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface EventAccessEntry {
  id: string;
  userId: string;
  eventId: string;
  assignedBy: string;
  createdAt: string;
  user: { id: string; username: string; name: string | null; role: string };
  event: {
    id: string;
    name: string | null;
    status: string;
    teamA: { id: string; name: string; logo: string | null };
    teamB: { id: string; name: string; logo: string | null };
    sport?: { id: string; name: string; icon: string };
  };
}

interface UserOption {
  id: string;
  username: string;
  name: string | null;
  role: string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const SECTIONS: SectionDef[] = [
  { key: 'events', label: 'Eventos' },
  { key: 'teams', label: 'Equipos' },
  { key: 'sports', label: 'Deportes' },
  { key: 'locations', label: 'Ubicaciones' },
  { key: 'publications', label: 'Publicaciones' },
  { key: 'ads', label: 'Publicidad' },
  { key: 'analytics', label: 'Analíticas' },
];

const ROLES = ['CREATOR', 'INITIATOR'] as const;

const ROLE_LABELS: Record<string, string> = {
  CREATOR: 'Creador',
  INITIATOR: 'Iniciador',
  ADMIN: 'Administrador',
};

const PERMISSION_LABELS: Record<string, string> = {
  canView: 'Ver',
  canCreate: 'Crear',
  canEdit: 'Editar',
  canDelete: 'Eliminar',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#f59e0b',
  LIVE: '#22c55e',
  PAUSED: '#f97316',
  FINISHED: '#6b7280',
};

/* ── Component ─────────────────────────────────────────────────────────────── */

export function PermissionsPanel() {
  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<'sections' | 'event-access'>('sections');

  /* ── Section Permissions state ── */
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsChanged, setPermissionsChanged] = useState(false);

  /* ── Event Access state ── */
  const [eventAccess, setEventAccess] = useState<EventAccessEntry[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string | null; teamA: { name: string }; teamB: { name: string }; status: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch permissions ── */
  const fetchPermissions = useCallback(async () => {
    try {
      setLoadingPermissions(true);
      const res = await apiGet('/api/admin/permissions');
      if (res.success) {
        setPermissions(res.permissions || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  /* ── Fetch event access list ── */
  const fetchEventAccess = useCallback(async () => {
    try {
      setLoadingAccess(true);
      const res = await apiGet('/api/admin/event-access');
      if (res.success) {
        setEventAccess(res.access || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  /* ── Fetch users for dropdown ── */
  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiGet('/api/auth/users');
      if (res.success) {
        setUsers(res.users || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  /* ── Fetch events for dropdown ── */
  const fetchEvents = useCallback(async () => {
    try {
      const res = await apiGet('/api/events?limit=200');
      if (res.success) {
        setEvents(res.events || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    if (activeTab === 'event-access') {
      fetchEventAccess();
      fetchUsers();
      fetchEvents();
    }
  }, [activeTab, fetchEventAccess, fetchUsers, fetchEvents]);

  /* ── Toggle permission ── */
  const togglePermission = (role: string, section: string, field: keyof Pick<PermissionRecord, 'canView' | 'canCreate' | 'canEdit' | 'canDelete'>) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.role === role && p.section === section
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
    setPermissionsChanged(true);
  };

  /* ── Save permissions ── */
  const handleSavePermissions = async () => {
    try {
      setSavingPermissions(true);
      await apiPost('/api/admin/permissions', { permissions });
      setPermissionsChanged(false);
    } catch {
      // silently fail
    } finally {
      setSavingPermissions(false);
    }
  };

  /* ── Assign event access ── */
  const handleAssignEvent = async () => {
    if (!selectedUserId || !selectedEventId) return;
    try {
      setAssigning(true);
      await apiPost('/api/admin/event-access', {
        userId: selectedUserId,
        eventId: selectedEventId,
      });
      setSelectedUserId('');
      setSelectedEventId('');
      fetchEventAccess();
    } catch {
      // silently fail
    } finally {
      setAssigning(false);
    }
  };

  /* ── Remove event access ── */
  const handleRemoveAccess = async (id: string) => {
    try {
      setDeletingId(id);
      await apiDelete(`/api/admin/event-access/${id}`);
      fetchEventAccess();
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Ensure all cells exist ── */
  const getPerm = (role: string, section: string): PermissionRecord => {
    return (
      permissions.find((p) => p.role === role && p.section === section) || {
        role,
        section,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      }
    );
  };

  /* ── Helper: event display name ── */
  const eventDisplayName = (e: EventAccessEntry['event']) => {
    return e.name || `${e.teamA.name} vs ${e.teamB.name}`;
  };

  /* ── Render ── */
  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center size-10 rounded-lg"
          style={{ background: 'var(--accent)' }}
        >
          <Shield className="size-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Permisos
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Gestiona el acceso de roles a las secciones del sistema
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div
        className="flex rounded-lg p-1 gap-1"
        style={{ background: 'var(--bg-card)' }}
      >
        <button
          onClick={() => setActiveTab('sections')}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors flex-1"
          style={{
            background: activeTab === 'sections' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'sections' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Shield className="size-4" />
          Permisos por Sección
        </button>
        <button
          onClick={() => setActiveTab('event-access')}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors flex-1"
          style={{
            background: activeTab === 'event-access' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'event-access' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <Users className="size-4" />
          Acceso a Eventos
        </button>
      </div>

      {/* ── TAB 1: Section Permissions ── */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div
            className="flex items-start gap-3 rounded-lg p-3 text-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
          >
            <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              El rol <strong>Administrador</strong> siempre tiene acceso completo a todas las secciones.
              Aquí configuras los permisos para <strong>Creador</strong> e <strong>Iniciador</strong>.
              Los permisos controlan qué secciones aparecen en el menú lateral y qué acciones pueden realizar.
            </p>
          </div>

          {/* Permissions matrix */}
          {loadingPermissions ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              Cargando permisos...
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-custom)' }}>
              {/* Table header */}
              <div
                className="grid gap-px text-xs font-semibold"
                style={{
                  gridTemplateColumns: '140px repeat(4, 1fr)',
                  background: 'var(--bg-card-hover)',
                }}
              >
                <div className="px-3 py-2.5" style={{ color: 'var(--text-muted)' }}>
                  Rol / Sección
                </div>
                {Object.values(PERMISSION_LABELS).map((label) => (
                  <div
                    key={label}
                    className="px-2 py-2.5 text-center"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Rows grouped by role */}
              {ROLES.map((role) => (
                <div key={role}>
                  {/* Role header */}
                  <div
                    className="grid gap-px text-xs font-bold px-3 py-2"
                    style={{
                      gridTemplateColumns: '140px repeat(4, 1fr)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: role === 'CREATOR' ? '#8b5cf6' : '#f59e0b', color: role === 'CREATOR' ? '#8b5cf6' : '#f59e0b' }}
                      >
                        {ROLE_LABELS[role]}
                      </Badge>
                    </div>
                    <div colSpan={4} />
                  </div>

                  {/* Section rows */}
                  {SECTIONS.map((section) => {
                    const perm = getPerm(role, section.key);
                    return (
                      <div
                        key={`${role}-${section.key}`}
                        className="grid gap-px text-sm"
                        style={{
                          gridTemplateColumns: '140px repeat(4, 1fr)',
                          background: 'var(--border-custom)',
                        }}
                      >
                        <div
                          className="px-3 py-2.5 flex items-center"
                          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                        >
                          {section.label}
                        </div>
                        {(['canView', 'canCreate', 'canEdit', 'canDelete'] as const).map((field) => (
                          <button
                            key={field}
                            onClick={() => togglePermission(role, section.key, field)}
                            className="flex items-center justify-center py-2.5 transition-colors"
                            style={{
                              background: perm[field] ? 'var(--accent)' : 'var(--bg-card)',
                            }}
                            title={`${PERMISSION_LABELS[field]}: ${perm[field] ? 'Sí' : 'No'}`}
                          >
                            {perm[field] ? (
                              <Check className="size-4 text-white" />
                            ) : (
                              <div
                                className="size-4 rounded-full border"
                                style={{ borderColor: 'var(--border-custom)' }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Save button */}
          {permissionsChanged && (
            <div className="flex justify-end">
              <Button
                onClick={handleSavePermissions}
                disabled={savingPermissions}
                className="flex items-center gap-2"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Save className="size-4" />
                {savingPermissions ? 'Guardando...' : 'Guardar Permisos'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Event Access ── */}
      {activeTab === 'event-access' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div
            className="flex items-start gap-3 rounded-lg p-3 text-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
          >
            <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              Asigna eventos específicos a usuarios <strong>Iniciadores</strong> para que puedan
              poner en vivo y cambiar marcadores. Los roles <strong>Administrador</strong> y
              <strong> Creador</strong> pueden gestionar todos los eventos sin asignación previa.
            </p>
          </div>

          {/* Assign new access */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
          >
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Plus className="size-4" />
              Asignar Evento a Usuario
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-md px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-custom)',
                }}
              >
                <option value="">Seleccionar usuario...</option>
                {users
                  .filter((u) => u.role === 'INITIATOR')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.username} (@{u.username}) — {ROLE_LABELS[u.role]}
                    </option>
                  ))}
                {users
                  .filter((u) => u.role !== 'INITIATOR')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.username} (@{u.username}) — {ROLE_LABELS[u.role]}
                    </option>
                  ))}
              </select>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="flex-1 rounded-md px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-custom)',
                }}
              >
                <option value="">Seleccionar evento...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || `${e.teamA.name} vs ${e.teamB.name}`} ({e.status})
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAssignEvent}
                disabled={!selectedUserId || !selectedEventId || assigning}
                className="flex items-center gap-2 shrink-0"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Plus className="size-4" />
                {assigning ? 'Asignando...' : 'Asignar'}
              </Button>
            </div>
          </div>

          {/* Access list */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border-custom)' }}
          >
            {loadingAccess ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
                Cargando asignaciones...
              </div>
            ) : eventAccess.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Users className="size-8" />
                <p className="text-sm">No hay asignaciones de eventos</p>
                <p className="text-xs">Usa el formulario superior para asignar eventos a usuarios</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-custom)' }}>
                {eventAccess.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-4 py-3 gap-3"
                    style={{ background: 'var(--bg-card)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 shrink-0"
                          style={{
                            borderColor: entry.user.role === 'CREATOR' ? '#8b5cf6' : '#f59e0b',
                            color: entry.user.role === 'CREATOR' ? '#8b5cf6' : '#f59e0b',
                          }}
                        >
                          {ROLE_LABELS[entry.user.role]}
                        </Badge>
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {entry.user.name || entry.user.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <Trophy className="size-3 shrink-0" />
                        <span className="truncate">{eventDisplayName(entry.event)}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 shrink-0"
                          style={{ borderColor: STATUS_COLORS[entry.event.status] || '#666', color: STATUS_COLORS[entry.event.status] || '#666' }}
                        >
                          {entry.event.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 hover:bg-red-500/20"
                      onClick={() => handleRemoveAccess(entry.id)}
                      disabled={deletingId === entry.id}
                      title="Eliminar asignación"
                    >
                      <Trash2 className="size-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

