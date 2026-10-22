import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidHex, normalizeHex } from '../../utils';
import { ensureReadable, textFloor } from '../../theme';
import { ColorPickerModal } from '../../components/ColorPickerModal';

export const PalettePreview = ({ bg, accent, text }: { bg: string; accent: string; text: string }) => {
  const { t } = useTranslation();
  const bgHex = normalizeHex(bg);
  const accentHex = normalizeHex(accent);
  const textHex = normalizeHex(text);
  if (!isValidHex(bgHex) || !isValidHex(accentHex)) return null;
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: bgHex, border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: ensureReadable(accentHex, bgHex, 3), fontWeight: 600 }}>{t('modal.palPreviewAccent')} </span>
      <span style={{ fontSize: 13, color: isValidHex(textHex) ? ensureReadable(textHex, bgHex, textFloor(bgHex)) : textHex }}>{t('modal.palPreviewText')}</span>
    </div>
  );
};

export const HexField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const valid = isValidHex(normalizeHex(value));
  const hexId = useId();
  return (
    <div style={{ flex: 1 }}>
      <div className="field__label" id={`${hexId}-label`}>{label}</div>
      <button type="button" aria-haspopup="dialog" aria-labelledby={`${hexId}-label ${hexId}-value`} onClick={() => setOpen(true)}
        className="field__input field__input--mono"
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', cursor: 'pointer', textAlign: 'left' }}>
        <span aria-hidden style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 4, background: valid ? normalizeHex(value) : '#333333', border: '1px solid var(--border)' }} />
        <span id={`${hexId}-value`}>{value}</span>
      </button>
      <ColorPickerModal open={open} title={label} value={value}
        onSave={hex => { onChange(hex); setOpen(false); }}
        onClose={() => setOpen(false)} />
    </div>
  );
};
