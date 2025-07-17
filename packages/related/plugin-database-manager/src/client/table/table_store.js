import { resource, useActionData } from "@jsenv/navi";
import { setTableCount } from "../database_signals.js";
import { errorFromResponse } from "../error_from_response.js";

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
    const { ownerRole, columns } = meta;
    return {
      ...table,
      ownerRole,
      meta: {
        columns,
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
      throw await errorFromResponse(response, "Failed to create role");
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
});

export const useTableArrayInStore = TABLE.useArray;
export const useTableArray = () => {
  const tableArray = useActionData(TABLE.GET_MANY);
  return tableArray;
};
