import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryEntry, FrontTierKey, TIER_LABELS, fmtTime, fmtDur, fmtDate, getInitials, translateMood, buildEffectiveEnd } from '../utils';
import { store, KEYS } from '../storage';
import { Btn, ConfirmDialog } from '../components/ui';
import { useAppStore } from '../store/appStore';

interface Props {
  onUpdate: () => void;
  singlet?: boolean;
  selfId?: string;
}

type TimeRange = 'all' | '7d' | '30d' | '90d';

export default function HistoryView({ onUpdate, singlet = false, selfId }: Props) {
  const { t } = useTranslation();
  const history = useAppStore(s => s.state.history);
  const members = useAppStore(s => s.state.members);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<TimeRange>('all');
  const [memberFilter, setMemberFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  const getMember = (id: string) => members.find(m => m.id === id);

  const cutoff = useMemo(() => {
    if (range === '7d') return Date.now() - 7 * 86400000;
    if (range === '30d') return Date.now() - 30 * 86400000;
    if (range === '90d') return Date.now() - 90 * 86400000;
    return 0;
  }, [range]);

  const filtered = useMemo(() => {
    return history
      .filter(h => {
        if (!h.changeType || h.changeType === 'front') {
          if (h.startTime < cutoff && (h.endTime && h.endTime < cutoff)) return false;
        }
        if (memberFilter) {
          const allIds = [...h.memberIds, ...(h.coFrontIds || []), ...(h.coConsciousIds || [])];
          if (!allIds.includes(memberFilter)) return false;
        }
        if (search) {
          const names = [...h.memberIds, ...(h.coFrontIds || []), ...(h.coConsciousIds || [])]
            .map(id => getMember(id)?.name || '').join(' ').toLowerCase();
          const note = (h.note || '').toLowerCase();
          const mood = (h.mood || '').toLowerCase();
          if (!names.includes(search.toLowerCase()) && !note.includes(search.toLowerCase()) && !mood.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => b.startTime - a.startTime);
  }, [history, cutoff, memberFilter, search]);

  const effEnd = useMemo(() => buildEffectiveEnd(history), [history]);

  const grouped = useMemo(() => {
    const groups: { date: string; entries: HistoryEntry[] }[] = [];
    let currentDate = '';
    for (const entry of filtered) {
      const d = fmtDate(entry.startTime);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [filtered]);

  const MemberChip = ({ id }: { id: string }) => {
    const m = getMember(id);
    if (!m) return null;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12, color: m.color, padding: '2px 8px',
        borderRadius: 999, background: `${m.color}15`, border: `1px solid ${m.color}30`,
      }}>
        {m.avatar ? (
          <img src={m.avatar} alt="" style={{ width: 16, height: 16, borderRadius: 8, objectFit: 'cover', display: 'inline-block' }} />
        ) : (
          <span style={{ width: 16, height: 16, borderRadius: 8, background: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--bg)', fontWeight: 700 }}>
            {getInitials(m.name)}
          </span>
        )}
        {m.name}
      </span>
    );
  };

  const startDelete = (entryIndex: number) => {
    setDeleteTarget(entryIndex);
    setDeleteStep(1);
  };

  const advanceDelete = async () => {
    if (deleteStep < 3) {
      setDeleteStep(deleteStep + 1);
      return;
    }
    if (deleteTarget === null) return;
    const updated = history.filter((_, i) => i !== deleteTarget);
    await store.set(KEYS.history, updated);
    setDeleteTarget(null);
    setDeleteStep(0);
    onUpdate();
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteStep(0);
  };

  const deleteMessages = [
    '',
    t('history.deleteConfirm1'),
    t('history.deleteConfirm2'),
    t('history.deleteConfirm3'),
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('members.search')} style={{ flex: 1, minWidth: 200 }} />
        <select aria-label="Filter by member" style={{
          background: 'var(--surface)', color: memberFilter ? 'var(--accent)' : 'var(--muted)',
          border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13,
        }} value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
          <option value="">{singlet ? t('history.byStatus') : t('history.allMembers')}</option>
          {members.filter(m => !m.archived && (!singlet || (m.isCustomFront && m.id !== selfId))).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', '90d', '30d', '7d'] as TimeRange[]).map(r => (
            <button key={r} className={`btn ${range === r ? 'btn--primary' : 'btn--ghost'}`}
              style={{ padding: '7px 10px', fontSize: 12 }}
              onClick={() => setRange(r)}>
              {r === 'all' ? t('stats.allTime') : r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
      </div>

      {grouped.map(group => (
        <div key={group.date} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
            color: 'var(--accent)', fontWeight: 600, marginBottom: 8,
            padding: '4px 0', borderBottom: '1px solid var(--border)',
          }}>
            {group.date}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.entries.map((entry, i) => {
              const displayEnd = entry.endTime ?? effEnd(entry);
              const withoutSelf = singlet && selfId ? entry.memberIds.filter(id => id !== selfId) : entry.memberIds;
              const chipIds = singlet && withoutSelf.length === 0 ? entry.memberIds : withoutSelf;
              return (
              <div key={i} style={{
                padding: 12, background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {chipIds.map(id => <MemberChip key={id} id={id} />)}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(entry.startTime)} — {displayEnd ? fmtTime(displayEnd) : 'now'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtDur(entry.startTime, displayEnd)}
                  </span>
                </div>

                {!singlet && (entry.coFrontIds || []).length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('tier.coFront')}:</span>
                    {(entry.coFrontIds || []).map(id => <MemberChip key={id} id={id} />)}
                  </div>
                )}
                {!singlet && (entry.coConsciousIds || []).length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('tier.coConShort')}:</span>
                    {(entry.coConsciousIds || []).map(id => <MemberChip key={id} id={id} />)}
                  </div>
                )}

                {(entry.mood || entry.note || entry.location || entry.energyLevel) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--dim)' }}>
                    {entry.mood && <span>😊 {translateMood(entry.mood, t)}</span>}
                    {entry.location && <span>📍 {entry.location}</span>}
                    {entry.energyLevel && <span>⚡ {entry.energyLevel}/10</span>}
                    {entry.note && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{entry.note}</span>}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', opacity: 0.6, padding: '2px 6px' }}
                    onClick={() => startDelete(history.indexOf(entry))}>
                    {t('history.deleteEntry')}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
          {search || memberFilter ? t('history.noHistoryFilter') : singlet ? t('history.noHistorySinglet') : t('history.noHistory')}
        </div>
      )}

      <ConfirmDialog
        open={deleteStep > 0}
        title={`${t('history.deleteEntry')} (${deleteStep}/3)`}
        message={deleteMessages[deleteStep] || ''}
        danger
        onConfirm={advanceDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
