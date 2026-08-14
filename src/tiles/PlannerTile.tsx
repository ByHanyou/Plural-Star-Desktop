import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { store, KEYS } from '../storage';
import { PlannerData, plannerNextOccurrence, plannerOccursOnDay } from '../utils';

interface Props { onClick: () => void; }

export default function PlannerTile({ onClick }: Props) {
  const { t } = useTranslation();
  const [todayCount, setTodayCount] = useState(0);
  const [nextTitle, setNextTitle] = useState<string | null>(null);

  useEffect(() => {
    store.get<PlannerData>(KEYS.planner, null).then(p => {
      if (!p) return;
      const now = new Date();
      const appts = p.appointments || [];
      setTodayCount(appts.filter(a => plannerOccursOnDay(a.time, a.repeat, now)).length);
      let bestTs: number | null = null;
      let bestTitle: string | null = null;
      for (const a of appts) {
        const occ = plannerNextOccurrence(a.time, a.repeat, now.getTime());
        if (occ != null && (bestTs == null || occ < bestTs)) { bestTs = occ; bestTitle = a.title; }
      }
      setNextTitle(bestTitle);
    });
  }, []);

  return (
    <div className="tile tile--clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph" aria-hidden>🗓</div><span className="tile__title">{t('planner.title')}</span></div>
      <div className="tile__body">
        {todayCount === 0 && !nextTitle ? (
          <span className="tile__empty">{t('planner.emptyDay')}</span>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            {todayCount > 0 ? t('planner.apptCount', { count: todayCount }) : nextTitle}
          </div>
        )}
      </div>
    </div>
  );
}
