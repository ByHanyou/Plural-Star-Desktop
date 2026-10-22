import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { MAX_CUSTOM_COLORS, fmtNum } from '../utils';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

const PREVIEW_COUNT = 8;

export default function ColorsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const filled = useAppStore(s => s.customColors).filter(Boolean);

  return (
    <Tile glyph="🎨" title={t('colors.title')} onClick={onClick}>
      {filled.length === 0 ? (
        <span className="tile__empty">{t('colors.customCount', { count: 0, max: MAX_CUSTOM_COLORS })}</span>
      ) : (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filled.slice(0, PREVIEW_COUNT).map((c, i) => (
            <span key={i} aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: '1px solid var(--border)', display: 'inline-block' }} />
          ))}
          {filled.length > PREVIEW_COUNT && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{fmtNum(filled.length - PREVIEW_COUNT, 0)}</span>}
        </div>
      )}
    </Tile>
  );
}
