import {
  createSelectionKeyboardShortcuts,
  useKeyboardShortcuts,
  useSelectionController,
} from "@jsenv/navi";
import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { ExplorerItem, ExplorerNewItem } from "./explorer_item.jsx";

export const ExplorerItemList = forwardRef((props, ref) => {
  const {
    idKey,
    nameKey,
    itemArray,
    renderItem,
    useItemArrayInStore,
    useRenameItemAction,
    useDeleteManyItemAction,
    useDeleteItemAction,
    isCreatingNew,
    useCreateItemAction,
    stopCreatingNew,
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const itemSelectionSignal = useSignal([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const deleteManyAction = useDeleteManyItemAction?.(itemSelectionSignal);
  const selection = itemSelectionSignal.value;
  const selectionLength = selection.length;
  const selectionController = useSelectionController({
    elementRef: innerRef,
    layout: "vertical",
    value: selection,
    onChange: (newValue) => {
      itemSelectionSignal.value = newValue;
    },
    multiple: Boolean(deleteManyAction),
  });
  useKeyboardShortcuts(innerRef, [
    ...createSelectionKeyboardShortcuts(selectionController),
    {
      enabled: deleteManyAction && selectionLength > 0,
      key: ["command+delete"],
      action: deleteManyAction,
      description: "Delete selected items",
      confirmMessage:
        selectionLength === 1
          ? `Are you sure you want to delete "${selection[0]}"?`
          : `Are you sure you want to delete the ${selectionLength} selected items?`,
      onStart: () => {
        setDeletedItems(selection);
      },
      onAbort: () => {
        setDeletedItems([]);
      },
      onError: () => {
        setDeletedItems([]);
      },
      onEnd: () => {
        setDeletedItems([]);
      },
    },
  ]);

  return (
    <ul ref={innerRef} className="explorer_item_list">
      {itemArray.map((item) => {
        return (
          <li className="explorer_item" key={item[idKey]}>
            <ExplorerItem
              nameKey={nameKey}
              item={item}
              deletedItems={deletedItems}
              renderItem={renderItem}
              selectionController={selectionController}
              useItemArrayInStore={useItemArrayInStore}
              useRenameItemAction={useRenameItemAction}
              useDeleteItemAction={
                deleteManyAction ? () => null : useDeleteItemAction
              }
            />
          </li>
        );
      })}
      {isCreatingNew && (
        <li className="explorer_item" key="new_item">
          <ExplorerNewItem
            nameKey={nameKey}
            useItemArrayInStore={useItemArrayInStore}
            useCreateItemAction={useCreateItemAction}
            cancelOnBlurInvalid
            onCancel={(e, reason) => {
              stopCreatingNew({
                shouldRestoreFocus: reason === "escape_key",
              });
            }}
            onActionEnd={(e) => {
              const input = e.target;
              const eventCausingAction = e.detail.event;
              const actionRequestedByKeyboard =
                eventCausingAction &&
                eventCausingAction.type === "keydown" &&
                eventCausingAction.key === "Enter";
              const shouldRestoreFocus =
                actionRequestedByKeyboard &&
                // If user focuses something else while action is running, respect it
                document.activeElement === input;
              stopCreatingNew({ shouldRestoreFocus });
            }}
          />
        </li>
      )}
    </ul>
  );
});
