import { TextAndCount } from "@jsenv/navi";
import { useDatabaseCount } from "../database_manager_signals.js";
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
      renderItem={(database, props) => (
        <DatabaseLink
          draggable={false}
          key={database.oid}
          value={database.datname}
          database={database}
          {...props}
        />
      )}
      useItemArrayInStore={useDatabaseArrayInStore}
      useCreateItemAction={(valueSignal) =>
        DATABASE.POST({
          datname: valueSignal,
        })
      }
      useDeleteItemAction={(database) =>
        DATABASE.DELETE.bindParams({
          datname: database.datname,
        })
      }
      useRenameItemAction={(database, valueSignal) =>
        DATABASE.PUT.bindParams({
          datname: database.datname,
          columnName: "datname",
          columnValue: valueSignal,
        })
      }
    >
      {databaseArray}
    </ExplorerGroup>
  );
};
