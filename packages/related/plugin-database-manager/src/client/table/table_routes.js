import { registerRoute } from "@jsenv/router";
import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";

export const GET_TABLES_ROUTE = registerRoute({
  "GET /.internal/database/tables": async ({ signal }) => {
    const tablePublicFilter = tablePublicFilterSignal.value;
    const response = await fetch(
      `/.internal/database/api/tables?public=${tablePublicFilter}`,
      { signal },
    );
    const tables = await response.json();
    tableInfoSignal.value = tables;
  },
});

export const PUT_TABLE_ROUTE = registerRoute({
  "PUT /.internal/database/api/tables/:name/:prop": async ({
    params,
    formData,
  }) => {
    const name = params.name;
    const prop = params.prop;
    const value = formData.get("value");
    await fetch(`/.internal/database/api/tables/${name}/${prop}`, {
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });
    const { data, ...rest } = tableInfoSignal.value;
    const table = data.find((table) => table.tablename === name);
    table[prop] = value;
    tableInfoSignal.value = {
      ...rest,
      data: [...data],
    };
  },
});
