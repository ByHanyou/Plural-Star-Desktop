import React from 'react';
import i18n from '../i18n/i18n';
import type { Member } from '../utils';

const MENTION_RE = /@\[([^\]]+)\]\(member:([a-zA-Z0-9_-]+)\)/;
const IMAGE_URL_RE = /https?:\/\/\S+\.(?:gif|png|pnj|jpe?g|webp|bmp|svg)(?:[?#]\S*)?/i;
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/;

type Side = 'left' | 'right';
const SIDE_ALT = 'ps-side:';
const imgTagSide = (tag: string): Side | null => {
  const m = tag.match(/\salign\s*=\s*["']?\s*(left|right)\b/i);
  if (!m) return null;
  return m[1].toLowerCase() === 'right' ? 'right' : 'left';
};
const altSide = (alt: string): Side | null => (alt === `${SIDE_ALT}left` ? 'left' : alt === `${SIDE_ALT}right` ? 'right' : null);
const lineHasImage = (line: string): boolean => MD_IMAGE_RE.test(line) || IMAGE_URL_RE.test(line);
const parseImageRef = (raw: string): { url: string; w?: number; h?: number } => {
  const s = raw.trim();
  const hint = s.match(/#(\d+)x(\d+)$/);
  const w = hint ? Number(hint[1]) : 0;
  const h = hint ? Number(hint[2]) : 0;
  return { url: s.replace(/[)]+$/, '').replace(/#\d+x\d+$/, '').trim(), w: w > 0 ? w : undefined, h: h > 0 ? h : undefined };
};

const isValidImageUri = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) || /^file:\/\//i.test(s) || s.startsWith('data:image/');
};

const Img = ({ uri }: { uri: string }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [uri]);
  if (failed) {
    return <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{i18n.t('markdown.imageUnavailable', { defaultValue: '[image unavailable]' })}</span>;
  }
  return <img src={uri} alt="" style={{ display: 'block', maxWidth: 300, maxHeight: 300, borderRadius: 8, margin: '2px 0' }} onError={() => setFailed(true)} />;
};

const SideImg = ({ uri, w, h }: { uri: string; w?: number; h?: number }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [uri]);
  if (failed) {
    return <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', maxWidth: '45%' }}>{i18n.t('markdown.imageUnavailable', { defaultValue: '[image unavailable]' })}</span>;
  }
  return <img src={uri} alt="" style={{ display: 'block', flexShrink: 0, width: w || 110, maxWidth: '45%', height: 'auto', aspectRatio: w && h ? `${w} / ${h}` : undefined, objectFit: 'contain', borderRadius: 8 }} onError={() => setFailed(true)} />;
};

const SideRow = ({ side, image, children }: { side: Side; image: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
    {side === 'left' ? image : null}
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    {side === 'right' ? image : null}
  </div>
);

const SPOILER_RE = /\|\|(.+?)\|\|/;
const Spoiler = ({ raw, render }: { raw: string; render: () => React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <span role="button" tabIndex={0} aria-expanded={open}
      aria-label={open ? undefined : i18n.t('markdown.spoiler')}
      onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); } }}
      style={open
        ? { background: 'color-mix(in srgb, var(--dim) 20%, transparent)', borderRadius: 3, padding: '0 2px', cursor: 'pointer' }
        : { background: 'var(--dim)', color: 'var(--dim)', borderRadius: 3, padding: '0 2px', cursor: 'pointer', userSelect: 'none' }}>
      {open ? render() : <span aria-hidden>{raw}</span>}
    </span>
  );
};
const spoilerKey = (i: number, raw: string) => `sp-${i}-${raw.length}-${raw.slice(0, 24)}`;

const renderInline = (text: string, members?: Member[]): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const patterns: [RegExp, (m: RegExpMatchArray) => React.ReactNode][] = [
    [SPOILER_RE, m => { const raw = m[1]; return <Spoiler key={spoilerKey(key++, raw)} raw={raw} render={() => renderInline(raw, members)} />; }],
    [new RegExp(MENTION_RE.source), m => {
      const member = members?.find(mb => mb.id === m[2]);
      const displayName = member?.name || m[1];
      return <span key={key++} style={{ color: member?.color || 'var(--muted)', textDecoration: 'underline' }}>@{displayName}</span>;
    }],
    [/\*\*\*(.+?)\*\*\*/, m => <strong key={key++} style={{ fontStyle: 'italic', color: 'var(--text)' }}>{m[1]}</strong>],
    [/\*\*(.+?)\*\*/, m => <strong key={key++} style={{ color: 'var(--text)' }}>{m[1]}</strong>],
    [/\*(.+?)\*/, m => <em key={key++}>{m[1]}</em>],
    [/~~(.+?)~~/, m => <s key={key++}>{m[1]}</s>],
    [/`(.+?)`/, m => <code key={key++} style={{ fontFamily: 'monospace', background: 'var(--surface)', padding: '0 4px', borderRadius: 3, fontSize: 12 }}>{m[1]}</code>],
    [new RegExp(MD_IMAGE_RE.source), m => {
      const url = m[2].replace(/[)]+$/, '').replace(/#\d+x\d+$/, '').trim();
      if (!isValidImageUri(url)) return <span key={key++} style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{i18n.t('markdown.brokenImage', { defaultValue: '[broken image]' })}</span>;
      return <Img key={key++} uri={url} />;
    }],
    [/\[(.+?)\]\((.+?)\)/, m => {
      const href = m[2].trim();
      if (!/^(https?:\/\/|mailto:)/i.test(href)) return <span key={key++}>{m[1]}</span>;
      return <a key={key++} href={href} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--info)', textDecoration: 'underline' }}>{m[1]}</a>;
    }],
  ];
  while (remaining.length > 0) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;
    for (const [re, fn] of patterns) {
      const m = remaining.match(re);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.idx) earliest = { idx: m.index, len: m[0].length, node: fn(m) };
      }
    }
    if (!earliest) { parts.push(remaining); break; }
    if (earliest.idx > 0) parts.push(remaining.slice(0, earliest.idx));
    parts.push(earliest.node);
    remaining = remaining.slice(earliest.idx + earliest.len);
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
};

const baseLine: React.CSSProperties = { fontSize: 13, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word', margin: 0 };

const renderLine = (line: string, i: React.Key, members?: Member[]): React.ReactNode => {
  if (line.startsWith('### ')) return <p key={i} style={{ ...baseLine, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{renderInline(line.slice(4), members)}</p>;
  if (line.startsWith('## ')) return <p key={i} style={{ ...baseLine, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{renderInline(line.slice(3), members)}</p>;
  if (line.startsWith('# ')) return <p key={i} style={{ ...baseLine, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{renderInline(line.slice(2), members)}</p>;
  if (line.startsWith('> ')) return <div key={i} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10, margin: '2px 0' }}><p style={{ ...baseLine, color: 'var(--dim)', fontStyle: 'italic' }}>{renderInline(line.slice(2), members)}</p></div>;
  if (line.startsWith('---') || line.startsWith('***')) return <hr key={i} style={{ border: 'none', height: 1, background: 'var(--border)', margin: '8px 0' }} />;
  if (line.match(/^[-*] /)) return <div key={i} style={{ display: 'flex', gap: 6, margin: '1px 0' }}><span aria-hidden style={{ ...baseLine, color: 'var(--dim)' }}>•</span><p style={{ ...baseLine, flex: 1 }}>{renderInline(line.slice(2), members)}</p></div>;
  if (line.match(/^\d+\. /)) { const m = line.match(/^(\d+)\. (.*)$/); return <div key={i} style={{ display: 'flex', gap: 6, margin: '1px 0' }}><span style={{ ...baseLine, color: 'var(--dim)', width: 16, textAlign: 'right', flexShrink: 0 }}>{m?.[1]}.</span><p style={{ ...baseLine, flex: 1 }}>{renderInline(m?.[2] || '', members)}</p></div>; }
  if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
  return <p key={i} style={baseLine}>{renderInline(line, members)}</p>;
};

export const MarkdownText = ({ text, members }: { text: string; members?: Member[] }) => {
  if (!text) return null;
  const mdText = text
    .replace(/<img\s[^>]*>/gi, tag => {
      const src = (tag.match(/src=["']([^"']+)["']/) || [])[1] || '';
      if (!src) return '';
      const w = (tag.match(/width=["']?(\d+)/) || [])[1];
      const h = (tag.match(/height=["']?(\d+)/) || [])[1];
      const side = imgTagSide(tag);
      return `![${side ? SIDE_ALT + side : ''}](${src}${w ? `#${w}x${h || 0}` : ''})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  const lineSeparators = new RegExp('\\r\\n?|' + String.fromCharCode(0x2028) + '|' + String.fromCharCode(0x2029), 'g');
  const lines = mdText.replace(lineSeparators, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const md = line.match(MD_IMAGE_RE);
    if (md && md.index !== undefined) {
      const before = line.slice(0, md.index).trim();
      const after = line.slice(md.index + md[0].length).trim();
      const side = altSide(md[1]);
      const { url, w, h } = parseImageRef(md[2]);
      if (isValidImageUri(url) && (side || before || after)) {
        const start = i;
        const beside = [before, after].filter(Boolean);
        if (side) {
          while (i + 1 < lines.length && lines[i + 1].trim() && !lineHasImage(lines[i + 1])) beside.push(lines[++i]);
        }
        if (beside.length > 0) {
          elements.push(
            <SideRow key={`s${start}`} side={side || 'left'} image={<SideImg uri={url} w={w} h={h} />}>
              {beside.map((b, j) => renderLine(b, `s${start}-${j}`, members))}
            </SideRow>,
          );
        } else {
          elements.push(<div key={`m${i}`} style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}><Img uri={url} /></div>);
        }
        continue;
      }
    }
    const urlMatch = line.match(IMAGE_URL_RE);
    if (urlMatch && !md && isValidImageUri(urlMatch[0])) {
      const before = line.slice(0, line.indexOf(urlMatch[0])).trim();
      const after = line.slice(line.indexOf(urlMatch[0]) + urlMatch[0].length).trim();
      if (before) elements.push(renderLine(before, `b${i}`, members));
      elements.push(<Img key={`m${i}`} uri={urlMatch[0]} />);
      if (after) elements.push(renderLine(after, `a${i}`, members));
    } else {
      elements.push(renderLine(line, `l${i}`, members));
    }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>{elements}</div>;
};
