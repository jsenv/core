import { ExplorerItem, ExplorerNewItem } from "./explorer_item.jsx";

export const ExplorerItemList = ({
  idKey,
  nameKey,
  itemArray,
  renderItem,
  useItemArrayInStore,
  useRenameItemAction,
  useDeleteItemAction,
  isCreatingNew,
  useCreateItemAction,
  stopCreatingNew,
}) => {
  return (
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
            onCancel={() => {
              stopCreatingNew();
            }}
            onActionEnd={() => {
              stopCreatingNew();
            }}
          />
        </li>
      )}
    </ul>
  );
};
