import { TextAndCount } from "../components/text_and_count.jsx";
import { useTableCount } from "../database_signals.js";
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
      labelChildren={<TextAndCount text={"TABLES"} count={tableCount} />}
      renderNewButtonChildren={() => <TableWithPlusSvg />}
      renderItem={(item, props) => (
        <TableLink draggable={false} key={item.oid} table={item} {...props} />
      )}
      useItemArrayInStore={useTableArrayInStore}
      useRenameItemAction={(table) => {
        const renameAction = TABLE.PUT.bindParams({
          tablename: table.tablename,
          columnName: "tablename",
        });
        renameAction.meta.valueParamName = "columnValue";
        return renameAction;
      }}
      useCreateItemAction={() => TABLE.POST}
      useDeleteItemAction={(table) =>
        TABLE.DELETE.bindParams({
          tablename: table.tablename,
        })
      }
    >
      {tableArray}
    </ExplorerGroup>
  );
};
