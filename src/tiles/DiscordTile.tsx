import { useTranslation } from 'react-i18next';

interface Props { onClick: () => void; }

export default function DiscordTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tile tile--clickable tile--center" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header">
        <div className="tile__glyph" aria-hidden>🗨</div>
        <span className="tile__title">{t('hub.discord')}</span>
      </div>
      <div className="tile__body">
        <span className="tile__label">{t('hub.discordBlurb')}</span>
      </div>
    </div>
  );
}
