import React from 'react';
import { useTranslation } from 'react-i18next';
import { Member } from '../utils';

interface Props { members: Member[]; onClick: () => void; }

export default function ArchiveTile({ members, onClick }: Props) {
  const { t } = useTranslation();
  const archived = members.filter(m => m.archived && !m.isCustomFront);
  return (
    <div className="tile tile--center" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">🗃</div><span className="tile__title">{t('hub.archive')}</span></div>
      <div className="tile__body">
        {archived.length === 0 ? (
          <span className="tile__empty">{t('members.noArchived')}</span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            {t('members.archived')} ({archived.length})
          </span>
        )}
      </div>
    </div>
  );
}
