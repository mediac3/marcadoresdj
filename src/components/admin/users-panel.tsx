'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  ShieldOff,
  Trash2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  UserCog,
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useAppStore } from '@/lib/store';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface UserRecord {
  id: string;
  username: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserFormData {
  username: string;
  name: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserFormData = {
  username: '',
  name: '',
  password: '',
  role: 'INITIATOR',
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function roleBadgeInfo(role: string): { label: string; style: React.CSSProperties } {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    ADMIN: { label: 'Admin', bg: '#ef444420', color: '#ef4444', border: '#ef444430' },
    CREATOR: { label: 'Creador', bg: '#f59e0b20', color: '#f59e0b', border: '#f59e0b30' },
    INITIATOR: { label: 'Iniciador', bg: '#22c55e20', color: '#22c55e', border: '#22c55e30' },
  };
  const info = map[role] || map.INITIATOR;
  return {
    label: info.label,
    style: { background: info.bg, color: info.color, borderColor: info.border },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ── User Modal ────────────────────────────────────────────────────────────── */

function UserModal({
  editingUser,
  onSave,
  isSaving,
  onClose,
}: {
  editingUser: UserRecord | null;
  onSave: (data: UserFormData) => void;
  isSaving: boolean;
  onClose: () => void;
}) {
  const isEdit = !!editingUser;
  const [form, setForm] = useState<UserFormData>(
    editingUser
      ? {
          username: editingUser.username,
          name: editingUser.name || '',
          password: '',
          role: editingUser.role,
        }
      : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  const handleChange = useCallback((field: keyof UserFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof UserFormData, string>> = {};
    if (!form.username.trim()) e.username = 'Usuario requerido';
    else if (form.username.trim().length < 3) e.username = 'Mínimo 3 caracteres';
    if (!isEdit && !form.password.trim()) e.password = 'Contraseña requerida';
    else if (form.password && form.password.length < 4) e.password = 'Mínimo 4 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, isEdit]);

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
            {isEdit ? 'Editar Usuario' : 'Crear Usuario'}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            {isEdit
              ? `Modificando datos de @${editingUser?.username}`
              : 'Completa los datos para crear un nuevo usuario'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Username */}
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Usuario</Label>
            <Input
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="nombre_usuario"
              disabled={isEdit}
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.username ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.username && (
              <p className="text-xs text-red-400">{errors.username}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nombre completo"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>
              Contraseña {isEdit && '(dejar vacío para no cambiar)'}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isEdit ? '••••••••' : 'Contraseña'}
              style={{
                background: 'var(--bg-primary)',
                borderColor: errors.password ? '#ef4444' : 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>Rol</Label>
            <Select
              value={form.role}
              onValueChange={(v) => handleChange('role', v)}
            >
              <SelectTrigger
                className="w-full"
                style={{
                  background: 'var(--bg-primary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                }}
              >
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="CREATOR">Creador</SelectItem>
                <SelectItem value="INITIATOR">Iniciador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onClose()}
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isSaving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            {isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── User Card (Mobile) ────────────────────────────────────────────────────── */

function UserCard({
  user,
  onEdit,
  onToggle,
  onDelete,
}: {
  user: UserRecord;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const role = roleBadgeInfo(user.role);

  return (
    <Card
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        opacity: user.isActive ? 1 : 0.6,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {user.name || user.username}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold px-1.5 py-0 shrink-0"
                style={role.style}
              >
                {role.label}
              </Badge>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              @{user.username} · Creado: {formatDate(user.createdAt)}
            </p>
            <div className="mt-2">
              <Badge
                variant="outline"
                className="text-[10px] font-medium px-1.5 py-0"
                style={{
                  borderColor: user.isActive ? '#22c55e40' : '#ef444440',
                  color: user.isActive ? '#22c55e' : '#ef4444',
                  background: user.isActive ? '#22c55e15' : '#ef444415',
                }}
              >
                {user.isActive ? '● Activo' : '● Inactivo'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} title="Editar">
              <Pencil className="size-3.5" style={{ color: 'var(--text-secondary)' }} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onToggle} title={user.isActive ? 'Desactivar' : 'Activar'}>
              {user.isActive ? (
                <ShieldOff className="size-3.5 text-amber-400" />
              ) : (
                <ShieldCheck className="size-3.5 text-green-400" />
              )}
            </Button>
            {user.isActive && (
              <Button variant="ghost" size="icon" className="size-8" onClick={onDelete} title="Desactivar usuario">
                <Trash2 className="size-3.5 text-red-400" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

/* ── Main Users Panel ──────────────────────────────────────────────────────── */

export function UsersPanel() {
  const isAdmin = useAppStore((s) => s.isAdmin);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ success: boolean; users: UserRecord[] }>('/api/auth/users');
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = useCallback(() => {
    setEditingUser(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((user: UserRecord) => {
    setEditingUser(user);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: UserFormData) => {
      setSaving(true);
      try {
        if (editingUser) {
          // Update
          const body: Record<string, unknown> = {
            name: data.name || null,
            role: data.role,
          };
          if (data.password) body.password = data.password;
          await apiPut<{ success: boolean }>(`/api/auth/users/${editingUser.id}`, body);
        } else {
          // Create
          await apiPost<{ success: boolean }>('/api/auth/users', {
            username: data.username,
            password: data.password,
            name: data.name || null,
            role: data.role,
          });
        }
        setModalOpen(false);
        fetchUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar usuario');
      } finally {
        setSaving(false);
      }
    },
    [editingUser, fetchUsers],
  );

  const handleToggleActive = useCallback(
    async (user: UserRecord) => {
      setActionLoading(user.id);
      try {
        await apiPut<{ success: boolean }>(`/api/auth/users/${user.id}`, {
          isActive: !user.isActive,
        });
        fetchUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cambiar estado');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchUsers],
  );

  const handleDelete = useCallback(
    async (user: UserRecord) => {
      setActionLoading(user.id);
      try {
        await apiDelete<{ success: boolean }>(`/api/auth/users/${user.id}`);
        fetchUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al desactivar usuario');
      } finally {
        setActionLoading(null);
      }
    },
    [fetchUsers],
  );

  if (!isAdmin()) return <AccessDenied />;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-xl md:text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Gestión de Usuarios
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Administra los usuarios del sistema
          </p>
        </div>
        <Button
          size="sm"
          className="text-xs font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={handleCreate}
        >
          <Plus className="size-3.5 mr-1.5" />
          Crear Usuario
        </Button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <Card
          style={{
            background: 'var(--bg-card)',
            borderColor: '#ef444440',
          }}
        >
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
              onClick={fetchUsers}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!loading && users.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16">
          <UserCog className="size-12 mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay usuarios registrados
          </p>
        </div>
      )}

      {/* ── Desktop Table ───────────────────────────────────────────────── */}
      {!loading && users.length > 0 && (
        <>
          {/* Desktop: table view */}
          <Card
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
            }}
            className="hidden md:block overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--border)' }}>
                    <TableHead style={{ color: 'var(--text-secondary)' }}>Usuario</TableHead>
                    <TableHead style={{ color: 'var(--text-secondary)' }}>Nombre</TableHead>
                    <TableHead style={{ color: 'var(--text-secondary)' }}>Rol</TableHead>
                    <TableHead style={{ color: 'var(--text-secondary)' }}>Estado</TableHead>
                    <TableHead style={{ color: 'var(--text-secondary)' }}>Creado</TableHead>
                    <TableHead className="text-right" style={{ color: 'var(--text-secondary)' }}>
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const role = roleBadgeInfo(u.role);
                    return (
                      <TableRow
                        key={u.id}
                        style={{
                          borderColor: 'var(--border)',
                          opacity: u.isActive ? 1 : 0.5,
                        }}
                      >
                        <TableCell style={{ color: 'var(--text-primary)' }}>
                          <span className="font-mono text-sm">@{u.username}</span>
                        </TableCell>
                        <TableCell style={{ color: 'var(--text-primary)' }}>
                          {u.name || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold px-1.5 py-0"
                            style={role.style}
                          >
                            {role.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium px-1.5 py-0"
                            style={{
                              borderColor: u.isActive ? '#22c55e40' : '#ef444440',
                              color: u.isActive ? '#22c55e' : '#ef4444',
                              background: u.isActive ? '#22c55e15' : '#ef444415',
                            }}
                          >
                            {u.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-sm"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleEdit(u)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" style={{ color: 'var(--text-secondary)' }} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={actionLoading === u.id}
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? 'Desactivar' : 'Activar'}
                            >
                              {u.isActive ? (
                                <ShieldOff className="size-3.5 text-amber-400" />
                              ) : (
                                <ShieldCheck className="size-3.5 text-green-400" />
                              )}
                            </Button>
                            {u.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                disabled={actionLoading === u.id}
                                onClick={() => handleDelete(u)}
                                title="Desactivar usuario"
                              >
                                <Trash2 className="size-3.5 text-red-400" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile: card view */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onEdit={() => handleEdit(u)}
                onToggle={() => handleToggleActive(u)}
                onDelete={() => handleDelete(u)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── User Modal ───────────────────────────────────────────────────── */}
      {modalOpen && (
        <UserModal
          key={modalKey}
          editingUser={editingUser}
          onSave={handleSave}
          isSaving={saving}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}