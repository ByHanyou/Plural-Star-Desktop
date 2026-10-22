import React from 'react';
import { useTranslation } from 'react-i18next';
import { PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';

interface Props {
  id: string;
  label: string;
  disabled?: boolean;
  tile?: boolean;
  children: React.ReactNode;
}

export default function SortableCard({ id, label, disabled = false, tile = false, children }: Props) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const gripLabel = t('common.dragReorderNamed', { name: label });

  return (
    <div ref={setNodeRef} style={style} className="tile-sortable" data-tile-id={tile ? id : undefined}>
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

export const useSortSensors = (distance = 4) => useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

export function ReorderLockButton({ locked, onToggle, fontSize, padding }: { locked: boolean; onToggle: () => void; fontSize: number; padding: number }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="switch" aria-checked={!locked} aria-label={t('common.reorderLock')} title={t('common.reorderLock')}
      onClick={onToggle}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding, fontSize, lineHeight: 1, opacity: locked ? 0.35 : 1 }}>🤏</button>
  );
}
