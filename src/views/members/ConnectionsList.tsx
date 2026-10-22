import { useTranslation } from 'react-i18next';
import { Member, Relationship, RelationshipTypeDef, allRelationshipTypes, memberRelationships, relationshipRoleOfOther, DEFAULT_REL_COLOR } from '../../utils';
import { Btn } from '../../components/ui';

export function RelationshipRows({ memberId, members, relationships, relTypes, onOpenMember }: {
  memberId: string; members: Member[]; relationships: Relationship[]; relTypes: RelationshipTypeDef[];
  onOpenMember: (m: Member) => void;
}) {
  const { t } = useTranslation();
  const typeById = new Map(allRelationshipTypes(relTypes).map(ty => [ty.id, ty]));
  return (
    <>
      {relationships.map(r => {
        const otherId = r.fromId === memberId ? r.toId : r.fromId;
        const other = members.find(m => m.id === otherId);
        const type = typeById.get(r.typeId);
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: type?.color || DEFAULT_REL_COLOR }} />
            <span style={{ fontSize: 12, color: 'var(--dim)', minWidth: 70 }}>{relationshipRoleOfOther(type, r, memberId, t)}</span>
            <button type="button" onClick={() => other && onOpenMember(other)} disabled={!other}
              style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--text)', background: 'none', border: 'none', cursor: other ? 'pointer' : 'default' }}>
              {other?.name || '?'}
            </button>
          </div>
        );
      })}
    </>
  );
}

export function ConnectionsList({ memberId, members, relationships, relTypes, onShowOnMap, onOpenMember }: {
  memberId: string; members: Member[]; relationships: Relationship[]; relTypes: RelationshipTypeDef[];
  onShowOnMap?: (id: string) => void; onOpenMember: (m: Member) => void;
}) {
  const { t } = useTranslation();
  const mine = memberRelationships(memberId, members, relationships);
  return (
    <div>
      {onShowOnMap && (
        <Btn variant="ghost" onClick={() => onShowOnMap(memberId)}>{t('systemMap.showOnMap')}</Btn>
      )}
      {mine.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 12 }}>{t('systemMap.noneForMember')}</p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <RelationshipRows memberId={memberId} members={members} relationships={mine} relTypes={relTypes} onOpenMember={onOpenMember} />
        </div>
      )}
    </div>
  );
}
