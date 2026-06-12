import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontState, isFrontEmpty, fmtDur, translateMood } from '../utils';

interface Props { front: FrontState | null; members: Member[]; selfId?: string; onClick: () => void; onUpdateStatus: () => void; }

export default function StatusTile({ front, members, selfId, onClick, onUpdateStatus }: Props) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  useEffect(() => { if (!front) return; const id = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(id); }, [front]);
  const getMember = (id: string) => members.find(m => m.id === id);
  const tier = front?.primary;
  const statuses = (tier?.memberIds || [])
    .filter(id => id !== selfId)
    .map(getMember)
    .filter(Boolean) as Member[];

  return (
    <div className="tile" onClick={onClick}>
      <div className="tile__header">
        <div className="tile__glyph">◉</div><span className="tile__title">{t('tabs.status')}</span>
        <button
          onClick={e => { e.stopPropagation(); onUpdateStatus(); }}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer' }}>
          {t('front.update')}
        </button>
      </div>
      <div className="tile__body">
        {isFrontEmpty(front) ? (
          <span className="tile__empty">{t('status.noneSet')}</span>
        ) : (
          <>
            {statuses.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {statuses.map(m => (
                  <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: `${m.color}20`, border: `1px solid ${m.color}50`, fontSize: 11, fontWeight: 500, color: m.color }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                    {m.name}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{t('status.noStatuses')}</span>
            )}
            {tier?.mood && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{translateMood(tier.mood, t)}</div>}
            {front && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>{fmtDur(front.startTime)}</div>}
          </>
        )}
      </div>
    </div>
  );
}
