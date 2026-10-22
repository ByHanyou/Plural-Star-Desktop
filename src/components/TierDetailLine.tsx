import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FrontTier, fmtNum, translateMood } from '../utils';
import { SrOnly } from './ui';

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { t } = useTranslation();
  return <span><span aria-hidden>{icon} {value}</span><SrOnly>{t('common.labelValue', { label, value })}</SrOnly></span>;
}

export function TierDetailLine({ tier, style }: { tier: FrontTier; style?: CSSProperties }) {
  const { t } = useTranslation();
  if (!tier.mood && !tier.location && !tier.energyLevel && !tier.note) return null;
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--dim)', ...style }}>
      {tier.mood && <Detail icon="😊" label={t('modal.mood')} value={translateMood(tier.mood, t)} />}
      {tier.location && <Detail icon="📍" label={t('modal.location')} value={tier.location} />}
      {!!tier.energyLevel && <Detail icon="⚡" label={t('energy.label')} value={t('energy.outOfTen', { value: fmtNum(tier.energyLevel, 0) })} />}
      {tier.note && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{tier.note}</span>}
    </div>
  );
}
