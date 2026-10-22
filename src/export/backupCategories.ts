import type { Member } from '../utils';

export type BundleMember = Member & { avatar_media_path?: string; banner_media_path?: string };

export type BackupCategory = 'system' | 'members' | 'avatars' | 'banners' | 'frontHistory' | 'journal' | 'groups' | 'chat' | 'moods' | 'palettes' | 'settings' | 'customFields' | 'noteboards' | 'planner' | 'medical' | 'polls' | 'journalTemplates';

export const BACKUP_CATEGORIES: [BackupCategory, string][] = [
  ['system', 'share.systemNameDesc'],
  ['members', 'share.memberProfiles'],
  ['avatars', 'share.profilePictures'],
  ['banners', 'share.banners'],
  ['frontHistory', 'share.frontHistory'],
  ['journal', 'share.journalEntries'],
  ['groups', 'share.memberGroups'],
  ['chat', 'share.chatData'],
  ['moods', 'share.customMoodsLabel'],
  ['palettes', 'share.themePalettes'],
  ['settings', 'share.appSettings'],
  ['customFields', 'customFields.title'],
  ['noteboards', 'mailbox.title'],
  ['planner', 'planner.title'],
  ['medical', 'medical.title'],
  ['polls', 'polls.title'],
  ['journalTemplates', 'journal.templatesTab'],
];

export const allCategories = (medical: boolean): Record<BackupCategory, boolean> => ({
  system: true,
  members: true,
  avatars: true,
  banners: true,
  frontHistory: true,
  journal: true,
  groups: true,
  chat: true,
  moods: true,
  palettes: true,
  settings: true,
  customFields: true,
  noteboards: true,
  planner: true,
  medical,
  polls: true,
  journalTemplates: true,
});
