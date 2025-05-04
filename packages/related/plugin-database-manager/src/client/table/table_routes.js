import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";

export const tableRoutes = {
  "GET /.internal/database/tables": async ({ signal }) => {
    const tablePublicFilter = tablePublicFilterSignal.value;
    const response = await fetch(
      `/.internal/database/api/tables?public=${tablePublicFilter}`,
      { signal },
    );
    const tables = await response.json();
    tableInfoSignal.value = tables;
  },
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
};
