'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2, Camera, ImagePlus, Trash2 } from 'lucide-react';
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
import { apiPost, apiPut } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Player } from '@/lib/store';

/* ── Position suggestions per sport ───────────────────────────────────────── */

const POSITIONS_BY_SPORT: Record<string, string[]> = {
  'Fútbol': ['Portero', 'Defensa', 'Lateral', 'Mediocampista', 'Delantero'],
  'Baloncesto': ['Base', 'Escolta', 'Alero', 'Ala-pívot', 'Pívot'],
  'Microfútbol': ['Portero', 'Cierre', 'Ala', 'Pívot'],
};

/* ── Props ─────────────────────────────────────────────────────────────────── */

interface PlayerModalProps {
  teamId: string;
  sportName?: string;
  player?: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function PlayerModal({ teamId, sportName, player, isOpen, onClose, onSave }: PlayerModalProps) {
  const isEdit = !!player;

  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [photo, setPhoto] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [nationality, setNationality] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const positionSuggestions = useMemo(() => {
    if (sportName && POSITIONS_BY_SPORT[sportName]) {
      return POSITIONS_BY_SPORT[sportName];
    }
    // Dedupe: e.g. "Portero" exists in both Fútbol and Microfútbol, and
    // duplicate keys crash the datalist render in dev (React same-key error).
    return [...new Set(Object.values(POSITIONS_BY_SPORT).flat())];
  }, [sportName]);

  // Pre-fill form when editing
  useEffect(() => {
    if (isOpen) {
      if (player) {
        setName(player.name);
        setNumber(String(player.number));
        setPosition(player.position);
        setPhoto(player.photo || '');
        setNickname(player.nickname || '');
        setBirthDate(player.birthDate || '');
        setNationality(player.nationality || '');
        setHeight(player.height || '');
        setWeight(player.weight || '');
      } else {
        setName('');
        setNumber('');
        setPosition('');
        setPhoto('');
        setNickname('');
        setBirthDate('');
        setNationality('');
        setHeight('');
        setWeight('');
      }
      setError('');
    }
  }, [player, isOpen]);

  function resetForm() {
    setName('');
    setNumber('');
    setPosition('');
    setPhoto('');
    setNickname('');
    setBirthDate('');
    setNationality('');
    setHeight('');
    setWeight('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const uploadFile = useCallback(async (file: File) => {
    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Error', description: 'Solo se permiten JPG, PNG, WEBP o GIF', variant: 'destructive' });
      return;
    }
    // Validate size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no debe superar 5 MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('marcadoresdj-token')}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al subir');
      }
      if (data.success && data.url) {
        setPhoto(data.url);
        toast({ title: 'Foto subida', description: 'La imagen se ha cargado correctamente.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  function removePhoto() {
    setPhoto('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    const num = Number(number);
    if (!number.trim() || !Number.isInteger(num) || num < 1) {
      setError('El número debe ser un entero positivo');
      return;
    }

    if (!position.trim()) {
      setError('La posición es requerida');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        number: num,
        position: position.trim(),
        photo: photo.trim() || null,
        nickname: nickname.trim() || null,
        birthDate: birthDate || null,
        nationality: nationality.trim() || null,
        height: height.trim() || null,
        weight: weight.trim() || null,
      };

      if (isEdit && player) {
        await apiPut(`/api/players/${player.id}`, payload);
        toast({ title: 'Jugador actualizado', description: `${name.trim()} se ha actualizado.` });
      } else {
        await apiPost(`/api/teams/${teamId}/players`, payload);
        toast({ title: 'Jugador agregado', description: `${name.trim()} se ha agregado al equipo.` });
      }

      resetForm();
      onClose();
      onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el jugador';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-custom)',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Editar Jugador' : 'Agregar Jugador'}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--text-muted)' }}>
            {isEdit ? 'Modifica los datos del jugador.' : 'Completa los datos para agregar un nuevo jugador.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-name" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Nombre <span style={{ color: 'var(--accent-red)' }}>*</span>
            </Label>
            <Input
              id="player-name"
              placeholder="Nombre completo"
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

          {/* Number + Position row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-number" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Número <span style={{ color: 'var(--accent-red)' }}>*</span>
              </Label>
              <Input
                id="player-number"
                type="number"
                min="1"
                step="1"
                placeholder="10"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-position" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Posición <span style={{ color: 'var(--accent-red)' }}>*</span>
              </Label>
              <Input
                id="player-position"
                list="position-suggestions"
                placeholder="Posición"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
              <datalist id="position-suggestions">
                {positionSuggestions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Foto del Jugador
            </Label>

            {/* Photo preview + buttons */}
            <div className="flex items-start gap-3">
              {/* Preview */}
              <div
                className="shrink-0 size-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
                style={{
                  borderColor: photo ? 'var(--accent)' : 'var(--border-custom)',
                  background: 'var(--bg-secondary)',
                }}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt="Foto del jugador"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>
                    🧑
                  </span>
                )}
              </div>

              {/* Upload buttons */}
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || loading}
                    style={{
                      borderColor: 'var(--border-custom)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                    Galería
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading || loading}
                    style={{
                      borderColor: 'var(--border-custom)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Camera className="size-3.5" />
                    Cámara
                  </Button>

                  {photo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={removePhoto}
                      disabled={loading}
                      style={{
                        borderColor: 'var(--border-custom)',
                        color: '#ef4444',
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {/* Camera input: capture="environment" for back camera, "user" for selfie */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  JPG, PNG, WEBP o GIF — Máximo 5 MB
                </p>
              </div>
            </div>

            {/* Alternative: URL field (collapsed by default) */}
            {!photo && (
              <details className="mt-1">
                <summary
                  className="text-[11px] cursor-pointer select-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  O ingresa una URL de imagen...
                </summary>
                <Input
                  className="mt-1.5"
                  placeholder="https://ejemplo.com/foto.jpg"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  disabled={loading || uploading}
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-custom)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                />
              </details>
            )}
          </div>

          {/* Nickname */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="player-nickname" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Apodo
            </Label>
            <Input
              id="player-nickname"
              placeholder="Apodo del jugador"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-custom)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Birth date + Nationality */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-birthdate" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Fecha de Nacimiento
              </Label>
              <Input
                id="player-birthdate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-nationality" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Nacionalidad
              </Label>
              <Input
                id="player-nationality"
                placeholder="Colombiana"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Height + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-height" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Estatura
              </Label>
              <Input
                id="player-height"
                placeholder="1.75 m"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="player-weight" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Peso
              </Label>
              <Input
                id="player-weight"
                placeholder="70 kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={loading}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-custom)',
                  color: 'var(--text-primary)',
                }}
              />
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
              onClick={handleClose}
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
              {isEdit ? 'Guardar Cambios' : 'Agregar Jugador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}