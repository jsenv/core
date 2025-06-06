import { useRouteIsMatching } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import { TableWithPlusSvg } from "../table/table_icons.jsx";
import { TableLink } from "../table/table_link.jsx";
import {
  DELETE_TABLE_ACTION,
  GET_TABLE_ROUTE,
  POST_TABLE_ACTION,
  PUT_TABLE_ACTION,
} from "../table/table_routes.js";
import { useTableCount, useTableList } from "../table/table_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "./explorer_group.jsx";
import { TABLE_DETAILS_ROUTE } from "./explorer_routes.js";

export const tablesExplorerGroupController =
  createExplorerGroupController("tables");

export const ExplorerTables = (props) => {
  const tables = useTableList();
  const tableCount = useTableCount();

  return (
    <ExplorerGroup
      {...props}
      controller={tablesExplorerGroupController}
      detailsRoute={TABLE_DETAILS_ROUTE}
      idKey="oid"
      nameKey="tablename"
      labelChildren={
        <span style="display: flex; align-items: center; gap: 3px">
          TABLES
          <span style="color: rgba(28, 43, 52, 0.4)">({tableCount})</span>
        </span>
      }
      createNewButtonChildren={<TableWithPlusSvg />}
      renderItem={useCallback(
        (item, props) => (
          <TableLink key={item.oid} table={item} {...props} />
        ),
        [],
      )}
      useItemList={useTableList}
      useItemRouteIsActive={(table) =>
        useRouteIsMatching(GET_TABLE_ROUTE, {
          tablename: table.tablename,
        })
      }
      useRenameItemAction={(table) =>
        PUT_TABLE_ACTION.bindParams({
          tablename: table.tablename,
          columnName: "tablename",
        })
      }
      useCreateItemAction={() => POST_TABLE_ACTION}
      useDeleteItemAction={(table) =>
        DELETE_TABLE_ACTION.bindParams({
          tablename: table.tablename,
        })
      }
    >
      {tables}
    </ExplorerGroup>
  );
};
