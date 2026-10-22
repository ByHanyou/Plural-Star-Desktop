import { useTranslation } from 'react-i18next';
import { fmtNum } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function PollsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const activeCount = useAppStore(s => s.polls).filter(x => !x.closedAt).length;

  return (
    <Tile glyph="📊" title={t('polls.title')} onClick={onClick} center>
      <span className="tile__stat">{fmtNum(activeCount, 0)}</span>
      <span className="tile__label">{t('polls.activeCount', { count: activeCount })}</span>
    </Tile>
  );
}
