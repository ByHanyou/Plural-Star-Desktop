import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn } from '../../components/ui';
import { MirrorGroupsView, Nothing, mutedText, rowDivider } from './shared';

export function MirrorGroups({ data }: { data: MirrorGroupsView | null }) {
  const { t } = useTranslation();
  const [path, setPath] = useState<string[]>([]);
  const groups = data ? data.groups : [];
  const parentId = path.length > 0 ? path[path.length - 1] : undefined;
  const children = groups
    .filter(g => (g.parentId || undefined) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const membersHere = data?.membership.get(parentId || '') || [];
  return (
    <div>
      {path.length > 0 && <Btn onClick={() => setPath(path.slice(0, -1))}><span aria-hidden>←</span> {t('common.back')}</Btn>}
      {children.map(g => (
        <button key={g.id} type="button" onClick={() => setPath([...path, g.id])}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: g.color || 'var(--border)' }} />
          <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{g.name}</span>
          <span aria-hidden style={mutedText}>›</span>
        </button>
      ))}
      {membersHere.map(m => <div key={m.id} style={{ ...rowDivider, fontSize: 14, color: 'var(--text)' }}>{m.name}</div>)}
      {children.length === 0 && membersHere.length === 0 && <Nothing />}
    </div>
  );
}
