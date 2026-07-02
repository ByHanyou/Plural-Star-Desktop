import React from 'react';
import { useTranslation } from 'react-i18next';
import { Member, getInitials } from '../utils';

interface Props { member?: Member; statuses: Member[]; onClick: () => void; }

export default function ProfileTile({ member, statuses, onClick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tile" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">👤</div><span className="tile__title">{t('tabs.profile')}</span></div>
      <div className="tile__body">
        {member ? (
          <div className="tile__member-row">
            <div className="tile__avatar" style={!member.avatar ? { backgroundColor: member.color } : { overflow: 'hidden' }}>
              {member.avatar ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(member.name)}
            </div>
            <span className="tile__member-name">{member.name}</span>
            {member.pronouns && <span className="tile__member-role">{member.pronouns}</span>}
          </div>
        ) : (
          <span className="tile__empty">{t('profile.notSetUp')}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {t('profile.statuses')} ({statuses.length})
        </span>
      </div>
    </div>
  );
}
