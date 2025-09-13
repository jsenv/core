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
  const listChildren = (
    <>
      {itemArray.map((item) => {
        return (
          <li className="explorer_item" key={item[idKey]}>
            <ExplorerItem
              idKey={idKey}
              nameKey={nameKey}
              item={item}
              deletedItems={deletedItems}
              renderItem={renderItem}
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
    </>
  );

  const list = (
    <ul ref={innerRef} className="explorer_item_list">
      {listChildren}
    </ul>
  );

  if (deleteManyAction) {
    const selectionLength = itemSelectionSignal.value.length;

    return (
      <ExplorerItemListWithShortcuts
        elementRef={innerRef}
        itemSelectionSignal={itemSelectionSignal}
        setDeletedItems={setDeletedItems}
        shortcuts={[
          {
            enabled: selectionLength > 0,
            key: ["command+delete"],
            action: deleteManyAction,
            description: "Delete selected items",
            confirmMessage:
              selectionLength === 1
                ? `Are you sure you want to delete "${itemSelectionSignal.value[0]}"?`
                : `Are you sure you want to delete the ${selectionLength} selected items?`,
            onStart: () => {
              setDeletedItems(itemSelectionSignal.value);
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
        ]}
      >
        {list}
      </ExplorerItemListWithShortcuts>
    );
  }

  return list;
});

const ExplorerItemListWithShortcuts = ({
  elementRef,
  itemSelectionSignal,
  shortcuts,
  children,
}) => {
  const selectionController = useSelectionController({
    elementRef,
    layout: "vertical",
    value: itemSelectionSignal.value,
    onChange: (newValue) => {
      itemSelectionSignal.value = newValue;
    },
    multiple: true,
  });
  useKeyboardShortcuts(elementRef, [
    ...createSelectionKeyboardShortcuts(selectionController),
    ...shortcuts,
  ]);

  return children;
};
