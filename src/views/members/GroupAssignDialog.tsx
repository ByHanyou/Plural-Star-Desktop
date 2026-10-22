import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberGroup, sortGroupsForDisplay, groupKind, toggleId } from '../../utils';
import { Btn, Modal } from '../../components/ui';

export function GroupAssignDialog({ groups, onApply, onClose }: { groups: MemberGroup[]; onApply: (groupIds: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState<string[]>([]);
  return (
    <Modal open title={t('members.assignGroup')} onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="primary" onClick={() => onApply(sel)} disabled={sel.length === 0}>{t('common.confirm')}</Btn>
        </div>
      }>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {sortGroupsForDisplay(groups, groups).map(g => {
          const on = sel.includes(g.id);
          return (
            <button key={g.id} type="button" className="chip" aria-pressed={on} onClick={() => setSel(prev => toggleId(prev, g.id))}
              style={{ background: on ? 'var(--accent-bg)' : 'var(--surface)', color: on ? 'var(--accent)' : 'var(--dim)', borderColor: on ? 'var(--accent)' : 'var(--border)' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: groupKind(g) === 'subsystem' ? 1.5 : '50%', background: g.color || 'var(--accent)', display: 'inline-block' }} />
              {g.name}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
