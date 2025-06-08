import { ExplorerItem, ExplorerNewItem } from "./explorer_item.jsx";

export const ExplorerItemList = ({
  idKey,
  nameKey,
  renderItem,
  useItemList,
  useItemRouteIsActive,
  useRenameItemAction,
  useDeleteItemAction,
  isCreatingNew,
  useCreateItemAction,
  stopCreatingNew,
  children,
}) => {
  return (
    <ul className="explorer_item_list">
      {children.map((item) => {
        return (
          <li className="explorer_item" key={item[idKey]}>
            <ExplorerItem
              idKey={idKey}
              nameKey={nameKey}
              item={item}
              renderItem={renderItem}
              useItemList={useItemList}
              useItemRouteIsActive={useItemRouteIsActive}
              useRenameItemAction={useRenameItemAction}
              useDeleteItemAction={useDeleteItemAction}
            />
          </li>
        );
      })}
      {isCreatingNew && (
        <li className="explorer_item">
          <ExplorerNewItem
            nameKey={nameKey}
            useItemList={useItemList}
            useCreateItemAction={useCreateItemAction}
            cancelOnBlurInvalid
            onCancel={() => {
              // si on a rien rentré on le cré pas, sinon oui on le cré
              stopCreatingNew();
            }}
            onSubmitEnd={() => {
              stopCreatingNew();
            }}
          />
        </li>
      )}
    </ul>
  );
};
