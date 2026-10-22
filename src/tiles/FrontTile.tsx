import React from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTierKey, FRONT_TIER_KEYS, TIER_I18N_KEY, isFrontEmpty, fmtDur, translateMood } from '../utils';
import { useAppStore } from '../store/appStore';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { Tile } from '../components/Tile';
import { MemberAvatar } from '../components/MemberAvatar';

interface Props { onClick: () => void; onUpdateFront: () => void; }

export default function FrontTile({ onClick, onUpdateFront }: Props) {
  useMinuteTick();
  const front = useAppStore(s => s.front);
  const members = useAppStore(s => s.members);
  const { t } = useTranslation();
  const getMember = (id: string) => members.find(m => m.id === id);
  const renderTier = (tierKey: FrontTierKey) => {
    if (!front) return null;
    const tier = front[tierKey];
    if (!tier.memberIds.length) return null;
    return (
      <React.Fragment key={tierKey}>
        {tierKey !== 'primary' && <div className="tile__tier-label">{t(TIER_I18N_KEY[tierKey])}</div>}
        {tier.memberIds.map(id => {
          const m = getMember(id);
          if (!m) return null;
          return (
            <div key={id} className="tile__member-row">
              <MemberAvatar member={m} decorative />
              <span className="tile__member-name">{m.name}</span>
              {tierKey === 'primary' && <span className="tile__duration">{fmtDur(front.memberSince?.[id] ?? front.startTime)}</span>}
            </div>
          );
        })}
        {tier.mood && <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 36 }}>{translateMood(tier.mood, t)}</div>}
      </React.Fragment>
    );
  };
  return (
    <Tile glyph="◉" title={t('tabs.front')} onClick={onClick} action={{ label: t('front.update'), onClick: onUpdateFront }}>
      {isFrontEmpty(front) ? <span className="tile__empty">{t('front.noOneFronting')}</span> : FRONT_TIER_KEYS.map(renderTier)}
    </Tile>
  );
}
