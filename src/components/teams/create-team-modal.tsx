'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { GENDER_OPTIONS, AGE_CATEGORY_OPTIONS } from '@/lib/constants';

interface SportOption {
  id: string;
  name: string;
  icon: string;
}

interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateTeamModal({ open, onOpenChange, onCreated }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logo, setLogo] = useState('');
  const [sportId, setSportId] = useState('');
  const [gender, setGender] = useState('Mixto');
  const [ageCategory, setAgeCategory] = useState('Libre');
  const [sports, setSports] = useState<SportOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSports, setLoadingSports] = useState(true);
  const [error, setError] = useState('');

  const { toast } = useToast();

  const fetchSports = useCallback(async () => {
    try {
      const res = await apiGet<{ success: boolean; sports: SportOption[] }>('/api/sports');
      setSports(res.sports);
    } catch {
      // silently ignore
    } finally {
      setLoadingSports(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSports();
    }
  }, [open, fetchSports]);

  function resetForm() {
    setName('');
    setShortName('');
    setLogo('');
    setSportId('');
    setGender('Mixto');
    setAgeCategory('Libre');
    setError('');
  }

  function handleClose(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!sportId) {
      setError('El deporte es requerido');
      return;
    }

    setLoading(true);
    try {
      await apiPost('/api/teams', {
        name: name.trim(),
        shortName: shortName.trim() || null,
        logo: logo.trim() || null,
        sportId,
        gender,
        ageCategory,
      });
      toast({ title: 'Equipo creado', description: `${name.trim()} se ha creado correctamente.` });
      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el equipo';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            Crear Equipo
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            Completa los datos para registrar un nuevo equipo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre <span style={{ color: 'var(--accent-red)' }}>*</span>
            </Label>
            <Input
              id="team-name"
              placeholder="Nombre del equipo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="team-shortname" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre Corto
            </Label>
            <Input
              id="team-shortname"
              placeholder="Abreviatura (ej: BAR, RMA)"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              disabled={loading}
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="team-logo" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              URL del Logo
            </Label>
            <Input
              id="team-logo"
              placeholder="https://ejemplo.com/logo.png"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              disabled={loading}
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Deporte <span style={{ color: 'var(--accent-red)' }}>*</span>
            </Label>
            <Select value={sportId} onValueChange={setSportId} disabled={loading || loadingSports}>
              <SelectTrigger
                className="w-full"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              >
                <SelectValue placeholder={loadingSports ? 'Cargando...' : 'Seleccionar deporte'} />
              </SelectTrigger>
              <SelectContent>
                {sports.map((sport) => (
                  <SelectItem key={sport.id} value={sport.id}>
                    <span className="mr-1.5">{sport.icon}</span>
                    {sport.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {error && (
            <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
              style={{
                borderColor: 'var(--border-custom)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? undefined : 'var(--accent)',
                color: '#fff',
              }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Crear Equipo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}