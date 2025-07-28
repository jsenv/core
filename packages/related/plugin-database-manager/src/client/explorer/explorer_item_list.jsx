import { Selection, ShortcutProvider } from "@jsenv/navi";
import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
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
        shortcuts={[
          {
            enabled: selectionLength > 0,
            keyCombinations: ["command+backspace"],
            action: deleteManyAction,
            confirmMessage:
              selectionLength === 1
                ? `Are you sure you want to delete "${itemSelectionSignal.value[0]}"?`
                : `Are you sure you want to delete the ${selectionLength} selected items?`,
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
  return (
    <Selection
      value={itemSelectionSignal.value}
      onChange={(value) => {
        itemSelectionSignal.value = value;
      }}
    >
      <ShortcutProvider shortcuts={shortcuts} elementRef={elementRef}>
        {children}
      </ShortcutProvider>
    </Selection>
  );
};
