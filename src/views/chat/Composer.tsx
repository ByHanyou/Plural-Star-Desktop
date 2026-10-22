import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Member } from '../../utils';
import { Btn, Interp, linkButton, slots } from '../../components/ui';

const FORMAT_TOOLS: { before: string; after: string; nameKey: string; labelKey?: string; label?: string; style?: CSSProperties }[] = [
  { before: '**', after: '**', nameKey: 'markdown.toolBold', labelKey: 'markdown.toolBoldShort', style: { fontWeight: 700 } },
  { before: '*', after: '*', nameKey: 'markdown.toolItalic', labelKey: 'markdown.toolItalicShort', style: { fontStyle: 'italic' } },
  { before: '~~', after: '~~', nameKey: 'markdown.toolStrike', labelKey: 'markdown.toolStrikeShort', style: { textDecoration: 'line-through' } },
  { before: '`', after: '`', nameKey: 'markdown.toolCode', label: '<>', style: { fontFamily: 'monospace' } },
  { before: '> ', after: '', nameKey: 'markdown.toolQuote', label: '❝' },
  { before: '- ', after: '', nameKey: 'markdown.toolBullets', label: '•' },
  { before: '# ', after: '', nameKey: 'markdown.toolH1', labelKey: 'markdown.toolH1Short' },
];

const TOOL_BTN: CSSProperties = {
  padding: '2px 8px', fontSize: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--dim)', cursor: 'pointer',
  fontWeight: 400, fontStyle: 'normal', textDecoration: 'none', fontFamily: 'inherit',
};

const CANCEL_BTN = linkButton('var(--danger)');

export function Composer({ channelName, input, setInput, replyAuthor, replying, editing, canAttach, onCancelReply, onCancelEdit, onSubmit, onAttach, onPasteImage }: {
  channelName: string;
  input: string;
  setInput: (update: (prev: string) => string) => void;
  replyAuthor?: Member;
  replying: boolean;
  editing: boolean;
  canAttach: boolean;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSubmit: () => void;
  onAttach: () => void;
  onPasteImage: (file: File) => void;
}) {
  const { t } = useTranslation();
  const placeholder = editing ? t('chat.editPlaceholder') : t('chat.messagePlaceholder', { name: channelName });
  return (
    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
      {replying && !editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--muted)' }}>
          <span><Interp text={t('chat.replyingToName', slots('name'))} nodes={{ name: <strong style={{ color: replyAuthor?.color }}>{replyAuthor?.name}</strong> }} /></span>
          <button aria-label={t('chat.cancelReply')} style={CANCEL_BTN} onClick={onCancelReply}>✕</button>
        </div>
      )}
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
          <span role="status" style={{ color: 'var(--accent)', fontWeight: 500 }}><span aria-hidden>✎</span> {t('chat.editingHeader')}</span>
          <button aria-label={t('chat.cancelEdit')} style={CANCEL_BTN} onClick={onCancelEdit}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {FORMAT_TOOLS.map(tool => (
          <button key={tool.nameKey} aria-label={t(tool.nameKey)} title={t(tool.nameKey)} style={{ ...TOOL_BTN, ...tool.style }}
            onClick={() => setInput(prev => prev + tool.before + (tool.after ? t('editor.textPlaceholder') : '') + tool.after)}>
            {tool.labelKey ? t(tool.labelKey) : tool.label}
          </button>
        ))}
        <button aria-label={t('chat.attachFile')} style={{ ...TOOL_BTN, marginLeft: 'auto' }} onClick={onAttach}>📷</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea className="field__input" value={input} onChange={e => setInput(() => e.target.value)}
          aria-label={placeholder} placeholder={placeholder}
          style={{ flex: 1, minHeight: 36, maxHeight: 120, resize: 'vertical', fontSize: 13 }}
          onPaste={e => {
            if (!canAttach) return;
            const file = Array.from(e.clipboardData?.items || []).find(x => x.type.startsWith('image/'))?.getAsFile();
            if (!file) return;
            e.preventDefault();
            onPasteImage(file);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
            if (e.key === 'Escape' && editing) { e.preventDefault(); onCancelEdit(); }
          }} />
        <Btn variant="solid" onClick={onSubmit}>{editing ? t('common.save') : t('chat.send')}</Btn>
      </div>
    </div>
  );
}
