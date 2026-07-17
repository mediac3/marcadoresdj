'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Usuario y contraseña son requeridos');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{
        success: boolean;
        token: string;
        user: { id: string; username: string; name: string | null; role: string };
      }>('/api/auth/login', { username: username.trim(), password });

      if (res.success && res.token && res.user) {
        // Store directly in localStorage and reload
        localStorage.setItem('marcadoresdj-token', res.token);
        localStorage.setItem('marcadoresdj-user', JSON.stringify(res.user));
        window.location.reload();
      } else {
        setError('Respuesta inválida del servidor');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            🏆
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            MarcadoresDJ
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Marcadores en Tiempo Real
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-xl border p-6"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="username"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 text-base"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 text-base"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm font-medium" style={{ color: 'var(--accent-red, #ef4444)' }}>
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full text-sm font-semibold"
              style={{
                background: loading ? undefined : 'var(--accent)',
                color: '#fff',
              }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </div>

        <p
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          MarcadoresDJ v1.1
        </p>
      </div>
    </div>
  );
}