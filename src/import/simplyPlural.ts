import { store, KEYS } from '../storage';
import { importNameKey } from './importNames';
import { Member, HistoryEntry, CustomFieldDef, CustomFieldValue, withFieldValue, MemberGroup, blankMember, uid, findOpenFrontInHistory } from '../utils';
import { convertSPSwitches, mergeForeignMember, mergeHistoryEntries, finalizeMemberReplace, normHex, spFieldType, spFieldText, normId, localIds } from './convert';
import { isSpExportFile } from './detect';
import { spAvatarUrl, inlineRemoteAvatars } from './importMedia';
import { ImportCtx, ImportUserError, importErrorText } from './ctx';
import { asArray, cleanImportedName } from './formats';
import { pickBrowserFile } from '../utils/filePick';
import type { SpUserDoc, SpMemberDoc, SpSwitchDoc, SpGroupDoc, SpFieldDoc } from './formats';

export const handleImportSP = async (ctx: ImportCtx) => {
  const { setImporting, extSel, importMode, showStatus, onUpdate, system, t } = ctx;
  pickBrowserFile('.json,.txt', async file => {
    setImporting(true);
    try {
      ctx.control?.beginFromLabel(t('share.importing'));
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      if (!isSpExportFile(data)) throw new ImportUserError(t('share.notValidSPExport'));
      const spMembers = asArray<SpMemberDoc>(data.members).map(m => {
        if (m?.name) m.name = cleanImportedName(m.name);
        return m;
      });
      const spHistory = asArray<SpSwitchDoc>(data.frontHistory);
      const spUsers = asArray<SpUserDoc>(data.users);
      const spGroups = asArray<SpGroupDoc>(data.groups);
      const spCustomFields = asArray<SpFieldDoc>(data.customFields);
      const sysData: SpUserDoc = spUsers[0] || {};
      const batch: Record<string, unknown> = {};

      if (extSel.system) {
        const name = sysData.username || sysData.name || system.name;
        const desc = sysData.desc || sysData.description || system.description;
        batch[KEYS.system] = { ...system, name: name || system.name, description: desc };
      }

      const idMap = new Map<string, string>();
      let added = 0;
      let historyCount = 0;
      if (extSel.members && spMembers.length > 0) {
        const merged: Member[] = [...(await store.getStrict<Member[]>(KEYS.members, []) || [])];
        spMembers.forEach(m => {
          const incoming: Partial<Member> = {
            name: m.name || t('common.unknown'),
            pronouns: m.pronouns || '',
            role: '',
            color: normHex(m.color),
            description: m.desc || '',
            archived: !!m.archived,
          };
          const before = merged.length;
          if (m._id) mergeForeignMember(merged, idMap, m._id, incoming);
          else merged.push(blankMember({ customFields: [], createdAt: undefined, ...incoming }));
          if (merged.length > before) added++;
        });
        let membersNow = finalizeMemberReplace(merged, idMap, importMode);
        if (extSel.avatars) {
          const spFallbackUid = String(spMembers.find(x => x.uid)?.uid || '');
          const withUrls = new Set<string>();
          membersNow = membersNow.map(lm => {
            const spm = spMembers.find(sm => sm._id && idMap.get(sm._id) === lm.id);
            const url = spm ? spAvatarUrl(spm, spFallbackUid) : undefined;
            if (!url) return lm;
            withUrls.add(lm.id);
            return { ...lm, avatar: url };
          });
          if (withUrls.size > 0) {
            const inlined = await inlineRemoteAvatars(membersNow.filter(lm => withUrls.has(lm.id)));
            const byId = new Map(inlined.map(lm => [lm.id, lm]));
            membersNow = membersNow.map(lm => byId.get(lm.id) || lm);
          }
        }
        if (extSel.customFields && spCustomFields.length > 0) {
          const existingDefs = await store.getStrict<CustomFieldDef[]>(KEYS.customFieldDefs, []) || [];
          const fieldIdMap = new Map<string, string>();
          const newDefs: CustomFieldDef[] = [];
          spCustomFields.forEach((cf, i) => {
            const spIds = [cf.id, cf.uuid, cf._id].map(normId).filter(Boolean);
            const spName = cf.name || t('share.fieldN', {n: i + 1});
            const existing = existingDefs.find(d => importNameKey(d.name) === importNameKey(spName));
            const localId = existing?.id ?? uid();
            if (!existing) newDefs.push({id: localId, name: String(spName), type: spFieldType(cf.type), sortOrder: cf.order ?? i});
            spIds.forEach(k => fieldIdMap.set(k, localId));
          });
          if (newDefs.length > 0) batch[KEYS.customFieldDefs] = [...existingDefs, ...newDefs];
          membersNow = membersNow.map(lm => {
            const spMember = spMembers.find(sm => sm._id && idMap.get(sm._id) === lm.id);
            if (!spMember) return lm;
            const info = spMember.info;
            if (!info || typeof info !== 'object') return lm;
            let newCF: CustomFieldValue[] = lm.customFields || [];
            Object.entries(info).forEach(([spFieldId, rawValue]) => {
              const localFieldId = fieldIdMap.get(normId(spFieldId)) || fieldIdMap.get(spFieldId);
              const text = spFieldText(rawValue);
              if (localFieldId && text !== null) newCF = withFieldValue(newCF, localFieldId, text);
            });
            return {...lm, customFields: newCF};
          });
        }
        if (extSel.groups && spGroups.length > 0) {
          const existingGroups = await store.getStrict<MemberGroup[]>(KEYS.groups, []) || [];
          const newGroups: MemberGroup[] = [];
          const groupMemberMap = new Map<string, string[]>();
          spGroups.forEach(g => {
            const gName = g.name || t('memberGroups.group');
            const gColor = g.color || undefined;
            const externalId = g._id || g.id;
            const externalMembers: string[] = Array.isArray(g.members) ? g.members : [];
            if (!gName || !externalId) return;
            const existing = existingGroups.find(eg => importNameKey(eg.name) === importNameKey(gName))
              || newGroups.find(ng => importNameKey(ng.name) === importNameKey(gName));
            const localId = existing ? existing.id : uid();
            if (!existing) newGroups.push({id: localId, name: gName, color: gColor});
            groupMemberMap.set(localId, externalMembers);
          });
          if (newGroups.length > 0) batch[KEYS.groups] = [...existingGroups, ...newGroups];
          const memberLocalIdsByGroup = new Map<string, Set<string>>();
          for (const [localGroupId, externalMemberIds] of groupMemberMap) {
            memberLocalIdsByGroup.set(localGroupId, new Set(localIds(idMap, externalMemberIds)));
          }
          membersNow = membersNow.map(lm => {
            const additions: string[] = [];
            for (const [localGroupId, localMemberSet] of memberLocalIdsByGroup) {
              if (localMemberSet.has(lm.id) && !(lm.groupIds || []).includes(localGroupId)) additions.push(localGroupId);
            }
            if (additions.length === 0) return lm;
            return {...lm, groupIds: [...(lm.groupIds || []), ...additions]};
          });
        }
        batch[KEYS.members] = membersNow;
        if (extSel.frontHistory && spHistory.length > 0) {
          const newH = convertSPSwitches(spHistory.map(sh => ({ content: sh, ...sh })), idMap);
          historyCount = newH.length;
          if (newH.length > 0) {
            const existingHistory = await store.getStrict<HistoryEntry[]>(KEYS.history, []) || [];
            const mergedHistory = mergeHistoryEntries(newH, existingHistory);
            batch[KEYS.history] = mergedHistory;
            const open = findOpenFrontInHistory(mergedHistory);
            if (open) batch[KEYS.front] = open;
          }
        }
      }

      await store.setBatch(batch);
      showStatus(t('share.statusSpImported', {members: added, history: historyCount}));
      onUpdate();
    } catch (e) {
      showStatus(t('share.statusImportErrorSafe', {msg: importErrorText(e, t)}), true);
    } finally {
      setImporting(false);
    }
  });
};
