import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '../utils';
import { clickable, linkButton } from './ui';
import { MemberAvatar } from './MemberAvatar';

export function AvatarField({ member, onPick, onRemove, onView }: {
  member: Pick<Member, 'name' | 'color' | 'avatar' | 'avatarTransparent'>;
  onPick: () => void;
  onRemove: () => void;
  onView?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <MemberAvatar member={member} size={72} fontSize={24} onActivate={onPick} label={t('modal.changePfp')}
        style={{ margin: '0 auto', cursor: 'pointer', border: `2px solid ${member.color}` }} />
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
        <button type="button" aria-label={t('modal.changePfp')} style={linkButton('var(--accent)')} onClick={onPick}>📷</button>
        {member.avatar && onView && (
          <button type="button" style={linkButton('var(--accent)')} onClick={onView}>🔍 {t('modal.viewPfp')}</button>
        )}
        {member.avatar && (
          <button type="button" style={linkButton('var(--danger)')} onClick={onRemove}>{t('modal.removePfp')}</button>
        )}
      </div>
    </div>
  );
}

export function BannerField({ banner, pickLabel, removeLabel, onPick, onRemove, style }: {
  banner?: string;
  pickLabel: string;
  removeLabel: string;
  onPick: () => void;
  onRemove: () => void;
  style?: CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div style={{
        width: '100%', aspectRatio: '3 / 1', borderRadius: 8, border: '1px dashed var(--border)', overflow: 'hidden', cursor: 'pointer',
        backgroundImage: banner ? `url(${banner})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
        backgroundColor: banner ? undefined : 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', fontSize: 12,
      }} {...clickable(onPick, pickLabel)}>
        {!banner && pickLabel}
      </div>
      {banner && <button type="button" style={{ ...linkButton('var(--danger)', 10), marginTop: 4 }} onClick={onRemove}>{removeLabel}</button>}
    </div>
  );
}
