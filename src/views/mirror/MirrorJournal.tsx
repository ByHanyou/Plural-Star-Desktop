import { useTranslation } from 'react-i18next';
import { JournalEntry, fmtTime } from '../../utils';
import { SrOnly } from '../../components/ui';
import { Nothing, mutedText } from './shared';

export function MirrorJournal({ entries, unlocked, onOpen }: {
  entries: JournalEntry[]; unlocked: ReadonlySet<string>; onOpen: (e: JournalEntry) => void;
}) {
  const { t } = useTranslation();
  const list = entries.filter(e => !!e).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.timestamp || 0) - (a.timestamp || 0));
  if (list.length === 0) return <Nothing />;
  return (
    <div>
      {list.map(e => (
        <button key={e.id} type="button" onClick={() => onOpen(e)}
          style={{ display: 'block', width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {e.password && !unlocked.has(e.id) ? <><span aria-hidden>🔒 </span><SrOnly>{t('journal.lockedLabel')}</SrOnly></> : ''}{e.title || fmtTime(e.timestamp || 0)}
          </span>
          {e.timestamp ? <span style={{ display: 'block', ...mutedText }}>{fmtTime(e.timestamp)}</span> : null}
        </button>
      ))}
    </div>
  );
}
