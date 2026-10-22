import { useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { Member, FrontState, FrontTier, FrontTierKey, fmtTime, fmtDur, fmtNum, frontSessionStart, translateMood, upperText, TIER_I18N_KEY } from '../../utils';
import { Section, clickable, Interp, linkButton, slots } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import { TIER_COLOR, tint } from '../../theme';

const capsLabel: React.CSSProperties = { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--dim)' };
const plainBtn = linkButton('var(--dim)', 14);

function SortableFrontRow({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const gripLabel = t('common.dragReorderNamed', { name: label });
  return (
    <div ref={setNodeRef} style={{
      display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
      transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
      transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.85 : undefined,
    }}>
      <button type="button" aria-label={gripLabel} title={gripLabel} {...attributes} {...listeners}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'grab', padding: '4px 2px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
        ⠿
      </button>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ ...capsLabel, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

export function TierCard({ tierKey, front, tier, getMember, ids, canDrag, onSaveNote, onEditDetail, onRemove, onOpenMember, sensors, onTierDragEnd, dndA11y }: {
  tierKey: FrontTierKey;
  front: FrontState;
  tier: FrontTier;
  getMember: (id: string) => Member | undefined;
  ids: string[];
  canDrag: boolean;
  onSaveNote: (tier: FrontTierKey, note: string) => void;
  onEditDetail: (tier: FrontTierKey) => void;
  onRemove: (m: Member) => void;
  onOpenMember?: (id: string) => void;
  sensors: React.ComponentProps<typeof DndContext>['sensors'];
  onTierDragEnd: (e: DragEndEvent, ids: string[]) => void;
  dndA11y: React.ComponentProps<typeof DndContext>['accessibility'];
}) {
  const { t } = useTranslation();
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const color = TIER_COLOR[tierKey];
  const isPrimary = tierKey === 'primary';
  const tierName = t(TIER_I18N_KEY[tierKey]);
  const sessionStart = frontSessionStart(front);

  const rowParts = (id: string, m: Member) => (
    <>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: onOpenMember ? 'pointer' : 'default', borderRadius: 8 }}
        {...(onOpenMember ? clickable(() => onOpenMember(id), t('members.viewProfileNamed', { name: m.name })) : {})}>
        <MemberAvatar member={m} size={isPrimary ? 48 : 40} fontSize={isPrimary ? 16 : 14} decorative />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: isPrimary ? 16 : 14, fontWeight: 500, color: 'var(--text)' }}>{m.name}</div>
          {m.pronouns && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{m.pronouns}</div>}
          {m.role && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: m.color, marginTop: 1 }}>{upperText(m.role)}</div>}
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDur(front.memberSince?.[id] ?? front.startTime)}</span>
      <button type="button" className="icon-btn" aria-label={t('front.quickRemove', { name: m.name })} onClick={() => onRemove(m)}
        style={{ fontSize: 14 }}>✕</button>
    </>
  );
  const rows = ids.flatMap(id => {
    const m = getMember(id);
    return m ? [{ id, m }] : [];
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <Section label={tierName} color={color} />

      <div style={{ padding: 16, background: 'var(--card)', border: `1px solid ${tint(color, 25)}`, borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
          {canDrag ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onTierDragEnd(e, ids)} accessibility={dndA11y}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {rows.map(({ id, m }) => <SortableFrontRow key={id} id={id} label={m.name}>{rowParts(id, m)}</SortableFrontRow>)}
              </SortableContext>
            </DndContext>
          ) : rows.map(({ id, m }) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{rowParts(id, m)}</div>
          ))}
        </div>

        {isPrimary && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0', marginBottom: 8, fontSize: 11, color: 'var(--muted)' }}>
            <Interp text={t('front.frontingForSince', { ...slots('dur'), time: fmtTime(sessionStart) })}
              nodes={{ dur: <span style={{ color: 'var(--accent)' }}>{fmtDur(sessionStart)}</span> }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
          {tier.mood && <Detail label={t('front.mood')} value={translateMood(tier.mood, t)} />}
          {tier.location && <Detail label={t('modal.location')} value={tier.location} />}
          {!!tier.energyLevel && <Detail label={t('energy.label')} value={t('energy.outOfTen', { value: fmtNum(tier.energyLevel, 0) })} />}
          <button type="button" aria-label={t('front.editDetailsFor', { tier: tierName })} style={plainBtn} onClick={() => onEditDetail(tierKey)}>✎</button>
        </div>
        {!tier.mood && !tier.location && (
          <button type="button" style={{ ...plainBtn, fontSize: 12, padding: '4px 0' }} onClick={() => onEditDetail(tierKey)}>
            {t('front.addMood')}
          </button>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ ...capsLabel, fontWeight: 600 }}>{t('front.frontNote')}</span>
            {noteDraft === null ? (
              <button type="button" aria-label={t('front.editNoteFor', { tier: tierName })} style={plainBtn} onClick={() => setNoteDraft(tier.note || '')}>✎</button>
            ) : (
              <button type="button" aria-label={t('common.save')} style={{ ...plainBtn, color: 'var(--success)' }}
                onClick={() => { onSaveNote(tierKey, noteDraft); setNoteDraft(null); }}>✓</button>
            )}
          </div>
          {noteDraft !== null ? (
            <textarea className="field__input field__input--multi" value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              aria-label={t('modal.whatHappening')} placeholder={t('modal.whatHappening')} style={{ minHeight: 56, fontSize: 12 }} />
          ) : (
            <p style={{ fontSize: 12, lineHeight: 1.5, color: tier.note ? 'var(--text)' : 'var(--muted)' }}>{tier.note || t('front.noNote')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
