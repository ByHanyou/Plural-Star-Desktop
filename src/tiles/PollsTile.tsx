import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberPoll } from '../utils';
import { store, KEYS } from '../storage';

interface Props { onClick: () => void; }

export default function PollsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const [activeCount, setActiveCount] = useState(0);
  useEffect(() => {
    store.get<MemberPoll[]>(KEYS.polls, []).then(p => {
      setActiveCount((p || []).filter(x => !x.closedAt).length);
    });
  }, []);

  return (
    <div className="tile tile--clickable tile--center" onClick={onClick}>
      <div className="tile__header">
        <span className="tile__icon">📊</span>
        <span className="tile__title">{t('polls.title')}</span>
      </div>
      <div className="tile__body">
        <span className="tile__stat">{activeCount}</span>
        <span className="tile__label">{t('polls.activeCount', { count: activeCount })}</span>
      </div>
    </div>
  );
}
