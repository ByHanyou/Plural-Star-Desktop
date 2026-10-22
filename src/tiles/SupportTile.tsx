import { useTranslation } from 'react-i18next';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function SupportTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <Tile glyph="☕" title={t('hub.supportPS')} onClick={onClick} center>
      <span className="tile__label">{t('hub.supportPSBlurb')}</span>
    </Tile>
  );
}
