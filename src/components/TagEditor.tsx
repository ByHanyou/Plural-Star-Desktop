import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tagFromInput, tagKey, tagSuggestions, withTag } from '../utils';
import { AddRow, ChipList } from './ui';

export function TagEditor({ tags, onChange, placeholder, suggestFrom, input: heldInput, onInput }: {
  tags: string[]; onChange: (tags: string[]) => void; placeholder: string; suggestFrom?: string[]; input?: string; onInput?: (input: string) => void;
}) {
  const { t } = useTranslation();
  const [ownInput, setOwnInput] = useState('');
  const input = heldInput ?? ownInput;
  const setInput = onInput ?? setOwnInput;
  const suggestions = useMemo(() => (suggestFrom ? tagSuggestions(suggestFrom, tags, input) : []), [suggestFrom, tags, input]);
  const add = () => {
    onChange(withTag(tags, tagFromInput(input)));
    setInput('');
  };
  const apply = (tag: string) => {
    onChange(withTag(tags, tag));
    setInput('');
  };
  return (
    <>
      <ChipList items={tags} onRemove={tag => onChange(tags.filter(x => x !== tag))} />
      <AddRow value={input} onChange={setInput} onAdd={add} placeholder={placeholder} />
      {suggestions.length > 0 && (
        <div role="group" aria-label={t('members.allTags')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 10 }}>
          {suggestions.map(tag => (
            <button key={tagKey(tag)} type="button" className="chip" aria-label={t('common.addNamed', { name: tag })} onClick={() => apply(tag)}
              style={{ borderStyle: 'dashed', background: 'var(--surface)', color: 'var(--dim)', borderColor: 'var(--border)' }}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
