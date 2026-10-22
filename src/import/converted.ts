import { Member, HistoryEntry, MemberGroup, CustomFieldDef } from '../utils';
import i18n from '../i18n/i18n';

export interface ConvertedImport {
  sourceLabel: string;
  members: Member[];
  history: HistoryEntry[];
  groups?: MemberGroup[];
  customFieldDefs?: CustomFieldDef[];
  systemName?: string;
  systemDesc?: string;
  systemAvatar?: string;
  systemBanner?: string;
  journal?: { title: string; body: string; authorIds: string[]; timestamp: number; hashtags?: string[]; pinned?: boolean }[];
  chat?: { name: string; createdAt: number; messages: { authorId: string; content: string; timestamp: number }[] }[];
}

export const optString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
export const optNumber = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
export const httpUrl = (v: unknown): string | undefined => (/^https?:\/\//.test(String(v || '')) ? String(v) : undefined);
export const unnamed = (name: unknown): string => String(name || '').trim() || i18n.t('share.unnamedMember');
export const fieldName = (name: unknown, i: number): string =>
  String(name || i18n.t('share.fieldN', {n: i + 1})).trim() || i18n.t('share.fieldN', {n: i + 1});
