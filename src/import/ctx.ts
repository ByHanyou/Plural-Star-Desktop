import type { TFunction } from 'i18next';
import { Member, HistoryEntry, JournalEntry, SystemInfo, AppSettings, ChatChannel, ExportPayload } from '../utils';
import { CustomPalette } from '../theme';
import { ImportControl } from './progress';

export type ImportCtx = {
  system: SystemInfo;
  members: Member[];
  history: HistoryEntry[];
  journal: JournalEntry[];
  settings: AppSettings;
  channels: ChatChannel[];
  palettes: CustomPalette[];
  onUpdate: () => void;
  t: TFunction;
  showStatus: (msg: string) => void;
  setImporting: any;
  showExportOptions: boolean;
  exportSel: any;
  restoreData: ExportPayload | null;
  setRestoreData: any;
  setRestoreFile: any;
  restoreSel: Record<string, boolean>;
  mergeLogs: boolean;
  extSource: 'sp' | 'pk';
  extToken: string;
  setExtToken: any;
  setExtLoading: any;
  extPreview: { members: any[]; switches: any[]; system: any; customFields?: any[]; groups?: any[] } | null;
  setExtPreview: any;
  extSel: Record<string, boolean>;
  /** Drives the wait overlay and carries the stop request. Optional so existing
   *  call sites keep compiling; absent means no progress is reported. */
  control?: ImportControl;
  spGet: (url: string, headers: Record<string, string>) => Promise<any | null>;
};
