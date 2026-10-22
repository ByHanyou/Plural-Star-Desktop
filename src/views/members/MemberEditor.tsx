import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, CloneSelection, activeRosterAndFacets, CLONE_ALL, cloneMemberFrom, sortGroupsForDisplay, groupKind, toggleId, linkedSubsystemsOf, normalizeMemberEmoji } from '../../utils';
import { memberProfileTheme, themeVars } from '../../theme';
import { Btn, Field, Toggle, Section, Modal, ConfirmDialog, ImageErrorDialog, TabBar, clickable } from '../../components/ui';
import { ColorCarousel } from '../../components/ColorCarousel';
import { CustomHexEntry, ProfileBgChip, TransparentAvatarChip } from '../../components/CustomHexEntry';
import { AvatarField, BannerField } from '../../components/ImageFields';
import { TagEditor } from '../../components/TagEditor';
import { useImagePick } from '../../hooks/useImagePick';
import { useAppStore } from '../../store/appStore';
import { GroupToggleChip, GroupTreePicker } from './GroupTreePicker';
import { MemberProfile } from './MemberProfile';
import { CustomFieldEditor } from './CustomFieldEditor';
import { ConnectionsList } from './ConnectionsList';
import { Noteboard } from './Noteboard';

type MemberTab = 'main' | 'fields' | 'connections' | 'noteboard';

const MEMBER_TABS: readonly MemberTab[] = ['main', 'fields', 'connections', 'noteboard'];
const MEMBER_TAB_LABEL: Record<MemberTab, string> = {
  main: 'modal.editMember',
  fields: 'customFields.title',
  connections: 'systemMap.connections',
  noteboard: 'noteboard.title',
};
const CLONE_FIELDS: [keyof CloneSelection, string][] = [
  ['name', 'modal.name'],
  ['pronouns', 'modal.pronouns'],
  ['role', 'modal.role'],
  ['color', 'modal.color'],
  ['description', 'modal.descriptionBio'],
];

interface Props {
  member: Member;
  isNew: boolean;
  onClose: () => void;
  onSave: (draft: Member, linkSel: string[] | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClone: (clone: Member) => Promise<void>;
  onOpenMember: (m: Member) => void;
  onShowOnMap?: (id: string) => void;
}

export default function MemberEditor({ member, isNew, onClose, onSave, onDelete, onClone, onOpenMember, onShowOnMap }: Props) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const groups = useAppStore(s => s.groups);
  const settings = useAppStore(s => s.settings);
  const fieldDefs = useAppStore(s => s.customFieldDefs);
  const relationships = useAppStore(s => s.relationships);
  const relTypes = useAppStore(s => s.relationshipTypes);

  const [f, setF] = useState<Member>(() => ({ ...member, tags: member.tags || [], groupIds: member.groupIds || [] }));
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setF(x => ({ ...x, [k]: v }));
  const [readMode, setReadMode] = useState(false);
  const [memberTab, setMemberTab] = useState<MemberTab>('main');
  const [viewPfp, setViewPfp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [cloneSel, setCloneSel] = useState<CloneSelection>(CLONE_ALL);
  const [tagInput, setTagInput] = useState('');
  const [groupOpen, setGroupOpen] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [linkSel, setLinkSel] = useState<string[] | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteAuthorId, setNoteAuthorId] = useState<string | null>(() => {
    const authors = activeRosterAndFacets(members);
    return authors.members[0]?.id || authors.facets[0]?.id || null;
  });
  const { pick, imageError, clearImageError } = useImagePick();

  const knownTags = useMemo(() => members.flatMap(m => m.tags || []), [members]);

  const toggleGroup = (gid: string) => setF(x => ({ ...x, groupIds: toggleId(x.groupIds || [], gid) }));

  const subsystems = sortGroupsForDisplay(groups.filter(g => groupKind(g) === 'subsystem'), groups);
  const linkedIds = linkSel ?? linkedSubsystemsOf(groups, f.id).map(g => g.id);
  const toggleLink = (gid: string) => setLinkSel(cur => toggleId(cur ?? linkedSubsystemsOf(groups, f.id).map(g => g.id), gid));

  const save = async () => {
    if (!f.name.trim()) return;
    await onSave(f, linkSel);
  };

  const doClone = async () => {
    setShowClone(false);
    await onClone(cloneMemberFrom(f, cloneSel));
  };

  const profilePt = readMode ? memberProfileTheme(f) : null;

  return (
    <>
      <Modal open title={isNew ? t('modal.addMember') : t('modal.editMember')} onClose={onClose}
        style={profilePt ? (themeVars(profilePt) as React.CSSProperties) : undefined}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isNew && !readMode && (
                <>
                  <Btn variant="danger" onClick={() => setConfirmDelete(true)}>{t('common.delete')}</Btn>
                  <Btn variant="ghost" onClick={() => setShowClone(true)}>{t('members.clone')}</Btn>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>{readMode ? t('common.close') : t('common.cancel')}</Btn>
              {!readMode && <Btn variant="solid" disabled={!f.name.trim()} onClick={() => void save()}>{t('common.save')}</Btn>}
            </div>
          </div>
        }>
        {!isNew && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Btn variant="ghost" onClick={() => setReadMode(m => !m)}>{readMode ? t('common.edit') : t('modal.read')}</Btn>
          </div>
        )}
        {!isNew && !readMode && (
          <TabBar tabs={MEMBER_TABS} value={memberTab} onChange={setMemberTab} label={tab => t(MEMBER_TAB_LABEL[tab])} tabPadding="8px 16px" />
        )}

        {readMode && !isNew && (
          <MemberProfile f={f} members={members} groups={groups} fieldDefs={fieldDefs} relationships={relationships} relTypes={relTypes}
            profilePt={profilePt} onViewPfp={() => setViewPfp(true)} onShowOnMap={onShowOnMap} onOpenMember={onOpenMember} />
        )}

        {!readMode && (
          <fieldset style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 'auto' }}>
            {!isNew && settings.selfMemberId !== f.id && memberTab === 'main' && (
              <button
                onClick={() => {
                  const toFacet = !f.isFacet;
                  setF({ ...f, isFacet: toFacet, isCustomFront: toFacet ? false : f.isCustomFront });
                }}
                title={t('members.moveCategoryHint')}
                style={{
                  alignSelf: 'flex-start', marginBottom: 14, padding: '6px 12px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                <span aria-hidden>{f.isFacet ? '↩ ' : '◈ '}</span>
                {f.isFacet
                  ? t('members.makeMember')
                  : t('members.makeFacet')}
              </button>
            )}

            {(memberTab === 'main' || isNew) && (<>
              <AvatarField member={f} onPick={() => pick('image', v => set('avatar', v))} onRemove={() => set('avatar', undefined)} onView={() => setViewPfp(true)} />
              <BannerField banner={f.banner} pickLabel={t('memberProfile.changeBanner')} removeLabel={t('memberProfile.removeBanner')}
                onPick={() => pick('banner', v => set('banner', v))} onRemove={() => set('banner', undefined)} />

              <Field label={t('modal.name')} value={f.name} onChange={v => set('name', v)} placeholder={f.isFacet ? t('modal.facetName') : t('modal.headmateName')} />
              <Field label={t('modal.nickname')} value={f.nickname || ''} onChange={v => set('nickname', v || undefined)} placeholder={t('modal.nickname')} />
              <Field label={t('modal.pronouns')} value={f.pronouns} onChange={v => set('pronouns', v)} placeholder={t('modal.pronounsPlaceholder')} />
              <Field label={t('modal.role')} value={f.role} onChange={v => set('role', v)} placeholder={t('modal.rolePlaceholder')} />
              <Field label={t('modal.emoji')} value={f.emoji || ''} onChange={v => set('emoji', normalizeMemberEmoji(v))} placeholder={t('modal.emojiPlaceholder')} />

              <Section label={t('modal.color')} />
              <ColorCarousel value={f.color} onChange={v => set('color', v)} />
              <CustomHexEntry value={f.color} onApply={v => set('color', v)}
                leading={<><TransparentAvatarChip value={!!f.avatarTransparent} onChange={v => set('avatarTransparent', v)} /><ProfileBgChip color={f.color} value={!!f.profileBg} onChange={v => set('profileBg', v)} /></>} />

              {groups.length > 0 && (
                <GroupTreePicker groups={groups} selectedIds={f.groupIds || []} onToggle={toggleGroup} open={groupOpen}
                  onToggleOpen={(gid, next) => setGroupOpen(prev => new Map(prev).set(gid, next))} />
              )}

              {subsystems.length > 0 && (
                <>
                  <Section label={t('memberGroups.linkedSubsystems')} />
                  <div role="group" aria-label={t('memberGroups.linkedSubsystems')} style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                    {subsystems.map(g => {
                      const on = linkedIds.includes(g.id);
                      const other = !on && g.linkedMemberId && g.linkedMemberId !== f.id
                        ? members.find(m => m.id === g.linkedMemberId && !m.deleted)
                        : undefined;
                      return (
                        <GroupToggleChip key={g.id} group={g} on={on} onToggle={() => toggleLink(g.id)}
                          ariaLabel={other ? t('memberGroups.linkedToNamed', { group: g.name, name: other.name }) : g.name}>
                          {other ? `  ·  ${other.name}` : ''}
                        </GroupToggleChip>
                      );
                    })}
                  </div>
                </>
              )}

              <Section label={t('modal.memberTags')} />
              <TagEditor tags={f.tags || []} onChange={tags => set('tags', tags)} placeholder={t('modal.memberTagPlaceholder')} suggestFrom={knownTags} input={tagInput} onInput={setTagInput} />

              <Section label={t('modal.descriptionBio')} />
              <Field value={f.description} onChange={v => set('description', v)} placeholder={t('modal.descriptionPlaceholder')} ariaLabel={t('modal.descriptionBio')} multiline pictureTools />

              <Toggle label={t('modal.private')} description={t('modal.privateDesc')}
                value={!!f.private} onChange={v => set('private', v)} />

              {!isNew && (
                <Toggle label={t('modal.archiveMember')} description={t('modal.archiveDesc')}
                  value={!!f.archived} onChange={v => set('archived', v)} />
              )}
            </>)}

            {memberTab === 'fields' && !isNew && (
              <CustomFieldEditor fieldDefs={fieldDefs} values={f.customFields} onChange={v => set('customFields', v)} />
            )}

            {memberTab === 'connections' && !isNew && (
              <ConnectionsList memberId={f.id} members={members} relationships={relationships} relTypes={relTypes} onShowOnMap={onShowOnMap} onOpenMember={onOpenMember} />
            )}

            {memberTab === 'noteboard' && !isNew && (
              <Noteboard memberId={f.id} text={noteText} onText={setNoteText} authorId={noteAuthorId} onAuthor={setNoteAuthorId} />
            )}
          </fieldset>
        )}
      </Modal>

      <ConfirmDialog open={confirmDelete}
        title={t('modal.confirmDelete')}
        message={t('modal.confirmDelete')}
        danger
        onConfirm={() => { setConfirmDelete(false); void onDelete(f.id); }}
        onCancel={() => setConfirmDelete(false)} />

      <Modal open={viewPfp && !!f.avatar} title={t('modal.viewPfpOf', { name: f.name || '?' })} onClose={() => setViewPfp(false)}>
        <div {...clickable(() => setViewPfp(false), t('common.close'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={f.avatar} alt={t('modal.viewPfpOf', { name: f.name || '?' })}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
        </div>
      </Modal>

      <Modal open={showClone} title={t('members.clone')} onClose={() => setShowClone(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowClone(false)}>{t('common.cancel')}</Btn>
            <Btn variant="solid" onClick={() => void doClone()}>{t('members.clone')}</Btn>
          </div>
        }>
        <p style={{ fontSize: 13, color: 'var(--dim)', marginTop: 0, marginBottom: 8 }}>{t('members.cloneFields')}</p>
        {CLONE_FIELDS.map(([key, labelKey]) => (
          <Toggle key={key} value={cloneSel[key]} onChange={v => setCloneSel(s => ({ ...s, [key]: v }))} label={t(labelKey)} />
        ))}
      </Modal>
      <ImageErrorDialog error={imageError} onClose={clearImageError} />
    </>
  );
}
