import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidHex } from '../utils';
import { inkOn } from '../theme';
import { ColorPickerModal } from './ColorPickerModal';

export function ProfileBgChip({ color, value, onChange }: { color: string; value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const filled = value && isValidHex(color);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={t('modal.palBg')}
      title={t('modal.palBg')}
      onClick={() => onChange(!value)}
      style={{ width: 26, height: 26, borderRadius: 13, background: filled ? color : 'var(--surface)', border: `2px solid ${value ? 'var(--accent)' : 'var(--border)'}`, color: filled ? inkOn(color) : 'var(--dim)', fontWeight: 600, fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
      {t('modal.palBgShort')}
    </button>
  );
}

export function CustomHexEntry({ value, onApply, leading }: { value: string; onApply: (hex: string) => void; leading?: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {leading}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t('modal.customColor')}
          title={t('modal.customColor')}
          onClick={() => setOpen(true)}
          style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--surface)', border: `2px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: open ? 'var(--accent)' : 'var(--dim)', fontWeight: 700, fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: 0 }}>
          #
        </button>
      </div>
      <ColorPickerModal open={open} title={t('modal.customColor')} value={value}
        onSave={hex => { onApply(hex); setOpen(false); }}
        onClose={() => setOpen(false)} />
    </div>
  );
}
