import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { isRosterMember } from '../utils';
import { Tile } from '../components/Tile';
import { MemberAvatar } from '../components/MemberAvatar';

interface Props { onClick: () => void; }

const PREVIEW_COUNT = 5;

export default function MembersTile({ onClick }: Props) {
  const members = useAppStore(s => s.members);
  const { t } = useTranslation();
  const active = members.filter(m => isRosterMember(m) && !m.archived);
  return (
    <Tile glyph="👥" title={t('tabs.fronters')} onClick={onClick}>
      {active.length === 0 ? <span className="tile__empty">{t('members.noMembers')}</span> : (<>
        {active.slice(0, PREVIEW_COUNT).map(m => (
          <div key={m.id} className="tile__member-row">
            <MemberAvatar member={m} decorative />
            <span className="tile__member-name">{m.name}</span>
            <span className="tile__member-role">{m.role}</span>
          </div>
        ))}
        {active.length > PREVIEW_COUNT && <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t('share.more', { count: active.length - PREVIEW_COUNT })}</span>}
      </>)}
    </Tile>
  );
}
