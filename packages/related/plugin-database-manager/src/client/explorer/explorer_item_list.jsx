import { Selection } from "@jsenv/navi";
import { useSignal } from "@preact/signals";
import { ExplorerItem, ExplorerNewItem } from "./explorer_item.jsx";

export const ExplorerItemList = ({
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
}) => {
  const itemSelectionSignal = useSignal([]);
  const deleteManyAction = useDeleteManyItemAction(itemSelectionSignal);

  return (
    <Selection
      value={itemSelectionSignal.value}
      onChange={(value) => {
        itemSelectionSignal.value = value;
      }}
    >
      <ul className="explorer_item_list">
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
                useDeleteItemAction={useDeleteItemAction}
                deleteManyAction={deleteManyAction}
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
    </Selection>
  );
};
