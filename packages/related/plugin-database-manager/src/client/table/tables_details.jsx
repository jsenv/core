import { TextAndCount } from "../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { TableWithPlusSvg } from "./table_icons.jsx";
import { TableLink } from "./table_link.jsx";
import {
  DELETE_TABLE_ACTION,
  POST_TABLE_ACTION,
  PUT_TABLE_ACTION,
} from "./table_routes.js";
import { useTableCount, useTableList } from "./table_signals.js";
import { TABLES_DETAILS_ROUTE } from "./tables_details_routes.js";

export const tablesDetailsController = createExplorerGroupController("tables");

export const TablesDetails = (props) => {
  const tables = useTableList();
  const tableCount = useTableCount();

  return (
    <ExplorerGroup
      {...props}
      controller={tablesDetailsController}
      detailsRoute={TABLES_DETAILS_ROUTE}
      idKey="oid"
      nameKey="tablename"
      labelChildren={<TextAndCount text={"TABLES"} count={tableCount} />}
      renderNewButtonChildren={() => <TableWithPlusSvg />}
      renderItem={(item, props) => <TableLink table={item} {...props} />}
      useItemList={useTableList}
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
