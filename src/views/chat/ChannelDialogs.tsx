import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatChannel, ChatCategory, sortChatCategories } from '../../utils';
import { useAppStore } from '../../store/appStore';
import { Btn, Field, Modal, ConfirmDialog, AlertDialog, Dropdown, SaveErrorDialog } from '../../components/ui';
import { SaveRun, useSaveGuard } from '../../hooks/useSaveGuard';
import { knownCategoryId, createChannel, updateChannel, deleteChannel, createCategory, updateCategory, deleteCategory } from './channels';

export type ChannelDialog =
  | { kind: 'newChannel' }
  | { kind: 'editChannel'; channel: ChatChannel }
  | { kind: 'deleteChannel'; channel: ChatChannel }
  | { kind: 'channelLimit' }
  | { kind: 'newCategory' }
  | { kind: 'editCategory'; category: ChatCategory }
  | { kind: 'deleteCategory'; category: ChatCategory };

const NO_CATEGORY = '__none__';

function NameDialog({ title, label, initial = '', placeholder, action, onSave, onClose }: {
  title: string; label: string; initial?: string; placeholder?: string; action: string; onSave: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const save = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };
  return (
    <Modal open title={title} onClose={onClose} footer={<Btn onClick={save}>{action}</Btn>}>
      <Field label={label} value={name} onChange={setName} placeholder={placeholder} />
    </Modal>
  );
}

function EditChannelDialog({ channel, run, onDelete, onClose }: { channel: ChatChannel; run: SaveRun; onDelete: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const categories = useAppStore(s => s.chatCategories);
  const [name, setName] = useState(channel.name);
  const [categoryId, setCategoryId] = useState<string>(knownCategoryId(categories, channel.categoryId) ?? NO_CATEGORY);
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await run(() => updateChannel(channel.id, trimmed, categoryId === NO_CATEGORY ? null : categoryId))) onClose();
  };
  return (
    <Modal open title={t('chat.channelName')} onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
          <Btn variant="danger" onClick={onDelete}>{t('common.delete')}</Btn>
          <Btn onClick={() => void save()}>{t('common.save')}</Btn>
        </div>
      }>
      <Field label={t('chat.channelName')} value={name} onChange={setName} />
      <Dropdown label={t('chat.moveToCategory')} value={categoryId} options={[NO_CATEGORY, ...sortChatCategories(categories).map(c => c.id)]}
        onChange={setCategoryId} renderOption={v => v === NO_CATEGORY ? t('chat.uncategorized') : (categories.find(c => c.id === v)?.name || v)} />
    </Modal>
  );
}

function DialogBody({ dialog, run, onChange, onCreated }: {
  dialog: ChannelDialog; run: SaveRun; onChange: (next: ChannelDialog | null) => void; onCreated: (channel: ChatChannel) => void;
}) {
  const { t } = useTranslation();
  const close = () => onChange(null);
  const closeAfter = async (op: () => Promise<unknown>) => { if (await run(op)) close(); };
  switch (dialog.kind) {
    case 'newChannel':
      return (
        <NameDialog title={t('chat.newChannel')} label={t('chat.channelName')} placeholder={t('common.channelNameExample')} action={t('common.add')} onClose={close}
          onSave={name => void run(async () => {
            const channel = await createChannel(name);
            if (!channel) { onChange({ kind: 'channelLimit' }); return; }
            close();
            onCreated(channel);
          })} />
      );
    case 'editChannel':
      return <EditChannelDialog channel={dialog.channel} run={run} onClose={close} onDelete={() => onChange({ kind: 'deleteChannel', channel: dialog.channel })} />;
    case 'deleteChannel':
      return (
        <ConfirmDialog open title={t('chat.deleteChannel')} message={t('chat.deleteChannelMsg')} danger onCancel={close}
          onConfirm={() => void closeAfter(() => deleteChannel(dialog.channel.id))} />
      );
    case 'channelLimit':
      return <AlertDialog open title={t('chat.channelLimit')} message={t('chat.channelLimitMsg')} onClose={close} />;
    case 'newCategory':
      return (
        <NameDialog title={t('chat.newCategory')} label={t('chat.categoryName')} action={t('common.add')} onClose={close}
          onSave={name => void closeAfter(() => createCategory(name))} />
      );
    case 'editCategory':
      return (
        <NameDialog title={t('chat.categoryName')} label={t('chat.categoryName')} initial={dialog.category.name} action={t('common.save')} onClose={close}
          onSave={name => void closeAfter(() => updateCategory(dialog.category.id, { name }))} />
      );
    case 'deleteCategory':
      return (
        <ConfirmDialog open title={t('chat.deleteCategory')} message={t('chat.deleteCategoryMsg')} danger onCancel={close}
          onConfirm={() => void closeAfter(() => deleteCategory(dialog.category.id))} />
      );
  }
}

export function ChannelDialogs({ dialog, onChange, onCreated }: {
  dialog: ChannelDialog | null; onChange: (next: ChannelDialog | null) => void; onCreated: (channel: ChatChannel) => void;
}) {
  const [saveError, run, clearSaveError] = useSaveGuard();
  return (
    <>
      {dialog && <DialogBody dialog={dialog} run={run} onChange={onChange} onCreated={onCreated} />}
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </>
  );
}
