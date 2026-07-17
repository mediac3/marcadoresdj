'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe,
  ChevronDown,
  ChevronRight,
  Upload,
  Plus,
  X,
  MapPin,
  Trash2,
  Building2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiDelete } from '@/lib/api';
import { ImportLocationsModal } from '@/components/locations/import-locations-modal';
import { CreateLocationModal } from '@/components/locations/create-location-modal';

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

interface City {
  id: string;
  name: string;
  departmentId: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

/**
 * Returns a flag emoji for a 2-letter country code.
 * Falls back to 🌐 if the code is missing or invalid.
 */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const base = 0x1f1e6;
  const chars = code.toUpperCase().split('').map((c) => {
    const offset = c.charCodeAt(0) - 65; // 'A' = 65
    if (offset < 0 || offset > 25) return '🌐';
    return String.fromCodePoint(base + offset);
  });
  return chars.join('');
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function LocationsPanel() {
  const { toast } = useToast();

  /* ── Modal state ────────────────────────────────────────────────────────── */
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /* ── Countries ──────────────────────────────────────────────────────────── */
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  /* ── Expanded rows & loaded children ────────────────────────────────────── */
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const [departmentsMap, setDepartmentsMap] = useState<Record<string, Department[]>>({});
  const [citiesMap, setCitiesMap] = useState<Record<string, City[]>>({});

  const [loadingDepts, setLoadingDepts] = useState<Set<string>>(new Set());
  const [loadingCities, setLoadingCities] = useState<Set<string>>(new Set());

  /* ── Delete tracking ────────────────────────────────────────────────────── */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Fetch countries ────────────────────────────────────────────────────── */
  const fetchCountries = useCallback(async () => {
    setLoadingCountries(true);
    try {
      const data = await apiGet<{ countries: Country[] }>(
        '/api/locations?type=countries',
      );
      setCountries(data.countries ?? []);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los países.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCountries(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  /* ── Toggle country expansion ───────────────────────────────────────────── */
  const toggleCountry = useCallback(
    async (countryId: string) => {
      setExpandedCountries((prev) => {
        const next = new Set(prev);
        if (next.has(countryId)) {
          next.delete(countryId);
          // Also collapse all departments for this country
          setExpandedDepts((dPrev) => {
            const dNext = new Set(dPrev);
            const depts = departmentsMap[countryId] ?? [];
            depts.forEach((d) => dNext.delete(d.id));
            return dNext;
          });
        } else {
          next.add(countryId);
        }
        return next;
      });

      // Fetch departments if not yet loaded
      if (!departmentsMap[countryId]) {
        setLoadingDepts((prev) => {
          const next = new Set(prev);
          next.add(countryId);
          return next;
        });
        try {
          const data = await apiGet<{ departments: Department[] }>(
            `/api/locations?type=departments&countryId=${encodeURIComponent(countryId)}`,
          );
          setDepartmentsMap((prev) => ({
            ...prev,
            [countryId]: data.departments ?? [],
          }));
        } catch {
          toast({
            title: 'Error',
            description: 'No se pudieron cargar los departamentos.',
            variant: 'destructive',
          });
        } finally {
          setLoadingDepts((prev) => {
            const next = new Set(prev);
            next.delete(countryId);
            return next;
          });
        }
      }
    },
    [departmentsMap, toast],
  );

  /* ── Toggle department expansion ────────────────────────────────────────── */
  const toggleDepartment = useCallback(
    async (deptId: string) => {
      setExpandedDepts((prev) => {
        const next = new Set(prev);
        if (next.has(deptId)) {
          next.delete(deptId);
        } else {
          next.add(deptId);
        }
        return next;
      });

      if (!citiesMap[deptId]) {
        setLoadingCities((prev) => {
          const next = new Set(prev);
          next.add(deptId);
          return next;
        });
        try {
          const data = await apiGet<{ cities: City[] }>(
            `/api/locations?type=cities&departmentId=${encodeURIComponent(deptId)}`,
          );
          setCitiesMap((prev) => ({
            ...prev,
            [deptId]: data.cities ?? [],
          }));
        } catch {
          toast({
            title: 'Error',
            description: 'No se pudieron cargar las ciudades.',
            variant: 'destructive',
          });
        } finally {
          setLoadingCities((prev) => {
            const next = new Set(prev);
            next.delete(deptId);
            return next;
          });
        }
      }
    },
    [citiesMap, toast],
  );

  /* ── Delete handlers ────────────────────────────────────────────────────── */
  const handleDeleteCountry = useCallback(
    async (country: Country) => {
      setDeletingId(country.id);
      try {
        await apiDelete(
          `/api/locations?type=country&id=${encodeURIComponent(country.id)}`,
        );
        setCountries((prev) => prev.filter((c) => c.id !== country.id));
        // Clear cached departments
        setDepartmentsMap((prev) => {
          const next = { ...prev };
          delete next[country.id];
          return next;
        });
        setExpandedCountries((prev) => {
          const next = new Set(prev);
          next.delete(country.id);
          return next;
        });
        toast({
          title: 'País eliminado',
          description: `"${country.name}" fue eliminado correctamente.`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al eliminar el país.';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [toast],
  );

  const handleDeleteDepartment = useCallback(
    async (dept: Department) => {
      setDeletingId(dept.id);
      try {
        await apiDelete(
          `/api/locations?type=department&id=${encodeURIComponent(dept.id)}`,
        );
        // Remove from parent country's departments
        setDepartmentsMap((prev) => {
          const parentDepts = prev[dept.countryId] ?? [];
          return {
            ...prev,
            [dept.countryId]: parentDepts.filter((d) => d.id !== dept.id),
          };
        });
        // Clear cached cities for this department
        setCitiesMap((prev) => {
          const next = { ...prev };
          delete next[dept.id];
          return next;
        });
        setExpandedDepts((prev) => {
          const next = new Set(prev);
          next.delete(dept.id);
          return next;
        });
        toast({
          title: 'Departamento eliminado',
          description: `"${dept.name}" fue eliminado correctamente.`,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Error al eliminar el departamento.';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [toast],
  );

  const handleDeleteCity = useCallback(
    async (city: City) => {
      setDeletingId(city.id);
      try {
        await apiDelete(
          `/api/locations?type=city&id=${encodeURIComponent(city.id)}`,
        );
        // Remove from parent department's cities
        setCitiesMap((prev) => {
          const parentCities = prev[city.departmentId] ?? [];
          return {
            ...prev,
            [city.departmentId]: parentCities.filter((c) => c.id !== city.id),
          };
        });
        toast({
          title: 'Ciudad eliminada',
          description: `"${city.name}" fue eliminada correctamente.`,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al eliminar la ciudad.';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [toast],
  );

  /* ── Render helpers ─────────────────────────────────────────────────────── */

  const isDeleting = (id: string) => deletingId === id;

  /* ── Skeleton for initial load ──────────────────────────────────────────── */

  if (loadingCountries) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <Skeleton
            className="h-8 w-40"
            style={{ background: 'var(--bg-card)' }}
          />
          <Skeleton
            className="h-9 w-36"
            style={{ background: 'var(--bg-card)' }}
          />
        </div>
        {/* Rows skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-14 w-full rounded-lg"
              style={{ background: 'var(--bg-card)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Globe
            className="h-5 w-5"
            style={{ color: 'var(--accent)' }}
          />
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Ubicaciones
          </h2>
          <Badge
            variant="secondary"
            className="ml-1 text-xs"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-custom)',
            }}
          >
            {countries.length} {countries.length === 1 ? 'país' : 'países'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="gap-2"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
              background: 'transparent',
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Crear</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-2"
            style={{
              borderColor: 'var(--border-custom)',
              color: 'var(--text-primary)',
              background: 'transparent',
            }}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
        </div>
      </div>

      {/* ── Countries List ───────────────────────────────────────────────── */}
      {countries.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border py-16"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-custom)',
          }}
        >
          <Globe
            className="mb-3 h-10 w-10"
            style={{ color: 'var(--text-muted)' }}
          />
          <p
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            No hay ubicaciones importadas.
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Usa el botón &quot;Importar&quot; para agregar países, departamentos y ciudades.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {countries.map((country) => {
            const isExpanded = expandedCountries.has(country.id);
            const departments = departmentsMap[country.id] ?? [];
            const isLoadingDepts = loadingDepts.has(country.id);

            return (
              <div key={country.id}>
                {/* ── Country Row ──────────────────────────────────────── */}
                <div
                  className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                  style={{
                    background: isExpanded
                      ? 'var(--bg-card-hover)'
                      : 'var(--bg-card)',
                    borderColor: 'var(--border-custom)',
                  }}
                >
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCountry(country.id)}
                    className="flex-shrink-0 rounded p-1 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label={
                      isExpanded
                        ? `Colapsar ${country.name}`
                        : `Expandir ${country.name}`
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {/* Flag + Name */}
                  <span className="mr-1 text-lg leading-none">
                    {countryFlag(country.code)}
                  </span>
                  <span
                    className="flex-1 truncate text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {country.name}
                  </span>

                  {/* Department count badge */}
                  {isExpanded && !isLoadingDepts && departments.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                        borderColor: 'var(--border-custom)',
                      }}
                    >
                      {departments.length}
                    </Badge>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCountry(country);
                    }}
                    disabled={isDeleting(country.id)}
                    className="flex-shrink-0 rounded p-1.5 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-60 focus:opacity-100"
                    style={{ color: 'var(--accent-red)' }}
                    aria-label={`Eliminar ${country.name}`}
                  >
                    {isDeleting(country.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* ── Departments (expanded) ────────────────────────────── */}
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {isLoadingDepts ? (
                      <div className="space-y-1 py-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton
                            key={i}
                            className="h-10 w-full rounded-md"
                            style={{ background: 'var(--bg-card)' }}
                          />
                        ))}
                      </div>
                    ) : departments.length === 0 ? (
                      <p
                        className="py-3 text-center text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Sin departamentos
                      </p>
                    ) : (
                      departments.map((dept) => {
                        const isDeptExpanded = expandedDepts.has(dept.id);
                        const cities = citiesMap[dept.id] ?? [];
                        const isLoadingCits = loadingCities.has(dept.id);

                        return (
                          <div key={dept.id}>
                            {/* ── Department Row ────────────────────────── */}
                            <div
                              className="group flex items-center gap-2.5 rounded-md border px-3 py-2 transition-colors"
                              style={{
                                background: isDeptExpanded
                                  ? 'var(--bg-card-hover)'
                                  : 'var(--bg-card)',
                                borderColor: 'var(--border-custom)',
                              }}
                            >
                              {/* Expand toggle */}
                              <button
                                type="button"
                                onClick={() => toggleDepartment(dept.id)}
                                className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-80"
                                style={{ color: 'var(--text-secondary)' }}
                                aria-label={
                                  isDeptExpanded
                                    ? `Colapsar ${dept.name}`
                                    : `Expandir ${dept.name}`
                                }
                              >
                                {isDeptExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>

                              {/* Icon + Name */}
                              <Building2
                                className="h-3.5 w-3.5 flex-shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              />
                              <span
                                className="flex-1 truncate text-sm"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {dept.name}
                              </span>

                              {/* City count badge */}
                              {isDeptExpanded &&
                                !isLoadingCits &&
                                cities.length > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                    style={{
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-muted)',
                                      borderColor: 'var(--border-custom)',
                                    }}
                                  >
                                    {cities.length}
                                  </Badge>
                                )}

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDepartment(dept);
                                }}
                                disabled={isDeleting(dept.id)}
                                className="flex-shrink-0 rounded p-1.5 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-60 focus:opacity-100"
                                style={{ color: 'var(--accent-red)' }}
                                aria-label={`Eliminar ${dept.name}`}
                              >
                                {isDeleting(dept.id) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>

                            {/* ── Cities (expanded) ─────────────────────── */}
                            {isDeptExpanded && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {isLoadingCits ? (
                                  <div className="space-y-0.5 py-2">
                                    {Array.from({ length: 2 }).map((_, i) => (
                                      <Skeleton
                                        key={i}
                                        className="h-8 w-full rounded-md"
                                        style={{ background: 'var(--bg-card)' }}
                                      />
                                    ))}
                                  </div>
                                ) : cities.length === 0 ? (
                                  <p
                                    className="py-2 text-center text-xs"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    Sin ciudades
                                  </p>
                                ) : (
                                  cities.map((city) => (
                                    <div
                                      key={city.id}
                                      className="group flex items-center gap-2.5 rounded-md border px-3 py-1.5 transition-colors"
                                      style={{
                                        background: 'var(--bg-card)',
                                        borderColor: 'var(--border-custom)',
                                      }}
                                    >
                                      <MapPin
                                        className="h-3 w-3 flex-shrink-0"
                                        style={{ color: 'var(--text-muted)' }}
                                      />
                                      <span
                                        className="flex-1 truncate text-sm"
                                        style={{ color: 'var(--text-primary)' }}
                                      >
                                        {city.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCity(city)}
                                        disabled={isDeleting(city.id)}
                                        className="flex-shrink-0 rounded p-1.5 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-60 focus:opacity-100"
                                        style={{ color: 'var(--accent-red)' }}
                                        aria-label={`Eliminar ${city.name}`}
                                      >
                                        {isDeleting(city.id) ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <X className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      <ImportLocationsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          setImportModalOpen(false);
          // Reset expanded state and cached data, then refetch
          setExpandedCountries(new Set());
          setExpandedDepts(new Set());
          setDepartmentsMap({});
          setCitiesMap({});
          fetchCountries();
        }}
      />

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      <CreateLocationModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          // Reset expanded state and cached data, then refetch
          setExpandedCountries(new Set());
          setExpandedDepts(new Set());
          setDepartmentsMap({});
          setCitiesMap({});
          fetchCountries();
        }}
      />
    </div>
  );
}