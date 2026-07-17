'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
}

interface City {
  id: string;
  name: string;
}

interface LocationSelectorProps {
  countryId: string | null;
  departmentId: string | null;
  cityId: string | null;
  onCountryChange: (id: string | null) => void;
  onDepartmentChange: (id: string | null) => void;
  onCityChange: (id: string | null) => void;
  /** ISO 3166-1 alpha-2 code to auto-select on first load (e.g. 'CO') */
  defaultCountryCode?: string;
  disabled?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const ALL_VALUE = '__all__';

async function fetchCountries(): Promise<Country[]> {
  const res = await fetch('/api/locations?type=countries');
  if (!res.ok) throw new Error('Failed to fetch countries');
  const data = await res.json();
  return data.countries ?? [];
}

async function fetchDepartments(countryId: string): Promise<Department[]> {
  const res = await fetch(
    `/api/locations?type=departments&countryId=${encodeURIComponent(countryId)}`
  );
  if (!res.ok) throw new Error('Failed to fetch departments');
  const data = await res.json();
  return data.departments ?? [];
}

async function fetchCities(departmentId: string): Promise<City[]> {
  const res = await fetch(
    `/api/locations?type=cities&departmentId=${encodeURIComponent(departmentId)}`
  );
  if (!res.ok) throw new Error('Failed to fetch cities');
  const data = await res.json();
  return data.cities ?? [];
}

/* ── Shared styles ──────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.75rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.25rem',
};

const triggerStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderColor: 'var(--border-custom)',
  color: 'var(--text-primary)',
  width: '100%',
  height: '2.25rem',
  fontSize: '0.8125rem',
};

/* ── Component ──────────────────────────────────────────────────────────── */

export function LocationSelector({
  countryId,
  departmentId,
  cityId,
  onCountryChange,
  onDepartmentChange,
  onCityChange,
  defaultCountryCode,
  disabled,
}: LocationSelectorProps) {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [countries, setCountries] = useState<Country[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [errorDepartments, setErrorDepartments] = useState(false);
  const [errorCities, setErrorCities] = useState(false);

  const initializedRef = useState(false);

  /* ── Fetch countries on mount ───────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingCountries(true);
      try {
        const list = await fetchCountries();
        if (!cancelled) {
          setCountries(list);

          // Pre-select default country by ISO code if provided
          if (defaultCountryCode) {
            const match = list.find((c) => c.code === defaultCountryCode);
            if (match) {
              onCountryChange(match.id);
            }
          }

          initializedRef[0] = true;
        }
      } catch {
        // Silently fail – countries list will be empty
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Fetch departments when country changes ─────────────────────────── */
  useEffect(() => {
    if (!countryId || countryId === ALL_VALUE) {
      setDepartments([]);
      setCities([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingDepartments(true);
      setErrorDepartments(false);
      try {
        const list = await fetchDepartments(countryId!);
        if (!cancelled) setDepartments(list);
      } catch {
        if (!cancelled) setErrorDepartments(true);
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  /* ── Fetch cities when department changes ───────────────────────────── */
  useEffect(() => {
    if (!departmentId || departmentId === ALL_VALUE) {
      setCities([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingCities(true);
      setErrorCities(false);
      try {
        const list = await fetchCities(departmentId!);
        if (!cancelled) setCities(list);
      } catch {
        if (!cancelled) setErrorCities(true);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  /* ── Handlers ───────────────────────────────────────────────────────── */

  const handleCountryChange = useCallback(
    (value: string) => {
      if (value === ALL_VALUE) {
        onCountryChange(null);
        onDepartmentChange(null);
        onCityChange(null);
      } else {
        onCountryChange(value);
        onDepartmentChange(null);
        onCityChange(null);
      }
    },
    [onCountryChange, onDepartmentChange, onCityChange]
  );

  const handleDepartmentChange = useCallback(
    (value: string) => {
      if (value === ALL_VALUE) {
        onDepartmentChange(null);
        onCityChange(null);
      } else {
        onDepartmentChange(value);
        onCityChange(null);
      }
    },
    [onDepartmentChange, onCityChange]
  );

  const handleCityChange = useCallback(
    (value: string) => {
      if (value === ALL_VALUE) {
        onCityChange(null);
      } else {
        onCityChange(value);
      }
    },
    [onCityChange]
  );

  /* ── Derived values for controlled select ───────────────────────────── */
  const resolvedCountryValue =
    countryId && countryId !== ALL_VALUE ? countryId : ALL_VALUE;
  const resolvedDepartmentValue =
    departmentId && departmentId !== ALL_VALUE ? departmentId : ALL_VALUE;
  const resolvedCityValue =
    cityId && cityId !== ALL_VALUE ? cityId : ALL_VALUE;

  /* ── Render ─────────────────────────────────────────────────────────── */

  const isDisabled = disabled || false;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {/* ── Country ─────────────────────────────────────────────────── */}
      <div className="flex flex-col">
        <Label style={labelStyle}>País</Label>
        {loadingCountries ? (
          <Skeleton
            className="h-9 w-full rounded-md"
            style={{ background: 'var(--bg-card)' }}
          />
        ) : (
          <Select
            value={resolvedCountryValue}
            onValueChange={handleCountryChange}
            disabled={isDisabled}
          >
            <SelectTrigger
              style={triggerStyle}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="custom-scrollbar max-h-60">
              <SelectItem value={ALL_VALUE}>
                <span style={{ color: 'var(--text-muted)' }}>Todos</span>
              </SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Department / State ───────────────────────────────────────── */}
      <div className="flex flex-col">
        <Label style={labelStyle}>Departamento / Estado</Label>
        {!countryId || countryId === ALL_VALUE ? (
          <Select disabled value={ALL_VALUE}>
            <SelectTrigger
              style={{ ...triggerStyle, opacity: 0.5 }}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent />
          </Select>
        ) : loadingDepartments ? (
          <Skeleton
            className="h-9 w-full rounded-md"
            style={{ background: 'var(--bg-card)' }}
          />
        ) : errorDepartments ? (
          <Select disabled value={ALL_VALUE}>
            <SelectTrigger
              style={{ ...triggerStyle, opacity: 0.5 }}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue>
                <span style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>
                  Error al cargar
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        ) : (
          <Select
            value={resolvedDepartmentValue}
            onValueChange={handleDepartmentChange}
            disabled={isDisabled}
          >
            <SelectTrigger
              style={triggerStyle}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="custom-scrollbar max-h-60">
              <SelectItem value={ALL_VALUE}>
                <span style={{ color: 'var(--text-muted)' }}>Todos</span>
              </SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── City ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col">
        <Label style={labelStyle}>Ciudad</Label>
        {!departmentId || departmentId === ALL_VALUE ? (
          <Select disabled value={ALL_VALUE}>
            <SelectTrigger
              style={{ ...triggerStyle, opacity: 0.5 }}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent />
          </Select>
        ) : loadingCities ? (
          <Skeleton
            className="h-9 w-full rounded-md"
            style={{ background: 'var(--bg-card)' }}
          />
        ) : errorCities ? (
          <Select disabled value={ALL_VALUE}>
            <SelectTrigger
              style={{ ...triggerStyle, opacity: 0.5 }}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue>
                <span style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>
                  Error al cargar
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        ) : (
          <Select
            value={resolvedCityValue}
            onValueChange={handleCityChange}
            disabled={isDisabled}
          >
            <SelectTrigger
              style={triggerStyle}
              className="w-full"
              size="sm"
              data-color-scheme="dark"
            >
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="custom-scrollbar max-h-60">
              <SelectItem value={ALL_VALUE}>
                <span style={{ color: 'var(--text-muted)' }}>Todos</span>
              </SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}