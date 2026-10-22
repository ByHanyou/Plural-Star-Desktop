import { store, KEYS, CHAT_KEY_PREFIX } from '../storage';
import { isMediaKey } from '../network/mediaKey';
import {
  SystemInfo, Member, MemberGroup, FrontState, HistoryEntry, JournalEntry, JournalTemplate, ChatChannel, ChatCategory, AppSettings,
  CustomFieldDef, NoteboardEntry, MemberPoll, Relationship, RelationshipTypeDef, WhiteboardStroke, MedicalData, PlannerData,
  DEFAULT_MEDICAL, DEFAULT_PLANNER, DEFAULT_SETTINGS, EMPTY_SYSTEM, migrateFrontState, makeDefaultCustomFronts, normalizeCustomColors, pruneFrontOfGone,
} from '../utils';
import type { CustomPalette } from '../theme';
import { getDeviceLanguage, isSupportedLanguage } from '../i18n/i18n';
import { AppData, useAppStore } from './appStore';
import { applySettings } from './actions';

export const loadAll = async (): Promise<void> => {
  const [
    system, members, groups, frontRaw, history, journal, journalTemplates, channels, chatCategories, settings, palettes,
    customFieldDefs, noteboards, polls, relationships, relationshipTypes, systemMapMembers, systemMapPositions, whiteboard, customColors, medical, planner,
  ] = await Promise.all([
    store.get<SystemInfo>(KEYS.system, EMPTY_SYSTEM),
    store.get<Member[]>(KEYS.members, []),
    store.get<MemberGroup[]>(KEYS.groups, []),
    store.get<FrontState>(KEYS.front, null),
    store.get<HistoryEntry[]>(KEYS.history, []),
    store.get<JournalEntry[]>(KEYS.journal, []),
    store.get<JournalTemplate[]>(KEYS.journalTemplates, []),
    store.get<ChatChannel[]>(KEYS.chatChannels, []),
    store.get<ChatCategory[]>(KEYS.chatCategories, []),
    store.get<AppSettings>(KEYS.settings, null),
    store.get<CustomPalette[]>(KEYS.palettes, []),
    store.get<CustomFieldDef[]>(KEYS.customFieldDefs, []),
    store.get<NoteboardEntry[]>(KEYS.noteboards, []),
    store.get<MemberPoll[]>(KEYS.polls, []),
    store.get<Relationship[]>(KEYS.relationships, []),
    store.get<RelationshipTypeDef[]>(KEYS.relationshipTypes, []),
    store.get<string[]>(KEYS.systemMapMembers, []),
    store.get<Record<string, { x: number; y: number }>>(KEYS.systemMapPositions, {}),
    store.get<WhiteboardStroke[]>(KEYS.whiteboard, []),
    store.get<string[]>(KEYS.customColors, []),
    store.get<MedicalData>(KEYS.medical, null),
    store.get<PlannerData>(KEYS.planner, null),
  ]);

  const mergedSettings: AppSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  if (!isSupportedLanguage(settings?.language)) mergedSettings.language = getDeviceLanguage();
  let memberList = members || [];
  if (!mergedSettings.customFrontsSeeded) {
    const existingCustomNames = new Set(memberList.filter(m => m.isCustomFront).map(m => (m.name || '').toLowerCase()));
    const seeds = makeDefaultCustomFronts().filter(cf => !existingCustomNames.has(cf.name.toLowerCase()));
    memberList = [...memberList, ...seeds];
    mergedSettings.customFrontsSeeded = true;
    await store.setBatch({ [KEYS.members]: memberList, [KEYS.settings]: mergedSettings });
  }
  let front = migrateFrontState(frontRaw);
  const prunedFront = pruneFrontOfGone(memberList, front);
  if (prunedFront !== undefined) {
    front = prunedFront;
    await store.set(KEYS.front, front);
  }

  const memberIds = new Set(memberList.map(m => m.id));
  const allRelationships = relationships || [];
  const validRelationships = allRelationships.filter(r => memberIds.has(r.fromId) && memberIds.has(r.toId));
  if (validRelationships.length !== allRelationships.length) await store.set(KEYS.relationships, validRelationships);
  const savedMapIds = systemMapMembers || [];
  let mapIds: string[];
  if (savedMapIds.length) {
    mapIds = savedMapIds.filter(id => memberIds.has(id));
  } else {
    mapIds = [...new Set(validRelationships.flatMap(r => [r.fromId, r.toId]))];
    if (mapIds.length) await store.set(KEYS.systemMapMembers, mapIds);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  const savedPositions = systemMapPositions || {};
  for (const id in savedPositions) {
    const p = savedPositions[id];
    if (memberIds.has(id) && p && typeof p.x === 'number' && typeof p.y === 'number') positions[id] = p;
  }
  const strokes = (Array.isArray(whiteboard) ? whiteboard : []).filter(s => s && Array.isArray(s.pts) && s.pts.length >= 2);

  const theme = applySettings(mergedSettings, palettes || []);
  useAppStore.getState().setMany({
    system: system || EMPTY_SYSTEM,
    members: memberList,
    groups: groups || [],
    front,
    history: history || [],
    journal: journal || [],
    journalTemplates: journalTemplates || [],
    channels: channels || [],
    chatCategories: chatCategories || [],
    settings: mergedSettings,
    palettes: palettes || [],
    customFieldDefs: customFieldDefs || [],
    noteboards: noteboards || [],
    polls: polls || [],
    relationships: validRelationships,
    relationshipTypes: relationshipTypes || [],
    systemMapMembers: mapIds,
    systemMapPositions: positions,
    whiteboard: strokes,
    customColors: normalizeCustomColors(customColors),
    medical: { ...DEFAULT_MEDICAL, ...(medical || {}) },
    planner: { ...DEFAULT_PLANNER, ...(planner || {}) },
    theme,
    loaded: true,
  });
};

const DERIVED_KEYS = new Set<string>([
  KEYS.system, KEYS.members, KEYS.front, KEYS.settings, KEYS.palettes, KEYS.relationships,
  KEYS.systemMapMembers, KEYS.systemMapPositions, KEYS.whiteboard, KEYS.customColors, KEYS.medical, KEYS.planner,
]);

const SLICE_LOADERS: Record<string, () => Promise<Partial<AppData>>> = {
  [KEYS.history]: async () => ({ history: (await store.get<HistoryEntry[]>(KEYS.history, [])) || [] }),
  [KEYS.journal]: async () => ({ journal: (await store.get<JournalEntry[]>(KEYS.journal, [])) || [] }),
  [KEYS.journalTemplates]: async () => ({ journalTemplates: (await store.get<JournalTemplate[]>(KEYS.journalTemplates, [])) || [] }),
  [KEYS.groups]: async () => ({ groups: (await store.get<MemberGroup[]>(KEYS.groups, [])) || [] }),
  [KEYS.chatChannels]: async () => ({ channels: (await store.get<ChatChannel[]>(KEYS.chatChannels, [])) || [] }),
  [KEYS.chatCategories]: async () => ({ chatCategories: (await store.get<ChatCategory[]>(KEYS.chatCategories, [])) || [] }),
  [KEYS.customFieldDefs]: async () => ({ customFieldDefs: (await store.get<CustomFieldDef[]>(KEYS.customFieldDefs, [])) || [] }),
  [KEYS.noteboards]: async () => ({ noteboards: (await store.get<NoteboardEntry[]>(KEYS.noteboards, [])) || [] }),
  [KEYS.polls]: async () => ({ polls: (await store.get<MemberPoll[]>(KEYS.polls, [])) || [] }),
  [KEYS.relationshipTypes]: async () => ({ relationshipTypes: (await store.get<RelationshipTypeDef[]>(KEYS.relationshipTypes, [])) || [] }),
};

export const reloadKeys = async (keys: string[]): Promise<void> => {
  const wanted = [...new Set(keys.filter(k => k.startsWith('ps:') && !k.startsWith(CHAT_KEY_PREFIX) && !isMediaKey(k)))];
  if (!wanted.length) return;
  if (wanted.some(k => DERIVED_KEYS.has(k) || !SLICE_LOADERS[k])) return loadAll();
  let patch: Partial<AppData> = {};
  for (const k of wanted) patch = { ...patch, ...(await SLICE_LOADERS[k]()) };
  useAppStore.getState().setMany(patch);
};
