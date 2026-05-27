import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props { onClick: () => void; }

export default function DiscordTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tile tile--clickable" onClick={onClick}>
      <div className="tile__header">
        <div className="tile__glyph">🗨</div>
        <span className="tile__title">{t('hub.discord', { defaultValue: 'Discord' })}</span>
      </div>
      <div className="tile__body">
        <span className="tile__label">{t('hub.discordBlurb', { defaultValue: 'Community chat & support' })}</span>
      </div>
    </div>
  );
}
