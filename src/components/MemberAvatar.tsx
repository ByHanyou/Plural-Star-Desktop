import type { CSSProperties } from 'react';
import { Member, getInitials } from '../utils';
import { initialOn } from '../theme';
import { clickable } from './ui';

export function MemberAvatar({ member, size, fontSize, decorative = false, backdrop = !member.avatarTransparent, onActivate, label, style }: {
  member: Pick<Member, 'name' | 'color' | 'avatar' | 'avatarTransparent'>;
  size?: number;
  fontSize?: number;
  decorative?: boolean;
  backdrop?: boolean;
  onActivate?: () => void;
  label?: string;
  style?: CSSProperties;
}) {
  const fill = !member.avatar
    ? { backgroundColor: member.color, color: initialOn(member.color) }
    : backdrop ? { backgroundColor: member.color } : {};
  return (
    <div className="tile__avatar" aria-hidden={decorative || undefined} {...(onActivate ? clickable(onActivate, label) : {})} style={{
      overflow: 'hidden', ...(size ? { width: size, height: size } : {}), ...(fontSize ? { fontSize } : {}), ...fill, ...style,
    }}>
      {member.avatar
        ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : getInitials(member.name || '?')}
    </div>
  );
}
