'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  MousePointerClick,
  ImageIcon,
  Video,
  Type,
  Monitor,
  Smartphone,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  MapPin,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Ad {
  id: string;
  title: string;
  adType: string;
  content: string;
  position: string;
  linkUrl: string | null;
  orientation: string;
  isActive: boolean;
  displayCount: number;
  cityIds: string;
  countdownSeconds: number;
  _count: { clicks: number };
  createdAt: string;
}

interface AdFormData {
  title: string;
  adType: string;
  content: string;
  position: string;
  linkUrl: string;
  orientation: string;
  isActive: boolean;
  cityIds: string[];
  countdownSeconds: number;
}

interface CityOption {
  id: string;
  name: string;
  departmentName: string;
  countryName: string;
}

const EMPTY_FORM: AdFormData = {
  title: '',
  adType: 'text',
  content: '',
  position: 'top',
  linkUrl: '',
  orientation: 'horizontal',
  isActive: true,
  cityIds: [],
  countdownSeconds: 10,
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const AD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  image: 'Imagen',
  video: 'Video',
};

const POSITION_LABELS: Record<string, string> = {
  top: 'Arriba',
  bottom: 'Abajo',
  left: 'Izquierda',
  right: 'Derecha',
};

const ORIENTATION_LABELS: Record<string, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'image':
      return <ImageIcon className="size-3.5" />;
    case 'video':
      return <Video className="size-3.5" />;
    default:
      return <Type className="size-3.5" />;
  }
}

function getPositionIcon(position: string) {
  switch (position) {
    case 'top':
      return <ArrowUp className="size-3.5" />;
    case 'bottom':
      return <ArrowDown className="size-3.5" />;
    case 'left':
      return <ArrowLeft className="size-3.5" />;
    case 'right':
      return <ArrowRight className="size-3.5" />;
    default:
      return null;
  }
}

function getOrientationIcon(orientation: string) {
  return orientation === 'horizontal' ? (
    <Monitor className="size-3.5" />
  ) : (
    <Smartphone className="size-3.5" />
  );
}

function getTypeBadgeStyle(type: string): React.CSSProperties {
  switch (type) {
    case 'image':
      return { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' };
    case 'video':
      return { backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' };
    default:
      return { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)' };
  }
}

function getPositionBadgeStyle(position: string): React.CSSProperties {
  switch (position) {
    case 'top':
      return { backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' };
    case 'bottom':
      return { backgroundColor: 'rgba(244,114,182,0.15)', color: '#f472b6', borderColor: 'rgba(244,114,182,0.3)' };
    case 'left':
      return { backgroundColor: 'rgba(45,212,191,0.15)', color: '#2dd4bf', borderColor: 'rgba(45,212,191,0.3)' };
    case 'right':
      return { backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', borderColor: 'rgba(251,146,60,0.3)' };
    default:
      return {};
  }
}

function getOrientationBadgeStyle(orientation: string): React.CSSProperties {
  if (orientation === 'horizontal') {
    return { backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' };
  }
  return { backgroundColor: 'rgba(14,165,233,0.15)', color: '#38bdf8', borderColor: 'rgba(14,165,233,0.3)' };
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/* ── Skeleton Row ──────────────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-custom)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            width: '40%',
            height: '14px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-secondary)',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{ width: '60px', height: '22px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}
          />
          <div
            style={{ width: '70px', height: '22px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}
          />
          <div
            style={{ width: '80px', height: '22px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}
          />
        </div>
      </div>
      <div
        style={{ width: '40px', height: '22px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}
      />
    </div>
  );
}

/* ── City Multi-Select Component ───────────────────────────────────────────── */

function CityMultiSelect({
  selectedIds,
  onChange,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function loadCities() {
      try {
        setLoading(true);
        // Fetch all countries first, then all departments, then all cities
        const countryRes = await apiGet<{ success: boolean; countries: { id: string; name: string }[] }>('/api/locations?type=countries');
        const countries = countryRes.countries ?? [];

        const allCities: CityOption[] = [];
        for (const country of countries) {
          const deptRes = await apiGet<{ departments: { id: string; name: string }[] }>(
            `/api/locations?type=departments&countryId=${encodeURIComponent(country.id)}`
          );
          const departments = deptRes.departments ?? [];

          for (const dept of departments) {
            const cityRes = await apiGet<{ cities: { id: string; name: string }[] }>(
              `/api/locations?type=cities&departmentId=${encodeURIComponent(dept.id)}`
            );
            const cityList = cityRes.cities ?? [];

            for (const city of cityList) {
              allCities.push({
                id: city.id,
                name: city.name,
                departmentName: dept.name,
                countryName: country.name,
              });
            }
          }
        }
        setCities(allCities);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadCities();
  }, []);

  const filteredCities = search
    ? cities.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.departmentName.toLowerCase().includes(search.toLowerCase()) ||
          c.countryName.toLowerCase().includes(search.toLowerCase())
      )
    : cities;

  const DISPLAY_LIMIT = 8;
  const displayedCities = showAll ? filteredCities : filteredCities.slice(0, DISPLAY_LIMIT);
  const hasMore = filteredCities.length > DISPLAY_LIMIT;

  function toggleCity(cityId: string) {
    if (selectedIds.includes(cityId)) {
      onChange(selectedIds.filter((id) => id !== cityId));
    } else {
      onChange([...selectedIds, cityId]);
    }
  }

  function selectAllVisible() {
    const visibleIds = displayedCities.map((c) => c.id);
    const merged = new Set([...selectedIds, ...visibleIds]);
    onChange(Array.from(merged));
  }

  function deselectAll() {
    onChange([]);
  }

  // Group cities by country > department for display
  const grouped = displayedCities.reduce<Record<string, Record<string, CityOption[]>>>((acc, city) => {
    if (!acc[city.countryName]) acc[city.countryName] = {};
    if (!acc[city.countryName][city.departmentName]) acc[city.countryName][city.departmentName] = [];
    acc[city.countryName][city.departmentName].push(city);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Search + actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
          placeholder="Buscar ciudad..."
          disabled={disabled}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-custom)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            height: '32px',
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={selectedIds.length > 0 ? deselectAll : selectAllVisible}
          disabled={disabled || loading}
          style={{
            color: 'var(--accent)',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            padding: '4px 8px',
            height: '32px',
          }}
        >
          {selectedIds.length > 0 ? 'Ninguna' : 'Todas'}
        </Button>
      </div>

      {/* Selected count */}
      {selectedIds.length > 0 && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <MapPin className="size-3" />
          {selectedIds.length} {selectedIds.length === 1 ? 'ciudad seleccionada' : 'ciudades seleccionadas'}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '4px' }}>
            (vacío = todas las ubicaciones)
          </span>
        </div>
      )}

      {/* City list */}
      <div
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid var(--border-custom)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '8px',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
            <Loader2 className="size-4" style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
          </div>
        ) : filteredCities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
            No se encontraron ciudades
          </p>
        ) : (
          Object.entries(grouped).map(([country, departments]) => (
            <div key={country} style={{ marginBottom: '8px' }}>
              <p
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                  marginTop: '8px',
                }}
              >
                {country}
              </p>
              {Object.entries(departments).map(([dept, deptCities]) => (
                <div key={dept} style={{ marginBottom: '2px' }}>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '2px',
                      paddingLeft: '4px',
                    }}
                  >
                    {dept}
                  </p>
                  {deptCities.map((city) => (
                    <label
                      key={city.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '3px 4px 3px 12px',
                        borderRadius: '4px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.includes(city.id)}
                        onCheckedChange={() => toggleCity(city.id)}
                        disabled={disabled}
                        style={{ width: '14px', height: '14px' }}
                      />
                      {city.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {hasMore && !showAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          style={{
            color: 'var(--accent)',
            fontSize: '0.75rem',
            width: '100%',
          }}
        >
          Mostrar más ciudades ({filteredCities.length - DISPLAY_LIMIT} restantes)
        </Button>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────────── */

export function AdsPanel() {
  const { toast } = useToast();

  /* State */
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* Dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormData>({ ...EMPTY_FORM });

  /* Delete state */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Toggle state */
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ── Fetch ads ─────────────────────────────────────────────────────────── */

  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ success: boolean; ads: Ad[] }>('/api/ads');
      if (res.success) {
        setAds(res.ads);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las publicidades.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  /* ── Open create dialog ────────────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  /* ── Open edit dialog ─────────────────────────────────────────────────── */

  function openEdit(ad: Ad) {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      adType: ad.adType,
      content: ad.content,
      position: ad.position,
      linkUrl: ad.linkUrl || '',
      orientation: ad.orientation,
      isActive: ad.isActive,
      cityIds: ad.cityIds ? ad.cityIds.split(',').filter(Boolean) : [],
      countdownSeconds: ad.countdownSeconds ?? 10,
    });
    setDialogOpen(true);
  }

  /* ── Save (create or update) ──────────────────────────────────────────── */

  async function handleSave() {
    if (!form.title.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'El título es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: form.title.trim(),
        adType: form.adType,
        content: form.content.trim(),
        position: form.position,
        linkUrl: form.linkUrl.trim() || null,
        orientation: form.orientation,
        isActive: form.isActive,
        cityIds: form.cityIds,
        countdownSeconds: form.countdownSeconds,
      };

      if (editingId) {
        await apiPut('/api/ads/' + editingId, payload);
        toast({ title: 'Publicidad actualizada', description: 'Los cambios se guardaron correctamente.' });
      } else {
        await apiPost('/api/ads', payload);
        toast({ title: 'Publicidad creada', description: 'La nueva publicidad fue agregada.' });
      }

      setDialogOpen(false);
      fetchAds();
    } catch {
      toast({
        title: 'Error',
        description: editingId
          ? 'No se pudo actualizar la publicidad.'
          : 'No se pudo crear la publicidad.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ───────────────────────────────────────────────────────────── */

  function openDelete(ad: Ad) {
    setDeleteTarget(ad);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await apiDelete('/api/ads/' + deleteTarget.id);
      toast({ title: 'Publicidad eliminada', description: `"${deleteTarget.title}" fue eliminada.` });
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchAds();
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la publicidad.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }

  /* ── Toggle active ────────────────────────────────────────────────────── */

  async function handleToggle(ad: Ad) {
    const newStatus = !ad.isActive;
    const previousAds = [...ads];

    // Optimistic update
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, isActive: newStatus } : a)));
    setTogglingId(ad.id);

    try {
      await apiPut('/api/ads/' + ad.id, { isActive: newStatus });
      toast({
        title: newStatus ? 'Publicidad activada' : 'Publicidad desactivada',
        description: `"${ad.title}" ahora está ${newStatus ? 'activa' : 'inactiva'}.`,
      });
    } catch {
      // Revert on error
      setAds(previousAds);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado de la publicidad.',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  }

  /* ── Update a single form field ───────────────────────────────────────── */

  function updateForm(field: keyof AdFormData, value: string | boolean | number | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Reset content when type changes
    if (field === 'adType' && value !== form.adType) {
      setForm((prev) => ({ ...prev, content: '' }));
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
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
            Publicidad
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
              {ads.length} {ads.length === 1 ? 'elemento' : 'elementos'}
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
          Nueva Publicidad
        </Button>
      </div>

      {/* ── Loading skeletons ──────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loading && ads.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px',
            backgroundColor: 'var(--bg-card)',
            border: '1px dashed var(--border-custom)',
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <ExternalLink className="size-6" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem', margin: '0 0 4px 0' }}>
            Sin publicidades
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Crea tu primera publicidad para comenzar.
          </p>
        </div>
      )}

      {/* ── Ads list ───────────────────────────────────────────────────── */}
      {!loading && ads.length > 0 && (
        <div
          className="ads-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '600px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {ads.map((ad) => (
            <div
              key={ad.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: `1px solid ${ad.isActive ? 'var(--border-custom)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                opacity: ad.isActive ? 1 : 0.6,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Top row: info + toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h3
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ad.title}
                    </h3>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    <Badge
                      variant="outline"
                      style={{
                        ...getTypeBadgeStyle(ad.adType),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        padding: '2px 8px',
                      }}
                    >
                      {getTypeIcon(ad.adType)}
                      {AD_TYPE_LABELS[ad.adType] || ad.adType}
                    </Badge>

                    <Badge
                      variant="outline"
                      style={{
                        ...getPositionBadgeStyle(ad.position),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        padding: '2px 8px',
                      }}
                    >
                      {getPositionIcon(ad.position)}
                      {POSITION_LABELS[ad.position] || ad.position}
                    </Badge>

                    <Badge
                      variant="outline"
                      style={{
                        ...getOrientationBadgeStyle(ad.orientation),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        padding: '2px 8px',
                      }}
                    >
                      {getOrientationIcon(ad.orientation)}
                      {ORIENTATION_LABELS[ad.orientation] || ad.orientation}
                    </Badge>

                    {/* Location badge */}
                    {ad.cityIds && ad.cityIds.trim() !== '' && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: 'rgba(16,185,129,0.15)',
                          color: '#10b981',
                          borderColor: 'rgba(16,185,129,0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          padding: '2px 8px',
                        }}
                      >
                        <MapPin className="size-3" />
                        {ad.cityIds.split(',').filter(Boolean).length} ubicaciones
                      </Badge>
                    )}

                    {/* Countdown badge */}
                    {ad.countdownSeconds > 0 && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: 'rgba(251,146,60,0.15)',
                          color: '#fb923c',
                          borderColor: 'rgba(251,146,60,0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          padding: '2px 8px',
                        }}
                      >
                        <Timer className="size-3" />
                        {ad.countdownSeconds}s cuenta atrás
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Eye className="size-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
                        {ad.displayCount.toLocaleString('es-ES')}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>impresiones</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MousePointerClick className="size-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
                        {(ad._count?.clicks ?? 0).toLocaleString('es-ES')}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>clics</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {formatDate(ad.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Toggle */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                  }}
                >
                  <Switch
                    checked={ad.isActive}
                    disabled={togglingId === ad.id}
                    onCheckedChange={() => handleToggle(ad)}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: ad.isActive ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    {ad.isActive ? (
                      <>
                        <ToggleRight className="size-3" />
                        Activo
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="size-3" />
                        Inactivo
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Bottom row: actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-custom)',
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(ad)}
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                  }}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDelete(ad)}
                  style={{
                    color: 'var(--accent-red)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !saving) setDialogOpen(false); }}>
        <DialogContent
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-custom)',
            borderRadius: '14px',
            maxWidth: '580px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 700 }}>
              {editingId ? 'Editar Publicidad' : 'Nueva Publicidad'}
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {editingId
                ? 'Modifica los datos de la publicidad.'
                : 'Completa los datos para crear una nueva publicidad.'}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                Título <span style={{ color: 'var(--accent-red)' }}>*</span>
              </Label>
              <Input
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Nombre de la publicidad"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-custom)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Ad Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                Tipo
              </Label>
              <Select value={form.adType} onValueChange={(val) => updateForm('adType', val)}>
                <SelectTrigger
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                >
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-custom)',
                  }}
                >
                  <SelectItem value="text" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Type className="size-3.5" />
                      Texto
                    </span>
                  </SelectItem>
                  <SelectItem value="image" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon className="size-3.5" />
                      Imagen
                    </span>
                  </SelectItem>
                  <SelectItem value="video" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Video className="size-3.5" />
                      Video
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content - conditional based on adType */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                {form.adType === 'text' ? 'Contenido del texto' : form.adType === 'image' ? 'URL de la imagen (GIF/JPEG)' : 'URL del video'}
              </Label>

              {form.adType === 'text' ? (
                <Textarea
                  value={form.content}
                  onChange={(e) => updateForm('content', e.target.value)}
                  placeholder="Escribe el texto de la publicidad aquí..."
                  rows={4}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    minHeight: '100px',
                  }}
                />
              ) : (
                <Input
                  value={form.content}
                  onChange={(e) => updateForm('content', e.target.value)}
                  placeholder={
                    form.adType === 'image'
                      ? 'https://ejemplo.com/imagen.gif'
                      : 'https://ejemplo.com/video.mp4'
                  }
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              )}

              {form.adType === 'image' && form.content && (
                <div
                  style={{
                    marginTop: '8px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-custom)',
                    backgroundColor: 'var(--bg-secondary)',
                    maxHeight: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={form.content}
                    alt="Vista previa"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '180px',
                      objectFit: 'contain',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Position and Orientation row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Position */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                  Posición
                </Label>
                <Select value={form.position} onValueChange={(val) => updateForm('position', val)}>
                  <SelectTrigger
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-custom)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <SelectValue placeholder="Seleccionar posición" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-custom)',
                    }}
                  >
                    <SelectItem value="top" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowUp className="size-3.5" />
                        Arriba
                      </span>
                    </SelectItem>
                    <SelectItem value="bottom" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowDown className="size-3.5" />
                        Abajo
                      </span>
                    </SelectItem>
                    <SelectItem value="left" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowLeft className="size-3.5" />
                        Izquierda
                      </span>
                    </SelectItem>
                    <SelectItem value="right" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowRight className="size-3.5" />
                        Derecha
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Orientation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                  Orientación
                </Label>
                <Select value={form.orientation} onValueChange={(val) => updateForm('orientation', val)}>
                  <SelectTrigger
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-custom)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <SelectValue placeholder="Seleccionar orientación" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-custom)',
                    }}
                  >
                    <SelectItem value="horizontal" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Monitor className="size-3.5" />
                        Horizontal
                      </span>
                    </SelectItem>
                    <SelectItem value="vertical" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone className="size-3.5" />
                        Vertical
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Countdown Seconds */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                Cuenta atrás antes de cerrar (segundos)
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>(0 = sin espera)</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={300}
                value={form.countdownSeconds}
                onChange={(e) => updateForm('countdownSeconds', Math.max(0, parseInt(e.target.value) || 0))}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-custom)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  width: '120px',
                }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                Tiempo en segundos que el usuario debe esperar antes de poder cerrar la publicidad con el botón X.
              </p>
            </div>

            {/* City Location Multi-Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin className="size-4" />
                Ubicaciones de eventos
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(sin seleccionar = todas)</span>
              </Label>
              <CityMultiSelect
                selectedIds={form.cityIds}
                onChange={(ids) => updateForm('cityIds', ids)}
              />
            </div>

            {/* Link URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                URL de destino
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>(opcional)</span>
              </Label>
              <Input
                value={form.linkUrl}
                onChange={(e) => updateForm('linkUrl', e.target.value)}
                placeholder="https://ejemplo.com/destino"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-custom)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Active toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-custom)',
              }}
            >
              <div>
                <Label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'block' }}>
                  Activo
                </Label>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {form.isActive ? 'La publicidad será visible' : 'La publicidad estará oculta'}
                </span>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => updateForm('isActive', checked)}
              />
            </div>
          </div>

          <DialogFooter
            style={{
              paddingTop: '16px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="ghost"
              onClick={() => { if (!saving) setDialogOpen(false); }}
              disabled={saving}
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: saving || !form.title.trim() ? 0.6 : 1,
              }}
            >
              {saving && <Loader2 className="size-4" style={{ animation: 'spin 1s linear infinite' }} />}
              {editingId ? 'Guardar Cambios' : 'Crear Publicidad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) setDeleteOpen(false); }}>
        <DialogContent
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-custom)',
            borderRadius: '14px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: 'var(--shadow)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
              Eliminar Publicidad
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-custom)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
                Vas a eliminar:
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>
                {deleteTarget.title}
              </span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <Badge
                  variant="outline"
                  style={{
                    ...getTypeBadgeStyle(deleteTarget.adType),
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                  }}
                >
                  {AD_TYPE_LABELS[deleteTarget.adType]}
                </Badge>
                <Badge
                  variant="outline"
                  style={{
                    ...getPositionBadgeStyle(deleteTarget.position),
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                  }}
                >
                  {POSITION_LABELS[deleteTarget.position]}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter
            style={{
              paddingTop: '8px',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="ghost"
              onClick={() => { if (!deleting) setDeleteOpen(false); }}
              disabled={deleting}
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                backgroundColor: 'var(--accent-red)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting && <Loader2 className="size-4" style={{ animation: 'spin 1s linear infinite' }} />}
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline keyframe for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}