import type React from 'react';
import { useTranslation } from 'react-i18next';
import { tagKey } from '../../utils';

const pill = (sel: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
  background: sel ? 'var(--info-bg)' : 'var(--surface)', color: sel ? 'var(--info)' : 'var(--dim)',
  border: `1px solid ${sel ? 'var(--info)' : 'var(--border)'}`, fontWeight: sel ? 600 : 400,
});

export function TagFilter({ tags, active, onChange }: { tags: string[]; active: string | null; onChange: (tag: string | null) => void }) {
  const { t } = useTranslation();
  const activeKey = active ? tagKey(active) : null;
  if (tags.length === 0) return null;
  return (
    <div role="group" aria-label={t('modal.tags')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
      <button type="button" aria-pressed={!active} onClick={() => onChange(null)} style={pill(!active)}>{t('members.allTags')}</button>
      {tags.map(tag => {
        const sel = activeKey === tagKey(tag);
        return <button key={tagKey(tag)} type="button" aria-pressed={sel} onClick={() => onChange(sel ? null : tag)} style={pill(sel)}>{tag}</button>;
      })}
    </div>
  );
}
