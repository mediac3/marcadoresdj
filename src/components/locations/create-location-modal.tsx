'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Globe, Building2, MapPin, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  countryId: string;
}

type CreateStep = 'country' | 'department' | 'city';

/* ── Component ─────────────────────────────────────────────────────────────── */

interface CreateLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateLocationModal({ open, onOpenChange, onSuccess }: CreateLocationModalProps) {
  const { toast } = useToast();

  /* ── Step state ── */
  const [step, setStep] = useState<CreateStep>('country');

  /* ── Country form ── */
  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [creatingCountry, setCreatingCountry] = useState(false);

  /* ── Department form ── */
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);

  /* ── City form ── */
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [cityName, setCityName] = useState('');
  const [creatingCity, setCreatingCity] = useState(false);

  /* ── Fetch countries when modal opens or step changes ── */
  const fetchCountries = useCallback(async () => {
    try {
      const data = await apiGet<{ countries: Country[] }>('/api/locations?type=countries');
      setCountries(data.countries ?? []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los países.', variant: 'destructive' });
    }
  }, [toast]);

  const fetchDepartments = useCallback(async (countryId: string) => {
    setDepartments([]);
    setSelectedDeptId('');
    if (!countryId) return;
    try {
      const data = await apiGet<{ departments: Department[] }>(
        `/api/locations?type=departments&countryId=${encodeURIComponent(countryId)}`,
      );
      setDepartments(data.departments ?? []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los departamentos.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      resetForm();
      fetchCountries();
    }
  }, [open, fetchCountries]);

  useEffect(() => {
    if (selectedCountryId) fetchDepartments(selectedCountryId);
  }, [selectedCountryId, fetchDepartments]);

  /* ── Reset ── */
  function resetForm() {
    setStep('country');
    setCountryName('');
    setCountryCode('');
    setSelectedCountryId('');
    setDeptName('');
    setSelectedDeptId('');
    setCityName('');
    setDepartments([]);
  }

  /* ── Create handlers ── */
  async function handleCreateCountry() {
    if (!countryName.trim() || !countryCode.trim()) return;
    setCreatingCountry(true);
    try {
      await apiPost('/api/locations', { type: 'country', name: countryName.trim(), code: countryCode.trim() });
      toast({ title: 'País creado', description: `"${countryName.trim()}" fue creado correctamente.` });
      setCountryName('');
      setCountryCode('');
      fetchCountries();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear el país.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreatingCountry(false);
    }
  }

  async function handleCreateDepartment() {
    if (!selectedCountryId || !deptName.trim()) return;
    setCreatingDept(true);
    try {
      await apiPost('/api/locations', { type: 'department', name: deptName.trim(), countryId: selectedCountryId });
      toast({ title: 'Departamento creado', description: `"${deptName.trim()}" fue creado correctamente.` });
      setDeptName('');
      if (selectedCountryId) fetchDepartments(selectedCountryId);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear el departamento.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreatingDept(false);
    }
  }

  async function handleCreateCity() {
    if (!selectedDeptId || !cityName.trim()) return;
    setCreatingCity(true);
    try {
      await apiPost('/api/locations', { type: 'city', name: cityName.trim(), departmentId: selectedDeptId });
      toast({ title: 'Ciudad creada', description: `"${cityName.trim()}" fue creada correctamente.` });
      setCityName('');
      if (selectedCountryId) fetchDepartments(selectedCountryId);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear la ciudad.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreatingCity(false);
    }
  }

  if (!open) return null;

  const stepConfig: { key: CreateStep; label: string; icon: typeof Globe }[] = [
    { key: 'country', label: 'País', icon: Globe },
    { key: 'department', label: 'Departamento', icon: Building2 },
    { key: 'city', label: 'Ciudad', icon: MapPin },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="rounded-xl overflow-hidden w-full max-w-md"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-custom)' }}
        >
          <div className="flex items-center gap-2">
            <Plus className="size-5" style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Crear Ubicación
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-7 flex items-center justify-center rounded-full transition-colors"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Step selector ── */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-custom)' }}>
          {stepConfig.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                className="flex-1 py-3 text-center text-xs font-semibold transition-colors relative"
                style={{
                  color: step === s.key ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Icon className="size-3.5" />
                  {s.label}
                </span>
                {step === s.key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Form body ── */}
        <div className="p-5 space-y-4">
          {/* COUNTRY FORM */}
          {step === 'country' && (
            <>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nombre del país *
                </label>
                <input
                  type="text"
                  value={countryName}
                  onChange={(e) => setCountryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCountry(); }}
                  placeholder="Ej: Colombia"
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Código (ISO 2 letras) *
                </label>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCountry(); }}
                  placeholder="Ej: CO"
                  maxLength={2}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none uppercase"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <Button
                onClick={handleCreateCountry}
                disabled={creatingCountry || !countryName.trim() || !countryCode.trim()}
                className="w-full h-9 text-xs font-bold gap-2"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {creatingCountry ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Crear País
              </Button>
            </>
          )}

          {/* DEPARTMENT FORM */}
          {step === 'department' && (
            <>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  País *
                </label>
                <select
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Seleccionar país...</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nombre del departamento *
                </label>
                <input
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDepartment(); }}
                  placeholder="Ej: Antioquia"
                  disabled={!selectedCountryId}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none disabled:opacity-50"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              </div>
              <Button
                onClick={handleCreateDepartment}
                disabled={creatingDept || !selectedCountryId || !deptName.trim()}
                className="w-full h-9 text-xs font-bold gap-2"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {creatingDept ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Crear Departamento
              </Button>
            </>
          )}

          {/* CITY FORM */}
          {step === 'city' && (
            <>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  País *
                </label>
                <select
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Seleccionar país...</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Departamento *
                </label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  disabled={!selectedCountryId}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none appearance-none disabled:opacity-50"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Seleccionar departamento...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nombre de la ciudad *
                </label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCity(); }}
                  placeholder="Ej: Medellín"
                  disabled={!selectedDeptId}
                  className="w-full h-9 rounded-lg px-3 text-sm outline-none disabled:opacity-50"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-custom)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              </div>
              <Button
                onClick={handleCreateCity}
                disabled={creatingCity || !selectedDeptId || !cityName.trim()}
                className="w-full h-9 text-xs font-bold gap-2"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {creatingCity ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Crear Ciudad
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}