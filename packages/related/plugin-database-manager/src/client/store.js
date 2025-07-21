import { DATABASE } from "./database/database_store.js";
import { errorFromResponse } from "./error_from_response.js";
import { ROLE } from "./role/role_store.js";
import { TABLE } from "./table/table_store.js";

export const ROLE_MEMBERS = ROLE.many("members", ROLE, {
  GET_MANY: async ({ rolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/members/`,
      { signal },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to get members for ${rolname}`,
      );
    }
    const { data } = await response.json();
    const members = data;
    return members;
  },
  POST: async ({ rolname, memberRolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/members/${memberRolname}`,
      {
        signal,
        method: "PUT",
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to add ${memberRolname} to ${rolname}`,
      );
    }
    const { data } = await response.json();
    const member = data;
    return [{ rolname }, member];
  },
  DELETE: async ({ rolname, memberRolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/members/${memberRolname}`,
      {
        signal,
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to remove ${memberRolname} from ${rolname}`,
      );
    }
    return [{ rolname }, { rolname: memberRolname }];
  },
});
export const ROLE_DATABASES = ROLE.many("databases", DATABASE, {
  GET_MANY: async ({ rolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/databases/`,
      { signal },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to get databases for ${rolname}`,
      );
    }
    const { data } = await response.json();
    const databases = data;
    return databases;
  },
});
export const ROLE_TABLES = ROLE.many("tables", TABLE, {
  GET_MANY: async ({ rolname }, { signal }) => {
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/tables/`,
      { signal },
    );
    if (!response.ok) {
      throw await errorFromResponse(
        response,
        `Failed to get tables for ${rolname}`,
      );
    }
    const { data } = await response.json();
    const tables = data;
    return tables;
  },
});

export const DATABASE_OWNER = DATABASE.one("ownerRole", ROLE);

ROLE.store.upsert(window.DB_MANAGER_CONFIG.currentRole);
