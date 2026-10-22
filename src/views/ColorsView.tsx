import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Modal, ConfirmDialog, ColorPicker, SaveErrorDialog } from '../components/ui';
import { saveData } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { PRESET_COLORS, presetColorName, COLOR_SETS, ColorSet, MAX_CUSTOM_COLORS, DEFAULT_SLOT_COLOR, withCustomColor } from '../utils';
import { PALETTE } from '../theme';
import { useSaveGuard } from '../hooks/useSaveGuard';

const ROW_HEADING = { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, marginBottom: 8 } as const;

const SET_LABEL_KEYS: Record<ColorSet, string> = {
  default: 'colors.rowDefault',
  darker: 'colors.rowDarker',
  pastel: 'colors.rowPastel',
  neon: 'colors.rowNeon',
};

export default function ColorsView() {
  const { t } = useTranslation();
  const customColors = useAppStore(s => s.customColors);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [editValue, setEditValue] = useState(DEFAULT_SLOT_COLOR);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveError, run, clearSaveError] = useSaveGuard();

  const saveColors = (next: string[]) => run(() => saveData('customColors', next));

  const openSlot = (i: number) => {
    setEditValue(customColors[i] || DEFAULT_SLOT_COLOR);
    setEditSlot(i);
  };

  const commitSlot = async (value: string) => {
    const next = editSlot === null ? null : withCustomColor(customColors, editSlot, value);
    if (next && await saveColors(next)) setEditSlot(null);
  };

  const clearSlot = () => {
    setConfirmClear(false);
    return commitSlot('');
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {COLOR_SETS.map(set => (
        <div key={set} style={{ marginBottom: 18 }}>
          <h3 style={ROW_HEADING}>{t(SET_LABEL_KEYS[set])}</h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
            {PRESET_COLORS.filter(p => p.set === set).map(p => (
              <span key={p.hex} role="img" aria-label={presetColorName(p, t)} title={presetColorName(p, t)}
                style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: p.hex, border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
          </div>
        </div>
      ))}

      <h3 style={ROW_HEADING}>{t('colors.custom')}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: MAX_CUSTOM_COLORS }, (_, i) => {
          const c = customColors[i];
          return c ? (
            <button key={i} onClick={() => openSlot(i)}
              aria-label={t('colors.customSlotValue', {n: i + 1, hex: c})} title={c}
              style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: '1px solid var(--border)', cursor: 'pointer' }} />
          ) : (
            <button key={i} onClick={() => openSlot(i)}
              aria-label={t('colors.emptySlot', {n: i + 1})}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px dashed var(--dim)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>＋</button>
          );
        })}
      </div>

      <Modal
        open={editSlot !== null}
        title={t('colors.customSlot', {n: (editSlot ?? 0) + 1})}
        onClose={() => setEditSlot(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {editSlot !== null && !!customColors[editSlot] && (
              <Btn variant="danger" onClick={() => setConfirmClear(true)}>{t('colors.clearSlot')}</Btn>
            )}
            <div style={{ flex: 1 }} />
            <Btn variant="ghost" onClick={() => setEditSlot(null)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" disabled={!withCustomColor(customColors, editSlot ?? 0, editValue)} onClick={() => void commitSlot(editValue)}>{t('common.save')}</Btn>
          </div>
        }>
        <ColorPicker value={editValue} onChange={setEditValue} palette={PALETTE} />
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        title={t('colors.clearSlot')}
        message={t('colors.clearSlotMsg')}
        danger
        onConfirm={() => void clearSlot()}
        onCancel={() => setConfirmClear(false)}
      />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
