import { AppSettings, Member, MemberGroup, sortGroupsForDisplay, fmtNum } from '../../utils';
import { MemberAvatar } from '../../components/MemberAvatar';
import { TagChips } from '../../components/TagChips';
import { QuickFrontButton, QuickFrontTarget } from './QuickFront';
import { tint } from '../../theme';

export type MemberListFields = NonNullable<AppSettings['memberListFields']>;

const descPreview = (d?: string) => String(d ?? '').split('\n').filter(l => l.trim()).join('\n');

const MAX_TAGS = 4;
const MAX_GROUPS = 6;

export function MemberCard({ member: m, groups, fields, selecting, selected, quickFront, onActivate }: {
  member: Member;
  groups: MemberGroup[];
  fields: MemberListFields;
  selecting: boolean;
  selected: boolean;
  quickFront?: { fronting: boolean; onOpen: (target: QuickFrontTarget) => void };
  onActivate: () => void;
}) {
  const colorFill = fields.background === 'color' || (fields.background === 'banner' && !m.banner);
  const subtitle = [fields.pronouns ? m.pronouns : '', fields.roles ? m.role : ''].filter(Boolean).join(' · ');
  const description = fields.descriptions ? descPreview(m.description) : '';
  const memberGroups = fields.groups ? sortGroupsForDisplay(groups.filter(g => (m.groupIds || []).includes(g.id)), groups).slice(0, MAX_GROUPS) : [];
  const tags = m.tags || [];

  return (
    <div className="tile" onClick={onActivate} style={{
      minHeight: 'auto', padding: 14, cursor: 'pointer', position: 'relative', overflow: 'hidden',
      ...(selecting && selected ? { outline: '2px solid var(--accent)', outlineOffset: -2 } : {}),
      ...(colorFill ? { background: `linear-gradient(${tint(m.color, 15)}, ${tint(m.color, 15)}), var(--card)` } : {}),
    }}>
      {selecting && (
        <div aria-hidden style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2, width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
          background: selected ? 'var(--accent)' : 'var(--surface)', color: selected ? 'var(--bg)' : 'transparent', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        }}>
          ✓
        </div>
      )}
      {fields.background === 'banner' && m.banner && (
        <>
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${m.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--card)', opacity: 0.78 }} />
        </>
      )}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MemberAvatar member={m} size={40} fontSize={14} decorative />
          <div style={{ flex: 1, overflow: 'hidden' }} role={selecting ? 'checkbox' : 'button'} tabIndex={0}
            aria-checked={selecting ? selected : undefined}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onActivate(); } }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{subtitle}</div>}
          </div>
          {quickFront && <QuickFrontButton member={m} fronting={quickFront.fronting} size={26} fontSize={15} onOpen={quickFront.onOpen} />}
          <div aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: m.color, flexShrink: 0 }} />
        </div>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {description}
          </div>
        )}
        {memberGroups.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {memberGroups.map(g => (
              <span key={g.id} title={g.description || undefined} style={{ fontSize: 10, color: 'var(--text)', background: 'var(--surface)', border: `1px solid ${g.color || 'var(--border)'}`, padding: '1px 6px', borderRadius: 999 }}>
                {g.name}
              </span>
            ))}
          </div>
        )}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            <TagChips tags={tags.slice(0, MAX_TAGS)} />
            {tags.length > MAX_TAGS && <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{fmtNum(tags.length - MAX_TAGS, 0)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
