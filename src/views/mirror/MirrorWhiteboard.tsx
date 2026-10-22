import { useTranslation } from 'react-i18next';
import type { WhiteboardStroke } from '../../utils';
import { strokeAttrs, strokesViewBox, viewBoxAttr } from '../../whiteboard/geometry';
import { Nothing } from './shared';

export function MirrorWhiteboard({ strokes }: { strokes: WhiteboardStroke[] }) {
  const { t } = useTranslation();
  if (strokes.length === 0) return <Nothing />;
  return (
    <div role="img" aria-label={t('whiteboard.title')}
      style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <svg width="100%" viewBox={viewBoxAttr(strokesViewBox(strokes))} style={{ display: 'block', maxHeight: '60vh' }}>
        {strokes.map(s => <path key={s.id} {...strokeAttrs(s)} />)}
      </svg>
    </div>
  );
}
