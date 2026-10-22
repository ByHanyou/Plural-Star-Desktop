import { useTranslation } from 'react-i18next';
import { Member, MemberGroup, CustomFieldDef, CustomFieldValue, Relationship, RelationshipTypeDef, sortGroupsForDisplay, groupKind, linkedSubsystemsOf, fmtFieldValue, memberRelationships } from '../../utils';
import { PALETTE, ThemeColors, cssVar, ensureReadable, tint } from '../../theme';
import { Btn } from '../../components/ui';
import { MarkdownText } from '../../components/MarkdownText';
import { RelationshipRows } from './ConnectionsList';
import { MemberAvatar } from '../../components/MemberAvatar';
import { CLOUD_MEDIA_MARK } from '../../cloud/cloudKeys';

interface Props {
  f: Member;
  members: Member[];
  groups: MemberGroup[];
  fieldDefs: CustomFieldDef[];
  relationships: Relationship[];
  relTypes: RelationshipTypeDef[];
  profilePt: ThemeColors | null;
  onViewPfp: () => void;
  onShowOnMap?: (id: string) => void;
  onOpenMember: (m: Member) => void;
}

export function MemberProfile({ f, members, groups, fieldDefs, relationships, relTypes, profilePt, onViewPfp, onShowOnMap, onOpenMember }: Props) {
  const { t } = useTranslation();
  const cardHex = cssVar('--card') || '#0A1F2E';
  const mc = profilePt ? 'var(--text)' : ensureReadable(f.color || PALETTE[0], cardHex, 3);
  const edge = profilePt ? 'var(--border)' : tint(f.color, 25);
  const activeGroups = sortGroupsForDisplay(groups.filter(g => (f.groupIds || []).includes(g.id)), groups);
  const linkedSubs = sortGroupsForDisplay(linkedSubsystemsOf(groups, f.id), groups);
  const visibleDefs = fieldDefs.filter(fd => {
    const vv = (f.customFields || []).find(c => c.fieldId === fd.id)?.value;
    return !(vv === undefined || vv === null || vv === '' || (fd.type === 'image' && vv === CLOUD_MEDIA_MARK));
  });
  const mine = memberRelationships(f.id, members, relationships);
  const groupChip = (g: MemberGroup, square: boolean) => (
    <span key={g.id} title={g.description || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
      border: `1px solid ${profilePt ? 'var(--border)' : tint(g.color || 'var(--accent)', 31)}`, background: profilePt ? 'var(--surface)' : tint(g.color || 'var(--accent)', 12), color: profilePt ? ensureReadable(g.color || profilePt.accent, profilePt.surface, 4.5) : (g.color || 'var(--accent)'), fontSize: 11 }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: square ? 1.5 : '50%', background: g.color || 'var(--accent)', display: 'inline-block' }} />
      {g.name}
    </span>
  );
  const heading = (label: string, divider: boolean) => (
    <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: mc, fontWeight: 600, marginBottom: divider ? 8 : 6, borderTop: divider ? `1px solid ${edge}` : undefined, paddingTop: divider ? 14 : undefined }}>{label}</div>
  );
  const readVal = (fd: CustomFieldDef, val: CustomFieldValue['value']) => {
    if (fd.type === 'toggle') return <span role="img" aria-label={val ? t('common.yes') : t('common.no')} style={{ fontSize: 14, color: val ? 'var(--accent)' : 'var(--muted)' }}>{val ? '✓' : '-'}</span>;
    if (fd.type === 'color') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: String(val || '#333'), border: '1px solid var(--border)', display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'monospace' }}>{String(val || '')}</span>
      </span>
    );
    if (fd.type === 'image') return <img src={String(val)} alt={fd.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />;
    if (fd.type === 'text' || fd.type === 'markdown') return <MarkdownText text={String(val)} members={members} />;
    return <span style={{ fontSize: 13, color: 'var(--text)' }}>{fmtFieldValue(fd.type, val)}</span>;
  };
  return (
    <div>
      {f.banner && (
        <div style={{ width: '100%', aspectRatio: '3 / 1', borderRadius: 8, overflow: 'hidden', marginBottom: 12,
          backgroundImage: `url(${f.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <MemberAvatar member={f} size={72} fontSize={24} backdrop={false}
          onActivate={f.avatar ? onViewPfp : undefined} label={t('modal.viewPfp')}
          style={{ flexShrink: 0, border: `2px solid ${profilePt ? 'var(--border)' : f.color}`, cursor: f.avatar ? 'pointer' : 'default',
            ...(profilePt && !f.avatar ? { backgroundColor: 'var(--surface)', color: 'var(--text)' } : {}) }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: mc }}>{f.name}</div>
          {f.pronouns ? <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>{f.pronouns}</div> : null}
          {f.role ? <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>{f.role}</div> : null}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span role="img" aria-label={t('common.labelValue', { label: t('modal.color'), value: f.color })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, border: `1px solid ${edge}`, background: 'var(--surface)' }}>
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: f.color, border: profilePt ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
          <span aria-hidden style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'monospace' }}>{f.color}</span>
        </span>
        {f.emoji ? (
          <span role="img" aria-label={t('common.labelValue', { label: t('modal.emoji'), value: f.emoji })} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, border: `1px solid ${edge}`, background: 'var(--surface)', fontSize: 14 }}>{f.emoji}</span>
        ) : null}
      </div>

      {(f.tags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {(f.tags || []).map(tag => (
            <span key={tag} style={{ padding: '3px 9px', borderRadius: 999, background: profilePt ? 'var(--surface)' : tint(f.color, 9), border: `1px solid ${edge}`, color: mc, fontSize: 11 }}>{tag}</span>
          ))}
        </div>
      )}
      {activeGroups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {activeGroups.map(g => groupChip(g, groupKind(g) === 'subsystem'))}
        </div>
      )}
      {linkedSubs.length > 0 && (
        <>
          {heading(t('memberGroups.linkedSubsystems'), false)}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {linkedSubs.map(g => groupChip(g, true))}
          </div>
        </>
      )}

      {f.description ? (
        <>
          {heading(t('modal.descriptionBio'), false)}
          <div style={{ padding: 12, background: 'var(--surface)', border: `1px solid ${edge}`, borderRadius: 8, marginBottom: 14 }}>
            <MarkdownText text={f.description} members={members} />
          </div>
        </>
      ) : null}

      {visibleDefs.length > 0 && (
        <>
          {heading(t('customFields.title'), true)}
          {visibleDefs.map((fd, i) => {
            const val = (f.customFields || []).find(v => v.fieldId === fd.id)?.value ?? '';
            return (
              <div key={fd.id} style={{ marginBottom: 12, borderTop: i > 0 ? '1px solid var(--border)' : undefined, paddingTop: i > 0 ? 12 : undefined }}>
                <div className="field__label">{fd.name}</div>
                {readVal(fd, val)}
              </div>
            );
          })}
        </>
      )}

      {(mine.length > 0 || onShowOnMap) && (
        <>
          {heading(t('systemMap.connections'), true)}
          {onShowOnMap && (
            <Btn variant="ghost" onClick={() => onShowOnMap(f.id)}>{t('systemMap.showOnMap')}</Btn>
          )}
          {mine.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <RelationshipRows memberId={f.id} members={members} relationships={mine} relTypes={relTypes} onOpenMember={onOpenMember} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
