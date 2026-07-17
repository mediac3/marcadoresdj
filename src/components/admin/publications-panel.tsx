'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ImageIcon,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Publication {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  type: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicationFormData {
  title: string;
  content: string;
  imageUrl: string;
  type: string;
  isActive: boolean;
  order: number;
}

const EMPTY_FORM: PublicationFormData = {
  title: '',
  content: '',
  imageUrl: '',
  type: 'card',
  isActive: true,
  order: 0,
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

/* ── Main Component ────────────────────────────────────────────────────────── */

export function PublicationsPanel() {
  const { toast } = useToast();

  /* State */
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* Dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PublicationFormData>({ ...EMPTY_FORM });

  /* Delete state */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Publication | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Toggle state */
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ── Fetch ───────────────────────────────────────────────────────────────── */

  const fetchPublications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ success: boolean; publications: Publication[] }>('/api/publications');
      if (res.success) {
        setPublications(res.publications);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las publicaciones.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPublications();
  }, [fetchPublications]);

  /* ── Open create dialog ──────────────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    // Set order to be after the last item
    const maxOrder = publications.length > 0
      ? Math.max(...publications.map((p) => p.order))
      : -1;
    setForm({ ...EMPTY_FORM, order: maxOrder + 1 });
    setDialogOpen(true);
  }

  /* ── Open edit dialog ───────────────────────────────────────────────────── */

  function openEdit(pub: Publication) {
    setEditingId(pub.id);
    setForm({
      title: pub.title,
      content: pub.content,
      imageUrl: pub.imageUrl || '',
      type: pub.type || 'card',
      isActive: pub.isActive,
      order: pub.order,
    });
    setDialogOpen(true);
  }

  /* ── Save (create or update) ─────────────────────────────────────────────── */

  async function handleSave() {
    if (!form.title.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El título es obligatorio.',
        variant: 'destructive',
      });
      return;
    }
    if (!form.content.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El contenido es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        imageUrl: form.imageUrl.trim() || null,
        type: form.type,
        isActive: form.isActive,
        order: form.order,
      };

      if (editingId) {
        await apiPut('/api/publications/' + editingId, payload);
        toast({ title: 'Publicación actualizada', description: 'Los cambios se guardaron correctamente.' });
      } else {
        await apiPost('/api/publications', payload);
        toast({ title: 'Publicación creada', description: 'La nueva publicación fue agregada.' });
      }

      setDialogOpen(false);
      fetchPublications();
    } catch {
      toast({
        title: 'Error',
        description: editingId
          ? 'No se pudo actualizar la publicación.'
          : 'No se pudo crear la publicación.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ──────────────────────────────────────────────────────────────── */

  function openDelete(pub: Publication) {
    setDeleteTarget(pub);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await apiDelete('/api/publications/' + deleteTarget.id);
      toast({ title: 'Publicación eliminada', description: `"${deleteTarget.title}" fue eliminada.` });
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchPublications();
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la publicación.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }

  /* ── Toggle active ──────────────────────────────────────────────────────── */

  async function handleToggle(pub: Publication) {
    const newStatus = !pub.isActive;
    const previousPubs = [...publications];

    setPublications((prev) => prev.map((p) => (p.id === pub.id ? { ...p, isActive: newStatus } : p)));
    setTogglingId(pub.id);

    try {
      await apiPut('/api/publications/' + pub.id, { isActive: newStatus });
      toast({
        title: newStatus ? 'Publicación activada' : 'Publicación desactivada',
        description: `"${pub.title}" ahora está ${newStatus ? 'activa' : 'inactiva'}.`,
      });
    } catch (err) {
      setPublications(previousPubs);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({
        title: 'Error',
        description: `No se pudo cambiar el estado: ${msg}`,
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  }

  /* ── Update form field ──────────────────────────────────────────────────── */

  function updateForm(field: keyof PublicationFormData, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Publicaciones
          </h2>
          {!loading && (
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '2px 10px',
                borderRadius: '20px',
              }}
            >
              {publications.length} {publications.length === 1 ? 'elemento' : 'elementos'}
            </span>
          )}
        </div>

        <Button
          onClick={openCreate}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus className="size-4" />
          Nueva Publicación
        </Button>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && publications.length === 0 && (
        <div
          style={{
            border: '1px dashed var(--border-custom)',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No hay publicaciones</p>
          <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
            Crea tu primera publicación para que aparezca en el pie de página público.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-custom)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '60px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    width: `${40 + i * 15}%`,
                    height: '14px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                />
                <div
                  style={{
                    width: '70%',
                    height: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Publication cards ──────────────────────────────────────────────── */}
      {!loading &&
        publications.map((pub, index) => (
          <div
            key={pub.id}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-custom)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-start',
              opacity: pub.isActive ? 1 : 0.55,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Order badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {index + 1}
            </div>

            {/* Image thumbnail */}
            {pub.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pub.imageUrl}
                alt={pub.title}
                style={{
                  width: '80px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '80px',
                  height: '60px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--text-muted)',
                }}
              >
                <ImageIcon className="size-5" />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '300px',
                  }}
                >
                  {pub.title}
                </h3>
                <Badge
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 8px',
                    backgroundColor: pub.isActive
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: pub.isActive ? '#22c55e' : '#ef4444',
                    border: `1px solid ${pub.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {pub.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
                <Badge
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 8px',
                    backgroundColor: pub.type === 'article'
                      ? 'rgba(99,102,241,0.15)'
                      : 'rgba(168,85,247,0.15)',
                    color: pub.type === 'article' ? '#818cf8' : '#a855f7',
                    border: `1px solid ${pub.type === 'article' ? 'rgba(99,102,241,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  }}
                >
                  {pub.type === 'article' ? 'Artículo' : 'Tarjeta'}
                </Badge>
              </div>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  margin: '4px 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {truncate(pub.content, 120)}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0', opacity: 0.7 }}>
                {formatDate(pub.createdAt)}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => handleToggle(pub)}
                disabled={togglingId === pub.id}
                title={pub.isActive ? 'Desactivar' : 'Activar'}
              >
                {togglingId === pub.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : pub.isActive ? (
                  <ToggleRight className="size-4" style={{ color: '#22c55e' }} />
                ) : (
                  <ToggleLeft className="size-4" style={{ color: 'var(--text-muted)' }} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => openEdit(pub)}
                title="Editar"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => openDelete(pub)}
                title="Eliminar"
                style={{ color: '#ef4444' }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Editar Publicación' : 'Nueva Publicación'}
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              {editingId
                ? 'Modifica los campos de la publicación.'
                : 'Completa los campos para crear una nueva publicación.'}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            {/* Type selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Tipo
              </Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => updateForm('type', 'card')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${form.type === 'card' ? 'var(--accent)' : 'var(--border-custom)'}`,
                    background: form.type === 'card' ? 'rgba(225,29,72,0.08)' : 'var(--bg-secondary)',
                    color: form.type === 'card' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => updateForm('type', 'article')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${form.type === 'article' ? 'var(--accent)' : 'var(--border-custom)'}`,
                    background: form.type === 'article' ? 'rgba(225,29,72,0.08)' : 'var(--bg-secondary)',
                    color: form.type === 'article' ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  Artículo (modal)
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                {form.type === 'article'
                  ? 'Se mostrará como tarjeta en la tira y al dar click se abre en un modal con el contenido completo.'
                  : 'Se mostrará como tarjeta con el contenido truncado en la tira inferior.'}
              </p>
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Título *
              </Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Ej: Resultados de la jornada 15"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Contenido *
              </Label>
              <Textarea
                value={form.content}
                onChange={(e) => updateForm('content', e.target.value)}
                placeholder="Escribe el contenido de la publicación..."
                rows={5}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  minHeight: '100px',
                }}
              />
            </div>

            {/* Image URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                URL de Imagen (opcional)
              </Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => updateForm('imageUrl', e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
              {form.imageUrl && (
                <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', maxHeight: '150px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="Vista previa"
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Order + Active */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 0 120px' }}>
                <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Orden
                </Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => updateForm('order', parseInt(e.target.value) || 0)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 0',
                }}
              >
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateForm('isActive', checked)}
                />
                <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {form.isActive ? 'Activa' : 'Inactiva'}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Guardar Cambios' : 'Crear Publicación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
            maxWidth: '400px',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>
              Eliminar Publicación
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)' }}>
              ¿Estás seguro de que deseas eliminar &quot;{deleteTarget?.title}&quot;? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 600 }}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}