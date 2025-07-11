import { TextAndCount } from "../components/text_and_count.jsx";
import { useDatabaseCount } from "../database_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import {
  databaseListDetailsOnToggle,
  databaseListDetailsOpenAtStart,
} from "./database_details_state.js";
import { DatabaseWithPlusSvg } from "./database_icons.jsx";
import { DatabaseLink } from "./database_link.jsx";
import {
  DATABASE,
  useDatabaseArray,
  useDatabaseArrayInStore,
} from "./database_store.js";

export const databasesDetailsController = createExplorerGroupController(
  "databases",
  {
    detailsOpenAtStart: databaseListDetailsOpenAtStart,
    detailsOnToggle: databaseListDetailsOnToggle,
  },
);

export const DatabasesDetails = (props) => {
  const databaseCount = useDatabaseCount();
  const databaseArray = useDatabaseArray();

  return (
    <ExplorerGroup
      {...props}
      controller={databasesDetailsController}
      detailsAction={DATABASE.GET_MANY}
      idKey="oid"
      nameKey="datname"
      labelChildren={<TextAndCount text={"DATABASES"} count={databaseCount} />}
      renderNewButtonChildren={() => <DatabaseWithPlusSvg />}
      renderItem={(item, props) => (
        <DatabaseLink
          draggable={false}
          key={item.oid}
          database={item}
          {...props}
        />
      )}
      useItemArrayInStore={useDatabaseArrayInStore}
      useRenameItemAction={(database) => {
        const renameAction = DATABASE.PUT.bindParams({
          datname: database.datname,
          columnName: "datname",
        });
        renameAction.meta.valueParamName = "columnValue";
        return renameAction;
      }}
      useCreateItemAction={() => DATABASE.POST}
      useDeleteItemAction={(database) =>
        DATABASE.DELETE.bindParams({
          datname: database.datname,
        })
      }
    >
      {databaseArray}
    </ExplorerGroup>
  );
};
