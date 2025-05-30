import { registerAction, registerRoute } from "@jsenv/router";
import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";

export const GET_TABLES_ROUTE = registerRoute("/tables", async ({ signal }) => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const response = await fetch(
    `/.internal/database/api/tables?public=${tablePublicFilter}`,
    { signal },
  );
  const tables = await response.json();
  tableInfoSignal.value = tables;
});

export const UPDATE_TABLE_ACTION = registerAction(
  async ({ tableName, columnName, formData }) => {
    const value = formData.get("value");
    await fetch(`/.internal/database/api/tables/${tableName}/${columnName}`, {
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });
    const { data, ...rest } = tableInfoSignal.value;
    const tableClient = data.find((table) => table.tablename === tableName);
    if (tableClient) {
      tableClient[columnName] = value;
      tableInfoSignal.value = {
        ...rest,
        data: [...data],
      };
    }
  },
);
