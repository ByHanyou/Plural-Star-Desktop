import { dayPeriodLabel } from '../utils';

export function AmPmToggle({ value, onChange }: { value: 'AM' | 'PM'; onChange: (v: 'AM' | 'PM') => void }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {(['AM', 'PM'] as const).map(ap => (
        <button key={ap} type="button" onClick={() => onChange(ap)} aria-pressed={value === ap}
          style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: value === ap ? 'var(--accent)' : 'transparent', color: value === ap ? 'var(--bg)' : 'var(--dim)' }}>{dayPeriodLabel(ap === 'PM')}</button>
      ))}
    </div>
  );
}
