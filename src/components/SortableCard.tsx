import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';

interface Props {
  id: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}

// Wraps a list card so it can be reordered. Same contract as SortableTile: the card
// itself stays clickable, dragging and keyboard-sorting live on the grip only, so the
// two never fight over Space or the tab order. The grip is a real focusable button —
// screen-reader users reorder with it, we never hide it.
export default function SortableCard({ id, label, disabled = false, children }: Props) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const gripLabel = `${t('common.dragReorder', { defaultValue: 'Drag to reorder' })} — ${label}`;

  return (
    <div ref={setNodeRef} style={style} className="tile-sortable">
      {children}
      {!disabled && (
        <button
          type="button"
          className="tile__grip"
          aria-label={gripLabel}
          title={gripLabel}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
    </div>
  );
}
