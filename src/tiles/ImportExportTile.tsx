import { useTranslation } from 'react-i18next';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

const ROWS: [string, string][] = [
  ['share.backup', 'share.export'],
  ['share.restoreBackup', 'share.import'],
  ['share.simplyPlural', 'share.import'],
];

export default function ImportExportTile({ onClick }: Props) {
  const { t } = useTranslation();
  return (
    <Tile glyph="⇅" title={t('hub.importExport')} onClick={onClick}>
      {ROWS.map(([label, action]) => (
        <div key={label} className="tile__stat-row">
          <span className="tile__stat-label">{t(label)}</span>
          <span className="tile__stat-value" style={{ color: 'var(--accent)' }}>{t(action)} <span aria-hidden>→</span></span>
        </div>
      ))}
    </Tile>
  );
}
