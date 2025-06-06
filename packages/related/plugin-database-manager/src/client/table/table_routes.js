import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { errorFromResponse } from "../error_from_response.js";
import { setActiveTable, setTableCount } from "./table_signals.js";
import { tableStore } from "./table_store.js";

export const GET_TABLE_ROUTE = registerRoute(
  "/tables/:tablename",
  async ({ params, signal }) => {
    const rolname = params.rolname;
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get table");
    }
    const { data } = await response.json();
    const table = data;
    setActiveTable(table);
  },
);
connectStoreAndRoute(tableStore, GET_TABLE_ROUTE, "tablename");

export const PUT_TABLE_ACTION = registerAction(
  async ({ tablename, columnName, formData, signal }) => {
    let value = formData.get(columnName);
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/tables/${tablename}/${columnName}`,
      {
        signal,
        method: "PUT",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(value),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to update table");
    }
    tableStore.upsert("tablename", tablename, { [columnName]: value });
  },
);

export const POST_TABLE_ACTION = registerAction(
  async ({ signal, formData }) => {
    const tablename = formData.get("tablename");
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
    const table = data;
    tableStore.upsert(table);
    setTableCount(meta.count);
  },
);

export const DELETE_TABLE_ACTION = registerAction(
  async ({ tablename, signal }) => {
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
    tableStore.drop("tablename", tablename);
    setTableCount(meta.count);
  },
);
