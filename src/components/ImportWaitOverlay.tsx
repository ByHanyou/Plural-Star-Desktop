import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImportProgress, progressFraction } from '../import/progress';

interface Props {
  visible: boolean;
  progress: ImportProgress | null;
  onCancel?: () => void;
}

/**
 * Blocking "please wait" screen for imports — the Desktop twin of the mobile
 * overlay. Not dismissible: an import is mid-run and quietly handing the window
 * back would leave the user in a half-populated app with no sign anything is
 * still happening. Cancel asks for a stop at the next phase boundary.
 */
export function ImportWaitOverlay({ visible, progress, onCancel }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;
  const fraction = progressFraction(progress);
  const pct = fraction === null ? null : Math.round(fraction * 100);
  const stopping = !!progress?.stopping;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
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
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{progress.label}</div>
        )}

        <div
          role="progressbar"
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
          <span>{pct === null ? '' : `${pct}%`}</span>
          {!!progress?.total && progress.total > 0 && <span>{`${progress.done ?? 0}/${progress.total}`}</span>}
        </div>

        {stopping ? (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent)' }}>
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
    </div>
  );
}
