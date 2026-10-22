import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member } from '../utils';
import { KindToggles } from './ui';
import { ALL_PICKER_KINDS, PICKER_RESULTS_MAX, PickerAnnotation, PickerKinds, PickerPool, activePickerPools, pickerGroups, selectionSet } from '../picker/memberPicker';
import { MemberAvatar } from './MemberAvatar';
import { tint } from '../theme';

export interface MemberSelectProps {
  pools: PickerPool[];
  selected?: Iterable<string> | string | null;
  onPick: (member: Member) => void;
  multi?: boolean;
  hideSelected?: boolean;
  requireSearch?: boolean;
  maxResults?: number;
  kindToggles?: boolean;
  selectedChips?: boolean;
  showSearch?: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  searchLabel?: string;
  hint?: string;
  emptyLabel?: string;
  annotate?: (member: Member) => PickerAnnotation | null | undefined;
  orderRows?: (rows: Member[], pool: PickerPool) => Member[];
  keepOrder?: boolean;
  variant?: 'rows' | 'chips';
  chipAvatar?: boolean;
  listMaxHeight?: number;
  autoFocus?: boolean;
  clearOnPick?: boolean;
}

const headingStyle: React.CSSProperties = { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600 };

export function MemberSelect({
  pools, selected, onPick, multi = false, hideSelected = false, requireSearch = false, maxResults = PICKER_RESULTS_MAX,
  kindToggles = false, selectedChips = false, showSearch = true, search, onSearch, searchLabel, hint, emptyLabel,
  annotate, orderRows, keepOrder = false, variant = 'rows', chipAvatar = false, listMaxHeight = 220, autoFocus = false, clearOnPick = true,
}: MemberSelectProps) {
  const { t } = useTranslation();
  const [ownSearch, setOwnSearch] = useState('');
  const [kinds, setKinds] = useState<PickerKinds>(ALL_PICKER_KINDS);
  const query = (search ?? ownSearch).trim();
  const setQuery = (value: string) => {
    if (onSearch) onSearch(value);
    if (search === undefined) setOwnSearch(value);
  };
  const selectedSet = useMemo(() => selectionSet(selected), [selected]);
  const allMembers = useMemo(() => pools.flatMap(p => p.members), [pools]);
  const hasKinds = kindToggles && pools.some(p => !!p.kind);
  const activePools = useMemo(() => activePickerPools(pools, hasKinds ? kinds : null), [pools, hasKinds, kinds]);

  const { grouped, total, shown } = useMemo(
    () => pickerGroups(activePools, { query, selected: selectedSet, hideSelected, maxResults, orderRows, keepOrder }),
    [activePools, query, hideSelected, selectedSet, maxResults, orderRows, keepOrder],
  );

  const pick = (m: Member) => {
    onPick(m);
    if (clearOnPick && query) setQuery('');
  };

  const showResults = !showSearch || !requireSearch || query.length > 0;
  const showHeaders = pools.length > 1;
  const selectedMembers = selectedChips ? allMembers.filter(m => selectedSet.has(m.id)) : [];
  const noMatches = emptyLabel || t('members.noMatches');

  const row = (m: Member) => {
    const isSelected = selectedSet.has(m.id);
    const note = annotate ? annotate(m) : null;
    return (
      <button key={m.id} type="button" onClick={() => pick(m)}
        role={multi ? 'checkbox' : undefined} aria-checked={multi ? isSelected : undefined} aria-pressed={multi ? undefined : isSelected}
        aria-label={[m.name, m.pronouns, note?.label].filter(Boolean).join(', ')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
          background: isSelected ? tint(m.color, 8) : 'none', opacity: note?.dim && !isSelected ? 0.45 : 1 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ flex: 1, color: isSelected ? m.color : 'var(--text)', fontSize: 13, fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
        {m.pronouns ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.pronouns}</span> : null}
        {note?.label && !isSelected ? <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>{note.label}</span> : null}
        {isSelected ? <span aria-hidden style={{ color: m.color, fontWeight: 700 }}>✓</span> : null}
      </button>
    );
  };

  const chip = (m: Member) => {
    const isSelected = selectedSet.has(m.id);
    return (
      <button key={m.id} type="button" className="chip" aria-pressed={isSelected} onClick={() => pick(m)}
        style={{ borderColor: isSelected ? tint(m.color, 38) : 'var(--border)', background: isSelected ? tint(m.color, 13) : 'var(--surface)' }}>
        {chipAvatar ? <MemberAvatar member={m} size={16} fontSize={8} decorative /> : <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, display: 'inline-block' }} />}
        <span style={{ color: isSelected ? m.color : 'var(--dim)' }}>{m.name}</span>
        {isSelected && <span aria-hidden style={{ fontWeight: 700, color: m.color }}>✓</span>}
      </button>
    );
  };

  const refine = total > shown ? (
    <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', margin: 0, padding: 8 }}>{t('members.refineSearch', { count: total - shown })}</p>
  ) : null;

  const results = grouped.length === 0 ? (
    <p role="status" style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', margin: 0, padding: '10px 0' }}>{noMatches}</p>
  ) : variant === 'chips' ? (
    <>
      {grouped.map(({ pool, rows }, gi) => (
        <div key={`${gi}-${pool.label}`} style={{ marginBottom: 8 }}>
          {showHeaders && !!pool.label && <div role="heading" aria-level={4} style={{ ...headingStyle, marginBottom: 4 }}>{pool.label}</div>}
          <div role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{rows.map(chip)}</div>
        </div>
      ))}
      {refine}
    </>
  ) : (
    <div style={{ maxHeight: listMaxHeight, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      {grouped.map(({ pool, rows }, gi) => (
        <div key={`${gi}-${pool.label}`}>
          {showHeaders && !!pool.label && <div role="heading" aria-level={4} style={{ ...headingStyle, padding: '8px 12px 4px', background: 'var(--card)' }}>{pool.label}</div>}
          {rows.map(row)}
        </div>
      ))}
      {refine}
    </div>
  );

  return (
    <div>
      {selectedMembers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedMembers.map(m => (
            <button key={m.id} type="button" className="chip" aria-label={t('common.removeNamed', { name: m.name })} style={{ borderColor: tint(m.color, 31), background: tint(m.color, 13) }}
              onClick={() => pick(m)}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
              <span style={{ color: m.color }}>{m.name}</span>
              <span aria-hidden style={{ fontSize: 10, color: m.color }}>✕</span>
            </button>
          ))}
        </div>
      )}

      {showSearch && (
        <input className="field__input" value={search ?? ownSearch} onChange={e => setQuery(e.target.value)} autoFocus={autoFocus}
          aria-label={searchLabel || t('common.search')} placeholder={searchLabel || t('common.search')} style={{ marginBottom: 6, fontSize: 12 }} />
      )}

      {hasKinds && <KindToggles kinds={kinds} setKinds={setKinds} />}

      {showResults ? <div style={{ marginBottom: 10 }}>{results}</div> : null}

      {!showResults && hint && selectedSet.size === 0 && (
        <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0 8px', margin: 0 }}>{hint}</p>
      )}
    </div>
  );
}
