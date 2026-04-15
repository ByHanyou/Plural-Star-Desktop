import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, HistoryEntry, ChatMessage, fmtDur, getInitials } from '../utils';
import { Section } from '../components/ui';
import { store, chatMsgKey, KEYS } from '../storage';
import type { ChatChannel } from '../utils';

interface Props {
  history: HistoryEntry[];
  members: Member[];
  channels: ChatChannel[];
}

type TimeRange = 'all' | '7d' | '30d';

export default function StatsView({ history, members, channels }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>('all');
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});

  // Load chat counts once
  React.useEffect(() => {
    (async () => {
      const counts: Record<string, number> = {};
      for (const ch of channels) {
        const msgs = await store.get<ChatMessage[]>(chatMsgKey(ch.id), []);
        if (msgs) {
          for (const msg of msgs) {
            counts[msg.authorId] = (counts[msg.authorId] || 0) + 1;
          }
        }
      }
      setChatCounts(counts);
    })();
  }, [channels]);

  const getMember = (id: string) => members.find(m => m.id === id);

  const cutoff = useMemo(() => {
    if (range === '7d') return Date.now() - 7 * 86400000;
    if (range === '30d') return Date.now() - 30 * 86400000;
    return 0;
  }, [range]);

  const filtered = useMemo(() => {
    return history.filter(h => {
      if (!h.changeType || h.changeType === 'front') {
        return h.startTime >= cutoff || (h.endTime && h.endTime >= cutoff) || h.endTime === null;
      }
      return false;
    });
  }, [history, cutoff]);

  // ─── Calculations ──────────────────────────────────────────────────────

  const totalSessions = filtered.length;

  const fronterTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of filtered) {
      const start = Math.max(entry.startTime, cutoff);
      const end = entry.endTime || Date.now();
      const dur = end - start;
      for (const id of entry.memberIds) {
        map[id] = (map[id] || 0) + dur;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered, cutoff]);

  const coFrontTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of filtered) {
      const start = Math.max(entry.startTime, cutoff);
      const end = entry.endTime || Date.now();
      const dur = end - start;
      for (const id of (entry.coFrontIds || [])) {
        map[id] = (map[id] || 0) + dur;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered, cutoff]);

  const coConTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of filtered) {
      const start = Math.max(entry.startTime, cutoff);
      const end = entry.endTime || Date.now();
      const dur = end - start;
      for (const id of (entry.coConsciousIds || [])) {
        map[id] = (map[id] || 0) + dur;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered, cutoff]);

  const moodTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of filtered) {
      if (entry.mood) map[entry.mood] = (map[entry.mood] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const locationTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of filtered) {
      if (entry.location) map[entry.location] = (map[entry.location] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const chatSorted = useMemo(() => {
    return Object.entries(chatCounts).sort((a, b) => b[1] - a[1]);
  }, [chatCounts]);

  const totalTime = fronterTotals.reduce((a, [, d]) => a + d, 0);
  const totalMsgs = chatSorted.reduce((a, [, c]) => a + c, 0);

  // Energy averages per member
  const energyStats = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    for (const entry of filtered) {
      if (entry.energyLevel) {
        for (const id of entry.memberIds) {
          if (!map[id]) map[id] = { sum: 0, count: 0 };
          map[id].sum += entry.energyLevel;
          map[id].count++;
        }
      }
      if (entry.coFrontEnergy) {
        for (const id of (entry.coFrontIds || [])) {
          if (!map[id]) map[id] = { sum: 0, count: 0 };
          map[id].sum += entry.coFrontEnergy;
          map[id].count++;
        }
      }
    }
    return Object.entries(map)
      .map(([id, { sum, count }]) => [id, Math.round((sum / count) * 10) / 10] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Peak hours (0-23)
  const peakHours = useMemo(() => {
    const hours = new Array(24).fill(0);
    for (const entry of filtered) {
      const h = new Date(entry.startTime).getHours();
      hours[h]++;
    }
    return hours;
  }, [filtered]);

  const peakMax = Math.max(...peakHours, 1);

  // Member-specific leaderboard
  const [selectedStatMember, setSelectedStatMember] = useState<string | null>(null);

  const memberSpecific = useMemo(() => {
    if (!selectedStatMember) return null;
    const entries = filtered.filter(e =>
      e.memberIds.includes(selectedStatMember) ||
      (e.coFrontIds || []).includes(selectedStatMember) ||
      (e.coConsciousIds || []).includes(selectedStatMember)
    );
    const coMembers: Record<string, number> = {};
    const moods: Record<string, number> = {};
    let energySum = 0; let energyCount = 0;
    for (const e of entries) {
      const allIds = [...e.memberIds, ...(e.coFrontIds || []), ...(e.coConsciousIds || [])];
      for (const id of allIds) {
        if (id !== selectedStatMember) coMembers[id] = (coMembers[id] || 0) + 1;
      }
      if (e.mood) moods[e.mood] = (moods[e.mood] || 0) + 1;
      if (e.energyLevel && e.memberIds.includes(selectedStatMember)) { energySum += e.energyLevel; energyCount++; }
      if (e.coFrontEnergy && (e.coFrontIds || []).includes(selectedStatMember)) { energySum += e.coFrontEnergy; energyCount++; }
    }
    return {
      sessions: entries.length,
      coMembers: Object.entries(coMembers).sort((a, b) => b[1] - a[1]).slice(0, 5),
      moods: Object.entries(moods).sort((a, b) => b[1] - a[1]).slice(0, 5),
      avgEnergy: energyCount > 0 ? Math.round((energySum / energyCount) * 10) / 10 : null,
    };
  }, [filtered, selectedStatMember]);

  // ─── Bar Component ─────────────────────────────────────────────────────

  const Bar = ({ label, value, max, color, suffix }: {
    label: string; value: number; max: number; color: string; suffix: string;
  }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{suffix}</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, background: color,
          width: `${max > 0 ? (value / max) * 100 : 0}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );

  const Leaderboard = ({ title, data, mode }: {
    title: string; data: [string, number][]; mode: 'time' | 'count';
  }) => {
    const top5 = data.slice(0, 5);
    const maxVal = top5.length > 0 ? top5[0][1] : 1;
    return (
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{title}</h3>
        {top5.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No data</span>
        ) : (
          top5.map(([id, val]) => {
            const m = getMember(id);
            return (
              <Bar key={id} label={m?.name || id} value={val} max={maxVal} color={m?.color || 'var(--accent)'}
                suffix={mode === 'time' ? fmtDur(0, val) : `${val}`} />
            );
          })
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Time range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', '30d', '7d'] as TimeRange[]).map(r => (
          <button key={r} className={`btn ${range === r ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setRange(r)}>
            {r === 'all' ? t('stats.allTime') : r === '30d' ? t('stats.last30') : t('stats.last7')}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: t('stats.totalSessions'), value: totalSessions.toString() },
          { label: t('stats.totalFrontTime'), value: fmtDur(0, totalTime) },
          { label: t('stats.uniqueFronters'), value: fronterTotals.length.toString() },
          { label: t('stats.chatMessages'), value: totalMsgs.toString() },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: 16, background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Leaderboards — 2 column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        <Leaderboard title={t('stats.topFronters')} data={fronterTotals} mode="time" />
        <Leaderboard title={t('stats.topCoFronters')} data={coFrontTotals} mode="time" />
        <Leaderboard title={t('stats.topCoCon')} data={coConTotals} mode="time" />
        <Leaderboard title={t('stats.topChatters')} data={chatSorted} mode="count" />
      </div>

      {/* Moods & Locations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, marginTop: 20 }}>
        <div>
          <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{t('stats.topMoods')}</h3>
          {moodTotals.slice(0, 5).map(([mood, count]) => (
            <Bar key={mood} label={mood} value={count} max={moodTotals[0]?.[1] || 1} color="var(--info)" suffix={`${count}`} />
          ))}
          {moodTotals.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('stats.noMoodsRecorded')}</span>}
        </div>
        <div>
          <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{t('stats.topLocations')}</h3>
          {locationTotals.slice(0, 5).map(([loc, count]) => (
            <Bar key={loc} label={loc} value={count} max={locationTotals[0]?.[1] || 1} color="var(--success)" suffix={`${count}`} />
          ))}
          {locationTotals.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('stats.noLocationsRecorded')}</span>}
        </div>
      </div>

      {/* Energy Averages */}
      {energyStats.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{t('energy.avgEnergy')}</h3>
          {energyStats.slice(0, 8).map(([id, avg]) => {
            const m = getMember(id);
            return <Bar key={id} label={m?.name || '?'} value={avg} max={10} color={m?.color || 'var(--accent)'} suffix={`${avg}/10`} />;
          })}
        </div>
      )}

      {/* Peak Hours */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{t('stats.peakHours')}</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
          {peakHours.map((count, h) => (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%', background: count === peakMax ? 'var(--accent)' : 'var(--border)',
                borderRadius: 2, height: `${Math.max((count / peakMax) * 100, 2)}%`,
                minHeight: 2, transition: 'height 0.3s ease',
              }} />
              {h % 4 === 0 && <span style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>{h}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Member Leaderboard */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 10 }}>{t('stats.memberLeaderboard', { name: '' }).replace(/^\s+/, '') || 'Member Details'}</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {members.filter(m => !m.archived).map(m => (
            <button key={m.id} className={`chip`}
              style={{
                borderColor: selectedStatMember === m.id ? `${m.color}60` : 'var(--border)',
                background: selectedStatMember === m.id ? `${m.color}20` : 'var(--surface)',
                color: selectedStatMember === m.id ? m.color : 'var(--dim)', cursor: 'pointer',
              }}
              onClick={() => setSelectedStatMember(selectedStatMember === m.id ? null : m.id)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
              {m.name}
            </button>
          ))}
        </div>

        {memberSpecific && selectedStatMember && (() => {
          const m = getMember(selectedStatMember);
          return (
            <div style={{ padding: 14, background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div><span style={{ fontSize: 20, fontWeight: 700, color: m?.color || 'var(--accent)' }}>{memberSpecific.sessions}</span><span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{t('stats.sessionsSuffix')}</span></div>
                {memberSpecific.avgEnergy !== null && <div><span style={{ fontSize: 20, fontWeight: 700, color: m?.color || 'var(--accent)' }}>{memberSpecific.avgEnergy}</span><span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{t('energy.outOf10')}</span></div>}
              </div>
              {memberSpecific.coMembers.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('stats.topCoMembers')}</div>
                  {memberSpecific.coMembers.map(([id, count]) => {
                    const cm = getMember(id);
                    return <Bar key={id} label={cm?.name || '?'} value={count} max={memberSpecific.coMembers[0]?.[1] || 1} color={cm?.color || 'var(--info)'} suffix={`${count}`} />;
                  })}
                </div>
              )}
              {memberSpecific.moods.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{t('stats.topMoods')}</div>
                  {memberSpecific.moods.map(([mood, count]) => (
                    <Bar key={mood} label={mood} value={count} max={memberSpecific.moods[0]?.[1] || 1} color="var(--info)" suffix={`${count}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
