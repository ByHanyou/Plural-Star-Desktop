import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '../../utils';
import { Modal } from '../../components/ui';

function MemberRows({ id, label, members, onAdd, first }: { id: string; label: string; members: Member[]; onAdd: (id: string) => void; first: boolean }) {
  if (members.length === 0) return null;
  return (
    <>
      <div className="field__label" id={id} style={first ? undefined : { marginTop: 12 }}>{label}</div>
      <div role="group" aria-labelledby={id}>
        {members.map(m => (
          <button key={m.id} type="button" onClick={() => onAdd(m.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 8, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: m.color }} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function AddToMapModal({ open, members, facets, onAdd, onClose }: {
  open: boolean; members: Member[]; facets: Member[]; onAdd: (id: string) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <Modal open={open} title={t('systemMap.addMember')} onClose={onClose}>
      {members.length === 0 && facets.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('systemMap.allOnMap')}</p> : (
        <>
          <MemberRows id={`${id}-m`} label={t('members.title')} members={members} onAdd={onAdd} first />
          <MemberRows id={`${id}-f`} label={t('members.facets')} members={facets} onAdd={onAdd} first={members.length === 0} />
        </>
      )}
    </Modal>
  );
}
