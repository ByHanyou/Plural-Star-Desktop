import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../utils';
import { useAppStore } from '../store/appStore';

interface Props { onClick: () => void; }

export default function JournalTile({ onClick }: Props) {
  const journal = useAppStore(s => s.state.journal);
  const members = useAppStore(s => s.state.members);
  const { t } = useTranslation();
  const recent = [...journal].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  const getMember = (id: string) => members.find(m => m.id === id);
  return (
    <div className="tile" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">📓</div><span className="tile__title">{t('journal.title')}</span></div>
      <div className="tile__body">
        {recent.length === 0 ? <span className="tile__empty">{t('journal.noEntries')}</span> : recent.map(entry => (
          <div key={entry.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="tile__journal-title">{entry.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span className="tile__journal-date">{fmtDate(entry.timestamp)}</span>
              <span className="tile__journal-date">{entry.authorIds.map(id => getMember(id)?.name || '?').join(', ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
