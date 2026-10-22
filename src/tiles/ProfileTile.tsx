import { useTranslation } from 'react-i18next';
import { Member } from '../utils';
import { Tile } from '../components/Tile';
import { MemberAvatar } from '../components/MemberAvatar';

interface Props { member?: Member; statuses: Member[]; onClick: () => void; }

export default function ProfileTile({ member, statuses, onClick }: Props) {
  const { t } = useTranslation();
  return (
    <Tile glyph="👤" title={t('tabs.profile')} onClick={onClick}>
      {member ? (
        <div className="tile__member-row">
          <MemberAvatar member={member} decorative />
          <span className="tile__member-name">{member.name}</span>
          {member.pronouns && <span className="tile__member-role">{member.pronouns}</span>}
        </div>
      ) : (
        <span className="tile__empty">{t('profile.notSetUp')}</span>
      )}
      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
        {t('profile.statusesCount', { count: statuses.length })}
      </span>
    </Tile>
  );
}
