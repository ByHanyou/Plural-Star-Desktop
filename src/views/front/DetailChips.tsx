import { useTranslation } from 'react-i18next';
import { parseMoodList, toggleMoodInList, translateMood } from '../../utils';
import type { DetailDraft } from './drafts';

const chipStyle = { padding: '4px 10px', fontSize: 11 } as const;

export function MoodChips({ id, draft, patch, allMoods }: {
  id: string; draft: DetailDraft; patch: (p: Partial<DetailDraft>) => void; allMoods: string[];
}) {
  const { t } = useTranslation();
  const sel = parseMoodList(draft.mood);
  const chips = [...allMoods, ...sel.filter(m => !allMoods.includes(m))];
  return (
    <>
      <div className="field__label" id={id} style={{ marginTop: 4 }}>{t('modal.mood')}</div>
      <div role="group" aria-labelledby={id} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {chips.map(m => {
          const on = sel.includes(m);
          return (
            <button key={m} type="button" className={`btn ${on ? 'btn--primary' : 'btn--ghost'}`} style={chipStyle} aria-pressed={on}
              onClick={() => patch({ mood: toggleMoodInList(draft.mood, m) })}>{translateMood(m, t)}</button>
          );
        })}
        <button type="button" className={`btn ${draft.showCustomMood ? 'btn--primary' : 'btn--ghost'}`} style={chipStyle} aria-expanded={draft.showCustomMood}
          onClick={() => patch({ showCustomMood: !draft.showCustomMood })}>
          {draft.showCustomMood ? `− ${t('modal.custom')}` : `+ ${t('modal.custom')}`}
        </button>
      </div>
      {draft.showCustomMood && (
        <input className="field__input" value={draft.customMood} onChange={e => patch({ customMood: e.target.value })}
          aria-label={t('modal.enterMood')} placeholder={t('modal.enterMood')} style={{ fontSize: 12, marginBottom: 8 }} />
      )}
    </>
  );
}

export function LocationChips({ id, location, onChange, locations }: {
  id: string; location: string; onChange: (v: string) => void; locations: string[];
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="field__label" id={id} style={{ marginTop: 4 }}>{t('modal.location')}</div>
      <div role="group" aria-labelledby={id} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
        {locations.map(l => (
          <button key={l} type="button" className={`btn ${location === l ? 'btn--primary' : 'btn--ghost'}`} style={chipStyle} aria-pressed={location === l}
            onClick={() => onChange(location === l ? '' : l)}>{l}</button>
        ))}
      </div>
      <input className="field__input" value={location} onChange={e => onChange(e.target.value)}
        aria-label={t('modal.typeLocation')} placeholder={t('modal.typeLocation')} style={{ fontSize: 12, marginBottom: 8 }} />
    </>
  );
}

const ENERGY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function EnergyButtons({ id, value, onChange, color = 'var(--accent)', marginBottom = 8 }: {
  id: string; value?: number; onChange: (v: number | undefined) => void; color?: string; marginBottom?: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="field__label" id={id} style={{ marginTop: 4 }}>{t('energy.level')}</div>
      <div role="group" aria-labelledby={id} style={{ display: 'flex', gap: 3, marginBottom, alignItems: 'center' }}>
        {ENERGY_LEVELS.map(n => {
          const lit = value !== undefined && n <= value;
          return (
            <button key={n} type="button" onClick={() => onChange(value === n ? undefined : n)}
              aria-label={t('energy.levelValue', { value: n })} aria-pressed={value === n}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: value === n ? 'var(--accent-bg)' : 'var(--surface)',
                border: `1px solid ${lit ? color : 'var(--border)'}`, color: lit ? color : 'var(--dim)',
              }}>{n}</button>
          );
        })}
      </div>
    </>
  );
}
