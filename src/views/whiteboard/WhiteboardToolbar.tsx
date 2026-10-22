import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toggleChipStyle } from '../../components/ui';
import { ColorCarousel } from '../../components/ColorCarousel';
import { fmtNum } from '../../utils';
import { Tool, WIDTHS } from '../../whiteboard/geometry';

const ROUND_CHIP: React.CSSProperties = { background: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, minWidth: 30, borderRadius: 15, padding: 0 };
const separator = <span style={{ width: 1, height: 22, background: 'var(--border)' }} aria-hidden />;

export function WhiteboardToolbar({ tool, onTool, width, onWidth, color, onColor, canUndo, onUndo, onZoomIn, onZoomOut, onClear }: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  width: number;
  onWidth: (width: number) => void;
  color: string;
  onColor: (color: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const toolBtn = (id: Tool, glyph: string, label: string) => (
    <button key={id} className="chip" aria-pressed={tool === id} aria-label={label} title={label}
      style={{ ...toggleChipStyle(tool === id), fontSize: 14 }}
      onClick={() => onTool(id)}>
      {glyph}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      {toolBtn('draw', '✎', t('whiteboard.draw'))}
      {toolBtn('move', '✥', t('whiteboard.move'))}
      {toolBtn('erase', '⌫', t('whiteboard.erase'))}
      {separator}
      {toolBtn('line', '╱', t('whiteboard.shapeLine'))}
      {toolBtn('rect', '▭', t('whiteboard.shapeRect'))}
      {toolBtn('ellipse', '◯', t('whiteboard.shapeEllipse'))}
      {toolBtn('poly', '⬠', t('whiteboard.shapePoly'))}
      {separator}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center', flexShrink: 1 }}>
        {WIDTHS.map(wd => (
          <button key={wd} className="chip" aria-pressed={width === wd} aria-label={t('whiteboard.brushSizeN', { size: fmtNum(wd, 0) })} title={t('whiteboard.brushSizeN', { size: fmtNum(wd, 0) })}
            style={{ ...ROUND_CHIP, borderColor: width === wd ? 'var(--accent)' : 'var(--border)' }}
            onClick={() => onWidth(wd)}>
            <span aria-hidden style={{ width: wd + 4, height: wd + 4, borderRadius: '50%', background: color, display: 'inline-block' }} />
          </button>
        ))}
        <button className="chip" aria-pressed={tool === 'bucket'} aria-label={t('whiteboard.bucket')} title={t('whiteboard.bucket')}
          style={{ ...ROUND_CHIP, borderColor: tool === 'bucket' ? 'var(--accent)' : 'var(--border)', background: tool === 'bucket' ? 'var(--accent-bg)' : 'var(--surface)' }}
          onClick={() => onTool('bucket')}>🪣</button>
      </div>
      {separator}
      <div style={{ flex: 1, minWidth: 0 }}>
        <ColorCarousel value={color} onChange={onColor} size={22} />
      </div>
      <button className="btn btn--ghost" aria-label={t('whiteboard.undo')} title={t('whiteboard.undo')} onClick={onUndo} disabled={!canUndo}>↩</button>
      <button className="btn btn--ghost" aria-label={t('systemMap.zoomIn')} title={t('systemMap.zoomIn')} onClick={onZoomIn}>＋</button>
      <button className="btn btn--ghost" aria-label={t('systemMap.zoomOut')} title={t('systemMap.zoomOut')} onClick={onZoomOut}>－</button>
      <button className="btn btn--danger" aria-label={t('whiteboard.clear')} onClick={onClear}>🗑</button>
    </div>
  );
}
