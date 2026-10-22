import { useTranslation } from 'react-i18next';
import { isFrontEmpty, fmtDur, frontSessionStart, membersByIds, statusIdsOf, translateMood } from '../utils';
import { useAppStore } from '../store/appStore';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { Tile } from '../components/Tile';
import { MemberPill } from '../components/MemberChip';

interface Props { selfId?: string; onClick: () => void; onUpdateStatus: () => void; }

export default function StatusTile({ selfId, onClick, onUpdateStatus }: Props) {
  useMinuteTick();
  const front = useAppStore(s => s.front);
  const members = useAppStore(s => s.members);
  const { t } = useTranslation();
  const tier = front?.primary;
  const statuses = membersByIds(statusIdsOf(front, selfId), id => members.find(m => m.id === id));

  return (
    <Tile glyph="◉" title={t('tabs.status')} onClick={onClick} action={{ label: t('front.update'), onClick: onUpdateStatus }}>
      {isFrontEmpty(front) ? (
        <span className="tile__empty">{t('status.noneSet')}</span>
      ) : (
        <>
          {statuses.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {statuses.map(m => (
                <MemberPill key={m.id} member={m} fontSize={11} />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('status.noStatuses')}</span>
          )}
          {tier?.mood && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{translateMood(tier.mood, t)}</div>}
          {front && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>{fmtDur(frontSessionStart(front))}</div>}
        </>
      )}
    </Tile>
  );
}
