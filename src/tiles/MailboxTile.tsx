import { useTranslation } from 'react-i18next';
import { byValueDesc, countUp, fmtNum } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function MailboxTile({ onClick }: Props) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const notes = useAppStore(s => s.noteboards);

  const unread = notes.filter(n => !n.read);
  const byMember = new Map<string, number>();
  unread.forEach(n => countUp(byMember, n.memberId));
  const preview = byValueDesc(byMember)
    .slice(0, 3)
    .map(([id, count]) => ({ id, name: members.find(m => m.id === id)?.name || '?', count }));

  return (
    <Tile glyph="✉" title={t('mailbox.title')} onClick={onClick}>
      {notes.length === 0 ? (
        <span className="tile__empty">{t('mailbox.empty')}</span>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            {t('mailbox.messageCount', { count: notes.length })}
            {unread.length > 0 ? ` · ${t('mailbox.unreadCount', { count: unread.length })}` : ''}
          </div>
          {preview.map(p => (
            <div key={p.id} style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 6 }}>
              <span aria-hidden>✉</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span>{fmtNum(p.count, 0)}</span>
            </div>
          ))}
        </>
      )}
    </Tile>
  );
}
