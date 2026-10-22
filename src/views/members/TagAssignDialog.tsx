import { useTranslation } from 'react-i18next';
import { tagKey } from '../../utils';
import { useTagAssign } from '../../hooks/useTagAssign';
import { Btn, Modal, AddRow } from '../../components/ui';

export function TagAssignDialog({ known, onApply, onClose }: { known: string[]; onApply: (tags: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { input, setInput, choices, isOn, toggle, addTyped, final } = useTagAssign(known);
  return (
    <Modal open title={t('members.addTags')} onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Btn variant="ghost" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn variant="primary" onClick={() => onApply(final)} disabled={final.length === 0}>{t('common.add')}</Btn>
        </div>
      }>
      <AddRow value={input} onChange={setInput} onAdd={() => { addTyped(); }} placeholder={t('modal.memberTagPlaceholder')} />
      {choices.length > 0 && (
        <div role="group" aria-label={t('modal.memberTags')} style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          {choices.map(tag => {
            const on = isOn(tag);
            return (
              <button key={tagKey(tag)} type="button" className="chip" aria-pressed={on} onClick={() => toggle(tag)}
                style={{ background: on ? 'var(--info-bg)' : 'var(--surface)', color: on ? 'var(--info)' : 'var(--dim)', borderColor: on ? 'var(--info)' : 'var(--border)' }}>
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
