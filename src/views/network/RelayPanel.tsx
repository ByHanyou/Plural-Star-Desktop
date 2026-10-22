import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Hint, Section } from '../../components/ui';
import { NetworkManager } from '../../network/NetworkManager';

export function RelayPanel({ busy, onSave }: { busy: boolean; onSave: (url: string | undefined, token: string | undefined) => void }) {
  const { t } = useTranslation();
  const [relayUrl, setRelayUrl] = useState(() => NetworkManager.relaySettings().relayUrl || '');
  const [relayToken, setRelayToken] = useState(() => NetworkManager.relaySettings().token || '');
  return (
    <div style={{ marginTop: 24 }}>
      <Section label={t('network.customNetwork')} />
      <Hint>{t('network.customNetworkDesc')}</Hint>
      <Field label={t('network.relayUrl')} value={relayUrl} onChange={setRelayUrl} placeholder="http://192.168.1.20:7523" mono />
      <Field label={t('network.relayToken')} value={relayToken} onChange={setRelayToken} placeholder="-" mono />
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 12px' }}>{t('network.relayHint')}</p>
      <Btn onClick={() => onSave(relayUrl.trim() || undefined, relayToken.trim() || undefined)} disabled={busy}>
        {t('network.saveRelay')}
      </Btn>
    </div>
  );
}
