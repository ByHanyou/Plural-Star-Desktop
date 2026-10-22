import { useMemo } from 'react';
import { FrontTier, Member, moodChoices } from '../utils';
import { useAppStore } from '../store/appStore';
import { SetFrontModal } from '../views/front/SetFrontModal';
import { SetStatusModal } from '../views/front/SetStatusModal';

export function QuickFrontModal({ open, onClose, onSave, isSinglet, statuses, selfId }: {
  open: boolean;
  onClose: () => void;
  onSave: (p: Partial<FrontTier>, cf: Partial<FrontTier>, cc: Partial<FrontTier>) => void;
  isSinglet: boolean;
  statuses: Member[];
  selfId: string | undefined;
}) {
  const members = useAppStore(s => s.members);
  const front = useAppStore(s => s.front);
  const settings = useAppStore(s => s.settings);
  const activeMembers = useMemo(() => members.filter(m => !m.archived), [members]);
  const allMoods = useMemo(() => moodChoices(settings.customMoods), [settings.customMoods]);

  return isSinglet ? (
    <SetStatusModal
      open={open}
      onClose={onClose}
      onSave={onSave}
      statuses={statuses}
      selfId={selfId}
      current={front}
      settings={settings}
    />
  ) : (
    <SetFrontModal
      open={open}
      onClose={onClose}
      onSave={onSave}
      members={activeMembers}
      current={front}
      settings={settings}
      allMoods={allMoods}
    />
  );
}
