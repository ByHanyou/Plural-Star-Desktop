import React, { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudServices } from '../cloud/cloudPlatform';
import { Btn } from './controls';
import { useEscapeKey, useDialogFocus } from './a11y';

export function Modal({ open, title, onClose, footer, children, style }: {
  open: boolean; title: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, onClose);
  useDialogFocus(open, dialogRef);
  if (!open) return null;
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={style} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title" id={titleId} role="heading" aria-level={2}>{title}</span>
          <button className="modal__close" aria-label={t('common.close')} onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

function AlertFrame({ title, message, onDismiss, dialogRef, children }: {
  title: string; message: string; onDismiss: () => void; dialogRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode;
}) {
  const titleId = useId();
  const msgId = useId();
  return (
    <div className="modal-overlay" role="presentation" onClick={onDismiss}>
      <div ref={dialogRef} className="modal modal--sm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={msgId} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title" id={titleId} role="heading" aria-level={2}>{title}</span>
        </div>
        <div className="modal__body">
          <p id={msgId} style={{ color: 'var(--dim)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{message}</p>
        </div>
        <div className="modal__footer">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false, single = false }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean; single?: boolean;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [second, setSecond] = useState(false);
  useEscapeKey(open, onCancel);
  useDialogFocus(open, dialogRef);
  useEffect(() => { if (!open) setSecond(false); }, [open]);
  useEffect(() => { if (second) dialogRef.current?.focus(); }, [second]);
  if (!open) return null;
  const doubled = danger && !single && CloudServices.isLinked();
  const confirm = () => {
    if (doubled && !second) { setSecond(true); return; }
    onConfirm();
  };
  return (
    <AlertFrame dialogRef={dialogRef} onDismiss={onCancel}
      title={second ? t('network.cloudConfirmTitle') : title}
      message={second ? `${message}\n\n${t('network.cloudConfirmMsg')}` : message}>
      <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
      <Btn variant={danger ? 'danger' : 'primary'} onClick={confirm}>{t('common.confirm')}</Btn>
    </AlertFrame>
  );
}

export function ChoiceDialog({ open, title, message, onCancel, children }: {
  open: boolean; title: string; message: string; onCancel: () => void; children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, onCancel);
  useDialogFocus(open, dialogRef);
  if (!open) return null;
  return (
    <AlertFrame dialogRef={dialogRef} onDismiss={onCancel} title={title} message={message}>
      <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
      {children}
    </AlertFrame>
  );
}

export function AlertDialog({ open, title, message, onClose }: {
  open: boolean; title: string; message: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, onClose);
  useDialogFocus(open, dialogRef);
  if (!open) return null;
  return (
    <AlertFrame dialogRef={dialogRef} onDismiss={onClose} title={title} message={message}>
      <Btn variant="primary" onClick={onClose}>{t('common.ok')}</Btn>
    </AlertFrame>
  );
}

export function SaveErrorDialog({ error, onClose }: { error: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return <AlertDialog open={error !== null} title={t('modal.saveFailed')} message={error || ''} onClose={onClose} />;
}

export function ImageErrorDialog({ error, onClose }: { error: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return <AlertDialog open={error !== null} title={t('modal.pfpFailed')} message={error || ''} onClose={onClose} />;
}

export function EditFooter({ onDelete, onCancel, onSave, saveDisabled = false }: {
  onDelete?: () => void; onCancel: () => void; onSave: () => void; saveDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
      <div>{onDelete && <Btn variant="danger" onClick={onDelete}>{t('common.delete')}</Btn>}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" onClick={onCancel}>{t('common.cancel')}</Btn>
        <Btn variant="solid" disabled={saveDisabled} onClick={onSave}>{t('common.save')}</Btn>
      </div>
    </div>
  );
}
