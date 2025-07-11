import { resource, useActionData } from "@jsenv/navi";
import { signal } from "@preact/signals";
import { setDatabaseCount } from "../database_signals.js";
import { errorFromResponse } from "../error_from_response.js";

export const DATABASE = resource("database", {
  idKey: "oid",
  mutableIdKeys: ["datname"],
  GET_MANY: async (_, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases`,
      {
        signal,
      },
    );
    const {
      data,
      // { currentRole }
      // meta,
    } = await response.json();
    return data;
  },
  GET: async ({ datname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases/${datname}`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, `Failed to get database`);
    }

    const {
      data,
      // { databases, columns, ownerRole }
      meta,
    } = await response.json();
    return {
      ...data,
      ...meta,
    };
  },
  POST: async ({ datname }, { signal }) => {
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
    const { databaseCount } = meta;
    setDatabaseCount(databaseCount);
    return data;
  },
  DELETE: async ({ datname }, { signal }) => {
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
    const { databaseCount } = meta;
    setDatabaseCount(databaseCount);
    return { datname };
  },
  PUT: async ({ datname, columnName, columnValue, signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/databases/${datname}/${columnValue}`,
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
      throw await errorFromResponse(response, `Failed to update database`);
    }
    return ["datname", datname, { [columnName]: columnValue }];
  },
});
export const useDatabaseArrayInStore = DATABASE.useArray;
export const useDatabaseArray = () => {
  const databaseArray = useActionData(DATABASE.GET_MANY);
  return databaseArray;
};

const currentDatabaseIdSignal = signal(
  window.DB_MANAGER_CONFIG.currentDatabase.oid,
);
export const setCurrentDatabaseId = (id) => {
  currentDatabaseIdSignal.value = id;
};
export const useCurrentDatabase = () => {
  const currentDatabaseId = currentDatabaseIdSignal.value;
  const currentDatabase = DATABASE.store.select(currentDatabaseId);
  return currentDatabase;
};
