import React from 'react';
import { useTranslation } from 'react-i18next';
import { MemberGroup, groupKind, descendantsOf, groupTree, childrenOf } from '../../utils';
import { Section } from '../../components/ui';
import { tint } from '../../theme';

export function GroupToggleChip({ group: g, on, onToggle, ariaLabel, children }: {
  group: MemberGroup; on: boolean; onToggle: () => void; ariaLabel?: string; children?: React.ReactNode;
}) {
  return (
    <button className="chip" type="button"
      aria-label={ariaLabel}
      title={g.description || undefined}
      aria-pressed={on}
      style={{
        borderColor: on ? tint(g.color || 'var(--accent)', 31) : 'var(--border)',
        background: on ? tint(g.color || 'var(--accent)', 13) : 'var(--surface)',
        color: on ? (g.color || 'var(--accent)') : 'var(--dim)',
      }}
      onClick={onToggle}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: groupKind(g) === 'subsystem' ? 1.5 : '50%', background: g.color || 'var(--accent)', display: 'inline-block' }} />
      {g.name}{children}
      {on && <span aria-hidden style={{ fontWeight: 700 }}>✓</span>}
    </button>
  );
}

export function GroupTreePicker({ groups, selectedIds, onToggle, open, onToggleOpen }: {
  groups: MemberGroup[]; selectedIds: string[]; onToggle: (gid: string) => void;
  open: ReadonlyMap<string, boolean>; onToggleOpen: (gid: string, next: boolean) => void;
}) {
  const { t } = useTranslation();
  const selected = new Set(selectedIds);
  const chip = (g: MemberGroup) => <GroupToggleChip key={g.id} group={g} on={selected.has(g.id)} onToggle={() => onToggle(g.id)} />;
  const isOpen = (g: MemberGroup): boolean =>
    open.get(g.id) ?? descendantsOf(groups, g.id).some(d => selected.has(d.id));
  const { roots, unreached } = groupTree(groups);
  const seen = new Set<string>();
  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const kids = (parentId === null ? roots : childrenOf(groups, parentId)).filter(g => !seen.has(g.id));
    kids.forEach(g => seen.add(g.id));
    const leaves = kids.filter(g => childrenOf(groups, g.id).length === 0);
    const parents = kids.filter(g => childrenOf(groups, g.id).length > 0);
    return (
      <div style={{ paddingLeft: depth === 0 ? 0 : 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {leaves.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{leaves.map(g => chip(g))}</div>}
        {parents.map(g => {
          const isExpanded = isOpen(g);
          const activeKids = descendantsOf(groups, g.id).filter(d => selected.has(d.id)).length;
          return (
            <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {chip(g)}
                <button type="button" className="chip" aria-expanded={isExpanded} aria-label={t('memberGroups.showSubgroups', { name: g.name, count: activeKids })} onClick={() => onToggleOpen(g.id, !isExpanded)}
                  style={{ padding: '3px 8px', background: 'var(--surface)', color: 'var(--dim)', borderColor: 'var(--border)' }}>
                  {!isExpanded && activeKids > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: g.color || 'var(--accent)' }}>{activeKids}</span>}
                  <span aria-hidden style={{ fontSize: 10 }}>{isExpanded ? '▽' : '▷'}</span>
                </button>
              </div>
              {isExpanded && renderLevel(g.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <>
      <Section label={t('memberGroups.title')} />
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {renderLevel(null, 0)}
        {unreached.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{unreached.map(g => chip(g))}</div>}
      </div>
    </>
  );
}
