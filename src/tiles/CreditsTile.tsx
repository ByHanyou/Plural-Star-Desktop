import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props { onClick: () => void; }

export default function CreditsTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tile tile--clickable" onClick={onClick}>
      <div className="tile__header">
        <span className="tile__icon">✦</span>
        <span className="tile__title">{t('hub.credits', { defaultValue: 'Credits' })}</span>
      </div>
      <div className="tile__body">
        <span className="tile__label">{t('hub.creditsBlurb', { defaultValue: 'Community contributors' })}</span>
      </div>
    </div>
  );
}
