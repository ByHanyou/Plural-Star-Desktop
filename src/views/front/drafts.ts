import { FrontState, FrontTier, FrontTierKey, withCustomMood } from '../../utils';

export interface DetailDraft {
  mood: string;
  customMood: string;
  showCustomMood: boolean;
  location: string;
  note: string;
}

export interface TierDraft extends DetailDraft {
  ids: Set<string>;
  energy?: number;
  search: string;
}

export type TierDrafts = Record<FrontTierKey, TierDraft>;

export const detailOf = (tier: Partial<FrontTier> | null): DetailDraft => ({
  mood: tier?.mood || '',
  customMood: '',
  showCustomMood: false,
  location: tier?.location || '',
  note: tier?.note || '',
});

const draftOf = (tier: FrontTier | null, taken: Set<string>): TierDraft => ({
  ...detailOf(tier),
  ids: new Set((tier?.memberIds || []).filter(id => !taken.has(id))),
  energy: tier?.energyLevel,
  search: '',
});

export const seedDrafts = (current: FrontState | null): TierDrafts => {
  const primary = draftOf(current?.primary ?? null, new Set());
  const coFront = draftOf(current?.coFront ?? null, primary.ids);
  const coConscious = draftOf(current?.coConscious ?? null, new Set([...primary.ids, ...coFront.ids]));
  return { primary, coFront, coConscious };
};

export const resolveMood = (d: DetailDraft): string | undefined => withCustomMood(d.mood, d.showCustomMood, d.customMood);

export const draftToTier = (d: TierDraft): Partial<FrontTier> => ({
  memberIds: [...d.ids],
  mood: resolveMood(d),
  note: d.note,
  location: d.location || undefined,
  energyLevel: d.energy,
});
