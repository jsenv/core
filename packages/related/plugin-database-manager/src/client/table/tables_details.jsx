import { useTableCount } from "../database_manager_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { TableWithPlusSvg } from "./table_icons.jsx";
import { TableLink } from "./table_link.jsx";
import { TABLE, useTableArray, useTableArrayInStore } from "./table_store.js";
import {
  tableListDetailsOnToggle,
  tableListDetailsOpenAtStart,
} from "./tables_details_state.js";

const TextAndCount = (props) => props;

export const tablesDetailsController = createExplorerGroupController("tables", {
  detailsOpenAtStart: tableListDetailsOpenAtStart,
  detailsOnToggle: tableListDetailsOnToggle,
});

export const TablesDetails = (props) => {
  const tableCount = useTableCount();
  const tableArray = useTableArray();

  return (
    <ExplorerGroup
      {...props}
      controller={tablesDetailsController}
      detailsAction={TABLE.GET_MANY}
      idKey="oid"
      nameKey="tablename"
      labelChildren={<TextAndCount text={"TABLES"} count={tableCount} />}
      renderNewButtonChildren={() => <TableWithPlusSvg />}
      renderItem={(table, props) => (
        <TableLink
          key={table.oid}
          value={table.tablename}
          readOnly={props.deletedItems.includes(table.tablename)}
          loading={props.deletedItems.includes(table.tablename)}
          table={table}
          draggable={false}
          {...props}
        />
      )}
      useItemArrayInStore={useTableArrayInStore}
      useCreateItemAction={(nameSignal) =>
        TABLE.POST.bindParams({
          tablename: nameSignal,
        })
      }
      useRenameItemAction={(table, valueSignal) =>
        TABLE.PUT.bindParams({
          tablename: table.tablename,
          columnName: "tablename",
          columnValue: valueSignal,
        })
      }
      useDeleteItemAction={(table) =>
        TABLE.DELETE.bindParams({
          tablename: table.tablename,
        })
      }
      useDeleteManyItemAction={(itemNamesSignal) =>
        TABLE.DELETE_MANY.bindParams({
          tablenames: itemNamesSignal,
        })
      }
    >
      {tableArray}
    </ExplorerGroup>
  );
};
