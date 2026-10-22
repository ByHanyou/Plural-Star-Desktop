import { useTranslation } from 'react-i18next';
import { Btn, Dropdown, Field, Section, Toggle } from './ui';
import { config, LOG_LEVELS, LogLevel } from '../config';
import { useDevOverrides } from '../hooks/useDevOverrides';
import { getLocale } from '../utils';

const LEVEL_COLOR: Partial<Record<LogLevel, string>> = { error: 'var(--danger)', warn: 'var(--accent)' };

export default function DevSettings() {
  const { t } = useTranslation();
  const { over, json, setJson, jsonError, set, applyJson, reset, logs } = useDevOverrides();
  const c = config();
  return (
    <>
      <Section label={t('dev.title')} />
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{t('dev.note')}</div>
      <Field label={t('dev.relayUrl')} value={over.relayUrl ?? ''} onChange={v => set('relayUrl', v.trim() || undefined)} placeholder={c.relayUrl || t('dev.defaultNetwork')} />
      <Field label={t('dev.gatewayUrl')} value={over.gatewayUrl ?? ''} onChange={v => set('gatewayUrl', v.trim() || undefined)} placeholder={c.gatewayUrl || t('dev.defaultGateway')} />
      <Dropdown<LogLevel> label={t('dev.logLevel')} value={c.logLevel} options={[...LOG_LEVELS]} onChange={v => set('logLevel', v)} />
      <Toggle label={t('dev.verboseNetwork')} value={c.verboseNetwork} onChange={v => set('verboseNetwork', v)} />
      <Toggle label={t('dev.skipUpdateCheck')} value={c.skipUpdateCheck} onChange={v => set('skipUpdateCheck', v)} />
      <Field label={t('dev.overridesJson')} value={json} onChange={setJson} multiline mono />
      {jsonError ? <div role="alert" style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>{jsonError}</div> : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Btn variant="ghost" onClick={applyJson}>{t('dev.applyJson')}</Btn>
        <Btn variant="danger" onClick={reset}>{t('dev.resetAll')}</Btn>
      </div>
      <Section label={t('dev.recentLog', { count: logs.length })} />
      <div style={{ maxHeight: 220, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, marginBottom: 12, fontFamily: 'monospace', fontSize: 11 }}>
        {logs.map((e, i) => (
          <div key={`${e.at}-${i}`} style={{ color: LEVEL_COLOR[e.level] || 'var(--dim)', padding: '1px 4px', whiteSpace: 'pre-wrap' }}>
            {new Date(e.at).toLocaleTimeString(getLocale())} {e.level} [{e.tag}] {e.message}
          </div>
        ))}
      </div>
    </>
  );
}
