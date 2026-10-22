import { useTranslation } from 'react-i18next';
import { fmtDur, fmtList, isFrontEntry } from '../utils';
import { useAppStore } from '../store/appStore';
import { initialOn } from '../theme';
import { Tile } from '../components/Tile';
import { MemberAvatar } from '../components/MemberAvatar';

interface Props { onClick: () => void; }

export default function HistoryTile({ onClick }: Props) {
  const history = useAppStore(s => s.history);
  const members = useAppStore(s => s.members);
  const { t } = useTranslation();
  const recent = history.filter(isFrontEntry).slice(0, 4);
  const getMember = (id: string) => members.find(m => m.id === id);
  return (
    <Tile glyph="◷" title={t('history.title')} onClick={onClick}>
      {recent.length === 0 ? <span className="tile__empty">{t('history.noHistory')}</span> : recent.map((entry, i) => {
        const first = getMember(entry.memberIds[0]);
        const color = first?.color || 'var(--muted)';
        return (
          <div key={i} className="tile__member-row">
            {entry.memberIds.length === 1 && first
              ? <MemberAvatar member={first} decorative />
              : <div className="tile__avatar" aria-hidden style={{ backgroundColor: color, color: first ? initialOn(first.color) : undefined }}>{entry.memberIds.length > 1 ? entry.memberIds.length : '?'}</div>}
            <span className="tile__member-name" style={{ fontSize: 12 }}>{fmtList(entry.memberIds.map(id => getMember(id)?.name || '?'))}</span>
            <span className="tile__duration">{fmtDur(entry.startTime, entry.endTime)}</span>
          </div>
        );
      })}
    </Tile>
  );
}
