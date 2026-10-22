import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Modal, ColorPicker } from './ui';
import { PALETTE } from '../theme';
import { hexOr, isValidHex, normalizeHex } from '../utils';

interface Props {
  open: boolean;
  title: string;
  value: string;
  onSave: (hex: string) => void;
  onClose: () => void;
}

function PickerDialog({ title, value, onSave, onClose }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => hexOr(value, '#FF0000'));
  const save = () => {
    const n = normalizeHex(draft);
    if (isValidHex(n)) onSave(n);
  };
  return (
    <Modal open title={title} onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="solid" onClick={save}>{t('common.save')}</Btn>
        </div>
      }>
      <ColorPicker value={draft} onChange={setDraft} palette={PALETTE} />
    </Modal>
  );
}

export function ColorPickerModal({ open, ...rest }: Props) {
  return open ? <PickerDialog {...rest} /> : null;
}
