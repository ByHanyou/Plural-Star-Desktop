import { useTranslation } from 'react-i18next';
import { fmtNum } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function SystemMapTile({ onClick }: Props) {
  const { t } = useTranslation();
  const count = useAppStore(s => s.relationships).length;
  return (
    <Tile glyph="🕸" title={t('systemMap.title')} onClick={onClick} center>
      <span className="tile__stat">{fmtNum(count, 0)}</span>
      <span className="tile__label">{t('systemMap.relationships', { count })}</span>
    </Tile>
  );
}
