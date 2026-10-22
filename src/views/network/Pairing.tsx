import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, SrOnly } from '../../components/ui';
import { logError } from '../../utils/log';
import { useFlash } from '../../hooks/useFlash';
import { fmtCountdown } from '../../utils';

export type PairingKind = 'friend' | 'device';

export function Pairing({ kind, code, expiresAt, value, onChange, busy, canGenerate, onGenerate, onEnter }: {
  kind: PairingKind; code: string | null; expiresAt: number | null; value: string; onChange: (s: string) => void;
  busy: boolean; canGenerate: boolean; onGenerate: () => void; onEnter: (value: string, clear: () => void) => void;
}) {
  const { t } = useTranslation();
  const [copied, flashCopied] = useFlash<true>(1500);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [code]);

  const onCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      flashCopied(true);
    } catch (e) { logError('network', e); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Field
            label={kind === 'device' ? t('network.deviceCode') : t('network.enterTheirCode')}
            value={value}
            onChange={onChange}
            placeholder={kind === 'device' ? t('network.deviceCodePlaceholder') : t('network.enterCodePlaceholder')}
            mono
          />
        </div>
        <Btn onClick={() => onEnter(value, () => onChange(''))} disabled={busy || !value.trim()} style={{ marginBottom: 14 }}>{t('network.add')}</Btn>
      </div>
      <div style={{ marginTop: 10 }}>
        <SrOnly><span role="status">{code && copied ? t('network.codeCopied') : ''}</span></SrOnly>
        {code ? (
          <button
            onClick={() => void onCopy()}
            aria-label={t('network.yourCodeLabel', { code })}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '12px 8px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: kind === 'device' ? 16 : 19, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>{code}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {copied ? t('network.codeCopied') : `${t('network.tapToCopy')} · ${t('network.expiresIn', { time: fmtCountdown(expiresAt) })}`}
            </div>
          </button>
        ) : (
          <Btn onClick={onGenerate} disabled={busy || !canGenerate}>{t('network.generateCode')}</Btn>
        )}
      </div>
    </>
  );
}
