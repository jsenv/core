import { registerAction, registerRoute } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { roleStore } from "../role/role_store.js";
import {
  setActiveDatabase,
  setActiveDatabaseColumns,
  setActiveDatabaseOwnerRole,
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
      const error = await response.json();
      const getError = new Error(`Failed to get database: ${error.message}`);
      getError.stack = error.stack || error.message;
      throw getError;
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
      const error = await response.json();
      const postError = new Error(
        `Failed to create database: ${error.message}`,
      );
      postError.stack = error.stack || error.message;
      throw postError;
    }
    const database = await response.json();
    databaseStore.upsert(database);
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
      const error = await response.json();
      const putError = new Error(`Failed to update database: ${error.message}`);
      putError.stack = error.stack || error.message;
      throw putError;
    }
    roleStore.upsert("datname", datname, { [columnName]: value });
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
      const error = await response.json();
      const deleteError = new Error(
        `Failed to delete database: ${error.message}`,
      );
      deleteError.stack = error.stack || error.message;
      throw deleteError;
    }
    roleStore.drop("datname", datname);
  },
);
