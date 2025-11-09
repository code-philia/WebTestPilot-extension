import React, { type ChangeEvent, useState } from "react";
import type { TestAction } from "../types";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { useLingui } from "@lingui/react/macro";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ActionListProps {
  actions: TestAction[];
  onActionChange?: (
    index: number,
    field: keyof TestAction,
    value: string
  ) => void;
  onRemoveAction?: (index: number) => void;
  onAddAction?: () => void;
  onActionsChange?: (actions: TestAction[]) => void;
  readonly?: boolean;
}

const SortableActionCard: React.FC<{
  action: TestAction;
  index: number;
  onActionChange: (
    index: number,
    field: keyof TestAction,
    value: string
  ) => void;
  onRemoveAction: (index: number) => void;
  readonly: boolean;
}> = ({ action, index, onActionChange, onRemoveAction, readonly }) => {
  const { t } = useLingui();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: index,
    transition: {
      duration: 150,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.8 : 1,
    scale: isDragging ? 1.02 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="action-card">
      <div className="action-row">
        {!readonly && (
          <span
            {...attributes}
            {...listeners}
            className="mr-2 text-gray-600 text-xs touch-none cursor-grab active:cursor-grabbing drag-handle"
          >
            ⋮⋮
          </span>
        )}
        {/* <span className="action-number">{index + 1}.</span> */}
        <input
          className="text-input"
          value={action.action}
          onChange={
            readonly
              ? undefined
              : (e: ChangeEvent<HTMLInputElement>) =>
                  onActionChange(index, "action", e.target.value)
          }
          placeholder={t`Action`}
          readOnly={readonly}
          aria-readonly={readonly}
        />
        {!readonly && (
          <button
            className="icon-button"
            onClick={() => onRemoveAction(index)}
            aria-label={`Remove action ${index + 1}`}
          >
            ×
          </button>
        )}
      </div>
      <div className="action-row">
        <span className="action-number">→</span>
        <input
          className="text-input"
          value={action.expectedResult}
          onChange={
            readonly
              ? undefined
              : (e: ChangeEvent<HTMLInputElement>) =>
                  onActionChange(index, "expectedResult", e.target.value)
          }
          placeholder={t`Expected result`}
          readOnly={readonly}
          aria-readonly={readonly}
        />
      </div>
    </div>
  );
};

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  onActionChange = () => {},
  onRemoveAction = () => {},
  onAddAction = () => {},
  onActionsChange = () => {},
  readonly = false,
}) => {
  const { t } = useLingui();
  const [showActions, setShowActions] = useState(true);
  const [localActions, setLocalActions] = useState(actions);

  // Update local state when props change
  React.useEffect(() => {
    setLocalActions(actions);
  }, [actions]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && over) {
      setLocalActions((items) => {
        const oldIndex = active.id as number;
        const newIndex = over.id as number;
        const newActions = arrayMove(items, oldIndex, newIndex);

        // Notify parent of the change
        onActionsChange(newActions);

        return newActions;
      });
    }
  };

  return (
    <section
      className={`editor-section actions-section ${readonly ? "readonly" : ""}`}
    >
      <div className="section-header">
        <h3>{readonly ? t`From fixture` : t`Actions`}</h3>
        {readonly ? (
          // Eye and close eye icons for toggling visibility
          <VSCodeButton onClick={() => setShowActions(!showActions)}>
            {showActions ? t`Hide` : t`Show`}
          </VSCodeButton>
        ) : (
          <VSCodeButton onClick={onAddAction}>{t`Add Action`}</VSCodeButton>
        )}
      </div>

      {showActions &&
        (actions.length === 0 ? (
          <div className="empty-state">
            {readonly
              ? t`No actions defined in fixtures.`
              : t`No actions defined. Click "Add Action" to get started.`}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[
              ({ transform }) => {
                // Limit horizontal movement to reduce jiggling
                return {
                  ...transform,
                  x: 0,
                };
              },
            ]}
          >
            <SortableContext
              items={localActions.map((_, index) => index)}
              strategy={verticalListSortingStrategy}
            >
              <div className="actions-list">
                {localActions.map((action, index) => (
                  <SortableActionCard
                    key={index}
                    action={action}
                    index={index}
                    onActionChange={onActionChange}
                    onRemoveAction={onRemoveAction}
                    readonly={readonly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ))}
    </section>
  );
};
