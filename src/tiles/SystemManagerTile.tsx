import React from 'react';
import { useTranslation } from 'react-i18next';
import { groupKind } from '../utils';
import { useAppStore } from '../store/appStore';

interface Props { onClick: () => void; }

export default function SystemManagerTile({ onClick }: Props) {
  const groups = useAppStore(s => s.state.groups);
  const { t } = useTranslation();
  const groupCount = groups.filter(g => groupKind(g) === 'group').length;
  const subCount = groups.filter(g => groupKind(g) === 'subsystem').length;
  return (
    <div className="tile tile--clickable tile--center" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header">
        <span className="tile__icon">⊟</span>
        <span className="tile__title">{t('systemManager.title')}</span>
      </div>
      <div className="tile__body">
        <span className="tile__stat">{groups.length}</span>
        <span className="tile__label">
          {t('share.groupsCount', { count: groupCount })}{subCount > 0 ? ` · ${t('systemManager.subsystemsCount', { count: subCount })}` : ''}
        </span>
      </div>
    </div>
  );
}
