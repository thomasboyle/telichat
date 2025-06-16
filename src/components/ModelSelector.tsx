import React, { useState } from 'react';
import './ModelSelector.css';
import { DndContext, closestCenter, DragOverlay, DragStartEvent, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Model {
  id: string;
  name: string;
}

interface ModelSelectorProps {
  models: Model[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

const ModelIcon: React.FC<{ model: Model; selected: boolean; isDragging?: boolean; }> = ({ model, selected, isDragging }) => {
  return (
    <div
      className={`model-icon ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      title={model.name}
    >
      {model.name}
    </div>
  );
};

const SortableModelIcon: React.FC<{ model: Model; selected: boolean; onClick: () => void; }> = ({ model, selected, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: model.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={!isDragging ? onClick : undefined}
      className="sortable-model-icon"
    >
      <ModelIcon model={model} selected={selected} />
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedIndex, setSelectedIndex, onDragEnd }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    onDragEnd(event);
  };

  const activeModel = models.find(m => m.id === activeId);

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="model-selector-container">
        <SortableContext items={models.map(m => m.id)} strategy={horizontalListSortingStrategy}>
          <div className="model-selector">
            {models.map((model, index) => (
              <SortableModelIcon
                key={model.id}
                model={model}
                selected={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
      <DragOverlay>
        {activeId && activeModel ? (
          <ModelIcon 
            model={activeModel} 
            selected={models.findIndex(m => m.id === activeId) === selectedIndex}
            isDragging={true} 
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ModelSelector; 