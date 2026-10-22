import type React from 'react';
import { useTranslation } from 'react-i18next';
import { CustomFieldDef, CustomFieldValue, Member, getLocale, fieldInputValue, fieldRangeInput, withFieldValue } from '../../utils';
import { EmptyState, Field, ImageErrorDialog, linkButton, Toggle } from '../../components/ui';
import { useImagePick } from '../../hooks/useImagePick';
import { CLOUD_MEDIA_MARK } from '../../cloud/cloudKeys';

type FieldValue = CustomFieldValue['value'];

const parseNumberInput = (v: string): FieldValue => {
  const cleaned = v.replace(/[^0-9.\-]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && !/[.\-]$/.test(cleaned) && cleaned !== '.' ? n : cleaned;
};

const labeled = (name: string, children: React.ReactNode) => (
  <div>
    <label className="field__label">{name}</label>
    {children}
  </div>
);

const FieldInput = ({ fd, val, setVal, pickImage }: {
  fd: CustomFieldDef; val: FieldValue; setVal: (v: FieldValue) => void; pickImage: () => void;
}) => {
  const { t } = useTranslation();
  switch (fd.type) {
    case 'toggle':
      return <Toggle label={fd.name} value={!!val} onChange={v => setVal(v)} />;
    case 'number':
      return <Field label={fd.name} value={String(val ?? '')} onChange={v => setVal(parseNumberInput(v))} placeholder="0" />;
    case 'color':
      return labeled(fd.name, (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: String(val || '#333'), border: '1px solid var(--border)' }} />
          <input className="field__input" aria-label={fd.name} type="color" value={String(val || '#333333')}
            onChange={e => setVal(e.target.value)} style={{ width: 60, padding: 2 }} />
        </div>
      ));
    case 'date':
    case 'timestamp':
      return labeled(fd.name, (
        <input className="field__input" aria-label={fd.name} type={fd.type === 'timestamp' ? 'datetime-local' : 'date'}
          value={fieldInputValue(fd.type, val)}
          onChange={e => setVal(fd.type === 'timestamp' ? (e.target.value ? new Date(e.target.value).getTime() : null) : (e.target.value || null))} />
      ));
    case 'month':
    case 'monthYear':
      return labeled(fd.name, (
        <input className="field__input" aria-label={fd.name} type="month" value={fieldInputValue(fd.type, val)} onChange={e => setVal(e.target.value || null)} />
      ));
    case 'year':
      return <Field label={fd.name} value={fieldInputValue('year', val)} onChange={v => setVal(v)} placeholder={t('dateFormat.year')} />;
    case 'monthDay': {
      const [month = '', day = ''] = fieldInputValue('monthDay', val).split('-');
      return labeled(fd.name, (
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="field__input" aria-label={fd.name} style={{ flex: 1 }} value={month}
            onChange={e => setVal(`${e.target.value}-${day || '01'}`)}>
            <option value="">{t('customFields.typeMonth')}</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{new Date(2000, i).toLocaleString(getLocale(), { month: 'long' })}</option>)}
          </select>
          <input className="field__input" type="number" min="1" max="31" style={{ width: 70 }}
            aria-label={t('customFields.day')}
            value={day}
            onChange={e => setVal(`${month || '01'}-${e.target.value.padStart(2, '0')}`)}
            placeholder={t('customFields.day')} />
        </div>
      ));
    }
    case 'dateRange': {
      const [start, end] = fieldRangeInput(val);
      return labeled(fd.name, (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field__input" aria-label={t('customFields.rangePart', { field: fd.name, part: t('customFields.startDate') })} type="date" value={start}
            onChange={e => setVal(`${e.target.value}|${end}`)} style={{ flex: 1 }} />
          <input className="field__input" aria-label={t('customFields.rangePart', { field: fd.name, part: t('customFields.endDate') })} type="date" value={end}
            onChange={e => setVal(`${start}|${e.target.value}`)} style={{ flex: 1 }} />
        </div>
      ));
    }
    case 'image':
      return labeled(fd.name, val ? (
        <div>
          <img src={String(val)} alt={fd.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
          <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
            <button type="button" style={{ ...linkButton('var(--accent)', 12), padding: 0 }} onClick={pickImage}>{t('common.change')}</button>
            <button type="button" style={{ ...linkButton('var(--danger)', 12), padding: 0 }} onClick={() => setVal(null)}>{t('common.clear')}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={pickImage}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', padding: 22, border: '1.5px dashed var(--border)', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer' }}>
          <span aria-hidden style={{ fontSize: 20, color: 'var(--dim)' }}>＋</span>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('customFields.addImage')}</span>
        </button>
      ));
    default:
      return (
        <Field label={fd.name} value={String(val || '')} onChange={v => setVal(v)}
          placeholder={fd.name} multiline={fd.type === 'markdown'} pictureTools={fd.type === 'markdown'} />
      );
  }
};

export function CustomFieldEditor({ fieldDefs, values, onChange }: {
  fieldDefs: CustomFieldDef[]; values: Member['customFields']; onChange: (next: CustomFieldValue[]) => void;
}) {
  const { t } = useTranslation();
  const existing = values || [];
  const { pick, imageError, clearImageError } = useImagePick();
  const setFieldVal = (fieldId: string, newVal: FieldValue) => onChange(withFieldValue(values, fieldId, newVal));

  if (fieldDefs.length === 0) {
    return (
      <EmptyState padding={32}>
        {t('customFields.noFieldsInfo')}
      </EmptyState>
    );
  }

  return (
    <div>
      {fieldDefs.map((fd, fdIdx) => {
        const cfv = existing.find(v => v.fieldId === fd.id);
        const val = fd.type === 'image' && cfv?.value === CLOUD_MEDIA_MARK ? '' : (cfv?.value ?? '');
        const setVal = (newVal: FieldValue) => setFieldVal(fd.id, newVal);
        return (
          <div key={fd.id} style={{ marginBottom: 14, borderTop: fdIdx > 0 ? '1px solid var(--border)' : undefined, paddingTop: fdIdx > 0 ? 14 : undefined }}>
            <FieldInput fd={fd} val={val} setVal={setVal} pickImage={() => pick('image', setVal)} />
          </div>
        );
      })}
      <ImageErrorDialog error={imageError} onClose={clearImageError} />
    </div>
  );
}
