'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  UsersRound,
  Loader2,
  ImageIcon,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore, type Team, type Player } from '@/lib/store';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PlayerModal } from './player-modal';
import { ImportPlayersModal } from './import-players-modal';
import { GENDER_OPTIONS, AGE_CATEGORY_OPTIONS } from '@/lib/constants';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ── Player Avatar ────────────────────────────────────────────────────────── */

function PlayerAvatar({ player, size = 'md' }: { player: Player; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'size-9' : 'size-12';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  if (player.photo) {
    return (
      <Avatar className={sizeClass}>
        <AvatarImage src={player.photo} alt={player.name} />
        <AvatarFallback
          className={textClass}
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {getInitials(player.name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold ${textClass}`}
      style={{ background: 'var(--accent)', color: '#fff' }}
    >
      {getInitials(player.name)}
    </div>
  );
}

/* ── Player Card (Mobile) ─────────────────────────────────────────────────── */

function PlayerCardMobile({
  player,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  player: Player;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-custom)',
      }}
    >
      <PlayerAvatar player={player} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {player.number}
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {player.name}
            </p>
            <Badge
              variant="outline"
              className="mt-0.5 text-[10px] font-medium"
              style={{ borderColor: 'var(--border-custom)', color: 'var(--accent)' }}
            >
              {player.position}
            </Badge>
          </div>
        </div>
      </div>

      {(canEdit || canDelete) && (
        <div className="flex shrink-0 gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onEdit}
              style={{ color: 'var(--text-muted)' }}
              aria-label="Editar jugador"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onDelete}
              style={{ color: 'var(--accent-red)' }}
              aria-label="Eliminar jugador"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Loading Skeleton ─────────────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/* ── Edit Team Modal ──────────────────────────────────────────────────────── */

// Radix Select can't use empty-string values, so use a sentinel for "no owner".
const UNASSIGNED = '__unassigned__';

interface CreatorOption {
  id: string;
  label: string;
}

function EditTeamModal({
  team,
  isOpen,
  onClose,
  onSaved,
  isAdmin,
  creatorOptions,
}: {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Team) => void;
  isAdmin: boolean;
  creatorOptions: CreatorOption[];
}) {
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.shortName || '');
  const [logo, setLogo] = useState(team.logo || '');
  const [gender, setGender] = useState(team.gender || 'Mixto');
  const [ageCategory, setAgeCategory] = useState(team.ageCategory || 'Libre');
  const [assignedCreator, setAssignedCreator] = useState(team.createdById || UNASSIGNED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(team.name);
      setShortName(team.shortName || '');
      setLogo(team.logo || '');
      setGender(team.gender || 'Mixto');
      setAgeCategory(team.ageCategory || 'Libre');
      setAssignedCreator(team.createdById || UNASSIGNED);
      setError('');
    }
  }, [isOpen, team]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPut<{ success: boolean; team: Team }>(`/api/teams/${team.id}`, {
        name: name.trim(),
        shortName: shortName.trim() || null,
        logo: logo.trim() || null,
        gender,
        ageCategory,
        // Assignment is admin-only; the API rejects it for other roles.
        ...(isAdmin && {
          createdById: assignedCreator === UNASSIGNED ? null : assignedCreator,
        }),
      });
      toast({ title: 'Equipo actualizado', description: `${name.trim()} se ha actualizado.` });
      onSaved(res.team);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar el equipo';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>Editar Equipo</DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Modifica los datos del equipo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre <span style={{ color: 'var(--accent-red)' }}>*</span>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-shortname" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre Corto
            </Label>
            <Input
              id="edit-shortname"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              disabled={loading}
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-logo" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              URL del Logo
            </Label>
            <Input
              id="edit-logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              disabled={loading}
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-custom)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Género
              </Label>
              <Select value={gender} onValueChange={setGender} disabled={loading}>
                <SelectTrigger
                  className="w-full"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <SelectValue placeholder="Seleccionar género" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Categoría de Edad
              </Label>
              <Select value={ageCategory} onValueChange={setAgeCategory} disabled={loading}>
                <SelectTrigger
                  className="w-full"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Admin-only: team assignment. Only creators can manage the team
              it is assigned to; unassigned teams are admin-managed. */}
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Creador Asignado
              </Label>
              <Select value={assignedCreator} onValueChange={setAssignedCreator} disabled={loading}>
                <SelectTrigger
                  className="w-full"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <SelectValue placeholder="Seleccionar creador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>
                    Sin asignar (solo administrador)
                  </SelectItem>
                  {creatorOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Los usuarios con rol Creador solo pueden editar o gestionar los equipos que se les asignen.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>{error}</p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ background: loading ? undefined : 'var(--accent)', color: '#fff' }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main View ────────────────────────────────────────────────────────────── */

export function TeamDetailView() {
  const currentView = useAppStore((s) => s.currentView);
  const navigate = useAppStore((s) => s.navigate);

  const teamId = currentView.page === 'TEAM_DETAIL' ? currentView.teamId : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Granular section permissions for "teams" (ADMIN gets all enabled).
  const [canEditTeam, setCanEditTeam] = useState(false);
  const [canCreatePlayers, setCanCreatePlayers] = useState(false);
  const [canDeletePlayers, setCanDeletePlayers] = useState(false);
  // ADMIN-only: team assignment editing + creator options for the select.
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);

  // Modal states
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ success: boolean; team: Team; currentUserId?: string; currentUserRole?: string }>(`/api/teams/${teamId}`);
      setTeam(res.team);
      // Actions are gated by the RoleSectionPermission flags of the "teams"
      // section (ADMIN always has everything enabled). Non-admin users can
      // only manage teams assigned to them by the administrator; unassigned
      // teams (createdById = null) are admin-managed.
      if (res.currentUserRole === 'ADMIN') {
        setIsAdminUser(true);
        setCanEditTeam(true);
        setCanCreatePlayers(true);
        setCanDeletePlayers(true);
      } else {
        setIsAdminUser(false);
        const assigned = !!res.currentUserId && res.team.createdById === res.currentUserId;
        try {
          const permRes = await apiGet<{
            success: boolean;
            permissions: Array<{ section: string; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
          }>('/api/my-permissions');
          const teamPerm = permRes.permissions?.find((p) => p.section === 'teams');
          setCanEditTeam(!!teamPerm?.canEdit && assigned);
          setCanCreatePlayers(!!teamPerm?.canCreate && assigned);
          setCanDeletePlayers(!!teamPerm?.canDelete && assigned);
        } catch {
          setCanEditTeam(false);
          setCanCreatePlayers(false);
          setCanDeletePlayers(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el equipo';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Load creator users for the admin-only assignment select.
  const fetchCreatorOptions = useCallback(async () => {
    try {
      const res = await apiGet<{
        success: boolean;
        users: Array<{ id: string; username: string; name: string | null; role: string; isActive: boolean }>;
      }>('/api/auth/users');
      setCreatorOptions(
        (res.users || [])
          .filter((u) => u.role === 'CREATOR' && u.isActive)
          .map((u) => ({ id: u.id, label: u.name ? `${u.name} (@${u.username})` : `@${u.username}` })),
      );
    } catch {
      // Non-admin users can't list users; the select stays hidden for them.
      setCreatorOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    fetchCreatorOptions();
  }, [fetchCreatorOptions]);

  async function handleDeletePlayer() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/players/${deleteTarget.id}`);
      toast({ title: 'Jugador eliminado', description: `${deleteTarget.name} ha sido eliminado.` });
      setDeleteTarget(null);
      fetchTeam();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el jugador';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  function handleTeamUpdated(updated: Team) {
    setTeam(updated);
  }

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</p>
        <Button variant="outline" onClick={fetchTeam} className="mt-3" style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!team) return null;

  const sportName = team.sport?.name || '—';
  const sportIcon = team.sport?.icon || '🏆';
  const players = team.players || [];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        className="w-fit h-8 gap-1.5 text-sm"
        onClick={() => navigate({ page: 'TEAMS' })}
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="size-4" />
        Volver a Equipos
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Team logo */}
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)', color: 'var(--accent)', border: '1px solid var(--border-custom)' }}
          >
            {team.logo ? (
              <img
                src={team.logo}
                alt={team.name}
                className="size-11 rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) parent.textContent = getInitials(team.name);
                }}
              />
            ) : (
              <span>{getInitials(team.name)}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {team.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: 'var(--border-custom)', color: 'var(--accent)' }}
              >
                {sportIcon} {sportName}
              </Badge>
              {(team.gender && team.gender !== 'Mixto') && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: 'var(--border-custom)', color: 'var(--accent)' }}
                >
                  {team.gender}
                </Badge>
              )}
              {(team.ageCategory && team.ageCategory !== 'Libre') && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                >
                  {team.ageCategory}
                </Badge>
              )}
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <UsersRound className="size-3" />
                {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
              </span>
            </div>
          </div>
        </div>

        {(canEditTeam || canCreatePlayers) && (
          <div className="flex gap-2">
            {canEditTeam && (
              <Button
                variant="outline"
                className="h-9 text-sm"
                onClick={() => setEditTeamOpen(true)}
                style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
            )}
            {canCreatePlayers && (
              <>
                <Button
                  className="h-9 text-sm"
                  onClick={() => setAddPlayerOpen(true)}
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Plus className="size-3.5" />
                  Agregar Jugador
                </Button>
                <Button
                  variant="outline"
                  className="h-9 text-sm"
                  onClick={() => setImportOpen(true)}
                  style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
                >
                  <Upload className="size-3.5" />
                  Importar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Players */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-full text-3xl"
            style={{ background: 'var(--bg-secondary)' }}
            aria-hidden="true"
          >
            <ImageIcon className="size-8" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            No hay jugadores en este equipo
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {canCreatePlayers
              ? 'Agrega jugadores al equipo para comenzar.'
              : 'Aún no se han registrado jugadores.'}
          </p>
          {canCreatePlayers && (
            <Button
              className="mt-4 h-9 text-sm"
              onClick={() => setAddPlayerOpen(true)}
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus className="size-3.5" />
              Agregar Jugador
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: Card grid */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {players.map((player) => (
              <PlayerCardMobile
                key={player.id}
                player={player}
                canEdit={canEditTeam}
                canDelete={canDeletePlayers}
                onEdit={() => setEditPlayer(player)}
                onDelete={() => setDeleteTarget(player)}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: 'var(--border-custom)' }}>
                  <TableHead style={{ color: 'var(--text-muted)', width: '50px' }}></TableHead>
                  <TableHead style={{ color: 'var(--text-muted)', width: '70px' }}>N.°</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)' }}>Nombre</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)', width: '150px' }}>Posición</TableHead>
                  <TableHead style={{ color: 'var(--text-muted)', width: '100px' }}>Apodo</TableHead>
                  {(canEditTeam || canDeletePlayers) && (
                    <TableHead style={{ color: 'var(--text-muted)', width: '100px' }} className="text-right">
                      Acciones
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow
                    key={player.id}
                    style={{ borderColor: 'var(--border-custom)' }}
                  >
                    <TableCell>
                      <PlayerAvatar player={player} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: 'var(--accent)' }}
                      >
                        {player.number}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {player.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: 'var(--border-custom)', color: 'var(--accent)' }}
                      >
                        {player.position}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {player.nickname || '—'}
                      </span>
                    </TableCell>
                    {(canEditTeam || canDeletePlayers) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEditTeam && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setEditPlayer(player)}
                              style={{ color: 'var(--text-muted)' }}
                              aria-label="Editar jugador"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                          {canDeletePlayers && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setDeleteTarget(player)}
                              style={{ color: 'var(--accent-red)' }}
                              aria-label="Eliminar jugador"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Edit Team Modal */}
      {team && (
        <EditTeamModal
          team={team}
          isOpen={editTeamOpen}
          onClose={() => setEditTeamOpen(false)}
          onSaved={handleTeamUpdated}
          isAdmin={isAdminUser}
          creatorOptions={creatorOptions}
        />
      )}

      {/* Add Player Modal */}
      <PlayerModal
        teamId={team.id}
        sportName={sportName}
        isOpen={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onSave={fetchTeam}
      />

      {/* Edit Player Modal */}
      <PlayerModal
        teamId={team.id}
        sportName={sportName}
        player={editPlayer}
        isOpen={!!editPlayer}
        onClose={() => setEditPlayer(null)}
        onSave={fetchTeam}
      />

      {/* Import Players Modal */}
      <ImportPlayersModal
        teamId={team.id}
        teamName={team.name}
        sportName={sportName}
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchTeam}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent style={{ background: 'var(--bg-card)', borderColor: 'var(--border-custom)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--text-primary)' }}>
              Eliminar Jugador
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--text-muted)' }}>
              ¿Estás seguro de eliminar a <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.name}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{ borderColor: 'var(--border-custom)', color: 'var(--text-secondary)' }}
              disabled={deleting}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlayer}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700 focus:bg-red-700"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}