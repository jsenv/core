import {
  createSelectionKeyboardShortcuts,
  Nav,
  useKeyboardShortcuts,
  useSelectionController,
} from "@jsenv/navi";
import { useSignal } from "@preact/signals";
import { useRef, useState } from "preact/hooks";

import { ExplorerItem, ExplorerNewItem } from "./explorer_item.jsx";

export const ExplorerItemList = (props) => {
  const {
    idKey,
    nameKey,
    itemArray,
    renderItem,
    useItemArrayInStore,
    renameItemAction,
    deleteManyItemAction,
    deleteItemAction,
    isCreatingNew,
    createItemAction,
    stopCreatingNew,
  } = props;
  const ref = useRef();

  const itemSelectionSignal = useSignal([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const selection = itemSelectionSignal.value;
  const selectionLength = selection.length;
  const selectionController = useSelectionController({
    elementRef: ref,
    layout: "vertical",
    value: selection,
    onChange: (newValue) => {
      itemSelectionSignal.value = newValue;
    },
    multiple: Boolean(deleteManyItemAction),
  });
  useKeyboardShortcuts(ref, [
    ...createSelectionKeyboardShortcuts(selectionController),
    {
      enabled: deleteManyItemAction && selectionLength > 0,
      key: ["command+delete"],
      action: () => deleteManyItemAction(itemSelectionSignal.value),
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
    <Nav
      ref={ref}
      vertical
      className="explorer_item_list"
      indicator="end"
      expandX
      spacing="0"
      lineHeight="normal"
    >
      <ul style="display: contents; list-style-type: none;">
        {itemArray.map((item) => {
          return (
            <li key={item[idKey]} className="explorer_item">
              <ExplorerItem
                nameKey={nameKey}
                item={item}
                deletedItems={deletedItems}
                renderItem={renderItem}
                selectionController={selectionController}
                useItemArrayInStore={useItemArrayInStore}
                renameItemAction={renameItemAction}
                deleteItemAction={
                  deleteManyItemAction ? () => null : deleteItemAction
                }
              />
            </li>
          );
        })}
        {isCreatingNew && (
          <li key="new_item" className="explorer_item" style="display: block">
            <ExplorerNewItem
              nameKey={nameKey}
              useItemArrayInStore={useItemArrayInStore}
              createItemAction={createItemAction}
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
    </Nav>
  );
};
