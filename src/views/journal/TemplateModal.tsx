import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JournalTemplate } from '../../utils';
import { EditFooter, Field, Section, Modal, ConfirmDialog } from '../../components/ui';
import { TagEditor } from '../../components/TagEditor';

export function TemplateModal({ template, isNew, onClose, onSave, onDelete }: {
  template: JournalTemplate;
  isNew: boolean;
  onClose: () => void;
  onSave: (template: JournalTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(template.name);
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [tags, setTags] = useState<string[]>(template.hashtags || []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (name.trim()) onSave({ ...template, name: name.trim(), title, body, hashtags: tags });
  };

  return (
    <>
      <Modal open title={isNew ? t('journal.newTemplate') : t('journal.editTemplate')} onClose={onClose}
        footer={<EditFooter onDelete={isNew ? undefined : () => setConfirmDelete(true)} onCancel={onClose} onSave={save} saveDisabled={!name.trim()} />}>
        <Field label={t('journal.templateName')} value={name} onChange={setName} placeholder={t('journal.templateNamePlaceholder')} />
        <Field label={t('journal.templateTitle')} value={title} onChange={setTitle} placeholder={t('modal.entryTitlePlaceholder')} />
        <Field label={t('journal.templateBody')} value={body} onChange={setBody} placeholder={t('modal.writeHere')} multiline pictureTools />
        <Section label={t('modal.tags')} />
        <TagEditor tags={tags} onChange={setTags} placeholder={t('modal.topic')} />
      </Modal>
      <ConfirmDialog open={confirmDelete} title={t('common.delete')} message={t('journal.areYouSure')}
        danger onConfirm={() => { setConfirmDelete(false); onDelete(template.id); }} onCancel={() => setConfirmDelete(false)} />
    </>
  );
}
