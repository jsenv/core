import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { errorFromResponse } from "../error_from_response.js";
import {
  setActiveDatabase,
  setActiveDatabaseColumns,
  setActiveDatabaseOwnerRole,
  setDatabaseCount,
} from "./database_signals.js";
import { databaseStore } from "./database_store.js";

export const GET_DATABASE_ROUTE = registerRoute(
  "/databases/:datname",
  async ({ params, signal }) => {
    const datname = params.datname;
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases/${datname}`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to get database`);
    }
    const { data, meta } = await response.json();
    const database = data;
    const { ownerRole, columns } = meta;
    setActiveDatabase(database);
    setActiveDatabaseColumns(columns);
    setActiveDatabaseOwnerRole(ownerRole);
  },
);
connectStoreAndRoute(databaseStore, GET_DATABASE_ROUTE, "datname");

export const POST_DATABASE_ACTION = registerAction(
  async ({ signal, formData }) => {
    const datname = formData.get("datname");
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases`,
      {
        signal,
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ datname }),
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to create database`);
    }
    const { data, meta } = await response.json();
    const database = data;
    databaseStore.upsert(database);
    setDatabaseCount(meta.count);
  },
);
export const PUT_DATABASE_ACTION = registerAction(
  async ({ datname, columnName, formData, signal }) => {
    let value = formData.get(columnName);
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases/${datname}/${value}`,
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
      throw await errorFromResponse(response, `Failed to update database`);
    }
    databaseStore.upsert("datname", datname, { [columnName]: value });
  },
);
export const DELETE_DATABASE_ACTION = registerAction(
  async ({ datname, signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases/${datname}`,
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
      throw await errorFromResponse(response, `Failed to delete database`);
    }
    const { meta } = await response.json();
    databaseStore.drop("datname", datname);
    setDatabaseCount(meta.count);
  },
);
