import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';

interface Props {
  id: string;
  children: React.ReactNode;
}

export default function SortableTile({ id, children }: Props) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const label = t('common.dragReorder', { defaultValue: 'Drag to reorder' });

  return (
    <div ref={setNodeRef} style={style} className="tile-sortable">
      {children}
      <button
        type="button"
        className="tile__grip"
        aria-label={label}
        title={label}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
    </div>
  );
}
