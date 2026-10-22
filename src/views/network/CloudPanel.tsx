import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudServices } from '../../cloud/cloudPlatform';
import { useCloud } from '../../cloud/useCloud';
import { passwordRuleFailing } from '../../cloud/cloudCrypto';
import { cloudRuleText, cloudPhaseText, cloudExceptionText, cloudStatusErrorText } from '../../cloud/cloudMessages';
import { Btn, Field, Hint, Toggle, Section, Modal, ConfirmDialog } from '../../components/ui';
import { fmtTime, fmtPercent } from '../../utils';

const dialogFooter = { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' } as const;

export function CloudPanel({ deviceCount }: { deviceCount: number }) {
  const { t } = useTranslation();
  const cloud = useCloud();
  const [cloudOn, setCloudOn] = useState(false);
  const [cloudPw, setCloudPw] = useState('');
  const [cloudMedia, setCloudMedia] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudExists, setCloudExists] = useState<{ empty: boolean; canClear: boolean } | null>(null);
  const [cloudImportConfirm, setCloudImportConfirm] = useState(false);
  const [cloudClearStep, setCloudClearStep] = useState<0 | 1 | 2>(0);
  const [cloudUnlinkStep, setCloudUnlinkStep] = useState<0 | 1 | 2>(0);
  const [cloudUnlinking, setCloudUnlinking] = useState(false);
  const cloudRule = passwordRuleFailing(cloudPw);
  const cloudBusy = cloud.phase !== 'idle';
  const shownError = cloudError ?? (cloud.lastError ? cloudStatusErrorText(cloud, t) : null);
  const showCloudError = (e: unknown) => setCloudError(cloudExceptionText(e, t));

  const onCloudToggle = (v: boolean) => {
    if (v && deviceCount > 0) {
      setCloudError(t('network.cloudWarning'));
      return;
    }
    setCloudError(null);
    setCloudOn(v);
    if (!v) { setCloudPw(''); CloudServices.cancelPendingLink(); }
  };
  const onCloudSubmit = async () => {
    if (cloudRule || cloudBusy) return;
    setCloudError(null);
    try {
      const outcome = await CloudServices.linkWithPassword(cloudPw, cloudMedia);
      if (outcome.kind === 'created') { setCloudPw(''); return; }
      setCloudExists({ empty: outcome.empty, canClear: outcome.canClear });
    } catch (e) {
      showCloudError(e);
    }
  };
  const onCloudImportFinal = () => {
    setCloudImportConfirm(false);
    CloudServices.importExisting(cloudMedia)
      .then(() => setCloudPw(''))
      .catch(showCloudError);
  };
  const onCloudPendingCancel = () => {
    setCloudExists(null);
    setCloudClearStep(0);
    CloudServices.cancelPendingLink();
  };
  const onCloudClearFinal = () => {
    setCloudClearStep(0);
    CloudServices.clearAndUpload(cloudMedia)
      .then(() => setCloudPw(''))
      .catch(showCloudError);
  };
  const onCloudUnlinkFinal = () => {
    setCloudUnlinkStep(0);
    setCloudUnlinking(true);
    CloudServices.unlink().then(r => {
      setCloudOn(false);
      if (!r.deviceRemoved) setCloudError(t('network.cloudUnlinkUnreached', { code: r.errorCode || 'CLOUD-APP' }));
    }).catch(showCloudError)
      .finally(() => setCloudUnlinking(false));
  };
  const startImport = () => { setCloudExists(null); setCloudImportConfirm(true); };

  const progressLine = (margin: string) => cloudBusy && (
    <p style={{ fontSize: 11, color: 'var(--accent)', margin }} aria-live="polite">
      <span className="spinner" aria-hidden style={{ marginRight: 6 }} />
      {cloudPhaseText(cloud.phase, t)}{cloud.progress > 0 && cloud.progress < 1 ? ` ${fmtPercent(cloud.progress, 0)}` : ''}
    </p>
  );
  const errorLine = (margin: string) => shownError && (
    <p role="alert" style={{ fontSize: 11, color: 'var(--danger)', margin }}>{t('network.cloudError', { error: shownError })}</p>
  );

  return (
    <>
      {deviceCount > 0 && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '14px 0 0' }}>{t('network.cloudWarning')}</p>}

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}><Section label={t('network.cloudTitle')} /></div>
          <span style={{ fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 700, color: 'var(--info)', border: '1px solid var(--info)', borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap' }}>
            {t('network.cloudExperimental')}
          </span>
        </div>
        <Hint>{t('network.cloudDesc')}</Hint>

        {cloud.linked ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>{t('network.cloudLinkedDevices', { n: cloud.deviceCount })}</p>
            {cloud.lastSyncAt > 0 && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{t('network.cloudLastSync', { time: fmtTime(cloud.lastSyncAt) })}</p>}
            {cloud.pendingKeys > 0 && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{t('network.cloudPending', { n: cloud.pendingKeys })}</p>}
            {progressLine('6px 0 0')}
            {errorLine('6px 0 0')}
            <div style={{ marginTop: 12 }}>
              <Toggle value={cloud.mediaTier} disabled={cloudBusy} onChange={v => CloudServices.setMediaTier(v).catch(showCloudError)}
                label={t('network.cloudMediaTier')} description={t('network.cloudMediaTierDesc')} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Btn variant="danger" onClick={() => setCloudUnlinkStep(1)} aria-busy={cloudUnlinking}>{t('network.cloudUnlink')}</Btn>
              {cloudUnlinking && <span className="spinner" role="progressbar" aria-label={cloudPhaseText(cloud.phase, t) || t('network.cloudUnlinking')} style={{ color: 'var(--accent)' }} />}
              {cloudUnlinking && <span style={{ fontSize: 11, color: 'var(--accent)' }}>{t('network.cloudUnlinking')}</span>}
            </div>
          </>
        ) : (
          <>
            <Toggle value={cloudOn} onChange={onCloudToggle} label={t('network.cloudEnable')} description={cloud.available ? undefined : t('network.cloudUnavailable')} />
            {cloud.removedFromVault && (
              <p aria-live="polite" style={{ fontSize: 11, color: 'var(--danger)', margin: '8px 0 0' }}>{t('network.cloudRemovedHere')}</p>
            )}
            {cloudOn && (
              <div style={{ marginTop: 12 }}>
                <Field label={t('network.cloudPassword')} value={cloudPw} onChange={setCloudPw} type="password" placeholder={t('network.cloudPassword')} />
                <p style={{ fontSize: 11, color: cloudPw && cloudRule ? 'var(--danger)' : 'var(--muted)', margin: '-6px 0 12px' }} aria-live="polite">
                  {cloudPw && cloudRule ? cloudRuleText(cloudRule, t) : t('network.cloudPasswordHint')}
                </p>
                <Toggle value={cloudMedia} onChange={setCloudMedia} label={t('network.cloudMediaTier')} description={t('network.cloudMediaTierDesc')} />
                <div style={{ marginTop: 12 }}>
                  <Btn onClick={() => void onCloudSubmit()} disabled={!!cloudRule || cloudBusy || !cloud.available}>{t('network.cloudSubmit')}</Btn>
                </div>
                {progressLine('8px 0 0')}
              </div>
            )}
            {errorLine('8px 0 0')}
          </>
        )}
      </div>

      <ConfirmDialog open={!!cloudExists && !cloudExists.empty && !cloudExists.canClear} title={t('network.cloudExistsTitle')} message={t('network.cloudExistsMsg')} danger single
        onConfirm={startImport}
        onCancel={() => { setCloudExists(null); CloudServices.cancelPendingLink(); }} />
      <Modal
        open={!!cloudExists && (cloudExists.empty || cloudExists.canClear)}
        title={t('network.cloudExistsTitle')}
        onClose={onCloudPendingCancel}
        footer={
          <div style={dialogFooter}>
            <Btn variant="ghost" onClick={onCloudPendingCancel}>{t('common.cancel')}</Btn>
            {!cloudExists?.empty && <Btn variant="danger" onClick={startImport}>{t('network.cloudImport')}</Btn>}
            <Btn variant="danger" onClick={() => { setCloudExists(null); setCloudClearStep(1); }}>{t('network.cloudClear')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{cloudExists?.empty ? t('network.cloudEmptyMsg') : t('network.cloudExistsMsg')}</p>
      </Modal>
      <Modal key={cloudClearStep}
        open={cloudClearStep > 0}
        title={cloudClearStep === 2 ? t('network.cloudClearConfirm2Title') : t('network.cloudClearTitle')}
        onClose={onCloudPendingCancel}
        footer={
          <div style={dialogFooter}>
            <Btn variant="ghost" onClick={onCloudPendingCancel}>{t('common.cancel')}</Btn>
            <Btn variant="danger" onClick={cloudClearStep === 2 ? onCloudClearFinal : () => setCloudClearStep(2)}>{t('network.cloudClear')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{cloudClearStep === 2 ? t('network.cloudClearConfirm2') : t('network.cloudClearMsg')}</p>
      </Modal>
      <ConfirmDialog open={cloudImportConfirm} title={t('network.cloudImportConfirmTitle')} message={t('network.cloudImportConfirmMsg')} danger single
        onConfirm={onCloudImportFinal}
        onCancel={() => { setCloudImportConfirm(false); CloudServices.cancelPendingLink(); }} />
      <ConfirmDialog key={cloudUnlinkStep} open={cloudUnlinkStep > 0} title={t('network.cloudUnlink')}
        message={cloudUnlinkStep === 2 ? t('network.cloudUnlinkConfirm2') : t('network.cloudUnlinkMsg')} danger single
        onConfirm={cloudUnlinkStep === 2 ? onCloudUnlinkFinal : () => setCloudUnlinkStep(2)} onCancel={() => setCloudUnlinkStep(0)} />
    </>
  );
}
