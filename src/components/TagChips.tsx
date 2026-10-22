const tagChip = { fontSize: 10, color: 'var(--info)', background: 'var(--info-bg)', padding: '1px 6px', borderRadius: 999 } as const;

export function TagChips({ tags }: { tags: string[] }) {
  return <>{tags.map(tag => <span key={tag} style={tagChip}>{tag}</span>)}</>;
}
