import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, linkButton } from '../components/ui';
import { useAvailableUpdate, RELEASES_URL } from '../updateCheck';

export function UpdateBanner() {
  const { t } = useTranslation();
  const update = useAvailableUpdate();
  const [hidden, setHidden] = useState(false);
  if (!update || hidden) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'var(--accent-bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t('update.available', { latest: update.latest, current: update.current })}</span>
      <Btn variant="primary" onClick={() => window.open(RELEASES_URL, '_blank')}>{t('update.download')}</Btn>
      <button type="button" onClick={() => setHidden(true)} aria-label={t('common.close')} title={t('common.close')}
        style={{ ...linkButton('var(--dim)', 14), padding: 4 }}>✕</button>
    </div>
  );
}
