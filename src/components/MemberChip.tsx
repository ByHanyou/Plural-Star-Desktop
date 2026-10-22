import type { Member } from '../utils';
import { tint } from '../theme';

type ChipMember = Pick<Member, 'id' | 'name' | 'color'>;

const dot = (color: string, size: number) => (
  <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
);

export function MemberPill({ member, fontSize = 12 }: { member: ChipMember; fontSize?: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: fontSize > 12 ? 6 : 5, padding: fontSize <= 11 ? '3px 8px' : '5px 10px', borderRadius: 999,
      background: tint(member.color, 13), border: `1px solid ${tint(member.color, 31)}`, fontSize, fontWeight: 500, color: member.color,
    }}>
      {dot(member.color, fontSize - 5)}
      {member.name}
    </span>
  );
}

export function MemberToggleChip({ member, on, onToggle }: { member: ChipMember; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onToggle}
      style={{ borderColor: on ? tint(member.color, 38) : 'var(--border)', background: on ? tint(member.color, 13) : 'var(--surface)' }}>
      {dot(member.color, 7)}
      <span style={{ color: on ? member.color : 'var(--dim)', fontWeight: on ? 600 : 400 }}>{member.name}</span>
    </button>
  );
}
