import type { TFunction } from 'i18next';
import { logError } from '../utils/log';
import { Member, HistoryEntry, JournalEntry, SystemInfo, AppSettings, ChatChannel, ExportPayload } from '../utils';
import { CustomPalette } from '../theme';
import { ImportControl } from './progress';
import type { ExportCategories } from '../export/categories';
import type { ExtPreview } from './preview';

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
  setImporting: (v: boolean) => void;
  showExportOptions: boolean;
  exportSel: ExportCategories;
  restoreData: ExportPayload | null;
  setRestoreData: (d: ExportPayload | null) => void;
  setRestoreFile: (f: string | null) => void;
  restoreSel: Record<string, boolean>;
  mergeLogs: boolean;
  extToken: string;
  setExtToken: (token: string) => void;
  setExtLoading: (v: boolean) => void;
  extPreview: ExtPreview | null;
  setExtPreview: (p: ExtPreview | null) => void;
  extSel: Record<string, boolean>;
  importMode: 'overwrite' | 'update';
  control?: ImportControl;
};
