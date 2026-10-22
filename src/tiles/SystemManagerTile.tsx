import { useTranslation } from 'react-i18next';
import { groupKind, fmtNum } from '../utils';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function SystemManagerTile({ onClick }: Props) {
  const groups = useAppStore(s => s.groups);
  const { t } = useTranslation();
  const groupCount = groups.filter(g => groupKind(g) === 'group').length;
  const subCount = groups.filter(g => groupKind(g) === 'subsystem').length;
  return (
    <Tile glyph="⊟" title={t('systemManager.title')} onClick={onClick} center>
      <span className="tile__stat">{fmtNum(groups.length, 0)}</span>
      <span className="tile__label">
        {t('share.groupsCount', { count: groupCount })}{subCount > 0 ? ` · ${t('systemManager.subsystemsCount', { count: subCount })}` : ''}
      </span>
    </Tile>
  );
}
