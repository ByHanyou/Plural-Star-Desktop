import { create } from 'zustand';
import {
  SystemInfo, Member, MemberGroup, FrontState, HistoryEntry, JournalEntry, JournalTemplate, ChatChannel, ChatCategory, AppSettings,
  CustomFieldDef, NoteboardEntry, MemberPoll, Relationship, RelationshipTypeDef, WhiteboardStroke, MedicalData, PlannerData,
  DEFAULT_MEDICAL, DEFAULT_PLANNER, DEFAULT_SETTINGS, EMPTY_SYSTEM,
} from '../utils';
import { CustomPalette, ThemeColors, deriveTheme, DARK_PALETTE } from '../theme';

export interface AppData {
  system: SystemInfo;
  members: Member[];
  groups: MemberGroup[];
  front: FrontState | null;
  history: HistoryEntry[];
  journal: JournalEntry[];
  journalTemplates: JournalTemplate[];
  channels: ChatChannel[];
  chatCategories: ChatCategory[];
  settings: AppSettings;
  palettes: CustomPalette[];
  customFieldDefs: CustomFieldDef[];
  noteboards: NoteboardEntry[];
  polls: MemberPoll[];
  relationships: Relationship[];
  relationshipTypes: RelationshipTypeDef[];
  systemMapMembers: string[];
  systemMapPositions: Record<string, { x: number; y: number }>;
  whiteboard: WhiteboardStroke[];
  customColors: string[];
  medical: MedicalData;
  planner: PlannerData;
}

export type DataKey = keyof AppData;

export const INITIAL_DATA: AppData = {
  system: EMPTY_SYSTEM,
  members: [],
  groups: [],
  front: null,
  history: [],
  journal: [],
  journalTemplates: [],
  channels: [],
  chatCategories: [],
  settings: DEFAULT_SETTINGS,
  palettes: [],
  customFieldDefs: [],
  noteboards: [],
  polls: [],
  relationships: [],
  relationshipTypes: [],
  systemMapMembers: [],
  systemMapPositions: {},
  whiteboard: [],
  customColors: [],
  medical: DEFAULT_MEDICAL,
  planner: DEFAULT_PLANNER,
};

type AppStore = AppData & {
  theme: ThemeColors;
  loaded: boolean;
  setData: <K extends DataKey>(key: K, value: AppData[K]) => void;
  setMany: (patch: Partial<AppData> & { theme?: ThemeColors; loaded?: boolean }) => void;
};

export const useAppStore = create<AppStore>()(set => ({
  ...INITIAL_DATA,
  theme: deriveTheme(DARK_PALETTE.bg, DARK_PALETTE.accent, DARK_PALETTE.text, DARK_PALETTE.mid),
  loaded: false,
  setData: (key, value) => set({ [key]: value }),
  setMany: patch => set(patch),
}));
