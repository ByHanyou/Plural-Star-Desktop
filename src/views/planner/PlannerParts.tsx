import { useEffect, useRef } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, useEscapeKey } from '../../components/ui';
import { tint } from '../../theme';

export function ChoicePills<V>({ choices, value, label, onPick, style }: {
  choices: V[]; value: V; label: (v: V) => string; onPick: (v: V) => void; style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {choices.map(choice => {
        const sel = value === choice;
        return (
          <button key={String(choice)} type="button" onClick={() => onPick(choice)} aria-pressed={sel}
            style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
              background: sel ? tint('var(--accent)', 20) : 'var(--bg)',
              border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, color: sel ? 'var(--accent)' : 'var(--dim)' }}>
            {label(choice)}
          </button>
        );
      })}
    </div>
  );
}

export const fieldLabelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '10px 0 4px' };

export function PlannerForm({ title, onClose, onSave, canSave, children }: {
  title: string; onClose: () => void; onSave: () => void; canSave: boolean; children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEscapeKey(true, onClose);
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button type="button" className="icon-btn" aria-label={t('common.back')} onClick={onClose} style={{ color: 'var(--dim)', fontSize: 18, padding: 4 }}>←</button>
        <h2 ref={headingRef} tabIndex={-1} style={{ flex: 1, fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={onSave} disabled={!canSave}>{t('common.save')}</Btn>
        </div>
      </div>
    </div>
  );
}
