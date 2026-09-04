import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidHex, normalizeHex } from '../utils';
import { Btn } from './ui';

export function CustomHexEntry({ value, onApply }: { value: string; onApply: (hex: string) => void }) {
  const { t } = useTranslation();
  const errId = useId();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('');
  const valid = isValidHex(normalizeHex(hex));
  const showError = hex.length >= 2 && !valid;
  const apply = () => { if (!valid) return; onApply(normalizeHex(hex)); setOpen(false); };
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <button
        aria-expanded={open}
        aria-label={t('modal.customColor')}
        onClick={() => setOpen(o => { const next = !o; if (next) setHex((value || '').toUpperCase()); return next; })}
        style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--surface)', border: `2px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: open ? 'var(--accent)' : 'var(--dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
        #
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 13, flex: '0 0 auto', background: valid ? normalizeHex(hex) : 'var(--surface)', border: '2px solid var(--border)' }} />
            <input
              value={hex}
              onChange={e => setHex(e.target.value.replace(/\s+/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') apply(); }}
              placeholder="#000000"
              maxLength={7}
              aria-label={t('modal.customColor')}
              aria-invalid={showError}
              aria-describedby={showError ? errId : undefined}
              className="field__input field__input--mono"
              style={{ flex: 1, borderColor: showError ? 'var(--danger)' : undefined }}
            />
            <Btn variant="primary" disabled={!valid} onClick={apply}>{t('common.confirm')}</Btn>
          </div>
          {showError && <div id={errId} role="status" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{t('modal.invalidHex')}</div>}
        </div>
      )}
    </div>
  );
}
