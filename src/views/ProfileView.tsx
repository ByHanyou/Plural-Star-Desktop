import React, { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, blankMember, randomPaletteColor, getInitials, allFrontMemberIds, normalizeMemberEmoji, colorName } from '../utils';
import { PALETTE, initialOn, memberProfileTheme, themeVars } from '../theme';
import { saveMember, deleteMember } from '../store/actions';
import { useAppStore } from '../store/appStore';
import { Btn, Field, Section, Modal, ConfirmDialog, Toggle, SrOnly, PageHeading, TabBar, SaveErrorDialog, ImageErrorDialog } from '../components/ui';
import { ColorCarousel } from '../components/ColorCarousel';
import { AvatarField, BannerField } from '../components/ImageFields';
import { useImagePick } from '../hooks/useImagePick';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { CustomHexEntry, ProfileBgChip, TransparentAvatarChip } from '../components/CustomHexEntry';
import { MarkdownText } from '../components/MarkdownText';

type SubTab = 'profile' | 'statuses';

const SUB_TABS: readonly SubTab[] = ['profile', 'statuses'];

interface Props {
  member?: Member;
  statuses: Member[];
  onEnsureSelf: () => Promise<Member>;
}

export default function ProfileView({ member, statuses, onEnsureSelf }: Props) {
  const front = useAppStore(s => s.front);
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('profile');
  const [editingProfile, setEditingProfile] = useState<Member | null>(null);
  const [editingStatus, setEditingStatus] = useState<Member | null>(null);
  const [isNewStatus, setIsNewStatus] = useState(false);
  const [confirmDeleteStatus, setConfirmDeleteStatus] = useState<string | null>(null);
  const [f, setF] = useState<Member>({ id: '', name: '', pronouns: '', role: '', color: PALETTE[0], description: '' });

  const activeIds = allFrontMemberIds(front);
  const editingActive = activeIds.includes(f.id);
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setF(x => ({ ...x, [k]: v }));
  const profilePt = memberProfileTheme(member);
  const deleteHintId = useId();
  const [saveError, run, clearSaveError] = useSaveGuard();
  const { pick, imageError, clearImageError } = useImagePick();

  const openEditProfile = () => run(async () => {
    const self = await onEnsureSelf();
    setF({ ...self });
    setEditingProfile(self);
  });

  const openNewStatus = () => {
    const m = blankMember({ isCustomFront: true, color: randomPaletteColor() });
    setF(m); setIsNewStatus(true); setEditingStatus(m);
  };

  const openEditStatus = (m: Member) => {
    setF({ ...m });
    setIsNewStatus(false);
    setEditingStatus(m);
  };

  const saveProfile = async () => {
    if (f.name.trim() && await run(() => saveMember({ ...f, isCustomFront: false }))) setEditingProfile(null);
  };

  const saveStatus = async () => {
    if (f.name.trim() && await run(() => saveMember({ ...f, isCustomFront: true }))) setEditingStatus(null);
  };

  const deleteStatus = async (id: string) => {
    setConfirmDeleteStatus(null);
    if (await run(() => deleteMember(id))) setEditingStatus(null);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <PageHeading>{t('tabs.profile')}</PageHeading>
        {subTab === 'profile' ? (
          <Btn variant="solid" onClick={() => void openEditProfile()}>{t('common.edit')}</Btn>
        ) : (
          <Btn variant="solid" onClick={openNewStatus}>{t('profile.addStatus')}</Btn>
        )}
      </div>

      <TabBar tabs={SUB_TABS} value={subTab} onChange={setSubTab} label={id => (id === 'profile' ? t('tabs.profile') : t('profile.statuses'))} style={{ marginTop: 8 }} />

      {subTab === 'profile' && (
        <div style={profilePt ? { ...(themeVars(profilePt) as React.CSSProperties), background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 16 } : undefined}>
          {member?.banner && (
            <img src={member.banner} alt="" style={{ width: '100%', aspectRatio: '3', objectFit: 'cover', borderRadius: 'var(--radius)' }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: member?.banner ? -36 : 0, marginBottom: 14 }}>
            {member?.avatar ? (
              <img src={member.avatar} alt="" style={{ width: 88, height: 88, borderRadius: 20, objectFit: 'cover', border: `2px solid ${profilePt ? 'var(--border)' : (member.color || 'var(--accent)')}` }} />
            ) : (
              <div aria-hidden style={{ width: 88, height: 88, borderRadius: 20, background: profilePt ? 'var(--surface)' : (member?.color || 'var(--accent)'), display: 'flex', alignItems: 'center', justifyContent: 'center', border: profilePt ? '2px solid var(--border)' : '2px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: profilePt ? 'var(--text)' : (member?.color ? initialOn(member.color) : 'var(--bg)') }}>{getInitials(member?.name || '?')}</span>
              </div>
            )}
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginTop: 10, textAlign: 'center' }}>
              {member?.name || t('profile.notSetUp')}
            </div>
            {member?.pronouns && <div style={{ fontSize: 14, color: 'var(--dim)', marginTop: 3 }}>{member.pronouns}</div>}
            {member && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600 }}>{t('profile.favoriteColor')}</span>
                <span role="img" aria-label={colorName(member.color || '', t)} style={{ width: 16, height: 16, borderRadius: '50%', background: member.color || 'var(--accent)', border: profilePt ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
                {member.emoji ? <span role="img" aria-label={t('common.labelValue', { label: t('modal.emoji'), value: member.emoji })} style={{ fontSize: 16 }}>{member.emoji}</span> : null}
              </div>
            )}
          </div>

          <div style={{ padding: 14, background: profilePt ? 'var(--surface)' : 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {member?.description ? (
              <MarkdownText text={member.description} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('profile.noDescription')}</span>
            )}
          </div>
        </div>
      )}

      {subTab === 'statuses' && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{t('profile.statusesDesc')}</p>
          {statuses.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('profile.noStatuses')}</span>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {statuses.map((m, i) => {
                const active = activeIds.includes(m.id);
                return (
                  <button key={m.id} onClick={() => openEditStatus(m)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                    padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: i === statuses.length - 1 ? 'none' : '1px solid var(--border)',
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {active && (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: 'var(--success-bg)', border: '1px solid var(--success)', fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>
                        {t('profile.activeStatus')}
                      </span>
                    )}
                    <span aria-hidden style={{ fontSize: 12, color: 'var(--muted)' }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={!!editingProfile} title={t('profile.edit')} onClose={() => setEditingProfile(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditingProfile(null)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" disabled={!f.name.trim()} onClick={() => void saveProfile()}>{t('common.save')}</Btn>
          </div>
        }>
        <AvatarField member={f} onPick={() => pick('image', v => set('avatar', v))} onRemove={() => set('avatar', undefined)} />
        <BannerField banner={f.banner} pickLabel={t('memberProfile.changeBanner')} removeLabel={t('memberProfile.removeBanner')}
          onPick={() => pick('banner', v => set('banner', v))} onRemove={() => set('banner', undefined)} />

        <Field label={t('modal.name')} value={f.name} onChange={v => set('name', v)} placeholder={t('modal.headmateName')} />
        <Field label={t('modal.pronouns')} value={f.pronouns} onChange={v => set('pronouns', v)} placeholder={t('modal.pronounsPlaceholder')} />
        <Field label={t('modal.emoji')} value={f.emoji || ''} onChange={v => set('emoji', normalizeMemberEmoji(v))} placeholder={t('modal.emojiPlaceholder')} />
        <Section label={t('profile.favoriteColor')} />
        <ColorCarousel value={f.color} onChange={v => set('color', v)} />
        <CustomHexEntry value={f.color} onApply={v => set('color', v)}
          leading={<><TransparentAvatarChip value={!!f.avatarTransparent} onChange={v => set('avatarTransparent', v)} /><ProfileBgChip color={f.color} value={!!f.profileBg} onChange={v => set('profileBg', v)} /></>} />
        <Field label={t('modal.descriptionBio')} value={f.description} onChange={v => set('description', v)} placeholder={t('modal.descriptionPlaceholder')} multiline pictureTools />
      </Modal>

      <Modal open={!!editingStatus} title={isNewStatus ? t('status.add') : t('status.edit')} onClose={() => setEditingStatus(null)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div>
              {!isNewStatus && (
                <>
                  <Btn variant="danger" disabled={editingActive} onClick={() => setConfirmDeleteStatus(f.id)}
                    title={editingActive ? t('profile.deleteActiveHint') : undefined}
                    aria-describedby={editingActive ? deleteHintId : undefined}>{t('common.delete')}</Btn>
                  {editingActive && <SrOnly id={deleteHintId}>{t('profile.deleteActiveHint')}</SrOnly>}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setEditingStatus(null)}>{t('common.cancel')}</Btn>
              <Btn variant="solid" disabled={!f.name.trim()} onClick={() => void saveStatus()}>{t('common.save')}</Btn>
            </div>
          </div>
        }>
        <Field label={t('modal.name')} value={f.name} onChange={v => set('name', v)} />
        <Field label={t('modal.emoji')} value={f.emoji || ''} onChange={v => set('emoji', normalizeMemberEmoji(v))} placeholder={t('modal.emojiPlaceholder')} />
        <Section label={t('modal.color')} />
        <ColorCarousel value={f.color} onChange={v => set('color', v)} />
        <Field label={t('modal.descriptionBio')} value={f.description} onChange={v => set('description', v)} multiline pictureTools />
        <Toggle label={t('modal.private')} description={t('modal.privateDesc')}
          value={!!f.private} onChange={v => set('private', v)} />
      </Modal>

      <ConfirmDialog open={!!confirmDeleteStatus} title={t('common.delete')} message={t('journal.areYouSure')}
        danger onConfirm={() => { if (confirmDeleteStatus) void deleteStatus(confirmDeleteStatus); }} onCancel={() => setConfirmDeleteStatus(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
      <ImageErrorDialog error={imageError} onClose={clearImageError} />
    </div>
  );
}
