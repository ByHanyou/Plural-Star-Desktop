import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Section } from '../../components/ui';
import { checkForUpdate, appVersion, RELEASES_URL, UpdateCheckResult } from '../../updateCheck';

export const UpdatesSection = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  useEffect(() => {
    let alive = true;
    appVersion().then(v => { if (alive) setCurrent(v); });
    return () => { alive = false; };
  }, []);
  const run = async () => {
    setBusy(true);
    setResult(null);
    const r = await checkForUpdate();
    if (r.current) setCurrent(r.current);
    setResult(r);
    setBusy(false);
  };
  return (
    <>
      <Section label={t('update.title')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {current ? <span style={{ fontSize: 13, color: 'var(--dim)' }}>{t('update.version', { version: current })}</span> : null}
        <span style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? t('update.checking') : t('update.check')}</Btn>
      </div>
      <div role="status" style={{ marginBottom: 14 }}>
        {result?.status === 'update' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t('update.available', { latest: result.latest, current: result.current })}</span>
            <Btn variant="primary" onClick={() => window.open(RELEASES_URL, '_blank')}>{t('update.download')}</Btn>
          </div>
        )}
        {result?.status === 'current' && <span style={{ fontSize: 13, color: 'var(--success)' }}>{t('update.upToDate')}</span>}
        {result?.status === 'error' && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{t('update.failed')}</span>}
      </div>
    </>
  );
};
