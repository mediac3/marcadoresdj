#!/usr/bin/env python3
"""Refactor public-view.tsx: Extract expanded content from EventCard into ExpandedEventPanel."""

filepath = '/home/z/my-project/src/components/public/public-view.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# 1. Find exact boundaries
eventcard_start = content.index('function EventCard({')
finished_marker = '/* ════════════════════════════════════════════════════════════════════════════\n   FINISHED SECTION'
finished_idx = content.index(finished_marker)
eventcard_end = content.rfind('}\n', eventcard_start, finished_idx) + 2

# 2. Build new EventCard + ExpandedEventPanel
new_components = r'''function EventCard({
  event,
  isExpanded,
  liveElapsed,
  onClick,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  event: PublicEvent;
  isExpanded: boolean;
  liveElapsed: number | null;
  onClick: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const isLive = event.status === 'LIVE';
  const isPaused = event.status === 'PAUSED';
  const showScore = isLive || isPaused;

  const teamA = event.teamA;
  const teamB = event.teamB;

  return (
    <div
      className="rounded-lg transition-colors"
      style={{
        background: isExpanded ? 'var(--accent)' : (selectionMode && selected ? 'rgba(225, 29, 72, 0.06)' : 'var(--bg-card)'),
        border: isExpanded ? '2px solid var(--accent)' : (selectionMode && selected ? '2px solid var(--accent)' : '1px solid var(--border-custom)'),
        boxShadow: isExpanded ? '0 0 0 1px var(--accent)' : 'var(--shadow)',
      }}
    >
      {selectionMode && (
        <div
          className="flex items-center px-3 py-2 border-b"
          style={{ borderColor: selected ? 'transparent' : 'var(--border-custom)' }}
        >
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(event.id); }}
          >
            {selected ? (
              <CheckSquare className="size-5" style={{ color: 'var(--accent)' }} />
            ) : (
              <Square className="size-5" style={{ color: 'var(--text-muted)' }} />
            )}
            <span className="text-xs font-medium" style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>
              {selected ? 'Seleccionado' : 'Seleccionar'}
            </span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="w-full text-left p-4 gap-3 flex flex-col"
        onClick={selectionMode ? () => onToggleSelect?.(event.id) : onClick}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg" aria-hidden="true">{event.sport?.icon ?? '\U0001f3c6'}</span>
          {event.tournamentName && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-semibold"
              style={{ borderColor: isExpanded ? 'rgba(255,255,255,0.5)' : 'var(--accent)', color: isExpanded ? '#fff' : 'var(--accent)' }}>
              <Trophy className="size-3 mr-1" />{event.tournamentName}
            </Badge>
          )}
          {event.phase && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5"
              style={{ background: isExpanded ? 'rgba(255,255,255,0.2)' : undefined, color: isExpanded ? '#fff' : undefined }}>
              {event.phase}
            </Badge>
          )}
          {isLive && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
              style={{ color: isExpanded ? '#fff' : 'var(--accent-red)' }}>
              <span className="live-dot inline-block size-2 rounded-full" style={{ background: isExpanded ? '#fff' : 'var(--live-dot)' }} />
              En Vivo
            </span>
          )}
          {isPaused && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ color: isExpanded ? '#fff' : 'var(--accent-yellow)' }}>
              <span className="inline-block size-2 rounded-full" style={{ background: isExpanded ? '#fff' : 'var(--accent-yellow)' }} />
              Pausado
            </span>
          )}
          {event.streamingUrl && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold ml-1"
              style={{ color: isExpanded ? '#fff' : 'var(--accent)' }} title="Transmision disponible">
              <Video className="size-3" />
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex-1 min-w-0 text-right">
            <p className="font-bold text-sm sm:text-base"
              style={{ color: isExpanded ? '#fff' : 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}
              title={teamA?.name || ''}>{getTeamLabel(teamA)}</p>
          </div>
          {showScore ? (
            <div className="flex flex-col items-center px-3 shrink-0">
              <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none"
                style={{ color: isExpanded ? '#fff' : 'var(--score-green)' }}>{event.scoreA} - {event.scoreB}</p>
              {(isLive || isPaused) && (
                <p className="text-xs font-bold tabular-nums mt-1 flex items-center gap-1"
                  style={{ color: isExpanded ? 'rgba(255,255,255,0.9)' : (isLive ? 'var(--accent-red)' : 'var(--accent-yellow)') }}>
                  <Clock className="size-3" />
                  {formatTimer(isLive && liveElapsed != null ? liveElapsed : event.elapsedSeconds)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center px-3 shrink-0">
              <p className="text-xs flex items-center gap-1"
                style={{ color: isExpanded ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)' }}>
                <Calendar className="size-3" />{formatScheduledDate(event.scheduledAt)}
              </p>
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="font-bold text-sm sm:text-base"
              style={{ color: isExpanded ? '#fff' : 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}
              title={teamB?.name || ''}>{getTeamLabel(teamB)}</p>
          </div>
        </div>
        <div className="flex items-center mt-2"
          style={{ color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
          {(event.city || event.department || event.country || event.location) && (
            <span className="text-xs flex items-center gap-1 truncate"
              style={{ color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
              <MapPin className="size-3 shrink-0" />
              {[event.city?.name, event.department?.name, event.country?.name, event.location].filter(Boolean).join(' \u00b7 ')}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   EXPANDED EVENT PANEL (below tabs, full width)
   ════════════════════════════════════════════════════════════════════════════ */

function ExpandedEventPanel({
  event, expandedData, expandedLoading, liveElapsed, onClose, fingerprint,
}: {
  event: PublicEvent; expandedData: ExpandedData | null; expandedLoading: boolean;
  liveElapsed: number | null; onClose: () => void; fingerprint: string;
}) {
  const eventAds = useLocationAds(event.city?.id, !!expandedData?.streamingUrl);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const isLive = event.status === 'LIVE';
  const isPaused = event.status === 'PAUSED';
  const showScore = isLive || isPaused;

  const actionMap = useMemo(() => {
    const map = new Map<string, DetailAction>();
    if (expandedData) { for (const a of expandedData.actions) map.set(a.id, a); }
    return map;
  }, [expandedData]);

  useEffect(() => {
    if (expandedData?.comments.length) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [expandedData?.comments.length]);

  const summaryA = useMemo(() => {
    if (!expandedData) return [];
    return expandedData.actions
      .filter((a) => isGoalOrCard(a, expandedData.sportName) && a.player?.teamId === event.teamAId)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [expandedData, event.teamAId]);

  const summaryB = useMemo(() => {
    if (!expandedData) return [];
    return expandedData.actions
      .filter((a) => isGoalOrCard(a, expandedData.sportName) && a.player?.teamId === event.teamBId)
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [expandedData, event.teamBId]);

  const commentsChronological = useMemo(() => {
    if (!expandedData) return [];
    return [...expandedData.comments].reverse();
  }, [expandedData]);

  const eventName = event.name || (event.teamA && event.teamB ? `${event.teamA.name} vs ${event.teamB.name}` : '\u2014');

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-custom)', boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b" style={{ borderColor: 'var(--border-custom)' }}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)', margin: 0 }}>{eventName}</h3>
          {(event.tournamentName || event.phase) && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)', margin: 0 }}>
              {[event.tournamentName, event.phase].filter(Boolean).join(' \u00b7 ')}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="size-8 ml-3 shrink-0 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }} aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {expandedLoading ? (
          <div className="py-8 space-y-4">
            <Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ) : expandedData ? (
          <>
            <div className="rounded-lg p-4 sm:p-5 text-center" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-extrabold text-lg sm:text-2xl truncate" style={{ color: 'var(--text-primary)' }}>{expandedData.teamAName}</p>
                </div>
                <div className="shrink-0 text-center">
                  {showScore ? (
                    <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none" style={{ color: 'var(--score-green)' }}>
                      {event.scoreA} - {event.scoreB}
                    </p>
                  ) : null}
                  {(isLive || isPaused) && (
                    <p className="text-sm font-bold tabular-nums mt-2 flex items-center justify-center gap-1"
                      style={{ color: isLive ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
                      <Clock className="size-3.5" />
                      {formatTimer(isLive && liveElapsed != null ? liveElapsed : event.elapsedSeconds)}
                      {event.currentHalf && (
                        <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                          {event.currentHalf === '1' && '1er Tiempo'}{event.currentHalf === '2' && '2do Tiempo'}
                          {event.currentHalf === '1Q' && '1er Cuarto'}{event.currentHalf === '2Q' && '2do Cuarto'}
                          {event.currentHalf === '3Q' && '3er Cuarto'}{event.currentHalf === '4Q' && '4to Cuarto'}
                          {event.currentHalf === 'OT' && 'Tiempo Extra'}{event.currentHalf === 'PT' && 'Penales'}
                          {!['1','2','1Q','2Q','3Q','4Q','OT','PT'].includes(event.currentHalf) && event.currentHalf}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-extrabold text-lg sm:text-2xl truncate" style={{ color: 'var(--text-primary)' }}>{expandedData.teamBName}</p>
                </div>
              </div>
            </div>
            {expandedData.streamingUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="size-4" style={{ color: 'var(--accent)' }} />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Transmision en Vivo</h4>
                </div>
                <div className="relative w-full overflow-hidden rounded-lg" style={{ background: '#000', aspectRatio: '16 / 9' }}>
                  <StreamingEmbed streamingUrl={expandedData.streamingUrl} />
                  <AdOverlay position="top" ads={eventAds.top} fingerprint={fingerprint} />
                  <AdOverlay position="bottom" ads={eventAds.bottom} fingerprint={fingerprint} />
                  <AdOverlay position="left" ads={eventAds.left} fingerprint={fingerprint} />
                  <AdOverlay position="right" ads={eventAds.right} fingerprint={fingerprint} />
                </div>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <span>💬 Comentarios en vivo</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{commentsChronological.length}</span>
              </h4>
              <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-lg p-2" style={{ background: 'var(--bg-secondary)' }}>
                {commentsChronological.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No hay comentarios aún</p>
                ) : commentsChronological.map((c) => (
                  <CommentRow key={c.id} comment={c} actionMap={actionMap} sportName={expandedData.sportName}
                    teamAId={expandedData.teamAId} teamBId={expandedData.teamBId}
                    teamAName={expandedData.teamAName} teamBName={expandedData.teamBName} />
                ))}
                <div ref={commentsEndRef} />
              </div>
            </div>
            {(summaryA.length > 0 || summaryB.length > 0) && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>📋 Resumen de acciones</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--accent)' }}>{expandedData.teamAName}</p>
                    {summaryA.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm" aria-hidden="true">{a.actionIcon}</span>
                        <span className="font-bold tabular-nums min-w-[24px]">{a.minute != null ? `${a.minute}'` : ''}</span>
                        <span className="truncate">{a.player?.name ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--accent)' }}>{expandedData.teamBName}</p>
                    {summaryB.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-sm" aria-hidden="true">{a.actionIcon}</span>
                        <span className="font-bold tabular-nums min-w-[24px]">{a.minute != null ? `${a.minute}'` : ''}</span>
                        <span className="truncate">{a.player?.name ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

'''

content = content[:eventcard_start] + new_components + content[eventcard_end:]

# 3. Update EventCard usage in the grid
old_usage = 'expanded={expandedId === evt.id}\n                  expandedData={expandedId === evt.id ? expandedData : null}\n                  expandedLoading={\n                    expandedId === evt.id ? expandedLoading : false\n                  }\n                  liveElapsed={getLiveElapsed(evt)}\n                  onToggle={() => handleToggle(evt.id)}'
new_usage = 'isExpanded={expandedId === evt.id}\n                  liveElapsed={getLiveElapsed(evt)}\n                  onClick={() => handleToggle(evt.id)}'
content = content.replace(old_usage, new_usage)

# Remove fingerprint prop from card
content = content.replace(
    'onToggleSelect={toggleSelect}\n                  fingerprint={fingerprint}\n                />',
    'onToggleSelect={toggleSelect}\n                />'
)

# 4. Insert ExpandedEventPanel below tabs, before MAIN CONTENT
old_main_content = '      {/* ── MAIN CONTENT ── */}\n      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-3">'
new_main_content = '''      {/* ── EXPANDED EVENT PANEL (below tabs, full width) ── */}
      {expandedEvent && (
        <div className="px-4 sm:px-6 py-3">
          <div className="max-w-4xl mx-auto">
            <ExpandedEventPanel
              event={expandedEvent}
              expandedData={expandedData}
              expandedLoading={expandedLoading}
              liveElapsed={expandedEvent.status === 'LIVE' ? getLiveElapsed(expandedEvent) : null}
              onClose={() => handleToggle(expandedEvent.id)}
              fingerprint={fingerprint}
            />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 space-y-3">'''
content = content.replace(old_main_content, new_main_content)

with open(filepath, 'w') as f:
    f.write(content)

print("Refactor complete!")