import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { plannerNextOccurrence, plannerOccursOnDay } from '../utils';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function PlannerTile({ onClick }: Props) {
  const { t } = useTranslation();
  const planner = useAppStore(s => s.planner);
  const now = new Date();
  const appts = planner.appointments || [];
  const todayCount = appts.filter(a => plannerOccursOnDay(a.time, a.repeat, now)).length;
  let bestTs: number | null = null;
  let nextTitle: string | null = null;
  for (const a of appts) {
    const occ = plannerNextOccurrence(a.time, a.repeat, now.getTime());
    if (occ != null && (bestTs == null || occ < bestTs)) { bestTs = occ; nextTitle = a.title; }
  }

  return (
    <Tile glyph="🗓" title={t('planner.title')} onClick={onClick}>
      {todayCount === 0 && !nextTitle ? (
        <span className="tile__empty">{t('planner.emptyDay')}</span>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          {todayCount > 0 ? t('planner.apptCount', { count: todayCount }) : nextTitle}
        </div>
      )}
    </Tile>
  );
}
