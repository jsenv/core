import { useAction, useRouteIsMatching, useRouteUrl } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import { DatabaseWithPlusSvg } from "../database/database_icons.jsx";
import { DatabaseItem } from "../database/database_item.jsx";
import {
  DELETE_DATABASE_ACTION,
  GET_DATABASE_ROUTE,
  POST_DATABASE_ACTION,
  PUT_DATABASE_ACTION,
} from "../database/database_routes.js";
import { useDatabaseList } from "../database/database_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "./explorer_group.jsx";

export const databaseExplorerGroupController =
  createExplorerGroupController("databases");

export const ExplorerDatabases = (props) => {
  const databases = useDatabaseList();

  return (
    <ExplorerGroup
      {...props}
      controller={databaseExplorerGroupController}
      urlParam="databases"
      idKey="oid"
      nameKey="datname"
      labelChildren={
        <span style="display: flex; align-items: center; gap: 3px">
          DATABASES
          <span style="color: rgba(28, 43, 52, 0.4)">({databases.length})</span>
        </span>
      }
      createNewButtonChildren={<DatabaseWithPlusSvg />}
      renderItem={useCallback(
        (item) => (
          <DatabaseItem database={item} />
        ),
        [],
      )}
      useItemList={useDatabaseList}
      useItemRouteUrl={(database) =>
        useRouteUrl(GET_DATABASE_ROUTE, {
          datname: database.datname,
        })
      }
      useItemRouteIsActive={(database) =>
        useRouteIsMatching(GET_DATABASE_ROUTE, {
          datname: database.datname,
        })
      }
      useRenameItemAction={(database) =>
        useAction(PUT_DATABASE_ACTION, {
          datname: database.datname,
          columnName: "datname",
        })
      }
      useCreateItemAction={() => useAction(POST_DATABASE_ACTION)}
      useDeleteItemAction={(database) =>
        useAction(DELETE_DATABASE_ACTION, {
          datname: database.datname,
        })
      }
    >
      {databases}
    </ExplorerGroup>
  );
};
