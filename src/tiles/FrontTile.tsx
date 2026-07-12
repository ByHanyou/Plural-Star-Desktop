import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTierKey, isFrontEmpty, fmtDur, getInitials } from '../utils';
import { useAppStore } from '../store/appStore';

interface Props { onClick: () => void; onUpdateFront: () => void; }
const TIER_ORDER: FrontTierKey[] = ['primary', 'coFront', 'coConscious'];
const TIER_I18N: Record<FrontTierKey, string> = { primary: 'tier.primaryFront', coFront: 'tier.coFront', coConscious: 'tier.coConscious' };

export default function FrontTile({ onClick, onUpdateFront }: Props) {
  const front = useAppStore(s => s.state.front);
  const members = useAppStore(s => s.state.members);
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  useEffect(() => { if (!front) return; const id = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(id); }, [front]);
  const getMember = (id: string) => members.find(m => m.id === id);
  const renderTier = (tierKey: FrontTierKey) => {
    if (!front) return null;
    const tier = front[tierKey];
    if (!tier.memberIds.length) return null;
    return (
      <React.Fragment key={tierKey}>
        {tierKey !== 'primary' && <div className="tile__tier-label">{t(TIER_I18N[tierKey])}</div>}
        {tier.memberIds.map(id => { const m = getMember(id); if (!m) return null; return (
          <div key={id} className="tile__member-row">
            <div className="tile__avatar" style={!m.avatar ? { backgroundColor: m.color } : { overflow: "hidden" }}>{m.avatar ? <img src={m.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : getInitials(m.name)}</div>
            <span className="tile__member-name">{m.name}</span>
            {tierKey === 'primary' && <span className="tile__duration">{fmtDur(front.startTime)}</span>}
          </div>
        ); })}
        {tier.mood && <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 36 }}>{tier.mood}</div>}
      </React.Fragment>
    );
  };
  return (
    <div className="tile" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header">
        <div className="tile__glyph">◉</div><span className="tile__title">{t('tabs.front')}</span>
        <button
          onClick={e => { e.stopPropagation(); onUpdateFront(); }}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer' }}>
          {t('front.update')}
        </button>
      </div>
      <div className="tile__body">{isFrontEmpty(front) ? <span className="tile__empty">{t('front.noOneFronting')}</span> : TIER_ORDER.map(renderTier)}</div>
    </div>
  );
}
