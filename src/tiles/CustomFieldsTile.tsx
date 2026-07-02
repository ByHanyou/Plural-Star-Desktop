import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomFieldDef } from '../utils';
import { store, KEYS } from '../storage';

interface Props { onClick: () => void; }

export default function CustomFieldsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    store.get<CustomFieldDef[]>(KEYS.customFieldDefs, []).then(d => setCount((d || []).length));
  }, []);

  return (
    <div className="tile tile--clickable tile--center" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header">
        <span className="tile__icon">☰</span>
        <span className="tile__title">{t('customFields.title')}</span>
      </div>
      <div className="tile__body">
        <span className="tile__stat">{count}</span>
        <span className="tile__label">{t('customFields.fieldCount', { count })}</span>
      </div>
    </div>
  );
}
