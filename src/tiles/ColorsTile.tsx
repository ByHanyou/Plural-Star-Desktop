import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { store, KEYS } from '../storage';
import { normalizeCustomColors, MAX_CUSTOM_COLORS } from '../utils';

interface Props { onClick: () => void; }

export default function ColorsTile({ onClick }: Props) {
  const { t } = useTranslation();
  const [filled, setFilled] = useState<string[]>([]);
  useEffect(() => {
    store.get<string[]>(KEYS.customColors, []).then(v => setFilled(normalizeCustomColors(v).filter(Boolean)));
  }, []);

  return (
    <div className="tile tile--clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
      <div className="tile__header"><div className="tile__glyph">🎨</div><span className="tile__title">{t('colors.title', {defaultValue: 'Colors'})}</span></div>
      <div className="tile__body">
        {filled.length === 0 ? (
          <span className="tile__empty">{t('colors.custom', {defaultValue: 'Custom'})} 0/{MAX_CUSTOM_COLORS}</span>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {filled.slice(0, 8).map((c, i) => (
              <span key={i} aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: '1px solid var(--border)', display: 'inline-block' }} />
            ))}
            {filled.length > 8 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{filled.length - 8}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
