'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Bot, User } from 'lucide-react';
import type { Comment } from '@/lib/store';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface CommentsPanelProps {
  eventId: string;
  comments: Comment[];
  onNewComment: (content: string) => void;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function CommentsPanel({ eventId, comments, onNewComment }: CommentsPanelProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reverse so newest is at the bottom
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Auto‑scroll to bottom when a new comment arrives
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Small delay to let the DOM update
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [comments.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onNewComment(trimmed);
      setText('');
    } catch {
      // Error is handled by the parent (toast)
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, sending, onNewComment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <section
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold shrink-0"
        style={{
          borderBottom: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
          color: 'var(--text-primary, #eee)',
        }}
      >
        💬 Comentarios del Partido
        <span
          className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--bg-card-hover, rgba(128,128,128,0.15))',
            color: 'var(--text-muted, #888)',
          }}
        >
          {comments.length}
        </span>
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ maxHeight: '280px', minHeight: '120px' }}
      >
        {sorted.length === 0 && (
          <p
            className="text-center text-xs py-6"
            style={{ color: 'var(--text-muted, #666)' }}
          >
            Aún no hay comentarios
          </p>
        )}
        {sorted.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            style={{
              background: c.isAI
                ? 'var(--bg-card-hover, rgba(128,128,128,0.08))'
                : 'transparent',
              border: c.isAI
                ? '1px solid var(--border-custom, rgba(128,128,128,0.1))'
                : '1px solid transparent',
            }}
          >
            {/* Icon */}
            <div
              className="mt-0.5 shrink-0 flex items-center justify-center size-6 rounded-full"
              style={{
                background: c.isAI
                  ? 'rgba(99,102,241,0.15)'
                  : 'var(--accent, #e11d48)20',
              }}
            >
              {c.isAI ? (
                <Bot className="size-3.5" style={{ color: '#818cf8' }} />
              ) : (
                <User className="size-3.5" style={{ color: 'var(--accent, #e11d48)' }} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-xs font-medium"
                  style={{ color: c.isAI ? '#818cf8' : 'var(--accent, #e11d48)' }}
                >
                  {c.isAI ? 'IA' : (c.user?.name || c.user?.username || 'Usuario')}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--text-muted, #666)' }}
                >
                  {formatTime(c.createdAt)}
                </span>
              </div>
              <p
                className="text-xs leading-relaxed break-words"
                style={{ color: 'var(--text-secondary, #ccc)' }}
              >
                {c.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{
          borderTop: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Agregar comentario..."
          className="flex-1 min-w-0 bg-transparent text-sm rounded-lg px-3 py-2 outline-none placeholder:opacity-50"
          style={{
            color: 'var(--text-primary, #eee)',
            border: '1px solid var(--border-custom, rgba(128,128,128,0.15))',
          }}
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex items-center justify-center size-9 rounded-lg transition-colors duration-150 disabled:opacity-40"
          style={{
            background: 'var(--accent, #e11d48)',
            color: '#fff',
          }}
          aria-label="Enviar comentario"
        >
          <Send className="size-4" />
        </button>
      </div>
    </section>
  );
}