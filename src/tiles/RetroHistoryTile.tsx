import { useTranslation } from 'react-i18next';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function RetroHistoryTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <Tile glyph="◷" title={t('hub.retroHistory')} onClick={onClick} center>
      <span className="tile__label">{t('hub.addHistoryDesc')}</span>
    </Tile>
  );
}
