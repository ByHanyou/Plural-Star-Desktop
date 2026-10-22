import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Btn, Field, Modal } from '../components/ui';
import { MIRROR_SYSTEM_AVATAR_ID, MIRROR_SYSTEM_BANNER_ID } from '../network/types';
import { mirrorMembersOf, mirrorJournalOf, mirrorPlannerOf, mirrorStrokesOf, mirrorProfileOf, mirrorHistoryOf } from '../network/mirror/payload';
import SystemProfileCard from '../components/SystemProfileCard';
import { MarkdownText } from '../components/MarkdownText';
import { JournalEntry, fmtTime } from '../utils';
import { MIRROR_FEATURE_KEY, Nothing, mutedText } from './mirror/shared';
import type { MirrorServedFeature } from '../network/mirror/build';
import { MirrorMembers } from './mirror/MirrorMembers';
import { MirrorGroups } from './mirror/MirrorGroups';
import { MirrorHistory } from './mirror/MirrorHistory';
import { MirrorJournal } from './mirror/MirrorJournal';
import { MirrorPlanner } from './mirror/MirrorPlanner';
import { MirrorWhiteboard } from './mirror/MirrorWhiteboard';
import { groupsPayload, useMirrorFeed } from './mirror/useMirrorFeed';

interface Props {
  open: boolean;
  peerId: string;
  displayName: string;
  feature: MirrorServedFeature;
  online: boolean;
  onClose: () => void;
}

export function MirrorView({ open, peerId, displayName, feature, online, onClose }: Props) {
  const { t } = useTranslation();
  const { entry, memberCache, groupCache, loading, request } = useMirrorFeed(open, peerId, feature, online);
  const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setOpenEntry(null);
    setUnlocked(new Set());
  }, [open, peerId, feature, request]);

  const media = useMemo(() => new Map(Object.entries(entry?.media || {})), [entry]);
  const groupsOf = (id: string) => (groupCache ? groupCache.groups.filter(g => (groupCache.membership.get(g.id) || []).some(x => x.id === id)) : []);

  const openJournalEntry = (e: JournalEntry) => {
    setPwInput('');
    setPwError(false);
    setOpenEntry(e);
  };

  const unlockEntry = () => {
    if (openEntry && pwInput === openEntry.password) {
      setUnlocked(new Set(unlocked).add(openEntry.id));
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const body = () => {
    if (!entry) return <p role="status" style={mutedText}>{online ? t('network.mirrorLoading') : t('network.mirrorEmptyOffline')}</p>;
    if (entry.none) return <Nothing />;
    switch (feature) {
      case 'planner': return <MirrorPlanner data={mirrorPlannerOf(entry.data)} />;
      case 'whiteboard': return <MirrorWhiteboard strokes={mirrorStrokesOf(entry.data)} />;
      case 'systemProfile': {
        const sp = mirrorProfileOf(entry.data);
        return <SystemProfileCard name={sp?.name || displayName} description={sp?.description} avatar={media.get(MIRROR_SYSTEM_AVATAR_ID)} banner={media.get(MIRROR_SYSTEM_BANNER_ID)} />;
      }
      case 'members': return <MirrorMembers members={mirrorMembersOf(entry.data)} media={media} groupsOf={groupsOf} />;
      case 'groups': return <MirrorGroups data={groupsPayload(entry)} />;
      case 'history': return <MirrorHistory entries={mirrorHistoryOf(entry.data)} members={memberCache} />;
      default: return <MirrorJournal entries={mirrorJournalOf(entry.data)} unlocked={unlocked} onOpen={openJournalEntry} />;
    }
  };

  const locked = !!openEntry?.password && !unlocked.has(openEntry.id);

  return (
    <>
      <Modal
        open={open && !openEntry}
        title={t('network.mirrorTitle', { name: displayName, feature: t(MIRROR_FEATURE_KEY[feature]) })}
        onClose={onClose}
        footer={<Btn onClick={request} disabled={!online || loading}>{loading ? t('network.mirrorLoading') : t('network.mirrorRefresh')}</Btn>}>
        {!online && entry && <p role="status" style={{ ...mutedText, marginTop: 0 }}>{t('network.mirrorOffline')}</p>}
        {entry?.fetchedAt ? <p role="status" style={{ ...mutedText, marginTop: 0 }}>{t('network.mirrorUpdated', { time: fmtTime(entry.fetchedAt) })}</p> : null}
        {body()}
      </Modal>

      <Modal open={!!openEntry} title={openEntry?.title || t('tabs.journal')} onClose={() => setOpenEntry(null)}>
        {locked ? (
          <>
            <p style={mutedText}>{t('journal.passwordPrompt')}</p>
            <Field label={t('journal.password')} value={pwInput} onChange={v => { setPwInput(v); setPwError(false); }} placeholder={t('journal.password')} type="password" />
            {pwError && <p role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{t('journal.wrongPassword')}</p>}
            <Btn onClick={unlockEntry} disabled={!pwInput}>{t('common.unlock')}</Btn>
          </>
        ) : (
          <>
            {openEntry?.timestamp ? <p style={mutedText}>{fmtTime(openEntry.timestamp)}</p> : null}
            <MarkdownText text={openEntry?.body || ''} />
          </>
        )}
      </Modal>
    </>
  );
}
