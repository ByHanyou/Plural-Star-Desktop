import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImportProgress, progressFraction } from '../import/progress';
import { fmtPercent, fmtNum } from '../utils';
import { ConfirmDialog, useDialogFocus, useEscapeKey } from './ui';

interface Props {
  visible: boolean;
  progress: ImportProgress | null;
  onCancel?: () => void;
}

export function ImportWaitOverlay({ visible, progress, onCancel }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stopping = !!progress?.stopping;
  const [confirmStop, setConfirmStop] = useState(false);
  useDialogFocus(visible, dialogRef);
  // Escape asks first; the import only stops once the warning is confirmed.
  useEscapeKey(visible && !!onCancel && !stopping && !confirmStop, () => setConfirmStop(true));
  useEffect(() => { if (!visible || stopping) setConfirmStop(false); }, [visible, stopping]);
  if (!visible) return null;
  const fraction = progressFraction(progress);
  const pct = fraction === null ? null : Math.round(fraction * 100);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t('share.importing')}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 22, width: 'min(420px, 90vw)', boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {t('share.importing')}
        </div>
        {!!progress?.label && (
          <div role="status" style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{progress.label}</div>
        )}

        <div
          role="progressbar"
          aria-label={t('share.importing')}
          aria-valuetext={pct === null ? (progress?.label || undefined) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, background: 'var(--accent)',
            width: pct === null ? '30%' : `${pct}%`,
            transition: 'width 180ms linear',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--dim)' }}>
          <span>{pct === null ? '' : fmtPercent(pct / 100, 0)}</span>
          {!!progress?.total && progress.total > 0 && <span>{t('share.importProgressCount', { done: fmtNum(progress.done ?? 0, 0), total: fmtNum(progress.total, 0) })}</span>}
        </div>

        {stopping ? (
          <div role="status" style={{ marginTop: 12, fontSize: 12, color: 'var(--accent)' }}>
            {t('share.importStopping', { defaultValue: 'Finishing this step, then stopping…' })}
          </div>
        ) : onCancel ? (
          <button
            onClick={onCancel}
            title={t('share.importCancelHint', { defaultValue: 'Stops after the current step finishes. Steps already done are kept.' })}
            style={{
              marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 10,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted)', cursor: 'pointer', fontWeight: 600,
            }}>
            {t('common.cancel')}
          </button>
        ) : null}
      </div>
      <ConfirmDialog open={confirmStop} title={t('share.importCancelTitle')} message={t('share.importCancelHint')}
        onConfirm={() => { setConfirmStop(false); onCancel?.(); }}
        onCancel={() => setConfirmStop(false)} />
    </div>
  );
}
