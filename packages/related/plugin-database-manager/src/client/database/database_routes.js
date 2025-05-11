import { registerRoute, registerAction } from "@jsenv/router";
import { connectStoreAndRoute } from "@jsenv/sigi";
import { roleStore } from "../role/role_store.js";
import { databaseStore } from "./database_store.js";
import {
  setActiveDatabase,
  setActiveDatabaseColumns,
  setActiveDatabaseOwnerRole,
} from "./database_signals.js";

export const GET_DATABASE_ROUTE = registerRoute(
  "/.internal/database/databases/:datname",
  async ({ params, signal }) => {
    const datname = params.datname;
    const response = await fetch(
      `/.internal/database/api/databases/${datname}`,
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
    const { database, ownerRole, columns } = await response.json();
    setActiveDatabase(database);
    setActiveDatabaseColumns(columns);
    setActiveDatabaseOwnerRole(database, ownerRole);
  },
);
connectStoreAndRoute(databaseStore, GET_DATABASE_ROUTE, "datname");
export const POST_DATABASE_ACTION = registerAction(
  async ({ signal, formData }) => {
    const datname = formData.get("datname");
    const response = await fetch(`/.internal/database/api/databases`, {
      signal,
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ datname }),
    });
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
      `/.internal/database/api/databases/${datname}/${value}`,
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
      const putError = new Error(
        `Failed to update database: ${response.status} ${response.statusText}`,
      );
      putError.stack = error.stack || error.message;
      throw putError;
    }
    roleStore.upsert("datname", datname, { [columnName]: value });
  },
);
export const DELETE_DATABASE_ACTION = registerAction(
  async ({ datname, signal }) => {
    const response = await fetch(
      `/.internal/database/api/databases/${datname}`,
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
