import { store, KEYS } from '../storage';
import { importNameKey } from './importNames';
import { Member, uid, findOpenFrontInHistory } from '../utils';
import { convertPKSwitches, mergeHistoryEntries, normHex } from './convert';
import { isImportStopped } from './progress';
import { inlineRemoteAvatars } from './importMedia';
import { ImportCtx, ImportUserError, importErrorText } from './ctx';
import { asArray } from './formats';
import type { PkSystem, PkMember, PkSwitch } from './formats';
import type { PluralKitPreview } from './preview';
import type { TFunction } from 'i18next';

export const handleTokenFetch = async (ctx: ImportCtx) => {
  const { extToken, showStatus, t, setExtLoading, setExtPreview } = ctx;
  if (!extToken.trim()) { showStatus(t('share.tokenRequired'), true); return; }
  setExtLoading(true); setExtPreview(null);
  const headers = {Authorization: extToken.trim(), 'Content-Type': 'application/json'};
  const netFetch = async <T,>(url: string): Promise<T> => {
    const res = await window.electronAPI.net.fetch(url, { headers });
    if (!res.ok) throw new ImportUserError(t('share.authFailed', {status: res.status}));
    try { return JSON.parse(res.text) as T; } catch { return {} as T; }
  };
  try {
    const [sData, mData] = await Promise.all([
      netFetch<PkSystem>('https://api.pluralkit.me/v2/systems/@me'),
      netFetch<unknown>('https://api.pluralkit.me/v2/systems/@me/members'),
    ]);
    const PK_PAGE = 100;
    const PK_MAX_PAGES = 200;
    const swData: PkSwitch[] = [];
    const seenSwitch = new Set<string>();
    let before: string | undefined;
    for (let page = 0; page < PK_MAX_PAGES; page++) {
      const url = `https://api.pluralkit.me/v2/systems/@me/switches?limit=${PK_PAGE}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const batch = await netFetch<unknown>(url);
      if (!Array.isArray(batch) || batch.length === 0) break;
      const page_: PkSwitch[] = batch;
      let added = 0;
      for (const sw of page_) {
        const id = String(sw?.id || sw?.timestamp || '');
        if (id && seenSwitch.has(id)) continue;
        if (id) seenSwitch.add(id);
        swData.push(sw);
        added++;
      }
      const oldest = page_[page_.length - 1]?.timestamp;
      if (!oldest || oldest === before || added === 0 || page_.length < PK_PAGE) break;
      before = String(oldest);
    }
    setExtPreview({source: 'pluralkit', system: sData, members: asArray<PkMember>(mData), switches: swData, groups: []});
  } catch (e) {
    if (isImportStopped(e)) showStatus(t('share.importStopped'));
    else showStatus(t('share.statusImportError', {msg: importErrorText(e, t)}), true);
  } finally {
    setExtLoading(false);
  }
};

interface PkRow {
  member: Member;
  historyId: string;
  aliasId: string;
  matchName: string;
}

const pkRows = (p: PluralKitPreview, extSel: Record<string, boolean>, t: TFunction): PkRow[] => p.members.map(m => ({
  member: {
    id: uid(), name: (extSel.displayNames ? (m.display_name || m.name) : (m.name || m.display_name)) || t('common.unknown'),
    pronouns: extSel.pronouns !== false ? (m.pronouns || '') : '',
    role: '',
    color: normHex(m.color),
    description: m.description || '',
    avatar: extSel.avatars ? (m.avatar_url || undefined) : undefined,
    pkProxyTags: Array.isArray(m.proxy_tags) ? m.proxy_tags : undefined,
    pkAvatarUrl: typeof m.avatar_url === 'string' && m.avatar_url ? m.avatar_url : undefined,
    pkBannerUrl: typeof m.banner === 'string' && m.banner ? m.banner : undefined,
    pkKeepProxy: typeof m.keep_proxy === 'boolean' ? m.keep_proxy : undefined,
    tags: [], groupIds: [],
  },
  historyId: m.uuid || m.id || '',
  aliasId: m.id || '',
  matchName: m.display_name || m.name || '',
}));

export const handleTokenImport = async (ctx: ImportCtx) => {
  const { extPreview, setImporting, system, extSel, members, history, showStatus, setExtPreview, setExtToken, onUpdate, t } = ctx;
  if (!extPreview) return;
  ctx.control?.beginFromLabel(t('share.importing'));
  const rows = pkRows(extPreview, extSel, t);
  setImporting(true);
  try {
    const batch: Record<string, unknown> = {};

    if (extSel.system) {
      batch[KEYS.system] = {...system, name: extPreview.system.name || system.name, description: extPreview.system.description || system.description};
    }
    let newM: Member[] = extSel.members && rows.length > 0 ? rows.map(r => r.member) : [];
    if (extSel.avatars && newM.length > 0) newM = await inlineRemoteAvatars(newM);
    let membersAfter: Member[] = members;
    let membersDirty = false;
    if (newM.length > 0) {
      membersAfter = [...members, ...newM.filter(nm => !members.find(em => importNameKey(em.name) === importNameKey(nm.name)))];
      membersDirty = true;
    }
    if (ctx.importMode === 'overwrite' && extSel.members && rows.length > 0) {
      const importNames = new Set(rows.map(r => importNameKey(r.member.name)));
      membersAfter = membersAfter.map(m => (importNames.has(importNameKey(m.name)) || m.isCustomFront || m.isFacet || m.deleted) ? m : { ...m, archived: true, deleted: true });
      membersDirty = true;
    }
    if (membersDirty) batch[KEYS.members] = membersAfter;

    if (extSel.frontHistory && extPreview.switches.length > 0) {
      const idMap = new Map<string, string>();
      rows.forEach(r => {
        const lm = membersAfter.find(l => importNameKey(l.name) === importNameKey(r.matchName));
        if (!lm) return;
        if (r.historyId) idMap.set(r.historyId, lm.id);
        if (r.aliasId) idMap.set(r.aliasId, lm.id);
      });
      const newH = convertPKSwitches(extPreview.switches, idMap);
      if (newH.length > 0) {
        const merged = mergeHistoryEntries(newH, history);
        batch[KEYS.history] = merged;
        const open = findOpenFrontInHistory(merged);
        if (open) batch[KEYS.front] = open;
      }
    }

    if (Object.keys(batch).length === 0) {
      showStatus(t('share.statusNothingToImport'));
      return;
    }

    await store.setBatch(batch);

    showStatus(t('share.statusImportedCounts', {members: newM.length, switches: extPreview.switches.length}));
    setExtPreview(null); setExtToken('');
    onUpdate();
  } catch (e) {
    if (isImportStopped(e)) showStatus(t('share.importStopped'));
    else showStatus(t('share.statusImportErrorSafe', {msg: importErrorText(e, t)}), true);
  } finally {
    setImporting(false);
  }
};
