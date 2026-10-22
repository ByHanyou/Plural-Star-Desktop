import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { Member, fmtTime, fmtDur, frontSessionStart, isFrontEmpty, membersByIds, statusIdsOf, translateMood, fmtNum } from '../utils';
import { Btn, PageHeading, SaveErrorDialog, clickable } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { MemberPill } from '../components/MemberChip';
import { SetStatusModal, StatusSave } from './front/SetStatusModal';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

interface Props {
  statuses: Member[];
  selfId?: string;
  onSaveStatus: StatusSave;
  onEnsureSelf?: () => Promise<Member>;
}

export default function StatusView({ statuses, selfId, onSaveStatus, onEnsureSelf }: Props) {
  useMinuteTick();
  const front = useAppStore(s => s.front);
  const members = useAppStore(s => s.members);
  const settings = useAppStore(s => s.settings);
  const { t } = useTranslation();
  const [showSet, setShowSet] = useState(false);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const openSet = () => void run(async () => {
    if (onEnsureSelf) await onEnsureSelf();
    setShowSet(true);
  });

  const empty = isFrontEmpty(front);
  const tier = front?.primary;
  const sinceAt = front ? frontSessionStart(front) : null;
  const activeStatuses = membersByIds(statusIdsOf(front, selfId), id => members.find(m => m.id === id));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <PageHeading>{t('status.current')}</PageHeading>
        <Btn variant="solid" onClick={openSet}>{t('status.update')}</Btn>
      </div>

      {empty ? (
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('status.noneSet')}</span>
        </div>
      ) : (
        <div style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
          {...clickable(openSet, t('status.update'))}>
          {activeStatuses.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {activeStatuses.map(m => (
                <MemberPill key={m.id} member={m} fontSize={13} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontStyle: 'italic' }}>{t('status.noStatuses')}</div>
          )}
          {tier?.mood ? <Row label={t('modal.mood')} value={translateMood(tier.mood, t)} /> : null}
          {tier?.location ? <Row label={t('modal.location')} value={tier.location} /> : null}
          {tier?.energyLevel !== undefined ? <Row label={t('energy.level')} value={t('energy.outOfTen', { value: fmtNum(tier.energyLevel, 0) })} /> : null}
          {tier?.note ? <Row label={t('modal.note')} value={tier.note} /> : null}
          {sinceAt !== null ? (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              {t('status.since', { time: fmtTime(sinceAt) })} · {fmtDur(sinceAt)}
            </div>
          ) : null}
        </div>
      )}

      <SetStatusModal
        open={showSet}
        onClose={() => setShowSet(false)}
        onSave={onSaveStatus}
        statuses={statuses}
        selfId={selfId}
        current={front}
        settings={settings}
      />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
