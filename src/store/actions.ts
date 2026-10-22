import { store, KEYS } from '../storage';
import { Member, FrontState, FrontTier, FrontTierKey, AppSettings, HistoryEntry, isFrontEmpty, isOpenFrontEntry, frontToHistoryEntry, frontTiersWith, frontTiersWithout, pruneFrontOfGone, computeFrontUpdate, fontChoiceOf, mergeTags, findSelfMember, newSelfMember, upsertById } from '../utils';
import { CustomPalette, ThemeColors, deriveTheme, applyThemeToDOM, applyTextScale, applyFontChoice, DARK_PALETTE, BUILTIN_PALETTES } from '../theme';
import { changeLanguage } from '../i18n/i18n';
import { setTerminologyOverrides, setTierNameOverrides } from '../i18n/terminology';
import { useAppStore, AppData, DataKey } from './appStore';
import { logError } from '../utils/log';

const KEY_OF: Record<DataKey, string> = {
  system: KEYS.system,
  members: KEYS.members,
  groups: KEYS.groups,
  front: KEYS.front,
  history: KEYS.history,
  journal: KEYS.journal,
  journalTemplates: KEYS.journalTemplates,
  channels: KEYS.chatChannels,
  chatCategories: KEYS.chatCategories,
  settings: KEYS.settings,
  palettes: KEYS.palettes,
  customFieldDefs: KEYS.customFieldDefs,
  noteboards: KEYS.noteboards,
  polls: KEYS.polls,
  relationships: KEYS.relationships,
  relationshipTypes: KEYS.relationshipTypes,
  systemMapMembers: KEYS.systemMapMembers,
  systemMapPositions: KEYS.systemMapPositions,
  whiteboard: KEYS.whiteboard,
  customColors: KEYS.customColors,
  medical: KEYS.medical,
  planner: KEYS.planner,
};

export const applySettings = (settings: AppSettings, palettes: CustomPalette[]): ThemeColors => {
  const allPalettes = [...BUILTIN_PALETTES, ...palettes];
  const activePalette = allPalettes.find(p => p.id === settings.activePaletteId) || DARK_PALETTE;
  const theme = deriveTheme(activePalette.bg, activePalette.accent, activePalette.text, activePalette.mid);
  applyThemeToDOM(theme);
  applyTextScale(settings.textScale);
  applyFontChoice(fontChoiceOf(settings));
  changeLanguage(settings.language);
  setTerminologyOverrides(settings.terminology);
  setTierNameOverrides(settings.tierNames);
  return theme;
};

export const saveData = async <K extends DataKey>(key: K, value: AppData[K]): Promise<void> => {
  useAppStore.getState().setData(key, value);
  await store.set(KEY_OF[key], value);
};

export const saveBatch = async (patch: Partial<AppData>): Promise<void> => {
  useAppStore.getState().setMany(patch);
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as DataKey[]) updates[KEY_OF[key]] = patch[key];
  await store.setBatch(updates);
};

export const saveMembers = async (members: Member[]): Promise<void> => {
  const { front } = useAppStore.getState();
  await saveData('members', members);
  const pruned = pruneFrontOfGone(members, front);
  if (pruned !== undefined) await saveData('front', pruned);
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const theme = applySettings(settings, useAppStore.getState().palettes);
  useAppStore.getState().setMany({ settings, theme });
  await store.set(KEYS.settings, settings);
};

export const savePalettes = async (palettes: CustomPalette[]): Promise<void> => {
  const theme = applySettings(useAppStore.getState().settings, palettes);
  useAppStore.getState().setMany({ palettes, theme });
  await store.set(KEYS.palettes, palettes);
};

export const removeMemberLinks = async (id: string): Promise<void> => {
  const { relationships, systemMapMembers, systemMapPositions } = useAppStore.getState();
  const keep = relationships.filter(r => r && r.fromId !== id && r.toId !== id);
  if (keep.length !== relationships.length) await saveData('relationships', keep);
  if (systemMapMembers.includes(id)) await saveData('systemMapMembers', systemMapMembers.filter(x => x !== id));
  if (id in systemMapPositions) {
    const { [id]: _drop, ...rest } = systemMapPositions;
    await saveData('systemMapPositions', rest);
  }
};

export const patchSettings = (patch: Partial<AppSettings>): Promise<void> =>
  saveSettings({ ...useAppStore.getState().settings, ...patch });

const asTier = (tier: Partial<FrontTier> | null | undefined): FrontTier => ({
  memberIds: tier?.memberIds || [],
  mood: tier?.mood,
  note: tier?.note || '',
  location: tier?.location,
  energyLevel: tier?.energyLevel,
});

const withOpenEntry = (history: HistoryEntry[], front: FrontState | null): HistoryEntry[] =>
  front && !isFrontEmpty(front) && !history.some(e => isOpenFrontEntry(e, front.startTime))
    ? [frontToHistoryEntry(front, null), ...history]
    : history;

export const updateFront = async (primary: Partial<FrontTier>, coFront: Partial<FrontTier>, coConscious: Partial<FrontTier>): Promise<FrontState | null> => {
  const { front, history } = useAppStore.getState();
  const next = computeFrontUpdate(front, withOpenEntry(history, front), asTier(primary), asTier(coFront), asTier(coConscious));
  await saveBatch({ history: next.history, front: next.front });
  return next.front;
};

export const quickAddToFront = async (memberId: string, tier: FrontTierKey): Promise<FrontState | null> => {
  const tiers = frontTiersWith(useAppStore.getState().front, memberId, tier);
  return updateFront(tiers.primary, tiers.coFront, tiers.coConscious);
};

export const removeFromFront = async (memberId: string): Promise<FrontState | null> => {
  const { front } = useAppStore.getState();
  if (!front) return null;
  const tiers = frontTiersWithout(front, memberId);
  return updateFront(tiers.primary, tiers.coFront, tiers.coConscious);
};

const updateMembers = (ids: Iterable<string>, change: (m: Member) => Member): Promise<void> => {
  const idSet = new Set(ids);
  return saveMembers(useAppStore.getState().members.map(m => (idSet.has(m.id) ? change(m) : m)));
};

export const saveMember = (member: Member): Promise<void> =>
  saveMembers(upsertById(useAppStore.getState().members, member));

const forgetMemberLinks = async (id: string): Promise<void> => {
  try { await removeMemberLinks(id); } catch (e) { logError('members', e); }
};

export const restoreDeletedMember = (id: string): Promise<void> =>
  updateMembers([id], m => ({ ...m, deleted: false, archived: false }));

export const bulkSetFacet = (ids: string[], toFacet: boolean): Promise<void> =>
  updateMembers(ids, m => (m.isCustomFront ? m : { ...m, isFacet: toFacet }));

export const bulkSetArchived = (ids: string[], archived: boolean): Promise<void> =>
  updateMembers(ids, m => ({ ...m, archived }));

export const bulkDeleteMembers = async (ids: string[]): Promise<void> => {
  for (const id of ids) await forgetMemberLinks(id);
  await updateMembers(ids, m => ({ ...m, archived: true, deleted: true }));
};

export const deleteMember = (id: string): Promise<void> => bulkDeleteMembers([id]);

export const bulkAddGroups = (ids: string[], groupIds: string[]): Promise<void> =>
  updateMembers(ids, m => ({ ...m, groupIds: [...new Set([...(m.groupIds || []), ...groupIds])] }));

export const bulkRemoveFromGroup = (ids: string[], groupId: string): Promise<void> =>
  updateMembers(ids, m => ({ ...m, groupIds: (m.groupIds || []).filter(g => g !== groupId) }));

export const bulkAddTags = (ids: string[], tags: string[]): Promise<void> =>
  updateMembers(ids, m => {
    const next = mergeTags(m.tags, tags);
    return next.length === (m.tags || []).length ? m : { ...m, tags: next };
  });

export const ensureSelfMember = async (defaultName: string): Promise<Member> => {
  const { members, settings, system } = useAppStore.getState();
  const self = findSelfMember(members, settings.selfMemberId);
  if (self) {
    if (self.id !== settings.selfMemberId) await patchSettings({ selfMemberId: self.id });
    return self;
  }
  const created = newSelfMember(system.name || defaultName);
  await saveMembers([...members, created]);
  await patchSettings({ selfMemberId: created.id });
  return created;
};
