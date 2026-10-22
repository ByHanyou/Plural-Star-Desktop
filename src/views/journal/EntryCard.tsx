import { useTranslation } from 'react-i18next';
import { JournalEntry, Member, fmtDate, truncateRunes } from '../../utils';
import { SrOnly, activateOnKey } from '../../components/ui';
import { stripMarkup } from '../../markdown/parse';
import { TagChips } from '../../components/TagChips';

export const previewText = (html: string): string => truncateRunes(stripMarkup(html), 200);

export const clampStyle = {
  fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 6,
  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
} as const;

export function EntryCard({ entry, locked, members, onOpen, onTogglePin }: {
  entry: JournalEntry; locked: boolean; members: Member[]; onOpen: () => void; onTogglePin: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tile" onClick={onOpen} style={{
      minHeight: 'auto', padding: 16, cursor: 'pointer',
      ...(entry.pinned ? { background: 'color-mix(in srgb, var(--accent) 8%, var(--card))', borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))' } : {}),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }} role="button" tabIndex={0}
          onKeyDown={e => { e.stopPropagation(); activateOnKey(onOpen)(e); }}>
          {entry.pinned ? <><span aria-hidden>📌 </span><SrOnly>{t('journal.pinnedLabel')}</SrOnly></> : ''}
          {locked ? <><span aria-hidden>🔒 </span><SrOnly>{t('journal.lockedLabel')}</SrOnly></> : ''}
          {entry.title}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(entry.timestamp)}</span>
          <button type="button" onClick={ev => { ev.stopPropagation(); onTogglePin(); }} aria-label={t('journal.pinNamed', { title: entry.title })} aria-pressed={!!entry.pinned}
            title={entry.pinned ? t('noteboard.unpin') : t('noteboard.pin')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: 12, filter: entry.pinned ? 'none' : 'grayscale(1) opacity(0.5)' }}>📌</button>
        </span>
      </div>
      {locked ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 6 }}>{t('journal.tapToUnlock')}</p>
      ) : entry.body && <p style={clampStyle}>{previewText(entry.body)}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(entry.authorIds || []).map(id => {
          const m = members.find(x => x.id === id);
          return m ? <span key={id} style={{ fontSize: 11, color: m.color }}>{m.name}</span> : null;
        })}
        <TagChips tags={entry.hashtags || []} />
      </div>
    </div>
  );
}
