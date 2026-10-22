import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { SrOnly } from '../components/ui';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function WhiteboardTile({ onClick }: Props) {
  const { t } = useTranslation();
  const strokeCount = useAppStore(s => s.whiteboard).length;

  return (
    <Tile glyph="🖌" title={t('whiteboard.title')} onClick={onClick}>
      {strokeCount === 0 ? (
        <span className="tile__empty">{t('whiteboard.draw')}</span>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text)' }}><span aria-hidden>✎ {strokeCount}</span><SrOnly>{t('whiteboard.strokeCount', { count: strokeCount })}</SrOnly></div>
      )}
    </Tile>
  );
}
