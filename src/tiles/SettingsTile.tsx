import { useTranslation } from 'react-i18next';
import { DARK_PALETTE, LIGHT_PALETTE } from '../theme';
import { useAppStore } from '../store/appStore';
import { fmtNum } from '../utils';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function SettingsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const settings = useAppStore(s => s.settings);
  const paletteName = settings.activePaletteId === DARK_PALETTE.id ? t('modal.paletteObsidian') : settings.activePaletteId === LIGHT_PALETTE.id ? t('modal.paletteSteel') : t('colors.custom');
  const rows: [string, string][] = [
    [t('modal.palette'), paletteName],
    [t('modal.language'), t(`language.${settings.language}`)],
    [t('modal.textSize'), `${fmtNum(settings.textScale, 2)}×`],
    [t('modal.notifications'), settings.notificationsEnabled ? t('common.on') : t('common.off')],
  ];
  return (
    <Tile glyph="⚙" title={t('modal.systemSettings')} onClick={onClick}>
      {rows.map(([label, value]) => (
        <div key={label} className="tile__stat-row"><span className="tile__stat-label">{label}</span><span className="tile__stat-value">{value}</span></div>
      ))}
    </Tile>
  );
}
