import type { CSSProperties, ReactNode } from 'react';
import type { PickerPool } from '../picker/memberPicker';

export function MemberGroupSelect({ label, value, onChange, pools, leading, style }: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  pools: PickerPool[];
  leading?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}
      style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, ...style }}>
      {leading}
      {pools.filter(p => p.members.length > 0).map(p => (
        <optgroup key={p.kind || p.label} label={p.label}>
          {p.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
