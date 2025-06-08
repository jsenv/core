import { useRouteIsMatching } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { EXPLORER_DATABASES_ROUTE } from "../explorer/explorer_routes.js";
import { DatabaseWithPlusSvg } from "./database_icons.jsx";
import { DatabaseLink } from "./database_link.jsx";
import {
  DELETE_DATABASE_ACTION,
  GET_DATABASE_ROUTE,
  POST_DATABASE_ACTION,
  PUT_DATABASE_ACTION,
} from "./database_routes.js";
import { useDatabaseCount, useDatabaseList } from "./database_signals.js";

export const databaseExplorerGroupController =
  createExplorerGroupController("databases");

export const ExplorerDatabases = (props) => {
  const databases = useDatabaseList();
  const databaseCount = useDatabaseCount();

  return (
    <ExplorerGroup
      {...props}
      controller={databaseExplorerGroupController}
      detailsRoute={EXPLORER_DATABASES_ROUTE}
      idKey="oid"
      nameKey="datname"
      labelChildren={
        <span style="display: flex; align-items: center; gap: 3px">
          DATABASES
          <span style="color: rgba(28, 43, 52, 0.4)">({databaseCount})</span>
        </span>
      }
      renderNewButtonChildren={() => <DatabaseWithPlusSvg />}
      renderItem={useCallback(
        (item, props) => (
          <DatabaseLink key={item.oid} database={item} {...props} />
        ),
        [],
      )}
      useItemList={useDatabaseList}
      useItemRouteIsActive={(database) =>
        useRouteIsMatching(GET_DATABASE_ROUTE, {
          datname: database.datname,
        })
      }
      useRenameItemAction={(database) =>
        PUT_DATABASE_ACTION.bindParams({
          datname: database.datname,
          columnName: "datname",
        })
      }
      useCreateItemAction={() => POST_DATABASE_ACTION}
      useDeleteItemAction={(database) =>
        DELETE_DATABASE_ACTION.bindParams({
          datname: database.datname,
        })
      }
    >
      {databases}
    </ExplorerGroup>
  );
};
