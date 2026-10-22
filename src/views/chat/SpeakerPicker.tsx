import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Member, frontersFirst } from '../../utils';
import { useAppStore } from '../../store/appStore';
import { useEscapeKey } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import { MemberSelect } from '../../components/MemberSelect';
import { memberFacetPools } from '../../picker/memberPicker';
import type { PickerPool } from '../../picker/memberPicker';

export function SpeakerPicker({ speaker, onChange }: { speaker: Member | undefined; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const front = useAppStore(s => s.front);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEscapeKey(open, () => { setOpen(false); triggerRef.current?.focus(); });
  const pools = useMemo(() => memberFacetPools(members, t), [members, t]);
  const order = useCallback((rows: Member[], pool: PickerPool) => pool.kind === 'members' ? frontersFirst(rows, front) : rows, [front]);

  return (
    <>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--dim)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
        {t('common.speakingAs')}
      </span>
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} aria-expanded={open}
        aria-label={speaker ? t('chat.speakingAsNamed', { name: speaker.name }) : t('common.speakingAs')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
        {speaker && (
          <>
            <MemberAvatar member={speaker} size={22} fontSize={9} decorative />
            <span style={{ fontSize: 12, color: speaker.color, flex: 1, textAlign: 'left' }}>{speaker.name}</span>
          </>
        )}
        <span style={{ fontSize: 10, color: 'var(--dim)' }} aria-hidden>▼</span>
      </button>

      {open && (
        <div style={{ marginTop: 4 }}>
          <MemberSelect pools={pools} selected={speaker?.id} onPick={m => { onChange(m.id); setOpen(false); setSearch(''); }}
            search={search} onSearch={setSearch} autoFocus listMaxHeight={200} maxResults={Infinity} orderRows={order} />
        </div>
      )}
    </>
  );
}
