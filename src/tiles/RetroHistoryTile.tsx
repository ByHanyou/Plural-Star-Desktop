import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props { onClick: () => void; }

export default function RetroHistoryTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tile" onClick={onClick}>
      <div className="tile__header"><div className="tile__glyph">◷</div><span className="tile__title">{t('hub.retroHistory')}</span></div>
      <div className="tile__body">
        <span className="tile__label">{t('hub.addHistoryDesc')}</span>
      </div>
    </div>
  );
}
