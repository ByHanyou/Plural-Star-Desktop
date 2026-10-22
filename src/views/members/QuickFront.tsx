import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Member, FrontTierKey, FRONT_TIER_KEYS, TIER_I18N_KEY } from '../../utils';
import { Modal, ConfirmDialog } from '../../components/ui';
import { TIER_COLOR } from '../../theme';

export type QuickFrontTarget = { member: Member; mode: 'add' | 'remove' };

export function QuickFrontButton({ member, fronting, size, fontSize, onOpen, style }: {
  member: Member; fronting: boolean; size: number; fontSize: number; onOpen: (target: QuickFrontTarget) => void; style?: React.CSSProperties;
}) {
  const { t } = useTranslation();
  const tone = fronting ? 'var(--danger)' : 'var(--accent)';
  return (
    <button type="button"
      aria-label={fronting ? t('members.removeFromFrontNamed', { name: member.name }) : t('members.addToFrontNamed', { name: member.name })}
      title={fronting ? t('members.removeFromFront') : t('members.addToFront')}
      onClick={e => { e.stopPropagation(); onOpen({ member, mode: fronting ? 'remove' : 'add' }); }}
      style={{
        width: size, height: size, borderRadius: size / 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        background: fronting ? 'var(--danger-bg)' : 'transparent', border: `1px solid ${tone}`, color: tone, fontSize, lineHeight: 1, ...style,
      }}>
      {fronting ? '−' : '＋'}
    </button>
  );
}

export function QuickFrontDialogs({ target, onClose, onAdd, onRemove }: {
  target: QuickFrontTarget | null; onClose: () => void;
  onAdd: (memberId: string, tier: FrontTierKey) => void; onRemove: (memberId: string) => void;
}) {
  const { t } = useTranslation();
  const member = target?.member;
  return (
    <>
      <Modal open={target?.mode === 'add'} title={member ? t('members.addToFrontNamed', { name: member.name }) : t('members.addToFront')} onClose={onClose}>
        {FRONT_TIER_KEYS.map(tier => (
          <button key={tier} type="button" onClick={() => { onClose(); if (member) onAdd(member.id, tier); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 10, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: TIER_COLOR[tier] }} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{t(TIER_I18N_KEY[tier])}</span>
          </button>
        ))}
      </Modal>
      <ConfirmDialog open={target?.mode === 'remove'} title={t('members.removeFromFront')}
        message={member ? t('members.removeFromFrontMsg', { name: member.name }) : ''} danger single
        onConfirm={() => { onClose(); if (member) onRemove(member.id); }} onCancel={onClose} />
    </>
  );
}
