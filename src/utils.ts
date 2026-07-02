import i18n from './i18n/i18n';
import type {SupportedLanguage} from './i18n/i18n';

export interface SystemInfo {
  name: string;
  description: string;
  journalPassword?: string;
  avatar?: string;
  banner?: string;
}

export type GroupNodeKind = 'group' | 'subsystem';

export interface MemberGroup {
  id: string;
  name: string;
  color?: string;
  kind?: GroupNodeKind;
  parentId?: string | null;
  sortOrder?: number;
  sourceId?: string;
}

export const groupKind = (g: MemberGroup): GroupNodeKind => g.kind || 'group';
export const groupParent = (g: MemberGroup): string | null => g.parentId ?? null;

export const childrenOf = (nodes: MemberGroup[], parentId: string | null): MemberGroup[] =>
  nodes
    .filter(n => groupParent(n) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

export const descendantsOf = (nodes: MemberGroup[], id: string): MemberGroup[] => {
  const out: MemberGroup[] = [];
  const walk = (pid: string) => {
    for (const n of nodes) {
      if (groupParent(n) === pid) { out.push(n); walk(n.id); }
    }
  };
  walk(id);
  return out;
};

export const isDescendant = (nodes: MemberGroup[], candidateId: string, ofId: string): boolean => {
  if (candidateId === ofId) return true;
  return descendantsOf(nodes, ofId).some(n => n.id === candidateId);
};

export type CustomFieldType = 'text' | 'markdown' | 'date' | 'dateRange' | 'number' | 'toggle' | 'color' | 'month' | 'year' | 'monthYear' | 'timestamp' | 'monthDay' | 'image';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  sortOrder?: number;
  markdown?: boolean;
}

export interface CustomFieldValue {
  fieldId: string;
  value: string | number | boolean | null;
}

export interface NoteboardEntry {
  id: string;
  memberId: string;
  authorId: string;
  content: string;
  timestamp: number;
  pinned?: boolean;
  read?: boolean;
}

export interface PollOption {
  id: string;
  label: string;
  votes: string[];
}

export interface MemberPoll {
  id: string;
  targetMemberId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: number;
  closedAt?: number;
  hideVoterNames?: boolean;
}

export type MemberSortMode = 'alphabetical' | 'reverse-alphabetical' | 'age' | 'color' | 'role' | 'manual';

export interface Member {
  id: string;
  name: string;
  pronouns: string;
  role: string;
  color: string;
  description: string;
  tags?: string[];
  groupIds?: string[];
  archived?: boolean;
  // Soft-delete tombstone: hidden from every member list but kept so front history &
  // stats resolve the member's name/color instead of the raw ID.
  deleted?: boolean;
  avatar?: string;
  banner?: string;
  customFields?: CustomFieldValue[];
  sortOrder?: number;
  createdAt?: number;
  isCustomFront?: boolean;
  sourceId?: string;
}

export type HistoryChangeType = 'front' | 'mood' | 'location' | 'note';
export type FrontTierKey = 'primary' | 'coFront' | 'coConscious';

export interface FrontTier {
  memberIds: string[];
  mood?: string;
  note: string;
  location?: string;
  energyLevel?: number;
}

export interface FrontState {
  primary: FrontTier;
  coFront: FrontTier;
  coConscious: FrontTier;
  startTime: number;
}

export interface HistoryEntry {
  memberIds: string[];
  startTime: number;
  endTime: number | null;
  note: string;
  mood?: string;
  location?: string;
  energyLevel?: number;
  coFrontIds?: string[];
  coFrontMood?: string;
  coFrontNote?: string;
  coFrontEnergy?: number;
  coConsciousIds?: string[];
  coConsciousMood?: string;
  coConsciousNote?: string;
  coConsciousEnergy?: number;
  changeType?: HistoryChangeType;
  changeTime?: number;
  changeTier?: FrontTierKey;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  authorIds: string[];
  hashtags: string[];
  password?: string;
  timestamp: number;
  pinned?: boolean;
}

export const buildEffectiveEnd = (history: HistoryEntry[]): ((e: HistoryEntry) => number | null) => {
  const starts = history
    .filter(e => !e.changeType || e.changeType === 'front')
    .map(e => e.startTime)
    .sort((a, b) => a - b);
  return (e: HistoryEntry): number | null => {
    if (e.endTime != null) return e.endTime;
    let lo = 0; let hi = starts.length - 1; let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] > e.startTime) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    return ans === -1 ? null : starts[ans];
  };
};

export interface JournalTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  hashtags: string[];
  createdAt?: number;
}

export interface ShareSettings {
  showFront: boolean;
  showMembers: boolean;
  showDescriptions: boolean;
}

export type TextScale = 1.0 | 1.25 | 1.5;

export type AccountMode = 'system' | 'singlet';

export const SINGLET_HIDDEN_STATUS_NAMES = ['Blurry', 'Blendy', 'Rapid Switching', 'Dissociated'];
export const singletStatuses = (members: Member[]): Member[] =>
  members.filter(m => m.isCustomFront && !m.archived && !SINGLET_HIDDEN_STATUS_NAMES.includes(m.name));

export interface AppSettings {
  accountMode?: AccountMode;
  selfMemberId?: string;
  locations: string[];
  customMoods: string[];
  lightMode: boolean;
  gpsEnabled: boolean;
  filesEnabled: boolean;
  language: SupportedLanguage;
  notificationsEnabled: boolean;
  activePaletteId: string;
  textScale: TextScale;
  memberSortMode?: MemberSortMode;
  frontCheckInterval?: number;
  useDyslexicFont?: boolean;
  fontChoice?: import('./theme').FontChoice;
  customFrontsSeeded?: boolean;
  memberListFields?: { groups?: boolean; descriptions?: boolean; pronouns?: boolean; roles?: boolean };
}

export interface Medication {
  id: string;
  name: string;
  dosage?: string;
  times: string[];
  enabled: boolean;
  notes?: string;
  createdAt: number;
}

export interface MedicalAppointment {
  id: string;
  title: string;
  time: number;
  location?: string;
  notes?: string;
  reminderMinutesBefore?: number;
  createdAt: number;
}

export interface MedicalHistoryEntry {
  id: string;
  title: string;
  date?: number;
  notes?: string;
  createdAt: number;
}

export interface EmergencyInfo {
  conditions?: string;
  allergies?: string;
  bloodType?: string;
  notes?: string;
  showOnNotification: boolean;
}

export interface MedicalData {
  medications: Medication[];
  appointments: MedicalAppointment[];
  history: MedicalHistoryEntry[];
  emergency: EmergencyInfo;
}

export const DEFAULT_MEDICAL: MedicalData = {
  medications: [],
  appointments: [],
  history: [],
  emergency: { showOnNotification: false },
};

export const isValidTimeHHMM = (v: string): boolean =>
  /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim());

// Convert a 12-hour entry ("9", "9:30") + meridiem to canonical 24h "HH:MM". Returns null if invalid.
export const time12to24 = (raw: string, ampm: 'AM' | 'PM'): string | null => {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec((raw || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h < 1 || h > 12 || min < 0 || min > 59) return null;
  if (ampm === 'AM') { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

// Format a canonical 24h "HH:MM" for display as 12-hour with meridiem, e.g. "9:00 PM".
export const formatTime12 = (hhmm24: string): string => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm24 || '').trim());
  if (!m) return hhmm24;
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ampm}`;
};

export interface RelationshipTypeDef {
  id: string;
  name: string;
  inverseName?: string;
  directional: boolean;
  color?: string;
  preset?: boolean;
  overridden?: boolean;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  typeId: string;
  note?: string;
  createdAt: number;
}

export const DEFAULT_REL_COLOR = '#8A94A6';
export const RELATIONSHIP_COLOR_CHOICES = ['#E05B5B', '#5BBF7A', '#D9B84A', '#E87BA8'];

export const PRESET_RELATIONSHIP_TYPES: RelationshipTypeDef[] = [
  { id: 'love', name: 'Love', directional: false, color: '#E87BA8', preset: true },
  { id: 'friend', name: 'Friend', directional: false, color: '#5BBF7A', preset: true },
  { id: 'ally', name: 'Ally', directional: false, color: '#D9B84A', preset: true },
  { id: 'rival', name: 'Rival', directional: false, color: '#E05B5B', preset: true },
];

export const allRelationshipTypes = (customTypes: RelationshipTypeDef[]): RelationshipTypeDef[] => {
  const overrides = new Map(customTypes.filter(t => t.preset).map(t => [t.id, t]));
  const presets = PRESET_RELATIONSHIP_TYPES.map(p => {
    const o = overrides.get(p.id);
    return o ? { ...p, ...o, overridden: true } : p;
  });
  return [...presets, ...customTypes.filter(t => !t.preset)];
};

export const relationshipDegrees = (memberIds: string[], relationships: Relationship[]): Record<string, number> => {
  const degrees: Record<string, number> = {};
  for (const id of memberIds) degrees[id] = 0;
  for (const r of relationships) {
    if (degrees[r.fromId] !== undefined) degrees[r.fromId] += 1;
    if (degrees[r.toId] !== undefined) degrees[r.toId] += 1;
  }
  return degrees;
};

export interface ExportPayload {
  _meta: {version: string; app: string; exportedAt: string;};
  system: SystemInfo;
  members: Member[];
  frontHistory: HistoryEntry[];
  journal: JournalEntry[];
  groups?: MemberGroup[];
  chatChannels?: ChatChannel[];
  chatMessages?: Record<string, ChatMessage[]>;
  settings?: AppSettings;
  front?: FrontState | null;
  palettes?: any[];
  avatars?: Record<string, string>;
  banners?: Record<string, string>;
  customMoods?: string[];
  customFieldDefs?: CustomFieldDef[];
  noteboards?: NoteboardEntry[];
  polls?: MemberPoll[];
  journalTemplates?: JournalTemplate[];
  relationships?: Relationship[];
  relationshipTypes?: RelationshipTypeDef[];
  systemMapMembers?: string[];
  medical?: MedicalData;
}

export type ChatMessageType = 'text' | 'image' | 'file' | 'reply' | 'reaction';

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  type: ChatMessageType;
  content: string;
  replyToId?: string;
  reactions?: Record<string, string[]>;
  timestamp: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  archived?: boolean;
  archivedAt?: number;
  createdAt: number;
}

export const DEFAULT_CHANNELS: {name: string}[] = [
  {name: 'General'},
  {name: 'Venting'},
  {name: 'Planning'},
];

export const DEFAULT_MOODS = [
  'Calm', 'Happy', 'Anxious', 'Tired', 'Energetic',
  'Dissociated', 'Grounded', 'Irritable', 'Sad', 'Focused',
];

export const MOOD_DELIMITER = ', ';
export const parseMoodList = (mood: string | undefined): string[] =>
  (mood || '').split(',').map(s => s.trim()).filter(Boolean);
export const serializeMoodList = (moods: string[]): string =>
  moods.filter(Boolean).map(s => s.trim()).filter(Boolean).join(MOOD_DELIMITER);
export const toggleMoodInList = (current: string | undefined, chip: string): string => {
  const list = parseMoodList(current);
  const i = list.indexOf(chip);
  if (i >= 0) list.splice(i, 1);
  else list.push(chip);
  return serializeMoodList(list);
};

export const translateMood = (mood: string, t: (k: string) => string): string => {
  if (!mood) return '';
  const parts = mood.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const translateOne = (one: string): string => {
    const canon = DEFAULT_MOODS.find(d => d.toLowerCase() === one.toLowerCase());
    if (canon) {
      const translated = t(`mood.${canon}`);
      return translated && translated !== `mood.${canon}` ? translated : canon;
    }
    return one;
  };
  return parts.map(translateOne).join(', ');
};

export const DEFAULT_CUSTOM_FRONT_NAMES = ['Chatty', 'Non-Verbal', 'IWC', 'DNI', 'Blurry', 'Blendy', 'Rapid Switching', 'Foggy', 'Grounded', 'Dissociated', 'Anxious', 'Depressed', 'Cheerful', 'Happy', 'Sad', 'Crisis', 'Melancholy', 'Stimming', 'Stressed', 'Working', 'Traveling', 'Sleeping', 'Hyperfocus'];

const CUSTOM_FRONT_COLORS = ['#DAA520', '#7B9FE8', '#E87BA8', '#7BE8C4', '#A87BE8', '#E8A87B', '#6EC9A9', '#E87B7B', '#85B4E8', '#C97BE8', '#B4E885', '#E8C97B'];

export const makeDefaultCustomFronts = (): Member[] =>
  DEFAULT_CUSTOM_FRONT_NAMES.map((name, i) => ({
    id: uid(),
    name,
    pronouns: '',
    role: '',
    color: CUSTOM_FRONT_COLORS[i % CUSTOM_FRONT_COLORS.length],
    description: '',
    isCustomFront: true,
    tags: [],
    groupIds: [],
    customFields: [],
  }));

export const EMPTY_TIER: FrontTier = {memberIds: [], note: ''};

export const migrateFrontState = (raw: any): FrontState | null => {
  if (!raw) return null;
  if (raw.primary) return raw as FrontState;
  return {
    primary: {memberIds: raw.memberIds || [], mood: raw.mood, note: raw.note || '', location: raw.location},
    coFront: {memberIds: [], note: ''},
    coConscious: {memberIds: [], note: ''},
    startTime: raw.startTime || Date.now(),
  };
};

export const historyEntryToFrontState = (entry: HistoryEntry): FrontState => ({
  primary: {
    memberIds: entry.memberIds,
    mood: entry.mood,
    note: entry.note || '',
    location: entry.location,
  },
  coFront: {
    memberIds: entry.coFrontIds || [],
    mood: entry.coFrontMood,
    note: entry.coFrontNote || '',
  },
  coConscious: {
    memberIds: entry.coConsciousIds || [],
    mood: entry.coConsciousMood,
    note: entry.coConsciousNote || '',
  },
  startTime: entry.startTime,
});

export const findOpenFrontInHistory = (history: HistoryEntry[]): FrontState | null => {
  const openFrontEntry = history.find(entry =>
    entry.endTime === null &&
    entry.memberIds.length > 0 &&
    (!entry.changeType || entry.changeType === 'front')
  );

  return openFrontEntry ? historyEntryToFrontState(openFrontEntry) : null;
};

export const isFrontEmpty = (f: FrontState | null): boolean =>
  !f || (f.primary.memberIds.length === 0 && f.coFront.memberIds.length === 0 && f.coConscious.memberIds.length === 0);

export const allFrontMemberIds = (f: FrontState | null): string[] =>
  f ? [...f.primary.memberIds, ...f.coFront.memberIds, ...f.coConscious.memberIds] : [];

export const frontToHistoryEntry = (f: FrontState, endTime: number | null, changeType: HistoryChangeType = 'front', changeTier?: FrontTierKey): HistoryEntry => ({
  memberIds: f.primary.memberIds,
  startTime: f.startTime,
  endTime,
  note: f.primary.note,
  mood: f.primary.mood,
  location: f.primary.location,
  energyLevel: f.primary.energyLevel,
  coFrontIds: f.coFront.memberIds.length > 0 ? f.coFront.memberIds : undefined,
  coFrontMood: f.coFront.mood,
  coFrontNote: f.coFront.note || undefined,
  coFrontEnergy: f.coFront.energyLevel,
  coConsciousIds: f.coConscious.memberIds.length > 0 ? f.coConscious.memberIds : undefined,
  coConsciousMood: f.coConscious.mood,
  coConsciousNote: f.coConscious.note || undefined,
  coConsciousEnergy: f.coConscious.energyLevel,
  changeType,
  changeTime: changeType !== 'front' ? Date.now() : undefined,
  changeTier,
});

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

const getLocale = (): string => {
  const lang = i18n.language || 'en';
  const localeMap: Record<string, string> = {en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', fi: 'fi-FI', nb: 'nb-NO', zh: 'zh-CN', ja: 'ja-JP'};
  return localeMap[lang] || 'en-US';
};

export const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleString(getLocale(), {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(getLocale(), {
    weekday: 'short', month: 'short', day: 'numeric',
  });

export const fmtDur = (start: number, end?: number | null): string => {
  const ms = (end ?? Date.now()) - start;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m` : '<1m';
};

export const getInitials = (name: string): string =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export const isValidHex = (hex: string): boolean =>
  /^#[0-9A-Fa-f]{6}$/.test(hex);

export const normalizeHex = (input: string): string =>
  (input.startsWith('#') ? input : `#${input}`).toUpperCase();

export const sortMembers = (members: Member[], mode: MemberSortMode = 'alphabetical'): Member[] => {
  const sorted = [...members];
  switch (mode) {
    case 'alphabetical': return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'reverse-alphabetical': return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'age': return sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    case 'color': return sorted.sort((a, b) => a.color.localeCompare(b.color));
    case 'role': return sorted.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
    case 'manual': return sorted.sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    default: return sorted;
  }
};

export const TIER_LABELS: Record<FrontTierKey, string> = {
  primary: 'Primary Front',
  coFront: 'Co-Front',
  coConscious: 'Co-Conscious',
};

export const TEXT_SCALE_OPTIONS: {label: string; value: TextScale}[] = [
  {label: 'Normal', value: 1.0},
  {label: 'Large', value: 1.25},
  {label: 'Extra Large', value: 1.5},
];

export const BANNER_WIDTH = 900;
export const BANNER_HEIGHT = 300;

export const resizeBannerDataUrl = (dataUrl: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const targetAspect = BANNER_WIDTH / BANNER_HEIGHT;
        const srcAspect = img.width / img.height;
        let cropW: number, cropH: number, offsetX: number, offsetY: number;
        if (srcAspect > targetAspect) {
          cropH = img.height;
          cropW = Math.round(img.height * targetAspect);
          offsetX = Math.round((img.width - cropW) / 2);
          offsetY = 0;
        } else {
          cropW = img.width;
          cropH = Math.round(img.width / targetAspect);
          offsetX = 0;
          offsetY = Math.round((img.height - cropH) / 2);
        }
        const canvas = document.createElement('canvas');
        canvas.width = BANNER_WIDTH;
        canvas.height = BANNER_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);
        resolve(canvas.toDataURL('image/png', 0.9));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });

export const parallelMap = async <T, U>(
  items: T[],
  worker: (item: T, index: number) => Promise<U>,
  concurrency = 6,
  onProgress?: (done: number, total: number) => void,
): Promise<U[]> => {
  const total = items.length;
  const results: U[] = new Array(total);
  if (total === 0) return results;
  let nextIndex = 0;
  let completed = 0;
  const runOne = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      try { results[i] = await worker(items[i], i); }
      catch { results[i] = undefined as any; }
      completed++;
      if (onProgress) { try { onProgress(completed, total); } catch {} }
    }
  };
  const lanes = Math.max(1, Math.min(concurrency, total));
  await Promise.all(Array.from({length: lanes}, () => runOne()));
  return results;
};
