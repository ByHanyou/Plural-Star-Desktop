import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Member } from '../utils';
import { Block, Inline, Side, isImageUri, isSafeHref, limitBlocks, parseRichText } from '../markdown/parse';
import { activateOnKey } from './ui';
import { tint } from '../theme';

type MemberLookup = { get: (id: string) => Member | undefined };

interface Ctx {
  t: TFunction;
  members?: MemberLookup;
  onMentionPress?: (memberId: string) => void;
}

const SafeImg = ({ uri, alt = '', style, fallbackStyle }: { uri: string; alt?: string; style: React.CSSProperties; fallbackStyle?: React.CSSProperties }) => {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [uri]);
  if (failed) {
    return <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', ...fallbackStyle }}>{t('markdown.imageUnavailable')}</span>;
  }
  return <img src={uri} alt={alt} style={style} onError={() => setFailed(true)} />;
};

const Img = ({ uri, alt, w, h }: { uri: string; alt?: string; w?: number; h?: number }) => (
  <SafeImg uri={uri} alt={alt} style={{ display: 'block', width: w, height: h, maxWidth: 300, maxHeight: 300, borderRadius: 8, margin: '2px 0' }} />
);

const SideImg = ({ uri, w, h, alt }: { uri: string; w?: number; h?: number; alt?: string }) => (
  <SafeImg uri={uri} alt={alt} fallbackStyle={{ maxWidth: '45%' }}
    style={{ display: 'block', flexShrink: 0, width: w || 110, maxWidth: '45%', height: 'auto', aspectRatio: w && h ? `${w} / ${h}` : undefined, objectFit: 'contain', borderRadius: 8 }} />
);

const SideRow = ({ side, image, children }: { side: Side; image: React.ReactNode; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
    {side === 'left' ? image : null}
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    {side === 'right' ? image : null}
  </div>
);

const Spoiler = ({ raw, render }: { raw: string; render: () => React.ReactNode }) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  return (
    <span role="button" tabIndex={0} aria-expanded={open}
      aria-label={open ? undefined : t('markdown.spoiler')}
      onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); } }}
      style={open
        ? { background: tint('var(--dim)', 20), borderRadius: 3, padding: '0 2px', cursor: 'pointer' }
        : { background: 'var(--dim)', color: 'var(--dim)', borderRadius: 3, padding: '0 2px', cursor: 'pointer', userSelect: 'none' }}>
      {open ? render() : <span aria-hidden>{raw}</span>}
    </span>
  );
};

const brokenImage = (ctx: Ctx, key: string) =>
  <span key={key} style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{ctx.t('markdown.brokenImage')}</span>;

const renderInline = (nodes: Inline[], ctx: Ctx, prefix: string): React.ReactNode[] =>
  nodes.map((n, i) => {
    const key = `${prefix}${i}`;
    switch (n.kind) {
      case 'text': return n.text;
      case 'break': return <br key={key} />;
      case 'bold': return <strong key={key} style={{ color: 'var(--text)' }}>{renderInline(n.children, ctx, key)}</strong>;
      case 'italic': return <em key={key}>{renderInline(n.children, ctx, key)}</em>;
      case 'boldItalic': return <strong key={key} style={{ fontStyle: 'italic', color: 'var(--text)' }}>{renderInline(n.children, ctx, key)}</strong>;
      case 'underline': return <u key={key}>{renderInline(n.children, ctx, key)}</u>;
      case 'strike': return <s key={key}>{renderInline(n.children, ctx, key)}</s>;
      case 'code': return <code key={key} style={{ fontFamily: 'monospace', background: 'var(--surface)', padding: '0 4px', borderRadius: 3, fontSize: 12 }}>{n.text}</code>;
      case 'spoiler': return <Spoiler key={key} raw={n.raw} render={() => renderInline(n.children, ctx, key)} />;
      case 'mention': {
        const member = ctx.members?.get(n.memberId);
        const press = ctx.onMentionPress;
        const onClick = press && member ? () => press(n.memberId) : undefined;
        return (
          <span key={key} role={onClick ? 'link' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
            onKeyDown={onClick ? activateOnKey(onClick) : undefined}
            style={{ color: member?.color || 'var(--muted)', textDecoration: 'underline', cursor: onClick ? 'pointer' : undefined }}>
            @{member?.name || n.name}
          </span>
        );
      }
      case 'link': {
        const href = n.href.trim();
        if (!isSafeHref(href)) return <span key={key}>{renderInline(n.children, ctx, key)}</span>;
        return <a key={key} href={href} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--info)', textDecoration: 'underline' }}>{renderInline(n.children, ctx, key)}</a>;
      }
      case 'image': {
        const { url, alt, width, height } = n.image;
        if (!isImageUri(url)) return brokenImage(ctx, key);
        return <Img key={key} uri={url} alt={alt} w={width} h={height} />;
      }
    }
  });

const baseLine: React.CSSProperties = { fontSize: 13, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word', margin: 0 };

const HEADING_SIZE: Record<1 | 2 | 3, number> = { 1: 18, 2: 16, 3: 14 };

const renderBlock = (b: Block, ctx: Ctx, key: string): React.ReactNode => {
  switch (b.kind) {
    case 'heading':
      return <p key={key} role="heading" aria-level={b.level} style={{ ...baseLine, fontSize: HEADING_SIZE[b.level], fontWeight: 700, marginBottom: 4 }}>{renderInline(b.children, ctx, key)}</p>;
    case 'quote':
      return <div key={key} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10, margin: '2px 0' }}><p style={{ ...baseLine, color: 'var(--dim)', fontStyle: 'italic' }}>{renderInline(b.children, ctx, key)}</p></div>;
    case 'rule': return <hr key={key} style={{ border: 'none', height: 1, background: 'var(--border)', margin: '8px 0' }} />;
    case 'blank': return <div key={key} style={{ height: 8 }} />;
    case 'code':
      return <pre key={key} style={{ ...baseLine, fontFamily: 'monospace', fontSize: 12, color: 'var(--dim)', background: 'var(--surface)', padding: 10, borderRadius: 8, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{b.text}</pre>;
    case 'list':
      return (
        <div key={key} style={{ margin: '2px 0' }}>
          {b.items.map((item, j) => (
            <div key={`${key}-${j}`} style={{ display: 'flex', gap: 6, margin: '1px 0', paddingLeft: item.depth * 14 }}>
              {item.ordered
                ? <span style={{ ...baseLine, color: 'var(--dim)', width: 16, textAlign: 'right', flexShrink: 0 }}>{item.n}.</span>
                : <span aria-hidden style={{ ...baseLine, color: 'var(--dim)' }}>•</span>}
              <p style={{ ...baseLine, flex: 1 }}>{renderInline(item.children, ctx, `${key}-${j}`)}</p>
            </div>
          ))}
        </div>
      );
    case 'image': {
      const { url, alt, side } = b.image;
      if (!isImageUri(url)) return brokenImage(ctx, key);
      return <div key={key} style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}><Img uri={url} alt={alt} /></div>;
    }
    case 'aside':
      return (
        <SideRow key={key} side={b.image.side || 'left'} image={<SideImg uri={b.image.url} w={b.image.width} h={b.image.height} alt={b.image.alt} />}>
          {b.children.map((c, j) => renderBlock(c, ctx, `${key}-${j}`))}
        </SideRow>
      );
    case 'paragraph':
      return <p key={key} style={baseLine}>{renderInline(b.children, ctx, key)}</p>;
  }
};

const lazyMemberLookup = (members: Member[]): MemberLookup => {
  let map: Map<string, Member> | undefined;
  const build = () => {
    const next = new Map<string, Member>();
    for (const m of members) if (!next.has(m.id)) next.set(m.id, m);
    return next;
  };
  return { get: id => (map || (map = build())).get(id) };
};

export const MarkdownText = React.memo(function MarkdownText({ text, numberOfLines, members, memberById, onMentionPress }: {
  text: string;
  numberOfLines?: number;
  members?: Member[];
  memberById?: MemberLookup;
  onMentionPress?: (memberId: string) => void;
}) {
  const { t } = useTranslation();
  const lookup = React.useMemo(
    () => memberById || (members ? lazyMemberLookup(members) : undefined),
    [memberById, members],
  );
  const blocks = React.useMemo(() => limitBlocks(parseRichText(text), numberOfLines), [text, numberOfLines]);
  if (blocks.length === 0) return null;
  const ctx: Ctx = { t, members: lookup, onMentionPress };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>{blocks.map((b, i) => renderBlock(b, ctx, `b${i}`))}</div>;
});
