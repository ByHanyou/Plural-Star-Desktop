import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { HistoryEntry, Member, DAY_MS, fmtDate, buildEffectiveEnd, historyAllIds, isFrontEntry } from '../utils';
import { historyEntryKey } from '../history/retro';
import { saveData } from '../store/actions';
import { ConfirmDialog, EmptyState, SaveErrorDialog } from '../components/ui';
import FrontTimeline from '../components/FrontTimeline';
import { useAppStore } from '../store/appStore';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { HistoryEntryCard } from './history/HistoryEntryCard';
import { pickerPool } from '../picker/memberPicker';

interface Props {
  singlet?: boolean;
  selfId?: string;
}

type TimeRange = 'all' | '7d' | '30d' | '90d';

const RANGE_DAYS: Record<TimeRange, number> = { all: 0, '7d': 7, '30d': 30, '90d': 90 };
const RANGE_LABEL: Record<TimeRange, string> = { all: 'stats.allTime', '90d': 'stats.last90', '30d': 'stats.last30', '7d': 'stats.last7' };
const RANGES: TimeRange[] = ['all', '90d', '30d', '7d'];
const DELETE_STEPS = ['history.deleteConfirm1', 'history.deleteConfirm2', 'history.deleteConfirm3'];

export default function HistoryView({ singlet = false, selfId }: Props) {
  useMinuteTick();
  const { t } = useTranslation();
  const history = useAppStore(s => s.history);
  const members = useAppStore(s => s.members);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<TimeRange>('all');
  const [memberFilter, setMemberFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const getMember = (id: string) => memberById.get(id);
  const effEnd = useMemo(() => buildEffectiveEnd(history), [history]);

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - RANGE_DAYS[range] * DAY_MS;
    const query = search.trim().toLowerCase();
    return history
      .filter(h => {
        if (!isFrontEntry(h)) return false;
        const end = h.endTime ?? effEnd(h);
        if (cutoff && end !== null && end < cutoff) return false;
        if (memberFilter && !historyAllIds(h).includes(memberFilter)) return false;
        if (!query) return true;
        const names = historyAllIds(h).map(id => memberById.get(id)?.name || '').join(' ').toLowerCase();
        return names.includes(query) || (h.note || '').toLowerCase().includes(query) || (h.mood || '').toLowerCase().includes(query);
      })
      .sort((a, b) => b.startTime - a.startTime);
  }, [history, range, memberFilter, search, memberById, effEnd]);

  const grouped = useMemo(() => {
    const groups: { date: string; entries: HistoryEntry[] }[] = [];
    for (const entry of filtered) {
      const date = fmtDate(entry.startTime);
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.entries.push(entry);
      else groups.push({ date, entries: [entry] });
    }
    return groups;
  }, [filtered]);

  const filterGroups = useMemo(() => {
    const live = members.filter(m => !m.archived);
    if (singlet) return [{ label: '', members: live.filter(m => !m.isFacet && m.isCustomFront && m.id !== selfId) }];
    return [
      pickerPool('members', live.filter(m => !m.isFacet && !m.isCustomFront), t),
      pickerPool('facets', live.filter(m => m.isFacet), t),
      pickerPool('customFronts', live.filter(m => m.isCustomFront && !m.isFacet), t),
    ].filter(g => g.members.length > 0);
  }, [members, singlet, selfId, t]);

  const chipIdsFor = (entry: HistoryEntry): string[] => {
    const baseIds = entry.memberIds.length ? entry.memberIds : (entry.coFrontIds?.length ? entry.coFrontIds : (entry.coConsciousIds || []));
    if (!singlet || !selfId) return baseIds;
    const withoutSelf = baseIds.filter(id => id !== selfId);
    return withoutSelf.length === 0 ? baseIds : withoutSelf;
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteStep(0);
  };

  const advanceDelete = async () => {
    if (deleteStep < DELETE_STEPS.length) {
      setDeleteStep(deleteStep + 1);
      return;
    }
    const target = deleteTarget;
    closeDelete();
    if (!target) return;
    const live = useAppStore.getState().history;
    let idx = live.indexOf(target);
    if (idx < 0) idx = live.findIndex(e => historyEntryKey(e) === historyEntryKey(target) && e.endTime === target.endTime);
    if (idx >= 0) await run(() => saveData('history', live.filter((_, i) => i !== idx)));
  };

  const optionsOf = (list: Member[]) => list.map(m => <option key={m.id} value={m.id}>{m.name}</option>);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['list', 'timeline'] as const).map(v => (
            <button key={v} type="button" className={`btn ${viewMode === v ? 'btn--primary' : 'btn--ghost'}`}
              style={{ padding: '7px 10px', fontSize: 12 }} aria-pressed={viewMode === v} onClick={() => setViewMode(v)}>
              {v === 'list' ? (singlet ? t('history.statusHistory') : t('history.frontHistory')) : t('history.timeline')}
            </button>
          ))}
        </div>
        {viewMode === 'list' && (
          <>
            <input className="field__input" value={search} onChange={e => setSearch(e.target.value)}
              aria-label={t('members.search')} placeholder={t('members.search')} style={{ flex: 1, minWidth: 200 }} />
            <select aria-label={t('common.filterByMember')} value={memberFilter} onChange={e => setMemberFilter(e.target.value)} style={{
              background: 'var(--surface)', color: memberFilter ? 'var(--accent)' : 'var(--muted)',
              border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13,
            }}>
              <option value="">{singlet ? t('history.byStatus') : t('history.allMembers')}</option>
              {filterGroups.map(g => (g.label ? <optgroup key={g.label} label={g.label}>{optionsOf(g.members)}</optgroup> : optionsOf(g.members)))}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(r => (
                <button key={r} type="button" className={`btn ${range === r ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ padding: '7px 10px', fontSize: 12 }} aria-pressed={range === r} onClick={() => setRange(r)}>
                  {t(RANGE_LABEL[r])}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {viewMode === 'timeline' ? (
        <FrontTimeline history={history} members={members} singlet={singlet} />
      ) : (
        <>
          <div role="status" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>{t('history.entryCount', { count: filtered.length })}</div>

          {grouped.map(group => (
            <div key={group.date} style={{ marginBottom: 20 }}>
              <div role="heading" aria-level={3} style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', fontWeight: 600,
                marginBottom: 8, padding: '4px 0', borderBottom: '1px solid var(--border)',
              }}>
                {group.date}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.entries.map((entry, i) => (
                  <HistoryEntryCard key={`${historyEntryKey(entry)}-${i}`} entry={entry} end={entry.endTime ?? effEnd(entry)} getMember={getMember}
                    chipIds={chipIdsFor(entry)} showCoTiers={!singlet} onDelete={() => { setDeleteTarget(entry); setDeleteStep(1); }} />
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <EmptyState>
              {search || memberFilter ? t('history.noHistoryFilter') : singlet ? t('history.noHistorySinglet') : t('history.noHistory')}
            </EmptyState>
          )}
        </>
      )}

      <ConfirmDialog key={deleteStep} open={deleteStep > 0} title={t('history.deleteEntryStep', { step: deleteStep, total: DELETE_STEPS.length })}
        message={deleteStep > 0 ? t(DELETE_STEPS[deleteStep - 1]) : ''} danger onConfirm={() => void advanceDelete()} onCancel={closeDelete} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
