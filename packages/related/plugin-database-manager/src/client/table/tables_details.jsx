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
      label="TABLES"
      count={tableCount}
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
      createItemAction={(tablename) =>
        TABLE.POST({
          tablename,
        })
      }
      renameItemAction={(table, newTablename) =>
        TABLE.PUT({
          tablename: table.tablename,
          columnName: "tablename",
          columnValue: newTablename,
        })
      }
      deleteItemAction={(table) =>
        TABLE.DELETE({
          tablename: table.tablename,
        })
      }
      deleteManyItemAction={(itemNames) =>
        TABLE.DELETE_MANY({
          tablenames: itemNames,
        })
      }
    >
      {tableArray}
    </ExplorerGroup>
  );
};
