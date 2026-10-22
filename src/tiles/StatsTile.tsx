import { useTranslation } from 'react-i18next';
import { byValueDesc, countUp, fmtDur, fmtNum, isFrontEntry, buildEffectiveEnd } from '../utils';
import { useAppStore } from '../store/appStore';
import { getTierNameOverride } from '../i18n/terminology';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function StatsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const history = useAppStore(s => s.history);
  const members = useAppStore(s => s.members);
  const frontEntries = history.filter(isFrontEntry);
  const effectiveEnd = buildEffectiveEnd(history);
  const totalsByMember = new Map<string, number>();
  const now = Date.now();
  for (const entry of frontEntries) {
    const dur = (effectiveEnd(entry) ?? now) - entry.startTime;
    for (const id of entry.memberIds) countUp(totalsByMember, id, dur);
  }
  const top = byValueDesc(totalsByMember).slice(0, 3);
  const totalTime = [...totalsByMember.values()].reduce((a, b) => a + b, 0);
  const primaryName = getTierNameOverride('primary');
  return (
    <Tile glyph="⊞" title={t('hub.statistics')} onClick={onClick}>
      {frontEntries.length === 0 ? <span className="tile__empty">{t('history.noHistory')}</span> : (<>
        <div className="tile__stat-row"><span className="tile__stat-label">{t('stats.sessions')}</span><span className="tile__stat-value">{fmtNum(frontEntries.length, 0)}</span></div>
        <div className="tile__stat-row"><span className="tile__stat-label">{t('stats.totalTime')}</span><span className="tile__stat-value">{fmtDur(0, totalTime)}</span></div>
        <div className="tile__tier-label" style={{ marginTop: 8 }}>{primaryName ? t('stats.topTier', { tier: primaryName }) : t('stats.topFronters')}</div>
        {top.map(([id, dur]) => (
          <div key={id} className="tile__stat-row"><span className="tile__stat-label">{members.find(m => m.id === id)?.name || '?'}</span><span className="tile__stat-value">{fmtDur(0, dur)}</span></div>
        ))}
      </>)}
    </Tile>
  );
}
