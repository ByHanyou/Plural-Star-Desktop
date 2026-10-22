import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MirrorGroup, MirrorMember } from '../../network/types';
import { MarkdownText } from '../../components/MarkdownText';
import { asCustomFieldType, fmtFieldValue, getInitials } from '../../utils';
import { Nothing, mutedText, rowDivider } from './shared';

export function MirrorMembers({ members, media, groupsOf }: {
  members: MirrorMember[]; media: ReadonlyMap<string, string>; groupsOf: (id: string) => MirrorGroup[];
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  if (members.length === 0) return <Nothing />;
  const q = search.trim().toLowerCase();
  const list = q ? members.filter(m => [m.name, m.pronouns, m.role].some(v => (v || '').toLowerCase().includes(q))) : members;
  return (
    <div>
      <input className="field__input" type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('history.searchMember')} aria-label={t('history.searchMember')} style={{ marginBottom: 8 }} />
      {list.map(m => {
        const isOpen = expanded === m.id;
        const av = media.get(m.id);
        const banner = media.get(`${m.id}#banner`);
        const groups = groupsOf(m.id);
        return (
          <div key={m.id} style={rowDivider}>
            <button type="button" onClick={() => setExpanded(isOpen ? null : m.id)} aria-expanded={isOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              {av ? (
                <img src={av} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, background: m.color || 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: 600 }}>
                  {Array.from(getInitials(m.name || '?'))[0] || '?'}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                {(m.pronouns || m.role) && <span style={{ display: 'block', ...mutedText }}>{[m.pronouns, m.role].filter(Boolean).join('  ·  ')}</span>}
              </span>
            </button>
            {isOpen && (
              <div style={{ paddingLeft: 46, paddingTop: 6 }}>
                {banner && <img src={banner} alt="" style={{ display: 'block', width: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'cover', marginBottom: 6 }} />}
                {groups.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}>
                    {groups.map(g => (
                      <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text)' }}>
                        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: g.color || 'var(--border)' }} />
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
                {m.description && <div style={{ margin: '4px 0' }}><MarkdownText text={m.description} /></div>}
                {(m.customFields || []).map((cf, i) => {
                  if (cf.type === 'image') {
                    const img = media.get(`${m.id}#cf:${cf.fieldId || ''}`);
                    return (
                      <div key={i} style={{ margin: '2px 0' }}>
                        <span style={mutedText}>{t('common.labelColon', { label: cf.name })} </span>
                        {img
                          ? <img src={img} alt={cf.name} style={{ display: 'block', maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginTop: 4, objectFit: 'cover' }} />
                          : <span style={{ ...mutedText, fontStyle: 'italic' }}>{t('markdown.imageUnavailable')}</span>}
                      </div>
                    );
                  }
                  return (
                    <p key={i} style={{ margin: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                      <span style={mutedText}>{t('common.labelColon', { label: cf.name })} </span>
                      {typeof cf.value === 'boolean'
                        ? <span role="img" aria-label={cf.value ? t('common.yes') : t('common.no')}>{cf.value ? '✓' : '✕'}</span>
                        : fmtFieldValue(asCustomFieldType(cf.type), cf.value)}
                    </p>
                  );
                })}
                {(m.connections || []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 4 }}>{t('systemMap.connections')}</div>
                    {(m.connections || []).map(c => (
                      <p key={c.id} style={{ margin: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                        <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c.color || 'var(--border)', marginRight: 6 }} />
                        <span style={mutedText}>{t('common.labelColon', { label: c.labelKey ? t(c.labelKey) : c.label })} </span>
                        {c.otherName}
                        {c.note ? <span style={{ ...mutedText, fontStyle: 'italic' }}>{'  ·  ' + c.note}</span> : null}
                      </p>
                    ))}
                  </div>
                )}
                {!m.description && (m.customFields || []).length === 0 && (m.connections || []).length === 0 && <Nothing />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
