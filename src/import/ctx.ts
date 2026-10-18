import type { TFunction } from 'i18next';
import { logError } from '../log';
import { Member, HistoryEntry, JournalEntry, SystemInfo, AppSettings, ChatChannel, ExportPayload } from '../utils';
import { CustomPalette } from '../theme';
import { ImportControl } from './progress';

export class ImportUserError extends Error {}

export const importErrorCode = (e: unknown): string => {
  if (e instanceof SyntaxError) return 'IMPORT-PARSE';
  const msg = e instanceof Error ? e.message : String(e);
  if (/network request failed|fetch|network|timed out|timeout/i.test(msg)) return 'IMPORT-NET';
  if (/zip|file|ENOENT|EACCES|EISDIR|read|permission|directory/i.test(msg)) return 'IMPORT-FILE';
  return 'IMPORT-APP';
};

export const importErrorText = (e: unknown, t: TFunction): string => {
  if (e instanceof ImportUserError) return e.message;
  logError('import', e);
  return `${t('share.errUnexpected')} ${t('common.errorCode', { code: importErrorCode(e) })}`;
};

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
  showStatus: (msg: string, error?: boolean) => void;
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
  importMode: 'overwrite' | 'update';
  control?: ImportControl;
  spGet: (url: string, headers: Record<string, string>) => Promise<any | null>;
};
