import { resource, stateSignal } from "@jsenv/navi";

import { setTableCount } from "../database_manager_signals.js";
import { errorFromResponse } from "../error_from_response.js";

export const tableColumnNameSignal = stateSignal(undefined, {
  type: "string",
  persists: true,
});

export const TABLE = resource("table", {
  idKey: "tableoid",
  mutableIdKeys: ["tablename"],
  GET_MANY: async (_, { signal }) => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`, {
      signal,
    });
    const { data } = await response.json();
    return data;
  },
  GET: async ({ tablename }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get table");
    }
    const { data, meta } = await response.json();
    const table = data;
    const { ownerRole, columns, pgTableColumns } = meta;
    columns.sort((a, b) => a.ordinal_position - b.ordinal_position);
    table.columns = columns;

    return {
      ...table,
      ownerRole,
      meta: {
        pgTableColumns,
      },
    };
  },
  POST: async ({ tablename }, { signal }) => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`, {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ tablename }),
    });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to create table");
    }
    const { data, meta } = await response.json();
    const { count } = meta;
    setTableCount(count);
    return data;
  },
  DELETE: async ({ tablename }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}`,
      {
        signal,
        method: "DELETE",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to delete table`);
    }
    const { meta } = await response.json();
    const { count } = meta;
    setTableCount(count);
    return { tablename };
  },
  PUT: async ({ tablename, columnName, columnValue, signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/${columnName}`,
      {
        signal,
        method: "PUT",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(columnValue),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update table");
    }
    return ["tablename", tablename, { [columnName]: columnValue }];
  },

  DELETE_MANY: async ({ tablenames }, { signal }) => {
    const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/tables`, {
      signal,
      method: "DELETE",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(tablenames),
    });
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to delete table`);
    }
    const { meta } = await response.json();
    const { count } = meta;
    setTableCount(count);
    return tablenames.map((tablename) => ({ tablename }));
  },
});

export const useTableArrayInStore = TABLE.useArray;

const COLUMN = resource("table_column", {
  idKey: "column_name",
});
export const TABLE_COLUMN = TABLE.many("columns", COLUMN, {
  GET_MANY: async ({ tablename }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/columns`,
      { signal },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to get columns for ${tablename}`,
      );
    }
    const { data } = await response.json();
    const columns = data;
    return [{ tablename }, columns];
  },
  POST: async ({ tablename, column_name }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/columns`,
      {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ column_name }),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to add column to "${tablename}" table`,
      );
    }
    const { data: column } = await response.json();
    return [{ tablename }, column];
  },
  PUT: async (
    { tablename, column_name, propertyName, propertyValue },
    { signal },
  ) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/columns/${column_name}/${propertyName}`,
      {
        signal,
        method: "PUT",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(propertyValue),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to PUT ${tablename}.${column_name}.${propertyName} = ${propertyValue}`,
      );
    }
    const { data: column } = await response.json();
    // we return an array to say: we update this column with these props
    return [{ tablename }, { column_name }, column];
  },
  DELETE: async ({ tablename, column_name }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/columns/${column_name}`,
      {
        signal,
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to remove ${column_name} from ${tablename}`,
      );
    }
    return [{ tablename }, { column_name }];
  },
});

export const TABLE_ROW = resource("table_row", {
  GET_MANY: async ({ tablename }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/rows`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get table rows");
    }
    const { data } = await response.json();
    return data;
  },
  POST: async ({ tablename }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/rows`,
      {
        signal,
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to create row in "${tablename}" table`,
      );
    }
    const { data } = await response.json();
    return data;
  },
  PATCH: async ({ tablename, rowId, properties }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/rows/${rowId}`,
      {
        signal,
        method: "PATCH",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(properties),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to update row in "${tablename}" table`,
      );
    }
    const { data } = await response.json();
    return data;
  },
  DELETE: async ({ tablename, rowId }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/rows/${rowId}`,
      {
        signal,
        method: "DELETE",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to delete rows in "${tablename}" table`,
      );
    }
    return rowId;
  },
  DELETE_MANY: async ({ tablename, rowIds }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/rows`,
      {
        signal,
        method: "DELETE",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ rowIds }),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to delete rows in "${tablename}" table`,
      );
    }
    return rowIds;
  },
});
