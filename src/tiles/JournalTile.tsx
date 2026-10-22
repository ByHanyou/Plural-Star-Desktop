import { useTranslation } from 'react-i18next';
import { fmtDate, fmtList } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function JournalTile({ onClick }: Props) {
  const journal = useAppStore(s => s.journal);
  const members = useAppStore(s => s.members);
  const { t } = useTranslation();
  const recent = [...journal].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  const getMember = (id: string) => members.find(m => m.id === id);
  return (
    <Tile glyph="📓" title={t('journal.title')} onClick={onClick}>
      {recent.length === 0 ? <span className="tile__empty">{t('journal.noEntries')}</span> : recent.map(entry => (
        <div key={entry.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="tile__journal-title">{entry.title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span className="tile__journal-date">{fmtDate(entry.timestamp)}</span>
            <span className="tile__journal-date">{fmtList(entry.authorIds.map(id => getMember(id)?.name || '?'))}</span>
          </div>
        </div>
      ))}
    </Tile>
  );
}
