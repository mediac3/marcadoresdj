'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Trash2, Loader2, Users } from 'lucide-react';
import { apiGet, apiPost, apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface InitiatorUser {
  id: string;
  username: string;
  name: string | null;
  role: string;
}

interface AssignedInitiator {
  id: string;
  userId: string;
  user: InitiatorUser;
  assignedBy: string;
}

export function InitiatorAssignmentModal({
  eventId,
  eventLabel,
  onClose,
}: {
  eventId: string;
  eventLabel: string;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const [assigned, setAssigned] = useState<AssignedInitiator[]>([]);
  const [availableInitiators, setAvailableInitiators] = useState<InitiatorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const fetchAssigned = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; initiators: AssignedInitiator[] }>(
        `/api/events/${eventId}/initiators`
      );
      setAssigned(res.initiators);
    } catch {
      // silently ignore
    }
  }, [eventId]);

  const fetchAvailable = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; users: InitiatorUser[] }>(
        '/api/auth/users?role=INITIATOR'
      );
      setAvailableInitiators(res.users);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAssigned(), fetchAvailable()]).finally(() => setLoading(false));
  }, [fetchAssigned, fetchAvailable]);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setAssigning(selectedUserId);
    try {
      await apiPost(`/api/events/${eventId}/initiators`, { userId: selectedUserId });
      setSelectedUserId('');
      await fetchAssigned();
      toast({ title: 'Iniciador asignado', description: 'El iniciador ahora puede operar este evento.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al asignar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setAssigning(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    try {
      await apiFetch(`/api/events/${eventId}/initiators`, {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
      await fetchAssigned();
      toast({ title: 'Acceso eliminado', description: 'El iniciador ya no puede operar este evento.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRemoving(null);
    }
  };

  const assignedUserIds = new Set(assigned.map((a) => a.userId));
  const unassigned = availableInitiators.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)', boxShadow: 'var(--shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border-custom)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center size-8 rounded-lg"
              style={{ background: 'var(--accent)20' }}
            >
              <Users className="size-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>
                Iniciadores Asignados
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)', margin: 0 }}>
                {eventLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full transition-colors"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: '60vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : (
            <>
              {/* Assign new initiator */}
              {unassigned.length > 0 && (
                <div
                  className="rounded-lg p-3"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-custom)' }}
                >
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    <UserPlus className="size-3 inline mr-1" />
                    Agregar Iniciador
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 h-8 rounded-lg px-3 text-xs outline-none"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-custom)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {unassigned.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.username}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedUserId || !!assigning}
                      onClick={handleAssign}
                      className="h-8 px-3 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-40"
                      style={{ background: 'var(--accent)' }}
                    >
                      {assigning ? <Loader2 className="size-3.5 animate-spin" /> : 'Asignar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Assigned list */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Iniciadores con acceso ({assigned.length})
                </p>
                {assigned.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    No hay iniciadores asignados a este evento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-custom)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="size-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'var(--accent)' }}
                          >
                            {(a.user.name || a.user.username).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                              {a.user.name || a.user.username}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              @{a.user.username}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={removing === a.userId}
                          onClick={() => handleRemove(a.userId)}
                          className="size-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
                          style={{
                            background: 'transparent',
                            color: '#ef4444',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#ef444420';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {removing === a.userId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}