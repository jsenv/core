import { useState } from "preact/hooks";

import { useTableCount } from "../database_manager_signals.js";
import { ExplorerGroup } from "../explorer/explorer_group.jsx";
import { TABLE_GET_MANY_ACTION } from "../routes.js";
import { TableWithPlusSvg } from "./table_icons.jsx";
import { TableLink } from "./table_link.jsx";
import {
  tableListHeightSignal,
  tableListOpenSignal,
} from "./table_list_state.js";
import { TABLE, useTableArrayInStore } from "./table_store.js";

export const TableListDetails = () => {
  const [resizable, setResizable] = useState(false);
  const tableCount = useTableCount();

  return (
    <ExplorerGroup
      id="table_list"
      open={tableListOpenSignal.value}
      detailsConnectedAction={TABLE_GET_MANY_ACTION}
      detailsUIAction={(open) => {
        tableListOpenSignal.value = open;
      }}
      resizable={resizable}
      height={tableListHeightSignal.value}
      onresizeend={(e) => {
        const newHeight = e.detail.size;
        tableListHeightSignal.value = newHeight;
      }}
      onresizablechange={(e) => {
        setResizable(e.detail.resizable);
      }}
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
    />
  );
};
