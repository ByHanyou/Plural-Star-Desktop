import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FrontTierKey } from '../utils';
import { Btn, SaveErrorDialog } from '../components/ui';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { GroupTree } from './systemManager/GroupTree';
import { GroupBrowser } from './systemManager/GroupBrowser';

interface Props {
  onViewMember?: (id: string) => void;
  onQuickFront?: (memberId: string, tier: FrontTierKey) => void;
  onRemoveFromFront?: (memberId: string) => void;
  startBrowsing?: boolean;
  hideRootTitle?: boolean;
}

export default function SystemManagerView({ onViewMember, onQuickFront, onRemoveFromFront, startBrowsing, hideRootTitle }: Props) {
  const { t } = useTranslation();
  const [browse, setBrowse] = useState(!!startBrowsing);
  const [browseSession, setBrowseSession] = useState(0);
  const [saveError, run, clearSaveError] = useSaveGuard();

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <p style={{ flex: 1, fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, margin: 0 }}>{t('systemManager.desc')}</p>
        <Btn variant={browse ? 'info' : 'ghost'} aria-pressed={browse} onClick={() => { setBrowse(b => !b); setBrowseSession(s => s + 1); }}>
          <span aria-hidden>🗂</span> {t('systemManager.browse')}
        </Btn>
      </div>

      {browse
        ? <GroupBrowser key={browseSession} hideRootTitle={hideRootTitle} onViewMember={onViewMember} onQuickFront={onQuickFront} onRemoveFromFront={onRemoveFromFront} run={run} />
        : <GroupTree run={run} />}

      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
