import React from 'react';
import { useTranslation } from 'react-i18next';
import { getInitials } from '../utils';

interface Props {
  name: string;
  description?: string;
  avatar?: string;
  banner?: string;
  /** Extra content under the description, e.g. the Edit switch's own notes. */
  children?: React.ReactNode;
}

/**
 * The read side of a system profile, laid out like the singlet Profile so the
 * two feel like the same object. Shared deliberately: this renders both our own
 * profile and a friend's mirrored copy, so the friend sees what we see.
 */
export default function SystemProfileCard({ name, description, avatar, banner, children }: Props) {
  const { t } = useTranslation();
  return (
    <div>
      {banner && (
        <img src={banner} alt="" style={{ width: '100%', aspectRatio: '3', objectFit: 'cover', borderRadius: 'var(--radius)' }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: banner ? -36 : 0, marginBottom: 14 }}>
        {avatar ? (
          <img src={avatar} alt="" style={{ width: 88, height: 88, borderRadius: 20, objectFit: 'cover', border: '2px solid var(--accent)' }} />
        ) : (
          <div aria-hidden style={{ width: 88, height: 88, borderRadius: 20, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: 'rgba(0,0,0,0.75)' }}>{getInitials(name || '?')}</span>
          </div>
        )}
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginTop: 10, textAlign: 'center' }}>
          {name || t('systemProfile.unnamed')}
        </div>
      </div>

      <div style={{ padding: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        {description ? (
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{description}</div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('systemProfile.noDescription')}</span>
        )}
      </div>
      {children}
    </div>
  );
}
