import { useAction, useRouteIsMatching } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import { DatabaseWithPlusSvg } from "../database/database_icons.jsx";
import { DatabaseLink } from "../database/database_link.jsx";
import {
  DELETE_DATABASE_ACTION,
  GET_DATABASE_ROUTE,
  POST_DATABASE_ACTION,
  PUT_DATABASE_ACTION,
} from "../database/database_routes.js";
import {
  useDatabaseCount,
  useDatabaseList,
} from "../database/database_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "./explorer_group.jsx";
import { EXPLORER_DATABASES_ROUTE } from "./explorer_routes.js";

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
      createNewButtonChildren={<DatabaseWithPlusSvg />}
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
