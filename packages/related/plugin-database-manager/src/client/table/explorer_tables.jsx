import { useRouteIsMatching } from "@jsenv/router";
import { TextAndCount } from "../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { TABLE_DETAILS_ROUTE } from "./explorer_table_routes.js";
import { TableWithPlusSvg } from "./table_icons.jsx";
import { TableLink } from "./table_link.jsx";
import {
  DELETE_TABLE_ACTION,
  GET_TABLE_ROUTE,
  POST_TABLE_ACTION,
  PUT_TABLE_ACTION,
} from "./table_routes.js";
import { useTableCount, useTableList } from "./table_signals.js";

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
      labelChildren={<TextAndCount text={"TABLES"} count={tableCount} />}
      renderNewButtonChildren={() => <TableWithPlusSvg />}
      renderItem={(item, props) => <TableLink table={item} {...props} />}
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
