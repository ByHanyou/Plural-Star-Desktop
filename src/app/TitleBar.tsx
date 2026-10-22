import { useTranslation } from 'react-i18next';
import { DARK_PALETTE, BUILTIN_PALETTES, readableAccentColor } from '../theme';
import { Interp, slots } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useWindowTitle } from './lifecycle';

export function TitleBar({ isSinglet, viewTitle, onOpenProfile }: { isSinglet: boolean; viewTitle: string; onOpenProfile: () => void }) {
  const { t } = useTranslation();
  const system = useAppStore(s => s.system);
  const activePaletteId = useAppStore(s => s.settings.activePaletteId);
  const palettes = useAppStore(s => s.palettes);
  const themeText = useAppStore(s => s.theme.text);
  const systemName = system.name || 'Plural Star';
  const titlePalette = [...BUILTIN_PALETTES, ...palettes].find(p => p.id === activePaletteId) || DARK_PALETTE;
  const titleColor = readableAccentColor(titlePalette.accent, titlePalette.bg, themeText);
  useWindowTitle(viewTitle ? t('hub.windowTitle', { view: viewTitle, system: systemName }) : systemName);

  const titleName = isSinglet ? systemName : (
    <button className="titlebar__name" onClick={onOpenProfile}
      aria-label={systemName} title={t('systemProfile.openHint')}>
      {systemName}
    </button>
  );

  return (
    <div className="titlebar">
      <span className="titlebar__title" style={{ color: titleColor }}>
        {viewTitle ? <Interp text={t('hub.titleBar', { view: viewTitle, ...slots('name'), applyPostProcessor: false })} nodes={{ name: titleName }} /> : titleName}
      </span>
      <div className="titlebar__controls">
        <button className="titlebar__btn titlebar__btn--minimize" aria-label={t('common.minimize')} onClick={() => window.electronAPI.window.minimize()} />
        <button className="titlebar__btn titlebar__btn--maximize" aria-label={t('common.maximize')} onClick={() => window.electronAPI.window.maximize()} />
        <button className="titlebar__btn titlebar__btn--close" aria-label={t('common.close')} onClick={() => window.electronAPI.window.close()} />
      </div>
    </div>
  );
}
