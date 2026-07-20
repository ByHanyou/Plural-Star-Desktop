import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Modal, ConfirmDialog, ColorPicker } from '../components/ui';
import { store, KEYS } from '../storage';
import { NetworkManager } from '../network/NetworkManager';
import { PRESET_COLORS, PresetColor, presetColorName, COLOR_SETS, ColorSet, MAX_CUSTOM_COLORS, normalizeCustomColors } from '../utils';
import { PALETTE } from '../theme';
import { logError } from '../log';

const SET_LABEL_KEYS: Record<ColorSet, string> = {
  default: 'colors.rowDefault',
  darker: 'colors.rowDarker',
  pastel: 'colors.rowPastel',
  neon: 'colors.rowNeon',
};

export default function ColorsView() {
  const { t } = useTranslation();
  const [customColors, setCustomColors] = useState<string[]>(normalizeCustomColors([]));
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('#FF0000');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    store.get<string[]>(KEYS.customColors, []).then(v => setCustomColors(normalizeCustomColors(v)));
  }, []);

  const saveColors = async (next: string[]) => {
    setCustomColors(next);
    try {
      await store.set(KEYS.customColors, next);
      NetworkManager.notifyDataChanged();
    } catch (e) { logError('colors', e); }
  };

  const openSlot = (i: number) => {
    setEditValue(customColors[i] || '#FF0000');
    setEditSlot(i);
  };

  const saveSlot = () => {
    if (editSlot === null) return;
    const v = (editValue || '').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(v)) return;
    const next = [...customColors];
    next[editSlot] = v;
    saveColors(next);
    setEditSlot(null);
  };

  const clearSlot = () => {
    if (editSlot === null) return;
    const next = [...customColors];
    next[editSlot] = '';
    saveColors(next);
    setConfirmClear(false);
    setEditSlot(null);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {COLOR_SETS.map(set => (
        <div key={set} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 8 }}>{t(SET_LABEL_KEYS[set], {defaultValue: set})}</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
            {(PRESET_COLORS as PresetColor[]).filter(p => p.set === set).map(p => (
              <span key={p.hex} role="img" aria-label={presetColorName(p, t)} title={presetColorName(p, t)}
                style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: p.hex, border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        </div>
      ))}

      <h3 style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 8 }}>{t('colors.custom', {defaultValue: 'Custom'})}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: MAX_CUSTOM_COLORS }, (_, i) => {
          const c = customColors[i];
          return c ? (
            <button key={i} onClick={() => openSlot(i)}
              aria-label={`${t('colors.customSlot', {n: i + 1, defaultValue: `Custom ${i + 1}`})}, ${c}`} title={c}
              style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: '1px solid var(--border)', cursor: 'pointer' }} />
          ) : (
            <button key={i} onClick={() => openSlot(i)}
              aria-label={t('colors.emptySlot', {n: i + 1, defaultValue: `Empty slot ${i + 1}`})}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px dashed var(--dim)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>＋</button>
          );
        })}
      </div>

      <Modal
        open={editSlot !== null}
        title={t('colors.customSlot', {n: (editSlot ?? 0) + 1, defaultValue: `Custom ${(editSlot ?? 0) + 1}`})}
        onClose={() => setEditSlot(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {editSlot !== null && !!customColors[editSlot] && (
              <Btn variant="danger" onClick={() => setConfirmClear(true)}>{t('colors.clearSlot', {defaultValue: 'Clear color'})}</Btn>
            )}
            <div style={{ flex: 1 }} />
            <Btn variant="ghost" onClick={() => setEditSlot(null)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" onClick={saveSlot}>{t('common.save')}</Btn>
          </div>
        }>
        <ColorPicker value={editValue} onChange={setEditValue} palette={PALETTE} />
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        title={t('colors.clearSlot', {defaultValue: 'Clear color'})}
        message={t('colors.clearSlotMsg', {defaultValue: 'Remove this custom color?'})}
        danger
        onConfirm={clearSlot}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
