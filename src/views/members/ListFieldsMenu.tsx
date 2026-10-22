import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Toggle, useEscapeKey } from '../../components/ui';
import type { MemberListFields } from './MemberCard';

const FIELD_KEYS = ['pronouns', 'roles', 'groups', 'descriptions'] as const;
const FIELD_LABEL: Record<(typeof FIELD_KEYS)[number], string> = {
  pronouns: 'members.fieldPronouns',
  roles: 'members.fieldRoles',
  groups: 'members.fieldGroups',
  descriptions: 'members.fieldDescriptions',
};
type Background = NonNullable<MemberListFields['background']>;
const BACKGROUNDS: [Background, string][] = [['plain', 'members.bgPlain'], ['color', 'members.bgMemberColor'], ['banner', 'members.bgBanner']];

export function ListFieldsMenu({ fields, onChange }: { fields: MemberListFields; onChange: (next: MemberListFields) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  useEscapeKey(open, () => setOpen(false));
  const background = fields.background || 'plain';

  return (
    <div style={{ position: 'relative' }}>
      <Btn variant="ghost" aria-expanded={open} aria-controls={open ? popoverId : undefined} onClick={() => setOpen(v => !v)}>{t('members.displayFields')}</Btn>
      {open && (
        <div id={popoverId} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 30, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          {FIELD_KEYS.map(k => (
            <Toggle key={k} label={t(FIELD_LABEL[k])} value={fields[k] ?? false} onChange={v => onChange({ ...fields, [k]: v })} />
          ))}
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600, margin: '10px 0 6px' }}>{t('members.cardBackground')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {BACKGROUNDS.map(([mode, key]) => {
              const sel = background === mode;
              return (
                <button key={mode} type="button" aria-pressed={sel} onClick={() => onChange({ ...fields, background: mode })}
                  style={{ flex: 1, padding: '7px 6px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    background: sel ? 'var(--accent-bg)' : 'var(--surface)', color: sel ? 'var(--accent)' : 'var(--dim)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, fontWeight: sel ? 600 : 400 }}>
                  {t(key)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
